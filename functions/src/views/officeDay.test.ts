import assert from "node:assert/strict";
import test from "node:test";
import { readOfficeDay, refreshOfficeDay, type OfficeDayRecord, type OfficeDayStore } from "./officeDay.js";
import { visitPreview } from "./visits.js";
import { WorkflowError, type ReadInput } from "../operations/reads.js";

class MemoryStore implements OfficeDayStore {
  records = new Map<string, OfficeDayRecord>();
  wanted: Awaited<ReturnType<OfficeDayStore["target"]>> = null;
  rejectSave = false;
  async target() { return structuredClone(this.wanted); }
  async request(target: Parameters<OfficeDayStore["request"]>[0]) { this.wanted = structuredClone(target); }
  async get(id: string) { return structuredClone(this.records.get(id) ?? null); }
  async save(id: string, expected: number | null, record: OfficeDayRecord) {
    if (this.rejectSave || (this.records.get(id)?.revision ?? null) !== expected) return false;
    this.records.set(id, structuredClone(record)); return true;
  }
}
function fixture(count = 23) {
  const store = new MemoryStore(), calls: ReadInput[] = [];
  let time = new Date("2026-11-04T18:00:00Z"), date = "2026-11-04", ids = count, failure: string | null = null;
  const current = { dataApproved: true, settings: { officeId: "123", officeTimezone: "America/Chicago", revision: 1,
    enabledReads: ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"] } };
  const workspace = {
    async settings() { return structuredClone(current); },
    async query(input: ReadInput) {
      calls.push(input);
      if (failure === "quota") throw new WorkflowError("vendor_backoff_active", 429, 120);
      if (failure === "transport") throw new WorkflowError("hha_source_temporarily_unavailable", 503);
      if (input.operation === "SearchVisitsV2") date = input.date!;
      const records = input.operation === "SearchVisitsV2" ? Array.from({ length: ids }, (_, i) => ({ VisitID: String(i + 1) }))
        : input.operation === "GetPatientDemographics" ? [{ PatientID: "5", OfficeID: failure === "office" ? "999" : "123" }]
          : [{ ID: input.id, VisitDate: date, "Patient/ID": "5", "Caregiver/ID": "6", ScheduleStartTime: date + " 09:00", ScheduleEndTime: date + " 10:00",
            VisitStartTime: date + " 09:00", VisitEndTime: "", EVVStartTime: date + " 09:00", EVVEndTime: "", BilledAmount: "PRIVATE-UNNEEDED", "Verification/VerifiedBy": "PRIVATE-ACTOR" }];
      return { operation: input.operation, source: "hhaexchange", records, fetchedAt: time.toISOString(), truncated: false };
    }
  } as unknown as Parameters<typeof visitPreview>[0];
  return { store, workspace, current, calls, now: () => new Date(time), advance: (seconds: number) => { time = new Date(time.getTime() + seconds * 1000); },
    fail: (value: string | null) => { failure = value; }, count: (value: number) => { ids = value; },
    read: (value: unknown = { date: "2026-11-04" }) => readOfficeDay(workspace, store, value, time) };
}
test("server worker resumes a persisted day across separate invocations and cache reads invoke no HHA", async () => {
  const f = fixture();
  const queued = await f.read(); assert.equal(queued.officeDayCache.known, false); assert.equal(f.calls.length, 0);
  await refreshOfficeDay(f.workspace, f.store, f.now);
  const first = await f.read(), calls = f.calls.length;
  assert.equal(first.items.length, 20); assert.equal(first.officeDayCache.done, false);
  assert.equal(f.calls.length, calls);
  f.advance(60); await refreshOfficeDay(f.workspace, f.store, f.now);
  const all = await f.read();
  assert.equal(all.items.length, 23); assert.equal(new Set(all.items.map(row => row.id)).size, 23);
  assert.equal(all.officeDayCache.complete, true); assert.equal(all.officeDayCache.background, true);
  assert.equal(all.officeDayCache.persistedImport, false); assert.equal(all.officeDayCache.stale, false);
  assert.equal(all.items[0]?.actualEnd, ""); assert.equal(all.items[0]?.evvEnd, "");
  assert.doesNotMatch(JSON.stringify(all), /PRIVATE-|BilledAmount|verifiedBy|payHours|billedAmount/);
});
test("a complete day is returned while the next server generation is collecting", async () => {
  const f = fixture(11); await f.read(); await refreshOfficeDay(f.workspace, f.store, f.now);
  const first = await f.read(); f.advance(60);
  await refreshOfficeDay(f.workspace, f.store, f.now, visitPreview, 1);
  const refreshing = await f.read();
  assert.equal(refreshing.items.length, 11); assert.deepEqual(refreshing.items, first.items);
  assert.equal(refreshing.officeDayCache.progress.refreshing, true); assert.equal(refreshing.officeDayCache.progress.checked, 10);
  assert.equal(refreshing.officeDayCache.startedAt, first.officeDayCache.startedAt);
});
test("quota delay survives process boundaries and is not dispatched before its deadline", async () => {
  const f = fixture(); await f.read(); f.fail("quota");
  await refreshOfficeDay(f.workspace, f.store, f.now);
  const calls = f.calls.length, wait = await f.read(); assert.equal(wait.officeDayCache.known, false);
  assert.equal(wait.officeDayCache.progress.retryAt, "2026-11-04T18:02:00.000Z");
  f.advance(60); await refreshOfficeDay(f.workspace, f.store, f.now); assert.equal(f.calls.length, calls);
  f.fail(null); f.advance(60); await refreshOfficeDay(f.workspace, f.store, f.now);
  assert.equal((await f.read()).items.length, 20);
});
test("the requested historical day persists independently of the browser", async () => {
  const f = fixture(3); await f.read({ date: "2026-11-03", officeId: "123" });
  f.advance(60); await refreshOfficeDay(f.workspace, f.store, f.now);
  const past = await f.read({ date: "2026-11-03" });
  assert.equal(past.scope.date, "2026-11-03"); assert.equal(past.officeDayCache.complete, true);
  assert.ok(past.items.every(row => row.scheduledStart?.startsWith("2026-11-03")));
  assert.equal((await f.read()).items.length, 0, "a different day must never reuse the prior day's rows");
});
test("source membership failure cannot expose fields or become successful readable detail", async () => {
  const f = fixture(3); await f.read(); f.fail("office"); await refreshOfficeDay(f.workspace, f.store, f.now);
  const result = await f.read(); assert.equal(result.officeDayCache.done, true); assert.equal(result.officeDayCache.complete, false);
  assert.ok(result.items.every(row => row.state === "unavailable" && row.patientId === null && row.actualStart === null && row.officeCheckedAt === null));
});
test("empty success, denied release, revoked reads, foreign office and unknown queries stay distinct", async () => {
  const f = fixture(0); await f.read(); await refreshOfficeDay(f.workspace, f.store, f.now);
  assert.equal((await f.read()).officeDayCache.complete, true); assert.equal((await f.read()).items.length, 0);
  for (const input of [{ officeId: "999", date: "2026-11-04" }, { date: "2026-02-30" }, { date: "2026-11-04", cursor: "foreign" }]) await assert.rejects(f.read(input));
  f.current.dataApproved = false; await assert.rejects(f.read(), /release_not_approved/);
  f.current.dataApproved = true; f.current.settings.enabledReads = []; await assert.rejects(f.read(), /not_owner_enabled/);
});
test("settings and day changes cannot read a cache collected under another context", async () => {
  const f = fixture(3); await f.read(); await refreshOfficeDay(f.workspace, f.store, f.now);
  f.current.settings.revision++; assert.equal((await f.read()).officeDayCache.known, false);
  await refreshOfficeDay(f.workspace, f.store, f.now); assert.equal((await f.read()).officeDayCache.complete, true);
  f.current.settings.officeId = "456"; assert.equal((await f.read()).officeDayCache.known, false);
});
test("changed discovery restarts the working generation without overwriting last completed results", async () => {
  const f = fixture(11); await f.read(); await refreshOfficeDay(f.workspace, f.store, f.now); f.advance(60);
  await refreshOfficeDay(f.workspace, f.store, f.now, visitPreview, 1); f.count(12); f.advance(60);
  const result = await refreshOfficeDay(f.workspace, f.store, f.now);
  assert.equal(result.state, "restarting"); const retained = await f.read();
  assert.equal(retained.items.length, 11); assert.equal(retained.officeDayCache.progress.refreshing, false);
  f.advance(60); await refreshOfficeDay(f.workspace, f.store, f.now); assert.equal((await f.read()).items.length, 12);
});
test("stale source cache is explicitly labelled and corrupted blobs never return source records", async () => {
  const f = fixture(3); await f.read(); await refreshOfficeDay(f.workspace, f.store, f.now); f.advance(181);
  assert.equal((await f.read()).officeDayCache.stale, true);
  const [id, state] = [...f.store.records][0]!;
  f.store.records.set(id, { ...state, published: { ...state.published!, blob: new Uint8Array([1, 2, 3]) } });
  await assert.rejects(f.read(), /cache_invalid/);
});
test("compare-and-set prevents a superseded worker from replacing a newer cache", async () => {
  const f = fixture(); await f.read(); f.store.rejectSave = true;
  assert.equal((await refreshOfficeDay(f.workspace, f.store, f.now)).state, "superseded");
  assert.equal((await f.read()).officeDayCache.known, false);
});
test("a long-interrupted working scan starts fresh and does not mix old and new source receipts", async () => {
  const f = fixture(); await f.read(); await refreshOfficeDay(f.workspace, f.store, f.now, visitPreview, 1);
  f.advance(7300); await f.read(); await refreshOfficeDay(f.workspace, f.store, f.now, visitPreview, 1);
  const result = await f.read(); assert.equal(result.items.length, 10);
  assert.ok(result.items.every(row => row.detailFetchedAt === f.now().toISOString()));
});
test("current office-day collection finishes without any browser request", async () => {
  const f = fixture(642);
  for (let minute = 0; minute < 33; minute++) { await refreshOfficeDay(f.workspace, f.store, f.now); f.advance(60); }
  const result = await f.read();
  assert.equal(result.items.length, 642); assert.equal(new Set(result.items.map(row => row.id)).size, 642);
  assert.equal(result.officeDayCache.complete, true);
  const state = [...f.store.records.values()][0]!;
  assert.ok(state.published!.blob.byteLength < 300000);
  assert.ok(state.working === null || state.working.blob.byteLength + state.published!.blob.byteLength < 600000);
});
test("a policy change after source retrieval prevents cache publication", async () => {
  const f = fixture(3);
  await assert.rejects(refreshOfficeDay(f.workspace, f.store, f.now, async (...args) => {
    const page = await visitPreview(...args); f.current.dataApproved = false; return page;
  }), /release_not_approved/);
  assert.equal(f.store.records.size, 0);
});
test("a foreign cache scope is never exposed under a matching lookup key", async () => {
  const f = fixture(3); await refreshOfficeDay(f.workspace, f.store, f.now);
  const [id, record] = [...f.store.records][0]!;
  f.store.records.set(id, { ...record, scope: { ...record.scope, officeId: "999" } });
  const result = await f.read(); assert.equal(result.items.length, 0); assert.equal(result.officeDayCache.known, false);
});
