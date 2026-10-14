import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { OperationsWorkspace, type Settings, type Versioned, type WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError, readRequest, type OperationalRead, type ReadInput } from "../operations/reads.js";
import { defaultRevisionPolicy, type RevisionPolicy, type SourceContract } from "./policy.js";
import type { CallMatchRecord } from "./records.js";
import { RevisionBackend, officeDate, type RevisionActor, type RevisionApprovals } from "./service.js";
import type { MonitorPlanState } from "./monitorPlan.js";

class MemoryRepository implements WorkspaceRepository {
  records = new Map<string, Versioned>();
  audit: { collection: string; action: string; actor: string }[] = [];
  reads: string[] = [];
  failCollection: string | null = null;
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> { this.reads.push(collection); return structuredClone(this.records.get(collection + "/" + id) as T ?? null); }
  async list<T extends Versioned>(collection: string): Promise<T[]> { return [...this.records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, item]) => structuredClone(item) as T); }
  async page<T extends Versioned>(collection: string, cursor?: string) {
    const all = await this.list<T>(collection), offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) throw new WorkflowError("invalid_page_cursor");
    return { items: all.slice(offset, offset + 100), nextCursor: offset + 100 < all.length ? String(offset + 100) : null };
  }
  async change<T extends Versioned>(collection: string, id: string, expected: number, actor: string, action: string, update: (prior: T | null) => T): Promise<T> {
    if (collection === this.failCollection) throw new WorkflowError("synthetic_call_transaction_failed", 503);
    const key = collection + "/" + id, prior = this.records.get(key) as T ?? null;
    if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
    const next = update(structuredClone(prior)); this.records.set(key, structuredClone(next)); this.audit.push({ collection, actor, action }); return structuredClone(next);
  }
  async reserveRead() {} async deferReads(_seconds: number) {}
  async getWriteTarget() { return null; } async reserveWriteTarget() {} async releaseWriteTarget() {}
}
const NOW = "2026-10-10T17:20:00.000Z";
const actor: RevisionActor = { actorId: "synthetic-supervisor", roles: ["office_supervisor"], mode: "live" };
function source(operation: ReadInput["operation"], records: Record<string, string | null>[], truncated = false): OperationalRead {
  return { operation, records, truncated, source: "hhaexchange", fetchedAt: NOW, validation: "source_unvalidated", timezone: "source_values_unconverted" };
}
function detail(id: string, fields: Record<string, string | null> = {}) {
  return source("GetVisitInfoV3", [{ ID: id, VisitDate: "2026-10-10", "Patient/ID": "5", "Caregiver/ID": "6", VisitType: "synthetic-fixed",
    ScheduleStartTime: "2026-10-10T08:00:00-05:00", ScheduleEndTime: "2026-10-10T12:00:00-05:00",
    VisitStartTime: "2026-10-10T08:00:00-05:00", VisitEndTime: "2026-10-10T12:00:00-05:00",
    EVVStartTime: "2026-10-10T08:00:00-05:00", EVVEndTime: "2026-10-10T12:00:00-05:00", ...fields }]);
}
function contract(): SourceContract {
  return { id: "owner", officeId: "123", revision: 1, updatedAt: NOW, version: "synthetic-accepted-v1", reviewReference: "Synthetic acceptance only", validUntil: "2027-01-01T00:00:00Z",
    offsetsValidated: true, completeFieldSemantics: true, missingEvvMeansAbsent: true, serviceTimeBasis: "actual", nullEndMeansOpen: true, clockingAttemptFromEvv: true,
    fixedVisitTypes: ["synthetic-fixed"], variableVisitTypes: ["synthetic-variable"], clockingMethodField: null, tokenValues: [], callsAccepted: true, maxAgeSeconds: 300 };
}
function setup(options: { approvals?: Partial<RevisionApprovals>; workspaceData?: boolean; accepted?: boolean; monitoring?: boolean } = {}) {
  const repo = new MemoryRepository(), calls: ReadInput[] = [], approvals: RevisionApprovals = { data: true, source: true, monitor: true, smsCapability: false, smsConfiguration: false, smsSend: false, ...options.approvals };
  const settings: Settings = { id: "owner", revision: 2, updatedAt: NOW, officeId: "123", officeTimezone: "America/Chicago", enabledReads: ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics", "GetCallDashBoardData"], policyReference: "Synthetic owner review", missingClockInMinutes: null, missingClockOutMinutes: null };
  repo.records.set("workspaceSettings/owner", settings);
  repo.records.set("revisionPolicies_office_123/owner", { ...defaultRevisionPolicy("123"), revision: 1, updatedAt: NOW, monitoringEnabled: options.monitoring ?? false } as RevisionPolicy);
  if (options.accepted !== false) repo.records.set("revisionSourceAcceptance_office_123/owner", contract());
  let now = new Date(NOW), sends = 0, patientOffice = "123";
  let handler: (input: ReadInput) => Promise<OperationalRead> = async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
    : input.operation === "GetVisitInfoV3" ? detail(input.id!) : source("GetCallDashBoardData", [{ CallDashboardID: "33", "Patient/ID": "5", "Caregiver/ID": "6", CallTime: "2026-10-10T08:00:00-05:00", CallType: "synthetic-in", CallStatus: "synthetic-status" }]);
  const workspace = new OperationsWorkspace(repo, async input => { readRequest(input); calls.push(structuredClone(input)); return input.operation === "GetPatientDemographics" ? source(input.operation, [{ PatientID: input.id!, OfficeID: patientOffice }]) : handler(input); }, options.workspaceData ?? true);
  const backend = new RevisionBackend(repo, workspace, approvals, { submit: async () => { sends++; return { state: "unknown", providerId: null }; }, reconcile: async () => ({ state: "unknown", providerId: null }) }, () => now);
  return { setPatientOffice: (office: string) => { patientOffice = office; }, repo, backend, calls, settings, approvals, sends: () => sends, clock: () => new Date(now), setClock: (value: string) => { now = new Date(value); }, setRead: (read: typeof handler) => { handler = read; }, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}
const prepare = { id: "synthetic-match", revision: 0, date: "2026-10-10", visitId: "77", lastId: "0", note: "Synthetic matching evidence" };
const decide = { id: "synthetic-match", revision: 1, officeId: "123", action: "match", callId: "33", reason: "Synthetic human review" };

test("disabled data/source/monitor gates and an unconfigured monitoring policy dispatch no HHA or SMS", async () => {
  for (const approvals of [{ data: false }, { source: false }, { monitor: false }] as Partial<RevisionApprovals>[]) {
    const f = setup({ approvals, monitoring: true });
    assert.deepEqual(await f.backend.monitor(), { state: "disabled", processed: 0 });
    assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0); assert.equal(f.repo.reads.some(key => key.startsWith("revisionContacts_")), false);
    assert.equal(f.repo.audit.length, 0);
  }
  const noPolicy = setup(), noContract = setup({ accepted: false, monitoring: true });
  for (const f of [noPolicy, noContract]) { assert.equal((await f.backend.monitor()).state, "disabled"); assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0); }
});
test("data approval and Live management roles reject protected visits before dispatch", async () => {
  for (const f of [setup({ approvals: { data: false } }), setup({ workspaceData: false })]) {
    await assert.rejects(f.backend.visits(actor, { date: "2026-10-10" }), /operational_data_release_not_approved/); assert.equal(f.calls.length, 0);
  }
  const f = setup();
  await assert.rejects(f.backend.visits({ ...actor, mode: "demo" }, { date: "2026-10-10" }), /demo_revision_actions_disabled/);
  await assert.rejects(f.backend.visits({ ...actor, roles: ["caregiver"] }, { date: "2026-10-10" }), /revision_management_role_required/);
  assert.equal(f.calls.length, 0);
});
test("status reads safe capability metadata without HHA or contact dispatch", async () => {
  const f = setup({ approvals: { source: false } }), status = await f.backend.status(actor);
  assert.equal(status.capabilities.diagnosis, false); assert.equal(status.capabilities.sms, false); assert.equal(status.sourceAcceptance, null);
  assert.equal(status.sourceWritesEnabled, false); assert.equal(status.earlyReminderConfigured, false); assert.equal(f.calls.length, 0);
  assert.equal(f.repo.reads.some(key => key.startsWith("revisionContacts_")), false);
});
test("a closed source-acceptance gate keeps explicit previews raw and diagnoses unknown", async () => {
  const f = setup({ approvals: { source: false } });
  f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : detail(input.id!, { ScheduleStartTime: "08:00", EVVStartTime: null, EVVEndTime: null }));
  const result = await f.backend.visits(actor, { date: "2026-10-10" }), item = result.items[0]!;
  assert.equal(item.evidence.state, "unaccepted"); assert.equal(item.evidence.raw?.ScheduleStartTime, "08:00");
  assert.equal(item.diagnosis.state, "unknown"); assert.equal(item.diagnosis.verification, "unknown");
  assert.deepEqual(item.diagnosis.issues.map(issue => issue.kind), ["source_evidence_unknown"]); assert.equal(result.completeness.complete, false);
  assert.equal(f.sends(), 0);
});
test("HHA receipt interpretation needs independent protected acceptance and never bypasses unresolved verification checks", async () => {
  const f = setup();
  f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : detail(input.id!, {
    "Verification/VerifiedBy": "Synthetic reviewer", "Verification/VerifiedDate": "2026-10-10T17:10:00Z", "Verification/VerifiedTime": "17:10", "Verification/SupervisorName": "Synthetic supervisor", "Verification/Notes": "Synthetic receipt only" }));
  const pending = (await f.backend.visits(actor, { date: "2026-10-10" })).items[0]!;
  assert.equal(pending.evidence.verification, "unknown"); assert.equal(pending.evidence.verificationReceipt!.receipt.verifiedBy, "Synthetic reviewer");
  const accepted: SourceContract = { ...contract(), verificationReceipt: { accepted: true, version: "receipt-v1", sourceVersion: contract().version,
    reviewReference: "Synthetic receipt semantics review", receiptMeansVerified: true, timestampEncoding: "explicit_offset" } };
  f.repo.records.set("revisionSourceAcceptance_office_123/owner", accepted);
  const item = (await f.backend.visits(actor, { date: "2026-10-10" })).items[0]!;
  assert.equal(item.evidence.verification, "verified"); assert.equal(item.evidence.verificationReceipt!.state, "ready");
  assert.equal(item.evidence.verificationReceipt!.verifiedAt!.iso, "2026-10-10T17:10:00.000Z");
  assert.equal(item.diagnosis.sourceVerification, "verified"); assert.equal(item.diagnosis.verification, "unknown");
  assert.ok(item.diagnosis.issues.some(issue => issue.kind === "eligibility_unknown")); assert.equal(f.sends(), 0);
  f.approvals.source = false;
  const closed = (await f.backend.visits(actor, { date: "2026-10-10" })).items[0]!;
  assert.equal(closed.evidence.verification, "unknown"); assert.equal(closed.evidence.verificationReceipt!.state, "unknown");
});

