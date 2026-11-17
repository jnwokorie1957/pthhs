import test from 'node:test';
import assert from 'node:assert/strict';
import { EligibilityStore } from './store.js';
import { EligibilityService,processJob,filtered,enqueueLifecycle,type Release } from './service.js';
import { opaqueId,type Member,type Result } from './domain.js';
import { EnvelopeDocumentCipher } from '../workforce/documentEncryption.js';
import type { Actor } from '../workforce/policy.js';

import {memory} from './testing.js';
const actor:Actor={uid:'synthetic-staff',grant:{active:true,role:'office',offices:['test-office'],permissions:['eligibility.read','eligibility.verify','eligibility.review']}};
const config:Release={dataApproved:true,connectivityApproved:true,codecReady:true,scheduleEnabled:true,preServiceEnabled:true,hhaSyncApproved:true,requestsPerMinute:60,offices:['test-office']};
function member(n=1):Member{return {key:opaqueId('synthetic',String(n)),office:'test-office',hhaPatientId:String(n),memberId:'SYNTHETIC-'+n,
  displayName:'Synthetic Client '+n,department:'intake',assignee:null,active:true,identityReady:true,identityRevision:1,sourceFetchedAt:'2026-11-15T12:00:00.000Z',latest:null,lastSuccessful:null,
  sourceState:'present',review:'none',changedAt:null,revision:1,authorizations:null,authorizationsFetchedAt:null};}
const success:Result={status:'active',asOf:'2026-11-15',checkedAt:'2026-11-15T12:00:00.000Z',source:'tmhp',coverage:null,mco:null,reason:null};
const cipher=new EnvelopeDocumentCipher('synthetic-key',{wrap:async key=>Buffer.from(key).reverse(),unwrap:async key=>Buffer.from(key).reverse()});
function seed(s:ReturnType<typeof memory>,n=1,at=new Date()){const m=member(n);s.records.set('medicaidMembers/'+m.key,m);
  const fingerprint=opaqueId('synthetic-index',String(n));s.records.set('medicaidIdentityLinks/'+m.key,{fingerprint,identityRevision:1});
  s.records.set('medicaidIdentityGroups/'+fingerprint,{version:1,revision:1,members:[{key:m.key,office:m.office}],canonicalKey:null});
  s.records.set('medicaidRoster/'+m.office,{version:2,phase:'complete',complete:true,completedAt:new Date(at.getTime()-1000).toISOString()});return m;}
