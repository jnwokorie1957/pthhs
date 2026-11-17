import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {memory} from './testing.js';
import {EnvelopeDocumentCipher} from '../workforce/documentEncryption.js';
import {identityFingerprint} from './matching.js';
import {RosterReconciler,rosterReady,ROSTER_LEASE_MS,type RosterState} from './roster.js';
import {EligibilityService,processJob,type Release} from './service.js';
import {opaqueId,type Identity,type Member,type Result} from './domain.js';
import type {Actor} from '../workforce/policy.js';

const cipher=new EnvelopeDocumentCipher('synthetic-key',{wrap:async key=>Buffer.from(key).reverse(),unwrap:async key=>Buffer.from(key).reverse()});
const actor:Actor={uid:'synthetic-reviewer',grant:{active:true,role:'office_manager',offices:['office-a','office-b'],permissions:['eligibility.read','eligibility.review','eligibility.verify']}};
const release:Release={dataApproved:true,connectivityApproved:true,codecReady:true,scheduleEnabled:true,preServiceEnabled:true,hhaSyncApproved:true,requestsPerMinute:60,offices:['office-a','office-b']};
const identity:Identity={medicaidId:'000000001',lastName:'Synthetic',birthDate:'2000-01-01'};
const result:Result={status:'active',asOf:'2026-11-16',checkedAt:'2026-11-16T12:00:00Z',source:'tmhp',coverage:null,mco:null,reason:null};
function fixture(){let now=new Date();const s=memory(()=>({getUsers:async()=>({users:[]})}),()=>now.getTime());s.records.set('workforceStaff/'+actor.uid,actor.grant);
  return {...s,now:()=>new Date(now),advance:(ms:number)=>{now=new Date(now.getTime()+ms);}};}
function ready(s:ReturnType<typeof fixture>,office='office-a'){
  s.records.set('medicaidRoster/'+office,{version:2,generation:'approved-synthetic-scan',phase:'complete',complete:true,ids:[],offset:0,after:'',sourceRevision:1,
    leaseToken:null,leaseUntil:0,startedAt:new Date(s.now().getTime()-10000).toISOString(),completedAt:s.now().toISOString(),missingCount:0,error:null});
}
function profile(id:string,at:string,office='office-a',active=true){return {snapshot:{office,hhaPatientId:id,memberId:'SYNTHETIC-'+id,displayName:'Synthetic Client '+id,active,sourceFetchedAt:at,authorizations:null,authorizationsFetchedAt:null},identity:{...identity,medicaidId:id.padStart(9,'0')}};}
async function sync(s:ReturnType<typeof fixture>,id:string,office='office-a',ident:Identity|null=identity){const p=profile(id,s.now().toISOString(),office);return (await s.store.syncMember(p.snapshot,ident,cipher,actor.uid)).member;}

