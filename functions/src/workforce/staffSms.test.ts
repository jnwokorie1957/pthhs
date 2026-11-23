import test from 'node:test';
import assert from 'node:assert/strict';
import {StaffSms,staffSmsAction,actionBinding} from './staffSms.js';
import {readRequest} from '../operations/reads.js';
test('one-letter HHA patient lookup is scoped to the workforce roster',()=>{
 const q={operation:'SearchPatients' as const,lastName:'A'};
 assert.match(readRequest(q,'workforce_roster_import'),/<LastName>A<\/LastName>/);
 assert.throws(()=>readRequest(q),/requires_2/);
});
test('staff document and outbound routes request verification, name searches and copy preparation return metadata',()=>{
 for(const path of ['/staff/applications/a/documents/b','/staff/roster/1/files/2','/staff/field-visits/a','/staff/field-visits/a/preview','/staff/field-visits/a/pdf','/staff/applicants/a/print','/staff/authorizations/a/document','/staff/admission-templates/a','/staff/admission-packets/a/pdf'])assert(staffSmsAction(path,'GET',undefined),path);
 for(const path of ['/staff/admission-packets/a/share','/staff/invitations','/staff/roster/1/access','/staff/accounts/a/reset','/staff/applications/a/hha-transfer/recheck'])assert(staffSmsAction(path,'POST',{}),path);
 for(const path of ['/staff/clients/search','/staff/field-visits/names','/staff/admission-templates/a/requirements','/staff/admission-templates/a/copy'])assert.equal(staffSmsAction(path,'POST',{}),null);
});
test('a verification is bound to the phone, identity, session, action and request contents',async()=>{
 const rows=new Map<string,any>();let delivered='',clock=1000;
 const db={collection:(name:string)=>({doc:(id='audit')=>name+'/'+id}),runTransaction:async(cb:any)=>cb({get:async(k:string)=>({data:()=>rows.get(k)}),create:(k:string,v:any)=>rows.set(k,v),set:(k:string,v:any)=>rows.set(k,v),update:(k:string,v:any)=>Object.assign(rows.get(k),v)})};
 const principal={uid:'test-owner',authTime:12,phone:'+12025550101'},send=staffSmsAction('/staff/admission-packets/a/share','POST',{})!,open=staffSmsAction('/staff/field-visits/a','GET',{})!;
 const service=new StaffSms(db as any,async(to,code)=>{assert.equal(to,principal.phone);delivered=code;},()=>clock);
 const binding=(body:string)=>actionBinding('POST','/staff/admission-packets/a/share',Buffer.from(body));
 const request=await service.request(principal,binding('email')),proof=request.id+'.'+delivered;
 assert.equal(request.lastFour,'0101');assert(!('code' in request));
 for(const changed of [{uid:'other'},{phone:'+12025550102'},{authTime:99}])await assert.rejects(service.consume({...principal,...changed},binding('email'),proof,send),/invalid_staff_code/);
 await assert.rejects(service.consume(principal,binding('sms'),proof,send),/invalid_staff_code/);
 assert.equal(await service.consume(principal,binding('email'),proof,send),null);
 await assert.rejects(service.consume(principal,binding('email'),proof,send),/invalid_staff_code/);
 const second=await service.request(principal,binding('open')),view=await service.consume(principal,binding('open'),second.id+'.'+delivered,open);
 const preview=staffSmsAction('/staff/field-visits/a/preview','GET',{})!;
 await service.consume(principal,'other',undefined,preview,view!);
 await assert.rejects(service.consume(principal,'other',undefined,preview,view!),/invalid_staff_code/);
 for(const action of [open,send,staffSmsAction('/staff/field-visits/b/preview','GET',{})!])await assert.rejects(service.consume(principal,'other',undefined,action,view!),/invalid_staff_code/);
 clock+=300001;await assert.rejects(service.consume(principal,'other',undefined,preview,view!),/invalid_staff_code/);
 const last=await service.request(principal,binding('again'));
 const wrong=delivered==='123456'?'123455':'123456';for(let n=0;n<5;n++)await assert.rejects(service.consume(principal,binding('again'),last.id+'.'+wrong,open));
 await assert.rejects(service.consume(principal,binding('again'),last.id+'.'+delivered,open));
});
