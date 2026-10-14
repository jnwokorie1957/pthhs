import { createHash } from "node:crypto";
import { identifier, WorkflowError, type OperationalRead } from "../operations/reads.js";
import type { VisitVerificationReceipt } from "./verification.js";

export type EvidenceState = "ready" | "unavailable" | "unaccepted" | "stale" | "incomplete" | "failed";
export interface EvidenceScope { officeId: string; date: string; timezone: string; revision: number; }
export interface NormalizedInstant { raw: string; iso: string; epochMs: number; }
export type ScheduleType = "fixed" | "variable" | "unknown";
export type ClockingMethod = "token" | "other" | "unknown";
export type VisitTimeBasis = "actual" | "evv";

// Construct this from a protected server acceptance record and a server-proven
// discovery window. It is deliberately separate from the OperationalRead and
// must never be populated from an HTTP request body or browser assertions.
export interface ServerSourceAcceptance {
  operation: "GetVisitInfoV2" | "GetVisitInfoV3";
  version: string;
  accepted: boolean;
  complete: boolean;
  scope: EvidenceScope;
  visitIds: readonly string[];
  maxAgeSeconds: number;
  missingEvvMeansAbsent: boolean;
  serviceTimeBasis: VisitTimeBasis;
}
export interface VisitEvidenceContext {
  scope: EvidenceScope;
  visitId: string;
  now: string;
  acceptance: ServerSourceAcceptance | null;
  readError?: string;
  scheduleType?: ScheduleType;
  variableScheduleAccepted?: boolean;
  clockingMethod?: ClockingMethod;
  clockingAttempt?: "present" | "none" | "unknown";
  openState?: "open" | "closed" | "unknown";
  verification?: "verified" | "unverified" | "unknown";
}
export interface VisitTimes {
  scheduledStart: NormalizedInstant | null; scheduledEnd: NormalizedInstant | null;
  actualStart: NormalizedInstant | null; actualEnd: NormalizedInstant | null;
  evvStart: NormalizedInstant | null; evvEnd: NormalizedInstant | null;
}
export interface EvidenceProvenance {
  operation: "GetVisitInfoV2" | "GetVisitInfoV3";
  source: "hhaexchange";
  fetchedAt: string;
  acceptanceVersion: string | null;
  sourceRevision: string;
  maxAgeSeconds: number | null;
  originalValidation: "source_unvalidated";
  originalTimezone: "source_values_unconverted";
}
export interface NormalizedVisitEvidence {
  visitId: string;
  scope: EvidenceScope;
  state: EvidenceState;
  reasons: readonly string[];
  raw: Readonly<Record<string, string | null>> | null;
  provenance: EvidenceProvenance | null;
  times: VisitTimes;
  patientId: string | null;
  caregiverId: string | null;
  scheduleType: ScheduleType;
  variableScheduleAccepted: boolean;
  clockingMethod: ClockingMethod;
  clockingAttempt: "present" | "none" | "unknown";
  openState: "open" | "closed" | "unknown";
  verification: "verified" | "unverified" | "unknown";
  verificationReceipt?: VisitVerificationReceipt;
  serviceTimeBasis: VisitTimeBasis | null;
}

