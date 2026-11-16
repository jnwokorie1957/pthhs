import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OpportunityMatching} from './matchingStore.js';
import {interval,sunday,localTime} from './matching.js';
const key=(...v:unknown[])=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function memory(rows:Record<string,any>){
 const snapshot=(path:string)=>({id:path.split('/').at(-1),exists:path in rows,data:()=>rows[path],ref:ref(path)});
 function ref(path:string):any{return {path,id:path.split('/').at(-1),get:async()=>snapshot(path),set:async(v:any,o?:any)=>{rows[path]=o?.merge?{...rows[path],...v}:v;},update:async(v:any)=>{rows[path]={...rows[path],...v};}};}
 function collection(name:string,filters:any[]=[],after='',limit=999):any{return {doc:(id:string)=>ref(name+'/'+id),where:(...f:any[])=>collection(name,[...filters,f],after,limit),orderBy:()=>collection(name,filters,after,limit),startAfter:(id:string)=>collection(name,filters,id,limit),limit:(n:number)=>collection(name,filters,after,n),get:async()=>{const docs=Object.keys(rows).filter(p=>p.startsWith(name+'/')&&!p.slice(name.length+1).includes('/')).sort().filter(p=>p.split('/').at(-1)!>after&&filters.every(([k,op,v])=>op==='in'?v.includes(rows[p][k]):rows[p][k]===v)).slice(0,limit).map(snapshot);return {docs,size:docs.length,empty:!docs.length};}};}
 let tail=Promise.resolve();return {collection,runTransaction:(fn:any)=>{const task=tail.then(async()=>{const writes:Array<()=>void>=[];const tx={get:async(r:any)=>r.path?snapshot(r.path):r.get(),set:(r:any,v:any,o?:any)=>writes.push(()=>{rows[r.path]=o?.merge?{...rows[r.path],...v}:v;}),update:(r:any,v:any)=>writes.push(()=>{rows[r.path]={...rows[r.path],...v};}),create:(r:any,v:any)=>writes.push(()=>{assert.ok(!(r.path in rows));rows[r.path]=v;})};const result=await fn(tx);writes.forEach(w=>w());return result;});tail=task.then(()=>{},()=>{});return task;}} as any;
}
function fixture(){
 const shift=interval({start:'2099-11-17T09:00',end:'2099-11-17T13:00'}),stamp=new Date().toISOString(),phone='+17135550123';
 const p={id:'opening',office:'12',opportunityRevision:4,revision:1,updatedBy:'staff',placeId:'private_client_place',shifts:[shift],automatic:true};
 const o={id:'opening',office:'12',revision:4,state:'published',review:{revision:4},public:{location:'Houston area',recruitingZip:'77063',weeklyHours:4,assistance:['bathing'],serviceType:'regular',pets:'no',schedule:'weekdays',type:'assignment'}};
 const pref={uid:'user',caregiverId:'101',office:'12',revision:1,optIn:true,smsOptIn:true,smsPhoneHash:key(phone),placeId:'private_caregiver_place',tasks:['bathing'],serviceTypes:['regular'],pets:false,maxWeeklyHours:40,available:[shift]};
 const q={office:'12',skills:['bathing'],expiresAt:'2099-12-31T00:00:00Z',revision:1},j={id:'job',notified:0};
 const rows:Record<string,any>={'workforceStaff/staff':{active:true,role:'owner',offices:['12'],permissions:['accounts.support','opportunities.read','opportunities.edit','opportunities.publish']},'workforceOpportunities/opening':o,'workforceMatchingPlans/opening':p,'workforceMatchPreferences/user':pref,'workforceMatchQualifications/101':q,'workforceMatchingJobs/job':j};
 let sends=0,enabled=true,ownHook=()=>{},phoneValue=phone;const bodies:string[]=[];
 const service=new OpportunityMatching({own:async()=>{ownHook();return {id:'101',office:'12',status:'Active'} as any;},profile:async()=>({id:'101',office:'12'} as any),maps:{verify:async()=>({}),route:async()=>({meters:100,seconds:10,checkedAt:new Date().toISOString()})} as any,hours:async()=>({commitments:[],complete:true,checkedAt:new Date().toISOString(),name:'Fictional Caregiver'}),portalOpen:async()=>true,sms:async()=>enabled?{submit:async(input:any)=>{sends++;bodies.push(input.body);return {state:'accepted',providerId:'test'};},reconcile:async()=>({state:'unknown'})} as any:undefined},memory(rows),{getUser:async()=>({disabled:false,emailVerified:true,phoneNumber:phoneValue,providerData:[{providerId:'phone'}]})} as any);
 const invite=(uid='user',overrides:any={})=>(service as any).invite(p,o,j,uid,{...pref,uid,...overrides},q,'Fictional Caregiver',{drivingMiles:1,weekMinutes:{week:240},eligible:true,reasons:[]},stamp,[]);
 return {service,rows,p,o,pref,q,j,invite,bodies,get sends(){return sends;},disable:()=>{enabled=false;},onOwn:(fn:()=>void)=>{ownHook=fn;},changePhone:()=>{phoneValue='+17135550124';}};
}
test('concurrent invitation attempts create one portal notice and one text, without private address',async()=>{
 const f=fixture();await Promise.all([f.invite(),f.invite()]);assert.equal(f.sends,1);assert.equal(Object.keys(f.rows).filter(k=>k.startsWith('workforceMatchingNotices/')).length,1);assert.equal(f.rows['workforceMatchingBudgets/'+key('opening',4)].count,1);assert.match(f.bodies[0]!,/Houston area/);assert.doesNotMatch(f.bodies[0]!,/private_client|private_caregiver|Fictional|101/);
});
test('global ten-caregiver budget survives plan revisions and concurrent jobs',async()=>{
 const f=fixture();f.disable();for(let i=0;i<12;i++){const uid='person'+i;f.rows['workforceMatchPreferences/'+uid]={...f.pref,uid};if(i>=10)await assert.rejects(f.invite(uid),/source_changed/);else await f.invite(uid);}
 assert.equal(Object.keys(f.rows).filter(k=>k.startsWith('workforceMatchingNotices/')).length,10);assert.equal(f.rows['workforceMatchingBudgets/'+key('opening',4)].count,10);
 f.p.revision=2;await assert.rejects(f.invite('person11'),/source_changed/);assert.equal(f.sends,0);
});
test('publisher revocation, office removal, opening edits and caregiver opt-out prevent invitations',async()=>{
 for(const change of [(f:any)=>f.rows['workforceStaff/staff'].active=false,(f:any)=>f.rows['workforceStaff/staff'].offices=['99'],(f:any)=>f.rows['workforceStaff/staff'].permissions.pop(),(f:any)=>f.o.revision++,(f:any)=>f.pref.optIn=false,(f:any)=>f.q.expiresAt='2000-01-01']){const f=fixture();change(f);await assert.rejects(f.invite());assert.equal(f.sends,0);assert.equal(Object.keys(f.rows).filter(k=>k.startsWith('workforceMatchingNotices/')).length,0);}
});
test('changed phone and consent revocation during source recheck prevent SMS',async()=>{
 for(const mode of ['phone','optout','closed']){const f=fixture();f.disable();await f.invite();const id=key('opening',4,'user');f.rows['workforceMatchingNotices/'+id].smsState='pending';
  f.onOwn(()=>{if(mode==='phone')f.changePhone();if(mode==='optout'){f.pref.optIn=false;f.pref.smsOptIn=false;}if(mode==='closed')f.o.state='closed';});
  // Invoke with a configured provider, using a second fixture's adapter while retaining this database.
  (f.service as any).services.sms=async()=>({submit:async()=>{throw Error('must not submit');}});
  if(mode==='phone')await assert.rejects((f.service as any).sendText(id,f.p,f.o,'user',f.pref,[]),/verified_phone/);else await (f.service as any).sendText(id,f.p,f.o,'user',f.pref,[]);
  assert.notEqual(f.rows['workforceMatchingNotices/'+id].smsState,'submitting');assert.equal(f.sends,0);
 }
});
test('accepted and uncertain texts are never automatically submitted again',async()=>{
 const f=fixture();await f.invite();const id=key('opening',4,'user');await (f.service as any).sendText(id,f.p,f.o,'user',f.pref,[]);assert.equal(f.sends,1);
 f.rows['workforceMatchingNotices/'+id].smsState='unconfirmed';await (f.service as any).sendText(id,f.p,f.o,'user',f.pref,[]);assert.equal(f.sends,1);
});
test('opt-out works even when vendor proof is unavailable',async()=>{
 const f=fixture();f.onOwn(()=>{throw Error('source unavailable');});await f.service.optOut('user');assert.equal(f.rows['workforceMatchPreferences/user'].optIn,false);assert.equal(f.rows['workforceMatchPreferences/user'].smsOptIn,false);
});
test('worker lease stops concurrent processing and each tick advances to another opening',async()=>{
 const f=fixture();f.disable();const calls:string[]=[];(f.service as any).step=async(p:any)=>{calls.push(p.id);await Promise.resolve();};f.rows['workforceMatchingPlans/second']={...f.p,id:'second'};await Promise.all([f.service.tick(),f.service.tick()]);assert.deepEqual(calls,['opening']);await f.service.tick();assert.deepEqual(calls,['opening','second']);
});
test('complete hours require fresh staff verification of non-visit paid work for every proposed week',async()=>{
 const f=fixture(),week=sunday(Date.parse(f.p.shifts[0]!.start)),id=key('101',week);
 await assert.rejects((f.service as any).completeHours(f.p,f.pref),/hours_review_required/);
 const extra=interval({start:'2099-11-18T09:00',end:'2099-11-18T11:00'});
 f.rows['workforceMatchingHourReviews/'+id]={office:'12',week,revision:1,reviewedBy:'staff',reviewedAt:new Date().toISOString(),otherWork:[extra]};
 const result=await (f.service as any).completeHours(f.p,f.pref);assert.deepEqual(result.commitments,[extra]);assert.deepEqual(result.reviews,[{id,revision:1}]);
 f.rows['workforceMatchingHourReviews/'+id].reviewedAt='2000-01-01';await assert.rejects((f.service as any).completeHours(f.p,f.pref),/hours_review_required/);
 f.rows['workforceMatchingHourReviews/'+id].reviewedAt=new Date().toISOString();f.rows['workforceStaff/staff'].active=false;await assert.rejects((f.service as any).completeHours(f.p,f.pref),/forbidden/);
});
test('weekly review input requires an explicit complete-work confirmation and Sunday boundaries',async()=>{
 const f=fixture(),week=sunday(Date.now()+7*86400000),weekOf=localTime(Date.parse(week)).slice(0,10);
 await assert.rejects(f.service.hoursReview('staff','101',{weekOf,otherWork:[],confirmed:false}),/hours_review_required/);
 await f.service.hoursReview('staff','101',{weekOf,otherWork:[],confirmed:true});assert.equal(f.rows['workforceMatchingHourReviews/'+key('101',week)].revision,1);
 await assert.rejects(f.service.hoursReview('staff','101',{weekOf,otherWork:[{start:'2099-11-17T09:00',end:'2099-11-17T10:00'}],confirmed:true}),/outside_week/);
});
