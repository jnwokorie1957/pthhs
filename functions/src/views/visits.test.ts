import assert from "node:assert/strict";
import test from "node:test";
import { assertLiveDataMode, dataStatus, visitPreview, viewRoute } from "./visits.js";
import { OperationsWorkspace, type WorkspaceRepository, type Versioned, type Settings } from "../operations/workspace.js";
import { WorkflowError, operationalRead, type ReadInput, type OperationalRead } from "../operations/reads.js";
import { parseHhaSoapResponse } from "../integrations/hhaexchange/parser.js";
import { HhaSoapClient, boundedSoapText } from "../integrations/hhaexchange/client.js";

test("visit source transport and gateway failures preserve explicit scoped recovery", async () => {
  for (const failure of ["transport", "gateway"]) {
    let failed = true, dispatches = 0;
    const client = { async call(operation: string, _body: string, attempts: number) {
      dispatches++; assert.equal(attempts, 1);
      return { operation, ok: false, transportOk: false, httpStatus: failure === "transport" ? 0 : 502,
        retryable: true, error: { kind: failure === "transport" ? "transport" : "protocol", code: "network_unavailable", message: "PRIVATE-SOURCE-ERROR" } };
    } } as unknown as HhaSoapClient;
    const f = fixture(["77", "88", "99"], { read: async input => {
      if (input.operation === "SearchVisitsV2") return source(input.operation, ["77", "88", "99"].map(VisitID => ({ VisitID })));
      return input.id === "88" && failed ? operationalRead(client, input) : detail(input.id!);
    } });
    const first = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
    assert.equal(first.page.returnedCount, 1);
    assert.deepEqual(first.items.map(item => item.error ?? null), [null, "hha_source_temporarily_unavailable", "not_attempted_after_batch_gate"]);
    assert.equal(first.retry?.offset, 1); assert.equal(first.retry?.reason, "source_unavailable");
    assert.equal(first.retry?.afterSeconds, 60); assert.equal(dispatches, 1);
    assert.equal(first.items[1]?.actualStart, null); assert.equal(first.items[1]?.detailFetchedAt, null);
    assert.doesNotMatch(JSON.stringify(first), /PRIVATE-SOURCE-ERROR/);
    failed = false; f.calls.length = 0;
    const resumed = await visitPreview(f.service, { date: "2026-10-10", cursor: first.retry!.cursor }, "owner");
    assert.deepEqual(resumed.items.map(item => item.id), ["88", "99"]);
    assert.equal(resumed.items[0]?.state, "source_unvalidated");
    assert.equal(resumed.items[0]?.actualEnd, null); assert.equal(resumed.retry, null);
    await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor: first.retry!.cursor }, "different-owner"), /scope_mismatch/);
  }
});

test("visit-read recovery separates transport from faults, denied access, malformed success and vendor backoff", async () => {
  const inputs: ReadInput[] = [{ operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" },
    { operation: "GetVisitInfoV3", id: "77" }, { operation: "GetPatientDemographics", id: "5" }];
  for (const input of inputs) for (const httpStatus of [0, 408, 500, 502, 503, 504]) {
    let calls = 0;
    const client = { async call(_operation: string, _body: string, attempts: number) {
      calls++; assert.equal(attempts, 1);
      return { ok: false, transportOk: false, httpStatus, retryable: false,
        error: { kind: httpStatus === 0 ? "transport" : "protocol", code: "network_unavailable", message: "PRIVATE-UPSTREAM" } };
    } } as unknown as HhaSoapClient;
    await assert.rejects(operationalRead(client, input), (e: unknown) => e instanceof WorkflowError && e.code === "hha_source_temporarily_unavailable" && e.status === 503 && e.retryAfterSeconds === undefined);
    assert.equal(calls, 1);
  }
  for (const [kind, httpStatus] of [["application", 200], ["application", 503], ["soap_fault", 500], ["protocol", 200], ["protocol", 401], ["protocol", 403], ["protocol", 501]] as const) {
    const client = { async call() { return { ok: false, transportOk: false, httpStatus, error: { kind, message: "PRIVATE-UPSTREAM" } }; } } as unknown as HhaSoapClient;
    await assert.rejects(operationalRead(client, inputs[1]!), (e: unknown) => e instanceof WorkflowError && e.code === "hha_read_failed" && e.status === 502);
  }
  const limited = { async call() { return { ok: false, httpStatus: 503, retryAfter: "120", error: { kind: "protocol" } }; } } as unknown as HhaSoapClient;
  await assert.rejects(operationalRead(limited, inputs[1]!), (e: unknown) => e instanceof WorkflowError && e.code === "vendor_backoff_active" && e.status === 429 && e.retryAfterSeconds === 120);
  const otherRead = { async call() { return { ok: false, httpStatus: 502, error: { kind: "protocol" } }; } } as unknown as HhaSoapClient;
  await assert.rejects(operationalRead(otherRead, { operation: "GetVisitBillInfoV2", id: "77" }), (e: unknown) => e instanceof WorkflowError && e.code === "hha_read_failed" && e.status === 502);
  for (const code of [undefined, "backoff_persistence_failed", "response_size_limit", "unclassified_transport_failure"]) {
    const blocked = { async call() { return { ok: false, httpStatus: 0, error: { kind: "transport", code } }; } } as unknown as HhaSoapClient;
    await assert.rejects(operationalRead(blocked, inputs[1]!), (e: unknown) => e instanceof WorkflowError && e.code === "hha_read_failed" && e.status === 502);
  }
});

test("SOAP transport marks only known network failures for explicit visit recovery", async () => {
  const prior = globalThis.fetch;
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "synthetic", appKey: "synthetic", appSecret: "synthetic" });
    for (const error of [new TypeError("PRIVATE-NETWORK"), Object.assign(new Error("PRIVATE-TIMEOUT"), { name: "TimeoutError" }), new Error("hha_response_size_limit"), new Error("PRIVATE-UNKNOWN")]) {
      let calls = 0; globalThis.fetch = async () => { calls++; throw error; };
      const response = await client.call("GetPatientDemographics", "<PatientInfo><ID>5</ID></PatientInfo>", 1);
      assert.equal(response.error?.code, ["TypeError", "TimeoutError"].includes(error.name) ? "network_unavailable" : error.message === "hha_response_size_limit" ? "response_size_limit" : "unclassified_transport_failure");
      assert.equal(calls, 1); assert.doesNotMatch(JSON.stringify(response), /PRIVATE-/);
    }
  } finally { globalThis.fetch = prior; }
});