// Date.parse alone accepts ambiguous wall times and repairs invalid dates.
// Require an offset and verify the written calendar before normalizing to UTC.
export function normalizedInstant(value: unknown, code = "invalid_normalized_timestamp"): NormalizedInstant {
  if (typeof value !== "string") throw new WorkflowError(code);
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  if (!match || value.endsWith("-00:00") || /[+-]14:(?!00)/.test(value)) throw new WorkflowError(code);
  const date = value.slice(0, 10), midnight = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) throw new WorkflowError(code);
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs)) throw new WorkflowError(code);
  return Object.freeze({ raw: value, iso: new Date(epochMs).toISOString(), epochMs });
}
export function validEvidenceScope(scope: EvidenceScope): void {
  identifier(scope.officeId);
  const instant = normalizedInstant(scope.date + "T00:00:00Z", "invalid_evidence_date");
  if (instant.iso.slice(0, 10) !== scope.date || !Number.isSafeInteger(scope.revision) || scope.revision < 0) throw new WorkflowError("invalid_evidence_scope");
  try { new Intl.DateTimeFormat("en", { timeZone: scope.timezone }); } catch { throw new WorkflowError("invalid_evidence_timezone"); }
}
export function sameEvidenceScope(left: EvidenceScope, right: EvidenceScope): boolean {
  return left.officeId === right.officeId && left.date === right.date && left.timezone === right.timezone && left.revision === right.revision;
}
export function evidenceIsFresh(fetchedAt: string, now: string, maxAgeSeconds: number): boolean {
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0 || maxAgeSeconds > 3600) throw new WorkflowError("invalid_evidence_freshness_policy");
  const age = normalizedInstant(now).epochMs - normalizedInstant(fetchedAt).epochMs;
  return age >= 0 && age <= maxAgeSeconds * 1000;
}
const EMPTY_TIMES: VisitTimes = { scheduledStart: null, scheduledEnd: null, actualStart: null, actualEnd: null, evvStart: null, evvEnd: null };
const TIME_FIELDS = { scheduledStart: "ScheduleStartTime", scheduledEnd: "ScheduleEndTime", actualStart: "VisitStartTime", actualEnd: "VisitEndTime", evvStart: "EVVStartTime", evvEnd: "EVVEndTime" } as const;
const REQUIRED_FIELDS = ["ID", "VisitDate", "Patient/ID", "Caregiver/ID", ...Object.values(TIME_FIELDS)] as const;

