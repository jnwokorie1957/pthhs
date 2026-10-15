import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowError, type OperationalRead } from "../operations/reads.js";
import type { Versioned } from "../operations/workspace.js";
import { adaptVisitEvidence, type NormalizedVisitEvidence } from "./evidence.js";
import { OverlapScanner, overlapContext, reviewedOverlapCandidate, validateOverlapCoverageAcceptance, validateReviewedOverlapAllowance,
  type OverlapCoverageAcceptance, type OverlapDiscovery, type OverlapScanScope, type ReviewedOverlapAllowance } from "./overlap.js";

const NOW = "2026-10-12T17:00:00.000Z", serviceDate = "2026-10-10";
const coverage: OverlapCoverageAcceptance = { officeId: "123", timezone: "America/Chicago", sourceAcceptanceVersion: "synthetic-v1", reference: "Synthetic bounded start-date discovery review",
  validUntil: "2027-01-01T00:00:00.000Z", maxVisitDurationMinutes: 1440, serviceDateSemantics: "service_interval_start_office_date", adjacentDatesCoverMaximumDuration: true };
const scope: OverlapScanScope = { officeId: "123", date: serviceDate, timezone: "America/Chicago", revision: 2, fence: "a".repeat(64), acceptanceVersion: "synthetic-v1", maxAgeSeconds: 3600, coverageAcceptance: coverage };
class MemoryRepository {
  records = new Map<string, Versioned>(); changes: { collection: string; actor: string; action: string }[] = [];
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> { return structuredClone(this.records.get(collection + "/" + id) as T ?? null); }
  async change<T extends Versioned>(collection: string, id: string, revision: number, actor: string, action: string, update: (prior: T | null) => T): Promise<T> {
    const key = collection + "/" + id, prior = this.records.get(key) as T ?? null;
    if ((prior?.revision ?? 0) !== revision) throw new WorkflowError("revision_conflict", 409);
    const next = update(structuredClone(prior)); this.records.set(key, structuredClone(next)); this.changes.push({ collection, actor, action }); return structuredClone(next);
  }
}
function evidence(visitId: string, date = serviceDate, fields: Record<string, string | null> = {}, fetchedAt = NOW): NormalizedVisitEvidence {
  const evidenceScope = { officeId: scope.officeId, date, timezone: scope.timezone, revision: scope.revision };
  const source: OperationalRead = { operation: "GetVisitInfoV3", source: "hhaexchange", fetchedAt, truncated: false, validation: "source_unvalidated", timezone: "source_values_unconverted",
    records: [{ ID: visitId, OfficeID: scope.officeId, VisitDate: date, "Patient/ID": "5", "Caregiver/ID": "6", VisitType: "synthetic-fixed",
      ScheduleStartTime: date + "T08:00:00-05:00", ScheduleEndTime: date + "T09:00:00-05:00",
      VisitStartTime: date + "T08:00:00-05:00", VisitEndTime: date + "T09:00:00-05:00", EVVStartTime: date + "T08:00:00-05:00", EVVEndTime: date + "T09:00:00-05:00", ...fields }] };
  return adaptVisitEvidence(source, { scope: evidenceScope, visitId, now: fetchedAt, scheduleType: "fixed",
    acceptance: { operation: "GetVisitInfoV3", version: scope.acceptanceVersion, accepted: true, complete: true, scope: evidenceScope, visitIds: [visitId], maxAgeSeconds: scope.maxAgeSeconds, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" } });
}
function fixture(ids: Record<string, string[]> = { [serviceDate]: ["77", "78"] }) {
  const repo = new MemoryRepository(), discoveries: string[] = [], reads: { id: string; date: string }[] = [];
  let clock = new Date(NOW), permitted = true, fenceOk = true;
  let discover = async (date: string): Promise<OverlapDiscovery> => ({ visitIds: ids[date] ?? [], fetchedAt: clock.toISOString(), truncated: false });
  let read = async (id: string, date: string): Promise<NormalizedVisitEvidence> => evidence(id, date, {}, clock.toISOString());
  const scanner = new OverlapScanner(repo, { discover: async date => { discoveries.push(date); return discover(date); }, read: async (id, date, known) => {
    assert.ok(known.includes(id)); reads.push({ id, date }); return read(id, date);
  }, checkFence: async () => { if (!fenceOk) throw new WorkflowError("revision_policy_changed_restart", 409); }, canContinue: () => permitted }, () => clock);
  return { repo, scanner, ids, discoveries, reads, now: () => clock.toISOString(), setClock: (value: string) => { clock = new Date(value); },
    setDiscover: (fn: typeof discover) => { discover = fn; }, setRead: (fn: typeof read) => { read = fn; }, setPermitted: (value: boolean) => { permitted = value; }, setFence: (value: boolean) => { fenceOk = value; } };
}
const options = { actorId: "synthetic-supervisor", maxDetailReads: 3, maxDiscoveryReads: 3 };

test("bounded resumptions traverse all discovered ID pages and retain cross-page observations", async () => {
  const ids = Array.from({ length: 14 }, (_, index) => String(77 + index)), f = fixture({ [serviceDate]: ids });
  let window = await f.scanner.scan(scope, { ...options, maxDetailReads: 2 });
  assert.equal(window.coverage.complete, false); assert.equal(window.coverage.observedCount, 2);
  for (let run = 1; run < 7; run++) window = await f.scanner.scan(scope, { ...options, maxDetailReads: 2 });
  assert.equal(window.coverage.complete, true); assert.equal(window.coverage.observedCount, 14); assert.equal(window.coverage.discoveredCount, 14);
  assert.deepEqual(f.reads.map(item => item.id), ids); assert.equal(new Set(f.reads.map(item => item.id)).size, ids.length);
  const result = overlapContext(window, evidence("77"), f.now());
  assert.equal(result.overlapWindowComplete, true); assert.equal(result.overlaps.length, 13); assert.ok(result.overlaps.some(item => item.visit.visitId === "90"));
  assert.ok(result.overlaps.every(item => item.allowance === "unknown" && item.policyReference === null));
  assert.ok(window.observations.every(item => item.raw === null && !Object.hasOwn(item, "verificationReceipt") && item.verification === "unknown"));
  assert.ok(Buffer.byteLength(JSON.stringify([...f.repo.records.values()][0])) < 750000);
});

test("previous and following service dates expose real overnight intersections without rewriting peer dates", async () => {
  const f = fixture({ [serviceDate]: ["77", "78"], "2026-10-09": ["1"], "2026-10-11": ["2"] });
  const rows = new Map<string, NormalizedVisitEvidence>([
    ["77", evidence("77", serviceDate, { ScheduleStartTime: serviceDate + "T00:00:00-05:00", ScheduleEndTime: serviceDate + "T01:00:00-05:00", VisitStartTime: serviceDate + "T00:00:00-05:00", VisitEndTime: serviceDate + "T01:00:00-05:00" })],
    ["78", evidence("78", serviceDate, { ScheduleStartTime: serviceDate + "T23:30:00-05:00", ScheduleEndTime: "2026-10-11T00:30:00-05:00", VisitStartTime: serviceDate + "T23:30:00-05:00", VisitEndTime: "2026-10-11T00:30:00-05:00" })],
    ["1", evidence("1", "2026-10-09", { ScheduleStartTime: "2026-10-09T23:30:00-05:00", ScheduleEndTime: serviceDate + "T00:30:00-05:00", VisitStartTime: "2026-10-09T23:30:00-05:00", VisitEndTime: serviceDate + "T00:30:00-05:00" })],
    ["2", evidence("2", "2026-10-11", { ScheduleStartTime: "2026-10-11T00:00:00-05:00", ScheduleEndTime: "2026-10-11T01:00:00-05:00", VisitStartTime: "2026-10-11T00:00:00-05:00", VisitEndTime: "2026-10-11T01:00:00-05:00" })]
  ]);
  f.setRead(async id => rows.get(id)!);
  const window = await f.scanner.scan(scope, { ...options, maxDetailReads: 10 });
  const early = overlapContext(window, rows.get("77")!, f.now()), late = overlapContext(window, rows.get("78")!, f.now());
  assert.deepEqual(early.overlaps.map(item => [item.visit.visitId, item.visit.scope.date]), [["1", "2026-10-09"]]);
  assert.deepEqual(late.overlaps.map(item => [item.visit.visitId, item.visit.scope.date]), [["2", "2026-10-11"]]);
  assert.equal(early.overlapWindowComplete, true); assert.equal(late.overlapWindowComplete, true);
});

test("all anchors share the same compact checkpoint and cache-only reads perform no source calls or writes", async () => {
  const f = fixture(), window = await f.scanner.scan(scope, options), before = [f.reads.length, f.discoveries.length, f.repo.changes.length];
  assert.equal(overlapContext(window, evidence("77"), f.now()).overlaps[0]!.visit.visitId, "78");
  assert.equal(overlapContext(window, evidence("78"), f.now()).overlaps[0]!.visit.visitId, "77");
  const cached = await f.scanner.scan(scope, { ...options, maxDetailReads: 0, maxDiscoveryReads: 0 });
  assert.equal(cached.coverage.complete, true); assert.deepEqual([f.reads.length, f.discoveries.length, f.repo.changes.length], before);
  assert.equal(f.repo.records.size, 1); assert.ok(f.repo.changes.every(change => change.collection === "revisionOverlapWindows_office_123"));
});

test("truncated, failed and stale discovery never proves a complete overlap window", async () => {
  const f = fixture();
  f.setDiscover(async date => ({ visitIds: f.ids[date] ?? [], fetchedAt: f.now(), truncated: date === serviceDate }));
  const truncated = await f.scanner.scan(scope, options); assert.equal(truncated.coverage.complete, false); assert.ok(truncated.coverage.reasons.includes("discovery_truncated"));
  f.setDiscover(async () => { throw new WorkflowError("synthetic_source_failed", 502); });
  const failed = await f.scanner.scan(scope, options); assert.equal(failed.coverage.complete, false); assert.ok(failed.coverage.reasons.includes("discovery_failed"));
  f.setClock("2026-10-12T18:00:00.001Z");
  const stale = await f.scanner.scan(scope, { ...options, maxDetailReads: 0, maxDiscoveryReads: 0 });
  assert.equal(stale.coverage.complete, false); assert.ok(stale.coverage.reasons.includes("discovery_stale"));
  assert.equal(overlapContext(stale, evidence("77", serviceDate, {}, f.now()), f.now()).overlapWindowComplete, false);
});

test("changed discovery removes that day's prior observations and requires new IDs to be read", async () => {
  const f = fixture({ [serviceDate]: ["77", "78"], "2026-10-09": ["1"] });
  await f.scanner.scan(scope, options); f.ids[serviceDate] = ["77", "79"];
  const pending = await f.scanner.scan(scope, { ...options, maxDetailReads: 0 });
  assert.equal(pending.coverage.complete, false); assert.deepEqual(pending.observations.map(item => item.visitId), ["1"]);
  const refreshed = await f.scanner.scan(scope, options);
  assert.equal(refreshed.coverage.complete, true); assert.deepEqual(refreshed.observations.map(item => item.visitId).sort(), ["1", "77", "79"]);
  assert.equal(f.reads.filter(item => item.id === "1").length, 1);
});

test("failed detail retries do not starve unseen visits and deferred queries do not advance unattempted IDs", async () => {
  const f = fixture({ [serviceDate]: ["77", "78", "79"] });
  f.setRead(async id => { if (id === "77") throw new WorkflowError("synthetic_read_failed", 503); return evidence(id); });
  const first = await f.scanner.scan(scope, { ...options, maxDetailReads: 1 }); assert.ok(first.coverage.reasons.includes("detail_failed"));
  await f.scanner.scan(scope, { ...options, maxDetailReads: 1 }); await f.scanner.scan(scope, { ...options, maxDetailReads: 1 });
  assert.deepEqual(f.reads.map(item => item.id), ["77", "78", "79"]);
  f.setRead(async () => { throw new WorkflowError("synthetic_budget_deferred", 429); });
  const deferred = await f.scanner.scan(scope, options); assert.equal(deferred.coverage.complete, false); assert.ok(deferred.coverage.reasons.includes("scan_deferred"));
  f.setRead(async id => evidence(id)); await f.scanner.scan(scope, { ...options, maxDetailReads: 1 });
  assert.deepEqual(f.reads.slice(-2).map(item => item.id), ["77", "77"]);
});

test("closed request budget performs no discovery or detail calls and leaves progress for retry", async () => {
  const f = fixture(); f.setPermitted(false);
  const window = await f.scanner.scan(scope, options);
  assert.equal(window.coverage.complete, false); assert.equal(f.reads.length, 0); assert.equal(f.discoveries.length, 0); assert.equal(f.repo.records.size, 0);
  f.setPermitted(true); const retry = await f.scanner.scan(scope, options); assert.equal(retry.coverage.complete, true);
});

test("source/policy scope changes fence both pending source observations and checkpoint writes", async () => {
  const f = fixture(); f.setRead(async id => { f.setFence(false); return evidence(id); });
  await assert.rejects(f.scanner.scan(scope, options), /revision_policy_changed_restart/);
  assert.equal(f.repo.records.size, 0);
  const g = fixture(); g.setRead(async id => ({ ...evidence(id), scope: { ...evidence(id).scope, officeId: "124" } }));
  await assert.rejects(g.scanner.scan(scope, options), /overlap_observation_scope_mismatch/); assert.equal(g.repo.records.size, 0);
});

test("fresh anchors cannot turn an expired cached snapshot or missing coverage policy into no-overlap proof", async () => {
  const f = fixture(), window = await f.scanner.scan(scope, options);
  const later = "2026-10-12T18:00:00.001Z";
  assert.equal(overlapContext(window, evidence("77", serviceDate, {}, later), later).overlapWindowComplete, false);
  const missing = await f.scanner.scan({ ...scope, coverageAcceptance: null }, options);
  assert.equal(missing.coverage.complete, false); assert.ok(missing.coverage.reasons.includes("coverage_policy_unaccepted"));
  assert.equal(overlapContext(missing, evidence("77"), NOW).overlaps.length, 1);
  assert.equal(overlapContext(window, evidence("99"), NOW).overlapWindowComplete, false);
});

function allowance(anchor: NormalizedVisitEvidence, peer: NormalizedVisitEvidence): ReviewedOverlapAllowance {
  return { officeId: "123", visitId: anchor.visitId, visitDate: anchor.scope.date, sourceRevision: anchor.provenance!.sourceRevision,
    relatedVisitId: peer.visitId, relatedDate: peer.scope.date, relatedSourceRevision: peer.provenance!.sourceRevision, decision: "allowed", reference: "Synthetic exact-pair program review", reviewedBy: "synthetic-reviewer",
    reviewedAt: "2026-10-12T16:00:00Z", validUntil: "2026-10-12T18:00:00Z" };
}
test("only one current exact-pair source-hash allowance can change the default unknown decision", async () => {
  const f = fixture(), window = await f.scanner.scan(scope, options), a = evidence("77"), b = evidence("78"), profile = allowance(a, b);
  assert.equal(overlapContext(window, a, NOW, [profile]).overlaps[0]!.allowance, "allowed");
  assert.equal(overlapContext(window, b, NOW, [profile]).overlaps[0]!.allowance, "allowed");
  for (const altered of [{ ...profile, sourceRevision: "b".repeat(64) }, { ...profile, validUntil: "2026-10-12T16:30:00Z" }, { ...profile, relatedVisitId: "79" }])
    assert.equal(overlapContext(window, a, NOW, [altered]).overlaps[0]!.allowance, "unknown");
  assert.equal(overlapContext(window, a, NOW, [profile, { ...profile, decision: "conflict" }]).overlaps[0]!.allowance, "unknown");
  assert.throws(() => overlapContext(window, a, NOW, [{ ...profile, officeId: "124" }]), /overlap_allowance_scope_mismatch/);
});

test("candidate caps and interval/maximum-duration gaps retain positive facts without claiming full coverage", async () => {
  const f = fixture({ [serviceDate]: Array.from({ length: 23 }, (_, index) => String(77 + index)) });
  let window = await f.scanner.scan(scope, { ...options, maxDetailReads: 10 });
  for (let run = 0; run < 2; run++) window = await f.scanner.scan(scope, { ...options, maxDetailReads: 10 });
  const context = overlapContext(window, evidence("77"), NOW);
  assert.equal(context.overlaps.length, 20); assert.equal(context.coverage.candidateCount, 22); assert.equal(context.overlapWindowComplete, false);
  assert.ok(context.coverage.reasons.includes("candidate_limit_reached"));
  const missing = evidence("77", serviceDate, { VisitEndTime: null });
  assert.equal(overlapContext(window, missing, NOW).overlapWindowComplete, false);
  const narrow = { ...window, scope: { ...scope, coverageAcceptance: { ...coverage, maxVisitDurationMinutes: 30 } } };
  assert.ok(overlapContext(narrow, evidence("77"), NOW).coverage.reasons.includes("maximum_duration_not_established"));
});

test("profile, scope, paging and inherited arbitrary fields are rejected before unbounded source access", async () => {
  for (const value of [{ ...coverage, extra: true }, { ...coverage, maxVisitDurationMinutes: 1441 }, { ...coverage, adjacentDatesCoverMaximumDuration: false }, Object.create(coverage)])
    assert.throws(() => validateOverlapCoverageAcceptance(value));
  const profile = allowance(evidence("77"), evidence("78"));
  assert.throws(() => validateReviewedOverlapAllowance({ ...profile, collection: "workspaceSettings" }));
  assert.throws(() => validateReviewedOverlapAllowance({ ...profile, reference: "x".repeat(501) }));
  const f = fixture();
  await assert.rejects(f.scanner.scan({ ...scope, officeId: "../other" }, options));
  await assert.rejects(f.scanner.scan(scope, { ...options, maxDetailReads: 11 }));
  assert.equal(f.reads.length, 0); assert.equal(f.discoveries.length, 0);
});

test("malformed or oversized persisted cache cannot authorize source reads", async () => {
  const f = fixture(); await f.scanner.scan(scope, options);
  const [id, record] = [...f.repo.records.entries()][0]!;
  f.repo.records.set(id, Object.assign({}, record, { injectedCollection: "workspaceSettings" }));
  await assert.rejects(f.scanner.scan(scope, options), /invalid_overlap_record/);
  assert.equal(f.reads.length, 2); assert.equal(f.discoveries.length, 3);
});

test("a missing caregiver or interval/duration bound on any office observation prevents complete coverage", async () => {
  for (const fields of [{ "Caregiver/ID": null, "Patient/ID": "9" }, { "Patient/ID": "9", "Caregiver/ID": "10", VisitEndTime: null },
    { "Patient/ID": "9", "Caregiver/ID": "10", VisitStartTime: "2026-10-10T07:00:00-05:00", VisitEndTime: "2026-10-11T10:00:00-05:00" }]) {
    const f = fixture(); f.setRead(async id => evidence(id, serviceDate, id === "78" ? fields : {}));
    const window = await f.scanner.scan(scope, options), result = overlapContext(window, evidence("77"), NOW);
    assert.equal(result.overlapWindowComplete, false); assert.equal(result.overlaps.length, 0);
    assert.ok(result.coverage.reasons.some(reason => ["relationship_incomplete", "service_interval_incomplete", "maximum_duration_not_established"].includes(reason)));
  }
});

test("an expired discovery snapshot cannot authorize another detail request without revalidation", async () => {
  const f = fixture(); await f.scanner.scan(scope, { ...options, maxDetailReads: 1 });
  f.setClock("2026-10-12T18:00:00.001Z"); const before = f.reads.length;
  const window = await f.scanner.scan(scope, { ...options, maxDiscoveryReads: 0 });
  assert.equal(f.reads.length, before); assert.equal(window.coverage.complete, false);
  await f.scanner.scan(scope, options); assert.ok(f.reads.length > before);
});

test("a newly observed anchor revision invalidates prior coverage and its old exact-pair allowance", async () => {
  const f = fixture(), anchor = evidence("77"), peer = evidence("78");
  f.setRead(async id => evidence(id, serviceDate, id === "77" ? { VisitEndTime: serviceDate + "T09:30:00-05:00" } : {}));
  const window = await f.scanner.scan(scope, options), result = overlapContext(window, anchor, NOW, [allowance(anchor, peer)]);
  assert.equal(result.overlapWindowComplete, false); assert.ok(result.coverage.reasons.includes("anchor_observation_changed"));
  assert.equal(result.overlaps[0]!.allowance, "unknown");
});

test("the maximum 600 compact observations fit below the guarded Firestore document size", async t => {
  const ids = Array.from({ length: 200 }, (_, index) => String(1000 + index));
  const f = fixture({ [serviceDate]: ids, "2026-10-09": ids.map(id => String(Number(id) + 200)), "2026-10-11": ids.map(id => String(Number(id) + 400)) });
  let window = await f.scanner.scan(scope, { ...options, maxDetailReads: 10 });
  for (let run = 1; run < 60; run++) window = await f.scanner.scan(scope, { ...options, maxDetailReads: 10 });
  assert.equal(window.coverage.observedCount, 600); assert.equal(window.coverage.complete, true); assert.equal(f.reads.length, 600);
  const bytes = Buffer.byteLength(JSON.stringify([...f.repo.records.values()][0]));
  assert.ok(bytes < 750000); t.diagnostic(`600-observation checkpoint: ${bytes} JSON bytes`);
});

test("fresh pair replay honors exact allowances symmetrically and never infers discovery completeness", () => {
  const a = evidence("77"), b = evidence("78"), profile = allowance(a, b);
  assert.equal(reviewedOverlapCandidate(a, b, NOW, [profile]).allowance, "allowed");
  assert.equal(reviewedOverlapCandidate(b, a, NOW, [profile]).policyReference, profile.reference);
  assert.equal(reviewedOverlapCandidate(a, b, NOW, [{ ...profile, decision: "conflict" }]).allowance, "conflict");
  assert.equal(Object.hasOwn(reviewedOverlapCandidate(a, b, NOW, [profile]), "overlapWindowComplete"), false);
  assert.equal(reviewedOverlapCandidate(a, b, profile.validUntil, [profile]).allowance, "unknown");
  for (const change of [{ relatedSourceRevision: "b".repeat(64) }, { sourceRevision: "b".repeat(64) }, { visitDate: "2026-10-09" }, { relatedDate: "2026-10-09" }, { reviewedAt: "2026-10-12T17:00:00.001Z" }])
    assert.equal(reviewedOverlapCandidate(a, b, NOW, [{ ...profile, ...change }]).allowance, "unknown");
  assert.equal(reviewedOverlapCandidate(a, { ...b, state: "stale" }, NOW, [profile]).allowance, "unknown");
  assert.throws(() => reviewedOverlapCandidate(a, { ...b, scope: { ...b.scope, officeId: "124" } }, NOW, [profile]), /overlap_candidate_scope_mismatch/);
});