test("failed office proof never exposes detail values and discovery outage cannot become empty success", async () => {
  const f = fixture(["77"]), calls: string[] = [];
  const failedClient = { async call() { return { ok: false, httpStatus: 504, error: { kind: "protocol" } }; } } as unknown as HhaSoapClient;
  const service = new OperationsWorkspace(f.repository, async input => {
    calls.push(input.operation);
    return input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
      : input.operation === "GetVisitInfoV3" ? detail("77") : operationalRead(failedClient, input);
  }, true);
  const page = await visitPreview(service, { date: "2026-10-10" }, "owner");
  assert.deepEqual(calls, ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"]);
  assert.equal(page.retry?.offset, 0); assert.equal(page.page.returnedCount, 0);
  assert.equal(page.items[0]?.actualStart, null); assert.equal(page.items[0]?.patientId, null);
  assert.equal(page.items[0]?.detailFetchedAt, null); assert.equal(page.items[0]?.officeCheckedAt, null);
  const discovery = fixture([], { read: input => operationalRead(failedClient, input) });
  const route = await viewRoute(discovery.service, "GET", "/views/visits", { date: "2026-10-10" }, "owner");
  assert.equal(route?.status, 503); assert.equal((route?.body as any).ok, false);
  assert.equal((route?.body as any).error, "hha_source_temporarily_unavailable");
});

test("large discovery keeps SOAP byte ceiling and strict identifiers", async () => {
  await assert.rejects(boundedSoapText(new Response("oversized", { headers: { "Content-Length": String(5 * 1024 * 1024 + 1) } })));
  await assert.rejects(boundedSoapText(new Response("x".repeat(5 * 1024 * 1024 + 1))));
  for (const id of ["0", "-1", "2147483648", "1.5"]) {
    const client = { call: async () => ({ ok: true, resultXml: "<Visits><VisitID>" + id + "</VisitID></Visits>" }) } as unknown as HhaSoapClient;
    await assert.rejects(operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery"), /invalid_identifier/);
  }
});

test("dashboard alone requests retained ID projection through unchanged workspace scope gates", async () => {
  const f = fixture(), scopes: (string | undefined)[] = [];
  const service = new OperationsWorkspace(f.repository, async (input, projection) => {
    scopes.push(projection);
    return input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
      : input.operation === "GetPatientDemographics" ? source(input.operation, [{ PatientID: "5", OfficeID: "123" }]) : detail(input.id!);
  }, true);
  await visitPreview(service, { date: "2026-10-10" }, "owner");
  assert.deepEqual(scopes, ["visit_discovery", undefined, undefined]);
  await assert.rejects(service.query({ operation: "SearchVisitsV2", officeId: "999", date: "2026-10-10" }, "owner", "visit_discovery"), /office_scope_mismatch/);
  assert.equal(scopes.length, 3);
});

test("dashboard discovery retains 200, 201, 1500 and 1601 received IDs without changing other previews", async () => {
  for (const count of [0, 200, 201, 1500, 1601]) {
    const xml = "<Visits>" + Array.from({ length: count }, (_, i) => "<VisitID>" + (i + 1) + "</VisitID>").join("") + "</Visits>";
    const client = { call: async () => ({ ok: true, resultXml: xml }) } as unknown as HhaSoapClient;
    const input: ReadInput = { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" };
    const all = await operationalRead(client, input, "visit_discovery"), preview = await operationalRead(client, input);
    assert.equal(all.records.length, count); assert.equal(all.truncated, false);
    assert.equal(preview.records.length, Math.min(count, 200)); assert.equal(preview.truncated, count > 200);
  }
});

test("dashboard discovery refuses empty, nested or ambiguous source IDs instead of silently dropping them", async () => {
  for (const xml of [
    "<Visits><VisitID>77</VisitID><VisitID/></Visits>",
    '<Visits><VisitID xsi:nil="true"/></Visits>',
    "<Visits><VisitID>77</VisitID></Visits><Visits><VisitID>88</VisitID></Visits>",
    "<Visits><Unexpected><VisitID>77</VisitID></Unexpected></Visits>",
    "<Visits><VisitID>77</Visits>",
    "<Visits>77</Visits>",
    "<Visits><Unexpected>77</Unexpected></Visits>",
    "<Visits><VisitID=77/></Visits>",
    "<Visits><VisitID>77</VisitID>88</Visits>",
    "<Visits><VisitID>77</VisitID><Unexpected/></Visits>",
    "<Visits/><bad",
    "<Visits=broken>77</Visits=broken>", "<Visits", "<Visits/><VisitID=88/>",
    "<Visits><VisitID>77</VisitID></Visits><VisitID=88/>",
    "<Visits/><bad>",
    '<!DOCTYPE Visits [<!ENTITY id "77">]><Visits><VisitID>&id;</VisitID></Visits>',
    "<Details><Visits/></Details>", "<VisitID>77</VisitID><Visits/>",
    "<Visits><VisitID><Unexpected>77</Unexpected></VisitID></Visits>",
    "<Visits/><!-- unfinished",
    "<Visits/><?unfinished",
    "<Visits/><![CDATA[unfinished",
    '<Visits><VisitID invalid>77</VisitID></Visits>',
  ]) {
    const client = { call: async () => ({ ok: true, resultXml: xml }) } as unknown as HhaSoapClient;
    await assert.rejects(operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery"));
  }
});

test("dashboard discovery preserves contract empty forms, namespaces, comments and scalar IDs", async () => {
  for (const xml of ["", "<Visits/>", "<Visits></Visits>", "<Visits><![CDATA[]]></Visits>", "<Visits><![CDATA[ \n ]]></Visits>"]) {
    const client = { call: async () => ({ ok: true, resultXml: xml }) } as unknown as HhaSoapClient;
    // A successful parser supplies result XML; use a Result sibling for absent Visits.
    const actual = xml || '<Result Status="Success"/>';
    client.call = async () => ({ ok: true, resultXml: actual }) as any;
    assert.deepEqual((await operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery")).records, []);
  }
  const client = { call: async () => ({ ok: true, resultXml: '<n:Visits xmlns:n="urn:synthetic"><!-- ignored <VisitID/> --><n:VisitID> 77 </n:VisitID><n:VisitID>88</n:VisitID></n:Visits>' }) } as unknown as HhaSoapClient;
  assert.deepEqual((await operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery")).records, [{ VisitID: "77" }, { VisitID: "88" }]);
});

test("discovery ignores tag-looking CDATA and processing instructions outside IDs", async () => {
  for (const xml of [
    "<Visits><VisitID>7<!-- ignore -->7</VisitID></Visits>",
    "<Details><![CDATA[<VisitID>]]></Details><Visits><VisitID>77</VisitID></Visits>",
    "<?message <VisitID> ?><Visits><VisitID>77</VisitID></Visits>",
    "<Visits><?message <VisitID> ?><VisitID><![CDATA[77]]></VisitID><!-- <VisitID/> --></Visits>",
    "<Visits><!-- <VisitID>77</VisitID> --><VisitID>77</VisitID></Visits>",
  ]) {
    const client = { call: async () => ({ ok: true, resultXml: xml }) } as unknown as HhaSoapClient;
    assert.deepEqual((await operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery")).records, [{ VisitID: "77" }]);
  }
});

test("every retained ID is reachable through bounded pages beyond offset 200", async () => {
  for (const count of [200, 201, 1500, 1601]) {
    const ids = Array.from({ length: count }, (_, i) => String(i + 1));
    const f = fixture([...ids].reverse().concat(ids[0]!)), seen: string[] = [];
    let cursor: string | undefined;
    do {
      const before = f.calls.length;
      const page = await visitPreview(f.service, { date: "2026-10-10", ...(cursor ? { cursor } : {}) }, "owner");
      assert.ok(f.calls.length - before <= 21);
      assert.equal(page.discovery.totalReceived, count + 1);
      assert.equal(page.discovery.selectedCount, count);
      assert.equal(page.discovery.discoveryCompleteness, "unknown");
      assert.equal(page.completeness.sourceDiscoveryComplete, false);
      assert.equal(page.totals, null);
      seen.push(...page.items.map(item => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    assert.deepEqual(seen, ids);
  }
});

test("large discovery cursor rejects unsafe offsets, changed source and preserves failed-page retry", async () => {
  const ids = Array.from({ length: 201 }, (_, i) => String(i + 1)), f = fixture(ids);
  const first = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  const decoded = JSON.parse(Buffer.from(first.nextCursor!, "base64url").toString());
  for (const offset of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const cursor = Buffer.from(JSON.stringify({ ...decoded, offset })).toString("base64url");
    await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor }, "owner"), /invalid_visit_cursor/);
  }
  const cursor = Buffer.from(JSON.stringify({ ...decoded, offset: 200 })).toString("base64url");
  const tail = await visitPreview(f.service, { date: "2026-10-10", cursor }, "owner");
  assert.deepEqual(tail.items.map(item => item.id), ["201"]); assert.equal(tail.nextCursor, null);
  ids.push("202");
  await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor }, "owner"), /visit_preview_changed_restart/);
  let fail = true;
  const retry = fixture(ids, { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, ids.map(VisitID => ({ VisitID }))) : fail ? (() => { throw new WorkflowError("vendor_backoff_active", 429, 60); })() : detail(input.id!) });
  const start = await visitPreview(retry.service, { date: "2026-10-10" }, "owner");
  const failed = await visitPreview(retry.service, { date: "2026-10-10", cursor: start.nextCursor! }, "owner");
  assert.ok(failed.items.every(item => item.state === "unavailable"));
  fail = false;
  const recovered = await visitPreview(retry.service, { date: "2026-10-10", cursor: start.nextCursor! }, "owner");
  assert.deepEqual(recovered.items.map(item => item.id), failed.items.map(item => item.id));
  assert.ok(recovered.items.every(item => item.state === "source_unvalidated"));
});

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
  enabledReads: ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"], policyReference: "synthetic acceptance", missingClockInMinutes: null, missingClockOutMinutes: null };
const source = (operation: ReadInput["operation"], records: Record<string, string | null>[], truncated = false): OperationalRead => ({ operation, records, truncated,
  fetchedAt: "2026-10-10T08:00:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted" });
const detail = (id: string) => source("GetVisitInfoV3", [{ ID: id, VisitDate: "2026-10-10T00:00:00", "Patient/ID": "5", "Caregiver/ID": "6",
  ScheduleStartTime: "08:00", ScheduleEndTime: "12:00", VisitStartTime: "08:02", VisitEndTime: null, EVVStartTime: null, EVVEndTime: null }]);
function fixture(ids = ["77"], options: { approved?: boolean; settings?: Settings; read?: (input: ReadInput) => Promise<OperationalRead> } = {}) {
  const repository = new Repository(), calls: ReadInput[] = [];
  repository.records.set("workspaceSettings/owner", structuredClone(options.settings ?? settings));
  const service = new OperationsWorkspace(repository, async input => {
    calls.push(input); if (input.operation === "GetPatientDemographics") return source(input.operation, [{ PatientID: input.id!, OfficeID: "123" }]); return options.read ? options.read(input) : input.operation === "SearchVisitsV2" ? source(input.operation, ids.map(VisitID => ({ VisitID }))) : detail(input.id!);
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

test("related-reader readiness reflects each read gate without dispatching or claiming source success", async () => {
  const closed = fixture(), initial = await dataStatus(closed.service);
  assert.equal(initial.panels.caregiverProfile.available, false); assert.equal(initial.panels.billingFacts.blockedReason, "read_not_owner_enabled"); assert.equal(closed.calls.length, 0);
  const opened = fixture(["77"], { settings: { ...settings, enabledReads: [...settings.enabledReads, "GetCaregiverDemographics", "GetVisitBillInfoV2"] } });
  const checked = await dataStatus(opened.service); assert.equal(checked.panels.caregiverProfile.available, true); assert.equal(checked.panels.billingFacts.available, true);
  assert.equal(checked.sourceValidation, "pending"); assert.equal(opened.calls.length, 0);
  const locked = fixture(["77"], { approved: false, settings: { ...settings, enabledReads: [...settings.enabledReads, "GetCaregiverDemographics", "GetVisitBillInfoV2"] } });
  assert.equal((await dataStatus(locked.service)).panels.billingFacts.blockedReason, "operational_data_release_not_approved"); assert.equal(locked.calls.length, 0);
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

test("V3 projects HHA schedule-duration components and preview retains them without clinical acceptance or duration substitution", async () => {
  const projected = await operationalRead({ async call() { return { ok: true, resultXml: '<VisitInfo><ID>77</ID><VisitDate>2026-10-10</VisitDate><Patient><ID>5</ID></Patient><ScheduleStartTime>2026-10-10 08:00</ScheduleStartTime><ScheduleEndTime>2026-10-10 12:15</ScheduleEndTime><ScheduleDuration><ScheduleDurationHours>4</ScheduleDurationHours><ScheduleDurationMinutes>15</ScheduleDurationMinutes></ScheduleDuration><ActualHours>0.00</ActualHours><PayHours>99.00</PayHours></VisitInfo>' }; } } as never, { operation: 'GetVisitInfoV3', id: '77' });
  assert.equal(projected.records[0]?.['ScheduleDuration/ScheduleDurationHours'], '4');
  assert.equal(projected.records[0]?.['ScheduleDuration/ScheduleDurationMinutes'], '15');
  const f = fixture(['77'], { read: async input => input.operation === 'SearchVisitsV2' ? source(input.operation, [{ VisitID: '77' }]) : projected });
  const result = await visitPreview(f.service, { date: '2026-10-10' }, 'owner');
  assert.equal(result.items[0]?.scheduleDurationHours, '4'); assert.equal(result.items[0]?.scheduleDurationMinutes, '15');
  assert.equal(result.items[0]?.actualHours, '0.00'); assert.equal(result.items[0]?.actualEnd, null);
  assert.equal(result.items[0]?.state, 'source_unvalidated'); assert.equal(result.totals, null);
  const missing = fixture();
  const absent = (await visitPreview(missing.service, { date: '2026-10-10' }, 'owner')).items[0]!;
  assert.equal(absent.scheduleDurationHours, null); assert.equal(absent.scheduleDurationMinutes, null); assert.equal(absent.actualHours, null);
});

test("rounded HHA actual hours remain an independent raw field, never filling clocks or ActualHours", async () => {
  for (const value of ["4.25", "0.00", "", null]) {
    const f = fixture(["77"], { read: async input => {
      if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }]);
      const record = detail(input.id!); record.records[0]!.ActualHoursRounded = value; record.records[0]!.ActualHours = null;
      record.records[0]!.VisitEndTime = null; record.records[0]!.EVVEndTime = null; return record;
    } });
    const result = await visitPreview(f.service, { date: "2026-10-10" }, "owner"), row = result.items[0]!;
    assert.equal(row.actualHoursRounded, value); assert.equal(row.actualHours, null);
    assert.equal(row.actualEnd, null); assert.equal(row.evvEnd, null); assert.equal(result.totals, null);
  }
  const absent = await visitPreview(fixture().service, { date: "2026-10-10" }, "owner");
  assert.equal(absent.items[0]!.actualHoursRounded, null);
});

test("real V3 XML empty and ambiguous time fields remain distinct through the office-checked preview", async () => {
  const projected = await operationalRead({ async call() { return { ok: true, resultXml: '<VisitInfo><ID>77</ID><VisitDate>2026-10-10</VisitDate><Patient><ID>5</ID></Patient><ScheduleStartTime>2026-10-10 08:00</ScheduleStartTime><ScheduleEndTime>2026-10-10 12:00</ScheduleEndTime><VisitStartTime/><Other><VisitEndTime>foreign-clock</VisitEndTime></Other><EVVEndTime/><ActualHours/><ActualHoursRounded>0</ActualHoursRounded><ScheduleDuration><ScheduleDurationHours>4</ScheduleDurationHours><ScheduleDurationMinutes/></ScheduleDuration><PayHours>99</PayHours></VisitInfo>' }; } } as never, { operation: 'GetVisitInfoV3', id: '77' });
  const f = fixture(['77'], { read: async input => input.operation === 'SearchVisitsV2' ? source(input.operation, [{ VisitID: '77' }]) : projected });
  const result = await visitPreview(f.service, { date: '2026-10-10' }, 'owner');
  const row = result.items[0]!;
  assert.equal(row.state, 'source_unvalidated');
  assert.equal(row.actualStart, ''); assert.equal(row.actualEnd, null);
  assert.equal(row.evvStart, null); assert.equal(row.evvEnd, '');
  assert.equal(row.actualHours, ''); assert.equal(row.actualHoursRounded, '0');
  assert.equal(row.scheduleDurationHours, '4'); assert.equal(row.scheduleDurationMinutes, '');
  assert.equal(row.officeCheckedAt, '2026-10-10T08:00:00.000Z');
  assert.equal(result.totals, null); assert.equal(result.retry, null);
  assert.doesNotMatch(JSON.stringify(result), /foreign-clock/);
});

test("each readable visit retains its independent detail and patient-office read receipts", async () => {
  const f = fixture(["77"], { read: async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }]);
    return { ...detail(input.id!), fetchedAt: "2026-10-10T08:01:00.000Z" };
  } });
  const page = await visitPreview(f.service, { date: "2026-10-10" }, "owner"), item = page.items[0]!;
  assert.equal(page.fetchedAt, "2026-10-10T08:00:00.000Z");
  assert.equal(item.detailFetchedAt, "2026-10-10T08:01:00.000Z");
  assert.equal(item.officeCheckedAt, "2026-10-10T08:00:00.000Z");
  assert.notEqual(item.detailFetchedAt, page.fetchedAt);
  assert.deepEqual(f.calls.map(x => x.operation), ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"]);
  assert.equal(page.totals, null); assert.equal(item.state, "source_unvalidated");
  const invalid = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }]) : { ...detail(input.id!), records: [{ ...detail(input.id!).records[0]!, VisitDate: "2026-10-11" }] } });
  const failed = (await visitPreview(invalid.service, { date: "2026-10-10" }, "owner")).items[0]!;
  assert.equal(failed.state, "unavailable"); assert.equal(failed.detailFetchedAt, null); assert.equal(failed.officeCheckedAt, null);
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
  assert.equal(result.completeness.sourceDiscoveryComplete, false);
});

