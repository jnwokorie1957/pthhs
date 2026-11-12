import test from "node:test";
import assert from "node:assert/strict";
import {AccountSupport} from "./accountSupport.js";
import type {Actor} from "./policy.js";
import {directoryEntry,normalizeName} from "./directory.js";
import type {Intake} from "./intake.js";
function setup(){
 const docs=new Map<string,unknown>(),actor:Actor={uid:"support",grant:{active:true,role:"hr",offices:["office-a"],permissions:["accounts.support"]}};
 docs.set("workforceStaff/support",actor.grant);docs.set("workforcePortalAccounts/candidate",{uid:"candidate",office:"office-a"});
 const snapshot=(path:string)=>({exists:docs.has(path),data:()=>structuredClone(docs.get(path))});
 const db={collection:(path:string)=>{const filters:[string,string,unknown][]=[];const query={doc:(id:string)=>({path:path+"/"+id,get:async()=>snapshot(path+"/"+id)}),where:(key:string,operator:string,value:unknown)=>{filters.push([key,operator,value]);return query;},limit:(count:number)=>({get:async()=>({docs:[...docs].filter(([key,value])=>key.startsWith(path+"/")&&filters.every(([field,operator,wanted])=>{const actual=(value as Record<string,unknown>)[field];return operator==="array-contains"?Array.isArray(actual)&&actual.includes(wanted):actual===wanted;})).slice(0,count).map(([key])=>snapshot(key))})})};return query;},runTransaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{const writes:[string,unknown][]=[];const result=await fn({get:async(ref:{path:string})=>snapshot(ref.path),set:(ref:{path:string},data:unknown)=>writes.push([ref.path,data]),create:(ref:{path:string},data:unknown)=>writes.push([ref.path,data])});for(const [key,value]of writes)docs.set(key,value);return result;}};
 const user={uid:"candidate",email:"caregiver@example.invalid",emailVerified:true,disabled:false,providerData:[{providerId:"password"}],metadata:{creationTime:"2026-11-06T00:00:00Z",lastSignInTime:"2026-11-06T00:00:00Z"}};
 let reads=0;const auth={getUserByEmail:async()=>{reads++;return user;},getUser:async()=>{reads++;return user;}};
 return {docs,actor,user,reads:()=>reads,service:new AccountSupport(db as unknown as ConstructorParameters<typeof AccountSupport>[0],auth as unknown as ConstructorParameters<typeof AccountSupport>[1])};
}
test("support lookup exposes only account status and sign-in methods",async()=>{
 const s=setup(),result=await s.service.lookup(s.actor,"caregiver@example.invalid");assert.equal(result.uid,"candidate");assert.deepEqual(result.providers,["password"]);assert.equal(result.state,"not_started");assert.ok(!JSON.stringify(result).match(/passwordHash|ssn|oobCode/));
});
test("support requires explicit permission, active grant and assigned office",async()=>{
 for(const change of [{permissions:[]},{active:false},{role:"supervisor"},{offices:["other-office"]}]){
  const s=setup();s.docs.set("workforceStaff/support",{...s.actor.grant,...change});await assert.rejects(s.service.lookup(s.actor,"caregiver@example.invalid"),/workforce_forbidden|invalid_staff_grant/);
 }
 const office = setup();
 office.docs.set("workforceStaff/support", {...office.actor.grant, role:"office"});
 assert.equal((await office.service.lookup(office.actor,"caregiver@example.invalid")).uid,"candidate");
 const s=setup();await assert.rejects(s.service.lookup({...s.actor,grant:{...s.actor.grant,permissions:[]}},"caregiver@example.invalid"),/workforce_forbidden/);assert.equal(s.reads(),0);
});
test("non-portal users and staff accounts cannot be managed as caregivers",async()=>{
 for(const staff of [false,true]){const s=setup();if(staff)s.docs.set("workforceStaff/candidate",s.actor.grant);else s.docs.delete("workforcePortalAccounts/candidate");await assert.rejects(s.service.lookup(s.actor,"caregiver@example.invalid"),/caregiver_account_unavailable/);await assert.rejects(s.service.reset(s.actor,"candidate"),/caregiver_account_unavailable/);}
});
test("reset reservation returns only email and records a rate-limited request",async()=>{
 const s=setup();assert.deepEqual(await s.service.reset(s.actor,"candidate"),{email:"caregiver@example.invalid",requested:true});await assert.rejects(s.service.reset(s.actor,"candidate"),/account_reset_limit/);assert.ok([...s.docs.values()].some(value=>(value as {action?:string}).action==="caregiver_password_reset_requested"));assert.ok(!JSON.stringify([...s.docs]).includes("oobCode"));
});
test("external-provider and disabled accounts cannot receive local password resets",async()=>{
 for(const disabled of [false,true]){const s=setup();if(disabled)s.user.disabled=true;else s.user.providerData=[{providerId:"google.com"}];await assert.rejects(s.service.reset(s.actor,"candidate"),/provider_managed_password/);assert.ok(!s.docs.has("workforceAccountResetLimits/candidate"));}
});
test("portal registration preserves the original office and employment account scope",async()=>{
 const s=setup();s.docs.set("workforceAccounts/new-candidate",{office:"existing-office"});await s.service.register("new-candidate","intake-office");assert.equal((s.docs.get("workforcePortalAccounts/new-candidate") as {office:string}).office,"existing-office");await s.service.register("new-candidate","changed-office");assert.equal((s.docs.get("workforcePortalAccounts/new-candidate") as {office:string}).office,"existing-office");
});

