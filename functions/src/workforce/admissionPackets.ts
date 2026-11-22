import {createHash,randomBytes,randomInt} from 'node:crypto';
import {getFirestore} from 'firebase-admin/firestore';
import {PDFDocument} from 'pdf-lib';
import {FieldVisits,pendingVisitSigners} from './fieldVisits.js';
import {staffRouteReleased} from './staffRelease.js';
import {parseGrant,requirePermission,validId,WorkforceError} from './policy.js';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const memberKey=(office:string,memberId:string)=>createHash('sha256').update(JSON.stringify([office,memberId])).digest('hex');
export class AdmissionPackets{
 constructor(private db=getFirestore(),private visits:Pick<FieldVisits,'pdf'> & Partial<Pick<FieldVisits,'get'>>=new FieldVisits()){}
 private async read(tx:any,uid:string,id:string){
  if(!validId(id))throw new WorkforceError(400,'invalid_request');const row=(await tx.get(this.db.collection('workforceAdmissionPackets').doc(id))).data();if(!row)throw new WorkforceError(404,'admission_packet_not_found');
  const grant=(await tx.get(this.db.collection('workforceStaff').doc(uid))).data();if(!grant)throw new WorkforceError(403,'workforce_forbidden');requirePermission({uid,grant:parseGrant(grant)},'field_visits.manage',row.office);
  const items=[];for(const documentId of row.documentIds){const document=(await tx.get(this.db.collection('workforceFieldVisits').doc(documentId))).data();if(!document||document.office!==row.office||document.memberId!==row.memberId)throw new WorkforceError(409,'admission_packet_changed');items.push({id:documentId,title:document.title||'Client form',state:document.state,revision:document.revision,templateId:document.templateId,kind:document.kind,pendingSigners:document.pendingSigners});}
  return {id,office:row.office,memberId:row.memberId,clientName:row.clientName,createdAt:row.createdAt,createdBy:row.createdBy,items,completed:items.length>0&&items.every(item=>item.state==='signed')};
 }
 async create(uid:string,id:string,input:any){
  if(!validId(id)||!validId(input?.office)||typeof input.memberId!=='string'||!input.memberId.trim()||input.memberId.length>100||typeof input.clientName!=='string'||!input.clientName.trim()||input.clientName.length>160||!Array.isArray(input.documentIds)||!input.documentIds.length||input.documentIds.length>20||!input.documentIds.every(validId)||new Set(input.documentIds).size!==input.documentIds.length)throw new WorkforceError(400,'invalid_admission_packet');
  await this.db.runTransaction(async tx=>{const ref=this.db.collection('workforceAdmissionPackets').doc(id),prior=(await tx.get(ref)).data(),grant=(await tx.get(this.db.collection('workforceStaff').doc(uid))).data();if(!grant)throw new WorkforceError(403,'workforce_forbidden');requirePermission({uid,grant:parseGrant(grant)},'field_visits.manage',input.office);
   if(prior){if(prior.office!==input.office||prior.memberId!==input.memberId||JSON.stringify(prior.documentIds)!==JSON.stringify(input.documentIds))throw new WorkforceError(409,'admission_packet_changed');return;}
   for(const documentId of input.documentIds){const document=(await tx.get(this.db.collection('workforceFieldVisits').doc(documentId))).data();if(!document||document.office!==input.office||document.memberId!==input.memberId||document.clientName!==input.clientName)throw new WorkforceError(409,'admission_packet_changed');}
   tx.create(this.db.collection('workforceAdmissionMembers').doc(memberKey(input.office,input.memberId)).collection('packets').doc(id),{id});tx.create(ref,{office:input.office,memberId:input.memberId,clientName:input.clientName,documentIds:input.documentIds,createdBy:uid,createdAt:new Date().toISOString()});tx.create(this.db.collection('workforcePersonnelAudit').doc(),{actor:uid,action:'admission_packet_created',target:id,office:input.office,at:new Date().toISOString()});
  });return this.get(uid,id);
 }
 async get(uid:string,id:string){
  const packet=await this.db.runTransaction(tx=>this.read(tx,uid,id));
  for(const item of packet.items){
   if(item.state!=='signed'&&!item.pendingSigners&&this.visits.get){
    const record=await this.visits.get(uid,item.id);
    if(record.office!==packet.office||record.memberId!==packet.memberId||record.revision!==item.revision)throw new WorkforceError(409,'admission_packet_changed');
    item.pendingSigners=pendingVisitSigners(record.data);
   }
  }
  return packet;
 }
 async list(uid:string,office:string,memberId:string,after?:string){if(!validId(office)||typeof memberId!=='string'||!memberId.trim()||memberId.length>100||after!==undefined&&!validId(after))throw new WorkforceError(400,'invalid_request');return this.db.runTransaction(async tx=>{const grant=(await tx.get(this.db.collection('workforceStaff').doc(uid))).data();if(!grant)throw new WorkforceError(403,'workforce_forbidden');requirePermission({uid,grant:parseGrant(grant)},'field_visits.manage',office);let query=this.db.collection('workforceAdmissionMembers').doc(memberKey(office,memberId)).collection('packets').orderBy('__name__').limit(51);if(after)query=query.startAfter(after);const result=await tx.get(query),items=[];for(const doc of result.docs.slice(0,50)){const packet=await this.read(tx,uid,doc.id);if(packet.office!==office||packet.memberId!==memberId)throw new WorkforceError(409,'admission_packet_changed');items.push(packet);}return {items,next:result.docs.length>50?result.docs[49]!.id:null};});}
 async share(uid:string,id:string,channel:unknown){
  if(channel!=='email'&&channel!=='sms')throw new WorkforceError(400,'invalid_request');
  const token=randomBytes(32).toString('base64url'),code=String(randomInt(1_000_000)).padStart(6,'0');
  const expiresAt=new Date(Date.now()+48*3600_000);
  const initial=await this.db.runTransaction(tx=>this.read(tx,uid,id));
  if(!initial.completed)throw new WorkforceError(409,'form_not_complete');
  for(const item of initial.items){
   if(item.kind!=='upload')throw new WorkforceError(409,'admission_forms_only');
   // Older signed records kept the template identity inside the encrypted payload.
   if(!item.templateId){
    const record=await this.visits.get?.(uid,item.id);
    if(!record?.data.templateId||record.revision!==item.revision)throw new WorkforceError(409,'admission_forms_only');
   }
  }
  await this.db.runTransaction(async tx=>{
   const packet=await this.read(tx,uid,id);
   if(!packet.completed)throw new WorkforceError(409,'form_not_complete');
   if(JSON.stringify(packet.items)!==JSON.stringify(initial.items))throw new WorkforceError(409,'admission_packet_changed');
   tx.create(this.db.collection('workforceAdmissionShares').doc(digest(token)),{packetId:id,issuedBy:uid,codeHash:digest(token+':'+code),expiresAt:expiresAt.toISOString(),tries:0,channel});
   tx.create(this.db.collection('workforcePersonnelAudit').doc(),{actor:uid,action:'admission_packet_share_created',target:id,office:packet.office,channel,at:new Date().toISOString()});
  });
  return {token,code,expiresAt:expiresAt.toISOString()};
 }
 async sharedPdf(token:unknown,code:unknown){
  const unavailable=()=>new WorkforceError(403,'admission_copy_unavailable');
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||typeof code!=='string'||!/^\d{6}$/.test(code))throw unavailable();
  const grant=await this.db.runTransaction(async tx=>{
   const ref=this.db.collection('workforceAdmissionShares').doc(digest(token)),share=(await tx.get(ref)).data();
   if(!share||Date.parse(share.expiresAt)<=Date.now()||share.tries>=5)return null;
   if(digest(token+':'+code)!==share.codeHash){tx.update(ref,{tries:share.tries+1});return null;}
   const actor=(await tx.get(this.db.collection('workforceStaff').doc(share.issuedBy))).data();
   if(!actor||!staffRouteReleased({uid:share.issuedBy,grant:parseGrant(actor)},'/staff/admission-packets/'+share.packetId))return null;
   return {uid:String(share.issuedBy),id:String(share.packetId)};
  });
  if(!grant)throw unavailable();
  const bytes=await this.pdf(grant.uid,grant.id);
  await this.db.collection('workforcePersonnelAudit').add({action:'admission_packet_copy_opened',target:grant.id,issuedBy:grant.uid,at:new Date().toISOString()});
  return bytes;
 }
 async pdf(uid:string,id:string){const packet=await this.get(uid,id);if(!packet.completed)throw new WorkforceError(409,'form_not_complete');const combined=await PDFDocument.create();let size=0;for(const item of packet.items){const bytes=await this.visits.pdf(uid,item.id);size+=bytes.length;if(size>20_000_000)throw new WorkforceError(413,'admission_packet_export_limit');const pdf=await PDFDocument.load(bytes);if(combined.getPageCount()+pdf.getPageCount()>100)throw new WorkforceError(413,'admission_packet_export_limit');const pages=await combined.copyPages(pdf,pdf.getPageIndices());for(const page of pages)combined.addPage(page);}const latest=await this.get(uid,id);if(!latest.completed||JSON.stringify(latest.items)!==JSON.stringify(packet.items))throw new WorkforceError(409,'admission_packet_changed');await this.db.collection('workforcePersonnelAudit').add({actor:uid,action:'admission_packet_exported',target:id,office:packet.office,at:new Date().toISOString()});return Buffer.from(await combined.save());}
}
