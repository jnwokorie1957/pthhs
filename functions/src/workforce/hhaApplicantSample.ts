import { saveIntake, submitIntake } from "./intake.js";
import { readings } from "./readings.js";

export function syntheticHhaApplication(employeeId: string, officeId: string, now: string) {
  const answers = {
    firstName: "Synthetic", lastName: "Applicant", email: "synthetic@example.invalid",
    phone: "713-555-0100", birthDate: "2000-01-01", gender: "Female", ethnicity: "Unknown", ssn: "000-00-0000",
    street: "100 Synthetic Street", city: "Houston", state: "TX", zip: "77035",
    eligibleToWork: "Yes", conviction: "No", jobDescriptionRead: "Yes",
    highSchool_school: "Synthetic High School", highSchool_completed: "2018",
    emergencyName: "Synthetic Contact", emergencyRelationship: "Friend", emergencyPhone: "713-555-0101",
    availableDate: now.slice(0, 10), weeklyHours: "20",
    ...Object.fromEntries(readings.flatMap(reading => [
      [`read_page_${reading.page}`, "Read"],
      ...(reading.election ? [[`terms_page_${reading.page}`, "Accept"]] : []),
      ...(reading.agreement ? [[`terms_page_${reading.page}`, "I have questions for HR before agreeing"]] : []),
    ])),
  };
  const draft = saveIntake(employeeId, null, 0, answers, officeId, false, now);
  return submitIntake(employeeId, draft, draft.revision, {
    name: "Synthetic Applicant", documentRead: true, electronicConsent: true,
  }, now);
}
