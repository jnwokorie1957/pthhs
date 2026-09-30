import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface PatientNoteChange extends Versioned {
  operation: "CreatePatientNote"; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface PatientNoteSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_patient_note_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
export const patientNoteTarget = (facts: Facts) => `patient_note_${identifier(facts.PatientID)}`;
export function samePatientNoteFacts(left: Facts, right: Facts) { const { NoteID: _a, ...a } = left, { NoteID: _b, ...b } = right; return sameSourceFacts(a, b); }
export async function currentPatientNote(read: (input: ReadInput) => Promise<OperationalRead>, facts: Facts, officeId: string): Promise<Facts> {
  const patientId = identifier(facts.PatientID), reasonId = identifier(facts.ReasonID);
  const results = await Promise.allSettled([read({ operation: "GetPatientDemographics", id: patientId }), read({ operation: "GetPatientNoteReasons", patientId, officeId }), read({ operation: "GetPatientNotes", patientId, modifiedAfterUtc: facts.SinceUTC!, lastId: "0" })]);
  const failed = results.find(row => row.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
  const [patients, reasons, notes] = results.map(row => (row as PromiseFulfilledResult<OperationalRead>).value);
  if (patients!.truncated || patients!.records.length !== 1 || patients!.records[0]?.PatientID !== patientId || patients!.records[0]?.OfficeID !== officeId) throw new WorkflowError("note_patient_office_mismatch", 409);
  if (reasons!.truncated || notes!.truncated) throw new WorkflowError("complete_note_review_window_required", 409);
  const reason = reasons!.records.filter(row => row.ID === reasonId && row.OfficeID === officeId);
  if (reason.length !== 1 || !reason[0]!.Name || /service|schedule/i.test(reason[0]!.Name!)) throw new WorkflowError("service_schedule_note_requires_separate_workflow", 409);
  const metadata = { ReasonName: reason[0]!.Name!, ReasonStatus: reason[0]!.Active ?? null };
  const matches = notes!.records.filter(row => {
    identifier(row.PatientNoteID);
    if (row.PatientID !== patientId || row.NoteTruncated) throw new WorkflowError("complete_note_subject_evidence_required", 409);
    return row["NoteReason/ID"] === reasonId && row.Note === facts.Note;
  });
  if (!matches.length) return { Exists: "false", ...metadata };
  if (matches.length !== 1) throw new WorkflowError("matching_note_not_unique", 409);
  const row = matches[0]!;
  return { Exists: "true", NoteID: row.PatientNoteID!, PatientID: patientId, ReasonID: reasonId, Note: row.Note!, Internal: row.Internal ?? null, EmergencyOfPriority: row.EmergencyOfPriority ?? null, NoteType: row.NoteType || null, FromDate: row.FromDate || null, ToDate: row.ToDate || null, SinceUTC: facts.SinceUTC!, ...metadata };
}
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export function patientNoteRequest(facts: Facts): string {
  identifier(facts.PatientID); identifier(facts.ReasonID);
  if (typeof facts.Note !== "string" || !facts.Note.trim() || facts.Note !== facts.Note.trim() || facts.Note.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(facts.Note) || facts.Internal !== "Y" || facts.EmergencyOfPriority !== "N" || facts.NoteType !== null || facts.FromDate !== null || facts.ToDate !== null) throw new WorkflowError("internal_operational_note_only");
  // v3.30 pp38-39: EmailTo sends notifications when specified. Never include it.
  return `<PatientNoteInfo><PatientID>${facts.PatientID}</PatientID><ReasonID>${facts.ReasonID}</ReasonID><FromDate xsi:nil="true"/><ToDate xsi:nil="true"/><EmergencyOfPriroity>N</EmergencyOfPriroity><Internal>Y</Internal><Note>${escaped(facts.Note)}</Note><CaregiverID xsi:nil="true"/><SubjectID xsi:nil="true"/></PatientNoteInfo>`;
}
export async function submitPatientNote(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<PatientNoteSubmission> {
  const response = await client.call("CreatePatientNote", patientNoteRequest(facts), 1);
  if (!response.ok || !response.resultXml || extractElementText(response.resultXml, "PatientID") !== facts.PatientID) return { result: "unknown" };
  const recordId = extractElementText(response.resultXml, "NoteID");
  try { identifier(recordId); return { result: "acknowledged", recordId: recordId! }; } catch { return { result: "unknown" }; }
}
export class PatientNoteWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<PatientNoteSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentPatientNote(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<PatientNoteChange>("patientNoteChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    if (Object.keys(input).some(key => !["id", "patientId", "reasonId", "note", "rationale"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_patient_note_proposal");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const proposed: Facts = { Exists: "true", PatientID: identifier(input.patientId), ReasonID: identifier(input.reasonId), Note: input.note as string, Internal: "Y", EmergencyOfPriority: "N", NoteType: null, FromDate: null, ToDate: null, SinceUTC: new Date(Date.now() - 86400000).toISOString() };
    patientNoteRequest(proposed);
    const before = await this.current(proposed, officeId);
    if (before.Exists !== "false") throw new WorkflowError("matching_note_already_in_review_window", 409);
    proposed.ReasonName = before.ReasonName!; proposed.ReasonStatus = before.ReasonStatus ?? null;
    return this.repository.change<PatientNoteChange>("patientNoteChanges", id, 0, actor, "patient_note_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "CreatePatientNote", officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: PatientNoteChange["sourceCheck"] = "unavailable";
    try { sourceCheck = samePatientNoteFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<PatientNoteChange>("patientNoteChanges", prior.id, prior.revision, actor, "patient_note_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<PatientNoteChange>("patientNoteChanges", prior.id, prior.revision, actor, "patient_note_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("patient_note_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = patientNoteTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!samePatientNoteFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    patientNoteRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<PatientNoteChange>("patientNoteChanges", prior.id, prior.revision, actor, "patient_note_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: PatientNoteSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<PatientNoteChange>("patientNoteChanges", prior.id, attempt.revision, actor, "patient_note_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<PatientNoteChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = samePatientNoteFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.NoteID === prior.execution.vendorRecordId) ? "matches_proposal" : samePatientNoteFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<PatientNoteChange>("patientNoteChanges", prior.id, prior.revision, actor, "patient_note_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(patientNoteTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
