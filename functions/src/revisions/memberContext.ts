import { createHash } from "node:crypto";
import { WorkflowError, identifier, type OperationalRead, type ReadInput, type ReadOperation } from "../operations/reads.js";
import type { DiagnosisContext, SourceAssessment } from "./diagnosis.js";
import { evidenceIsFresh, normalizedInstant, validEvidenceScope, type EvidenceState, type NormalizedVisitEvidence } from "./evidence.js";

/** Protected source semantics, never dashboard policy or caller-authored proof. */
export interface MemberContextAcceptance {
  accepted: boolean; version: string; sourceVersion: string; reviewReference: string;
  scheduleOperation: "GetScheduleInfo"; billTo: "primary" | "secondary";
  calendarDateEncoding: "iso_date_or_midnight"; dateBounds: "inclusive";
  authorizationListComplete: boolean; contractListComplete: boolean;
}
export interface MemberContextSource {
  operation: ReadOperation; request: ReadInput; state: EvidenceState; reason: string | null;
  fetchedAt: string | null; records: Readonly<Record<string, string | null>>[];
  sourceRevision: string | null; validation: "source_unvalidated";
}
export interface RecordedCoveragePeriod {
  rawStartDate: string | null; rawEndDate: string | null; startDate: string | null; endDate: string | null;
  relation: "within_recorded_period" | "outside_recorded_period" | "unavailable" | "invalid" | "unaccepted";
}
export interface MemberContextResult {
  context: Pick<DiagnosisContext, "authorization" | "eligibility">;
  authorizationWindow: {
    state: EvidenceState; relation: "matched" | "missing" | "outside_period" | "contract_missing" | "unknown";
    contractId: string | null; serviceCodeId: string | null; authorizationIds: string[]; reason: string;
    limitsValidation: "not_validated"; approval: "not_established";
  };
  recordedEligibility: { state: EvidenceState; patientPresent: boolean; payerId: string | null; payerVerified: false;
    medicaid: RecordedCoveragePeriod; managedCare: RecordedCoveragePeriod; reason: string; };
  sources: MemberContextSource[];
  completeness: { complete: false; queries: number; authorizationDetailsRead: number; authorizationDetailsTotal: number;
    authorizationDiscoveryComplete: boolean; contractDiscoveryComplete: boolean; deferred: boolean; limitsValidated: false; };
}
export interface MemberContextOptions {
  visit: NormalizedVisitEvidence;
  query: (input: ReadInput) => Promise<OperationalRead>;
  fence: () => Promise<void>;
  now: () => string;
  acceptance: MemberContextAcceptance | null;
  maxQueries?: number; maxAuthorizationDetails?: number; timeBudgetMs?: number;
}
const PROFILE_KEYS = ["accepted", "version", "sourceVersion", "reviewReference", "scheduleOperation", "billTo", "calendarDateEncoding", "dateBounds", "authorizationListComplete", "contractListComplete"];
export function validMemberContextAcceptance(value: unknown, sourceVersion?: string): value is MemberContextAcceptance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === PROFILE_KEYS.length && Object.keys(item).every(key => PROFILE_KEYS.includes(key))
    && [item.accepted, item.authorizationListComplete, item.contractListComplete].every(value => typeof value === "boolean")
    && [item.version, item.sourceVersion].every(value => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,80}$/.test(value))
    && (sourceVersion === undefined || sourceVersion === item.sourceVersion)
    && typeof item.reviewReference === "string" && !!item.reviewReference.trim() && item.reviewReference.length <= 500 && !/[\x00-\x1f\x7f]/.test(item.reviewReference)
    && item.scheduleOperation === "GetScheduleInfo" && typeof item.billTo === "string" && ["primary", "secondary"].includes(item.billTo)
    && item.calendarDateEncoding === "iso_date_or_midnight" && item.dateBounds === "inclusive";
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function rowHash(row: Readonly<Record<string, string | null>>) { return hash(Object.entries(row).sort(([left], [right]) => left.localeCompare(right))); }
function positive(value: unknown): string | null { try { return identifier(value); } catch { return null; } }
/** Written calendar bounds only. Never turn vendor wall time into an instant. */
function calendar(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d(?:T00:00:00(?:\.0{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/.test(value) || /[+-]14:(?!00)/.test(value) || value.endsWith("-00:00")) return null;
  const date = value.slice(0, 10), instant = Date.parse(date + "T00:00:00Z");
  return Number(date.slice(0, 4)) >= 1900 && Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === date ? date : null;
}
function range(row: Readonly<Record<string, string | null>>, start: string, end: string) {
  const from = calendar(row[start]), until = calendar(row[end]);
  return from && until && from <= until ? { from, until } : null;
}
function covers(period: { from: string; until: string }, date: string) { return period.from <= date && date <= period.until; }
function bounded(value: number | undefined, fallback: number, maximum: number) {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < 1 || result > maximum) throw new WorkflowError("invalid_member_context_budget");
  return result;
}
function missingCoverage(rawStartDate: string | null = null, rawEndDate: string | null = null): RecordedCoveragePeriod {
  return { rawStartDate, rawEndDate, startDate: null, endDate: null, relation: "unavailable" };
}

/** Bounded standard-schedule/member join. Limits and actual payer eligibility
 * are deliberately not approved by a matching recorded date/service window. */
export async function loadMemberContext(options: MemberContextOptions): Promise<MemberContextResult> {
  const { visit, query, fence, now, acceptance } = options;
  const patientId = positive(visit.patientId);
  validEvidenceScope(visit.scope); identifier(visit.visitId);
  const initialNow = now(); normalizedInstant(initialNow);
  const maxQueries = bounded(options.maxQueries, 7, 9), maxDetails = bounded(options.maxAuthorizationDetails, 3, 5), timeBudget = bounded(options.timeBudgetMs, 20000, 25000);
  const started = performance.now(), maxAge = visit.provenance?.maxAgeSeconds ?? 300;
  const result: MemberContextResult = {
    context: {}, authorizationWindow: { state: "unavailable", relation: "unknown", contractId: null, serviceCodeId: null, authorizationIds: [], reason: "member_context_unavailable", limitsValidation: "not_validated", approval: "not_established" },
    recordedEligibility: { state: "unavailable", patientPresent: false, payerId: null, payerVerified: false, medicaid: missingCoverage(), managedCare: missingCoverage(), reason: "member_context_unavailable" },
    sources: [], completeness: { complete: false, queries: 0, authorizationDetailsRead: 0, authorizationDetailsTotal: 0, authorizationDiscoveryComplete: false, contractDiscoveryComplete: false, deferred: false, limitsValidated: false },
  };
  let patient: OperationalRead | null = null;
  const assessment = (state: EvidenceState, outcome: SourceAssessment["outcome"], reason: string): SourceAssessment => ({ state, outcome, scope: { ...visit.scope }, patientId,
    fetchedAt: result.sources.filter(item => item.fetchedAt).map(item => item.fetchedAt!).sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? visit.provenance?.fetchedAt ?? null,
    maxAgeSeconds: maxAge, acceptanceVersion: acceptance?.accepted === true ? acceptance.version : null, policyReference: acceptance?.reviewReference ?? null, reason });
  const finish = async (state: EvidenceState, reason: string, outcome: SourceAssessment["outcome"] = "unknown"): Promise<MemberContextResult> => {
    await fence();
    const at = now();
    let finalState = state, finalReason = reason, finalOutcome = outcome;
    if (visit.state === "ready" && visit.provenance) {
      try {
        if (!evidenceIsFresh(visit.provenance.fetchedAt, at, maxAge) || result.sources.some(source => source.fetchedAt && !evidenceIsFresh(source.fetchedAt, at, maxAge))) {
          finalState = "stale"; finalReason = "member_context_evidence_stale"; finalOutcome = "unknown";
        }
      } catch { finalState = "stale"; finalReason = "member_context_evidence_stale"; finalOutcome = "unknown"; }
    }
    result.context.authorization = assessment(finalState, finalOutcome, finalReason);
    if (result.authorizationWindow.relation === "unknown") { result.authorizationWindow.state = finalState; result.authorizationWindow.reason = finalReason; }
    if (finalState === "stale") { result.authorizationWindow.state = "stale"; result.authorizationWindow.reason = finalReason; }
    const row = patient?.records[0];
    if (row && patient!.records.length === 1 && row.PatientID === visit.patientId && row.OfficeID === visit.scope.officeId) {
      result.recordedEligibility.patientPresent = true; result.recordedEligibility.payerId = positive(row.PayerID);
      const recorded = (start: string, end: string): RecordedCoveragePeriod => {
        const value = missingCoverage(row[start] ?? null, row[end] ?? null);
        if (!acceptance?.accepted) return { ...value, relation: "unaccepted" };
        const period = range(row, start, end);
        if (!period) return { ...value, relation: row[start] && row[end] ? "invalid" : "unavailable" };
        return { ...value, startDate: period.from, endDate: period.until, relation: covers(period, visit.scope.date) ? "within_recorded_period" : "outside_recorded_period" };
      };
      result.recordedEligibility.medicaid = recorded("MedicaidStartDate", "MedicaidEndDate");
      result.recordedEligibility.managedCare = recorded("ManagedCareStartDate", "ManagedCareEndDate");
      result.recordedEligibility.state = finalState === "stale" ? "stale" : !acceptance?.accepted ? "unaccepted" : [result.recordedEligibility.medicaid, result.recordedEligibility.managedCare].some(period => ["invalid", "unavailable"].includes(period.relation)) ? "incomplete" : "ready";
      result.recordedEligibility.reason = result.recordedEligibility.state === "stale" ? finalReason : "recorded_coverage_dates_are_not_payer_verified_eligibility";
    } else { result.recordedEligibility.state = finalState; result.recordedEligibility.reason = finalReason; }
    result.context.eligibility = assessment(result.recordedEligibility.state, "unknown", result.recordedEligibility.reason);
    return result;
  };
  if (!acceptance) return finish("unaccepted", "member_context_acceptance_pending");
  if (!validMemberContextAcceptance(acceptance)) return finish("unaccepted", "member_context_acceptance_invalid");
  if (visit.state !== "ready" || !visit.provenance || !visit.raw || !patientId || !visit.provenance.maxAgeSeconds
    || visit.provenance.source !== "hhaexchange" || !["GetVisitInfoV2", "GetVisitInfoV3"].includes(visit.provenance.operation)) return finish(visit.state === "ready" ? "incomplete" : visit.state, "member_visit_evidence_not_ready");
  if (acceptance.sourceVersion !== visit.provenance.acceptanceVersion) return finish("unaccepted", "member_context_source_acceptance_changed");
  if (rowHash(visit.raw) !== visit.provenance.sourceRevision || visit.raw.ID !== visit.visitId || visit.raw["Patient/ID"] !== visit.patientId) return finish("failed", "member_visit_source_revision_mismatch");
  try { if (!evidenceIsFresh(visit.provenance.fetchedAt, initialNow, maxAge)) return finish("stale", "member_visit_evidence_stale"); }
  catch { return finish("failed", "member_visit_timestamp_unusable"); }
  const read = async (input: ReadInput): Promise<OperationalRead | null> => {
    await fence();
    const preview: MemberContextSource = { operation: input.operation, request: { ...input }, state: "unavailable", reason: null, fetchedAt: null, records: [], sourceRevision: null, validation: "source_unvalidated" };
    result.sources.push(preview);
    if (result.completeness.queries >= maxQueries || performance.now() - started >= timeBudget) { result.completeness.deferred = true; preview.reason = "member_context_budget_deferred"; return null; }
    let source: OperationalRead;
    try { result.completeness.queries++; source = await query(input); }
    catch (error) {
      if (error instanceof WorkflowError && ([403, 409, 423, 429].includes(error.status))) throw error;
      await fence(); preview.reason = "member_source_unavailable"; return null;
    }
    await fence();
    if (source.operation !== input.operation || source.source !== "hhaexchange" || !Array.isArray(source.records) || source.records.length > 200 || typeof source.truncated !== "boolean"
      || source.records.some(row => !row || typeof row !== "object" || Array.isArray(row) || Object.values(row).some(value => value !== null && typeof value !== "string"))) { preview.state = "failed"; preview.reason = "member_source_response_invalid"; return null; }
    preview.fetchedAt = source.fetchedAt;
    preview.records = source.records.map(row => Object.freeze({ ...row })); preview.sourceRevision = hash(preview.records.map(row => rowHash(row)));
    try { if (!evidenceIsFresh(source.fetchedAt, now(), maxAge)) { preview.state = "stale"; preview.reason = "member_source_stale"; return null; } }
    catch { preview.state = "failed"; preview.reason = "member_source_timestamp_invalid"; return null; }
    preview.state = source.truncated ? "incomplete" : "ready"; preview.reason = source.truncated ? "member_source_truncated" : null;
    return source;
  };
  const quarantineUnscoped = (reason: string) => {
    const preview = result.sources.at(-1)!;
    preview.records = []; preview.sourceRevision = null; preview.state = "incomplete"; preview.reason = reason;
  };
  patient = await read({ operation: "GetPatientDemographics", id: patientId });
  if (!patient) return finish("unavailable", "member_patient_source_unavailable");
  if (patient.records.some(row => row.PatientID && row.PatientID !== patientId || row.OfficeID && row.OfficeID !== visit.scope.officeId)) throw new WorkflowError("member_patient_office_scope_mismatch", 403);
  if (patient.records.some(row => !row.PatientID || !row.OfficeID)) { quarantineUnscoped("member_patient_identity_unavailable"); patient = null; return finish("incomplete", "member_patient_identity_unavailable"); }
  if (patient.truncated || patient.records.length !== 1) { patient = null; return finish("incomplete", "member_patient_not_uniquely_returned"); }
  if (patient.records[0]!.PatientID !== visit.patientId || patient.records[0]!.OfficeID !== visit.scope.officeId) throw new WorkflowError("member_patient_office_scope_mismatch", 403);
  const schedule = await read({ operation: "GetScheduleInfo", id: visit.visitId });
  if (!schedule) return finish("unavailable", "member_schedule_source_unavailable");
  if (schedule.records.some(row => row.ID && row.ID !== visit.visitId || row["Patient/ID"] && row["Patient/ID"] !== patientId || calendar(row.VisitDate) && calendar(row.VisitDate) !== visit.scope.date)) throw new WorkflowError("member_schedule_scope_mismatch", 403);
  if (schedule.records.some(row => !row.ID || !row["Patient/ID"])) { quarantineUnscoped("member_schedule_identity_unavailable"); return finish("incomplete", "member_schedule_identity_unavailable"); }
  if (schedule.truncated || schedule.records.length !== 1) return finish("incomplete", "member_schedule_not_uniquely_returned");
  const scheduled = schedule.records[0]!;
  if (!calendar(scheduled.VisitDate)) return finish("incomplete", "member_schedule_service_date_unusable");
  if (visit.caregiverId && !scheduled["Caregiver/ID"]) return finish("incomplete", "member_schedule_caregiver_identity_missing");
  if (visit.caregiverId && scheduled["Caregiver/ID"] !== visit.caregiverId) throw new WorkflowError("member_schedule_source_changed", 409);
  try {
    if (!visit.times.scheduledStart || !visit.times.scheduledEnd || normalizedInstant(scheduled.ScheduleStartTime).epochMs !== visit.times.scheduledStart.epochMs || normalizedInstant(scheduled.ScheduleEndTime).epochMs !== visit.times.scheduledEnd.epochMs) throw new WorkflowError("member_schedule_source_changed", 409);
  } catch (error) { if (error instanceof WorkflowError && error.status === 409) throw error; return finish("incomplete", "member_schedule_timestamps_unusable"); }
  const leg = acceptance.billTo === "primary" ? "PrimaryBillTo" : "SecondaryBillTo";
  const contractId = positive(scheduled[leg + "/Contract/ID"]), serviceCodeId = positive(scheduled[leg + "/ServiceCode/ID"]);
  result.authorizationWindow.contractId = contractId; result.authorizationWindow.serviceCodeId = serviceCodeId;
  if (!contractId || !serviceCodeId) return finish("incomplete", "member_schedule_service_contract_missing");
  const contracts = await read({ operation: "GetPatientContracts", patientId, date: visit.scope.date });
  if (!contracts) return finish("unavailable", "member_contract_source_unavailable");
  const search = await read({ operation: "SearchPatientAuthorizations", patientId });
  if (!search) return finish("unavailable", "member_authorization_discovery_unavailable");
  const placementsValid = contracts.records.every(row => positive(row.PlacementID) && positive(row["Contract/ID"]) && positive(row["ServiceCode/ID"]) && range(row, "ServiceStartDate", "DischargeDate"));
  const uniquePlacements = new Set(contracts.records.map(row => row.PlacementID)).size === contracts.records.length;
  const discoveryValid = search.records.every(row => positive(row.ID) && positive(row.ContractID) && range(row, "StartDate", "StopDate")) && new Set(search.records.map(row => row.ID)).size === search.records.length;
  result.completeness.contractDiscoveryComplete = acceptance.accepted && acceptance.contractListComplete && !contracts.truncated && placementsValid && uniquePlacements;
  const candidates = search.records.filter(row => row.ContractID === contractId).sort((left, right) => Number(left.ID) - Number(right.ID));
  result.completeness.authorizationDetailsTotal = candidates.length;
  let detailsValid = true;
  const details: Record<string, string | null>[] = [];
  for (const candidate of candidates.slice(0, maxDetails)) {
    const id = positive(candidate.ID);
    if (!id) { detailsValid = false; continue; }
    const detail = await read({ operation: "GetPatientAuthorizationInfo", patientId, id });
    if (!detail) { detailsValid = false; continue; }
    result.completeness.authorizationDetailsRead++;
    if (detail.records.some(row => row.AuthorizationID && row.AuthorizationID !== id || row["Patient/ID"] && row["Patient/ID"] !== patientId)) throw new WorkflowError("member_authorization_identity_mismatch", 403);
    if (detail.records.some(row => !row.AuthorizationID || !row["Patient/ID"])) { quarantineUnscoped("member_authorization_identity_unavailable"); detailsValid = false; continue; }
    if (detail.truncated || detail.records.length !== 1) { detailsValid = false; continue; }
    const row = detail.records[0]!;
    if (row.AuthorizationID !== id || row["Patient/ID"] !== visit.patientId) throw new WorkflowError("member_authorization_identity_mismatch", 403);
    if (!positive(row["Contract/ID"])) { detailsValid = false; continue; }
    if (row["Contract/ID"] !== candidate.ContractID) throw new WorkflowError("member_authorization_contract_changed", 409);
    const period = range(row, "StartDate", "StopDate"), listed = range(candidate, "StartDate", "StopDate");
    if (!positive(row["ServiceCode/ID"]) || !period || !listed) { detailsValid = false; continue; }
    if (period.from !== listed.from || period.until !== listed.until) throw new WorkflowError("member_authorization_dates_changed", 409);
    details.push(row);
  }
  if (candidates.length > maxDetails) result.completeness.deferred = true;
  result.completeness.authorizationDiscoveryComplete = acceptance.accepted && acceptance.authorizationListComplete && !search.truncated && discoveryValid && detailsValid && candidates.length <= maxDetails && details.length === candidates.length;
  if (!acceptance.accepted) return finish("unaccepted", "member_context_acceptance_pending");
  const matched = details.filter(row => row["ServiceCode/ID"] === serviceCodeId), inPeriod = matched.filter(row => covers(range(row, "StartDate", "StopDate")!, visit.scope.date));
  const placements = contracts.records.filter(row => row["Contract/ID"] === contractId && row["ServiceCode/ID"] === serviceCodeId);
  const activePlacement = placements.some(row => { const period = range(row, "ServiceStartDate", "DischargeDate"); return period && covers(period, visit.scope.date); });
  if (inPeriod.length && activePlacement) {
    result.authorizationWindow.state = "ready"; result.authorizationWindow.relation = "matched"; result.authorizationWindow.authorizationIds = [...new Set(inPeriod.map(row => row.AuthorizationID!))];
    result.authorizationWindow.reason = "recorded_service_contract_period_present_limits_unvalidated";
    return finish("incomplete", "authorization_limits_and_units_not_validated");
  }
  if (!result.completeness.authorizationDiscoveryComplete || !result.completeness.contractDiscoveryComplete || result.completeness.deferred) return finish("incomplete", "member_context_discovery_incomplete");
  const relation = !activePlacement ? "contract_missing" : matched.length ? "outside_period" : "missing";
  result.authorizationWindow.state = "ready"; result.authorizationWindow.relation = relation;
  result.authorizationWindow.reason = relation === "contract_missing" ? "recorded_contract_service_period_missing" : relation === "outside_period" ? "recorded_authorization_outside_service_date" : "recorded_service_authorization_missing";
  return finish("ready", result.authorizationWindow.reason, "fail");
}
