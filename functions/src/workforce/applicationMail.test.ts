import test from 'node:test';
import assert from 'node:assert/strict';
import {ApplicationMail,applicationMailPayload,attachmentName,MAX_MAIL_PACKET_BYTES,submissionNotice,splitSubmission} from './applicationMail.js';
import {PDFDocument} from 'pdf-lib';
import {applicationMailJob} from './applicationMailPolicy.js';
import type {Intake} from './intake.js';
import type {PrivateDocument} from './documents.js';
const notice={name:'Synthetic Applicant',email:'synthetic@example.invalid',phone:'555-0100',insurance:'Decline' as const};
const pdf=Buffer.from('%PDF-1.7\nsynthetic-only\n%%EOF');
const files=[{name:'Applicant, Synthetic - Employment application.pdf',bytes:pdf},{name:'Applicant, Synthetic - Direct deposit form.pdf',bytes:pdf}];
test('packet recipient and attachment metadata are fixed; oversized payloads never send',()=>{
 const payload=applicationMailPayload('synthetic',1,files,notice);
 assert.deepEqual(payload.message.toRecipients,[{emailAddress:{address:'irab@pthhs.net'}}]);
 assert.deepEqual(payload.message.attachments.map(f=>f.name),files.map(f=>f.name));assert.equal(payload.saveToSentItems,false);
 assert.equal(Buffer.from(payload.message.attachments[0]!.contentBytes,'base64').toString(),pdf.toString());
 assert.throws(()=>applicationMailPayload('other/path',1,files,notice));
 assert.throws(()=>applicationMailPayload('synthetic',1,[{name:'large.pdf',bytes:Buffer.concat([pdf,Buffer.alloc(MAX_MAIL_PACKET_BYTES)])}],notice),/review_required/);
 assert.throws(()=>applicationMailPayload('synthetic',1,[files[0]!,files[0]!],notice),/review_required/);
 assert.throws(()=>applicationMailPayload('synthetic',1,[{name:'../private.pdf',bytes:pdf}],notice),/review_required/);
 assert.throws(()=>applicationMailPayload('synthetic',1,['first','second'].map(name=>({name:name+'.pdf',bytes:Buffer.concat([pdf,Buffer.alloc(MAX_MAIL_PACKET_BYTES/2)])})),notice),/review_required/);
 assert.match(payload.message.body.content,/Each document is attached as a separate/);
 assert.equal(attachmentName('Jordan','Taylor','Direct deposit form'),'Taylor, Jordan - Direct deposit form.pdf');
 assert.equal(attachmentName('María Ana',"O'Neill-Santos",'Form W-4'),"O'Neill-Santos, María Ana - Form W-4.pdf");
 assert(!attachmentName('a/\r\nb','../../c','D:thing').includes('/'));
});
test('submission snapshots include optional direct deposit without raw bytes or draft forms',()=>{
 const app={uid:'synthetic',office:'office',revision:2,state:'submitted',signature:{},updatedAt:'2026-11-11'} as Intake;
 const base={uid:'synthetic',kind:'direct_deposit',state:'pending_security_review',generation:'1',sha256:'a'.repeat(64),size:100} as PrivateDocument;
 const job=applicationMailJob(app,[{...base,id:'old',createdAt:'2026-11-10'},{...base,id:'new',createdAt:'2026-11-11'}],[]);
 assert.deepEqual(job.documents.map(d=>d.id),['new']);assert.equal(job.status,'queued');assert(!JSON.stringify(job).includes('base64'));
 assert.throws(()=>applicationMailJob(app,[{...base,id:'wrong',uid:'other',createdAt:'today'}],[]),/owner_mismatch/);
});
function fixture(fail=false,onSend?:(part:any)=>void){
 let allowed=true,serial=Promise.resolve();const records=new Map<string,any>();
 const job={uid:'synthetic',revision:1,office:'office',to:'irab@pthhs.net',status:'queued',documents:[],forms:[]};
 records.set('workforceApplicationMail/synthetic_1',job);records.set('workforceApplications/synthetic/versions/1',{uid:'synthetic',revision:1,office:'office',state:'submitted',answers:{firstName:'Synthetic',lastName:'Applicant',email:'synthetic@example.invalid',phone:'555',terms_page_17:'Decline'}});records.set('workforceApplications/synthetic',{revision:1,state:'submitted',office:'office'});
 const ref=(path:string)=>({path,collection:(name:string)=>({doc:(id:string)=>ref(path+'/'+name+'/'+id)}),get:async()=>({data:()=>structuredClone(records.get(path))}),update:async(data:object)=>{records.set(path,{...records.get(path),...data});}});
 const db:any={collection:(name:string)=>({doc:(id:string)=>ref(name+'/'+id)}),runTransaction:(fn:any)=>{const task=serial.then(async()=>{const updates:any[]=[];const result=await fn({get:(r:any)=>r.get(),update:(r:any,d:any)=>updates.push([r.path,d])});for(const[p,d]of updates)records.set(p,{...records.get(p),...d});return result;});serial=task.then(()=>{},()=>{});return task;}};
 let sends=0,summaries=0;
 const store={formContext:async()=>({}),download:async()=>pdf};
 const worker=new ApplicationMail({prepareSummary:async()=>async()=>{summaries++;},preparePacket:async()=>async(_uid,_revision,_files,_notice,part)=>{sends++;onSend?.(part);if(fail)throw Error('ambiguous timeout');}},()=>allowed,'00-0000000',db,store as any,{getUser:async()=>({disabled:false,emailVerified:true})} as any);
 worker.packet=async()=>({files,notice});
 return{worker,records,store,get sends(){return sends;},get summaries(){return summaries;},close:()=>{allowed=false;}};
}

