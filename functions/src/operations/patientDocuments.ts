import type { OperationsWorkspace } from "./workspace.js";
import { boundedAttachment, identifier, readRequest, safeAttachmentFilename, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
type RecordFields = OperationalRead["records"][number];

export async function patientDocumentRead(workspace: Workspace, value: unknown, actor: string, elapsedClock: () => number = () => performance.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_patient_document_query");
  const input = value as Record<string, unknown>, operation = input.operation;
  if (operation !== "SearchPatientDocument" && operation !== "DownloadPatientDocument") throw new WorkflowError("invalid_patient_document_query");
  const download = operation === "DownloadPatientDocument";
  if (Object.keys(input).some(key => !(download ? ["operation", "patientId", "officeId", "id"] : ["operation", "patientId", "officeId", "id", "documentTypeId", "date"]).includes(key))) throw new WorkflowError("invalid_patient_document_query");
  const patientId = identifier(input.patientId), officeId = identifier(input.officeId);
  const request: ReadInput = { operation, patientId };
  if (download) request.id = identifier(input.id);
  else for (const key of ["id", "documentTypeId", "date"] as const) {
    if (input[key] !== undefined && typeof input[key] !== "string") throw new WorkflowError("invalid_patient_document_query");
    if (input[key]) request[key] = input[key] as string;
  }
  readRequest(request); // Validate filters before patient/source dispatch.
  const current = await workspace.settings();
  if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  if (officeId !== current.settings.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  const required = ["GetPatientDemographics", operation, ...(download ? ["SearchPatientDocument"] : [])];
  if (!required.every(op => current.settings.enabledReads.includes(op))) throw new WorkflowError("read_not_owner_enabled", 423);
  const checkScope = async () => {
    const latest = await workspace.settings();
    if (!latest.dataApproved || JSON.stringify(current.settings) !== JSON.stringify(latest.settings)) throw new WorkflowError("office_policy_changed_restart", 409);
  };
  const started = elapsedClock();
  const read = async (input: ReadInput) => {
    // Leave the transport's full single-attempt timeout and response headroom.
    if (elapsedClock() - started >= 30_000) throw new WorkflowError("patient_document_read_budget_deferred", 503);
    await checkScope();
    const data = await workspace.query(input, actor);
    await checkScope();
    if (data.operation !== input.operation || data.source !== "hhaexchange") throw new WorkflowError("patient_document_source_unavailable", 409);
    return data;
  };
  const checkPatient = async () => {
    const data = await read({ operation: "GetPatientDemographics", id: patientId });
    if (data.truncated || data.records.length !== 1 || data.records[0]?.PatientID !== patientId || data.records[0]?.OfficeID !== officeId) throw new WorkflowError("patient_office_mismatch", 403);
  };
  const metadata = async () => {
    const data = await read({ operation: "SearchPatientDocument", patientId, id: request.id! });
    if (data.truncated || data.records.length !== 1 || data.records[0]?.PatientDocID !== request.id || data.records[0]?.PatientID !== patientId) throw new WorkflowError("patient_document_membership_unverified", 409);
    return data;
  };
  await checkPatient();
  const before = download ? await metadata() : null;
  const data = await read(download ? { operation, id: request.id! } : request);
  let metadataReadAt: { before: string; after: string } | undefined;
  let attachment: OperationalRead["attachment"];
  if (download) {
    if (data.truncated || data.records.length !== 1 || data.records[0]?.PatientDocID !== request.id || !data.attachment) throw new WorkflowError("patient_document_download_unverified", 409);
    const candidate = data.attachment;
    // Validate the closed attachment again at the public boundary, not only in
    // the SOAP adapter. Never render the vendor MIME type or untrusted filename.
    const checked = boundedAttachment({ PatientDocID: request.id!, FileName: candidate.filename, StreamData: candidate.base64, FileSize: String(candidate.byteLength) }, "PatientDocID", request.id!);
    if (checked.filename !== candidate.filename || checked.byteLength !== candidate.byteLength || candidate.contentType !== "application/octet-stream") throw new WorkflowError("patient_document_download_unverified", 409);
    attachment = checked;
    const after = await metadata();
    const fingerprint = (row: RecordFields) => ["PatientDocID", "PatientID", "PatientDocumentTypeID", "PatientDocumentType", "FileName", "CreatedOn", "FileSize"].map(key => row[key] ?? null);
    if (JSON.stringify(fingerprint(before!.records[0]!)) !== JSON.stringify(fingerprint(after.records[0]!))) throw new WorkflowError("patient_document_changed_restart", 409);
    const row = after.records[0]!;
    if (row.FileName && safeAttachmentFilename(row.FileName) !== checked.filename) throw new WorkflowError("patient_document_changed_restart", 409);
    if (row.FileSize != null && row.FileSize !== "" && (!/^\d+$/.test(row.FileSize) || Number(row.FileSize) !== checked.byteLength)) throw new WorkflowError("patient_document_size_unverified", 409);
    metadataReadAt = { before: before!.fetchedAt, after: after.fetchedAt };
  } else if (data.attachment || data.records.some(row => row.PatientID !== patientId || request.id && row.PatientDocID !== request.id || request.documentTypeId && row.PatientDocumentTypeID !== request.documentTypeId)) throw new WorkflowError("patient_document_membership_unverified", 409);
  await checkPatient(); await checkScope();
  const fields = download ? ["PatientDocID", "FileName", "FileSize", "ContentType"] : ["PatientDocID", "PatientID", "PatientDocumentTypeID", "PatientDocumentType", "FileName", "CreatedOn", "FileSize"];
  const records: RecordFields[] = data.records.map(row => ({ ...Object.fromEntries(fields.map(key => [key, row[key] ?? null])), Interpretation: "HHA source file only; no clinical form instance, approved version, visit link, signature or sharing authority is established. Document date-filter semantics remain unvalidated." }));
  return { ...data, ...(attachment ? { attachment } : {}), scope: { patientId, officeId }, membershipCheckedAt: new Date().toISOString(), ...(metadataReadAt ? { metadataReadAt } : {}),
    records,
    interpretation: "patient_document_file_unvalidated" as const };
}
