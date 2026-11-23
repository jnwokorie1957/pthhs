import type {HhaProfile} from "./hhaSource.js";

export function canApplyWithCaregiverProfile(profile: HhaProfile | null): profile is HhaProfile {
  return !!profile && profile.status === "Active" && profile.fields.EmployeeType?.toLowerCase() !== "applicant";
}

export function caregiverRecruitingProfile(profile: Partial<HhaProfile>) {
  const fields = profile.fields ?? {};
  const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 254) : "";
  let disciplines: string[] = [];
  try {
    const values: unknown = JSON.parse(fields.EmploymentDisciplines ?? "[]");
    if (Array.isArray(values)) disciplines = values.map(text).filter(Boolean).slice(0, 12);
  } catch { /* Older HHA records may have no discipline list. */ }
  return {
    status: text(profile.status),
    email: text(profile.email),
    phone: text(fields["Address/HomePhone"]) || text(fields["Address/Phone2"]),
    location: [text(fields["Address/City"]), text(fields["Address/State"])].filter(Boolean).join(", "),
    disciplines,
    fetchedAt: Number.isFinite(Date.parse(text(profile.fetchedAt))) ? text(profile.fetchedAt) : null,
  };
}