test('matching key is encrypted and stable across racing initialization; index never uses a plain identifier hash',async()=>{
  const s=fixture(),values=await Promise.all(Array.from({length:12},()=>identityFingerprint(s.store.db,cipher,identity)));
  assert.equal(new Set(values).size,1);assert.notEqual(values[0],createHash('sha256').update(identity.medicaidId).digest('hex'));
  assert.doesNotMatch(JSON.stringify([...s.records]),/000000001/);
  assert.equal(await identityFingerprint(fixture().store.db,cipher,identity)===values[0],false);
});
test('reimport keeps one link; same Medicaid ID across patient IDs and offices requires review',async()=>{
  const s=fixture();ready(s);ready(s,'office-b');const a=await sync(s,'1');await sync(s,'1');const b=await sync(s,'2','office-b');
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidMembers/')).length,2);
  assert.equal((await s.store.reconciliation(await s.store.read(a.key))).hold,'duplicate_identity');
  await assert.rejects(s.store.enqueue(b.key,'2026-11-16','manual','synthetic_request',actor.uid),/eligibility_reconciliation_required/);
  const detail=await s.store.reconciliationDetail(actor,a.key);assert.equal(detail.members.length,2);
  await s.store.selectCanonical(actor,a.key,detail.revision!,a.key,'Synthetic exact identity review');
  assert.equal((await s.store.reconciliation(await s.store.read(a.key))).hold,null);
  assert.equal((await s.store.reconciliation(await s.store.read(b.key))).hold,'duplicate_link');
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidNotes/')).length,2);
  assert.equal((await s.store.read(b.key)).active,true);
  await assert.rejects(s.store.selectCanonical(actor,a.key,detail.revision!,b.key,'Stale selection'),/revision_conflict/);
});
test('cross-office reconciliation hides foreign references and rejects insufficient or revoked reviewer grants',async()=>{
  const s=fixture();ready(s);ready(s,'office-b');const a=await sync(s,'1'),b=await sync(s,'2','office-b');
  const limited={...actor,grant:{...actor.grant,offices:['office-a']}};
  const detail=await s.store.reconciliationDetail(limited,a.key);assert.equal(detail.canResolve,false);assert.equal(detail.members.length,1);
  assert.ok(!JSON.stringify(detail).includes(b.key));
  const scoped=new EligibilityService(s.store,async()=>actor,()=>({...release,offices:['office-a']}),s.now);
  const approved=await scoped.reconciliationDetail(a.key);assert.equal(approved.members.length,1);assert.equal(approved.canResolve,false);
  await assert.rejects(scoped.selectCanonical(a.key,detail.revision!,a.key,'Office outside approved release'),/workforce_forbidden/);
  s.records.set('workforceStaff/'+actor.uid,limited.grant);
  await assert.rejects(s.store.selectCanonical(limited,a.key,detail.revision!,a.key,'Foreign group'),/workforce_forbidden/);
  s.records.set('workforceStaff/'+actor.uid,{...actor.grant,active:false});
  await assert.rejects(s.store.selectCanonical(actor,a.key,detail.revision!,a.key,'Revoked grant'),/workforce_forbidden/);
});
test('canonical selection invalidates when a third link joins or an identity changes',async()=>{
  const s=fixture();ready(s);const a=await sync(s,'1');await sync(s,'2');let detail=await s.store.reconciliationDetail(actor,a.key);
  await s.store.selectCanonical(actor,a.key,detail.revision!,a.key,'Initial synthetic review');
  await sync(s,'3');assert.equal((await s.store.reconciliation(await s.store.read(a.key))).hold,'duplicate_identity');
  await sync(s,'2','office-a',{...identity,medicaidId:'000000002'});
  const b=await s.store.read(opaqueId('hhaexchange','office-a','2'));assert.equal((await s.store.reconciliation(b)).hold,null);
  detail=await s.store.reconciliationDetail(actor,a.key);assert.equal(detail.members.length,2);assert.equal(detail.state.canonicalKey,null);
});
test('legacy unindexed, malformed and inactive-source records cannot queue or become canonical',async()=>{
  const s=fixture();ready(s);const a=await sync(s,'1'),b=await sync(s,'2');const invalid=await sync(s,'3','office-a',{...identity,medicaidId:'bad'});
  assert.equal((await s.store.reconciliation(invalid)).hold,'identity_unindexed');
  const link=s.records.get('medicaidIdentityLinks/'+a.key);s.records.delete('medicaidIdentityLinks/'+a.key);
  await assert.rejects(s.store.enqueue(a.key,'2026-11-16','manual','legacy_request',actor.uid),/eligibility_reconciliation_required/);s.records.set('medicaidIdentityLinks/'+a.key,link);
  const p=profile('2',s.now().toISOString(),'office-a',false);await s.store.syncMember(p.snapshot,identity,cipher,actor.uid);
  const detail=await s.store.reconciliationDetail(actor,a.key);
  await assert.rejects(s.store.selectCanonical(actor,a.key,detail.revision!,b.key,'Inactive source'),/eligibility_canonical_invalid/);
});
test('duplicate discovered after queue admission prevents dispatch and stale active completion',async()=>{
  const s=fixture();ready(s);const a=await sync(s,'1'),job=await s.store.enqueue(a.key,'2026-11-16','manual','queued_before_duplicate',actor.uid),claimed=(await s.store.claim(job.id,1))!;
  await sync(s,'2');let calls=0;
  await processJob(claimed,{store:s.store,connector:{verify:async()=>{calls++;return result;}},cipher:()=>cipher,release:()=>release,authorize:async()=>{}});
  assert.equal(calls,0);assert.equal((await s.store.read(a.key)).latest?.status,'unable_to_verify');
  const s2=fixture();ready(s2);const c=await sync(s2,'1'),job2=await s2.store.enqueue(c.key,'2026-11-16','manual','in_flight_duplicate',actor.uid),lease=(await s2.store.claim(job2.id,1))!;
  await sync(s2,'2');await s2.store.finish(lease,result);assert.equal((await s2.store.read(c.key)).latest?.reason,'member_mismatch');
});
function sourceFixture(s:ReturnType<typeof fixture>,initial=['1']){
  const control={ids:initial,revision:1,failId:'',reads:[] as string[],onRead:null as null|((id:string)=>Promise<void>),foreignId:'',unknown:false};
  const source={revision:async()=>control.revision,discover:async()=>[...control.ids],read:async(office:string,id:string)=>{
    control.reads.push(id);if(control.onRead)await control.onRead(id);if(control.failId===id)throw Error('SYNTHETIC source failed');
    if(control.foreignId===id)return null;return profile(id,s.now().toISOString(),office);
  }};
  return {control,source,reconciler:new RosterReconciler(s.store,source,()=>cipher,()=>true,s.now)};
}
test('completed full roster marks absence for review without changing coverage, active flag or care',async()=>{
  const s=fixture(),absent=await sync(s,'99','office-a',{...identity,medicaidId:'000000099'});
  s.records.get('medicaidMembers/'+absent.key).latest=result;s.records.get('medicaidMembers/'+absent.key).lastSuccessful=result;s.advance(1000);
  const f=sourceFixture(s);await f.reconciler.tick('office-a');
  const missing=await s.store.read(absent.key);assert.equal(missing.sourceState,'missing');assert.equal(missing.active,true);
  assert.equal(missing.latest?.status,'active');assert.equal(missing.lastSuccessful?.status,'active');assert.equal(missing.review,'pending');
  assert.equal((await s.store.reconciliation(missing)).hold,'source_missing');assert.ok(rosterReady(s.records.get('medicaidRoster/office-a'),s.now().getTime()));
  assert.equal([...s.records.values()].filter(r=>r.reason==='source_missing').length,1);
  await f.reconciler.tick('office-a');assert.equal([...s.records.values()].filter(r=>r.reason==='source_missing').length,1);
  const restored=await sync(s,'99','office-a',{...identity,medicaidId:'000000099'});assert.equal(restored.sourceState,'present');assert.equal(restored.lastSuccessful?.status,'active');
});
test('profile failure preserves cursor and cannot mark absent members before successful resume',async()=>{
  const s=fixture(),absent=await sync(s,'99');s.advance(1000);const f=sourceFixture(s,['1','2','3']);f.control.failId='2';
  await assert.rejects(f.reconciler.tick('office-a'),/eligibility_roster_incomplete/);
  assert.equal(s.records.get('medicaidRoster/office-a').offset,1);assert.notEqual((await s.store.read(absent.key)).sourceState,'missing');
  f.control.failId='';await f.reconciler.tick('office-a');assert.equal(s.records.get('medicaidRoster/office-a').complete,true);
  assert.deepEqual(f.control.reads,['1','2','2','3']);assert.equal((await s.store.read(absent.key)).sourceState,'missing');
});
test('overlapping roster scans have one owner, and lease takeover fences the stale writer',async()=>{
  const s=fixture(),f=sourceFixture(s);let started!:()=>void,finish!:()=>void;const began=new Promise<void>(r=>started=r),held=new Promise<void>(r=>finish=r);
  f.control.onRead=async()=>{started();await held;};const old=f.reconciler.tick('office-a');await began;
  await f.reconciler.tick('office-a');assert.equal(f.control.reads.length,1);
  s.advance(ROSTER_LEASE_MS+1);const replacement=sourceFixture(s,['1']);await replacement.reconciler.tick('office-a');finish();
  await assert.rejects(old,/eligibility_roster_incomplete/);
  assert.equal(s.records.get('medicaidRoster/office-a').complete,true);
  assert.equal((await s.store.read(opaqueId('hhaexchange','office-a','1'))).revision,1);
});
test('manifest and policy changes restart reconciliation instead of skipping source members',async()=>{
  for(const policy of [false,true]){const s=fixture(),f=sourceFixture(s,['1']);f.control.onRead=async()=>{if(policy)f.control.revision++;else f.control.ids.push('2');f.control.onRead=null;};
    await assert.rejects(f.reconciler.tick('office-a'),/eligibility_roster_incomplete/);const failed=s.records.get('medicaidRoster/office-a');assert.equal(failed.complete,false);assert.equal(failed.error,'source_changed');
    await f.reconciler.tick('office-a');assert.notEqual(s.records.get('medicaidRoster/office-a').generation,failed.generation);assert.equal(s.records.get('medicaidRoster/office-a').complete,true);
  }
});
test('validated foreign-office profiles are excluded, while failed/partial discovery cannot conclude absence',async()=>{
  const s=fixture(),a=await sync(s,'99');s.advance(1000);const f=sourceFixture(s);f.control.foreignId='1';
  await f.reconciler.tick('office-a');assert.equal(s.records.get('medicaidRoster/office-a').excludedCount,1);assert.equal((await s.store.read(a.key)).sourceState,'missing');
  assert.ok(!s.records.has('medicaidMembers/'+opaqueId('hhaexchange','office-a','1')));s.advance(25*3600000);
  const broken=new RosterReconciler(s.store,{...f.source,discover:async()=>{throw Error('truncated or unavailable');}},()=>cipher,()=>true,s.now);
  await assert.rejects(broken.tick('office-a'));assert.equal(s.records.get('medicaidRoster/office-a').complete,false);
});
test('disabled roster processing performs no reads, writes, encryption or source calls',async()=>{
  const s=fixture();let calls=0;const f=sourceFixture(s),closed=new RosterReconciler(s.store,{...f.source,revision:async()=>{calls++;return 1;}},()=>{throw Error('must not encrypt');},()=>false,s.now);
  const before=s.records.size;await closed.tick('office-a');assert.equal(calls,0);assert.equal(s.records.size,before);
});
test('empty successful roster holds all prior links; future/legacy/expired completion never authorizes requests',async()=>{
  const s=fixture(),a=await sync(s,'99');s.advance(1000);const f=sourceFixture(s,[]);await f.reconciler.tick('office-a');assert.equal((await s.store.read(a.key)).sourceState,'missing');
  assert.equal(rosterReady({complete:true,completedAt:s.now().toISOString()}),false);
  assert.equal(rosterReady({version:2,phase:'complete',complete:true,completedAt:new Date(s.now().getTime()+1000).toISOString()},s.now().getTime()),false);
  s.advance(25*3600000);assert.equal(rosterReady(s.records.get('medicaidRoster/office-a'),s.now().getTime()),false);
});
test('dashboard reconciliation filters include preserved inactive/missing links and expose no fingerprints',async()=>{
  const s=fixture();ready(s);await sync(s,'1');await sync(s,'2');const m=await sync(s,'3','office-a',{...identity,medicaidId:'000000003'});
  s.records.get('medicaidMembers/'+m.key).sourceState='missing';
  const service=new EligibilityService(s.store,async()=>actor,()=>release,s.now),duplicates=await service.query('office-a',{reconciliation:'duplicates'});
  assert.equal(duplicates.items.length,2);assert.equal(duplicates.summary?.reconciliationHolds,3);
  assert.equal((await service.query('office-a',{reconciliation:'missing'})).items.length,1);
  assert.doesNotMatch(JSON.stringify(duplicates),/fingerprint|ciphertext|000000001/);
  await assert.rejects(service.query('office-a',{reconciliation:'unsafe'}),/invalid_filters/);
  const denied=new EligibilityService(s.store,async()=>({...actor,grant:{...actor.grant,offices:['office-b']}}),()=>release,s.now);
  await assert.rejects(denied.reconciliationDetail(m.key),/workforce_forbidden/);
});
test('admission intent survives roster hold and queues only canonical records after completion',async()=>{
  const s=fixture();const a=await sync(s,'1'),b=await sync(s,'2');await s.store.enqueueAdmissionsPage('office-a',s.now());assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidJobs/')).length,0);
  ready(s);const detail=await s.store.reconciliationDetail(actor,a.key);await s.store.selectCanonical(actor,a.key,detail.revision!,a.key,'Admission link review');
  await s.store.enqueueAdmissionsPage('office-a',s.now());await s.store.enqueueAdmissionsPage('office-a',s.now());
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidJobs/')).length,1);assert.equal((await s.store.read(a.key)).admissionPending,null);
  assert.ok((await s.store.read(b.key)).admissionPending);
});