test("accepted explicit-offset source reports overage and early factual notes with default reminder null", async () => {
  const f = setup();
  f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }, { VisitID: "78" }])
    : detail(input.id!, input.id === "77" ? { VisitEndTime: "2026-10-10T12:20:00-05:00", EVVEndTime: "2026-10-10T12:20:00-05:00" }
      : { "Caregiver/ID": "7", "Patient/ID": "8", VisitEndTime: "2026-10-10T11:20:00-05:00", EVVEndTime: "2026-10-10T11:20:00-05:00" }));
  const result = await f.backend.visits(actor, { date: "2026-10-10" });
  assert.equal(result.items[0]?.evidence.state, "ready"); assert.equal(result.items[0]?.diagnosis.metrics.varianceMinutes, 20);
  assert.equal(result.items[0]?.diagnosis.issues.find(issue => issue.kind === "recorded_overage")?.officeTargetHours, 24);
  const early = result.items[1]!.diagnosis.issues.find(issue => issue.kind === "early_end")!;
  assert.equal(early.caregiverReminder, false); assert.equal(early.officeFollowUp, false); assert.deepEqual(early.reasonCodeCandidates, ["110A"]);
  assert.match(early.suggestedNote!, /recorded service time is preserved/); assert.equal(f.sends(), 0);
});
test("invalid query, wrong office/date/source identity and changed pagination discovery are rejected", async () => {
  for (const query of [{ date: "2026-02-30" }, { date: "2026-10-10", officeId: "124" }, { date: "2026-10-10", acceptance: true }, { date: "2026-10-10", limit: "11" }]) {
    const f = setup(); await assert.rejects(f.backend.visits(actor, query)); assert.equal(f.calls.length, 0);
  }
  for (const change of [{ OfficeID: "124" }, { VisitDate: "2026-10-11" }, { ID: "78" }]) {
    const f = setup(); f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : detail(input.id!, change));
    await assert.rejects(f.backend.visits(actor, { date: "2026-10-10" }), /visit_evidence_(?:office|date|identity)/);
  }
  const f = setup(); await assert.rejects(f.backend.visits(actor, { date: "2026-10-10", offset: "1", discovery: "wrong" }), /revision_discovery_changed_restart/);
  assert.deepEqual(f.calls.map(call => call.operation), ["SearchVisitsV2"]);
});
test("office, owner revision, policy and source-acceptance changes fence pending source facts", async () => {
  for (const mutation of ["office", "settings", "policy", "contract"] as const) {
    const f = setup(); f.setRead(async input => {
      if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }]);
      if (mutation === "office") f.repo.records.set("workspaceSettings/owner", { ...f.settings, officeId: "124", revision: 3 } as Settings);
      if (mutation === "settings") f.repo.records.set("workspaceSettings/owner", { ...f.settings, revision: 3 });
      if (mutation === "policy") f.repo.records.set("revisionPolicies_office_123/owner", { ...defaultRevisionPolicy("123"), revision: 2, updatedAt: NOW });
      if (mutation === "contract") f.repo.records.set("revisionSourceAcceptance_office_123/owner", { ...contract(), revision: 2, version: "synthetic-changed" } as SourceContract);
      return detail(input.id!);
    });
    await assert.rejects(f.backend.visits(actor, { date: "2026-10-10" }), /revision_policy_changed_restart/);
    assert.equal(f.repo.audit.some(entry => entry.collection.startsWith("revisionDiagnoses_")), false);
  }
});
test("protected contact updates infer +1 and reject stale revision without source or SMS calls", async () => {
  const f = setup(), input = { id: "caregiver_6", revision: 0, kind: "caregiver", phone: "832-403-0094", firstName: "Synthetic", smsAllowed: true, optedOut: false, reviewReference: "Synthetic consent review" };
  const result = await f.backend.contacts(actor, input);
  assert.ok("phone" in result); assert.equal(result.phone, "+18324030094");
  await assert.rejects(f.backend.contacts(actor, input), /revision_conflict/);
  assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0);
});
test("call discovery requires an explicit source boundary and retains it for matching rechecks", async () => {
  for (const lastId of [undefined, "-1", "2147483648", "00"]) {
    const f = setup(); await assert.rejects(f.backend.callCandidates(actor, { ...prepare, lastId }), /explicit_call_source_boundary_required/); assert.equal(f.calls.length, 0);
  }
  const f = setup(), candidate = await f.backend.callCandidates(actor, prepare);
  assert.equal(candidate.state, "candidate"); assert.equal(candidate.sourceValidation, "accepted");
  assert.equal(f.calls[3]?.lastId, "0");
  const matched = await f.backend.decideCallMatch(actor, decide);
  assert.equal(matched.state, "matched"); assert.equal(matched.hhaVerification, "not_established");
  assert.equal(f.calls.at(-1)?.lastId, "0"); assert.deepEqual(f.calls.slice(4).map(call => call.operation), ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics", "GetCallDashBoardData"]);
  assert.equal(f.sends(), 0);
});
test("a changed visit or call prevents matching and preserves the candidate audit state", async () => {
  for (const change of ["visit", "call"] as const) {
    const f = setup(); await f.backend.callCandidates(actor, prepare);
    f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : input.operation === "GetVisitInfoV3"
      ? detail(input.id!, change === "visit" ? { VisitEndTime: "2026-10-10T11:59:00-05:00" } : {})
      : source("GetCallDashBoardData", [{ CallDashboardID: "33", "Patient/ID": "5", "Caregiver/ID": "6", CallTime: "2026-10-10T08:01:00-05:00", CallType: "synthetic-in", CallStatus: "synthetic-status" }]));
    await assert.rejects(f.backend.decideCallMatch(actor, decide), /call_match_source_changed/);
    assert.equal((await (await f.backend.records(actor)).get<CallMatchRecord>("callMatches", prepare.id))?.state, "candidate");
  }
});
test("wrong-office matching rejects before protected HHA rechecks", async () => {
  const f = setup(); await f.backend.callCandidates(actor, prepare); const before = f.calls.length;
  await assert.rejects(f.backend.decideCallMatch(actor, { ...decide, officeId: "124" }), /office_scope_mismatch/);
  assert.equal(f.calls.length, before);
});
test("stale call-source evidence cannot become an accepted match", async () => {
  const f = setup(); f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : input.operation === "GetVisitInfoV3" ? detail(input.id!)
    : { ...source("GetCallDashBoardData", [{ CallDashboardID: "33", "Patient/ID": "5", "Caregiver/ID": "6", CallTime: "2026-10-10T08:00:00-05:00", CallType: "synthetic-in" }]), fetchedAt: "2026-10-10T17:14:59Z" });
  await assert.rejects(f.backend.callCandidates(actor, prepare), /call_source_not_fresh/);
});
test("monitor with accepted data and closed SMS gates persists diagnoses but never loads contacts or sends", async () => {
  for (const closedGate of ["smsCapability", "smsConfiguration", "smsSend"] as const) {
    const f = setup({ monitoring: true, approvals: { smsCapability: true, smsConfiguration: true, smsSend: true, [closedGate]: false } });
    f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : detail(input.id!, { VisitEndTime: "2026-10-10T12:20:00-05:00", EVVEndTime: "2026-10-10T12:20:00-05:00" }));
    const result = await f.backend.monitor(); assert.equal(result.processed, 1); assert.equal(result.state, "partial_window");
    assert.equal(f.repo.audit.some(entry => entry.collection.startsWith("revisionDiagnoses_")), true);
    assert.equal(f.repo.reads.some(key => key.startsWith("revisionContacts_")), false); assert.equal(f.sends(), 0);
    assert.equal(f.repo.audit.some(entry => entry.action === "monitor_completed"), true);
  }
});
test("a held monitor lease stops duplicate dispatch and leaves the prior checkpoint intact", async () => {
  const f = setup({ monitoring: true }), held = { id: "checkpoint", revision: 1, updatedAt: NOW, officeId: "123", dayOffset: 0, offset: 0, discovery: null,
    leaseUntil: "2026-10-10T17:21:00Z", lastRunState: "running" };
  f.repo.records.set("revisionMonitor_office_123/checkpoint", held);
  assert.deepEqual(await f.backend.monitor(), { state: "already_running", processed: 0 });
  assert.equal(f.calls.length, 0); assert.deepEqual(f.repo.records.get("revisionMonitor_office_123/checkpoint"), held);
});
test("batch time budget returns only attempted visits and leaves deferred IDs at the next cursor", async t => {
  let elapsed = 0; t.mock.method(performance, "now", () => elapsed);
  const f = setup(); f.setRead(async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }, { VisitID: "78" }, { VisitID: "79" }]);
    elapsed = 25000; return detail(input.id!);
  });
  const result = await f.backend.visits(actor, { date: "2026-10-10" });
  assert.equal(f.calls.filter(call => call.operation === "GetVisitInfoV3").length, 1);
  assert.deepEqual(result.items.map(item => item.evidence.visitId), ["77"]);
  assert.equal(result.nextOffset, 1);
  assert.deepEqual(result.completeness, { complete: false, truncated: false, selectedCount: 3, pageSelectedCount: 3, attemptedCount: 1, evaluatedCount: 1, deferredCount: 2 });
  assert.equal(result.items.some(item => item.evidence.reasons.includes("not_attempted_batch_time_budget")), false);
});

