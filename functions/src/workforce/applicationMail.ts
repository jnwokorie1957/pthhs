import {randomUUID,createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {GraphVerificationTransport} from './verificationMail.js';
import {PAYROLL_RECIPIENT,type ApplicationMailJob} from './applicationMailPolicy.js';
import {IntakeStore} from './intakeStore.js';
import type {Intake} from './intake.js';
import type {FormRecord} from './eforms.js';
import {FORM_TITLES,renderOfficialForm} from './eforms.js';
import {renderApplication,renderDocumentPrint} from './applicationPdf.js';
import {validId} from './policy.js';

export const MAX_MAIL_PACKET_BYTES=2_000_000;
export interface SubmissionAttachment {name:string;bytes:Buffer}
export interface MailPart {part:number;total:number;followup?:boolean}
export async function splitSubmission(files:SubmissionAttachment[]):Promise<SubmissionAttachment[][]>{
 const expanded:SubmissionAttachment[]=[];
 for(const file of files){
  if(file.bytes.length<=MAX_MAIL_PACKET_BYTES){expanded.push(file);continue;}
  const pdf=await PDFDocument.load(file.bytes);pdf.getForm().flatten();
  for(let i=0;i<pdf.getPageCount();i++){
   const page=await PDFDocument.create();page.setCreationDate(new Date(0));page.setModificationDate(new Date(0));const [copied]=await page.copyPages(pdf,[i]);page.addPage(copied!);
   const bytes=Buffer.from(await page.save());if(bytes.length>MAX_MAIL_PACKET_BYTES)throw Error('mail_packet_review_required');
   expanded.push({name:file.name.replace(/\.pdf$/,` - page ${i+1} of ${pdf.getPageCount()}.pdf`),bytes});
  }
 }
 const batches:SubmissionAttachment[][]=[];let batch:SubmissionAttachment[]=[],size=0;
 for(const file of expanded){if(batch.length&&(size+file.bytes.length>MAX_MAIL_PACKET_BYTES||batch.length===25)){batches.push(batch);batch=[];size=0;}batch.push(file);size+=file.bytes.length;}
 if(batch.length)batches.push(batch);if(!batches.length||batches.length>100)throw Error('mail_packet_review_required');return batches;
}
export function attachmentName(firstName:string,lastName:string,title:string){
 const clean=(value:string)=>value.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} '-]/gu,'').trim().replace(/\s+/g,' ').slice(0,70);
 return (clean(lastName)||'Caregiver')+', '+(clean(firstName)||'Applicant')+' - '+(clean(title)||'Document')+'.pdf';
}
export interface SubmissionNotice {name:string;email:string;phone:string;insurance:'Accept'|'Decline'}
export function submissionNotice(application:Intake):SubmissionNotice {
 const a=application.answers,election=a.terms_page_17;
 if(election!=='Accept'&&election!=='Decline')throw Error('insurance_election_required');
 return {name:[a.firstName,a.lastName].filter(Boolean).join(' '),email:a.email||'',phone:a.phone||'',insurance:election};
}
export function applicationMailPayload(uid:string,revision:number,files:SubmissionAttachment[],notice:SubmissionNotice,part?:MailPart){
 if(!validId(uid)||!Number.isSafeInteger(revision)||revision<1||!files.length||files.length>25||files.reduce((n,f)=>n+f.bytes.length,0)>MAX_MAIL_PACKET_BYTES||new Set(files.map(f=>f.name)).size!==files.length||files.some(f=>! /^[\p{L}\p{M}\p{N}, '_-]{1,225}\.pdf$/u.test(f.name)||f.bytes.length<5||f.bytes.subarray(0,5).toString()!=='%PDF-'))throw Error('mail_packet_review_required');
 const subject=part?.followup?'Caregiver additional completed forms':'Caregiver application submitted — documents attached';
 const result={message:{subject:subject+(part&&part.total>1?` — email ${part.part} of ${part.total}`:''),
  body:{contentType:'Text',content:'Applicant: '+notice.name+'\nEmail: '+notice.email+'\nPhone: '+notice.phone+'\nHealth insurance coverage election: '+notice.insurance.toUpperCase()+'\n'+(notice.insurance==='Accept'?'Follow up about enrolling in the company health plan.':'The applicant declined the offered company coverage. Follow up if clarification is needed; this does not establish that they have other insurance.')+'\n\nA caregiver submitted an application. Each document is attached as a separate, named PDF for filing: the application, submitted forms, and cleared uploads available at submission. Unfinished forms are not included.\n\nAttachments:\n'+files.map(f=>'- '+f.name).join('\n')+'\n\nReview the record and delivery status in the secure staff portal: https://pthhs.net/workforce#applications?record='+encodeURIComponent(uid)+'&source=portal&tab=documents'},
  toRecipients:[{emailAddress:{address:PAYROLL_RECIPIENT}}],
  attachments:files.map(f=>({'@odata.type':'#microsoft.graph.fileAttachment',name:f.name,contentType:'application/pdf',contentBytes:f.bytes.toString('base64')}))},saveToSentItems:false};
 if(part?.followup)result.message.body.content=result.message.body.content.replace('A caregiver submitted an application. Each document is attached as a separate, named PDF for filing: the application, submitted forms, and cleared uploads available at submission. Unfinished forms are not included.','The caregiver completed additional forms after submitting the application. Only these newly completed forms are attached; previously emailed documents are not repeated.');
 if(part)result.message.body.content=`${part.followup?'Additional forms completed after application submission.':'Application submission.'} Email ${part.part} of ${part.total}.\n\n`+result.message.body.content;
 return result;
}
export interface ApplicationTransport {prepareSummary?():Promise<(uid:string,notice:SubmissionNotice)=>Promise<void>>;preparePacket():Promise<(uid:string,revision:number,files:SubmissionAttachment[],notice:SubmissionNotice,part?:MailPart)=>Promise<void>>}
export class GraphApplicationTransport extends GraphVerificationTransport implements ApplicationTransport {
 async prepareSummary(){
  const token=await this.prepareToken();
  return async(uid:string,notice:SubmissionNotice)=>{
   const payload=applicationMailPayload(uid,1,[{name:'summary.pdf',bytes:Buffer.from('%PDF-summary-placeholder')}],notice);
   payload.message.subject='Caregiver application submitted — insurance election';
   payload.message.body.content=payload.message.body.content.split('\n\n')[0]+'\n\nThe application was received. Its attachment packet is waiting for document security review or staff handling. Review the secure record: https://pthhs.net/workforce#applications?record='+encodeURIComponent(uid)+'&source=portal&tab=documents';
   payload.message.attachments=[];
   const response=await this.request('https://graph.microsoft.com/v1.0/users/jnwokorie%40pthhs.net/sendMail',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(response.status!==202)throw Error('mail_dispatch_unconfirmed');
  };
 }
 async preparePacket(){
  const token=await this.prepareToken();
  return async(uid:string,revision:number,files:SubmissionAttachment[],notice:SubmissionNotice,part?:MailPart)=>{
   const response=await this.request('https://graph.microsoft.com/v1.0/users/jnwokorie%40pthhs.net/sendMail',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(applicationMailPayload(uid,revision,files,notice,part))});
   if(response.status!==202)throw Error('mail_dispatch_unconfirmed');
  };
 }
}

// This worker has no HTTP route. Its authority is the immutable submission job
// and fixed owner-approved recipient; it cannot accept a client destination.
export class ApplicationMail {
 constructor(private transport:ApplicationTransport,private allowed:()=>boolean,private ein:string,
  private db=getFirestore(),private store=new IntakeStore(),private auth=getAuth()){}
 private async check(id:string,job:ApplicationMailJob,lease:string){
  if(!this.allowed())throw Error('mail_release_closed');
  const [current,app,user]=await Promise.all([this.db.collection('workforceApplicationMail').doc(id).get(),this.db.collection('workforceApplications').doc(job.uid).get(),this.auth.getUser(job.uid)]);
  const value=current.data();
  if(!value||value.lease!==lease||value.status!=='building'||value.leaseUntil<=Date.now()||value.to!==PAYROLL_RECIPIENT||value.uid!==job.uid||value.revision!==job.revision
   ||app.data()?.revision!==job.revision||app.data()?.state!=='submitted'||app.data()?.office!==job.office||user.disabled||!user.emailVerified)throw Error('mail_authorization_changed');
 }
 async packet(id:string,job:ApplicationMailJob,lease:string){
  const check=()=>this.check(id,job,lease);await check();
  if(job.documents.length>7||job.documents.reduce((n,d)=>n+d.size,0)>7*8*1024*1024)throw Error('mail_packet_review_required');
  const snapshot=await this.db.collection('workforceApplications').doc(job.uid).collection('versions').doc(String(job.revision)).get();
  const application=snapshot.data() as Intake|undefined;
  if(!application||application.uid!==job.uid||application.office!==job.office||application.revision!==job.revision||application.state!=='submitted')throw Error('mail_snapshot_invalid');
  const notice=submissionNotice(application);
  const filename=(title:string)=>attachmentName(application.answers.firstName||'',application.answers.lastName||'',title);
  const files:SubmissionAttachment[]=job.eventKey?[]:[{name:filename('Employment application'),bytes:await renderApplication(application)}];
  const context=await this.store.formContext(job.uid,this.ein);
  for(const form of job.forms){
   const saved=await this.db.collection('workforceFormDrafts').doc(`${job.uid}_${form.kind}`).collection('versions').doc(String(form.revision)).get();
   const record=saved.data() as FormRecord|undefined;
   if(!record||record.uid!==job.uid||record.office!==job.office||record.kind!==form.kind||record.revision!==form.revision||record.state!=='submitted'||record.signature?.uid!==job.uid||record.sourceSha256!==form.sourceSha256)throw Error('mail_snapshot_invalid');
   await check();files.push({name:filename(FORM_TITLES[form.kind]),bytes:await renderOfficialForm(record,context)});
  }
  const labels:Record<string,string>={identity:'Photo ID',social_security:'Social Security card',insurance_card:'Health insurance card',direct_deposit:'Direct deposit form',employment_authorization:'Employment authorization',i9:'Uploaded Form I-9',w4:'Uploaded Form W-4'};
  for(const file of job.documents){
   const current=(await this.db.collection('workforcePrivateDocuments').doc(file.id).get()).data();
   if(!current||current.uid!==job.uid||current.generation!==file.generation||current.sha256!==file.sha256)throw Error('mail_snapshot_invalid');
   if(current.state==='pending_security_review')throw Error('mail_security_review_pending');
   if(current.state!=='pending_review')throw Error('mail_security_review_required');
   // Reuses generation pinning, ownership, integrity checks and KMS decryption.
   const bytes=await this.store.download(job.uid,file.id,job.uid,check);
   files.push({name:filename(labels[file.kind]||'Uploaded document'),bytes:await renderDocumentPrint(bytes)});
  }
  await check();
  return {files,notice};
 }
 private async summary(id:string,job:ApplicationMailJob,lease:string){
  if(job.eventKey||!this.transport.prepareSummary)return;
  const ref=this.db.collection('workforceApplicationMail').doc(id);
  if(['accepted','dispatching','unconfirmed'].includes((await ref.get()).data()?.summaryStatus))return;
  await this.check(id,job,lease);
  const app=(await this.db.collection('workforceApplications').doc(job.uid).collection('versions').doc(String(job.revision)).get()).data() as Intake;
  if(!app||app.uid!==job.uid||app.office!==job.office||app.revision!==job.revision||app.state!=='submitted')throw Error('mail_snapshot_invalid');
  const notice=submissionNotice(app),dispatch=await this.transport.prepareSummary();await this.check(id,job,lease);
  const claimed=await this.db.runTransaction(async tx=>{const data=(await tx.get(ref)).data();if(!this.allowed()||data?.lease!==lease||data.status!=='building'||['accepted','dispatching','unconfirmed'].includes(data.summaryStatus))return false;tx.update(ref,{summaryStatus:'dispatching'});return true;});
  if(!claimed)return;
  try{await dispatch(job.uid,notice);await ref.update({summaryStatus:'accepted'});}catch{await ref.update({summaryStatus:'unconfirmed'});}
 }
 async send(id:string){
  if(!this.allowed())return;
  const ref=this.db.collection('workforceApplicationMail').doc(id),lease=randomUUID();
  const job=await this.db.runTransaction(async tx=>{
   const data=(await tx.get(ref)).data() as ApplicationMailJob|undefined,now=Date.now();
   if(!data||!['queued','building'].includes(data.status)||Number(data.retryAt||0)>now||data.status==='building'&&Number(data.leaseUntil)>now)return null;
   if(data.to!==PAYROLL_RECIPIENT||!validId(data.uid)||!Number.isSafeInteger(data.revision)||data.eventKey&&!/^(?:form-(w4|i9|new_hire|cch)-[1-9]\d*|document-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(data.eventKey)||id!==`${data.uid}_${data.revision}${data.eventKey?'_'+data.eventKey:''}`)throw Error('mail_job_invalid');
   tx.update(ref,{status:'building',lease,leaseUntil:now+600000});return data;
  });
  if(!job)return;
  let packet:{files:SubmissionAttachment[];notice:SubmissionNotice},batches:SubmissionAttachment[][],dispatch:Awaited<ReturnType<ApplicationTransport['preparePacket']>>;
  try{packet=await this.packet(id,job,lease);batches=await splitSubmission(packet.files);for(const batch of batches)applicationMailPayload(job.uid,job.revision,batch,packet.notice);
   if(!Number.isSafeInteger(job.nextPart??0)||(job.nextPart??0)<0||(job.nextPart??0)>=batches.length)throw Error('mail_resume_invalid');
   // Stable document/page grouping prevents a resumed job from skipping a file.
   const manifest=createHash('sha256').update(JSON.stringify(batches.map(batch=>batch.map(file=>file.name)))).digest('hex');
   if(job.batchManifest&&job.batchManifest!==manifest)throw Error('mail_resume_invalid');
   await this.db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.lease!==lease||current.status!=='building')throw Error('mail_authorization_changed');tx.update(ref,{batchManifest:manifest,totalParts:batches.length});});
   dispatch=await this.transport.preparePacket();await this.check(id,job,lease);}
  catch(error){
   const reason=error instanceof Error?error.message:'';
   if(['mail_security_review_pending','mail_packet_review_required','mail_security_review_required'].includes(reason))await this.summary(id,job,lease).catch(()=>undefined);
   await this.db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.lease!==lease||current.status!=='building')return;
    const pending=['mail_security_review_pending','mail_release_closed'].includes(reason);
    tx.update(ref,{status:pending?'queued':'review_required',reason:pending?reason:reason==='mail_packet_review_required'?'packet_too_large':'preparation_failed',retryAt:Date.now()+300000,leaseUntil:0});});return;
  }
  for(let index=job.nextPart||0;index<batches.length;index++){
  await this.check(id,job,lease);
  await this.db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(!this.allowed()||current?.lease!==lease||current.status!=='building')throw Error('mail_authorization_changed');tx.update(ref,{status:'dispatching',attemptedAt:new Date().toISOString(),part:index+1,totalParts:batches.length});});
  // A timeout could mean accepted mail. Never automatically retry dispatching,
  // unconfirmed or accepted jobs, preventing duplicate sensitive attachments.
  try{await dispatch(job.uid,job.revision,batches[index]!,packet.notice,{part:index+1,total:batches.length,followup:!!job.eventKey});}
  catch{await ref.update({status:'unconfirmed',reason:'dispatch_unconfirmed'});return;}
  await ref.update({status:index===batches.length-1?'accepted':'building',nextPart:index+1,acceptedParts:index+1,acceptedAt:new Date().toISOString(),reason:null});
  }
 }
 async run(){
  if(!this.allowed())return;
  // Persist a round-robin cursor so quarantined jobs cannot starve later submissions.
  const state=this.db.collection('workforceApplicationMailState').doc('scheduler');
  const after=(await state.get()).data()?.afterId;
  const query=this.db.collection('workforceApplicationMail').where('status','in',['queued','building']).orderBy('__name__').limit(100);
  let jobs=await(typeof after==='string'&&after&&!after.includes('/')?query.startAfter(after):query).get();
  if(!jobs.docs.length&&after)jobs=await query.get();
  let processed=0;
  for(const job of jobs.docs){
   if(!this.allowed())return;
   await state.set({afterId:job.id},{merge:true});
   const data=job.data(),now=Date.now();if(Number(data.retryAt||0)>now||data.status==='building'&&Number(data.leaseUntil)>now)continue;
   try{await this.send(job.id);}catch{console.error('Application mail processing requires review.');}
   if(++processed>=10)return;
  }
 }
}