test("source discovery and page metadata describe unique returned IDs without asserting operational coverage", async () => {
  const f = fixture(["88", "77", "77"]);
  const first = await visitPreview(f.service, { date: "2026-10-10", limit: "1" }, "owner");
  assert.equal(first.discovery.selectedCount, 2); assert.equal(first.discovery.truncated, false);
  assert.match(first.discovery.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(first.page, { offset: 0, selectedCount: 1, returnedCount: 1, unavailableCount: 0, nextOffset: 1 });
  assert.equal(first.completeness.sourceDiscoveryComplete, false); assert.equal(first.completeness.detailsComplete, false);
  const second = await visitPreview(f.service, { date: "2026-10-10", limit: "1", cursor: first.nextCursor! }, "owner");
  assert.equal(second.discovery.fingerprint, first.discovery.fingerprint);
  assert.deepEqual(second.page, { offset: 1, selectedCount: 1, returnedCount: 1, unavailableCount: 0, nextOffset: null });
  assert.equal(second.completeness.detailsComplete, false); assert.equal(second.completeness.complete, false); assert.equal(second.totals, null);
  const whole = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  assert.equal(whole.completeness.detailsComplete, true); assert.equal(whole.completeness.complete, false);
});

test("visualization metadata counts unavailable detail rows without exposing their source facts", async () => {
  const f = fixture(["77", "88"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }, { VisitID: "88" }])
    : input.id === "77" ? detail("77") : source(input.operation, [{ ...detail("88").records[0]!, VisitDate: "2026-10-11", ActualHours: "foreign" }]) });
  const result = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  assert.deepEqual(result.page, { offset: 0, selectedCount: 2, returnedCount: 1, unavailableCount: 1, nextOffset: null });
  assert.equal(result.completeness.detailsComplete, false); assert.equal(result.items[1]?.actualHours, null);
  assert.doesNotMatch(JSON.stringify(result), /foreign/);
});

