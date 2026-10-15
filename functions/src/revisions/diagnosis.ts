import { createHash } from "node:crypto";
import { WorkflowError } from "../operations/reads.js";
import { evidenceIsFresh, normalizedInstant, sameEvidenceScope, type EvidenceScope, type EvidenceState, type NormalizedVisitEvidence } from "./evidence.js";

export interface DiagnosisPolicy { version: string; earlyReminderMinutes: number | null; }
export interface SourceAssessment {
  state: EvidenceState;
  outcome: "pass" | "fail" | "unknown";
  scope: EvidenceScope;
  patientId: string | null;
  fetchedAt: string | null;
  maxAgeSeconds: number;
  acceptanceVersion: string | null;
  reason: string | null;
  policyReference: string | null;
}
export interface LocationAssessment extends SourceAssessment { evidenceKind: "observation" | "reference_only" | "none"; }
export interface OverlapCandidate {
  visit: NormalizedVisitEvidence;
  allowance: "allowed" | "conflict" | "unknown";
  policyReference: string | null;
}
export interface DiagnosisContext {
  authorization?: SourceAssessment;
  eligibility?: SourceAssessment;
  location?: LocationAssessment;
  overlaps?: readonly OverlapCandidate[];
  overlapWindowComplete?: boolean;
}
export type DiagnosisKind = "source_evidence_unknown" | "not_started" | "in_progress" | "no_punches" | "one_punch_missing" | "open_after_end"
  | "recorded_overage" | "early_end" | "variable_shift" | "schedule_rules_unknown"
  | "overlap_allowed" | "overlap_conflict" | "overlap_unknown" | "authorization_failed" | "authorization_unknown"
  | "eligibility_failed" | "eligibility_unknown" | "location_failed" | "location_unknown";
export interface VisitDiagnosisIssue {
  id: string;
  kind: DiagnosisKind;
  level: "blocker" | "review" | "information" | "unknown";
  summary: string;
  facts: Readonly<Record<string, string | number | null>>;
  nextAction: string;
  blockingPolicy: "confirmed" | "unconfigured" | "not_applicable";
  caregiverReminder: boolean;
  officeFollowUp: boolean;
  officeTargetHours: 24 | null;
  reasonCodeCandidates: readonly ("110A" | "110D")[];
  suggestedNote: string | null;
}
export interface VisitDiagnosis {
  visitId: string;
  scope: EvidenceScope;
  evaluatedAt: string;
  ruleVersion: string;
  sourceRevision: string | null;
  state: "ready" | "unknown";
  verification: "blocked" | "verified" | "unverified" | "unknown";
  sourceVerification: NormalizedVisitEvidence["verification"];
  metrics: { scheduledMinutes: number | null; actualMinutes: number | null; evvMinutes: number | null;
    recordedBasis: "actual" | "evv" | null; varianceMinutes: number | null; earlyMinutes: number | null; openOverrunMinutes: number | null; };
  earlyReminderConfigured: boolean;
  issues: readonly VisitDiagnosisIssue[];
  sourceMutationPermitted: false;
}
const minutesBetween = (start: { epochMs: number } | null, end: { epochMs: number } | null) => start && end ? (end.epochMs - start.epochMs) / 60000 : null;
function evidenceReady(visit: NormalizedVisitEvidence, now: string): boolean {
  if (visit.state !== "ready" || !visit.provenance?.acceptanceVersion || !visit.provenance.maxAgeSeconds) return false;
  try { return evidenceIsFresh(visit.provenance.fetchedAt, now, visit.provenance.maxAgeSeconds); } catch { return false; }
}
function assessmentState(assessment: SourceAssessment | undefined, visit: NormalizedVisitEvidence, now: string): "pass" | "fail" | "unknown" {
  if (!assessment) return "unknown";
  if (!sameEvidenceScope(assessment.scope, visit.scope) || assessment.patientId !== visit.patientId) throw new WorkflowError("diagnosis_assessment_scope_mismatch", 403);
  if (assessment.state !== "ready" || !assessment.acceptanceVersion || !assessment.fetchedAt) return "unknown";
  try { if (!evidenceIsFresh(assessment.fetchedAt, now, assessment.maxAgeSeconds)) return "unknown"; } catch { return "unknown"; }
  return assessment.outcome;
}

