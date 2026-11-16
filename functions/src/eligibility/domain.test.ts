import test from 'node:test';
import assert from 'node:assert/strict';
import { access,applyResult,chicagoDate,discrepancyFlags,identityValid,jobId,nextScheduled,normalizeEvidence,opaqueId,unavailable,
  type Evidence,type Member } from './domain.js';
import type { Actor } from '../workforce/policy.js';
const now=new Date('2026-11-15T12:00:00.000Z'),day='2026-11-15';
export const evidence=(active=true):Evidence=>({matched:true,rejected:false,asOf:day,medicaidCoverage:[{active,effective:null,termination:null}],managedCare:null});
export const member=():Member=>({key:opaqueId('synthetic-member'),office:'test-office',hhaPatientId:'1',memberId:'SYNTHETIC-1',displayName:'Synthetic Client',
  department:'intake',assignee:null,active:true,identityReady:true,identityRevision:1,sourceFetchedAt:now.toISOString(),latest:null,lastSuccessful:null,review:'none',changedAt:null,
  revision:1,authorizations:null,authorizationsFetchedAt:null});
test('active and inactive require explicit, matched Medicaid evidence',()=>{
  assert.equal(normalizeEvidence(evidence(),day,now).status,'active');assert.equal(normalizeEvidence(evidence(false),day,now).status,'inactive');
  assert.equal(normalizeEvidence({...evidence(),matched:false},day,now).status,'unable_to_verify');
  assert.equal(normalizeEvidence({...evidence(),rejected:true},day,now).status,'unable_to_verify');
  assert.equal(normalizeEvidence({...evidence(),medicaidCoverage:[]},day,now).status,'unable_to_verify');
  assert.equal(normalizeEvidence({...evidence(),medicaidCoverage:[{} as any]},day,now).status,'unable_to_verify');
});
test('conflicting coverage, invalid dates and a response for another date cannot be called inactive',()=>{
  assert.equal(normalizeEvidence({...evidence(),medicaidCoverage:[...evidence().medicaidCoverage,...evidence(false).medicaidCoverage]},day,now).reason,'ambiguous_response');
  assert.equal(normalizeEvidence({...evidence(),asOf:'2026-11-14'},day,now).reason,'invalid_response');
  assert.equal(normalizeEvidence({...evidence(),medicaidCoverage:[{active:true,effective:'2026-02-30',termination:null}]},day,now).reason,'invalid_response');
  assert.equal(normalizeEvidence({...evidence(),medicaidCoverage:[{active:true,effective:null,termination:'2026-11-14'}]},day,now).reason,'invalid_response');
});
test('unavailable dates and MCOs stay null; multiple periods are never flattened',()=>{
  const result=normalizeEvidence(evidence(),day,now);assert.equal(result.coverage?.termination,null);assert.equal(result.mco,null);
  assert.equal(normalizeEvidence({...evidence(),medicaidCoverage:[...evidence().medicaidCoverage,...evidence().medicaidCoverage]},day,now).coverage,null);
});
test('failures preserve last success and an Active to Inactive transition still alerts after a failure',()=>{
  const active=applyResult(member(),normalizeEvidence(evidence(),day,now)).member;
  const failed=applyResult(active,unavailable(day,'2026-11-15T12:01:00.000Z','network_failure')).member;
  assert.equal(failed.latest?.status,'unable_to_verify');assert.equal(failed.lastSuccessful?.status,'active');assert.equal(failed.review,'pending');
  const changed=applyResult(failed,normalizeEvidence(evidence(false),day,new Date('2026-11-15T12:02:00.000Z')));
  assert.equal(changed.alert,true);assert.equal(changed.changed,true);assert.equal(changed.member.review,'pending');
  const stale=applyResult(changed.member,normalizeEvidence(evidence(),day,now));assert.deepEqual(stale.member,changed.member);
});
test('identifiers preserve leading zeroes and reject non-nine-digit and injected input',()=>{
  assert.equal(identityValid({medicaidId:'000000001',lastName:'Synthetic',birthDate:null}),true);
  for(const medicaidId of ['1','1234567890','abc123456','123*56789',''])assert.equal(identityValid({medicaidId,lastName:'Synthetic',birthDate:null}),false);
  assert.equal(identityValid({medicaidId:'000000001',lastName:'X~EB*6',birthDate:null}),false);
  assert.equal(identityValid({medicaidId:'000000001',lastName:'Synthetic',birthDate:'2000-02-30'}),false);
  assert.equal(identityValid({medicaidId:'000000001',lastName:'Synthetic',birthDate:'2000-02-29'}),true);
});
test('monthly schedule uses Chicago calendar dates across DST and month boundaries',()=>{
  assert.equal(nextScheduled(new Date('2026-03-01T11:59:59Z')),'2026-03-01T12:00:00.000Z');
  assert.equal(nextScheduled(new Date('2026-03-01T12:00:00Z')),'2026-03-15T11:00:00.000Z');
  assert.equal(nextScheduled(new Date('2026-10-15T11:00:00Z')),'2026-11-01T12:00:00.000Z');
  assert.equal(nextScheduled(new Date('2026-12-31T23:00:00Z')),'2027-01-01T12:00:00.000Z');
  assert.equal(chicagoDate(new Date('2026-11-16T01:00:00Z')),'2026-11-15');
});
test('request dedupe is scoped to member, date, purpose and caller key',()=>{
  assert.equal(jobId('m',day,'manual','request-1'),jobId('m',day,'manual','request-1'));
  assert.notEqual(jobId('m',day,'manual','request-1'),jobId('another',day,'manual','request-1'));
});
test('explicit grants and office scope are required even for an owner',()=>{
  const actor:Actor={uid:'test',grant:{active:true,role:'owner',offices:['test-office'],permissions:['eligibility.read']}};
  access(actor,'read','test-office');assert.throws(()=>access(actor,'verify','test-office'));assert.throws(()=>access(actor,'read','other'));
  assert.throws(()=>access({...actor,grant:{...actor.grant,active:false}},'read','test-office'));
  assert.throws(()=>access({...actor,grant:{...actor.grant,role:'hr'}},'read','test-office'));
});
test('active Medicaid never establishes PAS service authorization',()=>{
  const data=applyResult(member(),normalizeEvidence(evidence(),day,now)).member;
  assert.deepEqual(discrepancyFlags(data,day),['authorization_unavailable']);
  assert.ok(discrepancyFlags(data,'2026-11-16').includes('eligibility_not_verified_for_service_date'));
});