test("bounded partial pages retry every deferred visit in order without skipping or duplicating an attempted ID", async t => {
  let elapsed = 0; t.mock.method(performance, "now", () => elapsed);
  const f = setup(), ids = ["77", "78", "79"];
  f.setRead(async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, ids.map(VisitID => ({ VisitID })));
    elapsed += 25000; return detail(input.id!);
  });
  let offset = 0, fingerprint: string | null = null;
  const seen: string[] = [];
  for (let page = 0; page < ids.length; page++) {
    const result = await f.backend.visits(actor, { date: "2026-10-10", offset: String(offset), ...(fingerprint ? { discovery: fingerprint } : {}) });
    seen.push(...result.items.map(item => item.evidence.visitId));
    assert.equal(result.completeness.attemptedCount, 1); assert.equal(result.completeness.evaluatedCount, 1);
    assert.equal(result.completeness.deferredCount, ids.length - page - 1);
    assert.equal(result.nextOffset, page < ids.length - 1 ? offset + 1 : null);
    if (result.nextOffset !== null) { offset = result.nextOffset; fingerprint = result.discovery; }
  }
  assert.deepEqual(seen, ids);
  assert.deepEqual(f.calls.filter(call => call.operation === "GetVisitInfoV3").map(call => call.id), ids);
  assert.equal(f.calls.filter(call => call.operation === "SearchVisitsV2").length, 3); assert.equal(f.sends(), 0);
});

