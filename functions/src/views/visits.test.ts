import assert from "node:assert/strict";
import test from "node:test";
import { assertLiveDataMode, dataStatus, visitPreview, viewRoute } from "./visits.js";
import { OperationsWorkspace, type WorkspaceRepository, type Versioned, type Settings } from "../operations/workspace.js";
import { WorkflowError, operationalRead, type ReadInput, type OperationalRead } from "../operations/reads.js";
import { HhaSoapClient } from "../integrations/hhaexchange/client.js";

class Repository implements WorkspaceRepository {
  records = new Map<string, Versioned>(); reservations = 0; deferred = 0;
  async get<T extends Versioned>(collection: string, id: string) { return structuredClone(this.records.get(`${collection}/${id}`) as T ?? null); }
  async list<T extends Versioned>() { return [] as T[]; }
  async page<T extends Versioned>() { return { items: [] as T[], nextCursor: null }; }
  async change<T extends Versioned>(collection: string, id: string, _revision: number, _actor: string, _action: string, update: (prior: T | null) => T) {
    const next = update(await this.get<T>(collection, id)); this.records.set(`${collection}/${id}`, next); return next;
  }
  async reserveRead() { this.reservations++; }
  async deferReads(seconds: number) { this.deferred = seconds; }
  async getWriteTarget() { return null; }
  async reserveWriteTarget() {}
  async releaseWriteTarget() {}
}
const settings: Settings = { id: "owner", revision: 1, updatedAt: "2026-10-10T00:00:00.000Z", officeId: "123", officeTimezone: "America/Chicago",
  enabledReads: ["SearchVisitsV2", "GetVisitInfoV3"], policyReference: "synthetic acceptance", missingClockInMinutes: null, missingClockOutMinutes: null };
const source = (operation: ReadInput["operation"], records: Record<string, string | null>[], truncated = false): OperationalRead => ({ operation, records, truncated,
  fetchedAt: "2026-10-10T08:00:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted" });
const detail = (id: string) => source("GetVisitInfoV3", [{ ID: id, VisitDate: "2026-10-10T00:00:00", "Patient/ID": "5", "Caregiver/ID": "6",
  ScheduleStartTime: "08:00", ScheduleEndTime: "12:00", VisitStartTime: "08:02", VisitEndTime: null, EVVStartTime: null, EVVEndTime: null }]);
function fixture(ids = ["77"], options: { approved?: boolean; settings?: Settings; read?: (input: ReadInput) => Promise<OperationalRead> } = {}) {
  const repository = new Repository(), calls: ReadInput[] = [];
  repository.records.set("workspaceSettings/owner", structuredClone(options.settings ?? settings));
  const service = new OperationsWorkspace(repository, async input => {
    calls.push(input); return options.read ? options.read(input) : input.operation === "SearchVisitsV2" ? source(input.operation, ids.map(VisitID => ({ VisitID }))) : detail(input.id!);
  }, options.approved ?? true);
  return { repository, service, calls };
}

test("data status is safe metadata and explains closed approval, scope and owner read controls without dispatch", async () => {
  for (const [options, reason] of [
    [{ approved: false }, "operational_data_release_not_approved"],
    [{ settings: { ...settings, officeId: null } }, "office_timezone_not_configured"],
    [{ settings: { ...settings, officeTimezone: "Unknown/Zone" } }, "office_timezone_not_configured"],
    [{ settings: { ...settings, enabledReads: ["SearchVisitsV2"] } }, "visit_reads_not_owner_enabled"],
  ] as [{ approved?: boolean; settings?: Settings }, string][]) {
    const f = fixture(["77"], options), result = await dataStatus(f.service);
    assert.equal(result.panels.visits.available, false); assert.equal(result.panels.visits.blockedReason, reason);
    assert.equal(result.mode, "live"); assert.equal(result.sourceValidation, "pending"); assert.equal(f.calls.length, 0);
    const response = await viewRoute(f.service, "GET", "/views/visits", { date: "2026-10-10" }, "owner");
    assert.equal(response?.status, 423); assert.equal(f.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /enabledReads|policyReference|secret|writesEnabled/);
  }
  const f = fixture(); assert.equal((await dataStatus(f.service)).panels.visits.available, true); assert.equal(f.calls.length, 0);
});

test("Demo marker denies live data and commands while safe metadata and legacy clients remain usable", () => {
  for (const path of ["/workspace/read", "/workspace/settings", "/workspace/investigations", "/views/visits", "/hha/health", "/integration/health"]) {
    assert.throws(() => assertLiveDataMode("GET", path, "demo"), /demo_mode_live_request_denied/);
    assert.throws(() => assertLiveDataMode("POST", path, "Demo"), /demo_mode_live_request_denied/);
    assert.doesNotThrow(() => assertLiveDataMode("POST", path, undefined));
    assert.doesNotThrow(() => assertLiveDataMode("GET", path, "live"));
  }
  for (const path of ["/session", "/status", "/data/status"]) assert.doesNotThrow(() => assertLiveDataMode("GET", path, "demo"));
  assert.throws(() => assertLiveDataMode("GET", "/data/status", "unknown"), /invalid_data_mode/);
});

