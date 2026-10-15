import { createHash } from "node:crypto";
import { WorkflowError, identifier } from "../operations/reads.js";
import type { Versioned, WorkspaceRepository } from "../operations/workspace.js";
import { evidenceIsFresh, normalizedInstant, validEvidenceScope, type EvidenceScope, type NormalizedVisitEvidence, type VisitTimes } from "./evidence.js";
import type { OverlapCandidate } from "./diagnosis.js";

export interface OverlapCoverageAcceptance {
  officeId: string; timezone: string; sourceAcceptanceVersion: string; reference: string; validUntil: string;
  maxVisitDurationMinutes: number; serviceDateSemantics: "service_interval_start_office_date"; adjacentDatesCoverMaximumDuration: true;
}
export interface ReviewedOverlapAllowance {
  officeId: string; visitId: string; visitDate: string; sourceRevision: string;
  relatedVisitId: string; relatedDate: string; relatedSourceRevision: string;
  decision: "allowed" | "conflict"; reference: string; reviewedBy: string; reviewedAt: string; validUntil: string;
}
export interface OverlapScanScope extends EvidenceScope {
  fence: string; acceptanceVersion: string; maxAgeSeconds: number;
  coverageAcceptance?: OverlapCoverageAcceptance | null;
}
export interface OverlapDiscovery { visitIds: readonly string[]; fetchedAt: string; truncated: boolean; }
export interface OverlapCallbacks {
  /** Trusted office-scoped discovery; return truncated=true if the source cannot establish the full ID set. */
  discover(date: string): Promise<OverlapDiscovery>;
  /** Recheck office/identity/date and adapt under the same accepted source contract before returning. */
  read(visitId: string, date: string, discoveredIds: readonly string[]): Promise<NormalizedVisitEvidence>;
  checkFence(): Promise<void>;
  canContinue?(): boolean;
}
export interface OverlapCoverage {
  complete: boolean; reasons: readonly string[]; dates: readonly string[];
  discoveredCount: number; observedCount: number; detailReads: number; discoveryReads: number;
  candidateLimit: number; oldestObservationAt: string | null;
  freshUntil: string | null;
}
export interface OverlapWindow {
  scope: OverlapScanScope; observations: readonly NormalizedVisitEvidence[]; coverage: OverlapCoverage;
  discovery: readonly { date: string; visitIds: readonly string[]; fetchedAt: string | null }[];
}
interface DayWindow { date: string; ids: string[] | null; fetchedAt: string | null; truncated: boolean; error: string | null; }
interface Observation { date: string; visitId: string; attemptedAt: string; evidence: NormalizedVisitEvidence | null; error: string | null; }
interface Checkpoint extends Versioned {
  scope: OverlapScanScope; days: DayWindow[]; observations: Observation[]; discoveryIndex: number; detailIndex: number;
}
type PackedEvidence = Pick<NormalizedVisitEvidence, "state" | "patientId" | "caregiverId" | "scheduleType" | "variableScheduleAccepted" | "clockingMethod" | "clockingAttempt" | "openState" | "serviceTimeBasis"> & {
  reasons: readonly string[]; times: (string | null)[];
  provenance: { operation: "GetVisitInfoV2" | "GetVisitInfoV3"; fetchedAt: string; sourceRevision: string; maxAgeSeconds: number | null } | null;
};
interface StoredCheckpoint extends Omit<Checkpoint, "observations"> {
  observations: (Omit<Observation, "evidence"> & { evidence: PackedEvidence | null })[];
}
type Repository = Pick<WorkspaceRepository, "get" | "change">;
const DAY = 86_400_000, MAX_IDS_PER_DAY = 200, MAX_OBSERVATIONS = 600, MAX_CHECKPOINT_BYTES = 750_000;
export const OVERLAP_CANDIDATE_LIMIT = 20;
const TIME_NAMES = ["scheduledStart", "scheduledEnd", "actualStart", "actualEnd", "evvStart", "evvEnd"] as const;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function exact(value: unknown, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Reflect.ownKeys(value).some(key => typeof key !== "string" || !keys.includes(key))
    || keys.some(key => !optional.includes(key) && !Object.hasOwn(value, key))) throw new WorkflowError("invalid_overlap_record");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new WorkflowError("invalid_overlap_text");
  return value.trim();
}
function fingerprint(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new WorkflowError("invalid_overlap_fingerprint");
  return value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || value.startsWith("0000")) throw new WorkflowError("invalid_overlap_date");
  normalizedInstant(value + "T00:00:00Z"); return value;
}
function dates(value: string) { const at = normalizedInstant(date(value) + "T00:00:00Z").epochMs; return [value, date(new Date(at - DAY).toISOString().slice(0, 10)), date(new Date(at + DAY).toISOString().slice(0, 10))]; }
function integer(value: unknown, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new WorkflowError("invalid_overlap_bound"); return Number(value);
}
function timestamp(value: unknown): string { return normalizedInstant(text(value, 40)).iso; }
export function validateOverlapCoverageAcceptance(value: unknown): OverlapCoverageAcceptance {
  const input = exact(value, ["officeId", "timezone", "sourceAcceptanceVersion", "reference", "validUntil", "maxVisitDurationMinutes", "serviceDateSemantics", "adjacentDatesCoverMaximumDuration"]);
  const officeId = identifier(input.officeId), timezone = text(input.timezone, 128);
  validEvidenceScope({ officeId, timezone, date: "2026-01-01", revision: 0 });
  if (input.serviceDateSemantics !== "service_interval_start_office_date" || input.adjacentDatesCoverMaximumDuration !== true) throw new WorkflowError("unsupported_overlap_coverage_semantics");
  return { officeId, timezone, sourceAcceptanceVersion: text(input.sourceAcceptanceVersion, 128), reference: text(input.reference, 500), validUntil: timestamp(input.validUntil),
    maxVisitDurationMinutes: integer(input.maxVisitDurationMinutes, 1, 1440), serviceDateSemantics: input.serviceDateSemantics, adjacentDatesCoverMaximumDuration: true };
}
export function validateReviewedOverlapAllowance(value: unknown): ReviewedOverlapAllowance {
  const input = exact(value, ["officeId", "visitId", "visitDate", "sourceRevision", "relatedVisitId", "relatedDate", "relatedSourceRevision", "decision", "reference", "reviewedBy", "reviewedAt", "validUntil"]);
  if (!["allowed", "conflict"].includes(String(input.decision))) throw new WorkflowError("invalid_overlap_allowance");
  const result: ReviewedOverlapAllowance = { officeId: identifier(input.officeId), visitId: identifier(input.visitId), visitDate: date(input.visitDate), sourceRevision: fingerprint(input.sourceRevision),
    relatedVisitId: identifier(input.relatedVisitId), relatedDate: date(input.relatedDate), relatedSourceRevision: fingerprint(input.relatedSourceRevision), decision: input.decision as "allowed" | "conflict",
    reference: text(input.reference, 500), reviewedBy: text(input.reviewedBy, 128), reviewedAt: timestamp(input.reviewedAt), validUntil: timestamp(input.validUntil) };
  if (result.visitId === result.relatedVisitId || normalizedInstant(result.validUntil).epochMs <= normalizedInstant(result.reviewedAt).epochMs) throw new WorkflowError("invalid_overlap_allowance");
  return result;
}
function checkedScope(value: OverlapScanScope): OverlapScanScope {
  const input = exact(value, ["officeId", "date", "timezone", "revision", "fence", "acceptanceVersion", "maxAgeSeconds", "coverageAcceptance"], ["coverageAcceptance"]);
  validEvidenceScope(value); date(value.date); fingerprint(value.fence); integer(value.maxAgeSeconds, 1, 3600);
  const scope = { officeId: value.officeId, date: value.date, timezone: value.timezone, revision: value.revision, fence: value.fence,
    acceptanceVersion: text(value.acceptanceVersion, 128), maxAgeSeconds: value.maxAgeSeconds,
    coverageAcceptance: input.coverageAcceptance === null || input.coverageAcceptance === undefined ? null : validateOverlapCoverageAcceptance(input.coverageAcceptance) };
  const policy = scope.coverageAcceptance;
  if (policy && (policy.officeId !== scope.officeId || policy.timezone !== scope.timezone || policy.sourceAcceptanceVersion !== scope.acceptanceVersion)) throw new WorkflowError("overlap_coverage_scope_mismatch", 403);
  return scope;
}
const key = (date: string, visitId: string) => date + ":" + visitId;
function fresh(value: string | null, scope: OverlapScanScope, now: string): boolean {
  try { return value !== null && evidenceIsFresh(value, now, scope.maxAgeSeconds); } catch { return false; }
}
/** Persist only normalized intervals and source hashes; never raw patient fields or verification notes. */
function compact(value: NormalizedVisitEvidence, scope: OverlapScanScope, expectedDate: string, visitId: string): NormalizedVisitEvidence {
  if (!value || value.visitId !== visitId || value.scope.officeId !== scope.officeId || value.scope.date !== expectedDate || value.scope.timezone !== scope.timezone || value.scope.revision !== scope.revision)
    throw new WorkflowError("overlap_observation_scope_mismatch", 403);
  if (!["ready", "unavailable", "unaccepted", "stale", "incomplete", "failed"].includes(value.state)) throw new WorkflowError("invalid_overlap_observation");
  const times = {} as VisitTimes;
  for (const name of TIME_NAMES) {
    const instant = value.times[name];
    if (instant === null) times[name] = null;
    else {
      const parsed = normalizedInstant(instant.raw);
      if (parsed.iso !== instant.iso || parsed.epochMs !== instant.epochMs) throw new WorkflowError("invalid_overlap_observation_time");
      times[name] = { ...parsed };
    }
  }
  const source = value.provenance;
  if (source && (source.source !== "hhaexchange" || !["GetVisitInfoV2", "GetVisitInfoV3"].includes(source.operation)
    || source.acceptanceVersion !== scope.acceptanceVersion || source.maxAgeSeconds === null || source.maxAgeSeconds > scope.maxAgeSeconds
    || source.originalValidation !== "source_unvalidated" || source.originalTimezone !== "source_values_unconverted")) throw new WorkflowError("overlap_observation_source_mismatch", 403);
  const provenance = source ? { operation: source.operation, source: "hhaexchange" as const, fetchedAt: timestamp(source.fetchedAt), acceptanceVersion: text(source.acceptanceVersion, 128),
    sourceRevision: fingerprint(source.sourceRevision), maxAgeSeconds: integer(source.maxAgeSeconds, 1, 3600), originalValidation: "source_unvalidated" as const, originalTimezone: "source_values_unconverted" as const } : null;
  return { visitId, scope: { officeId: scope.officeId, date: expectedDate, timezone: scope.timezone, revision: scope.revision }, state: value.state,
    reasons: value.reasons.slice(0, 20).map(reason => text(reason, 128)), raw: null, provenance, times,
    patientId: value.patientId === null ? null : identifier(value.patientId), caregiverId: value.caregiverId === null ? null : identifier(value.caregiverId),
    scheduleType: ["fixed", "variable"].includes(value.scheduleType) ? value.scheduleType : "unknown", variableScheduleAccepted: value.variableScheduleAccepted === true,
    clockingMethod: ["token", "other"].includes(value.clockingMethod) ? value.clockingMethod : "unknown", clockingAttempt: ["present", "none"].includes(value.clockingAttempt) ? value.clockingAttempt : "unknown",
    openState: ["open", "closed"].includes(value.openState) ? value.openState : "unknown", verification: "unknown", serviceTimeBasis: value.serviceTimeBasis === "actual" || value.serviceTimeBasis === "evv" ? value.serviceTimeBasis : null };
}
function usable(visit: NormalizedVisitEvidence | null, scope: OverlapScanScope, now: string): boolean {
  return visit?.state === "ready" && visit.provenance?.acceptanceVersion === scope.acceptanceVersion
    && !!visit.provenance.maxAgeSeconds && fresh(visit.provenance.fetchedAt, { ...scope, maxAgeSeconds: visit.provenance.maxAgeSeconds }, now);
}
function pack(state: Checkpoint): StoredCheckpoint {
  return { ...state, observations: state.observations.map(item => {
    const value = item.evidence;
    return { ...item, evidence: value ? { state: value.state, patientId: value.patientId, caregiverId: value.caregiverId, reasons: value.reasons,
      scheduleType: value.scheduleType, variableScheduleAccepted: value.variableScheduleAccepted, clockingMethod: value.clockingMethod,
      clockingAttempt: value.clockingAttempt, openState: value.openState, serviceTimeBasis: value.serviceTimeBasis,
      times: TIME_NAMES.map(name => value.times[name]?.raw ?? null), provenance: value.provenance ? { operation: value.provenance.operation,
        fetchedAt: value.provenance.fetchedAt, sourceRevision: value.provenance.sourceRevision, maxAgeSeconds: value.provenance.maxAgeSeconds } : null } : null };
  }) };
}
function unpack(value: PackedEvidence, scope: OverlapScanScope, date: string, visitId: string): NormalizedVisitEvidence {
  exact(value, ["state", "patientId", "caregiverId", "reasons", "scheduleType", "variableScheduleAccepted", "clockingMethod", "clockingAttempt", "openState", "serviceTimeBasis", "times", "provenance"]);
  if (!Array.isArray(value.times) || value.times.length !== TIME_NAMES.length || !Array.isArray(value.reasons) || value.reasons.length > 20) throw new WorkflowError("invalid_overlap_checkpoint", 503);
  const times = Object.fromEntries(TIME_NAMES.map((name, index) => [name, value.times[index] === null ? null : normalizedInstant(value.times[index])])) as unknown as VisitTimes;
  if (value.provenance) exact(value.provenance, ["operation", "fetchedAt", "sourceRevision", "maxAgeSeconds"]);
  return compact({ ...value, visitId, scope: { officeId: scope.officeId, date, timezone: scope.timezone, revision: scope.revision }, raw: null, times, verification: "unknown",
    provenance: value.provenance ? { ...value.provenance, source: "hhaexchange", acceptanceVersion: scope.acceptanceVersion,
      originalValidation: "source_unvalidated", originalTimezone: "source_values_unconverted" } : null }, scope, date, visitId);
}
function checkedCheckpoint(value: StoredCheckpoint, scope: OverlapScanScope, id: string): Checkpoint {
  exact(value, ["id", "revision", "updatedAt", "scope", "days", "observations", "discoveryIndex", "detailIndex"]);
  if (value.id !== id || hash(checkedScope(value.scope)) !== hash(scope) || !Array.isArray(value.days) || value.days.length !== 3
    || !Array.isArray(value.observations) || value.observations.length > MAX_OBSERVATIONS) throw new WorkflowError("invalid_overlap_checkpoint", 503);
  integer(value.revision, 1, 1_000_000); timestamp(value.updatedAt); integer(value.discoveryIndex, 0, 2); integer(value.detailIndex, 0, 599);
  const expectedDates = dates(scope.date);
  value.days.forEach((day, index) => {
    exact(day, ["date", "ids", "fetchedAt", "truncated", "error"]);
    if (day.date !== expectedDates[index] || typeof day.truncated !== "boolean" || day.error !== null && !["discovery_failed", "discovery_deferred"].includes(day.error)
      || day.ids !== null && (!Array.isArray(day.ids) || day.ids.length > MAX_IDS_PER_DAY || new Set(day.ids).size !== day.ids.length)) throw new WorkflowError("invalid_overlap_checkpoint", 503);
    day.ids?.forEach(identifier); if (day.fetchedAt !== null) timestamp(day.fetchedAt);
  });
  const seen = new Set<string>();
  const observations: Observation[] = value.observations.map(item => {
    exact(item, ["date", "visitId", "attemptedAt", "evidence", "error"]); timestamp(item.attemptedAt); identifier(item.visitId);
    if (!value.days.some(day => day.date === item.date && day.ids?.includes(item.visitId)) || seen.has(key(item.date, item.visitId))
      || item.error !== null && item.error !== "detail_failed") throw new WorkflowError("invalid_overlap_checkpoint", 503);
    seen.add(key(item.date, item.visitId));
    return { ...item, evidence: item.evidence === null ? null : unpack(item.evidence, scope, item.date, item.visitId) };
  });
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_CHECKPOINT_BYTES) throw new WorkflowError("overlap_checkpoint_too_large", 503);
  return { ...value, observations };
}