// Pure rule evaluation. Contacts, delivery, local completion and source writes
// are intentionally outside this function. A candidate is never an approval.
export function evaluateVisit(visit: NormalizedVisitEvidence, policy: DiagnosisPolicy, now: string, context: DiagnosisContext = {}): VisitDiagnosis {
  const nowMs = normalizedInstant(now).epochMs;
  if (!policy.version.trim() || policy.version.length > 160 || policy.earlyReminderMinutes !== null
    && (!Number.isFinite(policy.earlyReminderMinutes) || policy.earlyReminderMinutes <= 0 || policy.earlyReminderMinutes > 1440)) throw new WorkflowError("invalid_diagnosis_policy");
  const issues: VisitDiagnosisIssue[] = [];
  const add = (kind: DiagnosisKind, level: VisitDiagnosisIssue["level"], summary: string, nextAction: string,
    options: Partial<Omit<VisitDiagnosisIssue, "id" | "kind" | "level" | "summary" | "nextAction">> = {}) => {
    const id = createHash("sha256").update(JSON.stringify([visit.scope.officeId, visit.scope.date, visit.visitId, policy.version, kind, options.facts?.relatedVisitId ?? null])).digest("hex");
    issues.push({ id, kind, level, summary, nextAction, facts: {}, blockingPolicy: "not_applicable", caregiverReminder: false,
      officeFollowUp: false, officeTargetHours: null, reasonCodeCandidates: [], suggestedNote: null, ...options });
  };
  const metrics: VisitDiagnosis["metrics"] = { scheduledMinutes: null, actualMinutes: null, evvMinutes: null,
    recordedBasis: visit.serviceTimeBasis, varianceMinutes: null, earlyMinutes: null, openOverrunMinutes: null };
  if (!evidenceReady(visit, now)) {
    add("source_evidence_unknown", "unknown", "Visit evidence is unavailable, unaccepted, incomplete or no longer fresh.", "Refresh and validate the source evidence before diagnosing punches or sending a reminder.",
      { facts: { evidenceState: visit.state === "ready" ? "stale" : visit.state } });
    return { visitId: visit.visitId, scope: visit.scope, evaluatedAt: now, ruleVersion: policy.version, sourceRevision: visit.provenance?.sourceRevision ?? null,
      state: "unknown", verification: "unknown", sourceVerification: visit.verification, metrics,
      earlyReminderConfigured: policy.earlyReminderMinutes !== null, issues, sourceMutationPermitted: false };
  }
  const times = visit.times, start = visit.serviceTimeBasis === "actual" ? times.actualStart : times.evvStart,
    end = visit.serviceTimeBasis === "actual" ? times.actualEnd : times.evvEnd;
  metrics.scheduledMinutes = minutesBetween(times.scheduledStart, times.scheduledEnd);
  metrics.actualMinutes = minutesBetween(times.actualStart, times.actualEnd);
  metrics.evvMinutes = minutesBetween(times.evvStart, times.evvEnd);
  const recordedMinutes = visit.serviceTimeBasis ? minutesBetween(start, end) : null;
  if (recordedMinutes !== null && metrics.scheduledMinutes !== null) metrics.varianceMinutes = recordedMinutes - metrics.scheduledMinutes;
  if (end && times.scheduledEnd) metrics.earlyMinutes = Math.max(0, (times.scheduledEnd.epochMs - end.epochMs) / 60000);
  const notStarted = times.scheduledStart && nowMs < times.scheduledStart.epochMs && !times.evvStart && !times.evvEnd;
  const inProgress = times.evvStart && !times.evvEnd && times.scheduledEnd && nowMs < times.scheduledEnd.epochMs;
  if (notStarted) {
    add("not_started", "information", "The scheduled visit has not started yet.", "Check accepted clocking evidence when the service window begins.");
  } else if (inProgress) {
    add("in_progress", "information", "Clock-in is recorded and the scheduled service window is still in progress.", "Wait for the actual clock-out; preserve the recorded clock-in.");
  } else if (!times.evvStart && !times.evvEnd || visit.clockingAttempt === "none") {
    add("no_punches", "blocker", "No accepted clock-in or clock-out evidence is recorded.", visit.clockingMethod === "token" ? "Request the recorded device codes through the approved vendor workflow." : "Review the approved clocking method and obtain supporting evidence.",
      { blockingPolicy: "confirmed", facts: { clockIn: null, clockOut: null, clockingAttempt: visit.clockingAttempt } });
  } else if (!times.evvStart || !times.evvEnd) {
    add("one_punch_missing", "review", !times.evvStart ? "Clock-in evidence is missing." : "Clock-out evidence is missing.", "Obtain the missing source evidence; do not invent the other timestamp.",
      { blockingPolicy: "unconfigured", facts: { missingEvent: !times.evvStart ? "clock_in" : "clock_out" } });
  }
  const scheduleAccepted = visit.scheduleType === "fixed" || visit.scheduleType === "variable" && visit.variableScheduleAccepted;
  if (!scheduleAccepted) add("schedule_rules_unknown", "unknown", "Schedule type or variable-schedule rules are not accepted.", "Validate the schedule type and applicable program rule before schedule-based reminders.");
  if (times.scheduledEnd && visit.openState === "open" && !times.evvEnd && !times.actualEnd) {
    metrics.openOverrunMinutes = Math.max(0, (nowMs - times.scheduledEnd.epochMs) / 60000);
    if (scheduleAccepted && metrics.openOverrunMinutes >= 15) add("open_after_end", "review", "The visit remains open at least fifteen minutes after its scheduled end.", "Recheck for delayed source data, remind the caregiver to record the real end, and open supervisor follow-up.",
      { caregiverReminder: true, officeFollowUp: true, officeTargetHours: 24, facts: { scheduledEnd: times.scheduledEnd.iso, overrunMinutes: metrics.openOverrunMinutes } });
  }
  const shiftedVariable = visit.scheduleType === "variable" && visit.variableScheduleAccepted && start && end
    && times.scheduledStart && times.scheduledEnd && metrics.varianceMinutes === 0
    && (start.epochMs !== times.scheduledStart.epochMs || end.epochMs !== times.scheduledEnd.epochMs);
  if (shiftedVariable) add("variable_shift", "information", "The accepted variable schedule shifted while preserving its expected duration.", "Retain the recorded times and review the applicable schedule-difference reason.",
    { facts: { varianceMinutes: 0, recordedStart: start.iso, recordedEnd: end.iso }, reasonCodeCandidates: ["110A"] });
  if (metrics.varianceMinutes !== null && metrics.varianceMinutes > 0) add("recorded_overage", "review", "Recorded service duration exceeds scheduled duration.", "Review authorization, any related visits and the reason for extra care; preserve actual work times and evaluate bill hours separately.",
    { facts: { scheduledMinutes: metrics.scheduledMinutes, recordedMinutes, excessMinutes: metrics.varianceMinutes, timeBasis: visit.serviceTimeBasis }, officeFollowUp: true, officeTargetHours: 24 });
  if (!shiftedVariable && metrics.earlyMinutes !== null && metrics.earlyMinutes > 0 && end && times.scheduledEnd) {
    const suggestedNote = `Recorded ${visit.serviceTimeBasis} end ${end.iso}; scheduled end ${times.scheduledEnd.iso}; ending ${metrics.earlyMinutes} minutes before the scheduled end. The reason requires review; recorded service time is preserved.`;
    add("early_end", "information", "The recorded ending precedes the scheduled end; early ending is allowed.", "Retain the factual note and review the caregiver explanation and applicable reason code.",
      { facts: { recordedEnd: end.iso, scheduledEnd: times.scheduledEnd.iso, earlyMinutes: metrics.earlyMinutes, varianceMinutes: metrics.varianceMinutes, timeBasis: visit.serviceTimeBasis },
        caregiverReminder: scheduleAccepted && policy.earlyReminderMinutes !== null && metrics.earlyMinutes >= policy.earlyReminderMinutes,
        reasonCodeCandidates: ["110A"], suggestedNote });
  }
  for (const [name, assessment] of [["authorization", context.authorization], ["eligibility", context.eligibility], ["location", context.location]] as const) {
    let outcome = assessmentState(assessment, visit, now);
    if (name === "location" && (!context.location || context.location.evidenceKind !== "observation")) outcome = "unknown";
    if (outcome === "pass") continue;
    const failed = outcome === "fail";
    add(`${name}_${failed ? "failed" : "unknown"}` as DiagnosisKind, failed ? "review" : "unknown",
      failed ? `Accepted ${name} evidence identifies an issue.` : `${name[0]!.toUpperCase() + name.slice(1)} evidence is not sufficient for a decision.`,
      name === "location" ? "Review accepted observed delivery-location evidence; a postal address does not establish visit presence." : `Review the applicable ${name} facts for this member, service and date.`,
      { blockingPolicy: "unconfigured", facts: { evidenceState: assessment?.state ?? "unavailable", reason: assessment?.reason ?? null, policyReference: assessment?.policyReference ?? null } });
  }
  for (const candidate of [...(context.overlaps ?? [])].sort((a, b) => a.visit.visitId.localeCompare(b.visit.visitId))) {
    const peer = candidate.visit;
    if (peer.visitId === visit.visitId) continue;
    const dayDifference = Math.abs(Date.parse(peer.scope.date + "T00:00:00Z") - Date.parse(visit.scope.date + "T00:00:00Z"));
    if (peer.scope.officeId !== visit.scope.officeId || peer.scope.timezone !== visit.scope.timezone || peer.scope.revision !== visit.scope.revision || !Number.isFinite(dayDifference) || dayDifference > 86_400_000) throw new WorkflowError("diagnosis_related_visit_scope_mismatch", 403);
    const sameCaregiver = !!visit.caregiverId && visit.caregiverId === peer.caregiverId, samePatient = !!visit.patientId && visit.patientId === peer.patientId;
    const peerStart = peer.serviceTimeBasis === "actual" ? peer.times.actualStart : peer.times.evvStart,
      peerEnd = peer.serviceTimeBasis === "actual" ? peer.times.actualEnd : peer.times.evvEnd;
    if (!evidenceReady(peer, now) || !start || !end || !peerStart || !peerEnd || !sameCaregiver && !samePatient) {
      add("overlap_unknown", "unknown", "Related interval evidence is insufficient to evaluate an overlap.", "Refresh both visits and validate their member/caregiver relationship and service intervals.", { facts: { relatedVisitId: peer.visitId, relatedServiceDate: peer.scope.date } }); continue;
    }
    const intersection = Math.min(end.epochMs, peerEnd.epochMs) - Math.max(start.epochMs, peerStart.epochMs);
    if (intersection <= 0) continue;
    const allowance = candidate.policyReference?.trim() ? candidate.allowance : "unknown";
    add(`overlap_${allowance}` as DiagnosisKind, allowance === "allowed" ? "information" : "review",
      allowance === "allowed" ? "The overlapping intervals have an accepted allowance." : allowance === "conflict" ? "The overlapping intervals conflict with the reviewed program rule." : "The intervals overlap; program allowance remains unknown.",
      "Review both visits, applicable authorizations and the recorded program decision; preserve the source intervals.",
      { facts: { relatedVisitId: peer.visitId, relatedServiceDate: peer.scope.date, overlapMinutes: intersection / 60000, relation: sameCaregiver && samePatient ? "same_caregiver_and_patient" : sameCaregiver ? "same_caregiver" : "same_patient", policyReference: candidate.policyReference },
        officeFollowUp: allowance !== "allowed", officeTargetHours: allowance !== "allowed" ? 24 : null, reasonCodeCandidates: allowance === "allowed" ? ["110D"] : [] });
  }
  if (context.overlapWindowComplete !== true) add("overlap_unknown", "unknown", "Complete related-visit discovery is not established.", "Complete the accepted overlapping-window discovery before claiming no conflicting visits.", { facts: { relatedVisitId: null } });
  const unresolved = issues.some(issue => ["review", "unknown", "blocker"].includes(issue.level));
  return { visitId: visit.visitId, scope: visit.scope, evaluatedAt: now, ruleVersion: policy.version, sourceRevision: visit.provenance!.sourceRevision,
    state: "ready", verification: issues.some(issue => issue.level === "blocker") ? "blocked" : visit.verification === "verified" && !unresolved ? "verified" : visit.verification === "unverified" ? "unverified" : "unknown",
    sourceVerification: visit.verification, metrics, earlyReminderConfigured: policy.earlyReminderMinutes !== null, issues, sourceMutationPermitted: false };
}

