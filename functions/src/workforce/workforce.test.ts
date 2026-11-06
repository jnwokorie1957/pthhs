import assert from "node:assert/strict";
import test from "node:test";
import { requirePermission, parseGrant, type Actor, type Permission } from "./policy.js";
import { saveOpportunity, transition, publicOpportunity, type Opportunity } from "./opportunities.js";
import { saveApplication, submitApplication, type Packet } from "./application.js";
import { workforceIdentity } from "./auth.js";

const now = "2026-11-05T15:00:00.000Z";
const actor = (uid = "editor", permissions: Permission[] = ["opportunities.read", "opportunities.edit", "opportunities.review", "opportunities.publish"]): Actor => ({ uid, grant: { active: true, role: "office", offices: ["synthetic-office"], permissions } });
const data = () => ({ office: "synthetic-office", internalReference: "SYNTHETIC-ONLY", internalNotes: "Synthetic private staffing note", public: { location: "Synthetic recruiting area", recruitingZip: "77000", weeklyHours: 20, schedule: "weekdays", assistance: ["personal_care"], type: "assignment" } });
function published() {
  let o = saveOpportunity(actor(), null, "synthetic-1", 0, data(), now);
  o = transition(actor(), o, o.revision, "submit", false, now);
  o = transition(actor("reviewer"), o, o.revision, "approve", true, now);
  return transition(actor("publisher"), o, o.revision, "publish", false, now);
}
test("workforce roles require explicit permissions and office scope", () => {
  assert.throws(() => requirePermission(actor("supervisor", []), "opportunities.publish", "synthetic-office"));
  assert.throws(() => requirePermission(actor(), "opportunities.edit", "other-office"));
  assert.throws(() => requirePermission({ ...actor(), grant: { ...actor().grant, active: false } }, "opportunities.read"));
  assert.throws(() => requirePermission({ ...actor(), grant: { ...actor().grant, role: "owner", permissions: [] } }, "staff.manage"));
});
test("staff grants reject arbitrary roles, malformed scope and non-owner escalation", () => {
  for (const patch of [{ role: "admin" }, { offices: ["../other"] }, { permissions: ["staff.manage"] }, { admin: true }]) assert.throws(() => parseGrant({ ...actor().grant, ...patch }));
});
test("drafts never appear publicly; transitions require current revision", () => {
  const draft = saveOpportunity(actor(), null, "synthetic-1", 0, data(), now);
  assert.equal(publicOpportunity(draft), null);
  assert.throws(() => transition(actor(), draft, 0, "submit", false, now), /revision_conflict/);
  assert.throws(() => transition(actor(), draft, 1, "publish", false, now), /invalid_transition/);
});
test("approval requires independent privacy review even if a different person submits", () => {
  const draft = saveOpportunity(actor(), null, "synthetic-1", 0, data(), now);
  const review = transition(actor("submitter"), draft, 1, "submit", false, now);
  assert.throws(() => transition(actor(), review, 2, "approve", true, now), /independent_privacy_review_required/);
  assert.throws(() => transition(actor("reviewer"), review, 2, "approve", false, now));
});
test("only explicitly authorized reviewers and publishers can transition", () => {
  const draft = saveOpportunity(actor(), null, "synthetic-1", 0, data(), now);
  const review = transition(actor(), draft, 1, "submit", false, now);
  assert.throws(() => transition(actor("supervisor", ["opportunities.edit"]), review, 2, "approve", true, now));
  const approved = transition(actor("reviewer"), review, 2, "approve", true, now);
  assert.throws(() => transition(actor("supervisor", ["opportunities.review"]), approved, 3, "publish", false, now));
});
test("public allowlist excludes private staffing data, reviewer and office identifiers", () => {
  const o = published(), result = publicOpportunity({ ...o, confidentialExtra: "private" } as Opportunity);
  assert.deepEqual(Object.keys(result!).sort(), ["id", "location", "recruitingZip", "weeklyHours", "schedule", "assistance", "type", "status", "updatedAt"].sort());
  assert.ok(!JSON.stringify(result).includes("SYNTHETIC-ONLY"));
  assert.ok(!JSON.stringify(result).includes("private"));
});
test("editing published content immediately invalidates approval and publication", () => {
  const o = published(), edited = saveOpportunity(actor(), o, o.id, o.revision, data(), now);
  assert.equal(edited.state, "draft"); assert.equal(edited.review, null); assert.equal(publicOpportunity(edited), null);
  assert.throws(() => saveOpportunity(actor(), o, o.id, 0, data(), now));
  const crossOffice = data(); crossOffice.office = "other-office";
  assert.throws(() => saveOpportunity(actor(), o, o.id, o.revision, crossOffice, now));
});
test("closing and archiving removes availability; archived history cannot be overwritten", () => {
  const o = published(), closed = transition(actor(), o, o.revision, "close", false, now);
  assert.equal(publicOpportunity(closed), null);
  const archived = transition(actor(), closed, closed.revision, "archive", false, now);
  assert.throws(() => saveOpportunity(actor(), archived, o.id, archived.revision, data(), now), /opportunity_archived/);
  assert.equal(o.state, "published"); // Immutable previous version retained by caller/store.
});
test("public input rejects patient-specific keys, precise schedules and malformed ZIPs", () => {
  for (const patch of [{ patientName: "Synthetic" }, { recruitingZip: 77000 }, { recruitingZip: "77000-1000" }, { schedule: "Monday 08:15" }, { weeklyHours: 0 }, { location: "<img>" }, { assistance: ["diagnosis"] }]) {
    const d = data(); assert.throws(() => saveOpportunity(actor(), null, "id", 0, { ...d, public: { ...d.public, ...patch } }, now));
  }
  assert.throws(() => saveOpportunity(actor(), null, "id", 0, { ...data(), patient: "Synthetic" }, now));
  const d = data(); d.public.recruitingZip = "";
  assert.equal(saveOpportunity(actor(), null, "id", 0, d, now).public.recruitingZip, "");
});
test("stale privacy evidence never produces a public listing", () => {
  const o = published(); assert.equal(publicOpportunity({ ...o, revision: o.revision + 1 }), null);
});

