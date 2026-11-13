import test from 'node:test';
import assert from 'node:assert/strict';
import {CaregiverOffice,licenseDate,licenseReminderPayload,sendLicenseReminders} from './caregiverOffice.js';
import {caregiverSyncWindow,caregiverChangesSince} from './caregiverSync.js';
import {parseGrant} from './policy.js';
import {parseOpportunity,publicOpportunity,type Opportunity} from './opportunities.js';

test('caregiver automatic sync is weekday 9–5 Central, including DST changes',()=>{
 for(const date of ['2026-11-13T15:00:00Z','2026-11-13T22:45:00Z','2026-11-13T23:00:00Z','2026-07-13T14:00:00Z'])assert.equal(caregiverSyncWindow(new Date(date)),true,date);
 for(const date of ['2026-11-13T14:59:00Z','2026-11-13T23:15:00Z','2026-11-14T16:00:00Z','2026-11-15T16:00:00Z','2026-07-13T22:15:00Z'])assert.equal(caregiverSyncWindow(new Date(date)),false,date);
 assert.equal(caregiverChangesSince('2026-11-13T23:00:00Z',new Date('2026-11-16T15:00:00Z')),'2026-11-11T00:00:00');
});
test('license dates validate real calendar dates and accept an explicit clear',()=>{
 for(const date of ['2026-02-30','12/01/2026',null,{},'2026-13-01'])assert.throws(()=>licenseDate(date));
 assert.equal(licenseDate('2028-02-29'),'2028-02-29');assert.equal(licenseDate(''),'');
});
test('license reminder uses only the fixed HR mailbox and portal link, without ID documents',()=>{
 const message=licenseReminderPayload(2);assert.deepEqual(message.message.toRecipients,[{emailAddress:{address:'irab@pthhs.net'}}]);assert.ok(!('attachments' in message.message));assert.match(message.message.body.content,/https:\/\/pthhs.net\/workforce/);assert.throws(()=>licenseReminderPayload(0));
});
test('HR expiration access cannot be granted to general office staff or supervisors',()=>{
 for(const role of ['office','supervisor'])assert.throws(()=>parseGrant({active:true,role,offices:['a'],permissions:['hr.expirations']}));
 for(const role of ['owner','office_manager','hr'])assert.equal(parseGrant({active:true,role,offices:['a'],permissions:['hr.expirations']}).role,role);
});
const grant={active:true,role:'hr',offices:['a'],permissions:['accounts.support','hr.expirations']};
function database(rows:Record<string,any>){
 const snap=(path:string)=>({id:path.split('/').at(-1),exists:path in rows,data:()=>rows[path]});
 const collection=(name:string)=>({doc:(id:string)=>({path:name+'/'+id}),where:()=>({name})});
 return {collection,runTransaction:async(fn:any)=>fn({get:async(ref:any)=>snap(ref.path),set:(ref:any,data:any)=>{rows[ref.path]=data;},create:(ref:any,data:any)=>{rows[ref.path]=data;}})} as any;
}
test('legacy caregiver expiration saves without an application; stale edits and foreign offices are rejected',async()=>{
 const rows:Record<string,any>={'workforceStaff/hr':grant,'workforceHhaProfiles/10':{office:'a',firstName:'Demo',lastName:'Caregiver'}},service=new CaregiverOffice(database(rows));
 const result=await service.license('hr','hhaexchange','10',{date:'2027-01-01',revision:0});assert.equal(result.revision,1);
 assert.equal((await service.license('hr','hhaexchange','10')).date,'2027-01-01');
 await assert.rejects(service.license('hr','hhaexchange','10',{date:'2027-02-01',revision:0}),/revision_conflict/);
 rows['workforceHhaProfiles/10'].office='b';await assert.rejects(service.license('hr','hhaexchange','10'),/workforce_forbidden/);
});
test('revoked HR access cannot read expiration metadata',async()=>{
 const rows={'workforceStaff/hr':{...grant,active:false},'workforceHhaProfiles/10':{office:'a'}};
 await assert.rejects(new CaregiverOffice(database(rows)).license('hr','hhaexchange','10'),/workforce_forbidden/);
});
test('opportunity care tasks, shift, service type and pets survive explicit public projection',()=>{
 const data={office:'a',internalReference:'PRIVATE',internalNotes:'PRIVATE',public:{location:'Houston',recruitingZip:'77035',weeklyHours:16.5,schedule:'weekdays',type:'assignment',assistance:['bathing','meal_preparation','escort'],serviceType:'protective_supervision',shifts:['morning','afternoon'],pets:'yes'}};
 const clean=parseOpportunity(data),result=publicOpportunity({...clean,id:'demo',state:'published',revision:3,review:{revision:3,reviewer:'reviewer',at:''},updatedAt:''} as Opportunity)!;
 assert.equal(result.serviceType,'protective_supervision');assert.deepEqual(result.shifts,['morning','afternoon']);assert.equal(result.pets,'yes');assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 for(const patch of [{serviceType:'unknown'},{shifts:[]},{shifts:['night']},{pets:'sometimes'},{assistance:['unapproved task']},{patientName:'Private'}])assert.throws(()=>parseOpportunity({...data,public:{...data.public,...patch}}));
});
