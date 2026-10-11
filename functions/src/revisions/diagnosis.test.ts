import assert from "node:assert/strict";
import test from "node:test";
import type { OperationalRead } from "../operations/reads.js";
import { adaptVisitEvidence, type NormalizedVisitEvidence, type VisitEvidenceContext } from "./evidence.js";
import { evaluateVisit, summarizeMissingTokenDays, type DiagnosisContext, type DiagnosisPolicy, type SourceAssessment } from "./diagnosis.js";

const now = "2026-10-10T12:20:00-05:00", scope = { officeId: "123", date: "2026-10-10", timezone: "America/Chicago", revision: 3 };
const policy: DiagnosisPolicy = { version: "synthetic-rules-v1", earlyReminderMinutes: null };
function visit(changes: Record<string, string | null> = {}, options: Partial<VisitEvidenceContext> = {}): NormalizedVisitEvidence {
  const ctx: VisitEvidenceContext = { scope, visitId: "77", now, scheduleType: "fixed", clockingMethod: "token", openState: "closed", verification: "unverified",
    acceptance: { operation: "GetVisitInfoV3", version: "synthetic-acceptance", accepted: true, complete: true, scope, visitIds: ["77"], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" }, ...options };
  const read: OperationalRead = { operation: "GetVisitInfoV3", source: "hhaexchange", fetchedAt: ctx.now, validation: "source_unvalidated", timezone: "source_values_unconverted", truncated: false,
    records: [{ ID: ctx.visitId, VisitDate: ctx.scope.date, "Patient/ID": "5", "Caregiver/ID": "6",
      ScheduleStartTime: "2026-10-10T08:00:00-05:00", ScheduleEndTime: "2026-10-10T12:00:00-05:00",
      VisitStartTime: "2026-10-10T08:00:00-05:00", VisitEndTime: "2026-10-10T12:00:00-05:00",
      EVVStartTime: "2026-10-10T08:00:00-05:00", EVVEndTime: "2026-10-10T12:00:00-05:00", ...changes }] };
  return adaptVisitEvidence(read, ctx);
}
function passed(): SourceAssessment { return { state: "ready", outcome: "pass", scope, patientId: "5", fetchedAt: now, maxAgeSeconds: 300, acceptanceVersion: "synthetic-domain-acceptance", reason: null, policyReference: "synthetic-policy" }; }
function acceptedContext(): DiagnosisContext { return { authorization: passed(), eligibility: passed(), location: { ...passed(), evidenceKind: "observation" }, overlapWindowComplete: true }; }
const kinds = (value: ReturnType<typeof evaluateVisit>) => value.issues.map(issue => issue.kind);
test("future visits and in-progress service do not produce missing punches or an early blocker", () => {
  const future = visit({ VisitStartTime: null, VisitEndTime: null, EVVStartTime: null, EVVEndTime: null }, { now: "2026-10-10T07:59:59-05:00", openState: "unknown" });
  const result = evaluateVisit(future, policy, "2026-10-10T07:59:59-05:00", acceptedContext());
  assert.ok(kinds(result).includes("not_started")); assert.ok(!kinds(result).includes("no_punches")); assert.notEqual(result.verification, "blocked");
  const ongoing = visit({ VisitEndTime: null, EVVEndTime: null }, { now: "2026-10-10T10:00:00-05:00", openState: "open" });
  assert.ok(kinds(evaluateVisit(ongoing, policy, "2026-10-10T10:00:00-05:00")).includes("in_progress"));
  assert.ok(!kinds(evaluateVisit(ongoing, policy, "2026-10-10T10:00:00-05:00")).includes("one_punch_missing"));
});
test("future closed and open source intervals remain unknown without timing reminders or factual completion claims", () => {
  const at = "2026-10-10T02:00:00-05:00";
  for (const closed of [true, false]) {
    const evidence = visit({ VisitEndTime: closed ? "2026-10-10T10:00:00-05:00" : null,
      EVVEndTime: closed ? "2026-10-10T10:00:00-05:00" : null }, { now: at, openState: closed ? "closed" : "open" });
    assert.equal(evidence.state, "failed"); assert.equal(evidence.raw?.VisitStartTime, "2026-10-10T08:00:00-05:00");
    const result = evaluateVisit(evidence, { ...policy, earlyReminderMinutes: 15 }, at);
    assert.equal(result.state, "unknown"); assert.deepEqual(kinds(result), ["source_evidence_unknown"]);
    assert.equal(result.metrics.earlyMinutes, null); assert.equal(result.metrics.actualMinutes, null);
    assert.equal(result.issues.some(issue => issue.caregiverReminder || issue.officeFollowUp), false);
    assert.equal(summarizeMissingTokenDays([evidence], at).summaries.length, 0);
  }
});
test("confirmed absent punches block verification; actual recorded times do not invent EVV punches", () => {
  const evidence = visit({ EVVStartTime: null, EVVEndTime: null }, { clockingAttempt: "none" });
  const result = evaluateVisit(evidence, policy, now);
  assert.equal(result.verification, "blocked");
  const issue = result.issues.find(item => item.kind === "no_punches")!;
  assert.equal(issue.blockingPolicy, "confirmed"); assert.equal(issue.caregiverReminder, false);
  assert.equal(result.metrics.actualMinutes, 240); assert.equal(result.metrics.evvMinutes, null);
  assert.equal(result.sourceMutationPermitted, false);
});
test("unavailable, stale, incomplete, unaccepted and failed evidence never diagnose missing punches", () => {
  for (const state of ["unavailable", "stale", "incomplete", "unaccepted", "failed"] as const) {
    const result = evaluateVisit({ ...visit({ EVVStartTime: null, EVVEndTime: null }), state }, policy, now);
    assert.deepEqual(kinds(result), ["source_evidence_unknown"]); assert.equal(result.verification, "unknown");
    assert.equal(result.metrics.scheduledMinutes, null); assert.equal(result.issues.some(issue => issue.caregiverReminder), false);
  }
  const aged = evaluateVisit(visit(), policy, "2026-10-10T12:25:00.001-05:00");
  assert.equal(aged.state, "unknown");
});
test("fifteen-minute open threshold includes equality, requires accepted open status, and rechecks freshness", () => {
  for (const [when, triggers] of [["2026-10-10T12:14:59.999-05:00", false], ["2026-10-10T12:15:00-05:00", true], ["2026-10-10T12:15:00.001-05:00", true]] as const) {
    const evidence = visit({ VisitEndTime: null, EVVEndTime: null }, { now: when, openState: "open" });
    const result = evaluateVisit(evidence, policy, when), issue = result.issues.find(item => item.kind === "open_after_end");
    assert.equal(!!issue, triggers);
    if (issue) { assert.equal(issue.caregiverReminder, true); assert.equal(issue.officeFollowUp, true); assert.equal(issue.officeTargetHours, 24); }
  }
  assert.ok(!kinds(evaluateVisit(visit({ VisitEndTime: null, EVVEndTime: null }, { openState: "unknown" }), policy, now)).includes("open_after_end"));
  const closed = visit(); assert.ok(!kinds(evaluateVisit(closed, policy, now)).includes("open_after_end"));
  const unknownSchedule = visit({ VisitEndTime: null, EVVEndTime: null }, { openState: "open", scheduleType: "unknown" });
  assert.ok(!kinds(evaluateVisit(unknownSchedule, policy, now)).includes("open_after_end"));
});
test("a single missing event is reviewed with its blocking rule unconfigured", () => {
  const result = evaluateVisit(visit({ EVVStartTime: null }), policy, now);
  assert.notEqual(result.verification, "blocked");
  assert.equal(result.issues.find(issue => issue.kind === "one_punch_missing")?.facts.missingEvent, "clock_in");
  assert.equal(result.issues.find(issue => issue.kind === "one_punch_missing")?.blockingPolicy, "unconfigured");
});
test("early ending always yields a factual note and candidate, without an office alert or invented reason", () => {
  const evidence = visit({ VisitEndTime: "2026-10-10T11:20:00-05:00", EVVEndTime: "2026-10-10T11:20:00-05:00" });
  const result = evaluateVisit(evidence, policy, now, acceptedContext()), issue = result.issues.find(item => item.kind === "early_end")!;
  assert.equal(result.metrics.earlyMinutes, 40); assert.equal(result.metrics.varianceMinutes, -40);
  assert.deepEqual(issue.reasonCodeCandidates, ["110A"]); assert.match(issue.suggestedNote!, /reason requires review/);
  assert.equal(issue.officeFollowUp, false); assert.equal(issue.caregiverReminder, false); assert.equal(result.earlyReminderConfigured, false);
  assert.equal(result.issues.some(item => item.officeFollowUp), false);
  assert.equal(evidence.raw?.VisitEndTime, "2026-10-10T11:20:00-05:00");
});
test("early caregiver-only reminder uses only an explicitly configured equality threshold", () => {
  for (const [time, expected] of [["2026-10-10T11:30:00.001-05:00", false], ["2026-10-10T11:30:00-05:00", true], ["2026-10-10T11:29:59.999-05:00", true]] as const) {
    const result = evaluateVisit(visit({ VisitEndTime: time, EVVEndTime: time }), { ...policy, earlyReminderMinutes: 30 }, now);
    const issue = result.issues.find(item => item.kind === "early_end")!;
    assert.equal(issue.caregiverReminder, expected); assert.equal(issue.officeFollowUp, false);
  }
  assert.throws(() => evaluateVisit(visit(), { ...policy, earlyReminderMinutes: 0 }, now), /invalid_diagnosis_policy/);
});
test("variable shift is distinguished from shortened duration and unaccepted program rules", () => {
  const evidence = visit({ VisitStartTime: "2026-10-10T07:00:00-05:00", VisitEndTime: "2026-10-10T11:00:00-05:00",
    EVVStartTime: "2026-10-10T07:00:00-05:00", EVVEndTime: "2026-10-10T11:00:00-05:00" }, { scheduleType: "variable", variableScheduleAccepted: true });
  const result = evaluateVisit(evidence, { ...policy, earlyReminderMinutes: 30 }, now);
  assert.equal(result.metrics.varianceMinutes, 0); assert.ok(kinds(result).includes("variable_shift"));
  assert.ok(!kinds(result).includes("early_end")); assert.equal(result.issues.some(issue => issue.caregiverReminder), false);
  const shortened = visit({ VisitStartTime: "2026-10-10T07:00:00-05:00", VisitEndTime: "2026-10-10T10:30:00-05:00" }, { scheduleType: "variable", variableScheduleAccepted: true });
  assert.equal(evaluateVisit(shortened, policy, now).metrics.varianceMinutes, -30);
  const unknown = evaluateVisit({ ...shortened, variableScheduleAccepted: false }, { ...policy, earlyReminderMinutes: 30 }, now);
  assert.ok(kinds(unknown).includes("schedule_rules_unknown")); assert.equal(unknown.issues.some(issue => issue.caregiverReminder), false);
});
test("recorded overage preserves independent actual and EVV duration with a factual supervisor candidate", () => {
  const evidence = visit({ VisitEndTime: "2026-10-10T12:20:00-05:00", EVVEndTime: "2026-10-10T12:05:00-05:00", AdjustedHours: "4.0" });
  const result = evaluateVisit(evidence, policy, now), issue = result.issues.find(item => item.kind === "recorded_overage")!;
  assert.equal(result.metrics.actualMinutes, 260); assert.equal(result.metrics.evvMinutes, 245); assert.equal(issue.facts.excessMinutes, 20);
  assert.equal(issue.officeTargetHours, 24); assert.doesNotMatch(issue.summary, /illegal|prohibit/i);
  assert.equal(evidence.raw?.AdjustedHours, "4.0");
});
test("overlap allows accepted allowances, conflicts and unknown program rules without blanket illegality", () => {
  const main = visit(), peer = visit({ ID: "78", VisitStartTime: "2026-10-10T11:00:00-05:00", VisitEndTime: "2026-10-10T12:10:00-05:00",
    EVVStartTime: "2026-10-10T11:00:00-05:00", EVVEndTime: "2026-10-10T12:10:00-05:00" }, { visitId: "78", acceptance: { operation: "GetVisitInfoV3", version: "synthetic", accepted: true, complete: true, scope, visitIds: ["78"], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" } });
  for (const allowance of ["allowed", "conflict", "unknown"] as const) {
    const result = evaluateVisit(main, policy, now, { ...acceptedContext(), overlaps: [{ visit: peer, allowance, policyReference: "synthetic-program-approval" }] });
    const issue = result.issues.find(item => item.kind === `overlap_${allowance}`)!;
    assert.equal(issue.facts.overlapMinutes, 60); assert.equal(issue.officeFollowUp, allowance !== "allowed");
    assert.deepEqual(issue.reasonCodeCandidates, allowance === "allowed" ? ["110D"] : []);
  }
  assert.ok(kinds(evaluateVisit(main, policy, now, { overlaps: [{ visit: peer, allowance: "allowed", policyReference: null }] })).includes("overlap_unknown"));
  assert.throws(() => evaluateVisit(main, policy, now, { overlaps: [{ visit: { ...peer, scope: { ...scope, officeId: "124" } }, allowance: "unknown", policyReference: null }] }), /diagnosis_related_visit_scope_mismatch/);
});
test("adjacent boundaries are not overlap; missing peer intervals and incomplete discovery stay unknown", () => {
  const peer = visit({ ID: "78", VisitStartTime: "2026-10-10T12:00:00-05:00", VisitEndTime: "2026-10-10T12:10:00-05:00" }, { visitId: "78", acceptance: { operation: "GetVisitInfoV3", version: "synthetic", accepted: true, complete: true, scope, visitIds: ["78"], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" } });
  const result = evaluateVisit(visit(), policy, now, { ...acceptedContext(), overlaps: [{ visit: peer, allowance: "conflict", policyReference: "synthetic-policy" }] });
  assert.equal(result.issues.length, 0);
  assert.ok(kinds(evaluateVisit(visit(), policy, now)).includes("overlap_unknown"));
  assert.ok(kinds(evaluateVisit(visit(), policy, now, { ...acceptedContext(), overlaps: [{ visit: { ...peer, state: "stale" }, allowance: "conflict", policyReference: "synthetic-policy" }] })).includes("overlap_unknown"));
});
test("domain failures differ from unavailable/stale evidence and reference-only location never establishes presence", () => {
  const result = evaluateVisit(visit(), policy, now, { authorization: { ...passed(), outcome: "fail", reason: "expired" },
    eligibility: { ...passed(), state: "stale", outcome: "fail" }, location: { ...passed(), outcome: "fail", evidenceKind: "reference_only" } });
  assert.ok(kinds(result).includes("authorization_failed")); assert.ok(kinds(result).includes("eligibility_unknown")); assert.ok(kinds(result).includes("location_unknown"));
  assert.ok(!kinds(result).includes("location_failed")); assert.notEqual(result.verification, "blocked");
  assert.throws(() => evaluateVisit(visit(), policy, now, { authorization: { ...passed(), patientId: "9" } }), /diagnosis_assessment_scope_mismatch/);
});
test("only accepted source verification with sufficient evidence appears verified; repeated evaluation is deterministic", () => {
  const evidence = visit({}, { verification: "verified" });
  const first = evaluateVisit(evidence, policy, now, acceptedContext());
  assert.equal(first.verification, "verified"); assert.deepEqual(first, evaluateVisit(evidence, policy, now, acceptedContext()));
  assert.equal(evaluateVisit(visit(), policy, now, acceptedContext()).verification, "unverified");
  assert.equal(evaluateVisit(evidence, policy, now).verification, "unknown");
});
test("token follow-up counts distinct due service dates, not punches or repeated visits, and rejects uncertain inputs", () => {
  const missing = visit({ EVVStartTime: null, EVVEndTime: null });
  const other = { ...missing, visitId: "78" };
  const previous = { ...missing, visitId: "79", scope: { ...scope, date: "2026-10-09" } };
  const result = summarizeMissingTokenDays([other, missing, missing, previous, { ...missing, visitId: "80", state: "failed" }, { ...missing, visitId: "81", clockingMethod: "unknown" }], now);
  assert.equal(result.summaries[0]?.missingDayCount, 2); assert.equal(result.complete, false);
  assert.deepEqual(result.summaries[0]?.days[1]?.visitIds, ["77", "78"]); assert.deepEqual(result.summaries[0]?.days[1]?.missingEvents, ["clock_in", "clock_out"]);
  assert.equal(result.excluded.length, 2); assert.equal(result.summaries[0]?.coverage, "accepted_input_only");
  const future = visit({ VisitStartTime: null, VisitEndTime: null, EVVStartTime: null, EVVEndTime: null }, { now: "2026-10-10T07:00:00-05:00" });
  assert.equal(summarizeMissingTokenDays([future], "2026-10-10T07:00:00-05:00").summaries.length, 0);
});