test("zero-attempt pages return retryable failure without inventing same-offset success or any detail reads", async t => {
  let elapsed = 0; t.mock.method(performance, "now", () => elapsed);
  const f = setup(), ids = ["77", "78", "79"], fingerprint = discoveryHash(ids);
  f.setRead(async input => { elapsed += 25000; return source(input.operation, ids.map(VisitID => ({ VisitID }))); });
  const query = { date: "2026-10-10", offset: "1", discovery: fingerprint };
  await assert.rejects(f.backend.visits(actor, query), error => error instanceof WorkflowError && error.code === "revision_batch_time_budget_deferred" && error.status === 429 && error.retryAfterSeconds === 60);
  assert.deepEqual(f.calls.map(call => call.operation), ["SearchVisitsV2"]); assert.equal(f.repo.audit.filter(entry => entry.collection.startsWith("revisionDiagnoses_")).length, 0);
  f.setRead(async input => input.operation === "SearchVisitsV2" ? source(input.operation, ids.map(VisitID => ({ VisitID }))) : detail(input.id!));
  const retry = await f.backend.visits(actor, query);
  assert.deepEqual(retry.items.map(item => item.evidence.visitId), ["78", "79"]); assert.equal(retry.nextOffset, null);
  assert.equal(retry.completeness.attemptedCount, 2); assert.equal(retry.completeness.deferredCount, 0);
});

