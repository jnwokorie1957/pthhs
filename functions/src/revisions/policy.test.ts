import assert from "node:assert/strict";
import test from "node:test";
import type { Versioned, WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError } from "../operations/reads.js";
import { RevisionConfiguration, defaultRevisionPolicy, type SourceContract } from "./policy.js";
import type { VerificationReceiptAcceptance } from "./verification.js";

class Repository implements Pick<WorkspaceRepository, "get" | "page" | "change"> {
  records = new Map<string, Versioned>(); actions: string[] = [];
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> { return structuredClone(this.records.get(collection + "/" + id) as T ?? null); }
  async page<T extends Versioned>(collection: string) { return { items: [...this.records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, value]) => structuredClone(value) as T), nextCursor: null }; }
  async change<T extends Versioned>(collection: string, id: string, expected: number, _actor: string, action: string, update: (prior: T | null) => T): Promise<T> {
    const key = collection + "/" + id, prior = this.records.get(key) as T ?? null;
    if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
    const next = update(structuredClone(prior)); this.records.set(key, structuredClone(next)); this.actions.push(action); return structuredClone(next);
  }
}
const NOW = "2026-10-10T17:20:00.000Z";
function setup() { const repo = new Repository(), configuration = new RevisionConfiguration(repo, "123", () => new Date(NOW)); return { repo, configuration }; }
function policy(overrides: Record<string, unknown> = {}) {
  return { revision: 0, monitoringEnabled: false, earlyReminderMinutes: null, quietHours: null, smsPolicyReference: "", supervisorRecipientRefs: [], tokenInstructions: null, tokenInstructionsReference: "", ...overrides };
}
function contact(overrides: Record<string, unknown> = {}) {
  return { id: "caregiver_6", revision: 0, kind: "caregiver", phone: "8324030094", firstName: "Synthetic", smsAllowed: true, optedOut: false, reviewReference: "Synthetic consent/source review", ...overrides };
}
function contract(): SourceContract {
  return { id: "owner", revision: 1, updatedAt: NOW, officeId: "123", version: "synthetic-source-v1", reviewReference: "Synthetic source review", validUntil: "2027-01-01T00:00:00Z",
    offsetsValidated: true, completeFieldSemantics: true, missingEvvMeansAbsent: true, serviceTimeBasis: "actual", nullEndMeansOpen: true, clockingAttemptFromEvv: true,
    fixedVisitTypes: ["synthetic-fixed"], variableVisitTypes: ["synthetic-variable"], clockingMethodField: null, tokenValues: [], callsAccepted: true, maxAgeSeconds: 300 };
}
test("policy defaults keep unresolved early threshold, monitoring and delivery configuration closed", async () => {
  const { configuration } = setup(), value = await configuration.policy();
  assert.deepEqual(value, defaultRevisionPolicy("123")); assert.equal(value.earlyReminderMinutes, null); assert.equal(value.monitoringEnabled, false);
  assert.equal(value.quietHours, null); assert.equal(value.tokenInstructions, null); assert.deepEqual(value.supervisorRecipientRefs, []);
});
test("policy updates require exact schema and optimistic revision; browser cannot approve source semantics", async () => {
  const { configuration, repo } = setup();
  for (const extra of [{ sourceAccepted: true }, { callsAccepted: true }, { completeFieldSemantics: true }, { version: "browser-trust" }, { verificationReceipt: { accepted: true } }]) await assert.rejects(configuration.savePolicy(policy(extra), "owner"), /unsupported_revision_field/);
  assert.equal(repo.records.size, 0);
  const first = await configuration.savePolicy(policy({ earlyReminderMinutes: 5 }), "owner");
  assert.equal(first.revision, 1); assert.equal(first.earlyReminderMinutes, 5);
  await assert.rejects(configuration.savePolicy(policy(), "owner"), /revision_conflict/);
  assert.equal((await configuration.policy()).earlyReminderMinutes, 5);
});
test("threshold, quiet hours, recipients and token instructions remain explicit reviewed configuration", async () => {
  for (const patch of [{ earlyReminderMinutes: 0 }, { earlyReminderMinutes: 1.5 }, { earlyReminderMinutes: "30" }, { quietHours: { startHour: 22, endHour: 22 } },
    { quietHours: { startHour: 24, endHour: 6 } }, { supervisorRecipientRefs: ["supervisor_1", "supervisor_1"] }, { tokenInstructions: "Use approved vendor method", tokenInstructionsReference: "" }]) {
    const { configuration, repo } = setup(); await assert.rejects(configuration.savePolicy(policy(patch), "owner")); assert.equal(repo.actions.length, 0);
  }
  const { configuration } = setup(), saved = await configuration.savePolicy(policy({ quietHours: { startHour: 22, endHour: 6 }, supervisorRecipientRefs: ["supervisor_1"], tokenInstructions: "Synthetic vendor instructions", tokenInstructionsReference: "Synthetic device contract" }), "owner");
  assert.deepEqual(saved.quietHours, { startHour: 22, endHour: 6 }); assert.equal(saved.tokenInstructionsReference, "Synthetic device contract");
});
test("server acceptance is absent by default and expired, offsetless, wrong-office or invalid contracts fail closed", async () => {
  const missing = setup(); assert.equal(await missing.configuration.sourceContract(), null);
  for (const patch of [{ validUntil: NOW }, { validUntil: "2027-01-01T00:00:00" }, { officeId: "124" }, { offsetsValidated: false }, { completeFieldSemantics: false },
    { maxAgeSeconds: 59 }, { maxAgeSeconds: 3601 }, { clockingMethodField: "StartLatitude" }, { callsAccepted: "true" }, { fixedVisitTypes: [1] }]) {
    const { configuration, repo } = setup(); repo.records.set("revisionSourceAcceptance_office_123/owner", { ...contract(), ...patch });
    assert.equal(await configuration.sourceContract(), null);
  }
  const accepted = setup(); accepted.repo.records.set("revisionSourceAcceptance_office_123/owner", contract());
  assert.equal((await accepted.configuration.sourceContract())?.version, "synthetic-source-v1");
});
test("contact normalization infers +1, persists consent/audit provenance and blocks stale revisions", async () => {
  for (const phone of ["8324030094", "(832) 403-0094", "+1-832-403-0094", "1 832 403 0094"]) {
    const { configuration } = setup(), saved = await configuration.saveContact(contact({ phone }), "reviewer");
    assert.equal(saved.phone, "+18324030094"); assert.equal(saved.reviewedBy, "reviewer"); assert.equal(saved.validatedAt, NOW);
    await assert.rejects(configuration.saveContact(contact({ phone }), "other"), /revision_conflict/);
    assert.equal((await configuration.contact("caregiver_6"))?.revision, 1);
  }
});

