import { replacementFile } from "./documentReplacements.js";
import { currentDocumentMetadata } from "./documentMetadata.js";
import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface DocumentCreationChange extends Versioned {
  operation: DocumentCreationOperation; userRole: "Patient" | "Caregiver"; subjectId: string; referenceDocumentId: string; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_document_creation_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export const DOCUMENT_CREATION_WRITES = ["AddPatientDocument", "AddCaregiverDocument"] as const;
export type DocumentCreationOperation = typeof DOCUMENT_CREATION_WRITES[number];
export const documentCreationTarget = (role: string, subjectId: string) => `document_subject_${role}_${identifier(subjectId)}`;
function role(value: unknown): "Patient" | "Caregiver" { if (value !== "Patient" && value !== "Caregiver") throw new WorkflowError("invalid_document_subject_role"); return value; }
export function sameCreatedDocument(left: Facts, right: Facts) {
  const comparable = (facts: Facts) => Object.fromEntries(Object.entries(facts).filter(([key]) => key !== "DocumentID"));
  return sameSourceFacts(comparable(left), comparable(right));
}
export async function currentDocumentCreation(read: (input: ReadInput) => Promise<OperationalRead>, facts: Facts, officeId: string): Promise<Facts> {
  const userRole = role(facts.UserRole), patient = userRole === "Patient", subjectId = identifier(facts.SubjectID), referenceDocumentId = identifier(facts.ReferenceDocumentID);
  const subject = await read({ operation: patient ? "GetPatientDemographics" : "GetCaregiverDemographics", id: subjectId });
  let offices: unknown; try { offices = JSON.parse(subject.records[0]?.OfficeIDs || ""); } catch {}
  if (subject.truncated || subject.records.length !== 1 || (patient ? subject.records[0]?.PatientID !== subjectId || subject.records[0]?.OfficeID !== officeId : subject.records[0]?.ID !== subjectId || !Array.isArray(offices) || offices.length !== 1 || offices[0] !== officeId)) throw new WorkflowError("document_subject_office_mismatch", 409);
  const records = await read({ operation: patient ? "SearchPatientDocument" : "SearchCaregiverDocument", ...(patient ? { patientId: subjectId } : { caregiverId: subjectId }) });
  if (records.truncated || records.records.some(row => row[userRole + "ID"] !== subjectId || !row[userRole + "DocID"] || typeof row.FileName !== "string")) throw new WorkflowError("complete_document_inventory_required", 409);
  const reference = records.records.filter(row => row[userRole + "DocID"] === referenceDocumentId);
  if (reference.length !== 1) throw new WorkflowError("existing_document_type_reference_required", 409);
  const typeId = identifier(reference[0]![userRole + "DocumentTypeID"]);
  const types = await read({ operation: patient ? "GetPatientDocumentType" : "GetCaregiverDocumentType", id: referenceDocumentId, status: "All" });
  const definitions = types.records.filter(row => row[userRole + "DocumentTypeID"] === typeId);
  if (types.truncated || definitions.length !== 1 || definitions[0]!.Status !== "Active") throw new WorkflowError("active_document_type_required", 409);
  const common = { DefinitionStatus: "Active", UserRole: userRole, SubjectID: subjectId, ReferenceDocumentID: referenceDocumentId, DocumentTypeID: typeId };
  const matches = records.records.filter(row => row.FileName?.toLocaleLowerCase("en-US") === facts.FileName?.toLocaleLowerCase("en-US"));
  if (!matches.length) return { ...common, Exists: "false" };
  if (matches.length !== 1) throw new WorkflowError("duplicate_document_filename", 409);
  const snapshot = await currentDocumentMetadata(read, userRole, subjectId, identifier(matches[0]![userRole + "DocID"]), officeId);
  return { ...snapshot.facts, DefinitionStatus: "Active", ReferenceDocumentID: referenceDocumentId, Exists: "true" };
}
function verifyFile(facts: Facts, encoded: unknown) {
  const actual = replacementFile(facts.FileName, encoded);
  if (actual.FileBytes !== facts.FileBytes || actual.FileSHA256 !== facts.FileSHA256) throw new WorkflowError("reviewed_replacement_file_required", 409);
}
export function documentCreationRequest(facts: Facts, base64: string): string {
  const userRole = role(facts.UserRole), subjectId = identifier(facts.SubjectID), typeId = identifier(facts.DocumentTypeID);
  if (typeof facts.Description !== "string" || !facts.Description.trim() || facts.Description.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(facts.Description)) throw new WorkflowError("invalid_document_description");
  verifyFile(facts, base64);
  return `<${userRole}DocumentInfo><${userRole}ID>${subjectId}</${userRole}ID><${userRole}DocumentTypeID>${typeId}</${userRole}DocumentTypeID><Description>${escaped(facts.Description!)}</Description><FileName>${escaped(facts.FileName!)}</FileName><StreamData>${base64}</StreamData></${userRole}DocumentInfo>`;
}
export async function submitDocumentCreation(client: Pick<HhaSoapClient, "call">, facts: Facts, base64: string): Promise<DocumentCreationSubmission> {
  const userRole = role(facts.UserRole), response = await client.call(userRole === "Patient" ? "AddPatientDocument" : "AddCaregiverDocument", documentCreationRequest(facts, base64), 1);
  if (!response.ok || !response.resultXml || extractElementText(response.resultXml, userRole + "ID") !== facts.SubjectID) return { result: "unknown" };
  const recordId = extractElementText(response.resultXml, userRole + "DocID");
  try { identifier(recordId); return { result: "acknowledged", recordId: recordId! }; } catch { return { result: "unknown" }; }
}
export interface DocumentCreationSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
export class DocumentCreationWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { enabled: readonly DocumentCreationOperation[]; submit: (facts: Facts, base64: string) => Promise<DocumentCreationSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentDocumentCreation(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision", "base64"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<DocumentCreationChange>("documentCreationChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id), subjectId = identifier(input.subjectId), referenceDocumentId = identifier(input.referenceDocumentId);
    if (Object.keys(input).some(key => !["id", "userRole", "subjectId", "referenceDocumentId", "filename", "base64", "description", "rationale"].includes(key)) || !["Patient", "Caregiver"].includes(String(input.userRole)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_document_creation_proposal");
    const userRole = input.userRole as "Patient" | "Caregiver";
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const candidate: Facts = { UserRole: userRole, SubjectID: subjectId, ReferenceDocumentID: referenceDocumentId, ...replacementFile(input.filename, input.base64) };
    const before = await this.current(candidate, officeId);
    if (before.Exists !== "false") throw new WorkflowError("document_filename_already_exists", 409);
    const proposed = { ...before, ...candidate, Exists: "true", Description: input.description as string };
    documentCreationRequest(proposed, input.base64 as string);
    return this.repository.change<DocumentCreationChange>("documentCreationChanges", id, 0, actor, "document_creation_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: userRole === "Patient" ? "AddPatientDocument" : "AddCaregiverDocument", userRole, subjectId, referenceDocumentId, officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: DocumentCreationChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameCreatedDocument(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<DocumentCreationChange>("documentCreationChanges", prior.id, prior.revision, actor, "document_creation_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved") verifyFile(prior.proposed, input.base64);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<DocumentCreationChange>("documentCreationChanges", prior.id, prior.revision, actor, "document_creation_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { input, prior } = await this.prior(value);
    if (!this.write?.enabled.includes(prior.operation)) throw new WorkflowError("document_creation_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    verifyFile(prior.proposed, input.base64);
    const target = documentCreationTarget(prior.userRole, prior.subjectId);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    const snapshot = await this.current(prior.proposed, prior.officeId);
    if (!sameCreatedDocument(snapshot, prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    documentCreationRequest(prior.proposed, input.base64 as string); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<DocumentCreationChange>("documentCreationChanges", prior.id, prior.revision, actor, "document_creation_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: DocumentCreationSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed, input.base64 as string); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<DocumentCreationChange>("documentCreationChanges", prior.id, attempt.revision, actor, "document_creation_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<DocumentCreationChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = sameCreatedDocument(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.DocumentID === prior.execution.vendorRecordId) ? "matches_proposal" : sameCreatedDocument(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<DocumentCreationChange>("documentCreationChanges", prior.id, prior.revision, actor, "document_creation_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(documentCreationTarget(prior.userRole, prior.subjectId), prior.id);
    return reconciled;
  }
}