test('2,000-member source traversal checkpoints profiles and completes the paged absence sweep',async()=>{
  const s=fixture(),absent=await sync(s,'9999','office-a',{...identity,medicaidId:'000009999'});s.advance(1000);
  const f=sourceFixture(s,Array.from({length:2000},(_,i)=>String(i+1)));let ticks=0;
  do{await f.reconciler.tick('office-a');ticks++;assert.ok(ticks<425);}while(!s.records.get('medicaidRoster/office-a')?.complete);
  assert.equal(f.control.reads.length,2000);assert.equal(s.records.get('medicaidRoster/office-a').offset,2000);
  assert.equal((await s.store.read(absent.key)).sourceState,'missing');assert.equal(s.records.get('medicaidRoster/office-a').missingCount,1);
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidMembers/')).length,2001);
  assert.equal(await s.store.enqueueMonthly('office-a',s.now()),2000);
  assert.equal(await s.store.enqueueMonthly('office-a',s.now()),2000);assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidJobs/')).length,2000);
});
test('matching key loss fails closed instead of silently generating a different identity index',async()=>{
  const s=fixture();await sync(s,'1');s.records.delete('medicaidControl/matchingKey-v1');
  await assert.rejects(sync(s,'2'),/eligibility_matching_key_missing/);
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidMembers/')).length,1);
});
test('a missing-identity first import does not prevent later valid identities from being indexed',async()=>{
  const s=fixture();const missing=await sync(s,'1','office-a',null),valid=await sync(s,'2');ready(s);
  assert.equal((await s.store.reconciliation(missing)).hold,'identity_unindexed');assert.equal((await s.store.reconciliation(valid)).hold,null);
  assert.ok(s.records.get('medicaidControl/matchingKey-v1')?.encrypted);
});
test('release revocation during a profile read prevents storage and cursor advancement',async()=>{
  const s=fixture(),f=sourceFixture(s);let enabled=true;f.control.onRead=async()=>{enabled=false;};
  const reconciler=new RosterReconciler(s.store,f.source,()=>cipher,()=>enabled,s.now);
  await assert.rejects(reconciler.tick('office-a'));assert.equal(s.records.get('medicaidRoster/office-a').offset,0);
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidMembers/')).length,0);
});
test('a stale source response cannot replace a newer identity or reset a reviewed link',async()=>{
  const s=fixture();await sync(s,'1');s.advance(1000);const current=await sync(s,'1','office-a',{...identity,medicaidId:'000000002'});
  const stale=profile('1',new Date(s.now().getTime()-1000).toISOString());
  await assert.rejects(s.store.syncMember(stale.snapshot,identity,cipher,actor.uid),/eligibility_source_stale/);
  assert.equal((await s.store.read(current.key)).identityRevision,current.identityRevision);
  assert.equal((await s.store.identity(current,cipher))?.medicaidId,'000000002');
});