test("name directory supports first, last and full-name prefixes without identity or contact data",async()=>{
 const s=setup();const entry=directoryEntry({uid:"candidate",office:"office-a",answers:{firstName:"Synthetíc",lastName:"Applicant",ssn:"000-00-1234",email:"private@example.invalid"},state:"draft",updatedAt:"2026-11-06"} as unknown as Intake);
 assert.equal(normalizeName("  SYNTHETÍC  "),"synthetic");assert.ok(!JSON.stringify(entry).includes("000-00"));assert.ok(!JSON.stringify(entry).includes("@"));s.docs.set("workforceCaregiverDirectory/candidate",entry);
 for(const name of ["synt","APPL","synthetic app"]){const result=await s.service.search(s.actor,name);assert.equal(result.items[0]?.uid,"candidate");assert.equal(result.hasMore,false);assert.ok(!JSON.stringify(result).includes("namePrefixes"));}
 assert.equal((await s.service.search(s.actor,"Missing")).items.length,0);
 for(const value of [null,""," ","x".repeat(101),"a\u0000"]){await assert.rejects(s.service.search(s.actor,value),/invalid_caregiver_name/);}
});

test("name search rechecks grants and excludes other offices, staff and stale directory entries",async()=>{
 const s=setup();const entry={uid:"candidate",office:"office-a",firstName:"Synthetic",lastName:"Applicant",namePrefixes:["synthetic"]};s.docs.set("workforceCaregiverDirectory/candidate",entry);
 s.docs.set("workforceCaregiverDirectory/other",{...entry,uid:"other",office:"office-b"});assert.equal((await s.service.search(s.actor,"Synthetic")).items.length,1);
 s.docs.set("workforceStaff/candidate",s.actor.grant);assert.equal((await s.service.search(s.actor,"Synthetic")).items.length,0);s.docs.delete("workforceStaff/candidate");
 s.docs.delete("workforcePortalAccounts/candidate");assert.equal((await s.service.search(s.actor,"Synthetic")).items.length,0);
 s.docs.set("workforceStaff/support",{...s.actor.grant,active:false});await assert.rejects(s.service.search(s.actor,"Synthetic"),/workforce_forbidden|invalid_staff_grant/);
});

test("duplicate names remain distinct and a bounded search asks for a narrower name",async()=>{
 const s=setup();for(let i=0;i<27;i++){const uid="candidate-"+i;s.docs.set("workforcePortalAccounts/"+uid,{office:"office-a"});s.docs.set("workforceCaregiverDirectory/"+uid,{uid,office:"office-a",firstName:"Synthetic",lastName:"Applicant",namePrefixes:["synthetic"]});}
 const result=await s.service.search(s.actor,"Synthetic");assert.equal(result.items.length,25);assert.equal(result.hasMore,true);assert.equal(new Set(result.items.map(item=>item.uid)).size,25);
});

test("selected account profile exposes safe account metadata and remains office scoped",async()=>{
 const s=setup(),profile=await s.service.profile(s.actor,"candidate");assert.equal(profile.email,s.user.email);assert.ok(!JSON.stringify(profile).includes("passwordHash"));
 s.docs.set("workforcePortalAccounts/candidate",{office:"office-b"});await assert.rejects(s.service.profile(s.actor,"candidate"),/workforce_forbidden/);
});

test("a named portal signup is searchable before an application exists and cannot replace an application directory",async()=>{
 const s=setup();Object.assign(s.user,{displayName:"Hannah Howard"});s.docs.delete("workforcePortalAccounts/candidate");await s.service.register("candidate","office-a");
 assert.equal((await s.service.search(s.actor,"How")).items[0]?.uid,"candidate");assert.equal((await s.service.search(s.actor,"Han")).items[0]?.state,"not_started");
 const original=s.docs.get("workforceCaregiverDirectory/candidate");s.docs.set("workforceApplications/candidate",{state:"draft"});Object.assign(s.user,{displayName:"Other Name"});await s.service.register("candidate","office-a");assert.deepEqual(s.docs.get("workforceCaregiverDirectory/candidate"),original);
});
