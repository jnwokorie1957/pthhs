import type {HhaProfile} from "./hhaSource.js";

export function canApplyWithCaregiverProfile(profile: HhaProfile | null): profile is HhaProfile {
  return !!profile && profile.status === "Active" && profile.fields.EmployeeType?.toLowerCase() !== "applicant";
}
