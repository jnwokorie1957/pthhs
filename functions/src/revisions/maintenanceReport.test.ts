import test from "node:test";
import assert from "node:assert/strict";
import { projectMaintenanceReport, type MaintenanceReportInput, type MaintenanceObstacle } from "./maintenanceReport.js";

// Entirely synthetic future-adapter evidence; no production vendor semantics.
function fixture(): MaintenanceReportInput {
  const binding = { scope: { officeId: "9", date: "2026-11-01", timezone: "America/Chicago", revision: 3 }, patientId: "101", caregiverId: "201", visitId: "301", actionId: "synthetic-action-1", actionKind: "synthetic-reviewed-action" };
  const events = [{ id: "synthetic-event-1", sourceReference: "synthetic/event/1", sourceHash: "a".repeat(64), originalTime: "2026-11-01T01:30:00-05:00" }, { id: "synthetic-event-2", sourceReference: "synthetic/event/2", sourceHash: "b".repeat(64), originalTime: "2026-11-01T01:30:00-06:00" }];
  const rule = { id: "synthetic-rule", version: "1", reference: "synthetic/rule/1" };
  const catalog = { id: "synthetic-catalog", version: "2", reference: "synthetic/catalog/2" };
  const contract = { id: "synthetic-adapter", version: "3", reference: "synthetic/acceptance/3" };
  const reason = { code: "raw-reason", actionCode: "raw-action", note: "Synthetic reviewed note", catalog };
  return JSON.parse(JSON.stringify({ expected: binding, now: "2026-11-01T08:02:00Z", assignedTo: "synthetic-staff",
    local: { callMatch: { id: "local-match", officeId: "9", visitId: "301", state: "matched", hhaVerification: "not_established" }, exception: { id: "local-review", officeId: "9", visitId: "301", state: "resolved", hhaVerification: "not_established" } },
    proposal: { binding, state: "reviewed", actorId: "synthetic-author", reviewerId: "synthetic-reviewer", explanation: "Synthetic accepted case only", events, before: { maintainedValue: null }, proposed: { maintainedValue: "raw-result" }, rule, reason },
    acceptance: { binding, contract, validUntil: "2026-11-02T00:00:00Z", maxAgeSeconds: 300, fields: ["maintainedValue"], rule, catalog, noteRequired: true, independentReviewRequired: true },
    beforeReceipt: { binding, id: "before-1", sourceReference: "synthetic/read/before", sourceHash: "c".repeat(64), fetchedAt: "2026-11-01T08:00:00Z", events, values: { maintainedValue: null } },
    submission: { state: "transport_success", attemptId: "synthetic-attempt-1", submittedAt: "2026-11-01T08:01:00Z", binding, responseReference: "synthetic/response/1" },
    readback: { binding, id: "after-1", sourceReference: "synthetic/read/after", sourceHash: "d".repeat(64), fetchedAt: "2026-11-01T08:01:30Z", events, values: { maintainedValue: "raw-result" }, attemptId: "synthetic-attempt-1", contract, rule, reason, relationship: "authoritative_action_event_visit" },
  })) as MaintenanceReportInput;
}
function blocked(input: MaintenanceReportInput, code: MaintenanceObstacle) {
  const report = projectMaintenanceReport(input);
  assert.notEqual(report.status, "source_verified");
  assert.equal(report.hhaOutcome, "not_established");
  assert.ok(report.obstacles.some(item => item.code === code && item.nextStep.length > 25), code);
  return report;
}

test("matching independently read-back synthetic action preserves raw evidence and is detached from input", () => {
  const input = fixture(), original = structuredClone(input);
  const result = projectMaintenanceReport(input);
  assert.equal(result.status, "source_verified"); assert.deepEqual(result.obstacles, []);
  assert.equal(result.evidence.local.exception?.hhaVerification, "not_established");
  assert.deepEqual(input, original);
  assert.deepEqual(result.evidence.proposal?.events.map(e => e.originalTime), ["2026-11-01T01:30:00-05:00", "2026-11-01T01:30:00-06:00"]);
  result.evidence.proposal!.proposed = { changed: "detached" };
  assert.deepEqual(input, original);
});

