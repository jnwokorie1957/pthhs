import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {dispatchLicenseReminder,ReminderSendError,reminderWindow} from './licenseReminderOutbox.js';
import {FieldVisits,visitData,appendVisitSignature,visitContentHash,missingVisitFields,renderVisit} from './fieldVisits.js';
import {signaturePlacements} from './signaturePlacements.js';

function memory(rows:Record<string,any>){
 const snapshot=(p:string)=>({exists:p in rows,data:()=>rows[p]});
 const ref=(p:string):any=>({path:p,get:async()=>snapshot(p),collection:(n:string)=>({doc:(id:string)=>ref(p+'/'+n+'/'+id)})});let tail=Promise.resolve();
 return {collection:(n:string)=>({doc:(id:string)=>ref(n+'/'+id)}),runTransaction:(fn:any)=>{const task=tail.then(async()=>{const writes:Array<()=>void>=[],tx={get:async(r:any)=>snapshot(r.path),set:(r:any,v:any)=>writes.push(()=>{rows[r.path]=v;}),update:(r:any,v:any)=>writes.push(()=>{rows[r.path]={...rows[r.path],...v};}),create:(r:any,v:any)=>writes.push(()=>{assert.ok(!(r.path in rows));rows[r.path]=v;})};const result=await fn(tx);writes.forEach(w=>w());return result;});tail=task.then(()=>{},()=>{});return task;}} as any;
}
test('reminder retries preparation failure and definite rejection, but never resends uncertain delivery',async()=>{
 for(const failure of ['prepare','429','network','403']){
  const rows:Record<string,any>={},db=memory(rows);let now=new Date('2026-11-13T15:00:00Z'),calls=0,prepares=0;
  const transport={prepareReminder:async()=>{prepares++;if(failure==='prepare'&&prepares===1)throw Error('token_unavailable');return async()=>{calls++;if(calls===1){if(failure==='429')throw new ReminderSendError(true);if(failure==='403')throw new ReminderSendError(true,true);if(failure==='network')throw Error('timeout');}};}};
  const run=()=>dispatchLicenseReminder(transport,2,'evidence','irab@pthhs.net',db,()=>now);
  await run();const row=rows['workforceLicenseReminderMail/2026-11-13'];assert.equal(row.status,failure==='network'?'unconfirmed':failure==='403'?'failed':'retry_wait');
  now=new Date(now.getTime()+16*60000);await run();assert.equal(rows['workforceLicenseReminderMail/2026-11-13'].status,['prepare','429'].includes(failure)?'accepted':failure==='network'?'unconfirmed':'failed');
  const sent=calls;await run();assert.equal(calls,sent);
 }
});
test('reminder leases stop concurrent sends and crashed dispatches require review',async()=>{
 const rows:Record<string,any>={},db=memory(rows),now=()=>new Date('2026-11-13T15:00:00Z');let sends=0;
 const transport={prepareReminder:async()=>async()=>{sends++;}},run=()=>dispatchLicenseReminder(transport,1,'hash','irab@pthhs.net',db,now);
 await Promise.all([run(),run()]);assert.equal(sends,1);
 rows['workforceLicenseReminderMail/2026-11-13']={status:'dispatching',leaseUntil:0};await run();assert.equal(sends,1);assert.equal(rows['workforceLicenseReminderMail/2026-11-13'].status,'unconfirmed');
 rows['workforceLicenseReminderMail/2026-11-13']={status:'preparing',leaseUntil:0,attempts:1};await run();assert.equal(sends,2);
 assert.equal(reminderWindow(new Date('2026-11-13T14:15:00Z')),false);assert.equal(reminderWindow(new Date('2026-11-13T14:30:00Z')),true);
});
const draft=()=>visitData({office:'100',clientName:'Fictional Client',memberId:'TEST',caregiverName:'Fictional Caregiver',kind:'survey',visitDate:'2026-11-13',fields:{},pages:[],requiredSigners:['member','staff']});
const complete=()=>{const data=draft();for(const key of missingVisitFields(data))data.fields[key]='Practice response';return data;};
const signature=(data:any,role:string)=>({role,name:'Fictional '+role,appearance:{style:'cursive'},contentSha256:visitContentHash(data),electronicConsent:true,formRead:true});
test('incomplete drafts save, but required answers and upload locations gate every signature',()=>{
 const data=draft();assert.ok(missingVisitFields(data).length);assert.throws(()=>appendVisitSignature(data,signature(data,'member'),'staff'),/field_visit_incomplete/);
 const ready=complete();assert.equal(missingVisitFields(ready).length,0);assert.equal(appendVisitSignature(ready,signature(ready,'member'),'staff').signatures.length,1);
 const upload={...ready,kind:'upload' as const,fields:{title:'Test upload'}};assert.throws(()=>appendVisitSignature(upload,signature(upload,'member'),'staff'),/signature_fields_required/);
 for(const fields of [[{role:'staff',page:0,x:NaN,y:0,width:.3,height:.1}],[{role:'staff',page:1,x:0,y:0,width:.3,height:.1}],[{role:'member',page:0,x:.9,y:0,width:.3,height:.1}]])assert.throws(()=>signaturePlacements(fields,1,['staff']));
 assert.throws(()=>signaturePlacements([{role:'staff',page:0,x:0,y:0,width:.3,height:.1},{role:'member',page:0,x:.1,y:0,width:.3,height:.1}],1,['staff','member']),/overlap/);
});
test('corrected copies preserve signed originals and require fresh signatures and office access',async()=>{
 const rows:Record<string,any>={'workforceStaff/staff':{active:true,role:'owner',offices:['100'],permissions:['field_visits.manage']}},objects=new Map<string,Buffer>(),db=memory(rows);
 const bucket={file:(path:string)=>({save:async(bytes:Buffer)=>{objects.set(path,bytes);},getMetadata:async()=>[{generation:'1'}],download:async()=>[objects.get(path)]})};
 const cipher={encrypt:async(bytes:Buffer)=>({bytes,envelope:{}}),decrypt:async(bytes:Buffer)=>bytes};const visits=new FieldVisits(db,bucket as any,cipher as any);
 let saved=await visits.save('staff','visit',0,complete());for(const role of ['member','staff'])saved=await visits.sign('staff','visit',saved.revision,signature(saved.data,role));
 const original=JSON.stringify(rows['workforceFieldVisits/visit']),copy=await visits.amend('staff','visit',{id:'correction',revision:saved.revision,reason:'Correcting the recorded answer.'});
 assert.equal(copy.state,'draft');assert.equal(copy.data.signatures.length,0);assert.equal(copy.data.amendment?.originalId,'visit');assert.equal(JSON.stringify(rows['workforceFieldVisits/visit']),original);
 assert.ok(Object.keys(rows).some(k=>k.includes('/visit/corrections/correction')));assert.ok(Object.values(rows).some(row=>row.action==='field_visit_corrected_copy_created'));
 await assert.rejects(visits.save('staff','visit',saved.revision,complete()),/signed_visit_locked/);
 await assert.rejects(visits.save('staff','correction',copy.revision,{...copy.data,memberId:'ANOTHER'}),/amendment_source_changed/);
 rows['workforceStaff/staff'].offices=['200'];await assert.rejects(visits.amend('staff','visit',{id:'foreign',revision:saved.revision,reason:'Correction'}),/workforce_forbidden/);
});
test('uploaded form signature placements render a static PDF with no editable fields',async()=>{
 const page=await sharp({create:{width:600,height:800,channels:3,background:'#fff'}}).jpeg().toBuffer();
 let data=visitData({...complete(),kind:'upload',fields:{title:'Practice uploaded form'},pages:[page.toString('base64')],signatureFields:[{role:'member',page:0,x:.1,y:.4,width:.5,height:.08},{role:'staff',page:0,x:.1,y:.6,width:.5,height:.08}]});
 for(const role of ['member','staff'])data=appendVisitSignature(data,signature(data,role),'staff');
 const pdf=await PDFDocument.load(await renderVisit(data,'PLACEMENT-TEST'));assert.equal(pdf.getForm().getFields().length,0);assert.ok(pdf.getPageCount()>=3);
});