test("visit queries validate scope, real calendar day, bounded limit and plain scalar inputs before source dispatch", async () => {
  const f = fixture();
  for (const query of [{ date: "2026-02-30" }, { date: ["2026-10-10"] }, { date: "2026-10-10", officeId: "456" },
    { date: "2026-10-10", limit: "11" }, { date: "2026-10-10", limit: 10 }, { date: "2026-10-10", patientId: "5" },
    { date: "2026-10-10", cursor: "bad" }, { date: "2026-10-10", cursor: "" }]) {
    const response = await viewRoute(f.service, "GET", "/views/visits", query, "owner");
    assert.ok(response && response.status >= 400); assert.equal(f.calls.length, 0);
  }
  assert.equal((await viewRoute(f.service, "POST", "/views/visits", {}, "owner"))?.status, 405);
});

test("preview preserves raw manual and EVV evidence, exposes no aggregates and does not include unrelated source fields", async () => {
  const f = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
    : source(input.operation, [{ ...detail("77").records[0]!, SSN: "never disclose", EVVStartTime: "08:07" }]) });
  const result = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  assert.equal(result.state, "ready"); assert.equal(result.items[0]?.actualStart, "08:02"); assert.equal(result.items[0]?.evvStart, "08:07");
  assert.equal(result.items[0]?.evvEnd, null); assert.equal(result.validation, "source_unvalidated");
  assert.equal(result.timezone, "source_values_unconverted"); assert.equal(result.completeness.complete, false); assert.equal(result.totals, null);
  assert.deepEqual(result.scope, { officeId: "123", date: "2026-10-10", timezone: "America/Chicago" });
  assert.doesNotMatch(JSON.stringify(result), /never disclose|SSN/);
});

test("empty discovery is empty source preview while vendor failure and malformed discovery cannot become empty success", async () => {
  const f = fixture([]), empty = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  assert.equal(empty.state, "empty"); assert.deepEqual(empty.items, []); assert.equal(empty.completeness.complete, false); assert.equal(f.calls.length, 1);
  for (const read of [async () => { throw new WorkflowError("hha_read_failed", 502); },
    async () => source("SearchVisitsV2", [{ VisitID: "0" }]), async () => source("GetVisitInfoV3", []),
    async () => source("SearchVisitsV2", [], true)]) {
    const broken = fixture([], { read }); const response = await viewRoute(broken.service, "GET", "/views/visits", { date: "2026-10-10" }, "owner");
    assert.equal(response?.status, 502); assert.equal((response?.body as any).ok, false);
  }
});

test("pagination sorts and deduplicates discovered IDs, bounds detail reads and fences cursor to actor, day, office and settings", async () => {
  const f = fixture(["12", "3", "2", "12", "4", "5", "6", "7", "8", "9", "10", "11", "1"]);
  const first = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  assert.deepEqual(first.items.map(item => item.id), Array.from({ length: 10 }, (_, index) => String(index + 1)));
  assert.equal(first.state, "partial"); assert.equal(f.calls.filter(input => input.operation === "GetVisitInfoV3").length, 10); assert.ok(first.nextCursor);
  const cursor = first.nextCursor!;
  const second = await visitPreview(f.service, { date: "2026-10-10", cursor }, "owner");
  assert.deepEqual(second.items.map(item => item.id), ["11", "12"]); assert.equal(second.nextCursor, null);
  const before = f.calls.length;
  for (const [query, actor] of [[{ date: "2026-10-10", cursor }, "another-user"], [{ date: "2026-10-11", cursor }, "owner"]] as const) {
    await assert.rejects(visitPreview(f.service, query, actor), /visit_cursor_scope_mismatch/);
  }
  assert.equal(f.calls.length, before);
  f.repository.records.set("workspaceSettings/owner", { ...settings, revision: 2 });
  await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor }, "owner"), /visit_cursor_scope_mismatch/);
});

test("changed discovery refuses a stale page and cursor source IDs never authorize detail dispatch", async () => {
  const ids = ["77", "88"], f = fixture(ids);
  const first = await visitPreview(f.service, { date: "2026-10-10", limit: "1" }, "owner");
  ids.push("99"); const before = f.calls.length;
  await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor: first.nextCursor! }, "owner"), /visit_preview_changed_restart/);
  assert.equal(f.calls.length, before + 1); assert.equal(f.calls.at(-1)?.operation, "SearchVisitsV2");
  const forged = Buffer.from(JSON.stringify({ version: 1, scope: "a".repeat(64), discovery: "b".repeat(64), offset: 1, ids: ["123456"] })).toString("base64url");
  await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor: forged }, "owner"), /invalid_visit_cursor/);
});