test("source hour, visit type, timezone and verification fields remain separate raw values", async () => {
  const f = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
    : source(input.operation, [{ ...detail("77").records[0]!, VisitType: "raw-type", TimeZone: "EST", ActualHours: "4.17", PayHours: "4.25", BilledAmount: "100.01",
      "Verification/VerifiedBy": "source reviewer", "Verification/VerifiedDate": "2026-10-10", "Verification/Notes": "private review notes" }]) });
  const result = await visitPreview(f.service, { date: "2026-10-10" }, "owner"), item = result.items[0]!;
  assert.equal(item.visitType, "raw-type"); assert.equal(item.sourceTimezone, "EST"); assert.equal(item.actualHours, "4.17"); assert.equal(item.payHours, "4.25");
  assert.equal(item.billedAmount, "100.01"); assert.equal(item.verifiedBy, "source reviewer"); assert.equal(item.verifiedDate, "2026-10-10");
  assert.doesNotMatch(JSON.stringify(result), /private review notes|verifiedStatus|billable|completed/);
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
  assert.deepEqual(result.items.map(item => item.error ?? null), [null, "not_attempted_batch_time_budget", "not_attempted_batch_time_budget"]); assert.equal(f.calls.length, 3);
  assert.equal(result.retry?.offset, 1); assert.equal(result.retry?.afterSeconds, 0); assert.equal(result.retry?.reason, "time_budget");
  const backoff = fixture(["77", "88"], { read: async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, [{ VisitID: "77" }, { VisitID: "88" }]);
    throw new WorkflowError("vendor_backoff_active", 429, 120);
  } });
  const deferred = await visitPreview(backoff.service, { date: "2026-10-10" }, "owner");
  assert.deepEqual(deferred.items.map(item => item.error), ["vendor_backoff_active", "not_attempted_after_batch_gate"]);
  assert.equal(backoff.calls.length, 2); assert.equal(backoff.repository.deferred, 120);
  assert.equal(deferred.retry?.offset, 0); assert.equal(deferred.retry?.afterSeconds, 120); assert.equal(deferred.retry?.reason, "read_limit");
  assert.equal(JSON.parse(Buffer.from(deferred.retry!.cursor, "base64url").toString()).offset, 0);
});