test("an attempted source failure advances its own ID but never counts later deferred IDs as evaluated", async t => {
  let elapsed = 0; t.mock.method(performance, "now", () => elapsed);
  const f = setup(); f.setRead(async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }, { VisitID: "78" }]);
    elapsed += 25000; throw new WorkflowError("synthetic_source_unavailable", 503);
  });
  const result = await f.backend.visits(actor, { date: "2026-10-10" });
  assert.equal(result.items.length, 1); assert.equal(result.items[0]!.evidence.visitId, "77"); assert.equal(result.items[0]!.evidence.state, "failed");
  assert.equal(result.items[0]!.diagnosis.state, "unknown"); assert.equal(result.items[0]!.diagnosis.issues.some(issue => issue.kind === "no_punches"), false);
  assert.equal(result.nextOffset, 1); assert.equal(result.completeness.attemptedCount, 1); assert.equal(result.completeness.deferredCount, 1);
  assert.deepEqual(f.calls.filter(call => call.operation === "GetVisitInfoV3").map(call => call.id), ["77"]);
});
test("office-local service dates are stable across UTC midnight and daylight-saving boundaries", () => {
  assert.equal(officeDate(new Date("2026-10-11T00:10:00Z"), "America/Chicago"), "2026-10-10");
  assert.equal(officeDate(new Date("2026-11-01T07:30:00Z"), "America/Chicago"), "2026-11-01");
});

const MONITOR_CHECKPOINT = "revisionMonitor_office_123/checkpoint";
interface TestMonitorCheckpoint extends Versioned { officeId: string; plan: MonitorPlanState; leaseUntil: string; lastRunState: string; tokenCursor: string | null; notificationCursor: string | null; }
function monitorState(overrides: Partial<MonitorPlanState> = {}): MonitorPlanState {
  return { currentDate: "2026-10-10", currentOffset: 0, currentDiscovery: null, backfillDayOffset: 1, backfillOffset: 0, backfillDiscovery: null, turn: 0, ...overrides };
}
function seedMonitor(f: ReturnType<typeof setup>, plan: MonitorPlanState) {
  f.repo.records.set(MONITOR_CHECKPOINT, { id: "checkpoint", officeId: "123", revision: 4, updatedAt: NOW, leaseUntil: new Date(0).toISOString(), lastRunState: "partial_window", plan, tokenCursor: null, notificationCursor: null } as TestMonitorCheckpoint);
}
function monitorCheckpoint(f: ReturnType<typeof setup>): TestMonitorCheckpoint { return f.repo.records.get(MONITOR_CHECKPOINT) as TestMonitorCheckpoint; }
function discoveryHash(ids: readonly string[]) { return createHash("sha256").update(JSON.stringify([...ids].sort((a, b) => Number(a) - Number(b)))).digest("hex"); }
function monitoringSource(f: ReturnType<typeof setup>, ids: readonly string[]) {
  let serviceDate = "2026-10-10";
  f.setRead(async input => {
    if (input.operation === "SearchVisitsV2") {
      serviceDate = input.date!;
      return { ...source(input.operation, ids.map(VisitID => ({ VisitID }))), fetchedAt: f.clock().toISOString() };
    }
    const fields = Object.fromEntries(["ScheduleStartTime", "VisitStartTime", "EVVStartTime"].map(key => [key, `${serviceDate}T08:00:00-05:00`]));
    for (const key of ["ScheduleEndTime", "VisitEndTime", "EVVEndTime"]) fields[key] = `${serviceDate}T12:00:00-05:00`;
    return { ...detail(input.id!, { VisitDate: serviceDate, ...fields }), fetchedAt: f.clock().toISOString() };
  });
}

test("monitor prioritizes today's independent ten-visit pages for three runs then backfills the fourth", async () => {
  const f = setup({ monitoring: true }), ids = Array.from({ length: 25 }, (_, index) => String(77 + index));
  monitoringSource(f, ids);
  for (const expected of [10, 10, 5, 10]) assert.equal((await f.backend.monitor()).processed, expected);
  assert.deepEqual(f.calls.filter(input => input.operation === "SearchVisitsV2").map(input => input.date), ["2026-10-10", "2026-10-10", "2026-10-10", "2026-10-09"]);
  const detailReads = f.calls.filter(input => input.operation === "GetVisitInfoV3");
  assert.deepEqual(detailReads.slice(0, 25).map(input => input.id), ids);
  assert.deepEqual(detailReads.slice(25).map(input => input.id), ids.slice(0, 10));
  const checkpoint = monitorCheckpoint(f);
  assert.deepEqual(checkpoint.plan, monitorState({ backfillOffset: 10, backfillDiscovery: discoveryHash(ids) }));
  assert.equal(Date.parse(checkpoint.leaseUntil), 0); assert.equal(checkpoint.lastRunState, "partial_window"); assert.equal(f.sends(), 0);
});

