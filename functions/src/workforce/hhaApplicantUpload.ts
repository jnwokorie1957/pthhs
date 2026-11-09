import { createHash } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementBodies, extractExactElementText } from "../integrations/hhaexchange/parser.js";
import { submitDocumentCreation } from "../operations/documentCreations.js";
import { replacementFile } from "../operations/documentReplacements.js";
import { identifier, operationalRead } from "../operations/reads.js";
import { renderApplication } from "./applicationPdf.js";
import type { Intake } from "./intake.js";

type Client = Pick<HhaSoapClient, "call">;
type Destination = {
  officeId: string;
  documentTypeId: string;
  discipline: string;
  gender: "Male" | "Female";
  employeeId: string;
};
type Evidence = {
  stage: "creating_applicant" | "applicant_created" | "attaching_pdf" | "pdf_acknowledged" | "verified";
  officeId: string;
  employeeId: string;
  revision: number;
  filename: string;
  sha256: string;
  caregiverId?: string;
  documentId?: string;
};

function tag(name: string, value: string) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<${name}>${escaped}</${name}>`;
}

// Acceptance harness. The production queue has no caller for this routine.
export async function verifyHhaApplicantUpload(
  client: Client, application: Intake, destination: Destination, record: (evidence: Evidence) => Promise<void>,
) {
  const { employeeId, discipline, gender } = destination;
  const officeId = identifier(destination.officeId);
  const documentTypeId = identifier(destination.documentTypeId);
  if (application.office !== officeId || application.state !== "submitted" || !application.submittedAt
    || application.signature?.uid !== application.uid || application.signature.electronicConsent !== true) {
    throw new Error("signed_application_for_selected_office_required");
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(employeeId) || !discipline.trim() || discipline.length > 80
    || !["Male", "Female"].includes(gender)) throw new Error("vendor_confirmed_applicant_fields_required");
  const a = application.answers;
  if (!a.firstName || !a.lastName || !a.birthDate || !a.applicationDate || !/^\d{5}$/.test(a.zip || "")) {
    throw new Error("required_hha_applicant_fields_missing");
  }

  const pdf = await renderApplication(application);
  const base64 = pdf.toString("base64");
  const filename = `Employment-Application-${employeeId}-r${application.revision}.pdf`;
  const file = replacementFile(filename, base64);
  const evidence = { officeId, employeeId, revision: application.revision, filename, sha256: file.FileSHA256! };
  const profileRequest = [
    tag("OfficeID", officeId), tag("FirstName", a.firstName), tag("LastName", a.lastName),
    tag("Gender", gender), tag("BirthDate", a.birthDate), tag("StatusID", "1"),
    `<EmploymentTypes>${tag("Discipline", discipline)}</EmploymentTypes>`,
    tag("EmployeeID", employeeId), tag("ApplicationDate", a.applicationDate),
    `<Address>${tag("Street1", a.street || "")}${tag("Street2", a.unit || "")}${tag("City", a.city || "")}${tag("State", a.state || "")}${tag("Zip5", a.zip!)}</Address>`,
    tag("EmployeeType", "Applicant"),
  ].join("");
  await record({ ...evidence, stage: "creating_applicant" });
  const created = await client.call("CreateCaregiver", `<CaregiverInfo>${profileRequest}</CaregiverInfo>`, 1);
  const info = created.ok ? extractElementBodies(created.resultXml || "", "CaregiverInfo") : [];
  if (info.length !== 1 || extractElementBodies(info[0]!, "CaregiverID").length !== 1) {
    throw new Error("applicant_creation_unconfirmed");
  }
  const caregiverId = identifier(extractExactElementText(info[0]!, "CaregiverID")?.trim());
  await record({ ...evidence, caregiverId, stage: "applicant_created" });

  const read = (input: Parameters<typeof operationalRead>[1]) => operationalRead(client, input, "workforce_caregiver_profile");
  async function verifyProfile() {
    const profile = await read({ operation: "GetCaregiverDemographics", id: caregiverId });
    const row = profile.records[0];
    if (profile.truncated || profile.records.length !== 1 || row?.ID !== caregiverId
      || row.EmployeeID !== employeeId || row.EmployeeType?.toLowerCase() !== "applicant"
      || row.OfficeIDs !== JSON.stringify([officeId])) throw new Error("applicant_identity_unverified");
  }
  const inventory = async () => {
    const result = await read({ operation: "SearchCaregiverDocument", caregiverId });
    if (result.truncated) throw new Error("applicant_document_list_incomplete");
    return result.records;
  };
  const sameFilename = (row: Record<string, string | null>) => row.FileName?.toLowerCase() === filename.toLowerCase();

  await verifyProfile();
  const before = await inventory();
  if (before.some(sameFilename)) throw new Error("application_filename_already_exists");
  await record({ ...evidence, caregiverId, stage: "attaching_pdf" });
  const uploaded = await submitDocumentCreation(client, {
    UserRole: "Caregiver", SubjectID: caregiverId, DocumentTypeID: documentTypeId,
    Description: "Signed employment application", ...file,
  }, base64);
  if (uploaded.result !== "acknowledged") throw new Error("application_attachment_unconfirmed");
  const documentId = identifier(uploaded.recordId);
  const target = { ...evidence, caregiverId, documentId };
  await record({ ...target, stage: "pdf_acknowledged" });
  if (before.some(row => row.CaregiverDocID === documentId)) throw new Error("application_document_id_already_exists");
  const verifyListing = async () => {
    const matches = (await inventory()).filter(sameFilename);
    const row = matches[0];
    if (matches.length !== 1 || row?.CaregiverDocID !== documentId || row.CaregiverID !== caregiverId
      || row.CaregiverDocumentTypeID !== documentTypeId) throw new Error("application_document_target_unverified");
  };
  await verifyListing();
  const downloaded = await read({ operation: "DownloadCaregiverDocument", id: documentId });
  const bytes = downloaded.attachment && Buffer.from(downloaded.attachment.base64, "base64");
  if (!bytes || downloaded.attachment?.filename !== filename
    || createHash("sha256").update(bytes).digest("hex") !== evidence.sha256) {
    throw new Error("application_pdf_readback_mismatch");
  }
  await verifyProfile();
  await verifyListing();
  const verified = { ...target, stage: "verified" as const };
  await record(verified);
  return verified;
}
