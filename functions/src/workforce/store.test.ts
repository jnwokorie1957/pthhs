import test from "node:test";
import assert from "node:assert/strict";
import { WorkforceStore } from "./store.js";
import type { Opportunity } from "./opportunities.js";
import type { Grant } from "./policy.js";
import type { Auth } from "firebase-admin/auth";
import { createHash } from "node:crypto";
function fixture() {
  const documents = new Map<string, unknown>();
  const users = new Map<string, { uid: string; email: string; emailVerified: boolean; disabled: boolean }>();
  const queries: { path: string; field: string; value: unknown }[] = [];
  function ordered(path: string, maximum = Infinity, after = "") {
    return {
      limit: (size: number) => ordered(path, size, after),
      startAfter: (cursor: string) => ordered(path, maximum, cursor),
      get: () => ({docs: [...documents.keys()].sort().filter(key => key.startsWith(path + "/") &&
        !key.slice(path.length + 1).includes("/") && key.slice(path.length + 1) > after)
        .slice(0, maximum).map(key => ({id: key.slice(path.length + 1), data: () => structuredClone(documents.get(key))}))}),
    };
  }
  function collection(path: string): unknown {
    return {
      doc: (id: string) => {
        const key = path + "/" + id;
        return { id, path: key, collection: (child: string) => collection(key + "/" + child),
          get: async () => ({ exists: documents.has(key), data: () => structuredClone(documents.get(key)) }) };
      },
      orderBy: () => ordered(path),
      where: (field: string, operator: string, value: unknown) => ({ limit: (limit: number) => ({ get: async () => {
        queries.push({ path, field, value });
        const docs = [...documents].filter(([key, data]) => {
          if (!key.startsWith(path + "/") || key.split("/").length !== 2) return false;
          const fieldValue = (data as Record<string, unknown>)[field];
          return operator === "array-contains" ? Array.isArray(fieldValue) && fieldValue.includes(value) : fieldValue === value;
        });
        return { docs: docs.slice(0, limit).map(([key, data]) => ({ id: key.split("/")[1], data: () => structuredClone(data) })) };
      } }) })
    };
  }
  // Transaction contract test double: changes commit together only after success.
  // This is not a substitute for Firestore emulator or production acceptance.
  const db = {
    collection,
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const writes: [string, unknown][] = [];
      const result = await fn({ get: async (ref: { path: string; get?: () => unknown }) => ref.path ? ({ exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) }) : ref.get?.(),
        set: (ref: { path: string }, value: unknown) => writes.push([ref.path, value]),
        create: (ref: { path: string }, value: unknown) => { assert.ok(!documents.has(ref.path)); writes.push([ref.path, value]); } });
      for (const [path, value] of writes) documents.set(path, structuredClone(value));
      return result;
    }
  };
  const grant: Grant = { active: true, role: "office", offices: ["synthetic-office"], permissions: ["opportunities.read", "opportunities.edit"] };
  documents.set("workforceStaff/editor", grant);
  const auth = {
    async getUser(uid: string) { return users.get(uid); },
    async getUsers(ids: { uid: string }[]) { return { users: ids.flatMap(({ uid }) => users.get(uid) ?? []) }; },
    async getUserByEmail(email: string) {
      const user = [...users.values()].find(value => value.email === email);
      if (!user) throw Object.assign(Error(), {code: "auth/user-not-found"});
      return user;
    }
  };
  return { store: new WorkforceStore(db as unknown as ConstructorParameters<typeof WorkforceStore>[0], () => auth as unknown as Auth), documents, users, queries, grant };
}
test("office managers can review team accounts only in their assigned offices", async () => {
  const { store, documents, users, grant } = fixture();
  documents.set("workforceStaff/manager", {...grant, role:"office_manager", permissions:["staff.review"]});
  for (const [uid, offices] of [["shared", ["synthetic-office", "other-office"]], ["outside", ["other-office"]]] as const) {
    documents.set("workforceStaff/" + uid, {...grant, offices});
    users.set(uid, {uid, email:uid + "@example.invalid", emailVerified:true, disabled:false});
  }
  await assert.rejects(store.reviewTeam("editor"), /workforce_forbidden/);
  await assert.rejects(store.inviteStaff("manager", "new@example.invalid", grant), /workforce_forbidden/);
  const { items } = await store.reviewTeam("manager");
  assert.deepEqual(items.map(({email, offices}) => ({email, offices})), [
    {email:"shared@example.invalid", offices:["synthetic-office"]}
  ]);
});
const data = { office: "synthetic-office", internalReference: "synthetic-reference", internalNotes: "Synthetic only", public: { location: "Synthetic area", recruitingZip: "", weeklyHours: 12, schedule: "flexible", assistance: ["respite"], type: "assignment" } };
test("staff training persists per account and cannot be completed before the video duration", async () => {
  const { store, documents, grant } = fixture();
  const now = Date.parse("2026-11-10T17:00:00Z");
  const actor = await store.actor("editor");
  assert.equal(await store.trainingRequired(actor), true);
  await assert.rejects(store.recordTraining("editor", "complete", now), /staff_training_incomplete/);
  await store.recordTraining("editor", "start", now);
  await store.recordTraining("editor", "start", now + 1000);
  await assert.rejects(store.recordTraining("editor", "complete", now + 48_999), /staff_training_incomplete/);
  assert.deepEqual(await store.recordTraining("editor", "complete", now + 49_000), {complete: true});
  assert.equal(await store.trainingRequired(await store.actor("editor")), false);
  assert.equal(await store.trainingRequired({uid: "other-editor", grant}), true);
  assert.equal(await store.trainingRequired({uid: "owner", grant: {...grant, role: "owner"}}), false);
  documents.set("workforceStaff/editor", {...grant, active: false});
  await assert.rejects(store.recordTraining("editor", "complete", now + 50_000), /staff_access_revoked/);
});
test("opportunity updates commit an audit event and immutable version with the record", async () => {
  const f = fixture();
  const first = await f.store.mutate("editor", "synthetic-id", 0, data);
  assert.equal(first.revision, 1);
  assert.equal([...f.documents.keys()].filter(k => k.startsWith("workforceAudit/")).length, 1);
  const before = f.documents.get("workforceOpportunities/synthetic-id/versions/1");
  await f.store.mutate("editor", "synthetic-id", 1, { ...data, internalNotes: "Updated synthetic only" });
  assert.deepEqual(f.documents.get("workforceOpportunities/synthetic-id/versions/1"), before);
  assert.equal([...f.documents.keys()].filter(k => k.startsWith("workforceAudit/")).length, 2);
});
test("revoked grants, cross-office writes and revision conflicts persist no partial state", async () => {
  const f = fixture(); await f.store.mutate("editor", "synthetic-id", 0, data);
  const before = structuredClone(f.documents);
  await assert.rejects(f.store.mutate("editor", "synthetic-id", 0, data));
  await assert.rejects(f.store.mutate("editor", "new-id", 0, { ...data, office: "other-office" }));
  assert.deepEqual(f.documents, before);
  f.documents.set("workforceStaff/editor", { ...f.grant, active: false });
  await assert.rejects(f.store.mutate("editor", "synthetic-id", 1, data), /workforce_forbidden/);
  assert.equal((f.documents.get("workforceOpportunities/synthetic-id") as Opportunity).revision, 1);
});
test("staff list retrieves only granted offices and public list omits unreviewed records", async () => {
  const f = fixture(); await f.store.mutate("editor", "synthetic-id", 0, data);
  f.documents.set("workforceOpportunities/other", { ...f.documents.get("workforceOpportunities/synthetic-id") as Opportunity, id: "other", office: "other-office" });
  f.store.actor = async uid => ({ uid, grant: f.documents.get("workforceStaff/editor") as Grant });
  assert.equal((await f.store.list("editor")).items.length, 1);
  assert.deepEqual(f.queries[0], { path: "workforceOpportunities", field: "office", value: "synthetic-office" });
  assert.deepEqual((await f.store.publicList()).items, []);
});
test("storage failure propagates rather than reporting a successful save", async () => {
  const store = new WorkforceStore({ collection: () => ({ doc: () => ({}) }), runTransaction: async () => { throw Error("storage unavailable"); } } as unknown as ConstructorParameters<typeof WorkforceStore>[0]);
  await assert.rejects(store.mutate("editor", "synthetic-id", 0, data), /storage unavailable/);
});
test("candidate interest is idempotent and accepts only a currently reviewed published opening",async()=>{
 const f=fixture(),draft=await f.store.mutate("editor","synthetic-id",0,data);
 await assert.rejects(f.store.interest("candidate","synthetic-id"),/opportunity_unavailable/);
 const published={...draft,state:"published",review:{revision:draft.revision,reviewer:"independent-reviewer",at:"2026-11-05T00:00:00Z"}};
 f.documents.set("workforceOpportunities/synthetic-id",published);
 assert.deepEqual(await f.store.interest("candidate","synthetic-id"),{recorded:true,opportunityId:"synthetic-id"});
 const before=structuredClone(f.documents);await f.store.interest("candidate","synthetic-id");assert.deepEqual(f.documents,before);
 const interests=[...f.documents.entries()].filter(([key])=>key.startsWith("workforceOpportunityInterests/"));assert.equal(interests.length,1);
 const interest=interests[0]![1] as {uid:string;office:string};assert.equal(interest.uid,"candidate");assert.equal(interest.office,"synthetic-office");
 f.documents.set("workforceOpportunities/synthetic-id",{...published,state:"closed"});await assert.rejects(f.store.interest("other-candidate","synthetic-id"),/opportunity_unavailable/);
 assert.equal([...f.documents.keys()].filter(key=>key.startsWith("workforceOpportunityInterests/")).length,1);
});

