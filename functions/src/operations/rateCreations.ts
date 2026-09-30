import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts, rateDecimal } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface RateCreation extends Versioned {
  operation: "AddCaregiverRate"; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface RateCreationSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_rate_creation_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function date(value: unknown): string { if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new WorkflowError("source_rate_date_mapping_required", 409); return value; }
export const rateCreationTarget = (facts: Facts) => `rate_create_${identifier(facts.CaregiverID)}`;
export function sameCreatedRateFacts(left: Facts, right: Facts) {
  const canonical = (facts: Facts) => Object.fromEntries(Object.entries(facts).filter(([key]) => key !== "CaregiverRateID").map(([key, value]) => {
    if (["HourlyRate", "DailyRate", "VisitRate"].includes(key) && value !== null) { rateDecimal(value); const [whole, fractional = ""] = value.split("."); value = whole!.replace(/^0+(?=\d)/, "") + "." + fractional.replace(/0+$/, ""); }
    return [key, value];
  }));
  return sameSourceFacts(canonical(left), canonical(right));
}
function array(value: string | null | undefined): unknown[] { try { const parsed = JSON.parse(value || ""); if (Array.isArray(parsed)) return parsed; } catch {} throw new WorkflowError("caregiver_office_discipline_mapping_required", 409); }
export async function currentRateCreation(read: (input: ReadInput) => Promise<OperationalRead>, facts: Facts, officeId: string): Promise<Facts> {
  const results = await Promise.allSettled([read({ operation: "GetCaregiverDemographics", id: identifier(facts.CaregiverID) }), read({ operation: "GetPayRateCodes", officeId, status: "Active" }), read({ operation: "GetCaregiverRates", id: identifier(facts.CaregiverID) }), ...(facts.PatientID === null ? [] : [read({ operation: "GetPatientDemographics", id: identifier(facts.PatientID) })])]);
  const failed = results.find(row => row.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
  const [caregivers, codes, rates, patients] = results.map(row => (row as PromiseFulfilledResult<OperationalRead>).value);
  if ([caregivers!, codes!, rates!].some(row => row.truncated)) throw new WorkflowError("complete_rate_source_required", 409);
  if (patients && (patients.truncated || patients.records.length !== 1 || patients.records[0]?.PatientID !== facts.PatientID || patients.records[0]?.OfficeID !== officeId)) throw new WorkflowError("rate_patient_office_mismatch", 409);
  const caregiver = caregivers!.records.filter(row => row.ID === facts.CaregiverID), code = codes!.records.filter(row => row.PayRateCodeID === facts.PayCodeID && row.DisciplineID === facts.Discipline);
  if (caregiver.length !== 1 || code.length !== 1 || !code[0]!.Discipline || !array(caregiver[0]!.OfficeIDs).includes(officeId) || !array(caregiver[0]!.EmploymentDisciplines).includes(code[0]!.Discipline)) throw new WorkflowError("caregiver_office_paycode_discipline_mismatch", 409);
  if (code[0]!.Active !== "Y") throw new WorkflowError("active_pay_rate_code_required", 409);
  const disciplineName = code[0]!.Discipline!;
  const matching = rates!.records.filter(row => {
    identifier(row.CaregiverRateID); identifier(row.PayCodeID);
    if (row.PatientID !== null) identifier(row.PatientID);
    if (row.CaregiverID !== facts.CaregiverID) throw new WorkflowError("rate_source_subject_mismatch", 409);
    if (row.PayCodeID !== facts.PayCodeID) return false;
    if (row.PatientID !== null && facts.PatientID !== null && row.PatientID !== facts.PatientID) return false;
    return date(row.FromDate) <= date(facts.ToDate) && date(row.ToDate) >= date(facts.FromDate);
  });
  if (!matching.length) return { Exists: "false", DisciplineName: disciplineName };
  if (matching.length !== 1) throw new WorkflowError("overlapping_rates_not_unique", 409);
  const row = matching[0]!; identifier(row.CaregiverRateID);
  return { Exists: "true", CaregiverRateID: row.CaregiverRateID!, CaregiverID: row.CaregiverID!, Discipline: facts.Discipline!, DisciplineName: row.Discipline ?? null, PayCodeID: row.PayCodeID!, PatientID: row.PatientID ?? null, FromDate: row.FromDate!, ToDate: row.ToDate!, HourlyRate: row.HourlyRate ?? null, DailyRate: row.DailyRate ?? null, VisitRate: row.VisitRate ?? null, Status: row.Status ?? null };
}
export function createRateRequest(facts: Facts): string {
  const caregiver = identifier(facts.CaregiverID), discipline = identifier(facts.Discipline), payCode = identifier(facts.PayCodeID), from = date(facts.FromDate), to = date(facts.ToDate);
  if (from > to || !["Active", "Inactive"].includes(facts.Status || "")) throw new WorkflowError("invalid_rate_period_or_status");
  const patient = facts.PatientID === null ? '<PatientID xsi:nil="true"/>' : `<PatientID>${identifier(facts.PatientID)}</PatientID>`;
  const visit = facts.VisitRate === null ? '<VisitRate xsi:nil="true"/>' : `<VisitRate>${rateDecimal(facts.VisitRate)}</VisitRate>`;
  return `<CaregiverRateInfo><CaregiverID>${caregiver}</CaregiverID><Discipline>${discipline}</Discipline><PayCodeID>${payCode}</PayCodeID>${patient}<FromDate>${from}T00:00:00</FromDate><ToDate>${to}T00:00:00</ToDate><HourlyRate>${rateDecimal(facts.HourlyRate)}</HourlyRate><DailyRate>${rateDecimal(facts.DailyRate)}</DailyRate>${visit}<Status>${facts.Status}</Status></CaregiverRateInfo>`;
}
export async function submitRateCreation(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<RateCreationSubmission> {
  const response = await client.call("AddCaregiverRate", createRateRequest(facts), 1);
  if (!response.ok || !response.resultXml || extractElementText(response.resultXml, "CaregiverID") !== facts.CaregiverID) return { result: "unknown" };
  const recordId = extractElementText(response.resultXml, "CaregiverRateID");
  try { identifier(recordId); return { result: "acknowledged", recordId: recordId! }; } catch { return { result: "unknown" }; }
}
export class RateCreationWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<RateCreationSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentRateCreation(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<RateCreation>("rateCreations", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    if (Object.keys(input).some(key => !["id", "caregiverId", "disciplineId", "payCodeId", "patientId", "fromDate", "toDate", "hourlyRate", "dailyRate", "visitRate", "status", "rationale"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_rate_creation_proposal");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const proposed: Facts = { Exists: "true", CaregiverID: input.caregiverId as string, Discipline: input.disciplineId as string, PayCodeID: input.payCodeId as string, PatientID: input.patientId === "" || input.patientId === null ? null : input.patientId as string, FromDate: input.fromDate as string, ToDate: input.toDate as string, HourlyRate: input.hourlyRate as string, DailyRate: input.dailyRate as string, VisitRate: input.visitRate === "" || input.visitRate === null ? null : input.visitRate as string, Status: input.status as string };
    createRateRequest(proposed);
    const before = await this.current(proposed, officeId);
    if (before.Exists !== "false") throw new WorkflowError("overlapping_rate_requires_separate_policy_review", 409);
    proposed.DisciplineName = before.DisciplineName!;
    return this.repository.change<RateCreation>("rateCreations", id, 0, actor, "rate_creation_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "AddCaregiverRate", officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: RateCreation["sourceCheck"] = "unavailable";
    try { sourceCheck = sameCreatedRateFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<RateCreation>("rateCreations", prior.id, prior.revision, actor, "rate_creation_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<RateCreation>("rateCreations", prior.id, prior.revision, actor, "rate_creation_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("rate_creation_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = rateCreationTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameCreatedRateFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    createRateRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<RateCreation>("rateCreations", prior.id, prior.revision, actor, "rate_creation_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: RateCreationSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<RateCreation>("rateCreations", prior.id, attempt.revision, actor, "rate_creation_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<RateCreation["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = sameCreatedRateFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.CaregiverRateID === prior.execution.vendorRecordId) ? "matches_proposal" : sameCreatedRateFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<RateCreation>("rateCreations", prior.id, prior.revision, actor, "rate_creation_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(rateCreationTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