test("partial monitor reads checkpoint only their attempted prefix while today and backfill retain deferred IDs", async t => {
  let elapsed = 0; t.mock.method(performance, "now", () => elapsed);
  const f = setup({ monitoring: true }), ids = ["77", "78", "79", "80", "81"], fingerprint = discoveryHash(ids);
  let serviceDate = "2026-10-10";
  f.setRead(async input => {
    if (input.operation === "SearchVisitsV2") { serviceDate = input.date!; return source(input.operation, ids.map(VisitID => ({ VisitID }))); }
    elapsed += 25000;
    const fields = Object.fromEntries(["ScheduleStartTime", "VisitStartTime", "EVVStartTime"].map(key => [key, `${serviceDate}T08:00:00-05:00`]));
    for (const key of ["ScheduleEndTime", "VisitEndTime", "EVVEndTime"]) fields[key] = `${serviceDate}T12:00:00-05:00`;
    return detail(input.id!, { VisitDate: serviceDate, ...fields });
  });
  for (let run = 0; run < 5; run++) {
    const result = await f.backend.monitor();
    assert.equal(result.state, "partial_batch_time_budget"); assert.equal(result.processed, 1);
    assert.equal(monitorCheckpoint(f).lastRunState, "partial_batch_time_budget");
  }
  assert.deepEqual(f.calls.filter(call => call.operation === "GetVisitInfoV3").map(call => call.id), ["77", "78", "79", "77", "80"]);
  assert.deepEqual(f.calls.filter(call => call.operation === "SearchVisitsV2").map(call => call.date), ["2026-10-10", "2026-10-10", "2026-10-10", "2026-10-09", "2026-10-10"]);
  assert.deepEqual(monitorCheckpoint(f).plan, monitorState({ currentOffset: 4, currentDiscovery: fingerprint, backfillOffset: 1, backfillDiscovery: fingerprint, turn: 1 }));
  assert.equal(f.repo.audit.filter(entry => entry.action === "visit_diagnosed").length, 5);
  assert.equal(f.sends(), 0); assert.equal(Date.parse(monitorCheckpoint(f).leaseUntil), 0);
});

test("a zero-attempt monitor run rotates its turn and retains both current and backfill cursors for retry", async t => {
  let elapsed = 0; t.mock.method(performance, "now", () => elapsed);
  const ids = ["77", "78", "79", "80", "81"], fingerprint = discoveryHash(ids);
  for (const kind of ["current", "backfill"] as const) {
    const f = setup({ monitoring: true }), prior = monitorState({ currentOffset: 1, currentDiscovery: fingerprint, backfillOffset: 2, backfillDiscovery: fingerprint,
      backfillDayOffset: 4, turn: kind === "current" ? 0 : 3 });
    seedMonitor(f, prior);
    f.setRead(async input => { elapsed += 25000; return source(input.operation, ids.map(VisitID => ({ VisitID }))); });
    await assert.rejects(f.backend.monitor(), error => error instanceof WorkflowError && error.code === "revision_batch_time_budget_deferred" && error.status === 429);
    assert.deepEqual(f.calls.map(call => call.operation), ["SearchVisitsV2"]);
    assert.deepEqual(monitorCheckpoint(f).plan, { ...prior, turn: (prior.turn + 1) % 4 });
    assert.equal(monitorCheckpoint(f).lastRunState, "revision_batch_time_budget_deferred"); assert.equal(Date.parse(monitorCheckpoint(f).leaseUntil), 0);
    assert.equal(f.repo.audit.filter(entry => entry.action === "visit_diagnosed").length, 0); assert.equal(f.sends(), 0);
    monitoringSource(f, ids);
    const retry = await f.backend.monitor();
    assert.equal(retry.processed, 4);
    assert.deepEqual(f.calls.filter(call => call.operation === "GetVisitInfoV3").map(call => call.id), ids.slice(1));
    assert.equal(monitorCheckpoint(f).plan.backfillOffset, prior.backfillOffset);
    assert.equal(monitorCheckpoint(f).plan.backfillDiscovery, prior.backfillDiscovery);
  }
});

test("legacy historical checkpoints migrate safely to today's first page instead of importing an old cursor", async () => {
  const f = setup({ monitoring: true });
  const legacy = { id: "checkpoint", revision: 9, updatedAt: NOW, officeId: "123", dayOffset: 6, offset: 180, discovery: "f".repeat(64), leaseUntil: new Date(0).toISOString(), lastRunState: "partial_window", tokenCursor: null, notificationCursor: null };
  f.repo.records.set(MONITOR_CHECKPOINT, legacy);
  monitoringSource(f, ["77"]);
  assert.equal((await f.backend.monitor()).processed, 1);
  assert.deepEqual(f.calls.filter(input => input.operation === "SearchVisitsV2").map(input => input.date), ["2026-10-10"]);
  assert.deepEqual(f.calls.filter(input => input.operation === "GetVisitInfoV3").map(input => input.id), ["77"]);
  assert.deepEqual(monitorCheckpoint(f).plan, monitorState({ turn: 1 }));
  assert.equal(monitorCheckpoint(f).revision, 11);
});

test("a transient historical discovery failure rotates to today while retaining both page cursors", async () => {
  const f = setup({ monitoring: true }), ids = Array.from({ length: 100 }, (_, index) => String(77 + index)), fingerprint = discoveryHash(ids);
  const plan = monitorState({ turn: 3, currentOffset: 20, currentDiscovery: fingerprint, backfillDayOffset: 4, backfillOffset: 30, backfillDiscovery: fingerprint });
  seedMonitor(f, plan);
  f.setRead(async () => { throw new WorkflowError("synthetic_source_deferred", 503); });
  await assert.rejects(f.backend.monitor(), /synthetic_source_deferred/);
  assert.deepEqual(monitorCheckpoint(f).plan, { ...plan, turn: 0 });
  assert.equal(Date.parse(monitorCheckpoint(f).leaseUntil), 0); assert.equal(monitorCheckpoint(f).lastRunState, "synthetic_source_deferred");
  assert.equal(f.repo.audit.some(entry => entry.collection.startsWith("revisionDiagnoses_")), false);
  monitoringSource(f, ids);
  assert.equal((await f.backend.monitor()).processed, 10);
  assert.deepEqual(f.calls.filter(input => input.operation === "SearchVisitsV2").map(input => input.date), ["2026-10-06", "2026-10-10"]);
  assert.deepEqual(f.calls.filter(input => input.operation === "GetVisitInfoV3").map(input => input.id), ids.slice(20, 30));
  assert.equal(monitorCheckpoint(f).plan.currentOffset, 30); assert.equal(monitorCheckpoint(f).plan.backfillOffset, 30); assert.equal(f.sends(), 0);
});

