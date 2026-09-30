import { currentDocumentMetadata, documentMetadataTarget } from "./documentMetadata.js";
import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID, createHash } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface DocumentReplacementChange extends Versioned {
  operation: DocumentReplacementOperation; userRole: "Patient" | "Caregiver"; subjectId: string; documentId: string; officeId: string;
  before: Facts; proposed: Facts; retainedOriginalReference: string; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_document_replacement_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export const DOCUMENT_REPLACEMENT_WRITES = ["ChangePatientDocument", "ChangeCaregiverDocument"] as const;
export type DocumentReplacementOperation = typeof DOCUMENT_REPLACEMENT_WRITES[number];
export const documentReplacementTarget = documentMetadataTarget;
function role(value: unknown): "Patient" | "Caregiver" { if (value !== "Patient" && value !== "Caregiver") throw new WorkflowError("invalid_document_subject_role"); return value; }
export const currentDocumentReplacement = currentDocumentMetadata;
export function replacementFile(filename: unknown, encoded: unknown): Facts {
  if (typeof filename !== "string" || !filename || filename.length > 100 || filename !== filename.trim() || /^[.]/.test(filename) || /[. ]$/.test(filename) || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(filename)) throw new WorkflowError("invalid_replacement_filename");
  if (typeof encoded !== "string" || encoded.length > 2796204) throw new WorkflowError("invalid_replacement_file");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString("base64") !== encoded) throw new WorkflowError("invalid_replacement_file");
  return { FileName: filename, FileBytes: String(bytes.length), FileSHA256: createHash("sha256").update(bytes).digest("hex") };
}
function verifyFile(facts: Facts, encoded: unknown) {
  const actual = replacementFile(facts.FileName, encoded);
  if (actual.FileBytes !== facts.FileBytes || actual.FileSHA256 !== facts.FileSHA256) throw new WorkflowError("reviewed_replacement_file_required", 409);
}
export function documentReplacementRequest(facts: Facts, base64: string): string {
  const userRole = role(facts.UserRole), subjectId = identifier(facts.SubjectID), documentId = identifier(facts.DocumentID);
  verifyFile(facts, base64);
  return `<${userRole}DocumentInfo><${userRole}ID>${subjectId}</${userRole}ID><${userRole}DocID>${documentId}</${userRole}DocID><FileName>${escaped(facts.FileName!)}</FileName><StreamData>${base64}</StreamData></${userRole}DocumentInfo>`;
}
export async function submitDocumentReplacement(client: Pick<HhaSoapClient, "call">, facts: Facts, base64: string): Promise<"acknowledged" | "unknown" | "not_submitted"> {
  const userRole = role(facts.UserRole), response = await client.call(userRole === "Patient" ? "ChangePatientDocument" : "ChangeCaregiverDocument", documentReplacementRequest(facts, base64), 1);
  return response.ok && response.resultXml && extractElementText(response.resultXml, userRole + "ID") === facts.SubjectID && extractElementText(response.resultXml, userRole + "DocID") === facts.DocumentID ? "acknowledged" : "unknown";
}
export class DocumentReplacementWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { enabled: readonly DocumentReplacementOperation[]; submit: (facts: Facts, base64: string) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private clock = () => performance.now()) {}
  private async current(userRole: "Patient" | "Caregiver", subjectId: string, documentId: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentDocumentReplacement(this.read, userRole, subjectId, documentId, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision", "base64"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<DocumentReplacementChange>("documentReplacementChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id), subjectId = identifier(input.subjectId), documentId = identifier(input.documentId);
    if (Object.keys(input).some(key => !["id", "userRole", "subjectId", "documentId", "filename", "base64", "retainedOriginalReference", "rationale"].includes(key)) || !["Patient", "Caregiver"].includes(String(input.userRole)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_document_replacement_proposal");
    if (typeof input.retainedOriginalReference !== "string" || input.retainedOriginalReference.trim().length < 8 || input.retainedOriginalReference.length > 500 || /[\r\n]/.test(input.retainedOriginalReference)) throw new WorkflowError("retained_original_reference_required");
    const userRole = input.userRole as "Patient" | "Caregiver";
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const snapshot = await this.current(userRole, subjectId, documentId, officeId), before = snapshot.facts;
    const proposed = { ...before, ...replacementFile(input.filename, input.base64) };
    documentReplacementRequest(proposed, input.base64 as string); if (sameSourceFacts(before, proposed)) throw new WorkflowError("proposal_has_no_change");
    return this.repository.change<DocumentReplacementChange>("documentReplacementChanges", id, 0, actor, "document_replacement_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: userRole === "Patient" ? "ChangePatientDocument" : "ChangeCaregiverDocument", userRole, subjectId, documentId, officeId, before, proposed, retainedOriginalReference: input.retainedOriginalReference as string, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: DocumentReplacementChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameSourceFacts((await this.current(prior.userRole, prior.subjectId, prior.documentId, prior.officeId)).facts, prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<DocumentReplacementChange>("documentReplacementChanges", prior.id, prior.revision, actor, "document_replacement_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved") verifyFile(prior.proposed, input.base64);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<DocumentReplacementChange>("documentReplacementChanges", prior.id, prior.revision, actor, "document_replacement_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { input, prior } = await this.prior(value);
    if (!this.write?.enabled.includes(prior.operation)) throw new WorkflowError("document_replacement_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    verifyFile(prior.proposed, input.base64);
    const target = documentReplacementTarget(prior.userRole, prior.subjectId);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    const snapshot = await this.current(prior.userRole, prior.subjectId, prior.documentId, prior.officeId);
    if (!sameSourceFacts(snapshot.facts, prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    documentReplacementRequest(prior.proposed, input.base64 as string); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<DocumentReplacementChange>("documentReplacementChanges", prior.id, prior.revision, actor, "document_replacement_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.write.submit(prior.proposed, input.base64 as string); } catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<DocumentReplacementChange>("documentReplacementChanges", prior.id, attempt.revision, actor, "document_replacement_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<DocumentReplacementChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = (await this.current(prior.userRole, prior.subjectId, prior.documentId, prior.officeId)).facts; reconciliation = sameSourceFacts(current, prior.proposed) ? "matches_proposal" : sameSourceFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<DocumentReplacementChange>("documentReplacementChanges", prior.id, prior.revision, actor, "document_replacement_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(documentReplacementTarget(prior.userRole, prior.subjectId), prior.id);
    return reconciled;
  }
}
