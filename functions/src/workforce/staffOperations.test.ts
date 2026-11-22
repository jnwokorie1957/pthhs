import test from 'node:test';
import assert from 'node:assert/strict';
import {hiringApplication,employmentStatus,authorizationDetails,expiryBucket,StaffOperations} from './staffOperations.js';
import type {Intake} from './intake.js';
import {parseGrant,requirePermission} from './policy.js';
import {createHash} from 'node:crypto';
const app={uid:'applicant-a',office:'office-a',state:'submitted',updatedAt:'2026-11-12',answers:{firstName:'Example',lastName:'Person',city:'Houston',weeklyHours:'20',job1_duties:'Meal preparation',ssn:'000-00-0000',birthDate:'2000-01-01',gender:'test',ethnicity:'test',street:'Private address',emergencyName:'Private contact',terms_page_17:'Accept',conviction:'No',visaType:'private',futureSensitiveField:'never expose'},signature:{name:'Example Person'}} as unknown as Intake;
test('hiring projection excludes sensitive and unknown application answers for every viewer',()=>{
 const safe=hiringApplication(app);assert.equal(safe.answers.job1_duties,'Meal preparation');
 assert.deepEqual(Object.keys(safe.answers).sort(),['city','firstName','job1_duties','lastName','weeklyHours']);assert.ok(!('signature' in safe));
});
test('employment requires a current same-office linked HHA employee record',()=>{
 const now=Date.parse('2026-11-12T18:00:00Z'),profile={office:'office-a',status:'Active',fetchedAt:'2026-11-12T17:00:00Z',fields:{EmployeeType:'Employee'}};
 assert.equal(employmentStatus(profile,'office-a',now),'employee');assert.equal(employmentStatus({...profile,fields:{EmployeeType:'Applicant'}},'office-a',now),'applicant');
 assert.equal(employmentStatus({...profile,fields:{}},'office-a',now),'needs_verification');assert.equal(employmentStatus({...profile,fetchedAt:'2026-10-01T00:00:00Z'},'office-a',now),'needs_verification');assert.equal(employmentStatus(profile,'foreign',now),'applicant');
});
test('expiration buckets include exact 15 and 30 day boundaries without DST arithmetic',()=>{
 for(const [date,bucket,days]of [['2026-10-31','expired',-1],['2026-11-01','within15',0],['2026-11-16','within15',15],['2026-11-17','within30',16],['2026-12-01','within30',30],['2026-12-02','current',31]] as const)assert.deepEqual(expiryBucket(date,'2026-11-01'),{days,bucket});
 assert.throws(()=>expiryBucket('2026-02-30'),/invalid_authorization_date/);
});
const details={office:'office-a',clientName:'Example Client',memberId:'TEST-01',payer:'Example Payer',authorizationNumber:'AUTH-001',startDate:'2026-11-01',endDate:'2026-12-01',services:'Personal care',units:'20 hours weekly',notes:'',reviewed:true};
test('authorization requires reviewed complete details and a valid ordered date range',()=>{
 assert.equal(authorizationDetails(details).endDate,'2026-12-01');for(const change of [{reviewed:false},{endDate:'2026-02-30'},{endDate:'2026-10-01'},{memberId:''},{office:'../bad'}])assert.throws(()=>authorizationDetails({...details,...change}));
});
const grant={active:true,role:'office',offices:['office-a'],permissions:['applicants.review','authorizations.manage']};
test('office tool permissions are explicit, scoped, revoked, and unavailable to supervisors',()=>{
 const actor={uid:'staff',grant:parseGrant(grant)};requirePermission(actor,'authorizations.manage','office-a');
 assert.throws(()=>requirePermission(actor,'authorizations.manage','office-b'));
 assert.throws(()=>requirePermission({uid:'staff',grant:parseGrant({...grant,permissions:[]})},'applicants.review'));
 assert.throws(()=>requirePermission({uid:'staff',grant:parseGrant({...grant,active:false})},'applicants.review'));
 assert.throws(()=>parseGrant({...grant,role:'supervisor'}));
});
function database(rows:Record<string,any>){
 const snapshot=(path:string)=>({id:path.split('/').at(-1),exists:path in rows,data:()=>rows[path]});
 const collection=(name:string)=>({doc:(id:string)=>({path:name+'/'+id}),where(field:string,operator:string,value:unknown){return query(name,[[field,value]]);}});
 const query=(name:string,filters:any[],maximum=Infinity,cursor='')=>({name,filters,maximum,cursor,select:()=>query(name,filters,maximum,cursor),limit:(n:number)=>query(name,filters,n,cursor),orderBy:()=>query(name,filters,maximum,cursor),startAfter:(id:string)=>query(name,filters,maximum,id),where:(field:string,op:string,value:unknown)=>query(name,[...filters,[field,value]],maximum,cursor)});
 return {collection,runTransaction:async(fn:any)=>fn({get:async(ref:any)=>ref.path?snapshot(ref.path):{docs:Object.keys(rows).sort().filter(p=>p.startsWith(ref.name+'/')&&p.slice(ref.name.length+1)>ref.cursor&&ref.filters.every(([f,v]:any)=>rows[p][f]===v)).slice(0,ref.maximum).map(snapshot)},create:()=>{},update:()=>{},set:()=>{}})} as any;
}
test('applicant API returns only submitted office-scoped safe records and rejects foreign office reads',async()=>{
 const db=database({'workforceStaff/staff':grant,'workforceApplications/applicant-a':app,'workforceApplications/draft':{...app,uid:'draft',state:'draft'},'workforceApplications/foreign':{...app,office:'office-b'}}),service=new StaffOperations(db,{} as any);
 const result=await service.applicants('staff','office-a');assert.equal(result.items.length,1);assert.equal(result.items[0]!.employmentStatus,'applicant');assert.ok(!JSON.stringify(result).includes('000-00-0000'));
 await assert.rejects(service.applicants('staff','office-b'),/workforce_forbidden/);
});
test('authorization list rechecks active office permissions and withholds storage metadata',async()=>{
 const record={...details,state:'ready',revision:1,renewalStatus:'not_started',source:{path:'private'},preview:{path:'private'}},rows={'workforceStaff/staff':grant,'workforceAuthorizations/test':record};
 const service=new StaffOperations(database(rows),{} as any),result=await service.list('staff','office-a');assert.equal(result.items.length,1);assert.ok(!('preview' in result.items[0]!));assert.ok(!('source' in result.items[0]!));await assert.rejects(service.list('staff','office-b'),/workforce_forbidden/);
 rows['workforceStaff/staff']={...grant,active:false};await assert.rejects(service.list('staff','office-a'),/workforce_forbidden/);
});
test('follow-up rejects cross-office writes, stale revisions and renewed claims without a document',async()=>{
 const service=new StaffOperations(database({'workforceStaff/staff':grant,'workforceAuthorizations/test':{...details,state:'ready',revision:2}}),{} as any);
 await assert.rejects(service.renewal('staff','test',{status:'requested',note:'Called payer',followupDate:'',revision:1}),/authorization_changed_reload/);
 await assert.rejects(service.renewal('staff','test',{status:'renewed',note:'',followupDate:'',revision:2}),/upload_renewal_document_required/);
 const foreign=new StaffOperations(database({'workforceStaff/staff':grant,'workforceAuthorizations/test':{...details,office:'office-b',state:'ready',revision:2}}),{} as any);
 await assert.rejects(foreign.renewal('staff','test',{status:'requested',note:'',followupDate:'',revision:2}),/workforce_forbidden/);
});

