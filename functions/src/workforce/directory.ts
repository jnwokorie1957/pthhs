import { WorkforceError } from "./policy.js";

export function normalizeName(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US").trim().replace(/\s+/g, " ");
}
export function nameQuery(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 100 || /[\x00-\x1f]/.test(value)) throw new WorkforceError(400, "invalid_caregiver_name");
  return normalizeName(value);
}
export function directoryEntry(application: {uid:string;office:string;answers:Record<string,string>;state:string;updatedAt:string}) {
  const { firstName = "", lastName = "" } = application.answers;
  const prefixes = new Set<string>();
  for (const name of [firstName, lastName, [firstName, lastName].filter(Boolean).join(" "), ...[firstName,lastName].flatMap(value=>value.split(/\s+/))]) {
    const normalized = normalizeName(name);
    for (let length = 1; length <= Math.min(normalized.length, 100); length++) prefixes.add(normalized.slice(0, length));
  }
  return { uid: application.uid, office: application.office, firstName, lastName, namePrefixes: [...prefixes], state: application.state, updatedAt: application.updatedAt };
}