test("active HHA caregivers apply once using the verified link and recruiting staff see only office-scoped entries", async () => {
  const {store, documents, grant} = fixture();
  const draft = await store.mutate("editor", "opening", 0, data);
  const publishable = {...draft, state: "published", review: {revision: draft.revision, reviewer: "reviewer", at: "2027-01-01T12:00:00Z"}};
  const profile = {id: "101", office: grant.offices[0]!, firstName: "Demo", lastName: "Caregiver",
    email: "caregiver@example.invalid", status: "Active", code: "", fetchedAt: "", fields: {EmployeeType: "Employee"}};
  const link = {uid: "caregiver", caregiverId: profile.id, office: profile.office, emailKey: createHash("sha256").update(profile.email).digest("hex")};
  await assert.rejects(store.existingCaregiverInterest("caregiver", "opening", profile), /opportunity_unavailable/);
  documents.set("workforceOpportunities/opening", publishable);
  await assert.rejects(store.existingCaregiverInterest("caregiver", "opening", profile), /hha_profile_unavailable/);
  documents.set("workforceHhaLinks/caregiver", link);
  documents.set("workforceHhaAssignments/101", link);
  await assert.rejects(store.existingCaregiverInterest("caregiver", "opening", {...profile, status:"Inactive"}), /existing_caregiver_not_active/);
  await assert.rejects(store.existingCaregiverInterest("caregiver", "opening", {...profile, fields:{EmployeeType:"Applicant"}}), /existing_caregiver_not_active/);
  await assert.rejects(store.existingCaregiverInterest("caregiver", "opening", {...profile, office:"another-office"}), /opportunity_office_mismatch/);
  assert.deepEqual(await store.existingCaregiverInterest("caregiver", "opening"), {recorded:false, opportunityId:"opening"});
  assert.deepEqual(await store.existingCaregiverInterest("caregiver", "opening", profile), {recorded:true, opportunityId:"opening"});
  const recorded = structuredClone(documents);
  await store.existingCaregiverInterest("caregiver", "opening", profile);
  assert.deepEqual(documents, recorded);
  assert.equal((await store.existingCaregiverInterest("caregiver", "opening")).recorded, true);
  assert.equal((await store.existingCaregiverInterest("someone-else", "opening")).recorded, false);
  assert.equal(documents.has("workforceApplications/caregiver"), false);
  await assert.rejects(store.existingCaregiverApplicants("editor", "opening"), /workforce_forbidden/);
  const recruitingGrant = {...grant, permissions:["opportunities.read", "applicants.review"]};
  documents.set("workforceStaff/outside", {...recruitingGrant, offices:["another-office"]});
  await assert.rejects(store.existingCaregiverApplicants("outside", "opening"), /workforce_forbidden/);
  documents.set("workforceStaff/recruiter", recruitingGrant);
  const page = await store.existingCaregiverApplicants("recruiter", "opening");
  assert.deepEqual(page.items, [{id:page.items[0]!.id,name:"Demo Caregiver", caregiverId:"101", createdAt:page.items[0]!.createdAt}]);
  assert.equal(page.next, null);
  documents.delete("workforceHhaAssignments/101");
  await assert.rejects(store.existingCaregiverInterest("caregiver", "opening", profile), /hha_profile_unavailable/);
});

