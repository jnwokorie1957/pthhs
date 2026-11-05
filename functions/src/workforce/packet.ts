// Transcribed from the owner's blank 27-page scan; never put the scan, completed
// forms, ID images, SSNs or applicant records in Hosting or the public repository.
export const PACKET_SHA256 = "f002450817bd2816b3a239794ac49b3c79354a4fde5f51855cc0e3d2487e139d";
export const PACKET_VERSION = "pthhs-intake-2026-11-05-v1";
export interface IntakeField {
  id: string; label: string; section: string; sourcePage: number;
  type: "text" | "date" | "email" | "tel" | "textarea" | "ssn" | "choice";
  required: boolean; maxLength: number; options: string[];
}
const fields: IntakeField[] = [];
function field(id: string, label: string, section: string, sourcePage: number, type: IntakeField["type"] = "text", required = false, options: string[] = []) {
  fields.push({ id, label, section, sourcePage, type, required, maxLength: type === "textarea" ? 2000 : 250, options });
}
field("name", "Name", "About you", 3, "text", true);
field("applicationDate", "Date", "About you", 3, "date", true);
field("ssn", "Social Security number", "About you", 3, "ssn");
field("birthDate", "Date of birth", "About you", 3, "date");
for (const [id, label] of [["street", "Street address"], ["city", "City"], ["state", "State"], ["zip", "ZIP code"]]) field(id!, label!, "Contact information", 3);
field("phone", "Phone number", "Contact information", 3, "tel", true);
field("alternatePhone", "Alternate phone number", "Contact information", 3, "tel");
field("email", "Email address", "Contact information", 3, "email", true);
for (const [id, label] of [["emergencyName", "In case of emergency, notify: name"], ["emergencyRelationship", "Relationship"], ["emergencyAddress", "Emergency contact address"]]) field(id!, label!, "Emergency contact", 3);
field("emergencyPhone", "Emergency contact phone number", "Emergency contact", 3, "tel");
field("availableDate", "Available date", "Availability & eligibility", 3, "date");
field("workTime", "Full time / part time", "Availability & eligibility", 3, "choice", false, ["Full time", "Part time", "Full time or part time"]);
field("eligibleToWork", "Are you eligible to work in the U.S.?", "Availability & eligibility", 3, "choice", true, ["Yes", "No"]);
field("visaType", "If on visa, what type?", "Availability & eligibility", 3);
field("conviction", "Have you ever been convicted of a crime?", "Availability & eligibility", 3, "choice", true, ["Yes", "No"]);
field("convictionDetails", "If yes, give date and details", "Availability & eligibility", 3, "textarea");
for (const [key, label] of [["highSchool", "High school"], ["college", "College"], ["technical", "Technical training"]]) {
  for (const [part, title] of [["school", "Name & location"], ["major", "Major"], ["degree", "Degrees obtained & date"]]) field(`${key}_${part}`, `${label}: ${title}`, "Education", 4);
}
for (let i = 1; i <= 2; i++) {
  const section = `Work experience ${i}`;
  for (const [key, label] of [["from", "Employment from"], ["to", "Employment to"], ["employer", "Employer name & address"], ["position", "Position"], ["department", "Department"], ["supervisor", "Supervisor name"], ["supervisorPhone", "Supervisor phone number"], ["startingPay", "Starting pay"], ["endingPay", "Ending pay"], ["reason", "Reason for leaving"], ["duties", "Describe duties / responsibilities"]]) {
    field(`job${i}_${key}`, label!, section, 4, key === "duties" ? "textarea" : "text");
  }
}
for (const [key, label] of [["referenceCompany", "Company name"], ["referenceAddress", "Company address"], ["referenceCityStateZip", "Company city, state, ZIP code"], ["referencePhone", "Company telephone number"], ["referenceSupervisor", "Supervisor"], ["referenceDates", "Date employed"]]) field(key!, label!, "Past employment reference", 5);

// Preserve the supplied release wording. Electronic signing is separately gated
// for HR/legal review; this is not a new screening authorization or hiring rule.
export const referenceRelease = {
  id: "past-employment-reference", sourcePage: 5, revision: "REV 04/25",
  text: "I voluntary give PRIMETIME HOME HEALTH SERVICES INC. the right to investigate my past and/or present employment and release from all liability or responsibility by all persons, companies or organizations supplying information."
};
export const intakePacket = {
  version: PACKET_VERSION, sourceSha256: PACKET_SHA256, sourcePages: [3, 4, 5], fields,
  title: "Employment application", revision: "REV 04/25",
  notice: "Please complete the entire application. An incomplete application will not be considered. All information submitted is subjected to verification. Any false or misleading statements may result in disqualification or termination.",
  convictionNotice: "Conviction of a crime is not an automatic bar for employment. Other factors will be taken into consideration (i.e. the nature and date of the crime).",
  referenceRelease
};
export const packetInventory = [
  { pages: [1, 2], title: "PAS attendant job description and acknowledgments", stage: "onboarding", state: "source_review_required" },
  { pages: [3, 4], title: "Employment application, education and work experience", stage: "application", state: "digitized" },
  { pages: [5], title: "Past employment reference and release", stage: "application", state: "digitized_applicant_fields" },
  { pages: [6], title: "Criminal check addendum", stage: "hr", state: "legal_review_required" },
  { pages: [7], title: "Employability misconduct registry verification", stage: "hr", state: "staff_only" },
  { pages: [8], title: "Verification of employability of unlicensed persons", stage: "onboarding", state: "current_requirements_review" },
  { pages: [9, 10], title: "Confidentiality agreement and protected health information pledge", stage: "onboarding", state: "source_review_required" },
  { pages: [11], title: "DPS CCH verification form", stage: "hr", state: "not_a_consent_authorization" },
  { pages: [12], title: "Emergency preparedness policy acknowledgment", stage: "onboarding", state: "source_review_required" },
  { pages: [13], title: "Employee contract addendum", stage: "onboarding", state: "legal_review_required" },
  { pages: [14], title: "OSHA bloodborne pathogens fact sheet", stage: "onboarding", state: "reference" },
  { pages: [15], title: "Hepatitis B vaccination or decline", stage: "onboarding", state: "restricted_medical_record" },
  { pages: [16], title: "Workers compensation notice", stage: "onboarding", state: "current_policy_review" },
  { pages: [17], title: "Health insurance coverage election", stage: "onboarding", state: "current_policy_review" },
  { pages: [18], title: "Direct deposit notification", stage: "payroll", state: "use_approved_adp_not_email" },
  { pages: [19], title: "Orientation checklist", stage: "onboarding", state: "staff_and_employee_attestations" },
  { pages: [20, 21], title: "HHSC rate information letter excerpts", stage: "hr", state: "incomplete_reference_not_pay_promise" },
  { pages: [22], title: "Attendant policies and probation", stage: "onboarding", state: "truncated_probation_text" },
  { pages: [23], title: "Class waiver and arbitration agreement", stage: "onboarding", state: "legal_review_required" },
  { pages: [24], title: "2026 Form W-4", stage: "payroll", state: "approved_adp_or_current_official_form" },
  { pages: [25], title: "Form I-9, edition 08/01/23, page 1 of 4 only", stage: "onboarding", state: "replace_with_complete_current_official_form" },
  { pages: [26], title: "Texas employer new hire reporting form", stage: "hr", state: "employer_only" },
  { pages: [27], title: "Employee performance review", stage: "employment", state: "staff_review_not_initial_application" }
];