export class OverlapScanner {
  constructor(private repository: Repository, private callbacks: OverlapCallbacks, private clock: () => Date = () => new Date()) {}
  async scan(value: OverlapScanScope, options: { actorId: string; maxDetailReads?: number; maxDiscoveryReads?: number }): Promise<OverlapWindow> {
    const scope = checkedScope(value), actor = text(options.actorId, 128), maxDetails = integer(options.maxDetailReads ?? 3, 0, 10), maxDiscoveries = integer(options.maxDiscoveryReads ?? 3, 0, 3);
    const collection = "revisionOverlapWindows_office_" + scope.officeId, id = hash(scope);
    await this.callbacks.checkFence();
    const prior = await this.repository.get<StoredCheckpoint>(collection, id), now = () => this.clock().toISOString();
    const state: Checkpoint = prior ? checkedCheckpoint(structuredClone(prior), scope, id) : { id, revision: 0, updatedAt: now(), scope,
      days: dates(scope.date).map(date => ({ date, ids: null, fetchedAt: null, truncated: false, error: null })), observations: [], discoveryIndex: 0, detailIndex: 0 };
    let discoveryReads = 0, detailReads = 0, deferred = false;
    for (let index = 0; index < maxDiscoveries; index++) {
      if (this.callbacks.canContinue?.() === false) { deferred = true; break; }
      await this.callbacks.checkFence();
      const day = state.days[state.discoveryIndex]!;
      try {
        discoveryReads++;
        const response = await this.callbacks.discover(day.date);
        await this.callbacks.checkFence();
        if (!response || !Array.isArray(response.visitIds) || response.visitIds.length > MAX_IDS_PER_DAY || typeof response.truncated !== "boolean") throw new WorkflowError("invalid_overlap_discovery", 502);
        const ids = [...new Set(response.visitIds.map(identifier))].sort((a, b) => Number(a) - Number(b));
        const fetchedAt = timestamp(response.fetchedAt);
        if (day.ids !== null && hash(day.ids) !== hash(ids)) state.observations = state.observations.filter(item => item.date !== day.date);
        Object.assign(day, { ids, fetchedAt, truncated: response.truncated, error: null });
        state.discoveryIndex = (state.discoveryIndex + 1) % 3;
      } catch (error) {
        if (error instanceof WorkflowError && [403, 409, 423].includes(error.status)) throw error;
        day.error = error instanceof WorkflowError && error.status === 429 ? "discovery_deferred" : "discovery_failed"; deferred = true; break;
      }
    }
    const all = state.days.flatMap(day => (day.ids ?? []).map(visitId => ({ date: day.date, visitId, ids: day.ids! })));
    const observations = new Map(state.observations.map(item => [key(item.date, item.visitId), item]));
    const attempted = new Set<string>();
    for (let count = 0; count < maxDetails && all.length; count++) {
      if (deferred || this.callbacks.canContinue?.() === false) { deferred = true; break; }
      let selected = -1;
      // A failed earlier observation cannot monopolize retries while later IDs remain unseen.
      for (const missingOnly of [true, false]) {
        for (let step = 0; step < all.length; step++) {
          const index = (state.detailIndex + step) % all.length, item = all[index]!, cached = observations.get(key(item.date, item.visitId));
          const day = state.days.find(day => day.date === item.date)!;
          if (!day.error && fresh(day.fetchedAt, scope, now()) && !attempted.has(key(item.date, item.visitId))
            && (!cached || !missingOnly && !usable(cached.evidence, scope, now()))) { selected = index; break; }
        }
        if (selected !== -1) break;
      }
      if (selected === -1) break;
      const item = all[selected]!, itemKey = key(item.date, item.visitId);
      await this.callbacks.checkFence();
      try {
        detailReads++;
        const evidence = compact(await this.callbacks.read(item.visitId, item.date, item.ids), scope, item.date, item.visitId);
        await this.callbacks.checkFence();
        observations.set(itemKey, { date: item.date, visitId: item.visitId, attemptedAt: now(), evidence, error: null });
      } catch (error) {
        if (error instanceof WorkflowError && [403, 409, 423].includes(error.status)) throw error;
        if (error instanceof WorkflowError && error.status === 429) { deferred = true; break; }
        observations.set(itemKey, { date: item.date, visitId: item.visitId, attemptedAt: now(), evidence: null, error: "detail_failed" });
      }
      attempted.add(itemKey); state.detailIndex = (selected + 1) % all.length;
    }
    state.observations = [...observations.values()].sort((a, b) => key(a.date, a.visitId).localeCompare(key(b.date, b.visitId)));
    await this.callbacks.checkFence();
    state.updatedAt = now(); state.revision = (prior?.revision ?? 0) + 1;
    const stored = pack(state);
    if (Buffer.byteLength(JSON.stringify(stored)) > MAX_CHECKPOINT_BYTES) throw new WorkflowError("overlap_checkpoint_too_large", 503);
    // Cache-only readers do not contend with a writer or manufacture an audit change.
    if (discoveryReads || detailReads) await this.repository.change<StoredCheckpoint>(collection, id, prior?.revision ?? 0, actor, "overlap_window_progressed", () => stored);
    await this.callbacks.checkFence();
    const reasons = new Set<string>();
    for (const day of state.days) {
      if (day.ids === null) reasons.add("discovery_pending");
      if (!fresh(day.fetchedAt, scope, now())) reasons.add("discovery_stale");
      if (day.truncated) reasons.add("discovery_truncated");
      if (day.error) reasons.add(day.error);
    }
    if (deferred) reasons.add("scan_deferred");
    for (const item of all) {
      const observation = observations.get(key(item.date, item.visitId));
      if (!observation) reasons.add("details_pending");
      else if (!usable(observation.evidence, scope, now())) reasons.add(observation.error ? "detail_failed" : "detail_stale_or_unaccepted");
    }
    const acceptance = scope.coverageAcceptance;
    if (!acceptance || normalizedInstant(acceptance.validUntil).epochMs <= this.clock().getTime()) reasons.add("coverage_policy_unaccepted");
    const evidence = state.observations.flatMap(item => item.evidence ? [item.evidence] : []), observed = evidence.filter(item => usable(item, scope, now()));
    const oldest = observed.map(item => item.provenance!.fetchedAt).sort()[0] ?? null;
    const expirations = state.days.flatMap(day => day.fetchedAt ? [normalizedInstant(day.fetchedAt).epochMs + scope.maxAgeSeconds * 1000] : []);
    for (const visit of observed) expirations.push(normalizedInstant(visit.provenance!.fetchedAt).epochMs + visit.provenance!.maxAgeSeconds! * 1000);
    if (acceptance) expirations.push(normalizedInstant(acceptance.validUntil).epochMs);
    return { scope, observations: evidence, discovery: state.days.map(day => ({ date: day.date, visitIds: day.ids ?? [], fetchedAt: day.fetchedAt })),
      coverage: { complete: reasons.size === 0, reasons: [...reasons].sort(), dates: dates(scope.date), discoveredCount: all.length,
      observedCount: observed.length, detailReads, discoveryReads, candidateLimit: OVERLAP_CANDIDATE_LIMIT, oldestObservationAt: oldest,
      freshUntil: expirations.length ? new Date(Math.min(...expirations)).toISOString() : null } };
  }
}

