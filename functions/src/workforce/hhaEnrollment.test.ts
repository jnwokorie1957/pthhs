import test from "node:test";
import assert from "node:assert/strict";
import {HhaEnrollment} from "./hhaEnrollment.js";
import type {HhaProfile} from "./hhaSource.js";
import type {Actor} from "./policy.js";
function setup(){
 const records=new Map<string,Record<string,unknown>>(),users=new Map<string,Record<string,unknown>>(),emails:string[]=[],created:Record<string,unknown>[]=[];
 const actor:Actor={uid:"owner",grant:{active:true,role:"owner",offices:["12"],permissions:["accounts.support","documents.review","staff.manage"]}};
 records.set("workforceStaff/owner",actor.grant as unknown as Record<string,unknown>);records.set("workforceHhaRosterReady/12",{office:"12",completedAt:"2026-11-06T12:00:00Z"});
 const snapshot=(path:string)=>({exists:records.has(path),data:()=>structuredClone(records.get(path))});
 const collection=(path:string)=>{const filters:[string,unknown][]=[];const query={doc:(id:string)=>({path:path+"/"+id,get:async()=>snapshot(path+"/"+id),set:async(data:Record<string,unknown>)=>records.set(path+"/"+id,structuredClone(data)),create:async(data:Record<string,unknown>)=>{assert.ok(!records.has(path+"/"+id));records.set(path+"/"+id,structuredClone(data));}}),add:async(data:Record<string,unknown>)=>records.set(path+"/audit-"+records.size,structuredClone(data)),where:(key:string,_:string,value:unknown)=>{filters.push([key,value]);return query;},limit:(limit:number)=>({get:async()=>({docs:[...records].filter(([key,value])=>key.startsWith(path+"/")&&key.split('/').length===2&&filters.every(([field,wanted])=>value[field]===wanted)).slice(0,limit).map(([key])=>snapshot(key))})})};return query;};
 const db={collection,runTransaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{const writes:[string,Record<string,unknown>][]=[];const result=await fn({get:async(ref:{path:string})=>snapshot(ref.path),set:(ref:{path:string},data:Record<string,unknown>)=>writes.push([ref.path,structuredClone(data)]),create:(ref:{path:string},data:Record<string,unknown>)=>{assert.ok(!records.has(ref.path));writes.push([ref.path,structuredClone(data)]);},update:(ref:{path:string},data:Record<string,unknown>)=>writes.push([ref.path,{...records.get(ref.path),...structuredClone(data)}])});for(const [key,value]of writes)records.set(key,value);return result;}};
 const profiles=new Map<string,HhaProfile>([["101",{id:"101",office:"12",firstName:"Hannah",lastName:"Hart",email:"legacy@example.invalid",status:"Active",code:"DEMO-101",fetchedAt:"2026-11-06T12:00:00Z",fields:{"NotificationPreferences/Email":"legacy@example.invalid","Address/Street1":"100 Demonstration Road"}}]]);
 let onDownload=()=>{};const source={profile:async(id:string)=>{const value=profiles.get(id);if(!value)throw Error('missing');return structuredClone(value);},discover:async()=>({ids:[...profiles.keys()],revision:1}),documents:async()=>({items:[{id:"501",name:"Demo.pdf",attachmentAvailable:true,category:"Identification",createdAt:null,size:"4"}],truncated:false,source:"hhaexchange",fetchedAt:"2026-11-06"}),download:async()=>{onDownload();return {bytes:Buffer.from('demo'),filename:"Demo.pdf"};}};
 const auth={getUser:async(uid:string)=>{const user=users.get(uid);if(!user)throw {code:"auth/user-not-found"};return user;},getUserByEmail:async(email:string)=>{const user=[...users.values()].find(user=>user.email===email);if(!user)throw {code:"auth/user-not-found"};return user;},createUser:async(input:Record<string,unknown>)=>{created.push(input);const user={...input,uid:"legacy-user",disabled:false};users.set("legacy-user",user);return user;}};
 const service=new HhaEnrollment(()=>source,"12",async email=>{emails.push(email);},db as unknown as ConstructorParameters<typeof HhaEnrollment>[3],auth as unknown as ConstructorParameters<typeof HhaEnrollment>[4]);
 return {service,records,users,emails,created,actor,profiles,onDownload:(fn:()=>void)=>onDownload=fn};
}
test("prepared HHA email recovery provisions no password, returns no identity and never marks email verified",async()=>{
 const s=setup();await s.service.stage(s.actor,"101");const unknown=await s.service.requestAccess("missing@example.invalid","network");const known=await s.service.requestAccess("LEGACY@example.invalid","network");assert.deepEqual(known,unknown);assert.deepEqual(known,{requested:true});assert.deepEqual(s.emails,["legacy@example.invalid"]);assert.equal(s.created[0]!.emailVerified,false);assert.ok(!("password"in s.created[0]!));assert.ok(!s.records.has("workforceHhaLinks/legacy-user"));
 await assert.rejects(s.service.link("legacy-user"),/verified_identity_required/);
});
test("verified source-email ownership links one HHA identity and exposes its profile without inventing an application",async()=>{
 const s=setup();await s.service.stage(s.actor,"101");await s.service.requestAccess("legacy@example.invalid","network");s.users.get("legacy-user")!.emailVerified=true;
 assert.equal((await s.service.link("legacy-user"))!.id,"101");const data=await s.service.profile("legacy-user");assert.equal(data.profile.firstName,"Hannah");assert.equal(data.application,"not_on_file");assert.equal(data.files?.items[0]!.id,"501");assert.equal((await s.service.file("legacy-user","501")).filename,"Demo.pdf");
 s.records.set("workforceApplications/legacy-user",{state:"submitted"});assert.equal((await s.service.profile("legacy-user")).application,"submitted");
});
test("shared or missing source emails never auto-provision and staff identities cannot be enrolled as caregivers",async()=>{
 const s=setup();await s.service.stage(s.actor,"101");s.profiles.set("102",{...s.profiles.get("101")!,id:"102"});await s.service.stage(s.actor,"102");await s.service.requestAccess("legacy@example.invalid","network");assert.equal(s.created.length,0);assert.equal(s.emails.length,0);
 s.records.delete("workforceHhaProfiles/102");s.users.set("staff-user",{uid:"staff-user",email:"legacy@example.invalid",emailVerified:true,disabled:false});s.records.set("workforceStaff/staff-user",s.actor.grant as unknown as Record<string,unknown>);await s.service.requestAccess("legacy@example.invalid","network");assert.equal(s.emails.length,0);await assert.rejects(s.service.link("staff-user"),/hha_email_review_required/);
});
test("a second UID, an office mismatch and changed HHA email cannot take over an established link",async()=>{
 const s=setup();await s.service.stage(s.actor,"101");s.users.set("first",{uid:"first",email:"legacy@example.invalid",emailVerified:true,disabled:false});await s.service.link("first");s.users.set("second",{uid:"second",email:"legacy@example.invalid",emailVerified:true,disabled:false});await assert.rejects(s.service.link("second"),/hha_email_review_required/);
 s.profiles.get("101")!.email="different@example.invalid";await assert.rejects(s.service.owned("first"),/hha_email_review_required/);
});
test("identity is rechecked after a file read and recovery quotas apply to unknown addresses too",async()=>{
 const s=setup();await s.service.stage(s.actor,"101");s.users.set("first",{uid:"first",email:"legacy@example.invalid",emailVerified:true,disabled:false});await s.service.link("first");s.onDownload(()=>{s.users.get("first")!.disabled=true;});await assert.rejects(s.service.file("first","501"),/hha_profile_unavailable/);
 for(let i=0;i<5;i++)assert.deepEqual(await s.service.requestAccess("unknown@example.invalid","network"),{requested:true});assert.equal(s.created.length,0);assert.equal(s.emails.length,0);
});
test("owner roster import stages source profiles without creating credentials or sending messages",async()=>{
 const s=setup();const job=await s.service.sync(s.actor);assert.equal(job.complete,true);assert.equal(job.processed,1);assert.ok(s.records.has("workforceHhaProfiles/101"));assert.equal(s.created.length,0);assert.equal(s.emails.length,0);
 s.records.set("workforceStaff/owner",{...s.actor.grant,permissions:["accounts.support"]});await assert.rejects(s.service.sync(s.actor),/workforce_forbidden/);
});

test("partial initial roster cannot provision or link a seemingly unique source email",async()=>{const s=setup();s.records.delete("workforceHhaRosterReady/12");await s.service.stage(s.actor,"101");await s.service.requestAccess("legacy@example.invalid","network");assert.equal(s.created.length,0);assert.equal(s.emails.length,0);s.users.set("first",{uid:"first",email:"legacy@example.invalid",emailVerified:true,disabled:false});assert.equal(await s.service.link("first"),null);});