export function adaptVisitEvidence(source: OperationalRead | null, context: VisitEvidenceContext): NormalizedVisitEvidence {
  validEvidenceScope(context.scope); identifier(context.visitId); const nowMs = normalizedInstant(context.now).epochMs;
  const acceptance = context.acceptance;
  if (acceptance) {
    validEvidenceScope(acceptance.scope);
    if (!sameEvidenceScope(context.scope, acceptance.scope) || !acceptance.visitIds.includes(context.visitId)) throw new WorkflowError("revision_evidence_scope_mismatch", 403);
    if (!acceptance.version.trim() || typeof acceptance.accepted !== "boolean" || typeof acceptance.complete !== "boolean"
      || typeof acceptance.missingEvvMeansAbsent !== "boolean" || !["actual", "evv"].includes(acceptance.serviceTimeBasis)) throw new WorkflowError("invalid_server_source_acceptance");
    evidenceIsFresh(context.now, context.now, acceptance.maxAgeSeconds);
  }
  const base: NormalizedVisitEvidence = { visitId: context.visitId, scope: Object.freeze({ ...context.scope }), state: "unavailable", reasons: [], raw: null, provenance: null,
    times: { ...EMPTY_TIMES }, patientId: null, caregiverId: null, scheduleType: context.scheduleType ?? "unknown",
    variableScheduleAccepted: context.variableScheduleAccepted === true, clockingMethod: context.clockingMethod ?? "unknown",
    clockingAttempt: context.clockingAttempt ?? "unknown", openState: context.openState ?? "unknown", verification: context.verification ?? "unknown",
    serviceTimeBasis: acceptance?.serviceTimeBasis ?? null };
  const result = (state: EvidenceState, reasons: string[]) => ({ ...base, state, reasons: Object.freeze(reasons) });
  if (!source) {
    if (context.readError && !/^[a-z][a-z0-9_]{0,99}$/.test(context.readError)) throw new WorkflowError("invalid_visit_read_error");
    if (context.readError?.startsWith("not_attempted_")) return result("unavailable", [context.readError]);
    return result(context.readError ? "failed" : "unavailable", context.readError ? ["visit_source_read_failed", context.readError] : ["visit_source_unavailable"]);
  }
  if (!["GetVisitInfoV2", "GetVisitInfoV3"].includes(source.operation) || source.source !== "hhaexchange"
    || !Array.isArray(source.records) || typeof source.truncated !== "boolean") throw new WorkflowError("invalid_visit_evidence_source", 502);
  if (acceptance && source.operation !== acceptance.operation) throw new WorkflowError("visit_evidence_operation_mismatch", 502);
  if (source.records.length !== 1) return result(source.records.length ? "incomplete" : "failed", ["visit_source_not_uniquely_returned"]);
  const row = source.records[0]!;
  if (!row || typeof row !== "object" || Array.isArray(row) || Object.values(row).some(value => value !== null && typeof value !== "string")) throw new WorkflowError("invalid_visit_evidence_record", 502);
  if (row.ID !== context.visitId) throw new WorkflowError("visit_evidence_identity_mismatch", 502);
  if (!row.VisitDate || row.VisitDate.slice(0, 10) !== context.scope.date || !new RegExp(`^${context.scope.date}(?:$|T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|[+-]\\d\\d:\\d\\d)?)$`).test(row.VisitDate)) throw new WorkflowError("visit_evidence_date_scope_mismatch", 403);
  if (row.OfficeID !== undefined && row.OfficeID !== context.scope.officeId) throw new WorkflowError("visit_evidence_office_scope_mismatch", 403);
  base.raw = Object.freeze({ ...row });
  const sourceRevision = createHash("sha256").update(JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
  base.provenance = { operation: source.operation as EvidenceProvenance["operation"], source: "hhaexchange", fetchedAt: source.fetchedAt,
    acceptanceVersion: acceptance?.version ?? null, sourceRevision, maxAgeSeconds: acceptance?.maxAgeSeconds ?? null,
    originalValidation: "source_unvalidated", originalTimezone: "source_values_unconverted" };
  if (!acceptance?.accepted) return result("unaccepted", ["visit_source_acceptance_pending"]);
  if (source.truncated || !acceptance.complete || REQUIRED_FIELDS.some(field => !Object.hasOwn(row, field))) return result("incomplete", ["visit_source_incomplete"]);
  try {
    if (!evidenceIsFresh(source.fetchedAt, context.now, acceptance.maxAgeSeconds)) return result("stale", ["visit_source_stale_or_future"]);
    base.patientId = row["Patient/ID"] ? identifier(row["Patient/ID"]) : null;
    base.caregiverId = row["Caregiver/ID"] ? identifier(row["Caregiver/ID"]) : null;
    for (const [key, field] of Object.entries(TIME_FIELDS) as [keyof VisitTimes, string][]) {
      base.times[key] = row[field] === null ? null : normalizedInstant(row[field], "visit_source_timestamp_unusable");
    }
  } catch (error) { return result("failed", [error instanceof WorkflowError ? error.code : "visit_source_normalization_failed"]); }
  if ([base.times.actualStart, base.times.actualEnd, base.times.evvStart, base.times.evvEnd].some(value => value !== null && value.epochMs > nowMs)) {
    return result("failed", ["visit_source_recorded_time_future"]);
  }
  if (!base.patientId || !base.times.scheduledStart || !base.times.scheduledEnd) return result("incomplete", ["visit_identity_or_schedule_missing"]);
  const localParts = new Intl.DateTimeFormat("en-US", { timeZone: context.scope.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(base.times.scheduledStart.epochMs));
  const scheduledDate = ["year", "month", "day"].map(name => localParts.find(part => part.type === name)!.value).join("-");
  if (scheduledDate !== context.scope.date) return result("failed", ["scheduled_start_service_date_mismatch"]);
  if (!acceptance.missingEvvMeansAbsent && (!base.times.evvStart || !base.times.evvEnd)) return result("incomplete", ["missing_evv_semantics_unaccepted"]);
  for (const [start, end] of [[base.times.scheduledStart, base.times.scheduledEnd], [base.times.actualStart, base.times.actualEnd], [base.times.evvStart, base.times.evvEnd]]) {
    if (start && end && end.epochMs <= start.epochMs) return result("failed", ["visit_source_interval_invalid"]);
  }
  if (base.clockingAttempt === "none" && (base.times.evvStart || base.times.evvEnd)
    || base.openState === "open" && (base.times.evvEnd || base.times.actualEnd)) return result("failed", ["visit_source_state_conflict"]);
  return result("ready", []);
}
