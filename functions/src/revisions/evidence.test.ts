import assert from "node:assert/strict";
import test from "node:test";
import type { OperationalRead } from "../operations/reads.js";
import { adaptVisitEvidence, evidenceIsFresh, normalizedInstant, type VisitEvidenceContext } from "./evidence.js";

const scope = { officeId: "123", date: "2026-10-10", timezone: "America/Chicago", revision: 3 };
const now = "2026-10-10T12:20:00-05:00";
function context(): VisitEvidenceContext {
  return { scope, visitId: "77", now, acceptance: { operation: "GetVisitInfoV3", version: "synthetic-accepted-v1", accepted: true, complete: true,
    scope, visitIds: ["77"], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" },
    scheduleType: "fixed", clockingMethod: "token", openState: "open", verification: "unverified" };
}
function source(changes: Record<string, string | null> = {}): OperationalRead {
  return { operation: "GetVisitInfoV3", source: "hhaexchange", fetchedAt: now, validation: "source_unvalidated", timezone: "source_values_unconverted", truncated: false,
    records: [{ ID: "77", VisitDate: "2026-10-10T00:00:00", "Patient/ID": "5", "Caregiver/ID": "6",
      ScheduleStartTime: "2026-10-10T08:00:00-05:00", ScheduleEndTime: "2026-10-10T12:00:00-05:00",
      VisitStartTime: "2026-10-10T08:01:00-05:00", VisitEndTime: null, EVVStartTime: "2026-10-10T08:02:00-05:00", EVVEndTime: null,
      ActualHours: "4.00", PayHours: "3.75", AdjustedHours: "3.50", ...changes }] };
}
test("accepted source retains raw facts and independent actual/EVV timestamps without bill-hour calculation", () => {
  const input = source(), result = adaptVisitEvidence(input, context());
  assert.equal(result.state, "ready");
  assert.equal(result.times.actualStart?.iso, "2026-10-10T13:01:00.000Z");
  assert.equal(result.times.evvStart?.iso, "2026-10-10T13:02:00.000Z");
  assert.deepEqual(result.raw, input.records[0]);
  assert.equal(result.raw?.AdjustedHours, "3.50");
  assert.equal(Object.isFrozen(result.raw), true);
  assert.equal(result.provenance?.originalValidation, "source_unvalidated");
  assert.equal(result.provenance?.sourceRevision, adaptVisitEvidence(source(), context()).provenance?.sourceRevision);
});
test("raw response flags cannot accept a source; acceptance is a separate server context", () => {
  const ctx = context(); ctx.acceptance = null;
  const result = adaptVisitEvidence(source(), ctx);
  assert.equal(result.state, "unaccepted"); assert.equal(result.times.scheduledStart, null);
  assert.equal(result.raw?.ScheduleStartTime, "2026-10-10T08:00:00-05:00");
  const denied = context(); denied.acceptance!.accepted = false;
  assert.equal(adaptVisitEvidence(source(), denied).state, "unaccepted");
});
test("unavailable and failed reads remain separate from an empty successful source", () => {
  assert.equal(adaptVisitEvidence(null, context()).state, "unavailable");
  assert.equal(adaptVisitEvidence(null, { ...context(), readError: "read_not_owner_enabled" }).state, "failed");
  assert.equal(adaptVisitEvidence({ ...source(), records: [] }, context()).state, "failed");
  const deferred = adaptVisitEvidence(null, { ...context(), readError: "not_attempted_batch_time_budget" });
  assert.equal(deferred.state, "unavailable"); assert.deepEqual(deferred.reasons, ["not_attempted_batch_time_budget"]);
  assert.throws(() => adaptVisitEvidence(null, { ...context(), readError: "vendor message with private detail" }), /invalid_visit_read_error/);
});
test("freshness requires explicit instants and includes the configured boundary without future facts", () => {
  const input = source(); input.fetchedAt = "2026-10-10T12:15:00-05:00";
  assert.equal(adaptVisitEvidence(input, context()).state, "ready");
  input.fetchedAt = "2026-10-10T12:14:59.999-05:00";
  assert.equal(adaptVisitEvidence(input, context()).state, "stale");
  input.fetchedAt = "2026-10-10T12:20:00.001-05:00";
  assert.equal(adaptVisitEvidence(input, context()).state, "stale");
  input.fetchedAt = "2026-10-10T12:20:00";
  assert.equal(adaptVisitEvidence(input, context()).state, "failed");
  assert.throws(() => evidenceIsFresh(now, now, 0), /invalid_evidence_freshness_policy/);
});
test("truncated, nonunique and missing field evidence cannot establish absent punches", () => {
  assert.equal(adaptVisitEvidence({ ...source(), truncated: true }, context()).state, "incomplete");
  assert.equal(adaptVisitEvidence({ ...source(), records: [...source().records, ...source().records] }, context()).state, "incomplete");
  const missing = source(); delete missing.records[0]!.EVVEndTime;
  assert.equal(adaptVisitEvidence(missing, context()).state, "incomplete");
  const ctx = context(); ctx.acceptance!.complete = false;
  assert.equal(adaptVisitEvidence(source(), ctx).state, "incomplete");
  const unknownNull = context(); unknownNull.acceptance!.missingEvvMeansAbsent = false;
  assert.equal(adaptVisitEvidence(source(), unknownNull).state, "incomplete");
});
test("visit identity, discovery scope, policy revision and source office/date are fenced", () => {
  assert.throws(() => adaptVisitEvidence(source({ ID: "78" }), context()), /visit_evidence_identity_mismatch/);
  assert.throws(() => adaptVisitEvidence(source({ VisitDate: "2026-10-11" }), context()), /visit_evidence_date_scope_mismatch/);
  assert.throws(() => adaptVisitEvidence(source({ OfficeID: "124" }), context()), /visit_evidence_office_scope_mismatch/);
  const changed = context(); changed.acceptance!.scope = { ...scope, revision: 4 };
  assert.throws(() => adaptVisitEvidence(source(), changed), /revision_evidence_scope_mismatch/);
  const undiscovered = context(); undiscovered.acceptance!.visitIds = ["78"];
  assert.throws(() => adaptVisitEvidence(source(), undiscovered), /revision_evidence_scope_mismatch/);
  assert.throws(() => adaptVisitEvidence({ ...source(), operation: "GetVisitInfoV2" }, context()), /visit_evidence_operation_mismatch/);
});
test("normalization rejects time-only, offsetless, repaired calendar, unknown offset and impossible intervals", () => {
  for (const bad of ["08:00", "2026-10-10T08:00:00", "2026-02-30T08:00:00Z", "2026-10-10T08:00:00-00:00", "2026-10-10T08:00:00+14:01", "2026-10-10T24:00:00Z"]) {
    assert.throws(() => normalizedInstant(bad), /invalid_normalized_timestamp/);
    assert.equal(adaptVisitEvidence(source({ ScheduleStartTime: bad }), context()).state, "failed");
  }
  assert.equal(adaptVisitEvidence(source({ ScheduleEndTime: "2026-10-10T07:00:00-05:00" }), context()).state, "failed");
  assert.equal(adaptVisitEvidence(source({ ScheduleStartTime: null }), context()).state, "incomplete");
  assert.equal(adaptVisitEvidence(source({ ScheduleStartTime: "2026-10-09T08:00:00-05:00" }), context()).state, "failed");
});
test("explicit overnight and daylight-saving instants preserve elapsed time", () => {
  const before = normalizedInstant("2026-11-01T01:30:00-05:00"), after = normalizedInstant("2026-11-01T01:30:00-06:00");
  assert.equal((after.epochMs - before.epochMs) / 60000, 60);
  assert.equal((normalizedInstant("2026-03-08T03:30:00-05:00").epochMs - normalizedInstant("2026-03-08T01:30:00-06:00").epochMs) / 60000, 60);
  const ctx = context(); ctx.openState = "closed"; ctx.now = "2026-10-11T02:00:00-05:00";
  const input = source({ ScheduleStartTime: "2026-10-10T22:00:00-05:00", ScheduleEndTime: "2026-10-11T02:00:00-05:00",
    VisitStartTime: "2026-10-10T22:00:00-05:00", VisitEndTime: "2026-10-11T02:00:00-05:00", EVVStartTime: "2026-10-10T22:00:00-05:00", EVVEndTime: "2026-10-11T02:00:00-05:00" });
  input.fetchedAt = ctx.now;
  const result = adaptVisitEvidence(input, ctx);
  assert.equal(result.state, "ready");
  assert.equal((result.times.actualEnd!.epochMs - result.times.actualStart!.epochMs) / 60000, 240);
});
test("future recorded actual or EVV observations fail without rejecting a future schedule", () => {
  for (const field of ["VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime"]) {
    const result = adaptVisitEvidence(source({ [field]: "2026-10-10T17:20:00.001Z" }), { ...context(), openState: "unknown" });
    assert.equal(result.state, "failed"); assert.deepEqual(result.reasons, ["visit_source_recorded_time_future"]);
    assert.equal(result.raw?.[field], "2026-10-10T17:20:00.001Z");
  }
  const future = source({ ScheduleStartTime: "2026-10-10T14:00:00-05:00", ScheduleEndTime: "2026-10-10T18:00:00-05:00",
    VisitStartTime: null, VisitEndTime: null, EVVStartTime: null, EVVEndTime: null });
  assert.equal(adaptVisitEvidence(future, { ...context(), openState: "unknown" }).state, "ready");
  const boundary = adaptVisitEvidence(source({ VisitEndTime: "2026-10-10T17:20:00Z", EVVEndTime: "2026-10-10T12:20:00-05:00" }), { ...context(), openState: "closed" });
  assert.equal(boundary.state, "ready");
});
test("source contradictions fail and GPS is never manufactured from an address or write-shaped fields", () => {
  assert.equal(adaptVisitEvidence(source({ EVVEndTime: "2026-10-10T12:00:00-05:00" }), context()).state, "failed");
  assert.equal(adaptVisitEvidence(source(), { ...context(), clockingAttempt: "none" }).state, "failed");
  const result = adaptVisitEvidence(source({ Address1: "Synthetic address", StartLatitude: "29.7", StartLongitude: "-95.3" }), context());
  assert.equal(result.state, "ready"); assert.equal("location" in result, false); assert.equal("latitude" in result, false);
});