test("recruiting profile details require an application to that opening and expose only basic office-scoped fields", async () => {
  const {store, documents, grant} = fixture();
  const dataForOffice = {...data, office:grant.offices[0]!};
  await store.mutate("editor", "opening", 0, dataForOffice);
  await store.mutate("editor", "other-opening", 0, dataForOffice);
  const application = {uid:"caregiver", office:dataForOffice.office, caregiverId:"101", name:"Demo Caregiver", createdAt:"2027-01-01T15:00:00Z"};
  documents.set("workforceOpportunities/opening/existingCaregiverInterests/application", application);
  const recruitingGrant = {...grant, permissions:["opportunities.read","applicants.review"]};
  documents.set("workforceStaff/recruiter", recruitingGrant);
  documents.set("workforceStaff/outside", {...recruitingGrant, offices:["another-office"]});
  const detail = () => store.existingCaregiverApplicantProfile("recruiter", "opening", "application");
  const cached = {id:"101", office:dataForOffice.office, status:"Active", email:"caregiver@example.invalid", fetchedAt:"2027-01-01T14:00:00Z",
    fields:{"Address/HomePhone":"713-555-0101", "Address/City":"Houston", "Address/State":"TX",
      EmploymentDisciplines:'["PCA"]', SSN:"private", "Address/Street1":"private", DOB:"private", PayRate:"private"}};
  assert.equal((await detail()).profile, null);
  documents.set("workforceHhaProfiles/101", {...cached, office:"another-office"});
  assert.equal((await detail()).profile, null);
  documents.set("workforceHhaProfiles/101", cached);
  assert.deepEqual(await detail(), {
    name:application.name, caregiverId:"101", createdAt:application.createdAt, selection:null, canSelect:false,
    profile:{status:"Active",email:"caregiver@example.invalid",phone:"713-555-0101",location:"Houston, TX",disciplines:["PCA"],fetchedAt:cached.fetchedAt},
  });
  await assert.rejects(store.existingCaregiverApplicantProfile("recruiter", "other-opening", "application"), /application_not_found/);
  await assert.rejects(store.existingCaregiverApplicantProfile("outside", "opening", "application"), /workforce_forbidden/);
  await assert.rejects(store.existingCaregiverApplicantProfile("editor", "opening", "application"), /workforce_forbidden/);
  documents.set("workforceStaff/recruiter", {...recruitingGrant, active:false});
  await assert.rejects(detail(), /workforce_forbidden/);
});

