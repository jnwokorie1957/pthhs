import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { FORM_BUCKET } from "../forms/library.js";
import { WorkflowError } from "../operations/reads.js";
import { kmsDocumentCipher } from "../workforce/documentEncryption.js";
import { WorkforceError } from "../workforce/policy.js";
import { documentHash, scannedPreview, scannedSource } from "../workforce/scannedDocument.js";
import { recordId, strictObject } from "./policy.js";
import { visitArea } from "./visitArea.js";
import type { EncryptedVisitObject, RequirementRecord, RevisionRecords, VisitAttachment } from "./records.js";

export function publicRequirement(record: RequirementRecord) {
  return { ...record, area: record.followUp?.zip ? visitArea(record.followUp.zip) : null, completions: record.completions.map(({ attachment, ...evidence }) => ({ ...evidence, hasAttachment: Boolean(attachment) })) };
}

export async function uploadVisitDocument(records: RevisionRecords, value: unknown) {
  const input = strictObject(value, ["id", "revision", "officeId", "completionId", "completedOn", "performedBy", "note", "source", "pages"]);
  const id = recordId(input.id), completionId = recordId(input.completionId);
  const prior = await records.get<RequirementRecord>("requirements", id);
  if (!prior) throw new WorkflowError("requirement_not_found", 404);
  if (prior.officeId !== input.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  const source = decodeSource(input.source);
  const existing = prior.completions.find(item => item.id === completionId);
  if (existing) {
    if (existing.attachment?.source.sha256 === documentHash(source) && existing.completedOn === input.completedOn &&
      existing.performedBy === input.performedBy && existing.note === input.note) return prior;
    throw new WorkflowError("completion_identity_exists", 409);
  }
  if (prior.revision !== input.revision) throw new WorkflowError("revision_conflict", 409);
  if (!prior.nextDueDate || prior.completions.some(item => item.reviewState === "pending_review" && item.forDueDate === prior.nextDueDate)) {
    throw new WorkflowError("review_visit_evidence_first", 409);
  }

  const preview = await scannedPreview(input.pages).catch((error: unknown) => { throw uploadError(error); });
  const bucket = getStorage().bucket(FORM_BUCKET), cipher = kmsDocumentCipher();
  const prefix = ["supervisory-visit-evidence", prior.officeId, id, completionId, randomUUID()].join("/");
  const saved: EncryptedVisitObject[] = [];
  async function write(kind: string, bytes: Buffer): Promise<EncryptedVisitObject> {
    const path = prefix + "/" + kind + ".enc", file = bucket.file(path);
    const encrypted = await cipher.encrypt(bytes, path);
    await file.save(encrypted.bytes, { resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: "application/octet-stream", cacheControl: "private, no-store" } });
    const [metadata] = await file.getMetadata();
    if (!metadata.generation) throw new WorkflowError("visit_document_unavailable", 503);
    const object = { path, generation: String(metadata.generation), envelope: encrypted.envelope, sha256: documentHash(bytes), storedSha256: documentHash(encrypted.bytes) };
    saved.push(object);
    return object;
  }
  try {
    const attachment: VisitAttachment = { source: await write("source", source), preview: await write("preview", preview) };
    return await records.recordCompletion({ id, completionId, officeId: input.officeId, revision: input.revision,
      completedOn: input.completedOn, performedBy: input.performedBy, note: input.note, documentReference: "Uploaded visit paperwork" }, attachment);
  } catch (error) {
    // Reconcile a lost transaction response before discarding this attempt's objects.
    const reconciled = await records.get<RequirementRecord>("requirements", id).catch(() => undefined);
    if (reconciled?.completions.some(item => item.attachment?.preview.path === prefix + "/preview.enc")) return reconciled;
    if (reconciled !== undefined) await Promise.allSettled(saved.map(object => bucket.file(object.path, { generation: object.generation }).delete()));
    throw uploadError(error);
  }
}

function decodeSource(value: unknown) {
  try { return scannedSource(value); }
  catch (error) { throw uploadError(error); }
}
function uploadError(error: unknown) {
  return error instanceof WorkforceError ? new WorkflowError(error.code, error.status) : error;
}

export async function readVisitDocument(records: RevisionRecords, value: unknown) {
  const input = strictObject(value, ["id", "completionId"]);
  const id = recordId(input.id), completionId = recordId(input.completionId);
  const record = await records.get<RequirementRecord>("requirements", id);
  const item = record?.completions.find(item => item.id === completionId)?.attachment?.preview;
  if (!item) throw new WorkflowError("visit_document_not_found", 404);
  const [stored] = await getStorage().bucket(FORM_BUCKET).file(item.path, { generation: item.generation }).download({ validation: "crc32c" });
  if (documentHash(stored) !== item.storedSha256) throw new WorkflowError("visit_document_integrity_error", 503);
  const bytes = await kmsDocumentCipher().decrypt(stored, item.envelope, item.path);
  if (documentHash(bytes) !== item.sha256) throw new WorkflowError("visit_document_integrity_error", 503);
  return bytes;
}
