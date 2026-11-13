// Privileged read-only HHA import. Run with approved operator ADC, never browser credentials.
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {Firestore} from '@google-cloud/firestore';
import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {FirestoreWorkspaceRepository,OperationsWorkspace} from '../lib/operations/workspace.js';
import {HhaSoapClient} from '../lib/integrations/hhaexchange/client.js';
import {operationalRead} from '../lib/operations/reads.js';
import {HhaProfileSource} from '../lib/workforce/hhaSource.js';
import {hhaEmail} from '../lib/workforce/hhaEnrollment.js';

const project='primetimehomehealthservices',apply=process.argv.includes('--apply'),withFiles=process.argv.includes('--files');
if(!apply)throw Error('Use --apply for the explicitly approved source synchronization.');
const actor=process.env.HHA_SYNC_ACTOR;if(!actor||actor.length>160)throw Error('Set HHA_SYNC_ACTOR to the audited operator identity.');
let auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
if(process.env.HHA_SYNC_TOKEN_MODULE){const helper=await import(pathToFileURL(path.resolve(process.env.HHA_SYNC_TOKEN_MODULE)));const client=new OAuth2Client();client.getAccessToken=async()=>({token:await helper.googleToken()});client.getRequestHeaders=async()=>new Headers({Authorization:'Bearer '+await helper.googleToken()});auth=new GoogleAuth({authClient:client});}
const db=new Firestore({projectId:project,auth}),repo=new FirestoreWorkspaceRepository(db);
const headers=await auth.getRequestHeaders(),secret=await fetch(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/HHAEXCHANGE_CREDENTIALS/versions/latest:access`,{headers,signal:AbortSignal.timeout(10000)});
if(!secret.ok)throw Error('hha_secret_access_'+secret.status);
const secretData=await secret.json(),credentials=JSON.parse(Buffer.from(secretData.payload.data,'base64').toString('utf8'));
const client=new HhaSoapClient('https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx',credentials,{beforeRequest:()=>repo.reserveRead('background'),defer:n=>repo.deferReads(n)}),workspace=new OperationsWorkspace(repo,(input,scope)=>operationalRead(client,input,scope),true);
const settings=(await workspace.settings()).settings;if(!settings.officeId)throw Error('office_scope_required');
const source=new HhaProfileSource(workspace,actor,settings.officeId),run=db.collection('workforceHhaSyncRuns').doc(settings.officeId),lease=randomUUID();
await db.runTransaction(async tx=>{const prior=await tx.get(run);if(prior.data()?.leaseUntil>Date.now())throw Error('sync_already_running');tx.set(run,{office:settings.officeId,lease,leaseUntil:Date.now()+120000,startedAt:new Date().toISOString(),state:'running',actor},{merge:true});});
async function checkpoint(patch){await db.runTransaction(async tx=>{const current=await tx.get(run);if(current.data()?.lease!==lease)throw Error("sync_lease_lost");tx.update(run,patch);});}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,Math.min(ms,60000)));
async function read(fn) {
 let failures = 0;
 for (;;) {
  await checkpoint({leaseUntil:Date.now()+120000});
  try { return await fn(); }
  catch (error) {
   const sourceError = error.cause || error;
   if (/budget|backoff|429/.test(sourceError.code || sourceError.message || '')) {
    console.log(JSON.stringify({state:'waiting_for_shared_source_budget'}));
    await wait(Math.max(1000, Math.min(60000, Number(sourceError.retryAfterSeconds || error.retryAfterSeconds || 15) * 1000)));
   } else if (sourceError.code === 'hha_read_failed' && failures < 2) {
    failures++;
    console.log(JSON.stringify({state:'retrying_hha_read',retry:failures}));
    await wait(failures === 1 ? 5000 : 15000);
   } else {
    throw error;
   }
  }
 }
}
let count=0,filesChecked=0,skipped=0,newRecords=0,failedProfiles=0;
try{
 const found=await read(()=>source.discover());console.log(JSON.stringify({state:'discovered',total:found.ids.length,office:settings.officeId}));
 const previous=await run.get(),completed=new Set(previous.data()?.completedIds||[]),existingRows=await db.collection('workforceHhaProfiles').where('office','==',settings.officeId).select('id').limit(5001).get(),existingIds=new Set(existingRows.docs.map(doc=>doc.id));
 // Resume only the interrupted cycle; a finished daily cycle starts fresh.
 if(previous.data()?.lastCompletedAt>=previous.data()?.startedAt)completed.clear();
 if (completed.size) {
  newRecords = Number(previous.data()?.newRecords || 0);
  skipped = Number(previous.data()?.skipped || 0);
  filesChecked = Number(previous.data()?.filesChecked || 0);
 }
 for(const id of found.ids){
  if(completed.has(id)){count++;continue;}
  if((await run.get()).data()?.lease!==lease)throw Error('sync_lease_lost');
  await checkpoint({leaseUntil:Date.now()+120000});
  let profile;
  try { profile = await read(() => source.profile(id)); }
  catch (error) {
   if (error.code === 'hha_office_mismatch') skipped++;
   else if (error.code === 'hha_read_failed') {
    failedProfiles++;
    if (failedProfiles >= 3) throw error;
    continue;
   } else throw error;
  }
  if (profile) {
   let emailKey='';try{emailKey=createHash('sha256').update(hhaEmail(profile.email)).digest('hex');}catch{}
   await db.collection('workforceHhaProfiles').doc(id).set({...profile,emailKey});if(!existingIds.has(id)){newRecords++;existingIds.add(id);}
   if(withFiles){const files=await read(()=>source.documents(id));await db.collection('workforceHhaFileIndexes').doc(id).set({caregiverId:id,office:profile.office,...files});filesChecked++;}
  }
  completed.add(id);count++;
  await checkpoint({processed:count,total:found.ids.length,filesChecked,skipped,newRecords,completedIds:[...completed],updatedAt:new Date().toISOString(),leaseUntil:Date.now()+120000});
  if(count%10===0)console.log(JSON.stringify({state:'importing',processed:count,total:found.ids.length,filesChecked,skipped,newRecords}));
 }
 if (failedProfiles) throw Error('hha_profiles_incomplete');
 await db.runTransaction(async tx=>{const current=await tx.get(run);if(current.data()?.lease!==lease)throw Error('sync_lease_lost');const completedAt=new Date().toISOString();tx.set(db.collection('workforceHhaRosterReady').doc(settings.officeId),{office:settings.officeId,completedAt,total:found.ids.length,sourceRevision:found.revision});tx.update(run,{state:'complete',lastCompletedAt:completedAt,leaseUntil:0,completedIds:[],newRecords});});
 await db.collection('workforcePersonnelAudit').add({actor,action:'hha_roster_sync_completed',office:settings.officeId,at:new Date().toISOString(),processed:count,filesChecked,skipped,newRecords});
 console.log(JSON.stringify({state:'complete',processed:count,total:found.ids.length,filesChecked,skipped,newRecords}));
}catch(error){const code=error.code||error.message||'source_unavailable';await db.runTransaction(async tx=>{const prior=await tx.get(run);if(prior.data()?.lease===lease)tx.update(run,{state:'failed',failedProfiles,error:String(code).slice(0,100),leaseUntil:0,updatedAt:new Date().toISOString()});});console.error(JSON.stringify({state:'failed',processed:count,newRecords,failedProfiles,code}));process.exitCode=1;}
await db.terminate();