test("selection atomically posts one notice for the chosen caregiver and rejects unauthorized or stale choices", async () => {
  const {store, documents, grant} = fixture();
  const draft = await store.mutate("editor", "opening", 0, data);
  const published = {...draft, state:"published", review:{revision:draft.revision, reviewer:"reviewer", at:"2027-01-01T14:00:00Z"}};
  const openingPath = "workforceOpportunities/opening";
  const applicationPath = openingPath + "/existingCaregiverInterests/";
  const link = {uid:"caregiver",office:draft.office,caregiverId:"101",emailKey:"verified-email-key"};
  documents.set(applicationPath + "candidate", {...link,name:"Demo Caregiver"});
  documents.set(applicationPath + "other", {...link,uid:"other",caregiverId:"102",name:"Other Caregiver"});
  documents.set("workforceStaff/recruiter", {...grant, permissions:[...grant.permissions,"applicants.review"]});
  documents.set("workforceStaff/viewer", {...grant, permissions:["opportunities.read","applicants.review"]});
  await assert.rejects(store.selectExistingCaregiver("recruiter","opening","candidate",draft.revision), /opportunity_unavailable/);
  documents.set(openingPath, published);
  await assert.rejects(store.selectExistingCaregiver("viewer","opening","candidate",draft.revision), /workforce_forbidden/);
  await assert.rejects(store.selectExistingCaregiver("recruiter","opening","candidate",draft.revision+1), /revision_conflict/);
  await assert.rejects(store.selectExistingCaregiver("recruiter","opening","candidate",draft.revision), /hha_profile_unavailable/);
  assert.deepEqual(await store.ownOpportunitySelections("caregiver"), {items:[]});
  documents.set("workforceHhaLinks/caregiver",link);
  documents.set("workforceHhaAssignments/101",link);
  const selection = () => store.selectExistingCaregiver("recruiter","opening","candidate",draft.revision);
  assert.deepEqual(await selection(), {selected:true});
  const state = structuredClone(documents);
  assert.deepEqual(await selection(), {selected:true});
  assert.deepEqual(documents, state);
  const notice = (await store.ownOpportunitySelections("caregiver")).items[0]!;
  assert.deepEqual(notice, {opportunityId:"opening",location:draft.public.location,weeklyHours:draft.public.weeklyHours,at:notice.at});
  assert.deepEqual(await store.ownOpportunitySelections("other"), {items:[]});
  assert.equal((await store.existingCaregiverApplicantProfile("recruiter","opening","candidate")).selection, "selected");
  await assert.rejects(store.selectExistingCaregiver("recruiter","opening","other",draft.revision), /opportunity_already_selected/);
  assert.equal((await store.existingCaregiverApplicantProfile("recruiter","opening","other")).selection, "another_selected");
  assert.deepEqual(documents.get(openingPath), published);
});

