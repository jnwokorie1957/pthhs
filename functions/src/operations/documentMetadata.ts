import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID, createHash } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface DocumentMetadataChange extends Versioned {
  operation: DocumentMetadataOperation; userRole: "Patient" | "Caregiver"; subjectId: string; documentId: string; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_document_metadata_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export const DOCUMENT_METADATA_WRITES = ["UpdatePatientDocument", "UpdateCaregiverDocument"] as const;
export type DocumentMetadataOperation = typeof DOCUMENT_METADATA_WRITES[number];
export const documentMetadataTarget = (role: string, documentId: string) => `document_subject_${role}_${identifier(documentId)}`;
function role(value: unknown): "Patient" | "Caregiver" { if (value !== "Patient" && value !== "Caregiver") throw new WorkflowError("invalid_document_subject_role"); return value; }
export async function currentDocumentMetadata(read: (input: ReadInput) => Promise<OperationalRead>, userRole: "Patient" | "Caregiver", subjectId: string, documentId: string, officeId: string): Promise<{ facts: Facts; base64: string }> {
  const patient = userRole === "Patient";
  const results = await Promise.allSettled([read({ operation: patient ? "GetPatientDemographics" : "GetCaregiverDemographics", id: subjectId }), read({ operation: patient ? "SearchPatientDocument" : "SearchCaregiverDocument", ...(patient ? { patientId: subjectId } : { caregiverId: subjectId }), id: documentId })]);
  const failed = results.find(row => row.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
  const [subjects, documents] = results.map(row => (row as PromiseFulfilledResult<OperationalRead>).value);
  const subject = subjects!.records[0];
  let offices: unknown; try { offices = JSON.parse(subject?.OfficeIDs || ""); } catch { /* checked below */ }
  if (subjects!.truncated || subjects!.records.length !== 1 || (patient ? subject?.PatientID !== subjectId || subject.OfficeID !== officeId : subject?.ID !== subjectId || !Array.isArray(offices) || !offices.includes(officeId))) throw new WorkflowError("document_subject_office_mismatch", 409);
  const rows = documents!.records.filter(row => row[userRole + "ID"] === subjectId && row[userRole + "DocID"] === documentId);
  if (documents!.truncated || rows.length !== 1) throw new WorkflowError("document_not_uniquely_returned", 409);
  const row = rows[0]!; identifier(row[userRole + "DocumentTypeID"]);
  if (typeof row.Description !== "string" || typeof row.FileName !== "string") throw new WorkflowError("complete_document_metadata_required", 409);
  // Resolve subject ownership before requesting any attachment bytes.
  const download = await read({ operation: patient ? "DownloadPatientDocument" : "DownloadCaregiverDocument", id: documentId });
  const file = download.attachment;
  if (download.truncated || download.records.length !== 1 || download.records[0]?.[userRole + "DocID"] !== documentId || !file || file.filename !== row.FileName) throw new WorkflowError("exact_document_filename_and_content_required", 409);
  const bytes = Buffer.from(file.base64, "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.length !== file.byteLength || bytes.toString("base64") !== file.base64) throw new WorkflowError("invalid_document_snapshot", 409);
  return { facts: { UserRole: userRole, SubjectID: subjectId, DocumentID: documentId, DocumentTypeID: row[userRole + "DocumentTypeID"]!, Description: row.Description, FileName: row.FileName, FileBytes: String(bytes.length), FileSHA256: createHash("sha256").update(bytes).digest("hex") }, base64: file.base64 };
}
export function documentMetadataRequest(facts: Facts, base64: string): string {
  const userRole = role(facts.UserRole), subjectId = identifier(facts.SubjectID), documentId = identifier(facts.DocumentID), typeId = identifier(facts.DocumentTypeID);
  if (typeof facts.Description !== "string" || !facts.Description.trim() || facts.Description.length > 2000 || typeof facts.FileName !== "string" || !facts.FileName || facts.FileName.length > 100 || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(facts.FileName) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(facts.Description)) throw new WorkflowError("invalid_document_metadata");
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString("base64") !== base64 || String(bytes.length) !== facts.FileBytes || createHash("sha256").update(bytes).digest("hex") !== facts.FileSHA256) throw new WorkflowError("attachment_changed_never_submit", 409);
  return `<${userRole}DocumentInfo><${userRole}ID>${subjectId}</${userRole}ID><${userRole}DocID>${documentId}</${userRole}DocID><${userRole}DocumentTypeID>${typeId}</${userRole}DocumentTypeID><Description>${escaped(facts.Description)}</Description><FileName>${escaped(facts.FileName)}</FileName><StreamData>${base64}</StreamData></${userRole}DocumentInfo>`;
}
export async function submitDocumentMetadata(client: Pick<HhaSoapClient, "call">, facts: Facts, base64: string): Promise<"acknowledged" | "unknown" | "not_submitted"> {
  const userRole = role(facts.UserRole), response = await client.call(userRole === "Patient" ? "UpdatePatientDocument" : "UpdateCaregiverDocument", documentMetadataRequest(facts, base64), 1);
  return response.ok && response.resultXml && extractElementText(response.resultXml, userRole + "ID") === facts.SubjectID && extractElementText(response.resultXml, userRole + "DocID") === facts.DocumentID ? "acknowledged" : "unknown";
}
export class DocumentMetadataWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { enabled: readonly DocumentMetadataOperation[]; submit: (facts: Facts, base64: string) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private clock = () => performance.now()) {}
  private async current(userRole: "Patient" | "Caregiver", subjectId: string, documentId: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentDocumentMetadata(this.read, userRole, subjectId, documentId, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<DocumentMetadataChange>("documentMetadataChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id), subjectId = identifier(input.subjectId), documentId = identifier(input.documentId);
    if (Object.keys(input).some(key => !["id", "userRole", "subjectId", "documentId", "description", "rationale"].includes(key)) || !["Patient", "Caregiver"].includes(String(input.userRole)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_document_metadata_proposal");
    const userRole = input.userRole as "Patient" | "Caregiver";
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const snapshot = await this.current(userRole, subjectId, documentId, officeId), before = snapshot.facts;
    const proposed = { ...before, Description: input.description as string };
    documentMetadataRequest(proposed, snapshot.base64); if (sameSourceFacts(before, proposed)) throw new WorkflowError("proposal_has_no_change");
    return this.repository.change<DocumentMetadataChange>("documentMetadataChanges", id, 0, actor, "document_metadata_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: userRole === "Patient" ? "UpdatePatientDocument" : "UpdateCaregiverDocument", userRole, subjectId, documentId, officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: DocumentMetadataChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameSourceFacts((await this.current(prior.userRole, prior.subjectId, prior.documentId, prior.officeId)).facts, prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<DocumentMetadataChange>("documentMetadataChanges", prior.id, prior.revision, actor, "document_metadata_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<DocumentMetadataChange>("documentMetadataChanges", prior.id, prior.revision, actor, "document_metadata_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.enabled.includes(prior.operation)) throw new WorkflowError("document_metadata_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = documentMetadataTarget(prior.userRole, prior.subjectId);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    const snapshot = await this.current(prior.userRole, prior.subjectId, prior.documentId, prior.officeId);
    if (!sameSourceFacts(snapshot.facts, prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    documentMetadataRequest(prior.proposed, snapshot.base64); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<DocumentMetadataChange>("documentMetadataChanges", prior.id, prior.revision, actor, "document_metadata_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.write.submit(prior.proposed, snapshot.base64); } catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<DocumentMetadataChange>("documentMetadataChanges", prior.id, attempt.revision, actor, "document_metadata_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<DocumentMetadataChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = (await this.current(prior.userRole, prior.subjectId, prior.documentId, prior.officeId)).facts; reconciliation = sameSourceFacts(current, prior.proposed) ? "matches_proposal" : sameSourceFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<DocumentMetadataChange>("documentMetadataChanges", prior.id, prior.revision, actor, "document_metadata_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(documentMetadataTarget(prior.userRole, prior.subjectId), prior.id);
    return reconciled;
  }
}
