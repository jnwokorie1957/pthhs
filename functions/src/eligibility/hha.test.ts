import test from 'node:test';
import assert from 'node:assert/strict';
import {HhaEligibilitySource} from './hha.js';
function setup(){
  const calls:any[]=[];let truncated=false,office='test-office',status='Active';
  const source=new HhaEligibilitySource({settings:async()=>({dataApproved:true,settings:{officeId:'test-office',revision:1,enabledReads:['SearchPatients','GetPatientDemographics','SearchPatientAuthorizations']}}),
    query:async(input:any,_actor:string,scope:string)=>{calls.push({input,scope});return {source:'hhaexchange',operation:input.operation,truncated,fetchedAt:'2026-11-15T12:00:00Z',
      records:input.operation==='SearchPatients'?[{PatientID:'1'},{PatientID:'1'}]:input.operation==='GetPatientDemographics'?[{PatientID:'1',OfficeID:office,PatientStatusName:status,AdmissionID:'SOURCE-REF',FirstName:'Synthetic',LastName:'Client',MedicaidNumber:'000000001',BirthDate:null}]:[{ID:'1',StartDate:'2026-11-01',StopDate:'2026-11-30'}]};}} as any);
  return {source,calls,truncate:()=>truncated=true,foreign:()=>office='other',unknown:()=>status='',unrecognized:()=>status='Pending'};
}
test('HHA sync uses stable source IDs, restricts identity projection, and keeps authorization separate',async()=>{
  const s=setup();assert.deepEqual(await s.source.discover('test-office','staff'),['1']);
  const record=await s.source.read('test-office','1','staff');assert.equal(record?.snapshot.memberId,'SOURCE-REF');assert.equal(record?.identity?.medicaidId,'000000001');
  assert.equal(s.calls[1].scope,'eligibility_identity');assert.equal(record?.snapshot.authorizations?.[0]?.source,'hhaexchange');assert.ok(!('latest'in record!.snapshot));
});
test('partial rosters, unknown client status and foreign offices cannot silently become verified members',async()=>{
  const s=setup();s.truncate();await assert.rejects(s.source.discover('test-office','staff'),/eligibility_roster_incomplete/);
  const foreign=setup();foreign.foreign();assert.equal(await foreign.source.read('test-office','1','staff'),null);
  const unknown=setup();unknown.unknown();await assert.rejects(unknown.source.read('test-office','1','staff'),/eligibility_source_status_missing/);
  const pending=setup();pending.unrecognized();await assert.rejects(pending.source.read('test-office','1','staff'),/eligibility_source_status_unknown/);
});