test("only the recipient can respond, and a declined opening can be offered to another applicant", async () => {
  const {store, documents, grant} = fixture();
  documents.set("workforceStaff/recruiter", {...grant, permissions:[...grant.permissions,"applicants.review"]});
  const taylor = {uid:"taylor",caregiverId:"101",office:data.office,emailKey:"taylor-link"};
  const other = {uid:"other",caregiverId:"102",office:data.office,emailKey:"other-link"};
  for (const caregiver of [taylor,other]) {
    documents.set("workforceHhaLinks/"+caregiver.uid, caregiver);
    documents.set("workforceHhaAssignments/"+caregiver.caregiverId, caregiver);
  }
  async function selectedOpening(id: string) {
    const draft = await store.mutate("editor",id,0,data);
    const opening = {...draft,state:"published",review:{revision:draft.revision,reviewer:"reviewer",at:"2027-01-01T14:00:00Z"}};
    const path = "workforceOpportunities/" + id;
    documents.set(path,opening);
    documents.set(path+"/existingCaregiverInterests/taylor-application", {...taylor, name:"Taylor Example"});
    documents.set(path+"/existingCaregiverInterests/other-application", {...other, name:"Other Example"});
    await store.selectExistingCaregiver("recruiter",id,"taylor-application",opening.revision);
    return {opening,path};
  }
  await selectedOpening("accept-opening");
  await assert.rejects(store.respondToOpportunitySelection("other","accept-opening","accepted"),/selection_not_found/);
  const accepted = await store.respondToOpportunitySelection("taylor","accept-opening","accepted");
  assert.equal(accepted.response,"accepted");
  const acceptedState = structuredClone(documents);
  assert.deepEqual(await store.respondToOpportunitySelection("taylor","accept-opening","accepted"),accepted);
  await assert.rejects(store.respondToOpportunitySelection("taylor","accept-opening","declined"),/opportunity_response_recorded/);
  assert.deepEqual(documents,acceptedState);
  assert.equal((await store.existingCaregiverApplicants("recruiter","accept-opening")).items.find(a=>a.name==="Taylor Example")?.response,"accepted");
  assert.equal((await store.ownOpportunitySelections("taylor")).items[0]?.response,"accepted");
  await assert.rejects(store.selectExistingCaregiver("recruiter","accept-opening","other-application",1),/opportunity_already_selected/);

  const {opening,path} = await selectedOpening("decline-opening");
  documents.set(path,{...opening, revision:2});
  await assert.rejects(store.respondToOpportunitySelection("taylor","decline-opening","accepted"),/opportunity_selection_changed/);
  const declined = await store.respondToOpportunitySelection("taylor","decline-opening","declined");
  assert.equal(declined.response,"declined");
  documents.set(path,opening);
  assert.equal((await store.existingCaregiverApplicantProfile("recruiter","decline-opening","other-application")).canSelect,true);
  await store.selectExistingCaregiver("recruiter","decline-opening","other-application",opening.revision);
  assert.deepEqual(await store.respondToOpportunitySelection("taylor","decline-opening","declined"),declined);
  assert.equal((await store.existingCaregiverApplicantProfile("recruiter","decline-opening","taylor-application")).response,"declined");
  assert.equal((await store.ownOpportunitySelections("other")).items[0]?.opportunityId,"decline-opening");
});

