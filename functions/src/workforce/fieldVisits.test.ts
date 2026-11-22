import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createHash} from 'node:crypto';
import {visitData,visitContentHash,appendVisitSignature,renderVisit,FieldVisits,fullySignedVisit} from './fieldVisits.js';
const draft=()=>visitData({office:'a',kind:'survey',clientName:'Fictional Client',memberId:'DEMO-01',caregiverName:'Fictional Caregiver',visitDate:'2026-11-13',fields:{services:'Yes',tasks:'Yes',timeliness:'Yes',respect:'Yes',safety:'Yes',communication:'Yes',satisfaction:'Satisfied',changes:'None',followup:'Routine follow-up',notes:'Synthetic test only'},requiredSigners:['member','staff'],pages:[]});
test('field visit input strips untrusted signatures and rejects unknown fields and excessive source images',()=>{
 const data=draft();assert.equal(data.signatures.length,0);assert.throws(()=>visitData({...data,fields:{privateHtml:'<script>'}}));assert.throws(()=>visitData({...data,requiredSigners:['member']}));assert.throws(()=>visitData({...data,kind:'upload'}));assert.throws(()=>visitData({...data,pages:['abcd']}));assert.throws(()=>visitData({...data,visitDate:'2026-02-30'}));
 assert.equal(visitData({...data,signatures:[{name:'Forged'}]}).signatures.length,0);
});
test('signature is tied to reviewed content, explicit consent, role, staff witness and server time',()=>{
 const data=draft(),input={role:'member',name:'Fictional Signer',formRead:true,electronicConsent:true,contentSha256:visitContentHash(data),appearance:{style:'cursive'}};
 for(const patch of [{electronicConsent:false},{formRead:false},{role:'caregiver'},{contentSha256:'different'},{name:''}])assert.throws(()=>appendVisitSignature(data,{...input,...patch},'staff'));
 const signed=appendVisitSignature(data,input,'staff','2026-11-13T15:00:00Z');assert.equal(signed.signatures[0]!.witnessUid,'staff');assert.equal(visitContentHash(signed),visitContentHash(data));assert.throws(()=>appendVisitSignature(signed,input,'staff'));
 const edited={...data,clientName:'Different Client'};assert.throws(()=>appendVisitSignature(edited,input,'staff'));
});
test('signed PDF is a static print copy with signatures and no editable widgets',async()=>{
 let data=draft();for(const role of ['member','staff'])data=appendVisitSignature(data,{role,name:'Fictional '+role,formRead:true,electronicConsent:true,contentSha256:visitContentHash(data),appearance:{style:'drawn',strokes:[[[0,.6],[.3,.2],[.7,.8],[1,.4]]]}},'test-staff','2026-11-13T15:00:00Z');
 const bytes=await renderVisit(data,'TEST-ONLY');const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>=2);assert.equal(pdf.getForm().getFields().length,0);assert.ok(bytes.length>1000);
});
test('revoked and foreign-office field visit access fails before decrypting',async()=>{
 let decrypted=false;const row={office:'private-office'},db={collection:(name:string)=>({doc:()=>({get:async()=>({data:()=>name==='workforceFieldVisits'?row:{active:true,role:'office',offices:['other'],permissions:['field_visits.manage']}})})})};
 const service=new FieldVisits(db as any,{} as any,{decrypt:async()=>{decrypted=true;return Buffer.alloc(0);},encrypt:async()=>{throw Error();}});
 await assert.rejects(service.get('staff','visit-1'),/workforce_forbidden/);assert.equal(decrypted,false);
});

test('export requires every reviewed-content signature; draft preview stays available without export',async()=>{
 let data=draft();const audit:any[]=[],downloads:string[]=[];let state='draft';
 const pdf=Buffer.from('synthetic PDF'),hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
 const object=(path:string,bytes:Buffer)=>({path,generation:'1',envelope:{},sha256:hash(bytes),storedSha256:hash(bytes)});
 const db={collection:(name:string)=>({doc:()=>({get:async()=>({data:()=>name==='workforceFieldVisits'?{office:'a',state,revision:1,payload:object('payload',Buffer.from(JSON.stringify(data))),pdf:object('pdf',pdf)}:{active:true,role:'owner',offices:['a'],permissions:['field_visits.manage']}})}),add:async(row:any)=>{audit.push(row);}})};
 const bucket={file:(path:string)=>({download:async()=>{downloads.push(path);return [path==='pdf'?pdf:Buffer.from(JSON.stringify(data))];}})};
 const service=new FieldVisits(db as any,bucket as any,{decrypt:async bytes=>bytes,encrypt:async()=>{throw Error('unused');}});
 await assert.rejects(service.pdf('staff','visit'),/form_not_complete/);assert.equal(downloads.length,0);
 assert.deepEqual(await service.preview('staff','visit'),pdf);assert.equal(audit.at(-1).action,'field_visit_document_viewed');
 data=appendVisitSignature(data,{role:'member',name:'Fictional member',formRead:true,electronicConsent:true,contentSha256:visitContentHash(data),appearance:{style:'cursive'}},'staff');state='signing';assert(!fullySignedVisit(data));await assert.rejects(service.pdf('staff','visit'),/form_not_complete/);
 state='signed';await assert.rejects(service.pdf('staff','visit'),/form_not_complete/);
 data=appendVisitSignature(data,{role:'staff',name:'Fictional staff',formRead:true,electronicConsent:true,contentSha256:visitContentHash(data),appearance:{style:'cursive'}},'staff');assert(fullySignedVisit(data));assert.deepEqual(await service.pdf('staff','visit'),pdf);assert.equal(audit.at(-1).action,'field_visit_document_exported');
 data.signatures[0]!.contentSha256='tampered';await assert.rejects(service.pdf('staff','visit'),/form_not_complete/);
});
