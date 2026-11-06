import {createHash,randomUUID} from "node:crypto";
import {getAuth,type Auth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {parseGrant,requirePermission,WorkforceError,type Actor} from "./policy.js";
import type {HhaProfile,HhaProfileSource} from "./hhaSource.js";

const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function hhaEmail(value:unknown){if(typeof value!=="string"||value.length>254||!/^\S+@\S+\.\S+$/.test(value.trim()))throw new WorkforceError(400,"invalid_account_email");return value.trim().toLowerCase();}
type Source=(office:string,actorId:string)=>Pick<HhaProfileSource,"profile"|"discover"|"documents"|"download">;
export class HhaEnrollment {
 constructor(private source:Source,private office:string,private sendReset:(email:string)=>Promise<void>,private db=getFirestore(),private auth:Auth=getAuth()){}
 private async staff(actor:Actor){const doc=await this.db.collection("workforceStaff").doc(actor.uid).get();if(!doc.exists)throw new WorkforceError(403,"workforce_forbidden");const current={uid:actor.uid,grant:parseGrant(doc.data())};requirePermission(current,"accounts.support",this.office);return current;}
 async inspect(actor:Actor,id:string){await this.staff(actor);const profile=await this.source(this.office,actor.uid).profile(id);await this.staff(actor);return profile;}
 async stage(actor:Actor,id:string){
  await this.staff(actor);const profile=await this.source(this.office,actor.uid).profile(id);
  await this.db.runTransaction(async tx=>{const grant=await tx.get(this.db.collection("workforceStaff").doc(actor.uid));if(!grant.exists)throw new WorkforceError(403,"workforce_forbidden");requirePermission({uid:actor.uid,grant:parseGrant(grant.data())},"accounts.support",profile.office);
   let emailKey="";try{emailKey=hash(hhaEmail(profile.email));}catch{/* Missing source email remains a visible review condition. */}
   tx.set(this.db.collection("workforceHhaProfiles").doc(id),{...profile,emailKey});tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()),{actor:actor.uid,target:id,action:"hha_profile_synchronized",at:new Date().toISOString(),office:profile.office});
  });return profile;
 }
 async sync(actor:Actor,jobId?:string){
  const current=await this.staff(actor);requirePermission(current,"staff.manage",this.office);
  if(!jobId){const found=await this.source(this.office,actor.uid).discover();jobId=randomUUID();await this.db.collection("workforceHhaImports").doc(jobId).create({office:this.office,ids:found.ids,offset:0,revision:found.revision,createdAt:new Date().toISOString()});}
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(jobId))throw new WorkforceError(400,"invalid_request");
  const ref=this.db.collection("workforceHhaImports").doc(jobId),lease=randomUUID(),job=await this.db.runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists||doc.data()!.office!==this.office)throw new WorkforceError(404,"import_not_found");const data=doc.data()!;if(data.leaseUntil>Date.now())throw new WorkforceError(409,"import_in_progress");tx.update(ref,{leaseUntil:Date.now()+90000,lease});return data;});
  let offset=Number(job.offset),deferred=false;
  try{for(let count=0;count<3&&offset<job.ids.length;count++){
   const id=job.ids[offset];try{await this.stage(actor,id);}catch(error){if(error instanceof WorkforceError&&error.code==="hha_office_mismatch"){offset++;continue;}throw error;}offset++;
  }}catch{deferred=true;}
  finally{await this.db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.data()?.lease!==lease)throw new WorkforceError(409,"revision_conflict");tx.update(ref,{offset,leaseUntil:0});});}
  await this.staff(actor);if(offset===job.ids.length)await this.db.collection("workforceHhaRosterReady").doc(this.office).set({office:this.office,completedAt:new Date().toISOString(),total:job.ids.length});return {jobId,processed:offset,total:job.ids.length,complete:offset===job.ids.length,deferred};
 }
 private async match(email:string){const ready=await this.db.collection("workforceHhaRosterReady").doc(this.office).get();if(!ready.exists||ready.data()?.office!==this.office||typeof ready.data()?.completedAt!=="string")return null;const query=await this.db.collection("workforceHhaProfiles").where("emailKey","==",hash(email)).limit(2).get();if(query.docs.length!==1)return null;const profile=query.docs[0]!.data() as HhaProfile;if(profile.office!==this.office)return null;return profile;}
 async requestAccess(input:unknown,network:string){
  const email=hhaEmail(input),emailKey=hash(email),networkKey=hash(network||"unknown");
  try{
   await this.db.runTransaction(async tx=>{
    const refs=[this.db.collection("workforceHhaAccessLimits").doc("email-"+emailKey),this.db.collection("workforceHhaAccessLimits").doc("network-"+networkKey)],docs=await Promise.all(refs.map(ref=>tx.get(ref))),now=Date.now();
    const counts=docs.map(doc=>now-Number(doc.data()?.start||0)<3600000?Number(doc.data()?.count||0):0);if(counts[0]!>=3||counts[1]!>=20)throw new WorkforceError(429,"account_reset_limit");
    refs.forEach((ref,i)=>tx.set(ref,{start:counts[i]?docs[i]!.data()!.start:now,count:counts[i]!+1}));
   });
   const stored=await this.match(email);if(!stored)return {requested:true};
   const fresh=await this.source(this.office,"system:caregiver-access").profile(stored.id);if(hhaEmail(fresh.email)!==email)return {requested:true};
   let user;try{user=await this.auth.getUserByEmail(email);}catch(error){if((error as {code?:string}).code!=="auth/user-not-found")throw error;try{user=await this.auth.createUser({email,displayName:[fresh.firstName,fresh.lastName].join(" "),emailVerified:false});}catch(error){if((error as {code?:string}).code!=="auth/email-already-exists")throw error;user=await this.auth.getUserByEmail(email);}}
   if(user.disabled||(await this.db.collection("workforceStaff").doc(user.uid).get()).exists)return {requested:true};
   await this.sendReset(email);
   await this.db.collection("workforcePersonnelAudit").add({actor:"system:caregiver-access",target:stored.id,action:"existing_caregiver_reset_requested",at:new Date().toISOString(),office:this.office});
  }catch{/* Public recovery never reveals roster membership, disabled accounts or delivery details. */}
  return {requested:true};
 }
 async link(uid:string){
  const user=await this.auth.getUser(uid);if(user.disabled||!user.emailVerified||!user.email)throw new WorkforceError(401,"verified_identity_required");
  const email=hhaEmail(user.email),stored=await this.match(email);if(!stored)return null;
  const fresh=await this.source(this.office,uid).profile(stored.id);if(hhaEmail(fresh.email)!==email)throw new WorkforceError(409,"hha_email_review_required");
  await this.db.runTransaction(async tx=>{
   const ref=this.db.collection("workforceHhaLinks").doc(uid),reverse=this.db.collection("workforceHhaAssignments").doc(fresh.id),portal=this.db.collection("workforcePortalAccounts").doc(uid);
   const [prior,assignment,account,staff]=await Promise.all([tx.get(ref),tx.get(reverse),tx.get(portal),tx.get(this.db.collection("workforceStaff").doc(uid))]);
   if(staff.exists||prior.exists&&prior.data()!.caregiverId!==fresh.id||assignment.exists&&assignment.data()!.uid!==uid||account.exists&&account.data()!.office!==this.office)throw new WorkforceError(409,"hha_email_review_required");
   const record={uid,caregiverId:fresh.id,office:this.office,emailKey:hash(email),linkedAt:prior.data()?.linkedAt||new Date().toISOString()};tx.set(ref,record);tx.set(reverse,record);
   tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()),{actor:uid,target:fresh.id,action:"hha_verified_email_linked",at:new Date().toISOString(),office:this.office});
  });return fresh;
 }
 async owned(uid:string){
  const user=await this.auth.getUser(uid),link=await this.db.collection("workforceHhaLinks").doc(uid).get();
  if(user.disabled||!user.emailVerified||!user.email||!link.exists||link.data()!.office!==this.office||link.data()!.emailKey!==hash(hhaEmail(user.email)))throw new WorkforceError(403,"hha_profile_unavailable");
  const reverse=await this.db.collection("workforceHhaAssignments").doc(link.data()!.caregiverId).get();if(reverse.data()?.uid!==uid)throw new WorkforceError(403,"hha_profile_unavailable");
  const profile=await this.source(this.office,uid).profile(link.data()!.caregiverId);if(hhaEmail(profile.email)!==hhaEmail(user.email))throw new WorkforceError(409,"hha_email_review_required");return profile;
 }
 async profile(uid:string){const profile=await this.owned(uid);let files:Awaited<ReturnType<HhaProfileSource["documents"]>>|null=null;try{files=await this.source(this.office,uid).documents(profile.id);}catch{}const application=await this.db.collection("workforceApplications").doc(uid).get();await this.owned(uid);return {profile,files,filesUnavailable:!files,application:application.exists?application.data()!.state:"not_on_file"};}
 async file(uid:string,id:string){const profile=await this.owned(uid),file=await this.source(this.office,uid).download(profile.id,id);await this.owned(uid);return file;}
}