test("deferred retry resumes before skipped details with exact caller/date/discovery scope", async () => {
  let limited = true;
  const f = fixture(["77", "88", "99"], { read: async input => {
    if (input.operation === "SearchVisitsV2") return source(input.operation, ["77", "88", "99"].map(VisitID => ({ VisitID })));
    if (input.id === "88" && limited) throw new WorkflowError("read_budget_exhausted_retry_next_minute", 429, 37);
    return detail(input.id!);
  } });
  const first = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
  assert.equal(first.page.returnedCount, 1); assert.equal(first.nextCursor, null);
  assert.equal(first.retry?.offset, 1); assert.equal(first.retry?.afterSeconds, 37);
  limited = false; f.calls.length = 0;
  const resumed = await visitPreview(f.service, { date: "2026-10-10", cursor: first.retry!.cursor }, "owner");
  assert.deepEqual(resumed.items.map(item => item.id), ["88", "99"]);
  assert.deepEqual(f.calls.filter(call => call.operation === "GetVisitInfoV3").map(call => call.id), ["88", "99"]);
  assert.equal(resumed.retry, null); assert.equal(resumed.completeness.complete, false);
  await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor: first.retry!.cursor }, "another-owner"), /scope_mismatch/);
  await assert.rejects(visitPreview(f.service, { date: "2026-10-11", cursor: first.retry!.cursor }, "owner"), /scope_mismatch/);
  f.repository.records.set("workspaceSettings/owner", { ...settings, revision: 2 });
  await assert.rejects(visitPreview(f.service, { date: "2026-10-10", cursor: first.retry!.cursor }, "owner"), /scope_mismatch/);
});

