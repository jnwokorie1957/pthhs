import test from "node:test";
import assert from "node:assert/strict";
import {HhaDirectory} from "./hhaDirectory.js";
import {readRequest} from "../operations/reads.js";
import type {Actor} from "./policy.js";
function setup(){
 const state={approved:true,enabled:true,revision:1,office:"12",recordOffice:"12",wrongId:false,change:false,status:"Active"};const queries:{operation:string;firstName?:string;lastName?:string}[]=[];
 const actor:Actor={uid:"owner",grant:{active:true,role:"owner",offices:["12"],permissions:["accounts.support"]}};
 const workspace={settings:async()=>({dataApproved:state.approved,settings:{officeId:state.office,revision:state.revision,enabledReads:state.enabled?["SearchCaregivers","GetCaregiverDemographics"]:[]}}),query:async(input:{operation:string;id?:string})=>{
  queries.push(input);if(state.change)state.revision++;
  return {operation:input.operation,source:"hhaexchange",fetchedAt:"2026-11-06T12:00:00Z",truncated:false,records:input.operation==="SearchCaregivers"?[{CaregiverID:"101"}]:[{ID:state.wrongId?"999":input.id,FirstName:"Hannah",LastName:"Hart",CaregiverCode:"CG-1",OfficeIDs:JSON.stringify([state.recordOffice]),"Status/Name":state.status}]};
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
test("live name search excludes HHA caregivers marked inactive", async () => {
 const s = setup();
 s.state.status = "Inactive";
 assert.deepEqual((await s.directory.search("Hannah Hart")).items, []);
});
test("saved details require a current active profile in the assigned office", async () => {
 const s = setup();
 const row = {id:"101", office:"12", firstName:"Sample", lastName:"Caregiver", status:"Active",
  fetchedAt:new Date().toISOString(), email:"sample@example.invalid", fields:{EmployeeType:"Employee"}, emailKey:"private-index"};
 const db = {collection: () => ({doc: () => ({get: async () => ({data: () => row})})})};
 const firestore = db as unknown as Parameters<HhaDirectory["savedProfile"]>[0];
 assert.equal((await s.directory.savedProfile(firestore, "101"))?.fields.EmployeeType, "Employee");
 assert.doesNotMatch(JSON.stringify(await s.directory.savedProfile(firestore, "101")), /private-index/);
 row.status = "Inactive";
 assert.equal(await s.directory.savedProfile(firestore, "101"), null);
 row.status = "Active";
 row.office = "99";
 assert.equal(await s.directory.savedProfile(firestore, "101"), null);
});
test("roster pages use the approved office, return names only and disclose incomplete refreshes", async () => {
 const s = setup();
 const syncedAt = new Date().toISOString();
 const rows = Array.from({length:51}, (_, index) => {
  const id = String(index + 100);
  return {id, data: () => ({id, office:"12", firstName:"Sample", lastName:"Caregiver", status:"Active", fetchedAt:syncedAt, email:"private@example.invalid"})};
 });
 let offset = 0;
 const sortFields: unknown[] = [];
 const query = {
  where(field: string, operator: string, value: string) {
   if (field === "status") assert.deepEqual([operator, value], ["==", "Active"]);
   else {
    assert.equal(field, "fetchedAt");
    assert.ok([">", "<="].includes(operator));
    assert.ok(Number.isFinite(Date.parse(value)));
   }
   return query;
  },
  count() { return {get: async () => ({data: () => ({count: rows.length})})}; },
  orderBy(field: unknown) { sortFields.push(field); return query; },
  startAfter(lastName: string, firstName: string, id: string) {
   assert.deepEqual([lastName, firstName], ["Caregiver", "Sample"]);
   offset = rows.findIndex(row => row.id === id) + 1;
   return query;
  },
  select() { return query; },
  limit(size: number) { return {get: async () => ({docs:rows.slice(offset, offset + size)})}; }
 };
 const db = {collection(name: string) {
  if (name === "workforceHhaProfiles") return {
   where(field: string, operator: string, value: string) {
    assert.deepEqual([field, operator, value], ["office", "==", "12"]);
    return query;
   },
   doc(id: string) { return {get: async () => rows.find(row => row.id === id)}; }
  };
  return {doc: () => ({get: async () => ({data: () => name === "workforceHhaSyncRuns" ? {state:"failed"} : {completedAt:syncedAt}})})};
 }} as unknown as Parameters<HhaDirectory["browse"]>[0];
 const first = await s.directory.browse(db);
 assert.equal(first.items.length, 50);
 assert.equal(first.activeCount, 51);
 assert.deepEqual(sortFields.slice(0, 2), ["lastName", "firstName"]);
 assert.equal(first.syncedAt, syncedAt);
 assert.equal(first.refreshFailed, true);
 assert.doesNotMatch(JSON.stringify(first), /private@example/);
 assert.deepEqual((await s.directory.browse(db, first.next!)).items.map(item => item.hhaId), ["150"]);
 assert.equal(s.queries.length, 0);
});
