import test from 'node:test';
import assert from 'node:assert/strict';
import {HhaRecords,HHA_RECORDS} from './hhaRecords.js';
import {operationalRead} from '../operations/reads.js';
import {parseHhaSoapResponse} from '../integrations/hhaexchange/parser.js';
import type {HhaProfile} from './hhaSource.js';

function setup(kind:keyof typeof HHA_RECORDS='training',self=true){
 let profile:HhaProfile={id:'101',office:'12',firstName:'Demo',lastName:'Caregiver',email:'demo@example.invalid',status:'Active',code:'501',fetchedAt:'2026-11-12T00:00:00Z',fields:{EmployeeType:'Employee'}};
 let revision=1,enabled=true,calls=0,checks=0;
 const result={source:'hhaexchange',operation:HHA_RECORDS[kind].operation,fetchedAt:'2026-11-12T00:00:00Z',truncated:false,records:[{CaregiverID:'101',OfficeID:'12',InserviceDate:'2026-11-01',PatientID:'private-patient',Notes:'private-note',HourlyRate:'17.50'}]};
 let onQuery=()=>{};
 const workspace={settings:async()=>({dataApproved:true,settings:{officeId:'12',revision,enabledReads:enabled?[HHA_RECORDS[kind].operation]:[]}}),query:async(input:unknown,actor:string,scope:string)=>{calls++;assert.deepEqual(input,{operation:HHA_RECORDS[kind].operation,id:'101'});assert.equal(actor,'verified-user');assert.equal(scope,'workforce_caregiver_records');onQuery();return result;}};
 const service=new HhaRecords(workspace as never,async()=>{checks++;return {...profile,fields:{...profile.fields}};},'verified-user',self);
 return {service,result,setProfile:(p:Partial<HhaProfile>)=>{profile={...profile,...p};},disable:()=>{enabled=false;},changePolicy:()=>{revision++;},onQuery:(fn:()=>void)=>{onQuery=fn;},counts:()=>({calls,checks})};
}
test('each portal resource uses a fixed source operation and releases only its allowed fields',async()=>{
 for(const kind of Object.keys(HHA_RECORDS) as (keyof typeof HHA_RECORDS)[]){const s=setup(kind),result=await s.service.read(kind);assert.equal(result.source,'hhaexchange');assert.equal(s.counts().checks,2);assert.doesNotMatch(JSON.stringify(result),/private-patient|private-note|CaregiverID|OfficeID/);}
});
test('pay rates are self-only and arbitrary operation names cannot dispatch',async()=>{
 for(const kind of ['pay-rates','GetPatientDemographics','constructor','__proto__']){const s=setup('pay-rates',false);await assert.rejects(s.service.read(kind),/hha_record_not_available/);assert.equal(s.counts().calls,0);}
});
test('a disabled owner connection is distinct from a successful empty source',async()=>{const s=setup();s.disable();await assert.rejects(s.service.read('training'),/hha_record_connection_pending/);assert.equal(s.counts().calls,0);const empty=setup();empty.result.records=[];assert.deepEqual((await empty.service.read('training')).items,[]);});
test('cross-caregiver records and changed office authority are denied',async()=>{const s=setup();s.result.records[0]!.CaregiverID='102';await assert.rejects(s.service.read('training'),/hha_record_owner_mismatch/);for(const change of [(s:ReturnType<typeof setup>)=>s.setProfile({office:'13'}),(s:ReturnType<typeof setup>)=>s.changePolicy(),(s:ReturnType<typeof setup>)=>s.setProfile({status:'Inactive'})]){const s=setup();s.onQuery(()=>change(s));await assert.rejects(s.service.read('training'),/hha_record_changed_reload/);}});
test('self access requires active employment and availability is scoped to the verified office',async()=>{const s=setup();s.setProfile({status:'Inactive'});await assert.rejects(s.service.read('training'),/hha_record_not_available/);assert.equal(s.counts().calls,0);const a=setup('weekly-availability');a.result.records[0]!.OfficeID='13';assert.deepEqual((await a.service.read('weekly-availability')).items,[]);});
test('partial results retain their partial state and source time',async()=>{const s=setup();s.result.truncated=true;const result=await s.service.read('training');assert.equal(result.truncated,true);assert.equal(result.fetchedAt,s.result.fetchedAt);});
test('SOAP ownership proof cannot borrow nested or duplicate caregiver IDs',async()=>{
 for(const id of ['<CaregiverID>102</CaregiverID>','<Other><CaregiverID>101</CaregiverID></Other>','<CaregiverID>101</CaregiverID><CaregiverID>101</CaregiverID>']){
  const client={call:async()=>({ok:true,status:'Success',resultXml:'<CaregiverInServices><CaregiverInServicesInfo>'+id+'<InserviceDate>2026-11-01</InserviceDate></CaregiverInServicesInfo></CaregiverInServices>'})};
  await assert.rejects(operationalRead(client as never,{operation:'GetCaregiverInServices',id:'101'},'workforce_caregiver_records'));
 }
});
test('portal source projections accept verified contract rows and reject unknown or nested wrappers',async()=>{
 for(const [operation,xml] of [
  ['GetCaregiverInServices','<CaregiverInServices><CaregiverInServicesInfo><CaregiverID>101</CaregiverID><InserviceDate>2026-11-01</InserviceDate></CaregiverInServicesInfo></CaregiverInServices>'],
  ['GetCaregiverRates','<CaregiverRates><CaregiverRateInfo><CaregiverID>101</CaregiverID><HourlyRate>17.50</HourlyRate></CaregiverRateInfo></CaregiverRates>'],
  ['GetCaregiverPreferences','<CaregiverPreferencesInfo><CaregiverID>101</CaregiverID><Language1>English</Language1></CaregiverPreferencesInfo>'],
 ] as const){
  const client=(resultXml:string)=>({call:async()=>({ok:true,status:'Success',resultXml})});
  assert.equal((await operationalRead(client(xml) as never,{operation,id:'101'},'workforce_caregiver_records')).records[0]!.CaregiverID,'101');
  for(const bad of ['<Unexpected/>','<Other>'+xml+'</Other>',xml+xml])await assert.rejects(operationalRead(client(bad) as never,{operation,id:'101'},'workforce_caregiver_records'),/caregiver_record_response_unverified/);
 }
});
test('blank SOAP results cannot become successful empty caregiver views',async()=>{
 for(const {operation} of Object.values(HHA_RECORDS))for(const body of ['', ' \r\n\t', '<!-- omitted records -->']){
  const xml=`<Envelope><Body><${operation}Response><${operation}Result>${body}</${operation}Result></${operation}Response></Body></Envelope>`;
  const parsed=parseHhaSoapResponse(operation,200,true,xml);
  assert.equal(parsed.ok,true,'Transport parsing alone does not establish an empty source list');
  await assert.rejects(operationalRead({call:async()=>parsed} as never,{operation,id:'101'},'workforce_caregiver_records'),/caregiver_record_response_unverified/);
 }
});
test('explicit source containers and success receipts still support genuine empty views',async()=>{
 for(const [operation,body] of [
  ['GetCaregiverPermanentWeekAvailability','<PermanentWeekAvailability/>'],
  ['GetCaregiverSpecialAvailability','<SpecialAvailability/>'],
  ['GetCaregiverInServices','<CaregiverInServices/>'],
  ['GetCaregiverPreferences','<CaregiverPreferencesInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>'],
  ['GetCaregiverRates','<CaregiverRates/>'],
 ] as const)for(const resultXml of [body,'<Result Status="Success"/>']){
  const client={call:async()=>({ok:true,status:'Success',resultXml})};
  assert.deepEqual((await operationalRead(client as never,{operation,id:'101'},'workforce_caregiver_records')).records,[]);
 }
});
