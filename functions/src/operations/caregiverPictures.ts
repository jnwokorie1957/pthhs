import { replacementFile } from "./documentReplacements.js";
import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID, createHash } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface CaregiverPictureChange extends Versioned {
  operation: "UploadCaregiverPicture"; caregiverId: string; officeId: string;
  before: Facts; proposed: Facts; retainedOriginalReference: string; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_caregiver_picture_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export const caregiverPictureTarget = (caregiverId: string) => `caregiver_picture_${identifier(caregiverId)}`;
export async function currentCaregiverPicture(read: (input: ReadInput) => Promise<OperationalRead>, caregiverId: string, officeId: string): Promise<Facts> {
  const caregiver = await read({ operation: "GetCaregiverDemographics", id: caregiverId });
  let offices: unknown; try { offices = JSON.parse(caregiver.records[0]?.OfficeIDs || ""); } catch {}
  if (caregiver.truncated || caregiver.records.length !== 1 || caregiver.records[0]?.ID !== caregiverId || !Array.isArray(offices) || offices.length !== 1 || offices[0] !== officeId) throw new WorkflowError("picture_caregiver_single_office_required", 409);
  const picture = await read({ operation: "DownloadCaregiverPicture", caregiverId });
  const file = picture.attachment;
  if (picture.truncated || picture.records.length !== 1 || picture.records[0]?.CaregiverID !== caregiverId || !file) throw new WorkflowError("existing_picture_required_absence_not_proven", 409);
  const bytes = Buffer.from(file.base64, "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.length !== file.byteLength || bytes.toString("base64") !== file.base64) throw new WorkflowError("invalid_picture_snapshot", 409);
  return { CaregiverID: caregiverId, FileName: file.filename, FileBytes: String(bytes.length), FileSHA256: createHash("sha256").update(bytes).digest("hex") };
}
export function pictureFile(filename: unknown, base64: unknown): Facts {
  const facts = replacementFile(filename, base64), bytes = Buffer.from(base64 as string, "base64");
  const png = /\.png$/i.test(filename as string) && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = /\.jpe?g$/i.test(filename as string) && bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  if (!png && !jpeg) throw new WorkflowError("png_or_jpeg_picture_required");
  return facts;
}
function verifyFile(facts: Facts, base64: unknown) {
  const actual = pictureFile(facts.FileName, base64);
  if (actual.FileBytes !== facts.FileBytes || actual.FileSHA256 !== facts.FileSHA256) throw new WorkflowError("reviewed_picture_file_required", 409);
}
export function caregiverPictureRequest(facts: Facts, base64: string): string {
  verifyFile(facts, base64);
  return `<CaregiverID>${identifier(facts.CaregiverID)}</CaregiverID><PictureDetails><FileName>${escaped(facts.FileName!)}</FileName><StreamData>${base64}</StreamData><FileSize>${facts.FileBytes}</FileSize></PictureDetails>`;
}
export async function submitCaregiverPicture(client: Pick<HhaSoapClient, "call">, facts: Facts, base64: string): Promise<"acknowledged" | "unknown" | "not_submitted"> {
  const response = await client.call("UploadCaregiverPicture", caregiverPictureRequest(facts, base64), 1);
  return response.ok && response.resultXml && extractElementText(response.resultXml, "CaregiverID") === facts.CaregiverID ? "acknowledged" : "unknown";
}
export class CaregiverPictureWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts, base64: string) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private clock = () => performance.now()) {}
  private async current(caregiverId: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentCaregiverPicture(this.read, caregiverId, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision", "base64"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<CaregiverPictureChange>("caregiverPictureChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id), caregiverId = identifier(input.caregiverId);
    if (Object.keys(input).some(key => !["id", "caregiverId", "filename", "base64", "retainedOriginalReference", "rationale"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_caregiver_picture_proposal");
    if (typeof input.retainedOriginalReference !== "string" || input.retainedOriginalReference.trim().length < 8 || input.retainedOriginalReference.length > 500 || /[\r\n]/.test(input.retainedOriginalReference)) throw new WorkflowError("retained_original_reference_required");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const before = await this.current(caregiverId, officeId);
    const proposed = { ...before, ...pictureFile(input.filename, input.base64) };
    caregiverPictureRequest(proposed, input.base64 as string); if (sameSourceFacts(before, proposed)) throw new WorkflowError("proposal_has_no_change");
    return this.repository.change<CaregiverPictureChange>("caregiverPictureChanges", id, 0, actor, "caregiver_picture_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "UploadCaregiverPicture", caregiverId, officeId, before, proposed, retainedOriginalReference: input.retainedOriginalReference as string, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: CaregiverPictureChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameSourceFacts(await this.current(prior.caregiverId, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<CaregiverPictureChange>("caregiverPictureChanges", prior.id, prior.revision, actor, "caregiver_picture_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved") verifyFile(prior.proposed, input.base64);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<CaregiverPictureChange>("caregiverPictureChanges", prior.id, prior.revision, actor, "caregiver_picture_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { input, prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("caregiver_picture_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    verifyFile(prior.proposed, input.base64);
    const target = caregiverPictureTarget(prior.caregiverId);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    const snapshot = await this.current(prior.caregiverId, prior.officeId);
    if (!sameSourceFacts(snapshot, prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    caregiverPictureRequest(prior.proposed, input.base64 as string); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<CaregiverPictureChange>("caregiverPictureChanges", prior.id, prior.revision, actor, "caregiver_picture_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.write.submit(prior.proposed, input.base64 as string); } catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<CaregiverPictureChange>("caregiverPictureChanges", prior.id, attempt.revision, actor, "caregiver_picture_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<CaregiverPictureChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.caregiverId, prior.officeId); reconciliation = sameSourceFacts(current, prior.proposed) ? "matches_proposal" : sameSourceFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<CaregiverPictureChange>("caregiverPictureChanges", prior.id, prior.revision, actor, "caregiver_picture_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(caregiverPictureTarget(prior.caregiverId), prior.id);
    return reconciled;
  }
}
