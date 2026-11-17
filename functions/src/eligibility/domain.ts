import { createHash } from 'node:crypto';
import { WorkforceError, requirePermission, type Actor } from '../workforce/policy.js';

export const TIME_ZONE = 'America/Chicago';
export const MONTHLY_CRON = '0 6 1,15 * *';
export type Status = 'active' | 'inactive' | 'unable_to_verify';
export type Trigger = 'manual' | 'monthly' | 'admission' | 'pre_service';
export type Failure = 'missing_information' | 'invalid_identifier' | 'credentials_expired' | 'network_failure' |
  'invalid_response' | 'ambiguous_response' | 'member_mismatch' | 'connection_pending' | 'source_unavailable' | 'delivery_unknown';
export interface Identity { medicaidId: string; lastName: string; birthDate: string | null }
export interface Coverage { effective: string | null; termination: string | null }
export interface Enrollment extends Coverage { name: string | null; planCode: string | null }
export interface Result {
  status: Status; asOf: string; checkedAt: string; source: 'tmhp';
  coverage: Coverage | null; mco: Enrollment[] | null; reason: Failure | null;
}
export interface Evidence {
  matched: boolean; rejected: boolean; asOf: string;
  // An approved codec must scope these to the requested member, date, Medicaid
  // program and general health coverage (30). Medicare/HTW/CHIP are not Medicaid.
  medicaidCoverage: Array<{ active: boolean; effective: string | null; termination: string | null }>;
  managedCare: Enrollment[] | null;
}
export interface Authorization extends Coverage {
  source: 'hhaexchange'; fetchedAt: string; authorizationId: string; serviceCode: string | null;
}
export interface Member {
  sourceState?:'present'|'inactive'|'missing'; rosterGeneration?:string; admissionPending?:string|null;
  key: string; office: string; hhaPatientId: string; memberId: string; displayName: string;
  department: string; assignee: string | null; active: boolean; identityReady: boolean; identityRevision: number;
  sourceFetchedAt: string; latest: Result | null; lastSuccessful: Result | null;
  review: 'none' | 'pending' | 'in_progress' | 'resolved'; changedAt: string | null;
  revision: number; authorizations: Authorization[] | null; authorizationsFetchedAt: string | null;
}
export interface Job {
  id: string; memberKey: string; office: string; identityRevision: number; asOf: string; trigger: Trigger; requestedBy: string;
  state: 'queued' | 'leased' | 'completed' | 'failed'; attempts: number; nextAttemptAt: number;
  leaseUntil: number; leaseToken: string | null; createdAt: string; finishedAt: string | null;
  error: Failure | null;
}
export const opaqueId = (...values: string[]) => createHash('sha256').update(JSON.stringify(values)).digest('hex');
export function dateOnly(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new WorkforceError(400, 'invalid_eligibility_date');
  }
  return value;
}
export function chicagoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(name => parts.find(p => p.type === name)!.value).join('-');
}
export function nextScheduled(now: Date): string {
  // Search calendar dates, not fixed UTC intervals: 06:00 Chicago is outside DST transitions.
  const today = chicagoDate(now);
  for (let offset = 0; offset < 33; offset++) {
    const day = new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10);
    if (!['01', '15'].includes(day.slice(-2))) continue;
    for (const hour of [11, 12]) {
      const candidate = new Date(`${day}T${hour}:00:00.000Z`);
      const localHour = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(candidate);
      if (localHour === '06' && candidate > now) return candidate.toISOString();
    }
  }
  throw new Error('schedule_unavailable');
}
export function identityValid(identity: Identity): boolean {
  // Nine digits, leading zeroes preserved. Never use AdmissionID as Medicaid ID.
  if (identity?.birthDate !== null) { try { dateOnly(identity?.birthDate); } catch { return false; } }
  return !!identity && typeof identity.medicaidId==='string' && typeof identity.lastName==='string' && /^\d{9}$/.test(identity.medicaidId) && identity.lastName.trim().length > 0 &&
    identity.lastName.length <= 60 && !/[\r\n*~|:]/.test(identity.lastName);
}
export function unavailable(asOf: string, checkedAt: string, reason: Failure): Result {
  return { status: 'unable_to_verify', asOf, checkedAt, source: 'tmhp', coverage: null, mco: null, reason };
}
export function normalizeEvidence(evidence: Evidence, asOf: string, now: Date): Result {
  dateOnly(asOf); const checkedAt = now.toISOString();
  if(!evidence || typeof evidence.matched!=='boolean'||typeof evidence.rejected!=='boolean'||!Array.isArray(evidence.medicaidCoverage)||
    evidence.medicaidCoverage.length>100||evidence.medicaidCoverage.some(row=>!row||typeof row.active!=='boolean')||
    evidence.managedCare!==null&&(!Array.isArray(evidence.managedCare)||evidence.managedCare.length>100))return unavailable(asOf,checkedAt,'invalid_response');
  if (!evidence.matched) return unavailable(asOf, checkedAt, 'member_mismatch');
  if (evidence.rejected || evidence.asOf !== asOf) return unavailable(asOf, checkedAt, 'invalid_response');
  if (!evidence.medicaidCoverage.length) return unavailable(asOf, checkedAt, 'missing_information');
  const statuses = new Set(evidence.medicaidCoverage.map(b => b.active));
  if (statuses.size !== 1) return unavailable(asOf, checkedAt, 'ambiguous_response');
  try {
    for (const row of [...evidence.medicaidCoverage, ...(evidence.managedCare ?? [])]) {
      if (row.effective !== null) dateOnly(row.effective);
      if (row.termination !== null) dateOnly(row.termination);
      if (row.effective && row.termination && row.effective > row.termination) throw Error();
    }
    for (const row of evidence.medicaidCoverage) if (row.active &&
      (row.effective && row.effective > asOf || row.termination && row.termination < asOf)) throw Error();
  } catch { return unavailable(asOf, checkedAt, 'invalid_response'); }
  // Multiple coverage periods cannot safely be flattened into a made-up date range.
  const coverage = evidence.medicaidCoverage.length === 1 ? evidence.medicaidCoverage[0]! : null;
  return {status: evidence.medicaidCoverage[0]!.active ? 'active' : 'inactive', asOf, checkedAt, source: 'tmhp',
    coverage: coverage ? { effective: coverage.effective, termination: coverage.termination } : null,
    mco: evidence.managedCare, reason: null};
}
export function applyResult(member: Member, result: Result): {member: Member; changed: boolean; alert: boolean} {
  // Historical or delayed jobs never replace a newer date-of-service result.
  if (member.latest && (member.latest.asOf > result.asOf ||
      member.latest.asOf === result.asOf && member.latest.checkedAt > result.checkedAt)) return {member, changed: false, alert: false};
  const successful = result.status !== 'unable_to_verify';
  const prior = member.lastSuccessful;
  const changed = successful && prior !== null && prior.status !== result.status;
  const alert = prior?.status === 'active' && result.status === 'inactive';
  return {changed, alert, member: {...member, latest: result, lastSuccessful: successful ? result : prior,
    review: changed || !successful ? 'pending' : member.review,
    changedAt: changed ? result.checkedAt : member.changedAt, revision: member.revision + 1}};
}
export function access(actor: Actor, action: 'read' | 'verify' | 'review', office?: string): void {
  requirePermission(actor, `eligibility.${action}`, office);
}
export function jobId(memberKey: string, asOf: string, trigger: Trigger, key: string): string {
  return opaqueId('eligibility-v1', memberKey, dateOnly(asOf), trigger, key);
}
export function retryDelay(attempt: number, random = Math.random()): number {
  return Math.min(3600000, 30000 * 2 ** Math.min(attempt, 7)) + Math.floor(random * 10000);
}
export function discrepancyFlags(member: Member, serviceDate: string): string[] {
  dateOnly(serviceDate); const flags: string[] = [];
  if (!member.latest || member.latest.asOf !== serviceDate) flags.push('eligibility_not_verified_for_service_date');
  else if (member.latest.status === 'unable_to_verify') flags.push('eligibility_unavailable');
  else if (member.latest.status === 'inactive') flags.push('eligibility_inactive_review_required');
  if (member.authorizations === null) flags.push('authorization_unavailable');
  else if (!member.authorizations.some(a => a.effective && a.termination && a.effective <= serviceDate && a.termination >= serviceDate)) flags.push('authorization_dates_need_review');
  // Date overlap does not authorize a service code, units, provider or payer.
  return flags;
}
