import { defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { WorkforceStore } from '../workforce/store.js';
import { WorkforceError, requirePermission } from '../workforce/policy.js';
import { kmsDocumentCipher } from '../workforce/documentEncryption.js';
import { CERTIFIED_CODEC_AVAILABLE, pendingConnector } from './connector.js';
import { EligibilityStore } from './store.js';
import { EligibilityService, canDispatch, runWorker, enqueueLifecycle, type Filters, type Release } from './service.js';
import { MONTHLY_CRON, TIME_ZONE, access } from './domain.js';
import { HhaEligibilitySource } from './hha.js';
import type { OperationsWorkspace } from '../operations/workspace.js';
import { RosterReconciler } from './roster.js';

const dataApproved=defineString('ELIGIBILITY_DATA_APPROVED',{default:'false'});
const connectivityApproved=defineString('ELIGIBILITY_CONNECTIVITY_APPROVED',{default:'false'});
const schedulesApproved=defineString('ELIGIBILITY_SCHEDULES_APPROVED',{default:'false'});
const sourceApproved=defineString('ELIGIBILITY_HHA_SYNC_APPROVED',{default:'false'});
const preServiceApproved=defineString('ELIGIBILITY_PRE_SERVICE_APPROVED',{default:'false'});
const approvedRate=defineString('ELIGIBILITY_APPROVED_REQUESTS_PER_MINUTE',{default:'0'});
const approvedOffices=defineString('ELIGIBILITY_APPROVED_OFFICES',{default:''});
export function release():Release {
  return {dataApproved:dataApproved.value()==='true',connectivityApproved:connectivityApproved.value()==='true',
    codecReady:CERTIFIED_CODEC_AVAILABLE,scheduleEnabled:schedulesApproved.value()==='true',preServiceEnabled:preServiceApproved.value()==='true',
    hhaSyncApproved:sourceApproved.value()==='true',requestsPerMinute:Number(approvedRate.value()),offices:approvedOffices.value().split(',').filter(Boolean)};
}
interface Request {method:string;body?:any;rawBody:Buffer;is(type:string):unknown;query?:unknown}
export async function eligibilityRoute(path:string,req:Request,uid:string,workspace:()=>OperationsWorkspace):Promise<unknown> {
  if(req.method!=='POST'||!req.is('application/json')||req.rawBody.length>8000||!req.body||typeof req.body!=='object'||Array.isArray(req.body))throw new WorkforceError(400,'invalid_request');
  const actor=()=>new WorkforceStore().actor(uid),store=new EligibilityStore(),service=new EligibilityService(store,actor,release);
  if(path==='/staff/eligibility/query'){
    if(Object.keys(req.body).some(k=>!['office','filters','after'].includes(k)))throw new WorkforceError(400,'invalid_request');
    return service.query(req.body.office,req.body.filters as Filters,req.body.after);
  }
  if(path==='/staff/eligibility/sync'){
    const a=await actor();access(a,'verify',req.body.office);
    if(!release().dataApproved||!release().hhaSyncApproved||!release().offices.includes(req.body.office))throw new WorkforceError(423,'eligibility_source_pending');
    if(Object.keys(req.body).some(k=>!['office','patientId'].includes(k)))throw new WorkforceError(400,'invalid_request');
    const source=await new HhaEligibilitySource(workspace()).read(req.body.office,req.body.patientId,uid);
    if(!source)throw new WorkforceError(404,'eligibility_member_not_found');
    access(await actor(),'verify',req.body.office);
    if(!release().dataApproved||!release().hhaSyncApproved)throw new WorkforceError(423,'eligibility_source_pending');
    const synced=await store.syncMember(source.snapshot,source.identity,kmsDocumentCipher(),uid);
    if(synced.admitted&&!(await store.reconciliation(synced.member)).hold)await enqueueLifecycle(store,release(),synced.member,'admission','source_'+synced.member.revision);
    return {synced:true,memberKey:synced.member.key};
  }
  const match=/^\/staff\/eligibility\/([a-f0-9]{64})\/(verify|history|review|identifier|reconciliation|canonical)$/.exec(path);
  if(!match)throw new WorkforceError(404,'route_not_found');
  if(match[2]==='verify'){
    if(Object.keys(req.body).some(k=>k!=='idempotencyKey'))throw new WorkforceError(400,'invalid_request');
    const job=await service.request(match[1]!,req.body.idempotencyKey);return {jobId:job.id,state:job.state};
  }
  if(match[2]==='history'){
    if(Object.keys(req.body).length)throw new WorkforceError(400,'invalid_request');return service.history(match[1]!);
  }
  if(match[2]==='reconciliation'){
    if(Object.keys(req.body).length)throw new WorkforceError(400,'invalid_request');return service.reconciliationDetail(match[1]!);
  }
  if(match[2]==='canonical'){
    if(Object.keys(req.body).some(k=>!['revision','canonicalKey','note'].includes(k)))throw new WorkforceError(400,'invalid_request');
    return service.selectCanonical(match[1]!,req.body.revision,req.body.canonicalKey,req.body.note);
  }
  if(match[2]==='identifier'){
    if(Object.keys(req.body).length)throw new WorkforceError(400,'invalid_request');
    const staff=await actor();requirePermission(staff,'eligibility.identifiers');
    if(!release().dataApproved)throw new WorkforceError(423,'eligibility_release_pending');
    const member=await store.read(match[1]!);requirePermission(staff,'eligibility.identifiers',member.office);
    if(!release().offices.includes(member.office))throw new WorkforceError(403,'workforce_forbidden');
    const identity=await store.identity(member,kmsDocumentCipher());
    requirePermission(await actor(),'eligibility.identifiers',member.office);
    if((await store.read(member.key)).identityRevision!==member.identityRevision)throw new WorkforceError(409,'revision_conflict');
    if(!release().dataApproved)throw new WorkforceError(423,'eligibility_release_pending');
    await store.audit(uid,'identifier_revealed',member.office,member.key);
    return {medicaidId:identity?.medicaidId??null};
  }
  return service.review(match[1]!,req.body);
}
export const workforceEligibilityMonthly=process.env.PRIMETIME_API_ONLY_DEPLOY==='true'?undefined:onSchedule({
  region:'us-central1',schedule:MONTHLY_CRON,timeZone:TIME_ZONE,timeoutSeconds:540,memory:'256MiB',maxInstances:1,concurrency:1,retryCount:3,
},async event=>{
  const config=release();if(!canDispatch(config)||!config.scheduleEnabled)return;
  const store=new EligibilityStore();
  // Scheduler retries use the original scheduled day and deterministic member job IDs.
  const at=new Date(event.scheduleTime);
  for(const office of config.offices)await store.enqueueMonthly(office,at);
});
export const workforceEligibilityWorker=process.env.PRIMETIME_API_ONLY_DEPLOY==='true'?undefined:onSchedule({
  region:'us-central1',schedule:'every 1 minutes',timeZone:TIME_ZONE,timeoutSeconds:120,memory:'256MiB',maxInstances:1,concurrency:1,retryCount:0,
},async()=>{
  if(!canDispatch(release()))return;
  try {await runWorker({store:new EligibilityStore(),connector:pendingConnector,cipher:kmsDocumentCipher,release,
    authorize:async job=>{if(job.trigger==='manual'){const user=await getAuth().getUser(job.requestedBy);if(user.disabled||!user.emailVerified)throw new WorkforceError(403,'workforce_forbidden');access(await new WorkforceStore().actor(job.requestedBy),'verify',job.office);}},
  });}catch{logger.warn('Eligibility worker deferred',{code:'eligibility_worker_unavailable'});}
});

// The existing HHA shared quota applies to every SOAP call. A manifest/cursor makes
// the refresh resumable; a partial or failed scan is never described as complete.
export async function refreshRosterPage(workspace:()=>OperationsWorkspace){
  const config=release();if(!config.dataApproved||!config.hhaSyncApproved)return;
  const store=new EligibilityStore(),source=new HhaEligibilitySource(workspace());
  for(const office of config.offices){
    await new RosterReconciler(store,source,kmsDocumentCipher,()=>{const current=release();
      return current.dataApproved&&current.hhaSyncApproved&&current.offices.includes(office);}).tick(office);
    if(canDispatch(release())&&release().offices.includes(office))await store.enqueueAdmissionsPage(office);
  }
}
