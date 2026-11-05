import assert from "node:assert/strict";
import test from "node:test";
import { MaintenanceSearch } from "./search.js";
import { readRequest, WorkflowError, type ReadInput } from "../operations/reads.js";
import type { Versioned } from "../operations/workspace.js";
import { scopedReasonReview, vendorContractBlocked, ownerReadable } from "../integrations/hhaexchange/contractGates.js";
import { workspaceRoute } from "../operations/routes.js";
const from="2026-10-23",to="2026-11-05",stamp=to+"T18:00:00.000Z";
function fixture(count=3){
  const records=new Map<string,Versioned>(),queries:ReadInput[]=[];
  const state={dataApproved:true,settings:{officeId:"123",revision:1,enabledReads:["SearchVisitsV2","GetVisitInfoV3","GetPatientDemographics","GetCaregiverDemographics"]}};
  const options={foreign:false,failureAt:"",billingEmpty:false,contract:"75",secondary:"0",date:from};
  const repository={async get<T extends Versioned>(collection:string,id:string){return structuredClone(records.get(collection+'/'+id) as T??null);},async change<T extends Versioned>(collection:string,id:string,revision:number,_actor:string,_action:string,update:(prior:T|null)=>T){const key=collection+'/'+id,prior=records.get(key) as T??null;if((prior?.revision??0)!==revision)throw new WorkflowError('revision_conflict',409);const next=update(prior);records.set(key,structuredClone(next));return next;}};
  const workspace={settings:async()=>structuredClone(state),query:async(input:ReadInput)=>{queries.push(input);if(input.id===options.failureAt)throw new WorkflowError('read_budget_exhausted_retry_next_minute',429,11);
    let rows:Record<string,string|null>[]=[];
    switch(input.operation){
      case 'SearchVisitsV2':rows=Array.from({length:count},(_,i)=>({VisitID:String(i+15)}));break;
      case 'GetVisitInfoV3':rows=[{ID:input.id!,VisitDate:options.date,'Patient/ID':'25','Caregiver/ID':'35',ScheduleStartTime:options.date+' 09:00',ScheduleEndTime:options.date+' 12:00'}];break;
      case 'GetPatientDemographics':rows=[{PatientID:input.id!,OfficeID:options.foreign?'456':'123',FirstName:'Synthetic',LastName:'Patient',AdmissionID:'ADM-TEST'}];break;
      case 'GetCaregiverDemographics':rows=[{ID:input.id!,OfficeIDs:'["123"]',FirstName:'Synthetic',LastName:'Caregiver',CaregiverCode:'CG-TEST'}];break;
      case 'GetVisitBillInfoV2':rows=options.billingEmpty?[]:[{ID:input.id!,'Patient/ID':'25','Caregiver/ID':'35',VisitDate:options.date,'PrimaryBillTo/Contract/ID':options.contract}];break;
      case 'GetVisitBillInfo':rows=[{ID:input.id!,'Patient/ID':'25','Caregiver/ID':'35',VisitDate:options.date,'PrimaryBillTo/Contract/ID':options.contract}];break;
      case 'GetScheduleInfo':rows=[{ID:input.id!,'Patient/ID':'25','Caregiver/ID':'35',VisitDate:options.date,'PrimaryBillTo/Contract/ID':options.contract,'SecondaryBillTo/Contract/ID':options.secondary}];break;
      case 'SearchPatients':rows=[{PatientID:'25'}];break;
      case 'SearchCaregivers':rows=[{CaregiverID:'35'}];break;
      case 'GetContracts':rows=[{ContractID:'75',ContractName:'Synthetic payer',Active:'source-status'}];break;
    }
    return{operation:input.operation,source:'hhaexchange',records:rows,truncated:false,fetchedAt:stamp};
  }};
  return{service:new MaintenanceSearch(workspace as never,repository,()=>new Date(stamp)),records,queries,state,options};
}
test('native date ranges exceed five days, include both endpoints and preserve legacy day requests',()=>{
  const xml=readRequest({operation:'SearchVisitsV2',officeId:'123',fromDate:from,toDate:to,patientId:'25',caregiverId:'35'});
  assert.match(xml,/<StartDate>2026-10-23T00:00:00<\/StartDate>/);assert.match(xml,/<EndDate>2026-11-05T23:59:59<\/EndDate>/);assert.match(xml,/<PatientID>25<\/PatientID>/);
  assert.match(readRequest({operation:'SearchVisitsV2',officeId:'123',date:to}),/<StartDate>2026-11-05/);
  for(const value of [{fromDate:to,toDate:from},{fromDate:'2025-01-01',toDate:to},{fromDate:'2026-02-30',toDate:to},{date:to,fromDate:from,toDate:to}])assert.throws(()=>readRequest({operation:'SearchVisitsV2',officeId:'123',...value}));
});
test('name lookups use independently escaped first/last names and source admission/caregiver codes',()=>{
  assert.match(readRequest({operation:'SearchPatients',firstName:'A&B',lastName:'O\'Test',admissionId:'ADM-TEST'}),/<FirstName>A&amp;B<\/FirstName><LastName>O&apos;Test<\/LastName><AdmissionID>ADM-TEST/);
  assert.match(readRequest({operation:'SearchCaregivers',firstName:'Test',caregiverCode:'CG-TEST'}),/<CaregiverCode>CG-TEST/);
  assert.throws(()=>readRequest({operation:'SearchPatients',term:'Smith',firstName:'Test'}),/ambiguous_name_search/);
});
test('range reads verify every visit and patient office, expose real profile names and store protected review receipts',async()=>{
  const f=fixture(),result=await f.service.search({from,to},'synthetic-admin');assert.equal(result.items.length,3);assert.equal(result.complete,true);
  assert.equal(result.items[0]?.patientFirstName,'Synthetic');assert.equal(result.items[0]?.caregiverLastName,'Caregiver');assert.equal(result.items[0]?.serviceDate,from);
  assert.equal(f.queries.filter(q=>q.operation==='GetCaregiverDemographics').length,1);
  assert.equal(f.records.size,3);assert.equal((await f.service.evidence(from,'15',stamp))?.id,'15');
  assert.equal(await f.service.evidence(from,'15','different-receipt'),null);f.state.settings.revision++;assert.equal(await f.service.evidence(from,'15',stamp),null);
});
test('foreign-office and out-of-range source visits cannot become usable review rows',async()=>{
  const f=fixture();f.options.foreign=true;const result=await f.service.search({from,to},'synthetic-admin');assert.equal(result.items.length,0);assert.deepEqual(result.unavailable,[{id:'15',error:'visit_patient_office_mismatch'}]);assert.equal(f.records.size,0);
  const g=fixture();g.options.date='2026-10-22';await assert.rejects(g.service.search({from,to},'synthetic-admin'),/visit_date_scope_mismatch/);
});
test('source limits retain completed prefixes and resume the first unread ID with exact query binding',async()=>{
  const f=fixture();f.options.failureAt='16';const first=await f.service.search({from,to},'synthetic-admin');assert.equal(first.items.length,1);assert.equal(first.checkedThrough,1);assert.equal(first.retryAfterSeconds,11);assert.ok(first.nextCursor);
  f.options.failureAt='';const next=await f.service.search({from,to,cursor:first.nextCursor},'synthetic-admin');assert.deepEqual(next.items.map(r=>r.id),['16','17']);
  await assert.rejects(f.service.search({from,to,patientId:'25',cursor:first.nextCursor},'synthetic-admin'),/maintenance_search_changed_restart/);
  await assert.rejects(f.service.search({from,to,cursor:first.nextCursor},'different-admin'),/maintenance_search_changed_restart/);
});
test('payer filters use exact visit bill-to contracts; an empty billing source is disclosed',async()=>{
  const f=fixture();assert.equal((await f.service.search({from,to,contractId:'75'},'synthetic-admin')).items.length,3);
  assert.equal((await f.service.search({from,to,contractId:'76'},'synthetic-admin')).items.length,0);
  f.options.billingEmpty=true;const unknown=await f.service.search({from,to,contractId:'75'},'synthetic-admin');assert.equal(unknown.unknownPayers,3);assert.equal(unknown.items.length,0);assert.equal(unknown.complete,false);
});
test('the separately approved legacy billing read can fill a V2-empty payer reference without guessing',async()=>{
 const f=fixture(1);f.options.billingEmpty=true;f.state.settings.enabledReads.push('GetVisitBillInfo');const result=await f.service.search({from,to,contractId:'75'},'synthetic-admin');assert.equal(result.items.length,1);assert.equal(result.unknownPayers,0);assert.ok(f.queries.some(q=>q.operation==='GetVisitBillInfo'));
});
test('unbilled payer filtering prefers the exact office-checked schedule and generic schedule reads stay closed',async()=>{
 const f=fixture(1);f.options.billingEmpty=true;f.state.settings.enabledReads.push('GetScheduleInfo');const result=await f.service.search({from,to,contractId:'75'},'synthetic-admin');assert.equal(result.items.length,1);assert.equal(result.unknownPayers,0);assert.ok(f.queries.some(q=>q.operation==='GetScheduleInfo'));assert.equal(f.queries.some(q=>q.operation==='GetVisitBillInfoV2'),false);
 const response=await workspaceRoute({query:async()=>{throw new Error('must not dispatch');}} as never,'POST','/workspace/read',{operation:'GetScheduleInfo',id:'15'},'synthetic-admin');assert.equal(response?.status,423);assert.equal((response?.body as {error:string}).error,'use_scoped_maintenance_payer_read');
});
test('an unused zero payer reference does not discard a valid primary or secondary match',async()=>{
 const f=fixture(1);f.state.settings.enabledReads.push('GetScheduleInfo');let result=await f.service.search({from,to,contractId:'75'},'synthetic-admin');assert.equal(result.items.length,1);assert.deepEqual(result.items[0]?.contractIds,['75']);
 f.options.contract='0';f.options.secondary='75';result=await f.service.search({from,to,contractId:'75'},'synthetic-admin');assert.equal(result.items.length,1);f.options.secondary='0';result=await f.service.search({from,to,contractId:'75'},'synthetic-admin');assert.equal(result.unknownPayers,1);assert.equal(result.complete,false);
});
test('profile lookups and payer catalog stay source scoped and do not create HHA records',async()=>{
  const f=fixture();const people=await f.service.people({kind:'patient',firstName:'Synthetic',lastName:'Patient'},'synthetic-admin');assert.equal(people.items.length,1);
  f.options.foreign=true;assert.equal((await f.service.people({kind:'patient',lastName:'Patient'},'synthetic-admin')).items.length,0);
  assert.equal((await f.service.people({kind:'caregiver',code:'CG-TEST'},'synthetic-admin')).items[0]?.id,'35');
  assert.equal((await f.service.contracts('synthetic-admin')).items[0]?.id,'75');assert.equal(f.records.size,0);
});
test('reason contract exception is narrow, internal, read-only, and closed for generic reads and all writes',()=>{
  assert.equal(vendorContractBlocked('GetVisitEditReasonActionTaken'),true);assert.equal(scopedReasonReview('GetVisitEditReasonActionTaken'),false);assert.equal(scopedReasonReview('GetVisitEditReasonActionTaken','visit_reason_review'),true);
  assert.equal(ownerReadable('GetVisitEditReasonActionTaken'),true);
  for(const op of ['ConfirmVisits','ConfirmVisitsV2','ConfirmVisitsEVV','VisitCallInOut']){assert.equal(vendorContractBlocked(op),true);assert.equal(scopedReasonReview(op,'visit_reason_review'),false);}
});
