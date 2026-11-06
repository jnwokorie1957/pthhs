import test from "node:test";
import assert from "node:assert/strict";
import {HhaDirectory} from "./hhaDirectory.js";
import {readRequest} from "../operations/reads.js";
import type {Actor} from "./policy.js";
function setup(){
 const state={approved:true,enabled:true,revision:1,office:"12",recordOffice:"12",wrongId:false,change:false};const queries:{operation:string;firstName?:string;lastName?:string}[]=[];
 const actor:Actor={uid:"owner",grant:{active:true,role:"owner",offices:["12"],permissions:["accounts.support"]}};
 const workspace={settings:async()=>({dataApproved:state.approved,settings:{officeId:state.office,revision:state.revision,enabledReads:state.enabled?["SearchCaregivers","GetCaregiverDemographics"]:[]}}),query:async(input:{operation:string;id?:string})=>{
  queries.push(input);if(state.change)state.revision++;
  return {operation:input.operation,source:"hhaexchange",fetchedAt:"2026-11-06T12:00:00Z",truncated:false,records:input.operation==="SearchCaregivers"?[{CaregiverID:"101"}]:[{ID:state.wrongId?"999":input.id,FirstName:"Hannah",LastName:"Hart",CaregiverCode:"CG-1",OfficeIDs:JSON.stringify([state.recordOffice]),"Status/Name":"Active"}]};
 }};
 return {state,actor,queries,directory:new HhaDirectory(workspace as unknown as ConstructorParameters<typeof HhaDirectory>[0],async()=>actor)};
}
test("single-letter workforce caregiver search stays explicit while generic people search retains its minimum",()=>{
 assert.throws(()=>readRequest({operation:"SearchCaregivers",firstName:"H"}),/requires_2/);
 assert.match(readRequest({operation:"SearchCaregivers",firstName:"H"},"workforce_caregiver_search"),/<FirstName>H<\/FirstName>/);
 assert.throws(()=>readRequest({operation:"SearchPatients",firstName:"H"},"workforce_caregiver_search"),/requires_2/);
});
test("HHA first/last-name results are deduplicated by source ID and narrow by prefix",async()=>{
 const s=setup(),result=await s.directory.search("H");assert.equal(result.items.length,1);assert.equal(result.items[0]!.hhaId,"101");assert.equal(result.items[0]!.source,"hhaexchange");assert.equal(s.queries.filter(q=>q.operation==="SearchCaregivers").length,2);
 assert.equal((await s.directory.search("Han")).items.length,1);assert.equal((await s.directory.search("Henry")).items.length,0);
});
test("HHA directory enforces owner read configuration, active personnel permission and source office",async()=>{
 for(const change of [{approved:false},{enabled:false},{office:"13"}]){const s=setup();Object.assign(s.state,change);await assert.rejects(s.directory.search("H"));assert.equal(s.queries.length,0);}
 const s=setup();s.state.recordOffice="99";assert.equal((await s.directory.search("H")).items.length,0);await assert.rejects(s.directory.profile("101"),/caregiver_account_unavailable/);
 s.actor.grant.permissions=[];await assert.rejects(s.directory.search("H"),/workforce_forbidden/);
});
test("source settings changes and wrong caregiver identities cannot return a profile",async()=>{
 const s=setup();s.state.change=true;await assert.rejects(s.directory.search("H"),/revision_conflict/);
 const other=setup();other.state.wrongId=true;await assert.rejects(other.directory.profile("101"),/caregiver_account_unavailable/);
});
