import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface PatientClinicalChange extends Versioned {
  operation: "UpdatePatientClinicalInfo"; patientId: string; officeId: string; authorityReference: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_patient_clinical_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function clinicalText(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new WorkflowError("complete_clinical_text_required", 409);
  return value;
}
export function patientClinicalRequest(facts: Facts): string {
  identifier(facts.PatientID); clinicalText(facts.Comments); clinicalText(facts.Allergies);
  if (!["Yes", "No"].includes(facts.MDOrderRequired || "")) throw new WorkflowError("clinical_order_flag_mapping_required", 409);
  for (const key of ["NursingVisitsDue", "MDOrderDue", "MDVisitDue"]) if (!/^(0|[1-9]\d*)$/.test(facts[key] || "") || Number(facts[key]) > 2147483647) throw new WorkflowError("complete_clinical_due_days_required", 409);
  // Enterprise v3.30 pp46-47: preserve every non-comment clinical field.
  return `<PatientClinicalInfo><PatientID>${facts.PatientID}</PatientID><Comments>${escaped(facts.Comments!)}</Comments><Allergies>${escaped(facts.Allergies!)}</Allergies><NursingVisitsDue>${facts.NursingVisitsDue}</NursingVisitsDue><MDOrderRequired>${facts.MDOrderRequired}</MDOrderRequired><MDOrderDue>${facts.MDOrderDue}</MDOrderDue><MDVisitDue>${facts.MDVisitDue}</MDVisitDue></PatientClinicalInfo>`;
}
export async function currentPatientClinical(read: (input: ReadInput) => Promise<OperationalRead>, patientId: string, officeId: string): Promise<Facts> {
  const patient = await read({ operation: "GetPatientDemographics", id: patientId });
  if (patient.truncated || patient.records.length !== 1 || patient.records[0]?.PatientID !== patientId || patient.records[0]?.OfficeID !== officeId) throw new WorkflowError("clinical_patient_office_mismatch", 409);
  const source = await read({ operation: "GetPatientClinicalInfo", patientId });
  if (source.truncated || source.records.length !== 1 || source.records[0]?.PatientID !== patientId) throw new WorkflowError("patient_clinical_not_uniquely_returned", 409);
  const row = source.records[0]!, facts: Facts = {};
  for (const key of ["PatientID", "Comments", "Allergies", "NursingVisitsDue", "MDOrderRequired", "MDOrderDue", "MDVisitDue"]) facts[key] = row[key] ?? null;
  patientClinicalRequest(facts); return facts;
}
export async function submitPatientClinical(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<"acknowledged" | "unknown" | "not_submitted"> {
  const response = await client.call("UpdatePatientClinicalInfo", patientClinicalRequest(facts), 1);
  return response.ok && response.resultXml && extractElementText(response.resultXml, "PatientID") === facts.PatientID ? "acknowledged" : "unknown";
}
export class PatientClinicalWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private clock = () => performance.now()) {}
  private async current(patientId: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentPatientClinical(this.read, patientId, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<PatientClinicalChange>("patientClinicalChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id), patientId = identifier(input.patientId);
    if (Object.keys(input).some(key => !["id", "patientId", "comments", "rationale", "authorityReference"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_patient_clinical_proposal");
    if (typeof input.authorityReference !== "string" || input.authorityReference.trim().length < 8 || input.authorityReference.length > 500 || /[\r\n]/.test(input.authorityReference)) throw new WorkflowError("clinical_authority_reference_required");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const before = await this.current(patientId, officeId);
    const proposed = { ...before, Comments: clinicalText(input.comments) };
    patientClinicalRequest(proposed); if (sameSourceFacts(before, proposed)) throw new WorkflowError("proposal_has_no_change");
    return this.repository.change<PatientClinicalChange>("patientClinicalChanges", id, 0, actor, "patient_clinical_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "UpdatePatientClinicalInfo", patientId, officeId, authorityReference: input.authorityReference as string, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: PatientClinicalChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameSourceFacts(await this.current(prior.patientId, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<PatientClinicalChange>("patientClinicalChanges", prior.id, prior.revision, actor, "patient_clinical_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<PatientClinicalChange>("patientClinicalChanges", prior.id, prior.revision, actor, "patient_clinical_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("patient_clinical_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = `patient_clinical_${prior.patientId}`;
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameSourceFacts(await this.current(prior.patientId, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    patientClinicalRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<PatientClinicalChange>("patientClinicalChanges", prior.id, prior.revision, actor, "patient_clinical_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<PatientClinicalChange>("patientClinicalChanges", prior.id, attempt.revision, actor, "patient_clinical_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<PatientClinicalChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.patientId, prior.officeId); reconciliation = sameSourceFacts(current, prior.proposed) ? "matches_proposal" : sameSourceFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<PatientClinicalChange>("patientClinicalChanges", prior.id, prior.revision, actor, "patient_clinical_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(`patient_clinical_${prior.patientId}`, prior.id);
    return reconciled;
  }
}
