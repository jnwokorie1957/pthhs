import test from "node:test";
import assert from "node:assert/strict";
import { WorkforceStore } from "./store.js";
import type { Opportunity } from "./opportunities.js";
import type { Grant } from "./policy.js";
import type { Auth } from "firebase-admin/auth";
function fixture() {
  const documents = new Map<string, unknown>();
  const users = new Map<string, { uid: string; email: string; emailVerified: boolean; disabled: boolean }>();
  const queries: { path: string; field: string; value: unknown }[] = [];
  function collection(path: string): unknown {
    return {
      doc: (id: string) => {
        const key = path + "/" + id;
        return { id, path: key, collection: (child: string) => collection(key + "/" + child),
          get: async () => ({ exists: documents.has(key), data: () => structuredClone(documents.get(key)) }) };
      },
      where: (field: string, _: string, value: unknown) => ({ limit: () => ({ get: async () => {
        queries.push({ path, field, value });
        return { docs: [...documents].filter(([key, data]) => key.startsWith(path + "/") && key.split("/").length === 2 && (data as Record<string, unknown>)[field] === value).map(([, data]) => ({ data: () => structuredClone(data) })) };
      } }) })
    };
  }
  // Transaction contract test double: changes commit together only after success.
  // This is not a substitute for Firestore emulator or production acceptance.
  const db = {
    collection,
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const writes: [string, unknown][] = [];
      const result = await fn({ get: async (ref: { path: string }) => ({ exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) }),
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
    async getUserByEmail(email: string) {
      const user = [...users.values()].find(value => value.email === email);
      if (!user) throw Object.assign(Error(), {code: "auth/user-not-found"});
      return user;
    }
  };
  return { store: new WorkforceStore(db as unknown as ConstructorParameters<typeof WorkforceStore>[0], () => auth as unknown as Auth), documents, users, queries, grant };
}
const data = { office: "synthetic-office", internalReference: "synthetic-reference", internalNotes: "Synthetic only", public: { location: "Synthetic area", recruitingZip: "", weeklyHours: 12, schedule: "flexible", assistance: ["respite"], type: "assignment" } };
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

test("owner can invite a work email before the Firebase account exists, and only its verified holder gets the selected permissions", async () => {
  const {store, documents, users, grant} = fixture();
  documents.set("workforceStaff/owner", {...grant, role: "owner", permissions: ["staff.manage"]});
  const email = "teammate@example.invalid";
  const now = Date.parse("2026-11-09T12:00:00Z");
  const hr = {...grant, role: "hr", permissions: ["applications.review"]};
  await assert.rejects(store.inviteStaff("editor", email, hr, now), /workforce_forbidden/);
  await assert.rejects(store.inviteStaff("owner", email, {...hr, offices:["other-office"]}, now), /workforce_forbidden/);
  assert.deepEqual(await store.inviteStaff("owner", " TeamMate@example.invalid ", hr, now), {email});
  assert.equal(documents.has("workforceStaff/new-staff"), false);
  users.set("new-staff", {uid:"new-staff", email, emailVerified:false, disabled:false});
  await assert.rejects(store.acceptStaffInvite("new-staff", now), /verified_identity_required/);
  users.set("uninvited", {uid:"uninvited", email:"different@example.invalid", emailVerified:true, disabled:false});
  await assert.rejects(store.acceptStaffInvite("uninvited", now), /staff_invite_unavailable/);
  users.get("new-staff")!.emailVerified = true;
  assert.deepEqual(await store.acceptStaffInvite("new-staff", now), {uid:"new-staff", grant:hr});
  assert.deepEqual(await store.acceptStaffInvite("new-staff", now), {uid:"new-staff", grant:hr});
  await assert.rejects(store.inviteStaff("owner", email, grant, now), /staff_already_registered/);
  assert.equal([...documents.values()].filter(value => (value as {action?:string}).action === "staff_invite_accepted").length, 1);
});

test("pending invitations stop at expiry, cancellation or loss of the issuer's office scope", async () => {
  const {store, documents, users, grant} = fixture();
  const owner = {...grant, role:"owner", permissions:["staff.manage"]};
  documents.set("workforceStaff/owner", owner);
  const email = "teammate@example.invalid";
  const now = Date.parse("2026-11-09T12:00:00Z");
  users.set("new-staff", {uid:"new-staff", email, emailVerified:true, disabled:false});
  await store.inviteStaff("owner", email, grant, now);
  await assert.rejects(store.acceptStaffInvite("new-staff", now + 7 * 86400000), /staff_invite_unavailable/);
  await assert.rejects(store.cancelStaffInvite("editor", email), /workforce_forbidden/);
  await store.cancelStaffInvite("owner", email);
  await assert.rejects(store.acceptStaffInvite("new-staff", now), /staff_invite_unavailable/);
  await store.inviteStaff("owner", email, grant, now);
  documents.set("workforceStaff/owner", {...owner, offices:["other-office"]});
  await assert.rejects(store.acceptStaffInvite("new-staff", now), /workforce_forbidden/);
  assert.equal(documents.has("workforceStaff/new-staff"), false);
});