function localDate(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}
function interval(visit: NormalizedVisitEvidence) {
  return visit.serviceTimeBasis === "actual" ? [visit.times.actualStart, visit.times.actualEnd] as const : visit.serviceTimeBasis === "evv" ? [visit.times.evvStart, visit.times.evvEnd] as const : [null, null] as const;
}
function checkedAllowances(profiles: readonly ReviewedOverlapAllowance[], officeId: string): ReviewedOverlapAllowance[] {
  if (!Array.isArray(profiles) || profiles.length > 100) throw new WorkflowError("overlap_allowance_limit");
  const allowances = profiles.map(validateReviewedOverlapAllowance);
  if (allowances.some(profile => profile.officeId !== officeId)) throw new WorkflowError("overlap_allowance_scope_mismatch", 403);
  return allowances;
}
function candidateFromProfiles(anchor: NormalizedVisitEvidence, peer: NormalizedVisitEvidence, now: string, profiles: readonly ReviewedOverlapAllowance[]): OverlapCandidate {
  validEvidenceScope(anchor.scope); validEvidenceScope(peer.scope); identifier(anchor.visitId); identifier(peer.visitId);
  const at = normalizedInstant(now).epochMs;
  if (anchor.visitId === peer.visitId || anchor.scope.officeId !== peer.scope.officeId || anchor.scope.timezone !== peer.scope.timezone || anchor.scope.revision !== peer.scope.revision
    || Math.abs(Date.parse(anchor.scope.date) - Date.parse(peer.scope.date)) > DAY) throw new WorkflowError("overlap_candidate_scope_mismatch", 403);
  const accepted = (visit: NormalizedVisitEvidence) => {
    const provenance = visit.provenance;
    try { return visit.state === "ready" && provenance?.source === "hhaexchange" && !!provenance.acceptanceVersion && !!provenance.maxAgeSeconds
      && evidenceIsFresh(provenance.fetchedAt, now, provenance.maxAgeSeconds); } catch { return false; }
  };
  if (!accepted(anchor) || !accepted(peer) || anchor.provenance?.acceptanceVersion !== peer.provenance?.acceptanceVersion) return { visit: peer, allowance: "unknown", policyReference: null };
  const matching = profiles.filter(profile => normalizedInstant(profile.reviewedAt).epochMs <= at && normalizedInstant(profile.validUntil).epochMs > at
    && ((profile.visitId === anchor.visitId && profile.visitDate === anchor.scope.date && profile.sourceRevision === anchor.provenance?.sourceRevision
      && profile.relatedVisitId === peer.visitId && profile.relatedDate === peer.scope.date && profile.relatedSourceRevision === peer.provenance?.sourceRevision)
      || (profile.relatedVisitId === anchor.visitId && profile.relatedDate === anchor.scope.date && profile.relatedSourceRevision === anchor.provenance?.sourceRevision
        && profile.visitId === peer.visitId && profile.visitDate === peer.scope.date && profile.sourceRevision === peer.provenance?.sourceRevision)));
  const decision = matching.length === 1 ? matching[0]! : null;
  return { visit: peer, allowance: decision?.decision ?? "unknown", policyReference: decision?.reference ?? null };
}
/** Exact-pair allowance after fresh server rechecks; this does not assert discovery completeness. */
export function reviewedOverlapCandidate(anchor: NormalizedVisitEvidence, peer: NormalizedVisitEvidence, now: string, profiles: readonly ReviewedOverlapAllowance[] = []): OverlapCandidate {
  return candidateFromProfiles(anchor, peer, now, checkedAllowances(profiles, anchor.scope.officeId));
}
/** Pure per-anchor view over the same office/date cache; no source or repository calls. */
export function overlapContext(window: OverlapWindow, anchor: NormalizedVisitEvidence, now: string, profiles: readonly ReviewedOverlapAllowance[] = []) {
  const scope = checkedScope(window.scope), at = normalizedInstant(now).epochMs, reasons = new Set(window.coverage.reasons);
  if (anchor.scope.officeId !== scope.officeId || anchor.scope.timezone !== scope.timezone || anchor.scope.revision !== scope.revision || !dates(scope.date).includes(anchor.scope.date)) throw new WorkflowError("overlap_anchor_scope_mismatch", 403);
  const accepted = usable(anchor, scope, now), overlaps: OverlapCandidate[] = [];
  if (!accepted) reasons.add("anchor_unaccepted_or_stale");
  if (!anchor.patientId || !anchor.caregiverId) reasons.add("relationship_incomplete");
  const cachedAnchor = window.observations.find(visit => visit.visitId === anchor.visitId && visit.scope.date === anchor.scope.date);
  const anchorConsistent = !cachedAnchor || cachedAnchor.provenance?.sourceRevision === anchor.provenance?.sourceRevision;
  if (!anchorConsistent) reasons.add("anchor_observation_changed");
  if (!window.discovery.some(day => day.date === anchor.scope.date && day.visitIds.includes(anchor.visitId))) reasons.add("anchor_not_discovered");
  if (!window.coverage.freshUntil || normalizedInstant(window.coverage.freshUntil).epochMs < at) reasons.add("coverage_window_stale");
  const [start, end] = interval(anchor), acceptance = scope.coverageAcceptance;
  const boundedInterval = (visit: NormalizedVisitEvidence) => {
    const [from, to] = interval(visit);
    if (!from || !to || to.epochMs < from.epochMs) { reasons.add("service_interval_incomplete"); return; }
    if (!acceptance || (to.epochMs - from.epochMs) / 60000 > acceptance.maxVisitDurationMinutes) reasons.add("maximum_duration_not_established");
    if (localDate(from.iso, scope.timezone) !== visit.scope.date || Date.parse(localDate(to.iso, scope.timezone)) - Date.parse(visit.scope.date) > DAY) reasons.add("service_date_semantics_not_established");
  };
  boundedInterval(anchor);
  const allowances = checkedAllowances(profiles, scope.officeId);
  for (const peer of window.observations) {
    if (peer.scope.officeId !== scope.officeId || peer.scope.timezone !== scope.timezone || peer.scope.revision !== scope.revision || !dates(scope.date).includes(peer.scope.date)) throw new WorkflowError("overlap_observation_scope_mismatch", 403);
    if (!usable(peer, scope, now)) { reasons.add("detail_stale_or_unaccepted"); continue; }
    // Bounds and relationship completeness constrain the whole discovered
    // universe, including an observation that currently appears unrelated.
    if (!peer.patientId || !peer.caregiverId) reasons.add("relationship_incomplete");
    boundedInterval(peer);
    if (peer.visitId === anchor.visitId) continue;
    const related = !!anchor.patientId && peer.patientId === anchor.patientId || !!anchor.caregiverId && peer.caregiverId === anchor.caregiverId;
    if (!related) continue;
    const [peerStart, peerEnd] = interval(peer);
    if (start && end && peerStart && peerEnd && Math.min(end.epochMs, peerEnd.epochMs) <= Math.max(start.epochMs, peerStart.epochMs)) continue;
    const candidate = candidateFromProfiles(anchor, peer, now, allowances);
    overlaps.push(accepted && anchorConsistent ? candidate : { visit: peer, allowance: "unknown", policyReference: null });
  }
  if (overlaps.length > OVERLAP_CANDIDATE_LIMIT) reasons.add("candidate_limit_reached");
  if (!acceptance || normalizedInstant(acceptance.validUntil).epochMs <= at) reasons.add("coverage_policy_unaccepted");
  return { overlaps: overlaps.slice(0, OVERLAP_CANDIDATE_LIMIT), overlapWindowComplete: window.coverage.complete && reasons.size === 0,
    coverage: { ...window.coverage, complete: window.coverage.complete && reasons.size === 0, reasons: [...reasons].sort(), candidateCount: overlaps.length } };
}