test("Phase 2 schedules require a filled accepted selection, preserve the recipient, reject conflicts and audit edits", async t => {
  const env = process.env, old = env.WORKFORCE_STAFF_LATER_MODULES_APPROVED;
  t.after(()=>{if(old === undefined) delete env.WORKFORCE_STAFF_LATER_MODULES_APPROVED; else env.WORKFORCE_STAFF_LATER_MODULES_APPROVED=old;});
  const {store, documents, grant} = fixture();
  const linked = {uid:"taylor",caregiverId:"101",office:data.office,emailKey:"key"};
  documents.set("workforceHhaLinks/taylor",linked);
  documents.set("workforceHhaAssignments/101",linked);
  documents.set("workforceStaff/office",{...grant,permissions:[...grant.permissions,"applicants.review"]});
  const plan={start:"2027-01-04",end:"",days:[1,2],from:"08:00",to:"14:00"};
  function save(id:string, revision=0, schedule=plan){return store.assignmentSchedule("office",id,"taylor-app",{revision,schedule});}
  for(const id of ["one","two"]){
    const opening=await store.mutate("editor",id,0,data);
    const path="workforceOpportunities/"+id;
    documents.set(path,{...opening,state:"published",review:{revision:1}});
    documents.set(path+"/existingCaregiverInterests/taylor-app",linked);
    await store.selectExistingCaregiver("office",id,"taylor-app",1);
  }
  env.WORKFORCE_STAFF_LATER_MODULES_APPROVED="";
  await assert.rejects(save("one"),/staff_phase_pending/);
  await assert.rejects(store.ownAssignmentSchedules("taylor"),/staff_phase_pending/);
  env.WORKFORCE_STAFF_LATER_MODULES_APPROVED="scheduling";
  await assert.rejects(save("one"),/accepted_assignment_required/);
  for(const id of ["one","two"]){
    await store.respondToOpportunitySelection("taylor",id,"accepted");
    await assert.rejects(save(id),/filled_assignment_required/);
    await store.mutate("editor",id,1,{},"close");
  }
  await assert.rejects(store.assignmentSchedule("editor","one","taylor-app",{revision:0,schedule:plan}),/workforce_forbidden/);
  await assert.rejects(save("one",0,{...plan,from:"09:00"}),/schedule_hours_mismatch/);
  await assert.rejects(save("one",0,{...plan,start:"2027-02-30"}),/invalid_assignment_schedule/);
  const confirmed=await save("one"), state=structuredClone(documents);
  assert.equal(confirmed.revision,1);
  assert.deepEqual(await save("one"),confirmed);
  assert.deepEqual(documents,state);
  await assert.rejects(save("two"),/assignment_schedule_conflict/);
  assert.equal((await store.ownAssignmentSchedules("taylor")).items[0]?.schedule.start,plan.start);
  await assert.rejects(store.ownAssignmentSchedules("other"),/hha_profile_unavailable/);
  const ended={...plan,end:"2027-01-05"};
  await assert.rejects(save("one",0,ended),/revision_conflict/);
  await store.mutate("editor","one",2,{},"archive");
  await save("one",1,ended);
  await save("two",0,{...plan,start:"2027-01-11"});
  assert.equal((await store.ownAssignmentSchedules("taylor")).items.length,2);
  const audit=[...documents].filter(([p,v])=>p.startsWith("workforceAudit/")&&(v as {action:string}).action==="assignment_schedule_confirmed");
  assert.equal(audit.length,3);
  documents.delete("workforceHhaAssignments/101");
  await assert.rejects(store.ownAssignmentSchedules("taylor"),/hha_profile_unavailable/);
});
test("owner can invite a work email before the Firebase account exists, and only its verified holder gets the selected permissions", async () => {
  const {store, documents, users, grant} = fixture();
  documents.set("workforceStaff/owner", {...grant, role: "owner", permissions: ["staff.manage"]});
  const email = "teammate@example.invalid";
  const now = Date.parse("2026-11-09T12:00:00Z");
  const hr = {...grant, role: "hr", permissions: ["applications.review"]};
  await assert.rejects(store.inviteStaff("editor", email, hr, now), /workforce_forbidden/);
  await assert.rejects(store.inviteStaff("owner", email, {...hr, offices:["other-office"]}, now), /workforce_forbidden/);
  const invite = await store.inviteStaff("owner", " TeamMate@example.invalid ", hr, now);
  assert.equal(invite.email, email);
  assert.match(invite.activationCode, /^[a-f0-9-]{36}$/);
  assert.equal(documents.has("workforceStaff/new-staff"), false);
  users.set("new-staff", {uid:"new-staff", email, emailVerified:false, disabled:false});
  await assert.rejects(store.acceptStaffInvite("new-staff", now), /verified_identity_required/);
  users.set("uninvited", {uid:"uninvited", email:"different@example.invalid", emailVerified:true, disabled:false});
  await assert.rejects(store.acceptStaffInvite("uninvited", now), /staff_invite_unavailable/);
  users.get("new-staff")!.emailVerified = true;
  assert.equal(await store.canRequestPasswordSetup(email), false);
  await assert.rejects(store.acceptStaffInvite("new-staff", now), /staff_invite_link_required/);
  assert.deepEqual(await store.acceptStaffInvite("new-staff", now, invite.activationCode), {uid:"new-staff", grant:hr});
  assert.deepEqual(documents.get("workforceStaffCredentials/new-staff"), {setupRequired:true});
  assert.equal(await store.canRequestPasswordSetup(email), true);
  assert.deepEqual(await store.acceptStaffInvite("new-staff", now), {uid:"new-staff", grant:hr});
  await assert.rejects(store.inviteStaff("owner", email, grant, now), /staff_already_registered/);
  assert.equal([...documents.values()].filter(value => (value as {action?:string}).action === "staff_invite_accepted").length, 1);
});