const packet: Packet = { version: "synthetic-test-v1", approved: true, fields: [{ id: "synthetic-field", label: "Synthetic test field only", required: true, maxLength: 30 }] };
test("application framework waits for the approved packet and refuses unnecessary active-employee reapplication", () => {
  assert.throws(() => saveApplication("applicant", null, 0, { ...packet, approved: false }, {}, "applicant"), /approved_packet_required/);
  assert.throws(() => saveApplication("employee", null, 0, packet, {}, "active"), /active_employee_application_not_required/);
});
test("application drafts resume by the same UID with version and ownership protection", () => {
  const draft = saveApplication("applicant", null, 0, packet, {}, "applicant");
  assert.throws(() => saveApplication("other", draft, 1, packet, {}, "applicant"), /application_forbidden/);
  assert.throws(() => saveApplication("applicant", draft, 0, packet, {}, "applicant"), /revision_conflict/);
  assert.throws(() => saveApplication("applicant", draft, 1, { ...packet, version: "changed" }, {}, "applicant"), /packet_migration_review_required/);
  assert.throws(() => saveApplication("applicant", draft, 1, packet, { unapproved: "answer" }, "applicant"));
  const resumed = saveApplication("applicant", draft, 1, packet, { "synthetic-field": "Synthetic answer" }, "applicant");
  const submitted = submitApplication("applicant", resumed, packet, now);
  assert.equal(submitted.state, "submitted"); assert.equal(submitted.submittedAt, now);
  assert.throws(() => saveApplication("applicant", submitted, 3, packet, {}, "applicant"));
  assert.equal(draft.state, "draft"); assert.deepEqual(draft.answers, {});
});
test("application submission requires ownership and all approved required fields", () => {
  const draft = saveApplication("applicant", null, 0, packet, {}, "applicant");
  assert.throws(() => submitApplication("other", draft, packet, now));
  assert.throws(() => submitApplication("applicant", draft, packet, now), /application_incomplete/);
});
test("workforce authentication checks token revocation and current verified identity without granting roles", async () => {
  const checks: boolean[] = [];
  const auth = { verifyIdToken: async (_: string, revoked: boolean) => { checks.push(revoked); return { uid: "synthetic-user", email: "user@example.invalid", email_verified: true, admin: true }; }, getUser: async () => ({ uid: "synthetic-user", email: "user@example.invalid", emailVerified: true, disabled: false }) };
  const req = { get: () => "Bearer synthetic-token" };
  assert.equal(await workforceIdentity(req, auth as unknown as Parameters<typeof workforceIdentity>[1]), "synthetic-user");
  assert.deepEqual(checks, [true]);
  for (const patch of [{ disabled: true }, { emailVerified: false }, { email: "changed@example.invalid" }]) {
    const bad = { ...auth, getUser: async () => ({ ...await auth.getUser(), ...patch }) };
    await assert.rejects(workforceIdentity(req, bad as unknown as Parameters<typeof workforceIdentity>[1]));
  }
  await assert.rejects(workforceIdentity({ get: () => undefined }, auth as unknown as Parameters<typeof workforceIdentity>[1]));
  await assert.rejects(workforceIdentity(req, { ...auth, verifyIdToken: async () => { throw Error("revoked"); } } as unknown as Parameters<typeof workforceIdentity>[1]));
});
