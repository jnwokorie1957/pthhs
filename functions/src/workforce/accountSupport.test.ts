import test from "node:test";
import assert from "node:assert/strict";
import {AccountSupport} from "./accountSupport.js";
import type {Actor} from "./policy.js";
function setup(){
 const docs=new Map<string,unknown>(),actor:Actor={uid:"support",grant:{active:true,role:"hr",offices:["office-a"],permissions:["accounts.support"]}};
 docs.set("workforceStaff/support",actor.grant);docs.set("workforcePortalAccounts/candidate",{uid:"candidate",office:"office-a"});
 const db={collection:(path:string)=>({doc:(id:string)=>({path:path+"/"+id})}),runTransaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{const writes:[string,unknown][]=[];const result=await fn({get:async(ref:{path:string})=>({exists:docs.has(ref.path),data:()=>structuredClone(docs.get(ref.path))}),set:(ref:{path:string},data:unknown)=>writes.push([ref.path,data]),create:(ref:{path:string},data:unknown)=>writes.push([ref.path,data])});for(const [key,value]of writes)docs.set(key,value);return result;}};
 const user={uid:"candidate",email:"caregiver@example.invalid",emailVerified:true,disabled:false,providerData:[{providerId:"password"}],metadata:{creationTime:"2026-11-06T00:00:00Z",lastSignInTime:"2026-11-06T00:00:00Z"}};
 let reads=0;const auth={getUserByEmail:async()=>{reads++;return user;},getUser:async()=>{reads++;return user;}};
 return {docs,actor,user,reads:()=>reads,service:new AccountSupport(db as unknown as ConstructorParameters<typeof AccountSupport>[0],auth as unknown as ConstructorParameters<typeof AccountSupport>[1])};
}
test("support lookup exposes only account status and sign-in methods",async()=>{
 const s=setup(),result=await s.service.lookup(s.actor,"caregiver@example.invalid");assert.equal(result.uid,"candidate");assert.deepEqual(result.providers,["password"]);assert.equal(result.state,"not_started");assert.ok(!JSON.stringify(result).match(/passwordHash|ssn|oobCode/));
});
test("support requires explicit permission, active grant and assigned office",async()=>{
 for(const change of [{permissions:[]},{active:false},{role:"office"},{offices:["other-office"]}]){
  const s=setup();s.docs.set("workforceStaff/support",{...s.actor.grant,...change});await assert.rejects(s.service.lookup(s.actor,"caregiver@example.invalid"),/workforce_forbidden|invalid_staff_grant/);
 }
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
