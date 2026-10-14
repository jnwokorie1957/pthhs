import assert from "node:assert/strict";
import test from "node:test";
import type { OperationalRead } from "../operations/reads.js";
import { adaptVisitEvidence, type NormalizedVisitEvidence } from "./evidence.js";
import { evaluateVisit } from "./diagnosis.js";
import { adaptVerificationReceipt, validVerificationReceiptAcceptance, type VerificationReceiptAcceptance } from "./verification.js";

const scope = { officeId: "123", date: "2026-10-10", timezone: "America/Chicago", revision: 3 };
const now = "2026-10-10T12:20:00-05:00";
function acceptance(): VerificationReceiptAcceptance {
  return { accepted: true, version: "synthetic-receipt-v1", sourceVersion: "synthetic-source-v1", reviewReference: "Synthetic accepted verification receipt semantics",
    receiptMeansVerified: true, timestampEncoding: "explicit_offset" };
}
function evidence(changes: Record<string, string | null> = {}, operation: "GetVisitInfoV2" | "GetVisitInfoV3" = "GetVisitInfoV3"): NormalizedVisitEvidence {
  const source: OperationalRead = { operation, source: "hhaexchange", fetchedAt: now, validation: "source_unvalidated", timezone: "source_values_unconverted", truncated: false,
    records: [{ ID: "77", VisitDate: scope.date, "Patient/ID": "5", "Caregiver/ID": "6", ScheduleStartTime: "2026-10-10T08:00:00-05:00", ScheduleEndTime: "2026-10-10T12:00:00-05:00",
      VisitStartTime: "2026-10-10T08:00:00-05:00", VisitEndTime: "2026-10-10T12:00:00-05:00", EVVStartTime: "2026-10-10T08:00:00-05:00", EVVEndTime: "2026-10-10T12:00:00-05:00",
      "Verification/VerifiedBy": "Synthetic reviewer", "Verification/VerifiedDate": "2026-10-10T12:05:00-05:00", "Verification/VerifiedTime": "12:05:00",
      "Verification/SupervisorName": "Synthetic supervisor", "Verification/Notes": "Synthetic recorded verification note", ...changes }] };
  return adaptVisitEvidence(source, { scope, visitId: "77", now, acceptance: { operation, version: "synthetic-source-v1", accepted: true, complete: true,
    scope, visitIds: ["77"], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" }, scheduleType: "fixed", openState: "closed" });
}
const context = () => ({ scope, visitId: "77", now, acceptance: acceptance() });

test("accepted V2/V3 receipt retains original fields and reports HHA receipt state without an overall green decision", () => {
  for (const operation of ["GetVisitInfoV2", "GetVisitInfoV3"] as const) {
    const input = evidence({}, operation), before = structuredClone(input), result = adaptVerificationReceipt(input, context());
    assert.equal(result.state, "ready"); assert.equal(result.verification, "verified"); assert.equal(result.verifiedAt?.iso, "2026-10-10T17:05:00.000Z");
    assert.equal(result.receipt.notes, input.raw?.["Verification/Notes"]); assert.equal(result.receipt.verifiedTime, "12:05:00");
    assert.equal(result.sourceRevision, input.provenance?.sourceRevision); assert.equal(result.acceptanceVersion, "synthetic-receipt-v1"); assert.deepEqual(input, before);
    const diagnosis = evaluateVisit({ ...input, verification: result.verification }, { version: "synthetic", earlyReminderMinutes: null }, now);
    assert.equal(diagnosis.sourceVerification, "verified"); assert.equal(diagnosis.verification, "unknown");
  }
});

test("receipt semantics require a separately accepted protected profile; aggregation never accepts verification", () => {
  const input = evidence({ "VisitAggregationStatus/Status": "Verified" });
  for (const profile of [null, { ...acceptance(), accepted: false }, { ...acceptance(), receiptMeansVerified: false }]) {
    const result = adaptVerificationReceipt(input, { ...context(), acceptance: profile });
    assert.equal(result.verification, "unknown"); assert.equal(result.verifiedAt, null);
  }
  const noReceipt = evidence({ "Verification/VerifiedBy": null, "Verification/VerifiedDate": null, "VisitAggregationStatus/Status": "Verified" });
  assert.equal(adaptVerificationReceipt(noReceipt, context()).verification, "unknown");
  assert.equal(adaptVerificationReceipt(noReceipt, context()).reasons[0], "verification_receipt_absent_or_incomplete");
});

test("missing and partial receipt projections do not prove an unverified or verified visit", () => {
  for (const patch of [{ "Verification/VerifiedBy": null }, { "Verification/VerifiedDate": null }, { "Verification/VerifiedBy": "" }])
    assert.equal(adaptVerificationReceipt(evidence(patch), context()).verification, "unknown");
  const input = evidence(), raw = { ...input.raw }; delete raw["Verification/Notes"];
  // Re-adapt the incomplete projection so its raw hash remains valid.
  const read: OperationalRead = { operation: "GetVisitInfoV3", source: "hhaexchange", fetchedAt: now, validation: "source_unvalidated", timezone: "source_values_unconverted", truncated: false, records: [raw] };
  const incomplete = adaptVisitEvidence(read, { scope, visitId: "77", now, acceptance: { operation: "GetVisitInfoV3", version: "synthetic-source-v1", accepted: true, complete: true,
    scope, visitIds: ["77"], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" } });
  assert.equal(adaptVerificationReceipt(incomplete, context()).reasons[0], "verification_receipt_projection_incomplete");
});

test("source scope, identity, acceptance version, revision and freshness fence every receipt", () => {
  const input = evidence();
  for (const patch of [{ scope: { ...scope, officeId: "124" } }, { scope: { ...scope, date: "2026-10-11" } }, { scope: { ...scope, revision: 4 } }, { visitId: "78" }])
    assert.throws(() => adaptVerificationReceipt(input, { ...context(), ...patch }), /verification_receipt_scope_mismatch/);
  assert.equal(adaptVerificationReceipt(input, { ...context(), acceptance: { ...acceptance(), sourceVersion: "different" } }).reasons[0], "verification_source_acceptance_changed");
  assert.equal(adaptVerificationReceipt({ ...input, raw: { ...input.raw, "Verification/VerifiedBy": "changed" } }, context()).reasons[0], "verification_source_revision_mismatch");
  assert.equal(adaptVerificationReceipt(input, { ...context(), now: "2026-10-10T12:25:00.001-05:00" }).reasons[0], "verification_visit_evidence_stale");
  for (const state of ["unavailable", "failed", "incomplete", "stale", "unaccepted"] as const)
    assert.equal(adaptVerificationReceipt({ ...input, state }, context()).reasons[0], "verification_visit_evidence_not_ready");
});

test("offsetless, sentinel, future and pre-completion receipt times remain unknown without combining raw VerifiedTime", () => {
  for (const timestamp of ["2026-10-10T12:05:00", "0001-01-01T00:00:00Z", "12:05:00", "2026-02-30T12:05:00Z"])
    assert.equal(adaptVerificationReceipt(evidence({ "Verification/VerifiedDate": timestamp }), context()).reasons[0], "verification_receipt_timestamp_unusable");
  for (const timestamp of ["2026-10-10T12:20:00.001-05:00", "2026-10-11T12:05:00-05:00"])
    assert.equal(adaptVerificationReceipt(evidence({ "Verification/VerifiedDate": timestamp }), context()).reasons[0], "verification_receipt_timestamp_future");
  assert.equal(adaptVerificationReceipt(evidence({ "Verification/VerifiedDate": "2026-10-10T11:59:59.999-05:00" }), context()).reasons[0], "verification_receipt_precedes_recorded_end");
  assert.equal(adaptVerificationReceipt(evidence({ "Verification/VerifiedDate": "2026-10-10T12:00:00-05:00" }), context()).verification, "verified");
  const afterFetch = adaptVerificationReceipt(evidence({ "Verification/VerifiedDate": "2026-10-10T12:20:00.001-05:00" }), { ...context(), now: "2026-10-10T12:21:00-05:00" });
  assert.equal(afterFetch.reasons[0], "verification_receipt_timestamp_future");
  const noCompletion = evidence({ VisitEndTime: null, EVVEndTime: null });
  assert.equal(adaptVerificationReceipt(noCompletion, context()).reasons[0], "verification_visit_completion_unavailable");
});

test("server acceptance profiles reject extra claims and unknown timestamp conventions", () => {
  assert.equal(validVerificationReceiptAcceptance(acceptance(), "synthetic-source-v1"), true);
  for (const patch of [{ accepted: "true" }, { sourceVersion: "other" }, { receiptMeansVerified: false }, { timestampEncoding: "date_plus_wall_time" }, { reviewReference: "" }, { absenceMeansUnverified: true }])
    assert.equal(validVerificationReceiptAcceptance({ ...acceptance(), ...patch }, "synthetic-source-v1"), false);
});