test("optional verification semantics are protected, version-bound and absent by default", async () => {
  const profile: VerificationReceiptAcceptance = { accepted: true, version: "synthetic-receipt-v1", sourceVersion: "synthetic-source-v1", reviewReference: "Synthetic receipt semantics",
    receiptMeansVerified: true, timestampEncoding: "explicit_offset" };
  const f = setup(); f.repo.records.set("revisionSourceAcceptance_office_123/owner", contract());
  assert.equal((await f.configuration.sourceContract())?.verificationReceipt, undefined);
  f.repo.records.set("revisionSourceAcceptance_office_123/owner", { ...contract(), verificationReceipt: profile } as SourceContract);
  assert.deepEqual((await f.configuration.sourceContract())?.verificationReceipt, profile);
  for (const patch of [{ sourceVersion: "different" }, { accepted: "true" }, { receiptMeansVerified: false }, { timestampEncoding: "wall_time" }, { absenceMeansUnverified: true }, { reviewReference: "" }]) {
    f.repo.records.set("revisionSourceAcceptance_office_123/owner", { ...contract(), verificationReceipt: { ...profile, ...patch } } as unknown as SourceContract);
    assert.equal(await f.configuration.sourceContract(), null);
  }
});
test("contact identity, country, kind and reviewed source cannot be overridden by malformed input", async () => {
  for (const patch of [{ id: "caregiver_0" }, { id: "arbitrary", kind: "caregiver" }, { phone: "+448324030094" }, { phone: "8324030094 ext 1" },
    { kind: "patient" }, { reviewReference: "" }, { smsAllowed: "true" }, { officeId: "124" }]) {
    const { configuration, repo } = setup(); await assert.rejects(configuration.saveContact(contact(patch), "owner")); assert.equal(repo.actions.length, 0);
  }
  const { configuration } = setup(); await configuration.saveContact(contact(), "owner");
  await assert.rejects(configuration.saveContact(contact({ revision: 1, kind: "supervisor" }), "owner"), /contact_kind_immutable/);
});
test("stored policy/contact scope mismatch is rejected rather than returned in another office", async () => {
  const { configuration, repo } = setup();
  repo.records.set("revisionPolicies_office_123/owner", { ...defaultRevisionPolicy("124") });
  await assert.rejects(configuration.policy(), /office_scope_mismatch/);
  const wrongOffice = { ...contact(), id: "caregiver_6", officeId: "124", recipientRef: "caregiver_6", revision: 1, updatedAt: NOW };
  repo.records.set("revisionContacts_office_123/caregiver_6", wrongOffice);
  await assert.rejects(configuration.contact("caregiver_6"), /office_scope_mismatch/);
});