test('real attachment assembly keeps application and direct deposit separate and holds quarantined files',async()=>{
 const f=fixture(),job=f.records.get('workforceApplicationMail/synthetic_1');
 Object.assign(job,{status:'building',lease:'test-lease',leaseUntil:Date.now()+600000,documents:[{id:'deposit',uid:'synthetic',generation:'1',sha256:'a'.repeat(64),size:pdf.length,kind:'direct_deposit'}]});
 Object.assign(f.records.get('workforceApplications/synthetic/versions/1'),{updatedAt:'2026-11-11T16:00:00Z',packetVersion:'synthetic'});
 const doc={...job.documents[0],state:'pending_security_review'};f.records.set('workforcePrivateDocuments/deposit',doc);
 let downloads=0;f.store.download=async()=>{downloads++;return pdf;};
 await assert.rejects(ApplicationMail.prototype.packet.call(f.worker,'synthetic_1',job,'test-lease'),/mail_security_review_pending/);assert.equal(downloads,0);
 doc.state='pending_review';
 const result=await ApplicationMail.prototype.packet.call(f.worker,'synthetic_1',job,'test-lease');
 assert.deepEqual(result.files.map(file=>file.name),['Applicant, Synthetic - Employment application.pdf','Applicant, Synthetic - Direct deposit form.pdf']);
 assert.equal(result.files[1]!.bytes,pdf);assert.equal(downloads,1);assert.equal(result.notice.insurance,'Decline');
 doc.generation='2';await assert.rejects(ApplicationMail.prototype.packet.call(f.worker,'synthetic_1',job,'test-lease'),/mail_snapshot_invalid/);assert.equal(downloads,1);
});
test('concurrent scheduler runs claim a submission once; accepted jobs are not resent',async()=>{
 const f=fixture();await Promise.all([f.worker.send('synthetic_1'),f.worker.send('synthetic_1')]);await f.worker.send('synthetic_1');
 assert.equal(f.sends,1);assert.equal(f.records.get('workforceApplicationMail/synthetic_1').status,'accepted');
});
test('uncertain dispatch is visible and never automatically retried',async()=>{
 const f=fixture(true);await f.worker.send('synthetic_1');await f.worker.send('synthetic_1');assert.equal(f.sends,1);assert.equal(f.records.get('workforceApplicationMail/synthetic_1').status,'unconfirmed');
});
test('closed collection sends nothing and quarantined documents stay queued',async()=>{
 const f=fixture();f.close();await f.worker.send('synthetic_1');assert.equal(f.sends,0);
 const g=fixture();g.worker.packet=async()=>{throw Error('mail_security_review_pending');};await g.worker.send('synthetic_1');assert.equal(g.sends,0);assert.equal(g.summaries,1);assert.equal(g.records.get('workforceApplicationMail/synthetic_1').summaryStatus,'accepted');assert.equal(g.records.get('workforceApplicationMail/synthetic_1').status,'queued');g.records.get('workforceApplicationMail/synthetic_1').retryAt=0;await g.worker.send('synthetic_1');assert.equal(g.summaries,1);
});

test('insurance notification preserves Accept/Decline without assuming alternative coverage',()=>{for(const election of ['Accept','Decline']){const app={answers:{firstName:'Synthetic',lastName:'Applicant',email:'test@example.invalid',phone:'555',terms_page_17:election}} as unknown as Intake;const n=submissionNotice(app);assert.equal(n.insurance,election);assert.match(applicationMailPayload('synthetic',1,files,n).message.body.content,new RegExp('Health insurance coverage election: '+election.toUpperCase()));}assert.throws(()=>submissionNotice({answers:{terms_page_17:''}} as unknown as Intake),/insurance_election_required/);});