test("first-detail retry works at offset zero while access refusals do not advertise automatic recovery", async () => {
  for (const status of [403, 423, 429, 503]) {
    let failed = true;
    const f = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
      : failed ? (() => { throw new WorkflowError(status === 429 ? "vendor_backoff_active" : "source_gate", status, 21); })() : detail("77") });
    const first = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
    if (status === 403 || status === 423) { assert.equal(first.retry, null); continue; }
    assert.equal(first.retry?.offset, 0); assert.equal(first.retry?.afterSeconds, 21);
    failed = false;
    const resumed = await visitPreview(f.service, { date: "2026-10-10", cursor: first.retry!.cursor }, "owner");
    assert.equal(resumed.items[0]?.state, "source_unvalidated"); assert.equal(resumed.retry, null);
  }
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
    assert.equal(calls, 1); assert.equal(repository.reservations, 1); assert.equal(repository.deferred, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("patient-office admission refusal retains the preview retry page without another SOAP dispatch", async context => {
  const repository = new Repository(); repository.records.set("workspaceSettings/owner", settings);
  let calls = 0, admissions = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    const operation = calls === 1 ? "SearchVisitsV2" : "GetVisitInfoV3";
    const body = calls === 1 ? '<Visits><VisitID>77</VisitID><VisitID>88</VisitID></Visits>'
      : '<VisitInfo><ID>77</ID><Patient><ID>5</ID></Patient><Caregiver><ID>6</ID></Caregiver><VisitDate>2026-10-10</VisitDate></VisitInfo>';
    assert.ok(calls <= 2, "denied patient-office read must not dispatch");
    return new Response(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operation}Response><${operation}Result><Result Status="Success"/>${body}</${operation}Result></${operation}Response></soap:Body></soap:Envelope>`);
  });
  const client = new HhaSoapClient("https://fixture.invalid", { appName: "synthetic", appKey: "synthetic", appSecret: "synthetic" }, {
    async beforeRequest() { if (++admissions >= 3) throw new WorkflowError("read_budget_exhausted_retry_next_minute", 429, 20); await repository.reserveRead(); },
    async defer(seconds) { await repository.deferReads(seconds); }
  });
  const service = new OperationsWorkspace(repository, input => operationalRead(client, input), true);
  const result = await visitPreview(service, { date: "2026-10-10" }, "owner");
  assert.equal(calls, 2); assert.equal(admissions, 3); assert.equal(repository.deferred, 0);
  assert.equal(result.retry?.offset, 0); assert.equal(result.retry?.afterSeconds, 20);
  assert.equal(result.items[0]?.error, "read_budget_exhausted_retry_next_minute");
  assert.equal(result.items[1]?.error, "not_attempted_after_batch_gate");
  assert.equal(result.items.every(item => item.state === "unavailable"), true);
});

for (const badPatient of [{ PatientID: "5", OfficeID: "999" }, { PatientID: "9", OfficeID: "123" }, { PatientID: "5", OfficeID: null }]) {
  test(`visit preview hides returned subject with unproven office ${JSON.stringify(badPatient)}`, async () => {
    const f = fixture();
    const workspace = new OperationsWorkspace(f.repository, async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
      : input.operation === "GetPatientDemographics" ? source(input.operation, [badPatient]) : detail("77"), true);
    const page = await visitPreview(workspace, { date: "2026-10-10" }, "owner");
    assert.equal(page.items[0]?.state, "unavailable");
    assert.equal(page.items[0]?.patientId, null); assert.equal(page.items[0]?.actualStart, null);
    assert.equal(page.items[0]?.error, "visit_patient_office_mismatch");
  });
}

test("transport retry reserves each actual dispatch once and never repeats a denied reservation", async () => {
  const original = globalThis.fetch; let sends = 0, reservations = 0;
  globalThis.fetch = async () => { sends++; return new Response("temporary failure", { status: 503 }); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "synthetic", appKey: "synthetic", appSecret: "synthetic" }, {
      async beforeRequest() { reservations++; if (reservations === 3) throw new WorkflowError("read_budget_exhausted_retry_next_minute", 429, 20); }, async defer() {}
    });
    await assert.rejects(client.call("GetCollectionStatus", "<Status>Active</Status>"), /read_budget_exhausted/);
    assert.equal(sends, 2); assert.equal(reservations, 3);
  } finally { globalThis.fetch = original; }
});


test("discovery validates complete result fragments accepted by the SOAP envelope parser", async () => {
  for (const fragment of ["<Visits/><bad", "<Visits", "<Visits=broken>77</Visits=broken>",
    "<Visits/><VisitID=88/>", "<Visits><VisitID>77</VisitID></Visits><VisitID=88/>"]) {
    const response = parseHhaSoapResponse("SearchVisitsV2", 200, true,
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><SearchVisitsV2Response><SearchVisitsV2Result><Result Status="Success"/>' + fragment + '</SearchVisitsV2Result></SearchVisitsV2Response></soap:Body></soap:Envelope>');
    assert.equal(response.ok, true);
    const client = { call: async () => response } as unknown as HhaSoapClient;
    await assert.rejects(operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery"), /invalid_visit_discovery_response/);
  }
});


test("discovery decodes XML numeric references once without decoding literal CDATA", async () => {
  const read = (value: string) => operationalRead({ call: async () => ({ ok: true,
    resultXml: "<Visits><VisitID>" + value + "</VisitID></Visits>" }) } as unknown as HhaSoapClient,
    { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery");
  for (const value of ["&#55;&#x37;", "&#55;&#55;", "&#x37;&#x37;", "&#00055;&#x00037;", "<![CDATA[7]]>&#55;", "&#55;<!-- ignore -->&#x37;"]) {
    assert.deepEqual((await read(value)).records, [{ VisitID: "77" }]);
  }
  for (const value of ["<![CDATA[&#55;&#x37;]]>", "&amp;#55;&amp;#x37;", "&custom;", "&#0;", "&#xD800;", "&#x110000;"]) {
    await assert.rejects(read(value));
  }
});


test("discovery rejects nil IDs after XML Schema boolean whitespace normalization", async () => {
  for (const nil of ["true", " true ", " 1 ", "&#32;true&#32;", "&#x20;1&#x9;", "\ttrue\n"]) {
    const client = { call: async () => ({ ok: true,
      resultXml: '<Visits><VisitID xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="' + nil + '">77</VisitID></Visits>' }) } as unknown as HhaSoapClient;
    await assert.rejects(operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery"), /invalid_visit_discovery_response/);
  }
});


test("discovery rejects large unterminated comment sequences without quadratic scanning", async () => {
  for (const count of [16384, 65536, 262144]) {
    const client = { call: async () => ({ ok: true, resultXml: "<Visits/>" + "<!--".repeat(count) }) } as unknown as HhaSoapClient;
    const started = performance.now();
    await assert.rejects(operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery"), /invalid_visit_discovery_response/);
    assert.ok(performance.now() - started < 2000, "bounded malformed fragment must reject promptly");
  }
});

test("discovery projects a near-byte-ceiling collection without a complete XML object tree", async () => {
  const xml = "<Visits>" + "<VisitID>123456</VisitID>".repeat(200000) + "</Visits>";
  assert.ok(Buffer.byteLength(xml) < 5 * 1024 * 1024);
  const client = { call: async () => ({ ok: true, resultXml: xml }) } as unknown as HhaSoapClient;
  const result = await operationalRead(client, { operation: "SearchVisitsV2", officeId: "123", date: "2026-10-10" }, "visit_discovery");
  assert.equal(result.records.length, 200000); assert.equal(result.truncated, false);
  assert.deepEqual(result.records[199999], { VisitID: "123456" });
});

test("office-checked preview retains raw EVV types without filling a missing endpoint or adding reads", async () => {
  for (const raw of ["GPS-In", "", "0", null]) {
    const f = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
      : source("GetVisitInfoV3", [{ ...detail("77").records[0]!, ClockInEvvType: raw, ClockOutEvvType: "unmapped-out", EVVEndTime: "", ActualHours: "" }]) });
    const page = await visitPreview(f.service, { date: "2026-10-10" }, "owner");
    const row = page.items[0]! as unknown as Record<string, unknown>;
    assert.equal(row.evvInType, raw); assert.equal(row.evvOutType, "unmapped-out");
    assert.equal(row.evvEnd, ""); assert.equal(row.actualHours, ""); assert.equal(page.totals, null);
    assert.deepEqual(f.calls.map(c => c.operation), ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"]);
  }
  const f = fixture(["77"], { read: async input => input.operation === "SearchVisitsV2" ? source(input.operation, [{ VisitID: "77" }])
    : source("GetVisitInfoV3", [{ ...detail("77").records[0]!, VisitDate: "2026-10-11", ClockInEvvType: "foreign-type", ClockOutEvvType: "foreign-type" }]) });
  const row = (await visitPreview(f.service, { date: "2026-10-10" }, "owner")).items[0]! as unknown as Record<string, unknown>;
  assert.equal(row.state, "unavailable"); assert.equal(row.evvInType, null); assert.equal(row.evvOutType, null);
  assert.doesNotMatch(JSON.stringify(row), /foreign-type/);
});
