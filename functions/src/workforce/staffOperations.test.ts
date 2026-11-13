import test from 'node:test';
import assert from 'node:assert/strict';
import {hiringApplication,employmentStatus,authorizationDetails,expiryBucket,StaffOperations} from './staffOperations.js';
import type {Intake} from './intake.js';
import {parseGrant,requirePermission} from './policy.js';
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
 const query=(name:string,filters:any[])=>({name,filters,limit:()=>query(name,filters),orderBy:()=>query(name,filters),startAfter:()=>query(name,filters),where:(field:string,op:string,value:unknown)=>query(name,[...filters,[field,value]])});
 return {collection,runTransaction:async(fn:any)=>fn({get:async(ref:any)=>ref.path?snapshot(ref.path):{docs:Object.keys(rows).filter(p=>p.startsWith(ref.name+'/')&&ref.filters.every(([f,v]:any)=>rows[p][f]===v)).map(snapshot)},create:()=>{},update:()=>{},set:()=>{}})} as any;
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
