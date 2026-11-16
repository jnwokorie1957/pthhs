import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMatch,preferences,plan,interval,localInstant,weekMinutes,MAX_DRIVING_METERS,type CandidateEvidence} from './matching.js';
const now=Date.parse('2026-11-16T14:00:00Z'),stamp=new Date(now).toISOString();
const shift=interval({start:'2026-11-17T09:00',end:'2026-11-17T13:00'});
const required={tasks:['bathing'],serviceType:'regular',pets:'no'};
function candidate():CandidateEvidence{return {id:'user',preferences:{optIn:true,smsOptIn:true,placeId:'address',tasks:['bathing'],serviceTypes:['regular'],pets:false,maxWeeklyHours:40,available:[shift]},qualification:{skills:['bathing'],revision:1,expiresAt:'2027-01-01T00:00:00Z'},commitments:[],complete:true,checkedAt:stamp,route:{meters:MAX_DRIVING_METERS,seconds:100,checkedAt:stamp}};}
test('only verified candidates within ten driving miles qualify, including exactly ten',()=>{
 const c=candidate();assert.equal(evaluateMatch(required,[shift],c,now).eligible,true);
 c.route.meters++;assert.deepEqual(evaluateMatch(required,[shift],c,now).reasons,['outside_ten_driving_miles']);
 c.route.meters=100;c.route.checkedAt='2026-11-14T00:00:00Z';assert.ok(evaluateMatch(required,[shift],c,now).reasons.includes('driving_distance_unverified'));
});
test('40 hours is inclusive and caregiver preferences can impose a lower ceiling',()=>{
 const c=candidate();c.commitments=[interval({start:'2026-11-15T00:00',end:'2026-11-16T00:00'}),interval({start:'2026-11-16T00:00',end:'2026-11-16T12:00'})];
 assert.equal(evaluateMatch(required,[shift],c,now).eligible,true);
 c.commitments[1]!.end=localInstant('2026-11-16T12:01');assert.ok(evaluateMatch(required,[shift],c,now).reasons.includes('weekly_hour_limit'));
 c.commitments=[];c.preferences.maxWeeklyHours=3;assert.ok(evaluateMatch(required,[shift],c,now).reasons.includes('weekly_hour_limit'));
});
test('work is split at Central Sunday midnight, including daylight-saving elapsed hours',()=>{
 const totals=Object.values(weekMinutes([interval({start:'2026-11-14T22:00',end:'2026-11-15T02:00'})]));assert.deepEqual(totals,[120,120]);
 assert.deepEqual(Object.values(weekMinutes([interval({start:'2026-11-01T00:00',end:'2026-11-01T03:00'})])),[240]);
 assert.throws(()=>localInstant('2026-11-01T01:30'),/ambiguous_or_missing/);assert.throws(()=>localInstant('2026-03-08T02:30'),/ambiguous_or_missing/);
});
test('missing hours, stale source, opt-out, task eligibility and exact availability each hold a candidate',()=>{
 const cases:[string,(c:CandidateEvidence)=>void][]=[['weekly_hours_unverified',c=>c.complete=false],['weekly_hours_unverified',c=>c.checkedAt='2026-11-15T14:00:00Z'],['not_opted_in',c=>c.preferences.optIn=false],['qualifications_unverified',c=>c.qualification.skills=[]],['qualifications_unverified',c=>c.qualification.expiresAt=stamp],['preferences_do_not_match',c=>c.preferences.tasks=[]],['not_available_for_all_shifts',c=>c.preferences.available=[]],['schedule_conflict',c=>c.commitments=[shift]]];
 for(const [reason,change]of cases){const c=candidate();change(c);assert.ok(evaluateMatch(required,[shift],c,now).reasons.includes(reason),reason);}
 assert.ok(evaluateMatch({...required,pets:'unknown'},[shift],candidate(),now).reasons.includes('preferences_do_not_match'));
});
test('inputs reject extra fields, overlapping windows and SMS without portal consent',()=>{
 const p=candidate().preferences;assert.throws(()=>preferences({...p,optIn:false}),/preferences_invalid/);assert.throws(()=>preferences({...p,privateData:'x'}),/preferences_invalid/);assert.throws(()=>preferences({...p,available:[shift,shift]}),/overlapping_shifts/);
 assert.throws(()=>plan({placeId:'address',shifts:[shift],automatic:true},Date.parse(shift.start)),/future_shifts_required/);
});
