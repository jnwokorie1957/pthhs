import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchingMaps,matchingCommitments,sourceTime} from './matchingSource.js';
import {operationalRead} from '../operations/reads.js';
import {interval} from './matching.js';
import {opportunitySms} from './matchingSms.js';
const shift=interval({start:'2026-11-17T09:00',end:'2026-11-17T13:00'}),now=Date.parse('2026-11-16T14:00:00Z');
function source(mode='ok'){
 let profiles=0;const calls:any[]=[];const workspace={settings:async()=>({dataApproved:true,settings:{officeId:'12',officeTimezone:'America/Chicago',revision:1,enabledReads:['GetCaregiverDemographics','SearchVisitsV2','GetVisitInfoV3']}}),query:async(input:any,actor:string,scope?:string)=>{
  calls.push({input,actor,scope});const common={operation:input.operation,source:'hhaexchange',fetchedAt:new Date().toISOString(),truncated:false};
  if(input.operation==='GetCaregiverDemographics'){profiles++;return {...common,records:[{ID:'101',OfficeIDs:mode==='multi'?'["12","13"]':'["12"]',EmployeeType:'Employee','Status/Name':mode==='changed'&&profiles>1?'Inactive':'Active',FirstName:'Demo'}]};}
  if(input.operation==='SearchVisitsV2')return {...common,truncated:mode==='truncated',records:mode==='empty'?[]:[{VisitID:'1'}]};
  return {...common,records:[{ID:input.id,'Caregiver/ID':mode==='wrong'?'999':'101',ScheduleStartTime:'2026-11-15T09:00:00',ScheduleEndTime:'2026-11-15T13:00:00',VisitStartTime:'2026-11-15T09:00:00',VisitEndTime:mode==='pending'?null:'2026-11-15T14:00:00'}]};
 }};return {workspace,calls};
}
test('hours adapter queries the full Sunday week and boundary days, counts actual work, and limits source projections',async()=>{
 const s=source(),result=await matchingCommitments(s.workspace as any,'staff','12','101',[shift],now);assert.equal(result.complete,true);assert.equal(Date.parse(result.commitments[0]!.end)-Date.parse(result.commitments[0]!.start),5*3600000);
 const search=s.calls.find(c=>c.input.operation==='SearchVisitsV2');assert.equal(search.input.fromDate,'2026-11-14');assert.equal(search.input.toDate,'2026-11-22');assert.equal(search.scope,'workforce_matching_hours');assert.equal(s.calls.find(c=>c.input.operation==='GetVisitInfoV3').scope,'workforce_matching_hours');
});
test('truncated, foreign-owner, incomplete-actual, multi-office and changed-profile results cannot prove hours',async()=>{
 for(const mode of ['truncated','wrong','pending','multi','changed']){const s=source(mode);await assert.rejects(matchingCommitments(s.workspace as any,'staff','12','101',[shift],now));}
 const s=source('empty');assert.deepEqual((await matchingCommitments(s.workspace as any,'staff','12','101',[shift],now)).commitments,[]);
 assert.throws(()=>sourceTime('09:00'),/hours_unverified/);assert.throws(()=>sourceTime('2026-11-01T01:30:00'),/ambiguous/);
});
test('matching projection rejects blank SOAP and nested borrowed identity, and excludes patient/payroll fields',async()=>{
 const run=(xml:string)=>operationalRead({call:async()=>({ok:true,status:'Success',resultXml:xml})} as any,{operation:'GetVisitInfoV3',id:'1'},'workforce_matching_hours');
 const result=await run('<VisitInfo><ID>1</ID><Caregiver><ID>101</ID></Caregiver><Patient><ID>private</ID></Patient><PayHours>900</PayHours><BilledAmount>900</BilledAmount><ScheduleStartTime>2026-11-15T09:00:00</ScheduleStartTime></VisitInfo>');assert.deepEqual(Object.keys(result.records[0]!).sort(),['ID','Caregiver/ID','ScheduleStartTime','ScheduleEndTime','VisitStartTime','VisitEndTime'].sort());assert.equal(result.records[0]!['Caregiver/ID'],'101');
 await assert.rejects(run('<!-- blank -->'));
 const nested=await run('<VisitInfo><Other><ID>1</ID><Caregiver><ID>101</ID></Caregiver></Other></VisitInfo>');assert.equal(nested.records[0]!.ID,null);assert.equal(nested.records[0]!['Caregiver/ID'],null);
});
test('disabled Maps and opening SMS gates make no network calls',async()=>{
 let calls=0;const request=async()=>{calls++;throw Error('no request expected');};await assert.rejects(new MatchingMaps(false,request as any).route('from','to'),/maps_pending/);assert.equal(await opportunitySms(false,request as any),undefined);assert.equal(calls,0);
});
test('routes use fixed driving endpoint and explicit fields, and reject missing/ambiguous routes',async()=>{
 let body:any;const request=async(url:any,options:any)=>{assert.equal(url,'https://routes.googleapis.com/directions/v2:computeRoutes');body=JSON.parse(options.body);assert.equal(options.headers['X-Goog-FieldMask'],'routes.distanceMeters,routes.duration');return {ok:true,json:async()=>({routes:[{distanceMeters:16000,duration:'600s'}]})} as any;};
 const result=await new MatchingMaps(true,request as any,async()=>'fake').route('origin','destination');assert.equal(result.meters,16000);assert.equal(body.travelMode,'DRIVE');assert.equal(body.computeAlternativeRoutes,false);assert.deepEqual(body.origin,{placeId:'origin'});
 for(const routes of [[],[{duration:'1s'}],[{distanceMeters:1,duration:'1s'},{distanceMeters:2,duration:'2s'}]])await assert.rejects(new MatchingMaps(true,async()=>({ok:true,json:async()=>({routes})}) as any,async()=>'fake').route('from','to'),/route_unavailable/);
});
