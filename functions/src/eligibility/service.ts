import { WorkforceError, validId, type Actor } from '../workforce/policy.js';
import type { DocumentCipher } from '../workforce/documentEncryption.js';
import { EligibilityStore } from './store.js';
import { access, chicagoDate, dateOnly, discrepancyFlags, nextScheduled, opaqueId, unavailable, type Job, type Member, type Trigger } from './domain.js';
import type { EligibilityConnector } from './connector.js';
import { rosterReady, type RosterState } from './roster.js';

export interface Release {
  dataApproved: boolean; connectivityApproved: boolean; codecReady: boolean; scheduleEnabled: boolean;
  preServiceEnabled: boolean; hhaSyncApproved: boolean; requestsPerMinute: number; offices: string[];
}
export function canDispatch(release: Release): boolean {
  return release.dataApproved && release.connectivityApproved && release.codecReady &&
    Number.isFinite(release.requestsPerMinute) && release.requestsPerMinute>0 && release.requestsPerMinute<=60;
}
export interface Filters {department?: string; mco?: string; status?: string; verifiedAfter?: string; verifiedBefore?: string; assignee?: string; reviewOnly?: boolean; changedOnly?: boolean; reconciliation?:string}
export function filtered(member: Member, filters: Filters): boolean {
  return (!filters.department || member.department===filters.department) &&
    (!filters.status || (member.latest?.status??'unable_to_verify')===filters.status) &&
    (!filters.assignee || member.assignee===filters.assignee) &&
    (!filters.reviewOnly || ['pending','in_progress'].includes(member.review)) &&
    (!filters.changedOnly || member.changedAt!==null) &&
    (!filters.mco || member.latest?.mco?.some(m=>m.name?.toLowerCase().includes(filters.mco!.toLowerCase()))===true) &&
    (!filters.verifiedAfter || !!member.latest && chicagoDate(new Date(member.latest.checkedAt))>=filters.verifiedAfter) &&
    (!filters.verifiedBefore || !!member.latest && chicagoDate(new Date(member.latest.checkedAt))<=filters.verifiedBefore);
}
export class EligibilityService {
  constructor(private store: EligibilityStore, private actor: ()=>Promise<Actor>, private release: ()=>Release, private now=()=>new Date()) {}
  async query(office: string, filters: Filters = {}, after = '') {
    const actor=await this.actor(); access(actor,'read',office);
    const release=this.release();
    if (!release.dataApproved) return {available:false,reason:'eligibility_release_pending',items:[],summary:null,next:null,connectionReady:false,nextScheduled:null};
    if (!release.offices.includes(office)) throw new WorkforceError(403,'workforce_forbidden');
    if (!filters || typeof filters!=='object' || Array.isArray(filters) || Object.keys(filters).some(k=>!['department','mco','status','verifiedAfter','verifiedBefore','assignee','reviewOnly','changedOnly','reconciliation'].includes(k))) throw new WorkforceError(400,'invalid_filters');
    if(filters.reconciliation!==undefined&&!['','duplicates','missing','holds','inactive'].includes(filters.reconciliation))throw new WorkforceError(400,'invalid_filters');
    for (const value of [filters.department,filters.mco,filters.status]) if (value!==undefined&&(typeof value!=='string'||value.length>100)) throw new WorkforceError(400,'invalid_filters');
    if(filters.assignee!==undefined&&(typeof filters.assignee!=='string'||filters.assignee.length>128)) throw new WorkforceError(400,'invalid_filters');
    for (const value of [filters.reviewOnly,filters.changedOnly]) if (value!==undefined&&typeof value!=='boolean') throw new WorkforceError(400,'invalid_filters');
    if (filters.status&&!['active','inactive','unable_to_verify'].includes(filters.status)) throw new WorkforceError(400,'invalid_filters');
    if (filters.verifiedAfter) dateOnly(filters.verifiedAfter); if (filters.verifiedBefore) dateOnly(filters.verifiedBefore);
    if (filters.verifiedAfter&&filters.verifiedBefore&&filters.verifiedAfter>filters.verifiedBefore) throw new WorkforceError(400,'invalid_filters');
    if (after && !/^[a-f0-9]{64}$/.test(after)) throw new WorkforceError(400,'invalid_request');
    const all: Member[]=[]; let cursor='';
    do { const page=await this.store.list(office,cursor); all.push(...page.items); cursor=page.next??''; } while(cursor&&all.length<10000);
    const active=all.filter(m=>m.active),states=await this.store.reconciliations(all,this.now().getTime());
    const selected=all.filter(m=>{
      const state=states.get(m.key)!;
      const scope=filters.reconciliation==='duplicates'?state.duplicate:filters.reconciliation==='missing'?m.sourceState==='missing':
        filters.reconciliation==='inactive'?!m.active:filters.reconciliation==='holds'?!!state.hold:m.active;
      return scope&&filtered({...m,review:state.duplicate&&state.hold||m.sourceState==='missing'?'pending':m.review},filters)&&(!after||m.key>after);
    });
    const reviewers=await this.store.reviewers(office);
    const current=await this.actor(); access(current,'read',office);
    if (!this.release().dataApproved) throw new WorkforceError(423,'eligibility_release_pending');
    await this.store.audit(actor.uid,'dashboard_read',office);
    const summary={total:active.length,active:0,inactive:0,unable_to_verify:0,pendingReview:0,changed:0,reconciliationHolds:0,lastSuccessful:null as string|null};
    for(const member of active){summary[member.latest?.status??'unable_to_verify']++;if(['pending','in_progress'].includes(member.review))summary.pendingReview++;
      if(states.get(member.key)?.hold){summary.reconciliationHolds++;if(!['pending','in_progress'].includes(member.review))summary.pendingReview++;}
      if(member.changedAt)summary.changed++;if(member.lastSuccessful&&(!summary.lastSuccessful||member.lastSuccessful.checkedAt>summary.lastSuccessful))summary.lastSuccessful=member.lastSuccessful.checkedAt;}
    const readiness=(await this.store.db.collection('medicaidRoster').doc(office).get()).data();
    return {available:true,items:selected.slice(0,50).map(m=>{const state=states.get(m.key)!;return {...m,
      reconciliation:{...state,canonicalKey:state.canonicalKey===m.key?m.key:null},medicaidId:m.identityReady?'Protected':'Unavailable',discrepancies:discrepancyFlags(m,chicagoDate(this.now()))};}),
      summary,reviewers:reviewers.items,reviewersComplete:reviewers.complete,next:selected.length>50?selected[49]!.key:null,summaryComplete:!cursor,rosterComplete:rosterReady(readiness as RosterState|undefined,this.now().getTime()),
      rosterProgress:readiness?{phase:readiness.phase??'unreconciled',processed:readiness.offset??0,total:readiness.ids?.length??0,missing:readiness.missingCount??0}:null,
      rosterVerifiedAt:readiness?.completedAt??null,connectionReady:canDispatch(release),nextScheduled:canDispatch(release)&&release.scheduleEnabled?nextScheduled(this.now()):null};
  }
  private async member(key: string, action: 'read'|'verify'|'review') {
    const actor=await this.actor(); access(actor,action);
    if(!this.release().dataApproved)throw new WorkforceError(423,'eligibility_release_pending');
    const member=await this.store.read(key);access(actor,action,member.office);
    if(!this.release().offices.includes(member.office))throw new WorkforceError(403,'workforce_forbidden');
    return {actor,member};
  }
  async request(key:string, idempotencyKey:string) {
    const {actor,member}=await this.member(key,'verify');
    if(!canDispatch(this.release()))throw new WorkforceError(423,'eligibility_connection_pending');
    return this.store.enqueue(member.key,chicagoDate(this.now()),'manual',idempotencyKey,actor.uid,this.now());
  }
  async history(key:string) { const {actor,member}=await this.member(key,'read'); const result=await this.store.history(key);
    await this.member(key,'read');await this.store.audit(actor.uid,'history_read',member.office,key);return result; }
  async reconciliationDetail(key:string){const {actor,member}=await this.member(key,'review');
    const scoped={...actor,grant:{...actor.grant,offices:actor.grant.offices.filter(office=>this.release().offices.includes(office))}};
    const result=await this.store.reconciliationDetail(scoped,key);await this.member(key,'review');
    const current=await this.actor();for(const linked of result.members){access(current,'review',linked.office);
      if(!this.release().offices.includes(linked.office))throw new WorkforceError(403,'workforce_forbidden');}
    await this.store.audit(actor.uid,'identity_reconciliation_read',member.office,key);return result;
  }
  async selectCanonical(key:string,revision:number,canonicalKey:string,note:string){const {actor}=await this.member(key,'review');
    const detail=await this.reconciliationDetail(key);
    if(!detail.canResolve)throw new WorkforceError(403,'workforce_forbidden');
    return this.store.selectCanonical(actor,key,revision,canonicalKey,note);
  }
  async review(key:string,input: Record<string,unknown>) {
    const {actor}=await this.member(key,'review');
    if(Object.keys(input).some(k=>!['revision','action','note','department','assignee'].includes(k)))throw new WorkforceError(400,'invalid_request');
    await this.store.review(actor,key,input.revision as number,input.action as 'in_progress'|'resolved',input.note as string,input.department as string,input.assignee as string|null);
    return {saved:true};
  }
}
export interface WorkerDependencies {
  store: EligibilityStore; connector: EligibilityConnector; cipher: ()=>DocumentCipher; release: ()=>Release;
  authorize: (job:Job)=>Promise<void>;
}
export async function processJob(job:Job, deps:WorkerDependencies) {
  const now=new Date();
  let result;
  try {
    await deps.authorize(job);
    const member=await deps.store.read(job.memberKey);
    if((await deps.store.reconciliation(member)).hold)throw new WorkforceError(409,'eligibility_reconciliation_required');
    const sourceAge=now.getTime()-Date.parse(member.sourceFetchedAt);
    if(!Number.isFinite(sourceAge)||sourceAge<0||sourceAge>48*3600000)throw new WorkforceError(423,'eligibility_source_stale');
    if(!member.active||member.identityRevision!==job.identityRevision||member.office!==job.office||!deps.release().offices.includes(member.office)||!canDispatch(deps.release()))throw new WorkforceError(423,'eligibility_connection_pending');
    const identity=await deps.store.identity(member,deps.cipher());
    // Recheck after KMS/source IO, immediately before any external transmission.
    await deps.authorize(job);
    const current=await deps.store.read(job.memberKey);
    if((await deps.store.reconciliation(current)).hold)throw new WorkforceError(409,'eligibility_reconciliation_required');
    if(!current.active||current.identityRevision!==member.identityRevision)throw new WorkforceError(409,'member_changed');
    if(!canDispatch(deps.release()))throw new WorkforceError(423,'eligibility_connection_pending');
    result=identity?await deps.connector.verify({identity,asOf:job.asOf,traceId:job.id.slice(0,30)}):unavailable(job.asOf,now.toISOString(),'invalid_identifier');
  } catch { result=unavailable(job.asOf,now.toISOString(),'source_unavailable'); }
  await deps.store.finish(job,result);
}
export async function runWorker(deps:WorkerDependencies) {
  if(!canDispatch(deps.release()))return;
  await deps.store.recoverExpired();
  const deadline=Date.now()+45000;let nextAt=0;
  for(const id of await deps.store.due()) {
    if(Date.now()>=deadline||nextAt>=deadline)break;
    if(nextAt>Date.now())await new Promise(resolve=>setTimeout(resolve,nextAt-Date.now()));
    const config=deps.release();if(!canDispatch(config))return;
    const job=await deps.store.claim(id,Math.ceil(60000/config.requestsPerMinute));if(!job)continue;
    await processJob(job,deps);
    // Global Firestore reservation also protects against overlapping invocations.
    nextAt=Date.now()+Math.ceil(60000/config.requestsPerMinute);
  }
}
// Internal admission/scheduling API. Callers supply canonical member keys, never raw identifiers.
export async function enqueueLifecycle(store:EligibilityStore,release:Release,member:Member,trigger:Exclude<Trigger,'manual'|'monthly'>,
  eventId:string,serviceDate=chicagoDate(new Date())) {
  if(!canDispatch(release)||!release.offices.includes(member.office)||trigger==='pre_service'&&!release.preServiceEnabled)return {queued:false};
  dateOnly(serviceDate);if(!validId(eventId))throw new WorkforceError(400,'invalid_event');
  const job=await store.enqueue(member.key,serviceDate,trigger,'event_'+opaqueId(eventId),'eligibility_'+trigger);return {queued:true,jobId:job.id};
}
