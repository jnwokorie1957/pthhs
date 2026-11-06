import {randomUUID} from "node:crypto";
import {getAuth, type Auth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {parseGrant,requirePermission,validId,WorkforceError,type Actor} from "./policy.js";
import {nameQuery} from "./directory.js";
export class AccountSupport {
 constructor(private db=getFirestore(),private auth?:Auth){}
 async register(uid:string,office:string){
  if(!validId(uid)||!validId(office))throw new WorkforceError(503,"intake_office_unconfigured");
  await this.db.runTransaction(async tx=>{
   const ref=this.db.collection("workforcePortalAccounts").doc(uid),prior=await tx.get(ref);
   if(!prior.exists){const personnel=await tx.get(this.db.collection("workforceAccounts").doc(uid));tx.create(ref,{uid,office:validId(personnel.data()?.office)?personnel.data()!.office:office,createdAt:new Date().toISOString()});}
  });
 }
 private async scope(actorId:string,target:string,reset=false){
  return this.db.runTransaction(async tx=>{
   const grant=await tx.get(this.db.collection("workforceStaff").doc(actorId));
   if(!grant.exists)throw new WorkforceError(403,"workforce_forbidden");
   const actor:Actor={uid:actorId,grant:parseGrant(grant.data())};requirePermission(actor,"accounts.support");
   const account=await tx.get(this.db.collection("workforcePortalAccounts").doc(target));
   if(!account.exists)throw new WorkforceError(404,"caregiver_account_unavailable");requirePermission(actor,"accounts.support",account.data()!.office);
   const staff=await tx.get(this.db.collection("workforceStaff").doc(target));if(staff.exists)throw new WorkforceError(403,"caregiver_account_unavailable");
   const application=await tx.get(this.db.collection("workforceApplications").doc(target));
   if(reset){
    const ref=this.db.collection("workforceAccountResetLimits").doc(target),prior=await tx.get(ref),now=Date.now(),old=prior.data();
    const count=typeof old?.startedAt==="number"&&now-old.startedAt<3600000?Number(old.count):0;
    if(count>=3||(typeof old?.lastAt==="number"&&now-old.lastAt<60000))throw new WorkforceError(429,"account_reset_limit");
    tx.set(ref,{startedAt:count?old!.startedAt:now,lastAt:now,count:count+1});
   }
   tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()),{actor:actorId,target,action:reset?"caregiver_password_reset_requested":"caregiver_account_viewed",at:new Date().toISOString(),office:account.data()!.office});
   return {office:account.data()!.office,state:application.data()?.state||"not_started"};
  });
 }
 async lookup(actor:Actor,email:unknown){
  requirePermission(actor,"accounts.support");
  if(typeof email!=="string"||email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new WorkforceError(400,"invalid_account_email");
  const user=await (this.auth??getAuth()).getUserByEmail(email.trim()).catch(()=>{throw new WorkforceError(404,"caregiver_account_unavailable");});
  const scope=await this.scope(actor.uid,user.uid);
  return {uid:user.uid,email:user.email,emailVerified:user.emailVerified,disabled:user.disabled,providers:user.providerData.map(p=>p.providerId),createdAt:user.metadata.creationTime,lastSignInAt:user.metadata.lastSignInTime||null,...scope};
 }
 async search(actor:Actor,input:unknown){
  requirePermission(actor,"accounts.support");
  const query=nameQuery(input),items:{uid:string;firstName:string;lastName:string;state:string}[]=[];
  // Re-read grants before querying; never trust a stale browser/session grant.
  const grant=await this.db.collection("workforceStaff").doc(actor.uid).get();
  if(!grant.exists)throw new WorkforceError(403,"workforce_forbidden");
  const current:Actor={uid:actor.uid,grant:parseGrant(grant.data())};requirePermission(current,"accounts.support");
  let hasMore=false;
  for(const office of current.grant.offices){
   const matches=await this.db.collection("workforceCaregiverDirectory").where("office","==",office).where("namePrefixes","array-contains",query).limit(26).get();
   if(matches.docs.length>25)hasMore=true;
   for(const match of matches.docs.slice(0,25)){
    const record=match.data();
    // Scope also excludes staff/non-portal identities and records each access.
    try{const scope=await this.scope(actor.uid,record.uid);if(scope.office!==office)continue;
     if(items.length===25){hasMore=true;break;}items.push({uid:record.uid,firstName:record.firstName,lastName:record.lastName,state:scope.state});
    }catch(error){if(!(error instanceof WorkforceError)||![403,404].includes(error.status))throw error;}
   }
   if(items.length===25)break;
  }
  return {items:items.sort((a,b)=>(a.lastName+" "+a.firstName).localeCompare(b.lastName+" "+b.firstName)),hasMore};
 }
 async profile(actor:Actor,target:string){
  requirePermission(actor,"accounts.support");if(!validId(target))throw new WorkforceError(400,"invalid_account_id");
  const scope=await this.scope(actor.uid,target);
  const user=await (this.auth??getAuth()).getUser(target).catch(()=>{throw new WorkforceError(404,"caregiver_account_unavailable");});
  return {uid:user.uid,email:user.email||"",emailVerified:user.emailVerified,disabled:user.disabled,providers:user.providerData.map(p=>p.providerId),...scope};
 }
 async reset(actor:Actor,target:string){
  requirePermission(actor,"accounts.support");if(!validId(target))throw new WorkforceError(400,"invalid_account_id");
  await this.scope(actor.uid,target);
  const user=await (this.auth??getAuth()).getUser(target).catch(()=>{throw new WorkforceError(404,"caregiver_account_unavailable");});
  if(user.disabled||!user.email||!user.providerData.some(p=>p.providerId==="password"))throw new WorkforceError(409,"provider_managed_password");
  await this.scope(actor.uid,target,true);
  // Firebase's browser SDK sends the email; no reset token or link is returned to staff.
  return {email:user.email,requested:true};
 }
}