test('large submissions keep each document separate across numbered emails',async()=>{
 const large=['Application','Direct deposit','Photo ID'].map(title=>({name:`Taylor, Jordan - ${title}.pdf`,bytes:Buffer.concat([pdf,Buffer.alloc(1_100_000)])}));
 const batches=await splitSubmission(large);assert.equal(batches.length,3);assert.deepEqual(batches.flat(),large);
 const parts:any[]=[];const f=fixture(false,p=>parts.push(p));f.worker.packet=async()=>({files:large,notice});await f.worker.send('synthetic_1');
 assert.deepEqual(parts.map(p=>[p.part,p.total]),[[1,3],[2,3],[3,3]]);assert.equal(f.records.get('workforceApplicationMail/synthetic_1').acceptedParts,3);
 assert.match(applicationMailPayload('synthetic',1,[large[0]!],notice,parts[0]).message.subject,/email 1 of 3/);
});
test('oversized multipage PDF splits into valid page PDFs with page names',async()=>{
 const doc=await PDFDocument.create();for(let i=0;i<3;i++)doc.addPage().drawText(`Page ${i+1}`);
 // Padding models a legal oversized PDF without needing large image fixtures.
 const bytes=Buffer.concat([Buffer.from(await doc.save()),Buffer.alloc(MAX_MAIL_PACKET_BYTES)]);
 const batches=await splitSubmission([{name:'Taylor, Jordan - Application.pdf',bytes}]);
 assert.equal(batches.flat().length,3);for(const [index,file]of batches.flat().entries()){assert.match(file.name,new RegExp(`page ${index+1} of 3`));assert.equal((await PDFDocument.load(file.bytes)).getPageCount(),1);}
});
test('closure between emails stops dispatch and retains accepted-part cursor',async()=>{
 const f=fixture(false,()=>f.close());const large=['One','Two'].map(name=>({name:name+'.pdf',bytes:Buffer.concat([pdf,Buffer.alloc(1_100_000)])}));f.worker.packet=async()=>({files:large,notice});
 await assert.rejects(f.worker.send('synthetic_1'),/mail_release_closed/);assert.equal(f.sends,1);assert.equal(f.records.get('workforceApplicationMail/synthetic_1').nextPart,1);
});
test('resume skips accepted email parts, while mismatched manifests require review',async()=>{
 const large=['One','Two'].map(name=>({name:name+'.pdf',bytes:Buffer.concat([pdf,Buffer.alloc(1_100_000)])}));
 const f=fixture();f.records.get('workforceApplicationMail/synthetic_1').nextPart=1;f.worker.packet=async()=>({files:large,notice});await f.worker.send('synthetic_1');assert.equal(f.sends,1);assert.equal(f.records.get('workforceApplicationMail/synthetic_1').nextPart,2);
 const g=fixture();Object.assign(g.records.get('workforceApplicationMail/synthetic_1'),{nextPart:1,batchManifest:'changed'});g.worker.packet=async()=>({files:large,notice});await g.worker.send('synthetic_1');assert.equal(g.sends,0);assert.equal(g.records.get('workforceApplicationMail/synthetic_1').status,'review_required');
});
test('later-form notices include insurance and do not resend the employment application',async()=>{
 const f=fixture();const job={...f.records.get('workforceApplicationMail/synthetic_1'),eventKey:'form-w4-1'};const id='synthetic_1_form-w4-1';f.records.set('workforceApplicationMail/'+id,job);await f.worker.send(id);assert.equal(f.sends,1);await f.worker.send(id);assert.equal(f.sends,1);
 const message=applicationMailPayload('synthetic',1,files,notice,{part:1,total:1,followup:true}).message;assert.match(message.subject,/additional completed forms/);assert.match(message.body.content,/DECLINE/);
 Object.assign(job,{status:'building',lease:'test',leaseUntil:Date.now()+60000});f.records.set('workforceApplicationMail/'+id,job);const packet=await ApplicationMail.prototype.packet.call(f.worker,id,job,'test');assert.equal(packet.files.length,0);
});

test('quarantined jobs cannot starve later submissions across scheduler runs',async()=>{
 const items=Array.from({length:12},(_,i)=>({id:'job-'+String(i).padStart(2,'0'),data:()=>({status:'queued'})}));let cursor='';const visited:string[]=[];
 const query=(after='')=>({where:()=>query(after),orderBy:()=>query(after),limit:()=>query(after),startAfter:(value:string)=>query(value),get:async()=>({docs:items.filter(item=>item.id>after)})});
 const state={get:async()=>({data:()=>({afterId:cursor})}),set:async(value:{afterId:string})=>{cursor=value.afterId;}};
 const db:any={collection:(name:string)=>name==='workforceApplicationMailState'?{doc:()=>state}:query()};
 const worker=new ApplicationMail({preparePacket:async()=>async()=>{}},()=>true,'00-0000000',db,{} as any,{} as any);worker.send=async id=>{visited.push(id);};
 await worker.run();assert.equal(visited.length,10);await worker.run();assert.deepEqual(visited,items.map(item=>item.id));await worker.run();assert.equal(visited[12],'job-00');
});

test('a later quarantined upload waits without repeating the original submission summary',async()=>{
 const f=fixture(),eventKey='document-00000000-0000-4000-8000-000000000001',id='synthetic_1_'+eventKey;f.records.set('workforceApplicationMail/'+id,{...f.records.get('workforceApplicationMail/synthetic_1'),eventKey});f.worker.packet=async()=>{throw Error('mail_security_review_pending');};await f.worker.send(id);assert.equal(f.sends,0);assert.equal(f.summaries,0);assert.equal(f.records.get('workforceApplicationMail/'+id).status,'queued');
});
