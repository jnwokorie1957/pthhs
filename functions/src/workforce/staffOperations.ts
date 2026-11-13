import {randomUUID, createHash} from 'node:crypto';
import {getFirestore, type Transaction} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {FORM_BUCKET} from '../forms/library.js';
import {parseGrant, requirePermission, validId, WorkforceError, type Actor, type Permission} from './policy.js';
import {kmsDocumentCipher, type DocumentCipher, type DocumentEnvelope} from './documentEncryption.js';
import {chicagoDate} from './dates.js';
import type {Intake} from './intake.js';

export const hiringFields = ['firstName','lastName','email','phone','alternatePhone','city','state','zip','availableDate','workTime','weeklyHours','jobDescriptionQuestions','college_major','college_degree','technical_school','job1_from','job1_to','job1_employer','job1_position','job1_department','job1_duties'] as const;
export function hiringApplication(app: Intake) {
 return {uid:app.uid,office:app.office,state:app.state,updatedAt:app.updatedAt,submittedAt:app.submittedAt||null,
  answers:Object.fromEntries(hiringFields.filter(k=>typeof app.answers[k]==='string').map(k=>[k,app.answers[k]]))};
}
export function employmentStatus(profile: Record<string,any>|undefined, office:string, now=Date.now(), verifiedAt?:string) {
 if(!profile||profile.office!==office)return 'applicant';
 const age=now-Math.max(Date.parse(profile.fetchedAt)||0,Date.parse(verifiedAt||'')||0);
 if(!Number.isFinite(age)||age<0||age>=96*3600000)return 'needs_verification';
 const type=String(profile.fields?.EmployeeType||'').toLowerCase();
 if(type==='applicant')return 'applicant';
 return profile.status==='Active'&&['employee','caregiver'].includes(type)?'employee':'needs_verification';
}
const dateValid=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function expiryBucket(end:string,today=chicagoDate(new Date())):{days:number;bucket:'expired'|'within15'|'within30'|'current'} {
 if(!dateValid(end)||!dateValid(today))throw new WorkforceError(400,'invalid_authorization_date');
 const days=Math.round((Date.parse(end)-Date.parse(today))/86400000);
 return {days,bucket:days<0?'expired':days<=15?'within15':days<=30?'within30':'current'};
}
const textFields={clientName:160,memberId:100,payer:160,authorizationNumber:100,services:2000,units:160,notes:2000} as const;
export function authorizationDetails(input:any) {
 if(!input||typeof input!=='object'||Array.isArray(input)||input.reviewed!==true||!validId(input.office))throw new WorkforceError(400,'authorization_review_required');
 if(!dateValid(input.startDate)||!dateValid(input.endDate)||input.endDate<input.startDate)throw new WorkforceError(400,'invalid_authorization_date');
 const fields:Record<string,string>={office:input.office,startDate:input.startDate,endDate:input.endDate};
 for(const [key,max]of Object.entries(textFields)){const value=input[key];if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new WorkforceError(400,'invalid_authorization_details');fields[key]=value.trim();}
 if(['clientName','memberId','payer','authorizationNumber','services'].some(k=>!fields[k]))throw new WorkforceError(400,'authorization_details_required');
 return fields;
}
export const renewalStates=['not_started','requested','payer_followup','renewed','closed'] as const;
type AuthRecord=Record<string,any>;
const summary=(id:string,data:AuthRecord)=>({id,...Object.fromEntries(['office','clientName','memberId','payer','authorizationNumber','services','units','notes','startDate','endDate','renewalStatus','followupDate','renewalNote','revision','updatedAt','createdAt','reviewedBy','replaces'].map(k=>[k,data[k]??null])),...expiryBucket(data.endDate)});
export class StaffOperations {
 constructor(private db=getFirestore(),private bucket=getStorage().bucket(FORM_BUCKET),private cipherFactory:()=>DocumentCipher=kmsDocumentCipher){}
 private async actor(tx:Transaction,uid:string,permission:Permission,office?:string){
  const snap=await tx.get(this.db.collection('workforceStaff').doc(uid));
  if(!snap.exists)throw new WorkforceError(403,'workforce_forbidden');
  const actor:Actor={uid,grant:parseGrant(snap.data())};requirePermission(actor,permission,office);return actor;
 }
 private audit(tx:Transaction,uid:string,action:string,target:string,office:string){tx.create(this.db.collection('workforcePersonnelAudit').doc(randomUUID()),{actor:uid,action,target,office,at:new Date().toISOString()});}
 async applicants(uid:string,office:string,after?:string){
  if(!validId(office)||after!==undefined&&!validId(after))throw new WorkforceError(400,'invalid_request');
  return this.db.runTransaction(async tx=>{
   await this.actor(tx,uid,'applicants.review',office);
   let query=this.db.collection('workforceApplications').where('office','==',office).where('state','==','submitted').orderBy('__name__').limit(51);
   if(after)query=query.startAfter(after);
   const rows=await tx.get(query),items=[];const synced=(await tx.get(this.db.collection('workforceCaregiverSync').doc(office))).data()?.lastCompletedAt;
   for(const row of rows.docs.slice(0,50)){
    const app=row.data() as Intake,job=(await tx.get(this.db.collection('workforceOnboardingJobs').doc(row.id))).data();
    const link=(await tx.get(this.db.collection('workforceHhaLinks').doc(row.id))).data();
    const id=link?.office===office?link.caregiverId:job?.hha?.caregiverId;
    const profile=typeof id==='string'&&/^\d{1,10}$/.test(id)?(await tx.get(this.db.collection('workforceHhaProfiles').doc(id))).data():undefined;
    const safe=hiringApplication(app);items.push({...safe,employmentStatus:id&&!profile?'needs_verification':employmentStatus(profile,office,Date.now(),synced),hhaId:profile?.office===office?id:null,sourceUpdatedAt:profile?.office===office?profile.fetchedAt:null});
   }
   this.audit(tx,uid,'applicant_hiring_list_read',office,office);
   return {items,next:rows.docs.length>50?rows.docs[49]!.id:null,office};
  });
 }
 async list(uid:string,office:string,after?:string){
  if(!validId(office)||after!==undefined&&!validId(after))throw new WorkforceError(400,'invalid_request');
  return this.db.runTransaction(async tx=>{
   await this.actor(tx,uid,'authorizations.manage',office);
   let query=this.db.collection('workforceAuthorizations').where('office','==',office).orderBy('__name__').limit(101);if(after)query=query.startAfter(after);
   const rows=await tx.get(query);const items=rows.docs.slice(0,100).filter(r=>r.data().state==='ready').map(r=>summary(r.id,r.data()));
   this.audit(tx,uid,'authorizations_read',office,office);return {items,next:rows.docs.length>100?rows.docs[99]!.id:null,today:chicagoDate(new Date()),office};
  });
 }
 async expirationSummary(uid:string,office?:string){
  if(office!==undefined&&!validId(office))throw new WorkforceError(400,'invalid_request');
  return this.db.runTransaction(async tx=>{
   const actor=await this.actor(tx,uid,'authorizations.manage',office),offices=office?[office]:actor.grant.offices;
   const counts={expired:0,within15:0,within30:0,current:0},today=chicagoDate(new Date());let total=0;
   for(const selected of offices){
    let cursor:string|undefined;
    do{let query=this.db.collection('workforceAuthorizations').where('office','==',selected).orderBy('__name__').select('state','endDate','renewalStatus').limit(1000);if(cursor)query=query.startAfter(cursor);
     const page=await tx.get(query);for(const doc of page.docs){const row=doc.data();if(row.state!=='ready')continue;total++;if(!['renewed','closed'].includes(row.renewalStatus))counts[expiryBucket(row.endDate,today).bucket]++;}
     cursor=page.docs.length===1000?page.docs.at(-1)!.id:undefined;
    }while(cursor);
   }
   this.audit(tx,uid,'authorization_expiration_summary_read',office||'assigned-offices',office||'assigned-offices');return {counts,total,today,offices};
  });
 }
 async upload(uid:string,input:any){
  const details=authorizationDetails(input?.details),office=details.office!;
  if(!Array.isArray(input.pages)||!input.pages.length||input.pages.length>12)throw new WorkforceError(400,'authorization_page_limit');
  if(input.pages.some((p:unknown)=>typeof p!=='string')||input.pages.reduce((n:number,p:string)=>n+p.length,0)>12_000_000)throw new WorkforceError(413,'authorization_file_too_large');
  const source=typeof input.source==='string'?Buffer.from(input.source,'base64'):Buffer.alloc(0);
  if(!source.length||source.length>8*1024*1024||source.toString('base64')!==input.source)throw new WorkforceError(400,'invalid_document_size');
  const id=createHash('sha256').update(office+'\n').update(source).digest('hex');
  const replaces=input.replaces||null;if(replaces!==null&&!validId(replaces))throw new WorkforceError(400,'invalid_request');
  await this.db.runTransaction(tx=>this.actor(tx,uid,'authorizations.manage',office));
  // Store the original encrypted; only an image-only copy is served to reviewers.
  const pdf=await PDFDocument.create();
  for(const encoded of input.pages){
   const bytes=Buffer.from(encoded,'base64');if(bytes.toString('base64')!==encoded||bytes.length>2_000_000)throw new WorkforceError(400,'invalid_page_image');
   const jpg=await sharp(bytes,{limitInputPixels:12_000_000}).rotate().flatten({background:'#fff'}).jpeg({quality:85}).toBuffer();
   const image=await pdf.embedJpg(jpg),page=pdf.addPage([image.width,image.height]);page.drawImage(image,{x:0,y:0,width:image.width,height:image.height});
  }
  const preview=Buffer.from(await pdf.save()),cipher=this.cipherFactory(),attempt=randomUUID(),base='workforce-authorizations/'+office+'/'+id+'/'+attempt;
  const ref=this.db.collection('workforceAuthorizations').doc(id),hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  await this.db.runTransaction(async tx=>{
   await this.actor(tx,uid,'authorizations.manage',office);
   const prior=(await tx.get(ref)).data(),now=Date.now();
   if(prior?.state==='ready')throw new WorkforceError(409,'authorization_already_uploaded');
   if(prior?.state==='uploading'&&Number(prior.leaseUntil||Date.parse(prior.createdAt)+600000)>now)throw new WorkforceError(409,'authorization_upload_in_progress');
   if(prior&&!['uploading','upload_failed'].includes(prior.state))throw new WorkforceError(409,'authorization_already_uploaded');
   const limit=this.db.collection('workforceAuthorizationUploadLimits').doc(uid),previous=(await tx.get(limit)).data();
   const count=previous&&previous.since>now-3600000?Number(previous.count||0):0;if(count>=30)throw new WorkforceError(429,'upload_limit_reached');
   tx.set(limit,{since:count?previous!.since:now,count:count+1});
   tx.set(ref,{...details,state:'uploading',attempt,leaseUntil:now+600000,createdAt:prior?.createdAt||new Date(now).toISOString(),createdBy:prior?.createdBy||uid});
  });
  try{
   const objects:Record<string,any>={};
   for(const [kind,bytes]of [['source',source],['preview',preview]] as const){
    const path=base+'/'+kind+'.enc',encrypted=await cipher.encrypt(bytes,path),file=this.bucket.file(path);
    await file.save(encrypted.bytes,{resumable:false,validation:'crc32c',preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:'application/octet-stream',cacheControl:'private, no-store'}});
    const [metadata]=await file.getMetadata();if(!metadata.generation)throw Error('generation_missing');
    objects[kind]={path,generation:String(metadata.generation),envelope:encrypted.envelope,sha256:hash(bytes),storedSha256:hash(encrypted.bytes)};
   }
   await this.db.runTransaction(async tx=>{
    await this.actor(tx,uid,'authorizations.manage',office);
    const upload=(await tx.get(ref)).data();if(upload?.attempt!==attempt||upload.state!=='uploading')throw new WorkforceError(409,'authorization_upload_superseded');
    let prior:AuthRecord|undefined;if(replaces){prior=(await tx.get(this.db.collection('workforceAuthorizations').doc(replaces))).data();if(!prior||prior.office!==office||prior.memberId!==details.memberId||prior.payer!==details.payer)throw new WorkforceError(409,'renewal_client_or_payer_mismatch');}
    const now=new Date().toISOString();tx.update(ref,{...objects,state:'ready',leaseUntil:0,revision:1,reviewedBy:uid,updatedAt:now,renewalStatus:'not_started',followupDate:'',renewalNote:'',replaces});
    if(replaces)tx.update(this.db.collection('workforceAuthorizations').doc(replaces),{renewalStatus:'renewed',renewedBy:id,revision:Number(prior!.revision)+1,updatedAt:now});
    this.audit(tx,uid,'authorization_uploaded',id,office);
   });return {id};
  }catch(error){await this.db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.attempt===attempt&&current.state==='uploading')tx.update(ref,{state:'upload_failed',leaseUntil:0});});throw error;}
 }
 async renewal(uid:string,id:string,input:any){
  if(!validId(id)||!renewalStates.includes(input?.status)||!Number.isSafeInteger(input?.revision)||typeof input?.note!=='string'||input.note.length>2000||(input.followupDate!==''&&!dateValid(input.followupDate)))throw new WorkforceError(400,'invalid_renewal');
  if(input.status==='renewed')throw new WorkforceError(400,'upload_renewal_document_required');
  return this.db.runTransaction(async tx=>{
   const ref=this.db.collection('workforceAuthorizations').doc(id),row=await tx.get(ref),data=row.data();if(!data||data.state!=='ready')throw new WorkforceError(404,'authorization_not_found');
   await this.actor(tx,uid,'authorizations.manage',data.office);if(data.revision!==input.revision)throw new WorkforceError(409,'authorization_changed_reload');
   const updated={renewalStatus:input.status,renewalNote:input.note,followupDate:input.followupDate,revision:data.revision+1,updatedAt:new Date().toISOString()};tx.update(ref,updated);this.audit(tx,uid,'authorization_followup_updated',id,data.office);return summary(id,{...data,...updated});
  });
 }
 async document(uid:string,id:string){
  if(!validId(id))throw new WorkforceError(400,'invalid_request');
  const access=()=>this.db.runTransaction(async tx=>{const row=await tx.get(this.db.collection('workforceAuthorizations').doc(id)),data=row.data();if(!data||data.state!=='ready')throw new WorkforceError(404,'authorization_not_found');await this.actor(tx,uid,'authorizations.manage',data.office);this.audit(tx,uid,'authorization_document_read',id,data.office);return data.preview;});
  const saved=await access(),[stored]=await this.bucket.file(saved.path,{generation:saved.generation}).download();
  if(createHash('sha256').update(stored).digest('hex')!==saved.storedSha256)throw new WorkforceError(503,'document_integrity_error');
  const bytes=await this.cipherFactory().decrypt(stored,saved.envelope as DocumentEnvelope,saved.path);if(createHash('sha256').update(bytes).digest('hex')!==saved.sha256)throw new WorkforceError(503,'document_integrity_error');await access();return bytes;
 }
}