test("pending invitations stop after 24 hours or loss of the issuer's office scope", async () => {
  const {store, documents, users, grant} = fixture();
  const owner = {...grant, role:"owner", permissions:["staff.manage"]};
  documents.set("workforceStaff/owner", owner);
  const email = "teammate@example.invalid";
  const now = Date.parse("2026-11-09T12:00:00Z");
  users.set("new-staff", {uid:"new-staff", email, emailVerified:true, disabled:false});
  const invite = await store.inviteStaff("owner", email, grant, now);
  const day = 86_400_000;
  await assert.rejects(store.acceptStaffInvite("new-staff", now + day), /staff_invite_unavailable/);
  const key = [...documents.keys()].find(path => path.startsWith("workforceStaffInvitations/"))!;
  const { issuedAt: _, ...oldInvite } = documents.get(key) as { issuedAt: number };
  documents.set(key, { ...oldInvite, expiresAt: now + 7 * day });
  await assert.rejects(store.acceptStaffInvite("new-staff", now + day), /staff_invite_unavailable/);
  documents.set("workforceStaff/owner", {...owner, offices:["other-office"]});
  await assert.rejects(store.acceptStaffInvite("new-staff", now, invite.activationCode), /workforce_forbidden/);
  assert.equal(documents.has("workforceStaff/new-staff"), false);
});
