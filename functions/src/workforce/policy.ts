// Workforce roles never imply access to the legacy clinical/admin API.
export const roles = ["owner", "office_manager", "hr", "office", "supervisor"] as const;
export type Role = typeof roles[number];
export const permissions = ["opportunities.read", "opportunities.edit", "opportunities.review", "opportunities.publish", "staff.manage", "staff.review", "applications.review", "documents.review", "accounts.support", "applicants.review", "authorizations.manage", "hr.expirations", "field_visits.manage"] as const;
export type Permission = typeof permissions[number];
export interface Grant { active: boolean; role: Role; offices: string[]; permissions: Permission[] }
export interface Actor { uid: string; grant: Grant }
export class WorkforceError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
function roleAllows(role: Role, permission: Permission): boolean {
  if (permission === "hr.expirations") return role === "owner" || role === "office_manager" || role === "hr";
  if (permission === 'applicants.review' || permission === 'authorizations.manage') return role !== 'supervisor';
  if (permission === "staff.manage") return role === "owner";
  if (permission === "staff.review") return role === "office_manager";
  if (permission === "documents.review") return role === "owner" || role === "office_manager" || role === "hr";
  if (permission === "applications.review" || permission === "accounts.support") return role !== "supervisor";
  return true;
}
export function requirePermission(actor: Actor, permission: Permission, office?: string): void {
  const g = actor.grant;
  // Role labels are descriptive. Every authority, even for owners, is explicit.
  if (!g.active || !g.permissions.includes(permission) || !roleAllows(g.role, permission)
    || (office !== undefined && !g.offices.includes(office))) throw new WorkforceError(403, "workforce_forbidden");
}
export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
export function parseGrant(input: unknown): Grant {
  const g = input as Grant;
  if (!g || typeof g !== "object" || Object.keys(g).some(k => !["active", "role", "offices", "permissions"].includes(k))
    || typeof g.active !== "boolean" || !roles.includes(g.role) || !Array.isArray(g.offices) || !g.offices.length || g.offices.length > 50
    || !g.offices.every(validId) || !Array.isArray(g.permissions)
    || !g.permissions.every(p => permissions.includes(p) && roleAllows(g.role, p))) throw new WorkforceError(400, "invalid_staff_grant");
  return { active: g.active, role: g.role, offices: [...new Set(g.offices)], permissions: [...new Set(g.permissions)] };
}
