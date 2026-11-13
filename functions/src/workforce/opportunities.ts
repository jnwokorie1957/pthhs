import { requirePermission, WorkforceError, validId, type Actor } from "./policy.js";

export const needs = ["personal_care", "mobility_assistance", "meal_preparation", "respite", "bathing", "dressing", "exercise", "feeding", "grooming", "hair_skin_care", "toileting", "transfer", "walking", "cleaning", "laundry", "escort", "shopping", "medication_assistance"] as const;
export const schedules = ["weekdays", "weekends", "flexible"] as const;
export const types = ["assignment", "employment"] as const;
export interface PublicFields {
  serviceType?: 'regular'|'respite'|'protective_supervision'; shifts?: ('morning'|'afternoon'|'evening')[]; pets?: 'yes'|'no'|'unknown';
  location: string; recruitingZip: string; weeklyHours: number;
  schedule: typeof schedules[number]; assistance: (typeof needs[number])[]; type: typeof types[number];
}
export interface Opportunity {
  id: string; office: string; internalReference: string; internalNotes: string; public: PublicFields;
  state: "draft" | "review" | "approved" | "published" | "closed" | "archived";
  revision: number; updatedAt: string; updatedBy: string; contentAuthor: string;
  review: { revision: number; reviewer: string; at: string } | null;
}
export type Action = "submit" | "approve" | "publish" | "close" | "archive";
export function parseOpportunity(input: unknown): Pick<Opportunity, "office" | "internalReference" | "internalNotes" | "public"> {
  const d = input as Opportunity, p = d?.public;
  const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max && !/[<>\x00-\x1f]/.test(v);
  if (!d || typeof d !== "object" || Object.keys(d).some(k => !["office", "internalReference", "internalNotes", "public"].includes(k))
    || !validId(d.office) || !text(d.internalReference, 128) || !text(d.internalNotes, 2000)
    || !p || Object.keys(p).some(k => !["location", "recruitingZip", "weeklyHours", "schedule", "assistance", "type", "serviceType", "shifts", "pets"].includes(k))
    || !text(p.location, 100) || !p.location.trim() || typeof p.recruitingZip !== "string" || !/^(?:\d{5})?$/.test(p.recruitingZip)
    || !Number.isFinite(p.weeklyHours) || p.weeklyHours <= 0 || p.weeklyHours > 168
    || !schedules.includes(p.schedule) || !types.includes(p.type) || !Array.isArray(p.assistance)
    || !p.assistance.length || !p.assistance.every(n => needs.includes(n))) throw new WorkforceError(400, "invalid_opportunity");
  if(p.serviceType!==undefined&&!['regular','respite','protective_supervision'].includes(p.serviceType)||p.shifts!==undefined&&(!Array.isArray(p.shifts)||!p.shifts.length||p.shifts.length>3||p.shifts.some(s=>!['morning','afternoon','evening'].includes(s)))||p.pets!==undefined&&!['yes','no','unknown'].includes(p.pets))throw new WorkforceError(400,'invalid_opportunity');
  // Do not spread input into storage or a public response.
  return { office: d.office, internalReference: d.internalReference, internalNotes: d.internalNotes,
    public: { location: p.location.trim(), recruitingZip: p.recruitingZip, weeklyHours: p.weeklyHours,
      ...(p.serviceType?{serviceType:p.serviceType}:{}),...(p.shifts?{shifts:[...new Set(p.shifts)]}:{}),...(p.pets?{pets:p.pets}:{}),
      schedule: p.schedule, assistance: [...new Set(p.assistance)], type: p.type } };
}
export function saveOpportunity(actor: Actor, previous: Opportunity | null, id: string, revision: number, input: unknown, now: string): Opportunity {
  const data = parseOpportunity(input);
  requirePermission(actor, "opportunities.edit", data.office);
  if (previous) requirePermission(actor, "opportunities.edit", previous.office);
  if (revision !== (previous?.revision ?? 0)) throw new WorkforceError(409, "revision_conflict");
  if (previous?.state === "archived") throw new WorkforceError(409, "opportunity_archived");
  // Every edit unpublishes and invalidates the previous privacy approval.
  return { ...data, id, revision: revision + 1, state: "draft", updatedAt: now, updatedBy: actor.uid, contentAuthor: actor.uid, review: null };
}
export function transition(actor: Actor, previous: Opportunity, revision: number, action: Action, privacyConfirmed: boolean, now: string): Opportunity {
  if (revision !== previous.revision) throw new WorkforceError(409, "revision_conflict");
  const permission = action === "approve" ? "opportunities.review" : action === "publish" ? "opportunities.publish" : "opportunities.edit";
  requirePermission(actor, permission, previous.office);
  const allowed = { submit: ["draft"], approve: ["review"], publish: ["approved"], close: ["published", "approved", "review", "draft"], archive: ["closed"] };
  if (!allowed[action]?.includes(previous.state)) throw new WorkforceError(409, "invalid_transition");
  if (action === "approve" && (!privacyConfirmed || actor.uid === previous.contentAuthor)) throw new WorkforceError(409, "independent_privacy_review_required");
  if (action === "publish" && previous.review?.revision !== revision) throw new WorkforceError(409, "privacy_review_stale");
  const state = { submit: "review", approve: "approved", publish: "published", close: "closed", archive: "archived" } as const;
  const nextRevision = revision + 1;
  return { ...previous, state: state[action], revision: nextRevision, updatedAt: now,
    updatedBy: actor.uid,
    review: action === "approve" ? { revision: nextRevision, reviewer: actor.uid, at: now }
      : action === "publish" && previous.review ? { ...previous.review, revision: nextRevision } : null };
}
export function publicOpportunity(o: Opportunity) {
  if (o.state !== "published" || o.review?.revision !== o.revision) return null;
  const p = o.public;
  return { id: o.id, location: p.location, recruitingZip: p.recruitingZip, weeklyHours: p.weeklyHours,
    ...(p.serviceType?{serviceType:p.serviceType}:{}),...(p.shifts?{shifts:[...p.shifts]}:{}),...(p.pets?{pets:p.pets}:{}),
    schedule: p.schedule, assistance: [...p.assistance], type: p.type, status: "available", updatedAt: o.updatedAt };
}
