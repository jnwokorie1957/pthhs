import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledClients} from './scheduledClients.js';

function fixture() {
  const reads=['GetCaregiverDemographics','SearchVisitsV2','GetScheduleInfo','GetPatientDemographics'];
  const state={office:'10', revision:1, reads, truncated:false, date:'2026-11-24', foreign:false, changed:false, calls:[] as string[], caregiver:'2', active:true, accesses:0};
  const workspace={
    settings:async()=>({dataApproved:true,settings:{officeId:'10',revision:state.revision,enabledReads:state.reads}}),
    query:async(input:any)=>{
      state.calls.push(input.operation);
      let records:object[]=[];
      switch(input.operation){
      case 'GetCaregiverDemographics':records=[{ID:'2',OfficeIDs:'["10"]','Status/Name':state.active?'Active':'Inactive'}];break;
      case 'SearchVisitsV2':
        assert.deepEqual(input,{operation:'SearchVisitsV2',officeId:'10',caregiverId:'2',fromDate:'2026-11-22',toDate:'2026-11-28'});
        records=[{VisitID:'3'},{VisitID:'4'}];break;
      case 'GetScheduleInfo':records=[{ID:input.id,'Caregiver/ID':state.caregiver,'Patient/ID':'5',VisitDate:state.date}];break;
      case 'GetPatientDemographics':records=[{PatientID:'5',OfficeID:state.foreign?'20':'10',FirstName:'Example',LastName:'Member',AdmissionID:'M-05',Diagnosis:'excluded'}];break;
      default:throw Error('unexpected read');
      }
      return {source:'hhaexchange',operation:input.operation,truncated:state.truncated&&input.operation==='SearchVisitsV2',records};
    }
  };
  return {state,run:()=>scheduledClients(workspace as never,'staff','10','2','2026-11-22',async()=>{if(++state.accesses===2&&state.changed)state.revision++;})};
}
test('scheduled clients use unique verified office members and return only form identity',async()=>{
  const f=fixture(),response=await f.run();
  assert.deepEqual(response.items,[{id:'5',name:'Example Member',memberId:'M-05'}]);
  assert.equal(f.state.accesses,2);assert.equal(f.state.calls.filter(op=>op==='GetPatientDemographics').length,1);
});
test('changed access, inactive caregivers, partial schedules, foreign people and unrelated dates cannot seed a form',async()=>{
  for(const patch of [{changed:true},{truncated:true},{foreign:true},{date:'2026-11-30'},{caregiver:'999'},{active:false},{reads:[]}]){
    const f=fixture();Object.assign(f.state,patch);await assert.rejects(f.run());
    if('reads' in patch)assert.deepEqual(f.state.calls,[]);
  }
});
