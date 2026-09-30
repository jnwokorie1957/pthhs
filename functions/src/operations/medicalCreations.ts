import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface MedicalCreation extends Versioned {
  operation: "CreateCaregiverMedical"; officeId: string; authorityReference: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface MedicalCreationSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_medical_creation_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function date(value: unknown): string { if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new WorkflowError("medical_date_mapping_required", 409); return value; }
export const medicalCreationTarget = (facts: Facts) => `medical_create_${identifier(facts.CaregiverID)}_${identifier(facts.MedicalID)}`;
export function sameCreatedMedicalFacts(left: Facts, right: Facts) {
  const comparable = (facts: Facts) => Object.fromEntries(Object.entries(facts).filter(([key]) => key !== "CaregiverMedicalID"));
  return sameSourceFacts(comparable(left), comparable(right));
}
export async function currentMedicalCreation(read: (input: ReadInput) => Promise<OperationalRead>, facts: Facts, officeId: string): Promise<Facts> {
  const caregiver = await read({ operation: "GetCaregiverDemographics", id: identifier(facts.CaregiverID) });
  let offices: unknown; try { offices = JSON.parse(caregiver.records[0]?.OfficeIDs || ""); } catch {}
  if (caregiver.truncated || caregiver.records.length !== 1 || caregiver.records[0]?.ID !== facts.CaregiverID || !Array.isArray(offices) || offices.length !== 1 || offices[0] !== officeId) throw new WorkflowError("medical_caregiver_single_office_required", 409);
  const results = await Promise.allSettled([read({ operation: "GetCaregiverMedicals", officeId }), read({ operation: "GetCaregiverMedicalDetails", caregiverId: facts.CaregiverID!, status: "All" })]);
  const failed = results.find(row => row.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
  const [catalog, records] = results.map(row => (row as PromiseFulfilledResult<OperationalRead>).value);
  const codes = catalog!.records.filter(row => row.MedicalID === facts.MedicalID && row.OfficeID === officeId);
  if (catalog!.truncated || records!.truncated || codes.length !== 1 || !codes[0]!.MedicalName) throw new WorkflowError("complete_medical_source_required", 409);
  if (codes[0]!.Active !== "Y") throw new WorkflowError("active_medical_definition_required", 409);
  const definition = codes[0]!, definitionFacts = { MedicalName: definition.MedicalName!, DefinitionActive: definition.Active ?? null, DefinitionRequire: definition.Require ?? null };
  const matches = records!.records.filter(row => {
    identifier(row.CaregiverMedicalID); identifier(row.MedicalID);
    if (row.CaregiverID !== facts.CaregiverID || row.OfficeID !== officeId) throw new WorkflowError("medical_source_subject_office_mismatch", 409);
    // Any existing record for this medical type requires the separate renewal workflow.
    return row.MedicalID === facts.MedicalID;
  });
  if (!matches.length) return { Exists: "false", ...definitionFacts };
  if (matches.length !== 1) throw new WorkflowError("medical_records_not_unique", 409);
  const row = matches[0]!;
  if (!["Pending", "Overdue"].includes(row.Status || "")) throw new WorkflowError("medical_due_state_not_confirmed", 409);
  return { Exists: "true", ...definitionFacts, CaregiverMedicalID: row.CaregiverMedicalID!, CaregiverID: facts.CaregiverID!, MedicalID: facts.MedicalID!, DueDate: date(row.DueDate), DateCompleted: row.DatePerformed || null, Result: row.Result || null, Notes: row.Notes ?? "", DocumentName: row.DocumentName || null };
}
export function createMedicalRequest(facts: Facts): string {
  const caregiver = identifier(facts.CaregiverID), medical = identifier(facts.MedicalID), due = date(facts.DueDate);
  if (facts.DateCompleted !== null || facts.Result !== null || facts.Notes !== "" || facts.DocumentName !== null) throw new WorkflowError("medical_due_only_scope_required");
  // This creates a due item only; no result, performed date or attachment is asserted.
  return `<CaregiverMedicalInfo><CaregiverID>${caregiver}</CaregiverID><MedicalID>${medical}</MedicalID><DueDate>${due}T00:00:00</DueDate><DateCompleted xsi:nil="true"/><Notes></Notes><ResultID xsi:nil="true"/></CaregiverMedicalInfo>`;
}
export async function submitMedicalCreation(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<MedicalCreationSubmission> {
  const response = await client.call("CreateCaregiverMedical", createMedicalRequest(facts), 1);
  if (!response.ok || !response.resultXml || extractElementText(response.resultXml, "CaregiverID") !== facts.CaregiverID) return { result: "unknown" };
  const recordId = extractElementText(response.resultXml, "CaregiverMedicalID");
  try { identifier(recordId); return { result: "acknowledged", recordId: recordId! }; } catch { return { result: "unknown" }; }
}
export class MedicalCreationWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<MedicalCreationSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentMedicalCreation(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<MedicalCreation>("medicalCreations", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    if (Object.keys(input).some(key => !["id", "caregiverId", "medicalId", "dueDate", "authorityReference", "rationale"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_medical_creation_proposal");
    if (typeof input.authorityReference !== "string" || input.authorityReference.trim().length < 8 || input.authorityReference.length > 500 || /[\r\n]/.test(input.authorityReference)) throw new WorkflowError("medical_authority_reference_required");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const proposed: Facts = { Exists: "true", CaregiverID: input.caregiverId as string, MedicalID: input.medicalId as string, DueDate: input.dueDate as string, DateCompleted: null, Result: null, Notes: "", DocumentName: null };
    createMedicalRequest(proposed);
    const before = await this.current(proposed, officeId);
    if (before.Exists !== "false") throw new WorkflowError("existing_medical_requires_renewal_review", 409);
    proposed.MedicalName = before.MedicalName!; proposed.DefinitionActive = before.DefinitionActive!; proposed.DefinitionRequire = before.DefinitionRequire!;
    return this.repository.change<MedicalCreation>("medicalCreations", id, 0, actor, "medical_creation_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "CreateCaregiverMedical", officeId, authorityReference: input.authorityReference as string, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: MedicalCreation["sourceCheck"] = "unavailable";
    try { sourceCheck = sameCreatedMedicalFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<MedicalCreation>("medicalCreations", prior.id, prior.revision, actor, "medical_creation_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<MedicalCreation>("medicalCreations", prior.id, prior.revision, actor, "medical_creation_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("medical_creation_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = medicalCreationTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameCreatedMedicalFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    createMedicalRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<MedicalCreation>("medicalCreations", prior.id, prior.revision, actor, "medical_creation_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: MedicalCreationSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<MedicalCreation>("medicalCreations", prior.id, attempt.revision, actor, "medical_creation_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<MedicalCreation["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = sameCreatedMedicalFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.CaregiverMedicalID === prior.execution.vendorRecordId) ? "matches_proposal" : sameCreatedMedicalFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<MedicalCreation>("medicalCreations", prior.id, prior.revision, actor, "medical_creation_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(medicalCreationTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
