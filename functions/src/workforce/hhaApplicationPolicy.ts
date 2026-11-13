import {createHash} from "node:crypto";
import type {Intake} from "./intake.js";

// Live HHA reference names, read on 2026-11-12. Never infer these answers.
// Dispatch revalidates the selected values against the live reference tables.
export const HHA_GENDERS = ["Male", "Female", "Other"];
export const HHA_ETHNICITIES: Record<string, string> = {
  "African American": "2", "American Indian": "4", "Asian": "5", "Bengali": "12",
  "Caribbean Indian": "9", "Caucasian": "1", "Hispanic": "3", "Indian": "11",
  "Native Hawaiian": "6", "Pacific Islander": "10", "Two or More Races": "8", "Unknown": "7"
};
export const HHA_RELATIONSHIPS: Record<string, string> = {
  "Aunt":"3584741", "Brother":"3518609", "Brother in Law":"3584742", "Child":"3584745", "Cousin":"3584747",
  "Daughter":"3518602", "Father":"3518601", "Father In Law":"3584752", "Friend":"3584753", "Grandmother":"3584755",
  "Grandparent":"3584756", "Grandson":"3584757", "Mother":"3518606", "Nephew":"3584761", "Niece":"3584762",
  "Other":"3518608", "Parent":"3584765", "Relative":"3518605", "Sibling":"3584768", "Significant Other":"3584769",
  "Sister":"3518600", "Son":"3518604", "Spouse":"3518603", "Uncle":"3584770", "Wife":"3584773"
};
export interface HhaApplicationConfig {enabled: boolean; office: string; discipline: "PCA"; documentType: string; documentLookupId: string; notBefore: string}
export type TransferPhase = "queued" | "preparing" | "creating" | "created" | "attaching" | "acknowledged" | "verified" | "review_required" | "preview_only";
export interface HhaTransfer {
  schema: 1; target: "applicant"; state: TransferPhase; employeeId: string;
  caregiverId?: string; documentId?: string; sha256?: string; filename?: string;
  lease?: string; leaseUntil?: number; reason?: string; updatedAt?: string; verifiedAt?: string;
  createAttempted?: boolean; attachAttempted?: boolean;
}
export interface HhaApplicationJob {applicationUid: string; applicationRevision: number; office: string; submittedAt: string; hha: HhaTransfer}
export interface ApplicantInput {
  firstName: string; lastName: string; birthDate: string; gender: string; ethnicity: string; ethnicityId: string;
  ssn: string; email: string; phone: string; alternatePhone: string;
  street: string; unit: string; city: string; state: string; zip: string; applicationDate: string;
  emergencyName: string; emergencyRelationship: string; emergencyRelationshipId: string; emergencyPhone: string;
}
export const applicationHash = (application: Intake) => createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(application.answers).sort(([a], [b]) => a.localeCompare(b))))).digest("hex");
export function applicantEmployeeId(uid: string, office: string) {
  return "PTA-" + createHash("sha256").update(office + ":" + uid).digest("hex").slice(0, 28);
}
export function initialHhaTransfer(uid: string, office: string): HhaTransfer {
  return {schema: 1, target: "applicant", state: "queued", employeeId: applicantEmployeeId(uid, office)};
}
export function transferAllowed(config: HhaApplicationConfig, now = Date.now()) {
  const start = Date.parse(config.notBefore);
  return config.enabled && config.office === "503324" && config.discipline === "PCA"
    && /^[1-9]\d{0,9}$/.test(config.documentType) && /^[1-9]\d{0,9}$/.test(config.documentLookupId)
    && Number.isFinite(start) && start >= Date.parse("2027-01-01T06:00:00.000Z") && now >= start;
}
export function validateTransferJob(id: string, job: HhaApplicationJob, config: HhaApplicationConfig) {
  if (id !== job.applicationUid || !/^[\w-]{1,128}$/.test(id) || job.office !== config.office || job.hha?.schema !== 1
    || job.hha.target !== "applicant" || job.hha.employeeId !== applicantEmployeeId(id, job.office)
    || !Number.isSafeInteger(job.applicationRevision) || job.applicationRevision < 1
    || !Number.isFinite(Date.parse(job.submittedAt)) || Date.parse(job.submittedAt) < Date.parse(config.notBefore)) throw Error("transfer_job_not_eligible");
}
function date(value: string | undefined) {return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;}
function phone(value: string | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!national) return "";
  if (!/^\d{10}$/.test(national)) throw Error("applicant_phone_review_required");
  return `${national.slice(0,3)}-${national.slice(3,6)}-${national.slice(6)}`;
}
export function applicantInput(application: Intake, job: HhaApplicationJob): ApplicantInput {
  const a = application.answers, sig = application.signature;
  if (application.uid !== job.applicationUid || application.office !== job.office || application.revision !== job.applicationRevision
    || application.state !== "submitted" || application.submittedAt !== job.submittedAt || !sig || sig.uid !== application.uid
    || sig.electronicConsent !== true || sig.answersSha256 !== applicationHash(application)
    || sig.name.trim().replace(/\s+/g," ").toLowerCase() !== `${a.firstName || ""} ${a.lastName || ""}`.trim().replace(/\s+/g," ").toLowerCase()) throw Error("signed_application_snapshot_invalid");
  if (!a.firstName?.trim() || !a.lastName?.trim() || !date(a.birthDate) || !date(a.applicationDate)
    || !HHA_GENDERS.includes(a.gender || "") || !Object.hasOwn(HHA_ETHNICITIES, a.ethnicity || "")
    || !/^\d{3}-?\d{2}-?\d{4}$/.test(a.ssn || "") || !a.street?.trim() || !a.city?.trim()
    || !/^[A-Z]{2}$/.test(a.state || "") || !/^\d{5}$/.test(a.zip || "")
    || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(a.email || "") || !a.emergencyName?.trim()
    || !Object.hasOwn(HHA_RELATIONSHIPS,a.emergencyRelationship || "")) throw Error("hha_required_applicant_fields_missing");
  const ssn = a.ssn!.replace(/\D/g, "");
  return {firstName:a.firstName!,lastName:a.lastName!,birthDate:a.birthDate!,applicationDate:a.applicationDate!,
    gender:a.gender!,ethnicity:a.ethnicity!,ethnicityId:HHA_ETHNICITIES[a.ethnicity!]!,ssn:`${ssn.slice(0,3)}-${ssn.slice(3,5)}-${ssn.slice(5)}`,
    email:a.email!,phone:phone(a.phone),alternatePhone:phone(a.alternatePhone),street:a.street!,unit:a.unit || "",city:a.city!,state:a.state!,zip:a.zip!,
    emergencyName:a.emergencyName!,emergencyRelationship:a.emergencyRelationship!,emergencyRelationshipId:HHA_RELATIONSHIPS[a.emergencyRelationship!]!,emergencyPhone:phone(a.emergencyPhone)};
}