export interface MissingTokenDay { date: string; visitIds: readonly string[]; missingEvents: readonly ("clock_in" | "clock_out")[]; }
export interface MissingTokenSummary {
  officeId: string; caregiverId: string; revision: number; timezone: string;
  missingDayCount: number; days: readonly MissingTokenDay[];
  coverage: "accepted_input_only";
}
export function summarizeMissingTokenDays(visits: readonly NormalizedVisitEvidence[], now: string): {
  summaries: readonly MissingTokenSummary[]; excluded: readonly { visitId: string; reason: string }[]; complete: false;
} {
  const nowMs = normalizedInstant(now).epochMs, excluded: { visitId: string; reason: string }[] = [];
  const groups = new Map<string, { visit: NormalizedVisitEvidence; days: Map<string, { ids: Set<string>; events: Set<"clock_in" | "clock_out"> }> }>();
  for (const visit of visits) {
    if (!evidenceReady(visit, now) || visit.clockingMethod !== "token" || !visit.caregiverId) { excluded.push({ visitId: visit.visitId, reason: !evidenceReady(visit, now) ? "evidence_not_ready" : visit.clockingMethod !== "token" ? "token_method_not_established" : "caregiver_unknown" }); continue; }
    const events: ("clock_in" | "clock_out")[] = [];
    if (!visit.times.evvStart && visit.times.scheduledStart && nowMs >= visit.times.scheduledStart.epochMs) events.push("clock_in");
    if (!visit.times.evvEnd && visit.times.scheduledEnd && nowMs >= visit.times.scheduledEnd.epochMs) events.push("clock_out");
    if (!events.length) continue;
    const key = JSON.stringify([visit.scope.officeId, visit.caregiverId, visit.scope.revision, visit.scope.timezone]);
    const group = groups.get(key) ?? { visit, days: new Map() };
    const day = group.days.get(visit.scope.date) ?? { ids: new Set<string>(), events: new Set<"clock_in" | "clock_out">() };
    day.ids.add(visit.visitId); for (const event of events) day.events.add(event);
    group.days.set(visit.scope.date, day); groups.set(key, group);
  }
  const summaries = [...groups.values()].map(({ visit, days }): MissingTokenSummary => ({ officeId: visit.scope.officeId, caregiverId: visit.caregiverId!, revision: visit.scope.revision, timezone: visit.scope.timezone,
    missingDayCount: days.size, days: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => ({ date, visitIds: [...day.ids].sort(), missingEvents: [...day.events].sort() })), coverage: "accepted_input_only" }));
  return { summaries: summaries.sort((a, b) => a.officeId.localeCompare(b.officeId) || a.caregiverId.localeCompare(b.caregiverId) || a.revision - b.revision),
    excluded: excluded.sort((a, b) => a.visitId.localeCompare(b.visitId) || a.reason.localeCompare(b.reason)), complete: false };
}
