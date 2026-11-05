// Workforce roles never imply access to the legacy clinical/admin API.
export const roles = ["owner", "hr", "office", "supervisor"] as const;
export type Role = typeof roles[number];
export const permissions = ["opportunities.read", "opportunities.edit", "opportunities.review", "opportunities.publish", "staff.manage", "applications.review", "documents.review"] as const;
export type Permission = typeof permissions[number];
export interface Grant { active: boolean; role: Role; offices: string[]; permissions: Permission[] }
export interface Actor { uid: string; grant: Grant }
export class WorkforceError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function requirePermission(actor: Actor, permission: Permission, office?: string): void {
  const g = actor.grant;
  // Role labels are descriptive. Every authority, even for owners, is explicit.
  if (!g.active || !g.permissions.includes(permission) || (permission === "staff.manage" && g.role !== "owner")
    || (["applications.review", "documents.review"].includes(permission) && !["owner", "hr"].includes(g.role))
    || (office !== undefined && !g.offices.includes(office))) throw new WorkforceError(403, "workforce_forbidden");
}
export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
export function parseGrant(input: unknown): Grant {
  const g = input as Grant;
  if (!g || typeof g !== "object" || Object.keys(g).some(k => !["active", "role", "offices", "permissions"].includes(k))
    || typeof g.active !== "boolean" || !roles.includes(g.role) || !Array.isArray(g.offices) || !g.offices.length || g.offices.length > 50
    || !g.offices.every(validId) || !Array.isArray(g.permissions) || !g.permissions.every(p => permissions.includes(p))
    || (g.role !== "owner" && g.permissions.includes("staff.manage"))
    || (!["owner", "hr"].includes(g.role) && g.permissions.some(p => ["applications.review", "documents.review"].includes(p)))) throw new WorkforceError(400, "invalid_staff_grant");
  return { active: g.active, role: g.role, offices: [...new Set(g.offices)], permissions: [...new Set(g.permissions)] };
}
