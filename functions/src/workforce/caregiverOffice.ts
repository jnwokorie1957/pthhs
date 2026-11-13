import {dispatchLicenseReminder,ReminderSendError,reminderWindow} from './licenseReminderOutbox.js';
import {createHash,randomUUID} from 'node:crypto';
import {getFirestore,type Transaction} from 'firebase-admin/firestore';
import {parseGrant,requirePermission,validId,WorkforceError} from './policy.js';
import {expiryBucket} from './staffOperations.js';
import {chicagoDate} from './dates.js';
import {GraphVerificationTransport} from './verificationMail.js';
import type {OperationsWorkspace} from '../operations/workspace.js';

export const ID_REMINDER_RECIPIENT='irab@pthhs.net';
export function licenseDate(value:unknown):string {
 if(value==='')return '';
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new WorkforceError(400,'invalid_license_date');
 return value;
}
export class CaregiverOffice {
 constructor(private db=getFirestore()){}
 private async resolve(tx:Transaction,uid:string,source:string,id:string,hr=false){
  if(!['portal','hhaexchange'].includes(source)||!validId(id)||source==='hhaexchange'&&!/^[1-9]\d{0,9}$/.test(id))throw new WorkforceError(400,'invalid_request');
  const grantDoc=await tx.get(this.db.collection('workforceStaff').doc(uid));
  if(!grantDoc.exists)throw new WorkforceError(403,'workforce_forbidden');
  const actor={uid,grant:parseGrant(grantDoc.data())};
  let hhaId=source==='hhaexchange'?id:null;
  if(source==='portal'){
   const link=(await tx.get(this.db.collection('workforceHhaLinks').doc(id))).data();
   if(link&&typeof link.caregiverId==='string')hhaId=link.caregiverId;
  }
  const profile=hhaId?(await tx.get(this.db.collection('workforceHhaProfiles').doc(hhaId))).data():undefined;
  const app=!hhaId?(await tx.get(this.db.collection('workforceApplications').doc(id))).data():undefined;
  const office=profile?.office||app?.office;
  if(!office)throw new WorkforceError(404,'caregiver_account_unavailable');
  requirePermission(actor,'accounts.support',office);if(hr)requirePermission(actor,'hr.expirations',office);
  return {office,key:(hhaId?'hhaexchange-':'portal-')+(hhaId||id),source:hhaId?'hhaexchange':'portal',id:hhaId||id,hhaId,name:profile?[profile.firstName,profile.lastName].filter(Boolean).join(' '):[app?.answers?.firstName,app?.answers?.lastName].filter(Boolean).join(' ')};
 }
 async license(uid:string,source:string,id:string,input?:any){
  return this.db.runTransaction(async tx=>{
   const target=await this.resolve(tx,uid,source,id,true),ref=this.db.collection('workforceCaregiverLicenses').doc(target.key),prior=(await tx.get(ref)).data();
   if(input===undefined)return {date:prior?.date||'',revision:prior?.revision||0,updatedAt:prior?.updatedAt||null};
   if(!input||Object.keys(input).some(k=>!['date','revision'].includes(k))||!Number.isSafeInteger(input.revision)||input.revision!==(prior?.revision||0))throw new WorkforceError(409,'revision_conflict');
   const date=licenseDate(input.date),value={...target,date,revision:input.revision+1,updatedAt:new Date().toISOString(),updatedBy:uid};
   tx.set(ref,value);tx.create(this.db.collection('workforcePersonnelAudit').doc(randomUUID()),{actor:uid,action:'caregiver_license_expiration_saved',target:target.key,office:target.office,at:value.updatedAt});
   return {date,revision:value.revision,updatedAt:value.updatedAt};
  });
 }
 async alerts(uid:string,office:string){
  if(!validId(office))throw new WorkforceError(400,'invalid_request');
  return this.db.runTransaction(async tx=>{
   const grant=(await tx.get(this.db.collection('workforceStaff').doc(uid))).data();if(!grant)throw new WorkforceError(403,'workforce_forbidden');
   requirePermission({uid,grant:parseGrant(grant)},'hr.expirations',office);
   const rows=await tx.get(this.db.collection('workforceCaregiverLicenses').where('office','==',office));
   const items=rows.docs.map(doc=>doc.data()).filter(row=>row.date&&expiryBucket(row.date).days<=30).map(row=>({source:row.source,id:row.id,name:row.name,date:row.date,...expiryBucket(row.date)})).sort((a,b)=>a.date.localeCompare(b.date));
   const today=chicagoDate(new Date()),mail=(await tx.get(this.db.collection('workforceLicenseReminderMail').doc(today))).data();
   return {items,today,emailRecipient:ID_REMINDER_RECIPIENT,mailStatus:mail?.status||'not_needed',mailAttemptAt:mail?.at||null};
  });
 }
 async schedule(uid:string,source:string,id:string,workspace:Pick<OperationsWorkspace,'settings'|'query'>,after?:string){
  const target=await this.db.runTransaction(tx=>this.resolve(tx,uid,source,id));
  if(!target.hhaId)return {items:[],linked:false,next:null};
  const settings=(await workspace.settings()).settings;
  if(settings.officeId!==target.office)throw new WorkforceError(403,'workforce_forbidden');
  const from=chicagoDate(new Date()),to=new Date(Date.parse(from)+6*86400000).toISOString().slice(0,10);
  const found=await workspace.query({operation:'SearchVisitsV2',officeId:target.office,caregiverId:target.hhaId,fromDate:from,toDate:to},uid,'visit_discovery');
  if(found.source!=='hhaexchange'||found.operation!=='SearchVisitsV2'||found.truncated)throw new WorkforceError(503,'caregiver_schedule_unavailable');
  const ids=[...new Set(found.records.map(row=>row.VisitID))];
  if(ids.some(value=>typeof value!=='string'||!/^\d{1,10}$/.test(value)))throw new WorkforceError(503,'caregiver_schedule_unavailable');
  if(after!==undefined&&!ids.includes(after))throw new WorkforceError(409,'schedule_changed_reload');
  const offset=after?ids.indexOf(after)+1:0,selected=ids.slice(offset,offset+3),items=[];
  for(const visit of selected){
   const result=await workspace.query({operation:'GetScheduleInfo',id:visit!},uid);
   const row=result.records[0];
   if(result.source!=='hhaexchange'||result.operation!=='GetScheduleInfo'||result.truncated||result.records.length!==1||!row||row.ID!==visit||row['Caregiver/ID']!==target.hhaId)throw new WorkforceError(503,'caregiver_schedule_unavailable');
   items.push({id:visit,memberId:row['Patient/ID'],date:row.VisitDate,start:row.ScheduleStartTime,end:row.ScheduleEndTime});
  }
  const current=await this.db.runTransaction(tx=>this.resolve(tx,uid,source,id));
  if(current.key!==target.key||current.office!==target.office||(await workspace.settings()).settings.revision!==settings.revision)throw new WorkforceError(409,'revision_conflict');
  return {items,linked:true,from,to,total:ids.length,next:offset+selected.length<ids.length?selected.at(-1):null,checkedAt:new Date().toISOString()};
 }
}
export function licenseReminderPayload(count:number){
 if(!Number.isSafeInteger(count)||count<1)throw Error('invalid_reminder_count');
 return {message:{subject:'Caregiver ID expiration reminder',body:{contentType:'Text',content:`${count} caregiver ID expiration date${count===1?' is':'s are'} expired or due within 30 days. Review the HR alerts in the secure staff portal and update the date after reviewing a renewed ID.\n\nhttps://pthhs.net/workforce#overview\n\nNo identity documents or ID numbers are included in this email.`},toRecipients:[{emailAddress:{address:ID_REMINDER_RECIPIENT}}]},saveToSentItems:false};
}
export class GraphLicenseReminder extends GraphVerificationTransport {
 async prepareReminder(){const token=await this.prepareToken();return async(count:number)=>{const result=await this.request('https://graph.microsoft.com/v1.0/users/jnwokorie%40pthhs.net/sendMail',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(licenseReminderPayload(count))});if(result.status!==202){const retry=result.status===429||result.status===401,permanent=result.status>=400&&result.status<500&&!retry;throw new ReminderSendError(retry||permanent,permanent,Number(result.headers.get('retry-after'))||900);}};}
}
export async function sendLicenseReminders(transport:Pick<GraphLicenseReminder,'prepareReminder'>,db=getFirestore()){
 const today=chicagoDate(new Date()),rows=await db.collection('workforceCaregiverLicenses').get();
 const due=rows.docs.filter(doc=>{const date=doc.data().date;return date&&expiryBucket(date,today).days<=30;});
 if(!due.length)return;
 if(!reminderWindow())return;
 await dispatchLicenseReminder(transport,due.length,createHash('sha256').update(due.map(doc=>doc.id+':'+doc.data().revision).sort().join('|')).digest('hex'),ID_REMINDER_RECIPIENT,db);
}