test("changed discovery restarts only its selected window without discarding the other window's progress", async () => {
  for (const kind of ["current", "backfill"] as const) {
    const f = setup({ monitoring: true }), ids = Array.from({ length: 100 }, (_, index) => String(77 + index)), fingerprint = discoveryHash(ids);
    const prior = monitorState({ turn: kind === "current" ? 2 : 3, currentOffset: 20, currentDiscovery: kind === "current" ? "f".repeat(64) : fingerprint,
      backfillDayOffset: 5, backfillOffset: 30, backfillDiscovery: kind === "backfill" ? "f".repeat(64) : fingerprint });
    seedMonitor(f, prior); monitoringSource(f, ids);
    await assert.rejects(f.backend.monitor(), /revision_discovery_changed_restart/);
    const next = monitorCheckpoint(f).plan;
    if (kind === "current") {
      assert.equal(next.currentOffset, 0); assert.equal(next.currentDiscovery, null); assert.equal(next.backfillOffset, 30); assert.equal(next.backfillDiscovery, fingerprint); assert.equal(next.turn, 3);
    } else {
      assert.equal(next.backfillOffset, 0); assert.equal(next.backfillDiscovery, null); assert.equal(next.backfillDayOffset, 5); assert.equal(next.currentOffset, 20); assert.equal(next.currentDiscovery, fingerprint); assert.equal(next.turn, 0);
    }
    assert.equal(f.calls.filter(input => input.operation === "GetVisitInfoV3").length, 0);
    assert.equal(Date.parse(monitorCheckpoint(f).leaseUntil), 0);
    assert.equal(f.repo.audit.some(entry => entry.collection.startsWith("revisionDiagnoses_")), false);
  }
});

test("office-date rollover resets old scopes and starts the new day's first page", async () => {
  const f = setup({ monitoring: true }), ids = Array.from({ length: 25 }, (_, index) => String(77 + index)), fingerprint = discoveryHash(ids);
  seedMonitor(f, monitorState({ turn: 3, currentOffset: 190, currentDiscovery: fingerprint, backfillDayOffset: 6, backfillOffset: 70, backfillDiscovery: fingerprint }));
  f.advance(86_400_000); monitoringSource(f, ids);
  assert.equal((await f.backend.monitor()).processed, 10);
  assert.deepEqual(f.calls.filter(input => input.operation === "SearchVisitsV2").map(input => input.date), ["2026-10-11"]);
  assert.deepEqual(f.calls.filter(input => input.operation === "GetVisitInfoV3").map(input => input.id), ids.slice(0, 10));
  assert.deepEqual(monitorCheckpoint(f).plan, monitorState({ currentDate: "2026-10-11", currentOffset: 10, currentDiscovery: fingerprint, backfillDayOffset: 6, turn: 1 }));
});

test("call candidates atomically retain their trusted source scope in one audited match record", async () => {
  const f = setup(), candidate = await f.backend.callCandidates(actor, { ...prepare, lastId: "12" });
  assert.deepEqual(candidate.sourceScope && { date: candidate.sourceScope.date, lastId: candidate.sourceScope.lastId }, { date: "2026-10-10", lastId: "12" });
  assert.match(candidate.sourceScope!.policyFingerprint, /^[a-f0-9]{64}$/);
  const creation = f.repo.audit.filter(item => item.collection === "revisionCallMatches_office_123");
  assert.deepEqual(creation.map(item => item.action), ["revision_call_match_created"]);
  assert.equal([...f.repo.records.keys()].filter(key => key.startsWith("revisionCallMatches_office_123/")).length, 1);
  assert.equal([...f.repo.records.keys()].some(key => key.startsWith("revisionCallSources_")), false);
  assert.equal(f.repo.audit.some(item => item.collection.startsWith("revisionCallSources_")), false);
  assert.equal(f.repo.reads.some(collection => collection.startsWith("revisionCallSources_")), false);
  const matched = await f.backend.decideCallMatch(actor, decide);
  assert.equal(matched.state, "matched"); assert.equal(matched.hhaVerification, "not_established"); assert.deepEqual(matched.sourceScope, candidate.sourceScope);
  assert.equal(f.calls.at(-1)?.lastId, "12");
  assert.deepEqual(f.repo.audit.filter(item => item.collection === "revisionCallMatches_office_123").map(item => item.action), ["revision_call_match_created", "revision_call_match"]);
});

test("a failed match-record transaction leaves no candidate or secondary source-scope record", async () => {
  const f = setup(); f.repo.failCollection = "revisionCallMatches_office_123";
  await assert.rejects(f.backend.callCandidates(actor, prepare), /synthetic_call_transaction_failed/);
  assert.equal([...f.repo.records.keys()].some(key => key.startsWith("revisionCallMatches_") || key.startsWith("revisionCallSources_")), false);
  assert.equal(f.repo.audit.some(item => item.collection.startsWith("revisionCallMatches_") || item.collection.startsWith("revisionCallSources_")), false);
  assert.equal(f.sends(), 0);
});

test("a missing or wrong trusted call scope rejects matching before HHA rechecks", async () => {
  for (const scope of ["missing", "wrong_fingerprint"] as const) {
    const f = setup(), candidate = await f.backend.callCandidates(actor, prepare), before = f.calls.length;
    f.repo.records.set("revisionCallMatches_office_123/" + candidate.id, { ...candidate,
      sourceScope: scope === "missing" ? null : { ...candidate.sourceScope!, policyFingerprint: "f".repeat(64) } } as CallMatchRecord);
    await assert.rejects(f.backend.decideCallMatch(actor, decide), /call_match_source_recheck_required/);
    assert.equal(f.calls.length, before); assert.equal((f.repo.records.get("revisionCallMatches_office_123/" + candidate.id) as CallMatchRecord).state, "candidate");
  }
  const f = setup();
  await assert.rejects(f.backend.callCandidates(actor, { ...prepare, sourceScope: { date: prepare.date, lastId: "0", policyFingerprint: "f".repeat(64) } }), /unsupported_revision_field/);
  assert.equal(f.calls.length, 0, "The browser cannot assert trusted source scope");
});

