import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface DocumentTypeChange extends Versioned {
  operation: "UpdateDocumentType"; userRole: "Patient" | "Caregiver"; documentId: string; recordId: string; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_document_type_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export function documentTypeRequest(facts: Facts): string {
  if (!["Patient", "Caregiver"].includes(facts.UserRole || "") || !["Active", "Inactive"].includes(facts.Status || "") || typeof facts.DocumentType !== "string" || !facts.DocumentType.trim() || facts.DocumentType.length > 200 || typeof facts.Description !== "string" || facts.Description.length > 5000) throw new WorkflowError("complete_document_type_source_required", 409);
  identifier(facts.DocumentTypeID);
  if ([facts.DocumentType, facts.Description].some(value => /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))) throw new WorkflowError("invalid_xml_text");
  // Preserve the exact source description; this UI never edits clinical content.
  // Missing source descriptions are not silently converted to empty strings.
  return '<DocumentTypeInfo>' + ["UserRole", "DocumentTypeID", "DocumentType", "Description", "Status"].map(key => `<${key}>${escaped(facts[key]!)}</${key}>`).join("") + '</DocumentTypeInfo>';
}
export async function submitDocumentType(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<"acknowledged" | "unknown" | "not_submitted"> {
  const response = await client.call("UpdateDocumentType", documentTypeRequest(facts), 1);
  return response.ok && response.resultXml && extractElementText(response.resultXml, "DocumentTypeID") === facts.DocumentTypeID ? "acknowledged" : "unknown";
}
export class DocumentTypeWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private clock = () => performance.now()) {}
  private async current(userRole: "Patient" | "Caregiver", documentId: string, recordId: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    const source = await this.read({ operation: userRole === "Patient" ? "GetPatientDocumentType" : "GetCaregiverDocumentType", id: documentId, status: "All" });
    const matches = source.records.filter(row => row[userRole + "DocumentTypeID"] === recordId);
    if (source.truncated || matches.length !== 1) throw new WorkflowError("document_type_not_uniquely_returned", 409);
    const row = matches[0]!;
    return { UserRole: userRole, DocumentTypeID: recordId, DocumentType: row[userRole + "DocumentType"] ?? null, Description: row.Description ?? null, Status: row.Status ?? null };
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<DocumentTypeChange>("documentTypeChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id), documentId = identifier(input.documentId), recordId = identifier(input.recordId);
    if (Object.keys(input).some(key => !["id", "userRole", "documentId", "recordId", "name", "status", "rationale"].includes(key)) || !["Patient", "Caregiver"].includes(String(input.userRole)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_document_type_proposal");
    const userRole = input.userRole as "Patient" | "Caregiver";
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const before = await this.current(userRole, documentId, recordId, officeId); documentTypeRequest(before);
    const proposed = { ...before, DocumentType: input.name as string, Status: input.status as string };
    documentTypeRequest(proposed); if (sameSourceFacts(before, proposed)) throw new WorkflowError("proposal_has_no_change");
    return this.repository.change<DocumentTypeChange>("documentTypeChanges", id, 0, actor, "document_type_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "UpdateDocumentType", userRole, documentId, recordId, officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: DocumentTypeChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameSourceFacts(await this.current(prior.userRole, prior.documentId, prior.recordId, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<DocumentTypeChange>("documentTypeChanges", prior.id, prior.revision, actor, "document_type_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<DocumentTypeChange>("documentTypeChanges", prior.id, prior.revision, actor, "document_type_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("document_type_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = `document_type_${prior.userRole}_${prior.recordId}`;
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameSourceFacts(await this.current(prior.userRole, prior.documentId, prior.recordId, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    documentTypeRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<DocumentTypeChange>("documentTypeChanges", prior.id, prior.revision, actor, "document_type_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<DocumentTypeChange>("documentTypeChanges", prior.id, attempt.revision, actor, "document_type_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<DocumentTypeChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.userRole, prior.documentId, prior.recordId, prior.officeId); reconciliation = sameSourceFacts(current, prior.proposed) ? "matches_proposal" : sameSourceFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<DocumentTypeChange>("documentTypeChanges", prior.id, prior.revision, actor, "document_type_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(`document_type_${prior.userRole}_${prior.recordId}`, prior.id);
    return reconciled;
  }
}