test('concurrent duplicate/manual/monthly requests create one outstanding member-date job',async()=>{
  const s=memory(),m=seed(s);const jobs=await Promise.all(Array.from({length:20},(_,i)=>s.store.enqueue(m.key,'2026-11-15',i%2?'manual':'monthly','request_'+i,actor.uid)));
  assert.equal(new Set(jobs.map(j=>j.id)).size,1);assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidJobs/')).length,1);
});
test('only one worker acquires a lease; duplicate completion cannot overwrite results',async()=>{
  const s=memory(),m=seed(s),job=await s.store.enqueue(m.key,'2026-11-15','manual','request_1',actor.uid);
  const claimed=await Promise.all([s.store.claim(job.id,1000),s.store.claim(job.id,1000)]);assert.equal(claimed.filter(Boolean).length,1);
  await s.store.finish(claimed.find(Boolean)!,success);await s.store.finish(claimed.find(Boolean)!,{...success,status:'inactive'});
  assert.equal((await s.store.read(m.key)).latest?.status,'active');assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidResults/')).length,1);
});
test('expired lease becomes unknown delivery for review, never a blind resend or inactive',async()=>{
  const now=new Date('2026-11-15T12:00:00Z'),s=memory(),m=seed(s,1,now);
  const job=await s.store.enqueue(m.key,'2026-11-15','manual','request_1',actor.uid,now);await s.store.claim(job.id,1000,now.getTime());
  await s.store.recoverExpired(new Date(now.getTime()+121000));const current=await s.store.read(m.key);
  assert.equal(current.latest?.reason,'delivery_unknown');assert.equal(current.latest?.status,'unable_to_verify');
  assert.equal(s.records.get('medicaidJobs/'+job.id).state,'failed');
});
test('status changes create private department notification and revision-controlled follow-up',async()=>{
  const s=memory(),m=seed(s);m.latest=m.lastSuccessful=success;
  const job=await s.store.enqueue(m.key,'2026-11-15','manual','request_1',actor.uid);const claim=await s.store.claim(job.id,1000);
  await s.store.finish(claim!,{...success,status:'inactive'});assert.equal(s.records.get('medicaidNotifications/'+job.id).department,'intake');
  assert.equal(s.records.get('medicaidExceptions/'+job.id).reason,'active_to_inactive');
  const current=await s.store.read(m.key);await s.store.review(actor,m.key,current.revision,'resolved','Synthetic follow-up only','intake',null);
  assert.equal(s.records.get('medicaidExceptions/'+job.id).status,'resolved');assert.equal(s.records.get('medicaidNotifications/'+job.id).state,'reviewed');
  await assert.rejects(s.store.review(actor,m.key,current.revision,'resolved','Stale change','intake',null),/revision_conflict/);
});
test('2,000-client monthly fanout is paged, durable and idempotent on scheduler redelivery',async()=>{
  const s=memory(),now=new Date('2026-11-15T12:00:00Z');for(let i=0;i<2000;i++)seed(s,i,now);
  assert.equal(await s.store.enqueueMonthly('test-office',now),2000);assert.equal(await s.store.enqueueMonthly('test-office',now),2000);
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('medicaidJobs/')).length,2000);
});
test('encrypted identity binds office/member; source identity changes invalidate cached eligibility',async()=>{
  const s=memory(),m=member(),snapshot={office:m.office,hhaPatientId:m.hhaPatientId,memberId:m.memberId,displayName:m.displayName,active:true,sourceFetchedAt:m.sourceFetchedAt,authorizations:null,authorizationsFetchedAt:null};
  const identity={medicaidId:'000000001',lastName:'Synthetic',birthDate:null};
  const first=await s.store.syncMember(snapshot,identity,cipher,actor.uid);assert.equal(first.admitted,true);
  assert.deepEqual(await s.store.identity(first.member,cipher),identity);
  assert.ok(!JSON.stringify(s.records.get('medicaidIdentities/'+first.member.key)).includes(identity.medicaidId));
  const again=await s.store.syncMember(snapshot,identity,cipher,actor.uid);assert.equal(again.admitted,false);assert.equal(again.member.identityRevision,first.member.identityRevision);
  s.records.get('medicaidMembers/'+first.member.key).latest=success;
  const changed=await s.store.syncMember(snapshot,{...identity,medicaidId:'000000002'},cipher,actor.uid);
  assert.equal(changed.member.latest,null);assert.equal(changed.member.review,'pending');assert.equal(changed.member.identityRevision,first.member.identityRevision+1);
});
test('foreign office and disabled releases fail before private collection reads or vendor calls',async()=>{
  const s=memory(),m=seed(s);let calls=0;
  const service=new EligibilityService(s.store,async()=>actor,()=>({...config,dataApproved:false}));
  assert.equal((await service.query('test-office')).summary,null);await assert.rejects(service.query('another-office'),/workforce_forbidden/);
  const job=await s.store.enqueue(m.key,'2026-11-15','manual','request_1',actor.uid);const claim=await s.store.claim(job.id,1000);
  await processJob(claim!,{store:s.store,connector:{verify:async()=>{calls++;return success;}},cipher:()=>cipher,release:()=>config,authorize:async()=>{throw Error('revoked');}});
  assert.equal(calls,0);assert.equal((await s.store.read(m.key)).latest?.status,'unable_to_verify');
});

test('query validates filters and uses Chicago verification dates',async()=>{
  const s=memory(),m=seed(s),service=new EligibilityService(s.store,async()=>actor,()=>config);
  for(const filters of [{status:'approved'},{reviewOnly:'false'},{verifiedAfter:'2026-11-16',verifiedBefore:'2026-11-15'}])
    await assert.rejects(service.query('test-office',filters as any),/invalid_filters/);
  m.latest={...success,checkedAt:'2026-11-16T01:00:00Z'};
  assert.equal(filtered(m,{verifiedAfter:'2026-11-15',verifiedBefore:'2026-11-15'}),true);
  assert.equal(filtered(m,{verifiedAfter:'2026-11-16'}),false);
});

test('lifecycle events accept canonical long IDs and deduplicate replay',async()=>{
  const s=memory(),m=seed(s),id='a'.repeat(128);
  const a=await enqueueLifecycle(s.store,config,m,'pre_service',id,'2026-11-15');
  const b=await enqueueLifecycle(s.store,config,m,'pre_service',id,'2026-11-15');
  assert.equal(a.jobId,b.jobId);
  assert.equal((await enqueueLifecycle(s.store,{...config,preServiceEnabled:false},m,'pre_service','event_1')).queued,false);
});

test('employee choices expose only enabled, verified reviewers for the requested office',async()=>{
  const s=memory(()=>({getUsers:async(ids:Array<{uid:string}>)=>({users:ids.map(({uid})=>({uid,displayName:'Synthetic '+uid,emailVerified:true,disabled:uid==='disabled'}))})}));
  for(const uid of ['allowed','disabled'])s.records.set('workforceStaff/'+uid,actor.grant);
  s.records.set('workforceStaff/foreign',{...actor.grant,offices:['another-office']});
  s.records.set('workforceStaff/hr',{...actor.grant,role:'hr'});
  const result=await s.store.reviewers('test-office');assert.deepEqual(result.items,[{uid:'allowed',name:'Synthetic allowed'}]);
});