test("disabled visit source reads report diagnosis and monitoring unavailable and make no SOAP calls", async () => {
  for (const missing of ["SearchVisitsV2", "GetVisitInfoV3"] as const) {
    const f = setup({ monitoring: true, approvals: { smsCapability: true, smsConfiguration: true, smsSend: true } });
    f.repo.records.set("workspaceSettings/owner", { ...f.settings, revision: 3, enabledReads: f.settings.enabledReads.filter(operation => operation !== missing) } as Settings);
    const status = await f.backend.status(actor);
    assert.equal(status.capabilities.diagnosis, false); assert.equal(status.capabilities.monitoring, false); assert.equal(status.capabilities.sms, false);
    assert.equal(status.blockedReason, "revision_reads_not_enabled"); assert.equal(status.capabilities.records, true, "Approved local records stay separate from source read capability");
    assert.deepEqual(await f.backend.monitor(), { state: "disabled", processed: 0 });
    assert.equal(f.calls.length, 0); assert.equal(f.repo.audit.length, 0); assert.equal(f.sends(), 0);
  }
});

test("an absent or invalid office timezone cannot expose usable source capabilities or start a monitor lease", async () => {
  for (const timezone of [null, "Invalid/SyntheticTimezone"]) {
    const f = setup({ monitoring: true });
    f.repo.records.set("workspaceSettings/owner", { ...f.settings, revision: 3, officeTimezone: timezone } as Settings);
    const status = await f.backend.status(actor);
    assert.equal(status.capabilities.diagnosis, false); assert.equal(status.capabilities.monitoring, false); assert.equal(status.capabilities.records, false);
    assert.equal(status.blockedReason, "office_timezone_not_configured");
    await assert.rejects(f.backend.monitor(), /office_timezone_not_configured/);
    assert.equal(f.calls.length, 0); assert.equal(f.repo.audit.length, 0); assert.equal(f.sends(), 0);
  }
});

function smsGuardFixture() {
  const f = setup({ monitoring: true, approvals: { smsCapability: true, smsConfiguration: true, smsSend: true } });
  f.repo.records.set("revisionPolicies_office_123/owner", { ...defaultRevisionPolicy("123"), revision: 1, updatedAt: NOW, monitoringEnabled: true,
    quietHours: { startHour: 20, endHour: 8 }, smsPolicyReference: "Synthetic approved SMS policy" } as RevisionPolicy);
  return f;
}

test("the final SMS guard rechecks 8PM–8AM quiet-hour boundaries in the office timezone", async () => {
  const f = smsGuardFixture();
  for (const [at, allowed] of [["2026-10-12T00:59:59Z", true], ["2026-10-12T01:00:00Z", false], ["2026-10-12T04:59:59Z", false],
    ["2026-10-12T05:00:00Z", false], ["2026-10-12T12:59:59Z", false], ["2026-10-12T13:00:00Z", true]] as const) {
    f.setClock(at); assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), allowed, at);
  }
  assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0, "Guard checks do not construct or call a delivery provider");
});

test("the final SMS guard cannot reuse an earlier allow decision after the clock or monitoring policy changes", async () => {
  const f = smsGuardFixture(); f.setClock("2026-10-12T00:59:59Z");
  assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), true);
  f.advance(1000); assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), false);
  f.setClock("2026-10-12T13:00:00Z"); assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), true);
  const policy = f.repo.records.get("revisionPolicies_office_123/owner") as RevisionPolicy;
  f.repo.records.set("revisionPolicies_office_123/owner", { ...policy, monitoringEnabled: false, revision: policy.revision + 1 } as RevisionPolicy);
  assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), false);
  assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0);
});

test("the final SMS guard rechecks approval flags, policy requirements and office scope without provider access", async () => {
  for (const flag of ["source", "monitor", "smsCapability", "smsConfiguration", "smsSend"] as const) {
    const f = smsGuardFixture(); f.setClock("2026-10-12T13:00:00Z");
    assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), true);
    f.approvals[flag] = false; assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), false);
    assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0);
  }
  for (const edit of [{ quietHours: null }, { smsPolicyReference: "" }]) {
    const f = smsGuardFixture(); f.setClock("2026-10-12T13:00:00Z");
    const policy = f.repo.records.get("revisionPolicies_office_123/owner") as RevisionPolicy;
    f.repo.records.set("revisionPolicies_office_123/owner", { ...policy, ...edit, revision: policy.revision + 1 } as RevisionPolicy);
    assert.equal(await f.backend.smsDispatchAllowed(actor, "123"), false); assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0);
  }
  const f = smsGuardFixture(); f.setClock("2026-10-12T13:00:00Z");
  assert.equal(await f.backend.smsDispatchAllowed(actor, "124"), false);
  await assert.rejects(f.backend.smsDispatchAllowed({ ...actor, roles: ["viewer"] }, "123"), /revision_management_role_required/);
  f.approvals.data = false; await assert.rejects(f.backend.smsDispatchAllowed(actor, "123"), /operational_data_release_not_approved/);
  assert.equal(f.calls.length, 0); assert.equal(f.sends(), 0);
});

test("revision visit diagnosis and call matching reject a returned patient outside the office", async () => {
  const f = setup(); f.setPatientOffice("999");
  await assert.rejects(f.backend.visits(actor, { date: "2026-10-10" }), /visit_patient_office_mismatch/);
  assert.equal(f.sends(), 0);
  assert.equal(f.repo.audit.some(row => row.collection.startsWith("revisionExceptions")), false);
});