test("local matched/resolved notes alone never establish HHA resolution", () => {
  const input = fixture(); input.proposal = null; input.acceptance = null; input.beforeReceipt = null; input.readback = null; input.submission = { state: "not_submitted" };
  assert.equal(blocked(input, "proposal_missing").status, "local_review");
});
test("draft, unsupported action and reviewed but unsubmitted cases remain distinct", () => {
  const input = fixture(); input.submission = { state: "not_submitted" }; input.readback = null;
  input.proposal!.state = "draft";
  assert.equal(blocked(input, "review_missing").status, "draft_proposal");
  input.proposal!.state = "reviewed";
  assert.equal(blocked(input, "submission_missing").status, "unresolved");
  input.acceptance = null;
  assert.equal(blocked(input, "contract_unaccepted").status, "unsupported");
});
for (const state of ["pending", "unknown", "transport_success"] as const) test(`${state} without readback stays pending/unknown, even with local resolved and missing contract`, () => {
  const input = fixture(); assert.notEqual(input.submission.state, "not_submitted");
  input.submission = { ...input.submission, state } as typeof input.submission;
  input.readback = null;
  assert.equal(blocked(input, "readback_missing").status, state === "pending" ? "submission_pending" : "outcome_unknown");
  input.acceptance = null;
  assert.equal(blocked(input, "contract_unaccepted").status, state === "pending" ? "submission_pending" : "outcome_unknown");
  input.proposal = null;
  assert.equal(blocked(input, "proposal_missing").status, state === "pending" ? "submission_pending" : "outcome_unknown");
});
test("independent exact readback can reconcile an unknown attempt without treating transport as proof", () => {
  const input = fixture(); if (input.submission.state !== "not_submitted") input.submission.state = "unknown";
  assert.equal(projectMaintenanceReport(input).status, "source_verified");
});
test("null, empty and zero values are distinct and raw values are not normalized", () => {
  const input = fixture();
  input.proposal!.proposed = { maintainedValue: "0" };
  input.readback!.values = { maintainedValue: "" };
  blocked(input, "persisted_values_conflict");
  input.readback!.values = { maintainedValue: null };
  blocked(input, "persisted_values_conflict");
  input.readback!.values = { maintainedValue: "0" };
  assert.equal(projectMaintenanceReport(input).status, "source_verified");
});
test("a contract without a reason catalog cannot silently accept a substituted reason", () => {
  const input = fixture(); input.acceptance!.catalog = null; input.acceptance!.noteRequired = false;
  blocked(input, "catalog_mismatch");
  input.proposal!.reason = null; input.readback!.reason = null;
  assert.equal(projectMaintenanceReport(input).status, "source_verified");
});
test("review requirements come from explicit accepted policy, not an invented universal approval rule", () => {
  const input = fixture(); input.proposal!.reviewerId = null;
  blocked(input, "review_missing");
  input.acceptance!.independentReviewRequired = false;
  assert.equal(projectMaintenanceReport(input).status, "source_verified");
});