test("office, timezone, read approval or settings revision changes during details refuse all old-window facts", async () => {
  for (const changed of [{ ...settings, officeId: "456" }, { ...settings, officeTimezone: "America/New_York" },
    { ...settings, enabledReads: ["SearchVisitsV2"] }, { ...settings, revision: 2 }]) for (const ids of [["77"], ["77", "88"]]) {
    const f = fixture(ids);
    const service = new OperationsWorkspace(f.repository, async input => {
      f.calls.push(input);
      if (input.operation === "SearchVisitsV2") return source(input.operation, ids.map(VisitID => ({ VisitID })));
      f.repository.records.set("workspaceSettings/owner", changed);
      return source(input.operation, [{ ...detail(input.id!).records[0]!, ScheduleStartTime: "old-window-facts" }]);
    }, true);
    const result = await viewRoute(service, "GET", "/views/visits", { date: "2026-10-10" }, "owner");
    assert.equal(result?.status, 409); assert.equal((result?.body as any).error, "visit_preview_policy_changed_restart");
    assert.doesNotMatch(JSON.stringify(result), /old-window-facts|items/); assert.equal(f.calls.length, 2);
  }
});

test("truncated discovery stays partial even on its last page and totals stay unavailable", async () => {
  const f = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }], true) : detail("77") });
  const result = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  assert.equal(result.state, "partial"); assert.equal(result.completeness.truncated, true); assert.equal(result.nextCursor, null); assert.equal(result.totals, null);
});

test("extra, wrong-identity, changed-day and failed details return unavailable rows with no foreign facts", async () => {
  for (const readDetail of [source("GetVisitInfoV3", [{ ...detail("99").records[0]!, ScheduleStartTime: "foreign" }]),
    source("GetVisitInfoV3", [detail("77").records[0]!, detail("99").records[0]!]),
    source("GetVisitInfoV3", [{ ...detail("77").records[0]!, VisitDate: "2026-10-11T00:00:00", ScheduleStartTime: "foreign" }])]) {
    const f = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : readDetail });
    const result = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
    assert.equal(result.state, "partial"); assert.equal(result.items[0]?.state, "unavailable"); assert.equal(result.items[0]?.patientId, null);
    assert.doesNotMatch(JSON.stringify(result), /foreign/);
  }
});

test("time budget and vendor backoff preserve unattempted rows instead of hiding them or hammering the source", async () => {
  let elapsed = 0;
  const f = fixture(["77", "88", "99"], { read: async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }, { VisitID: "88" }, { VisitID: "99" }]);
    elapsed = 25_001; return detail(input.id!);
  } });
  const result = await visitPreview(f.service, { date: "2026-10-10" }, "owner", () => elapsed);
  assert.deepEqual(result.items.map(item => item.error ?? null), [null, "not_attempted_batch_time_budget", "not_attempted_batch_time_budget"]); assert.equal(f.calls.length, 2);
  const backoff = fixture(["77", "88"], { read: async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }, { VisitID: "88" }]);
    throw new WorkflowError("vendor_backoff_active", 429, 120);
  } });
  const deferred = await visitPreview(backoff.service, { date: "2026-10-10" }, "owner");
  assert.deepEqual(deferred.items.map(item => item.error), ["vendor_backoff_active", "not_attempted_after_batch_gate"]);
  assert.equal(backoff.calls.length, 2); assert.equal(backoff.repository.deferred, 120);
});

test("workspace plus real SOAP transport reserves once per dispatch and quota denial never sends", async () => {
  const repository = new Repository(), originalFetch = globalThis.fetch; let calls = 0, denied = false;
  repository.records.set("workspaceSettings/owner", settings);
  globalThis.fetch = async () => { calls++; return new Response('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><SearchVisitsV2Response><SearchVisitsV2Result><Result Status="Success"/><Visits><VisitID>77</VisitID></Visits></SearchVisitsV2Result></SearchVisitsV2Response></soap:Body></soap:Envelope>'); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "synthetic", appKey: "synthetic", appSecret: "synthetic" }, {
      async beforeRequest() { if (denied) throw new WorkflowError("read_budget_exhausted_retry_next_minute", 429, 20); await repository.reserveRead(); },
      async defer(seconds) { await repository.deferReads(seconds); },
    });
    const service = new OperationsWorkspace(repository, input => operationalRead(client, input), true);
    await service.query({ operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "owner");
    assert.equal(calls, 1); assert.equal(repository.reservations, 1);
    await assert.rejects(service.query({ operation: "SearchVisitsV2", officeId: "456", date: "2026-10-10" }, "owner"), /office_scope_mismatch/);
    await assert.rejects(service.query({ operation: "SearchVisitsV2", officeId: "123", date: "bad" }, "owner"), /invalid_date/);
    assert.equal(calls, 1); assert.equal(repository.reservations, 1);
    denied = true;
    await assert.rejects(service.query({ operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "owner"), /read_budget_exhausted_retry_next_minute/);
    await assert.rejects(service.query({ operation: "GetVisitInfoV3", id: "77" }, "owner"), /read_budget_exhausted_retry_next_minute/);
    assert.equal(calls, 1); assert.equal(repository.reservations, 1); assert.equal(repository.deferred, 20);
  } finally { globalThis.fetch = originalFetch; }
});
