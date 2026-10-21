import assert from "node:assert/strict";
import test from "node:test";
import { refreshLiveFeed, readLiveFeed, officeDay, type FeedRecord, type FeedStore } from "./liveFeed.js";
import { visitPreview } from "./visits.js";

function fixture() {
  let time = new Date("2026-10-21T02:00:00.000Z");
  const current = { dataApproved: true, settings: { officeId: "123", officeTimezone: "America/Chicago", revision: 1,
    enabledReads: ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"] } };
  let count = 11, wrongPatientOffice = false, fail = false;
  const calls: string[] = [];
  const workspace = {
    settings: async () => structuredClone(current),
    query: async (input: { operation: string; id?: string }) => {
      calls.push(input.operation);
      if (fail) throw new Error("sensitive upstream message must not escape");
      const records = input.operation === "SearchVisitsV2" ? Array.from({ length: count }, (_, i) => ({ VisitID: String(i + 1) }))
        : input.operation === "GetPatientDemographics" ? [{ PatientID: "5", OfficeID: wrongPatientOffice ? "999" : "123" }]
        : [{ ID: input.id, "Patient/ID": "5", "Caregiver/ID": "6", VisitDate: "2026-10-20", ScheduleStartTime: "2026-10-20 09:00", ScheduleEndTime: "2026-10-20 10:00" }];
      return { source: "hhaexchange", operation: input.operation, records, fetchedAt: time.toISOString(), truncated: false };
    },
  } as unknown as Parameters<typeof visitPreview>[0];
  let record: FeedRecord | null = null;
  const store: FeedStore = { get: async () => structuredClone(record), publish: async next => {
    if (record && record.startedAt >= next.startedAt) return false;
    record = structuredClone(next); return true;
  } };
  return { workspace, store, current, calls, now: () => new Date(time), setTime: (value: string) => { time = new Date(value); },
    count: (value: number) => { count = value; }, wrongOffice: () => { wrongPatientOffice = true; }, fail: () => { fail = true; }, record: () => record };
}

test("scheduled feed uses real protected preview validation and rebinds paging to each administrator", async () => {
  const f = fixture();
  const result = await refreshLiveFeed(f.workspace, f.store, f.now);
  assert.equal(result.state, "connected"); assert.equal(f.calls.length, 21);
  const page = await readLiveFeed(f.workspace, f.store, { officeId: "123", date: "2026-10-20" }, "owner-a", f.now());
  assert.equal(page.feed.background, true); assert.equal(page.feed.intervalSeconds, 60);
  assert.equal(page.items.length, 10); assert.equal(page.completeness.complete, false); assert.equal(page.totals, null);
  const next = await visitPreview(f.workspace, { officeId: "123", date: "2026-10-20", cursor: page.nextCursor }, "owner-a");
  assert.equal(next.page.offset, 10); assert.equal(next.items.length, 1);
  await assert.rejects(visitPreview(f.workspace, { date: "2026-10-20", cursor: page.nextCursor }, "owner-b"), /scope_mismatch/);
});
test("feed is denied after read, deployment or office policy revocation", async () => {
  for (const change of ["read", "release", "office", "revision"]) {
    const f = fixture(); await refreshLiveFeed(f.workspace, f.store, f.now);
    if (change === "read") f.current.settings.enabledReads = [];
    if (change === "release") f.current.dataApproved = false;
    if (change === "office") f.current.settings.officeId = "456";
    if (change === "revision") f.current.settings.revision += 1;
    const count = f.calls.length;
    await assert.rejects(readLiveFeed(f.workspace, f.store, {}, "owner", f.now()));
    assert.equal(f.calls.length, count, "reading the cache makes no HHA request");
  }
});
test("wrong office/date/unknown query and stale or future receipts never produce a live feed", async () => {
  const f = fixture(); await refreshLiveFeed(f.workspace, f.store, f.now);
  for (const query of [{ officeId: "999" }, { date: "2026-10-19" }, { cursor: "forged" }]) {
    await assert.rejects(readLiveFeed(f.workspace, f.store, query, "owner", f.now()));
  }
  await assert.rejects(readLiveFeed(f.workspace, f.store, {}, "owner", new Date("2026-10-21T02:03:01Z")), /overdue/);
  await assert.rejects(readLiveFeed(f.workspace, f.store, {}, "owner", new Date("2026-10-21T01:59:59Z")), /overdue/);
});
test("unknown source coverage stays explicit for successful empty searches", async () => {
  const f = fixture(); f.count(0); await refreshLiveFeed(f.workspace, f.store, f.now);
  const page = await readLiveFeed(f.workspace, f.store, {}, "owner", f.now());
  assert.equal(page.state, "empty"); assert.equal(page.items.length, 0);
  assert.equal(page.completeness.sourceDiscoveryComplete, false); assert.equal(page.totals, null);
});
test("a failed update removes the prior cached page and sanitizes upstream errors", async () => {
  const f = fixture(); await refreshLiveFeed(f.workspace, f.store, f.now);
  f.setTime("2026-10-21T02:01:00Z"); f.fail();
  const result = await refreshLiveFeed(f.workspace, f.store, f.now);
  assert.equal(result.state, "unavailable"); assert.equal(f.record()?.page, null);
  assert.doesNotMatch(JSON.stringify(f.record()), /sensitive upstream/);
  await assert.rejects(readLiveFeed(f.workspace, f.store, {}, "owner", f.now()));
});
test("unreadable or cross-office details do not claim usable API connectivity", async () => {
  const f = fixture(); f.wrongOffice();
  const result = await refreshLiveFeed(f.workspace, f.store, f.now);
  assert.equal(result.state, "unavailable"); assert.equal(f.record()?.page, null);
});
test("scope changes during worker execution cannot publish the old source page", async () => {
  const f = fixture();
  const read: typeof visitPreview = async (...args) => {
    const page = await visitPreview(...args); f.current.settings.revision += 1; return page;
  };
  const result = await refreshLiveFeed(f.workspace, f.store, f.now, read);
  assert.equal(result.state, "unavailable"); assert.equal(f.record()?.page, null);
});
test("office-day rollover is derived from the configured timezone and rejects yesterday's cache", async () => {
  const f = fixture(); await refreshLiveFeed(f.workspace, f.store, f.now);
  assert.equal(officeDay(new Date("2026-10-21T04:59:59Z"), "America/Chicago"), "2026-10-20");
  assert.equal(officeDay(new Date("2026-10-21T05:00:00Z"), "America/Chicago"), "2026-10-21");
  await assert.rejects(readLiveFeed(f.workspace, f.store, {}, "owner", new Date("2026-10-21T05:00:01Z")), /waiting_for_first_update/);
});