const mutations: [string, MaintenanceObstacle, (input: MaintenanceReportInput) => void][] = [
  ["missing acceptance", "contract_unaccepted", x => { x.acceptance = null; }],
  ["expired acceptance", "contract_expired", x => { x.acceptance!.validUntil = "2026-11-01T07:59:00Z"; }],
  ["missing genuine end event time", "original_events_missing", x => { x.proposal!.events = [{ ...x.proposal!.events[0]!, originalTime: null }]; }],
  ["duplicate original event", "original_events_missing", x => { x.proposal!.events = [x.proposal!.events[0]!, x.proposal!.events[0]!]; }],
  ["changed event raw offset", "event_conflict", x => { x.readback!.events = [{ ...x.readback!.events[0]!, originalTime: "2026-11-01T01:30:00-06:00" }, x.readback!.events[1]!]; }],
  ["different event with same time", "event_conflict", x => { x.readback!.events = [{ ...x.readback!.events[0]!, id: "another-event" }, x.readback!.events[1]!]; }],
  ["same subject and day link", "link_unestablished", x => { x.readback!.relationship = "same_subject_day_only"; }],
  ["unknown linkage", "link_unestablished", x => { x.readback!.relationship = "unknown"; }],
  ["missing before receipt", "before_read_missing", x => { x.beforeReceipt = null; }],
  ["stale before at submission", "before_read_stale", x => { x.beforeReceipt!.fetchedAt = "2026-11-01T07:00:00Z"; }],
  ["before read after submission", "before_read_stale", x => { x.beforeReceipt!.fetchedAt = "2026-11-01T08:01:01Z"; }],
  ["changed before values", "before_values_conflict", x => { x.beforeReceipt!.values = { maintainedValue: "changed" }; }],
  ["missing persisted field", "persisted_values_conflict", x => { x.readback!.values = {}; }],
  ["extra persisted field", "persisted_values_conflict", x => { x.readback!.values = { maintainedValue: "raw-result", extra: "not-reviewed" }; }],
  ["wrong persisted value", "persisted_values_conflict", x => { x.readback!.values = { maintainedValue: "not-applied" }; }],
  ["wrong attempt", "attempt_mismatch", x => { x.readback!.attemptId = "other-attempt"; }],
  ["before receipt reused", "readback_not_independent", x => { x.readback!.id = x.beforeReceipt!.id; }],
  ["transport response reused", "readback_not_independent", x => { x.readback!.sourceReference = "synthetic/response/1"; }],
  ["readback before action", "readback_precedes_submission", x => { x.readback!.fetchedAt = "2026-11-01T08:00:59Z"; }],
  ["future receipt", "readback_stale", x => { x.readback!.fetchedAt = "2026-11-01T08:03:00Z"; }],
  ["expired readback", "readback_stale", x => { x.now = "2026-11-01T09:00:00Z"; }],
  ["ambiguous timestamp", "invalid_evidence", x => { x.readback!.fetchedAt = "2026-11-01T01:30:00"; }],
  ["invalid freshness", "invalid_evidence", x => { x.acceptance!.maxAgeSeconds = 0; }],
  ["missing contract reference", "invalid_evidence", x => { x.acceptance!.contract.reference = ""; }],
  ["different rule", "rule_mismatch", x => { x.proposal!.rule!.version = "other"; }],
  ["different catalog", "catalog_mismatch", x => { x.proposal!.reason!.catalog.version = "other"; }],
  ["missing required note", "catalog_mismatch", x => { x.proposal!.reason!.note = ""; }],
  ["readback contract mismatch", "readback_contract_mismatch", x => { x.readback!.contract.version = "other"; }],
  ["readback reason mismatch", "readback_contract_mismatch", x => { x.readback!.reason!.code = "other"; }],
  ["self review", "review_missing", x => { x.proposal!.reviewerId = x.proposal!.actorId; }],
];
for (const [name, code, mutate] of mutations) test(`unresolved obstacle: ${name}`, () => { const input = fixture(); mutate(input); blocked(input, code); });

for (const component of ["proposal", "acceptance", "beforeReceipt", "readback", "submission"] as const) {
  for (const field of ["officeId", "patientId", "caregiverId", "visitId", "actionId", "actionKind", "date", "revision"] as const) test(`refuses ${component} ${field} mismatch without a report`, () => {
    const input = fixture(); const item = input[component]!;
    assert.ok("binding" in item);
    if (field === "officeId" || field === "date") item.binding.scope[field] = "different";
    else if (field === "revision") item.binding.scope.revision++;
    else item.binding[field] = "different";
    assert.throws(() => projectMaintenanceReport(input), /maintenance_report_scope_mismatch/);
  });
}
test("cross-office local record cannot leak into projection", () => {
  const input = fixture(); input.local.exception!.officeId = "99";
  assert.throws(() => projectMaintenanceReport(input), /maintenance_report_scope_mismatch/);
});