test('viewing authorization files needs the separate explicit view permission and rechecks revocation',async()=>{
 const bytes=Buffer.from('synthetic private preview'),hash=createHash('sha256').update(bytes).digest('hex'),record={...details,state:'ready',preview:{path:'private',generation:'1',storedSha256:hash,sha256:hash,envelope:{}}},rows:Record<string,any>={'workforceStaff/staff':grant,'workforceAuthorizations/test':record};let downloaded=0,revoke=false;
 const bucket={file:()=>({download:async()=>{downloaded++;if(revoke)rows['workforceStaff/staff']={...rows['workforceStaff/staff'],active:false};return [bytes];}})},cipher={decrypt:async()=>bytes};const service=new StaffOperations(database(rows),bucket as any,()=>cipher as any);
 await assert.rejects(service.document('staff','test'),/workforce_forbidden/);assert.equal(downloaded,0);
 rows['workforceStaff/staff']={...grant,permissions:['authorizations.manage','authorizations.view']};assert.deepEqual(await service.document('staff','test'),bytes);revoke=true;await assert.rejects(service.document('staff','test'),/workforce_forbidden/);
});

test('member coverage distinguishes missing uploads, legacy links, future periods and expired services without claiming eligibility',async()=>{
 const rows:Record<string,any>={'workforceStaff/staff':grant,'workforceAuthorizations/legacy':{...details,state:'ready'}};
 const service=new StaffOperations(database(rows),{} as any);
 const missing=await service.memberCoverage('staff','office-a','123');assert.equal(missing.currentUploadedAuthorizations,0);assert.equal(missing.complete,true);assert.equal(missing.unlinkedRecordsNeedReview,true);assert.match(missing.notice,/No current uploaded authorization/);assert.equal(missing.eligibility,'unverified');
 rows['workforceAuthorizations/expired']={...details,clientId:'123',state:'ready',startDate:'2000-01-01',endDate:'2000-12-31',servicesContinuing:true};
 rows['workforceAuthorizations/future']={...details,clientId:'123',state:'ready',startDate:'2099-01-01',endDate:'2099-12-31'};
 rows['workforceAuthorizations/foreign-member']={...details,clientId:'456',state:'ready',startDate:'2000-01-01',endDate:'2099-12-31'};
 const expired=await service.memberCoverage('staff','office-a','123');assert.equal(expired.currentUploadedAuthorizations,0);assert.equal(expired.expired.length,1);assert.equal(expired.expired[0]!.servicesContinuing,true);
 rows['workforceAuthorizations/current']={...details,clientId:'123',state:'ready',startDate:'2000-01-01',endDate:'2099-12-31'};
 const current=await service.memberCoverage('staff','office-a','123');assert.equal(current.currentUploadedAuthorizations,1);assert.equal(current.billingReadiness,'review_required');assert.equal(current.eligibility,'unverified');assert.match(current.notice,/each payer, service, unit limit/);
 await assert.rejects(service.memberCoverage('staff','office-b','123'),/workforce_forbidden/);rows['workforceStaff/staff']={...grant,active:false};await assert.rejects(service.memberCoverage('staff','office-a','123'),/workforce_forbidden/);
});

test('a bounded member coverage scan reports uncertainty rather than a complete coverage claim',async()=>{
 const rows:Record<string,any>={'workforceStaff/staff':grant};for(let n=0;n<5001;n++)rows['workforceAuthorizations/'+String(n).padStart(5,'0')]={...details,state:'ready',clientId:'456'};
 const result=await new StaffOperations(database(rows),{} as any).memberCoverage('staff','office-a','123');assert.equal(result.complete,false);assert.equal(result.eligibility,'unverified');assert.match(result.notice,/scan is incomplete/);
});
