import assert from "node:assert/strict";
import test from "node:test";
import { MaintenanceService, maintenanceRoute } from "./service.js";
import type { MaintenanceCase } from "./service.js";
import type { Versioned } from "../operations/workspace.js";
import { WorkflowError } from "../operations/reads.js";

const date = "2026-11-05", actor = { uid: "synthetic-admin", roles: ["admin"] };
const row = { id: "15", patientId: "25", caregiverId: "35", scheduledStart: date + " 09:00", scheduledEnd: date + " 12:00",
  actualStart: date + " 08:57", actualEnd: null, evvStart: date + " 08:57", evvEnd: null, state: "source_unvalidated",
  error: null, detailFetchedAt: date + "T15:00:00.000Z", officeCheckedAt: date + "T15:00:01.000Z" } as const;
const input = { date, visitId: "15", revision: 0, sourceReceipt: row.detailFetchedAt, status: "in_review", queue: "administrator", followUpAt: null, note: "Synthetic source review; no HHA action.", proposalKind: "investigate", selectedCallIds: [] };
function fixture() {
  const records = new Map<string, Versioned>();
  let writes = 0, callReads = 0, afterDay: (() => void) | null = null;
  const current = { dataApproved: true, settings: { officeId: "123", revision: 1, enabledReads: ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics", "GetCallDashBoardData"] } };
  const day = { ok: true, scope: { officeId: "123", date, timezone: "America/Chicago" }, items: [structuredClone(row)], officeDayCache: { stale: false } };
  const calls = { records: [{ CallDashboardID: "45", CallTime: date + " 08:57", CallType: "source-type", CallStatus: "source-status" }],
    scope: { officeId: "123", date, visitId: "15", patientId: "25", caregiverId: "35" }, fetchedAt: date + "T15:03:00.000Z", membershipCheckedAt: date + "T15:02:59.000Z", truncated: false };
  const repository = {
    async get<T extends Versioned>(collection: string, id: string) { return structuredClone(records.get(collection + "/" + id) as T ?? null); },
    async page<T extends Versioned>(collection: string) { return { items: [...records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, value]) => structuredClone(value) as T), nextCursor: null }; },
    async change<T extends Versioned>(collection: string, id: string, revision: number, _actor: string, _action: string, update: (prior: T | null) => T) {
      const key = collection + "/" + id, prior = records.get(key) as T ?? null;
      if ((prior?.revision ?? 0) !== revision) throw new WorkflowError("revision_conflict", 409);
      const value = update(structuredClone(prior)); records.set(key, structuredClone(value)); writes++; return structuredClone(value);
    }
  };
  const service = new MaintenanceService(repository, { settings: async () => structuredClone(current) } as never,
    (async () => { afterDay?.(); return structuredClone(day); }) as never,
    (async () => { callReads++; return structuredClone(calls); }) as never, () => new Date(date + "T16:00:00.000Z"));
  return { service, current, day, calls, records, counts: () => ({ writes, callReads }), afterDay(value: () => void) { afterDay = value; } };
}
test("maintenance saves one durable local case per office/day/visit, with immutable first receipt and revision conflicts", async () => {
  const f = fixture(), first = await f.service.save(input, actor.uid);
  assert.equal(first.item.revision, 1); assert.equal(first.item.hhaSubmission, "not_submitted"); assert.equal(first.hhaWritesEnabled, false);
  assert.deepEqual(first.item.initialSource, row); assert.equal(first.item.events[0]?.actor, actor.uid);
  await assert.rejects(f.service.save(input, actor.uid), /revision_conflict/);
  const next = await f.service.save({ ...input, revision: 1, status: "needs_attention", queue: "supervisor", note: "Synthetic next step: inspect actual calls." }, actor.uid);
  assert.equal(next.item.id, first.item.id); assert.equal(next.item.events.length, 2); assert.deepEqual(next.item.initialSource, row);
  assert.equal(f.records.size, 1); assert.deepEqual(f.counts(), { writes: 2, callReads: 0 });
});
test("source facts and arbitrary clock/reason/approval fields cannot be injected", async () => {
  const f = fixture();
  for (const field of ["actualStart", "evvEnd", "source", "approved", "hhaSubmission", "reasonCode", "officeId"]) await assert.rejects(f.service.save({ ...input, [field]: "injected" }, actor.uid), /invalid_maintenance_request/);
  await assert.rejects(f.service.save({ ...input, note: " " }, actor.uid), /maintenance_note_required/);
  await assert.rejects(f.service.save({ ...input, status: "hha_confirmed" }, actor.uid), /invalid_maintenance_choice/);
  assert.deepEqual(f.counts(), { writes: 0, callReads: 0 });
});
test("stale, missing, failed and different-scope source rows cannot create cases", async () => {
  for (const change of [f => { f.day.officeDayCache.stale = true; }, f => { f.day.items = []; },
    f => { f.day.scope.officeId = "456"; }, f => { (f.day.items[0] as unknown as { state: string }).state = "unavailable"; } ] as ((f: ReturnType<typeof fixture>) => void)[]) {
    const f = fixture(); change(f); await assert.rejects(f.service.save(input, actor.uid), /maintenance_source_(?:stale|unavailable)/); assert.equal(f.counts().writes, 0);
  }
});
test("revoked release, changed office/read settings and malformed dates block work without HHA dispatch", async () => {
  const f = fixture(); f.current.dataApproved = false;
  await assert.rejects(f.service.cases({ date }), /operational_data_release_not_approved/);
  f.current.dataApproved = true; f.current.settings.enabledReads = [];
  await assert.rejects(f.service.save(input, actor.uid), /visit_reads_not_owner_enabled/);
  const g = fixture(); g.afterDay(() => { g.current.settings.revision++; });
  await assert.rejects(g.service.save(input, actor.uid), /office_policy_changed_restart/); assert.equal(g.counts().writes, 0);
  await assert.rejects(fixture().service.cases({ date: "2026-02-30" }), /invalid_date/);
});
test("a source receipt changed since browser inspection cannot silently become a new proposal", async () => {
  const f = fixture(); await assert.rejects(f.service.save({ ...input, sourceReceipt: date + "T14:00:00.000Z" }, actor.uid), /maintenance_source_changed_refresh/);
  assert.equal(f.counts().writes, 0);
});
test("only retained actual timed call IDs can be proposed; no new or guessed clocks exist", async () => {
  const f = fixture(); await f.service.save(input, actor.uid);
  await assert.rejects(f.service.save({ ...input, revision: 1, proposalKind: "review_existing_calls", selectedCallIds: ["45"] }, actor.uid), /call_selection_not_in_evidence/);
  const evidence = await f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid);
  assert.equal(evidence.item.revision, 2); assert.equal(evidence.item.calls?.visitLink, "not_supplied_by_source"); assert.equal(evidence.item.proposal, null);
  const proposal = await f.service.save({ ...input, revision: 2, proposalKind: "review_existing_calls", selectedCallIds: ["45"], status: "awaiting_hha_action" }, actor.uid);
  assert.deepEqual(proposal.item.proposal?.selectedCallIds, ["45"]); assert.equal(proposal.item.hhaSubmission, "not_submitted");
  await assert.rejects(f.service.save({ ...input, revision: 3, proposalKind: "review_existing_calls", selectedCallIds: ["46"] }, actor.uid), /call_selection_not_in_evidence/);
  assert.equal(f.counts().callReads, 1);
});
test("date-only calls, empty/duplicate selections and selections on unrelated proposal kinds are rejected", async () => {
  const f = fixture(); await f.service.save(input, actor.uid); f.calls.records[0]!.CallTime = date;
  await f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid);
  for (const selectedCallIds of [[], ["45", "45"], ["45"]]) await assert.rejects(f.service.save({ ...input, revision: 2, proposalKind: "review_existing_calls", selectedCallIds }, actor.uid), /invalid_call_selection|call_selection_not_in_evidence/);
  await assert.rejects(f.service.save({ ...input, revision: 2, selectedCallIds: ["45"] }, actor.uid), /invalid_call_selection/);
});
test("call reads require a saved revision, fresh source subject checks and correct context; failures retain prior case", async () => {
  const f = fixture();
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 0 }, actor.uid), /maintenance_save_case_first/);
  await f.service.save(input, actor.uid); f.calls.scope.patientId = "26";
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid), /maintenance_scope_mismatch/);
  const page = await f.service.cases({ date }); assert.equal(page.items[0]?.revision, 1); assert.equal(page.items[0]?.calls, null);
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 99 }, actor.uid), /revision_conflict/);
});
test("new source subjects clear retained calls, refreshed evidence clears prior proposals and office close is local", async () => {
  const f = fixture(); await f.service.save(input, actor.uid); await f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid);
  (f.day.items[0] as unknown as { caregiverId: string }).caregiverId = "36";
  const result = await f.service.save({ ...input, revision: 2, status: "office_review_complete" }, actor.uid);
  assert.equal(result.item.calls, null); assert.equal(result.item.initialSource.caregiverId, "35"); assert.equal(result.item.source.caregiverId, "36");
  assert.equal(result.item.hhaSubmission, "not_submitted");
});
test("case listings remain office/day scoped and validate cursors; router exposes no execution routes", async () => {
  const f = fixture(); await f.service.save(input, actor.uid);
  assert.equal((await f.service.cases({ date })).items.length, 1); assert.equal((await f.service.cases({ date: "2026-11-04" })).items.length, 0);
  await assert.rejects(f.service.cases({ date, cursor: ["bad"] }), /invalid_page_cursor/);
  for (const path of ["/maintenance/confirm", "/maintenance/execute", "/maintenance/clock-in", "/maintenance/approve"]) {
    assert.equal((await maintenanceRoute(f.service, actor, "POST", path, {})).status, 404);
  }
  assert.equal((await maintenanceRoute(f.service, { ...actor, roles: ["office_staff"] }, "GET", "/maintenance/cases", { date })).status, 403);
  assert.deepEqual(f.counts(), { writes: 1, callReads: 0 });
});
test("retained case history is bounded, and call source errors serialize safely without private facts", async () => {
  const f = fixture(); const first = await f.service.save(input, actor.uid), key = [...f.records.keys()][0]!;
  f.records.set(key, { ...first.item, events: Array(150).fill(first.item.events[0]) } as MaintenanceCase);
  await assert.rejects(f.service.save({ ...input, revision: 1 }, actor.uid), /maintenance_history_limit/);
  const result = await maintenanceRoute(f.service, actor, "POST", "/maintenance/save", { ...input, revision: 1 });
  assert.deepEqual(result.body, { ok: false, error: "maintenance_history_limit" });
});
test("large call evidence cannot exceed record and paged-response capacity or damage the prior revision", async () => {
  const f = fixture(); await f.service.save(input, actor.uid);
  f.calls.records = Array.from({ length: 200 }, (_, i) => ({ CallDashboardID: String(i + 100), CallTime: date + " 09:00", CallType: "x".repeat(1000), CallStatus: "y".repeat(1000) }));
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid), /maintenance_history_limit/);
  const saved = (await f.service.cases({ date })).items[0]!; assert.equal(saved.revision, 1); assert.equal(saved.calls, null);
});
