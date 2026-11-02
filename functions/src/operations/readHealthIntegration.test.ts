import test from "node:test";
import assert from "node:assert/strict";
import { OperationsWorkspace, type WorkspaceRepository, type Versioned, type Settings } from "./workspace.js";
import { mergeReadHealth, type ReadHealthEvent, type ReadHealthReceipt } from "./readHealth.js";
import { WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { workspaceRoute } from "./routes.js";
const operation = "GetVisitInfoV3" as const;
function fixture(approved = true) {
  const settings: Settings = { id: "owner", revision: 8, officeId: "12", officeTimezone: "America/Chicago", enabledReads: [operation], policyReference: "synthetic", missingClockInMinutes: null, missingClockOutMinutes: null, updatedAt: "2026-11-02T19:00:00.000Z" };
  const receipts = new Map<string, ReadHealthReceipt>(), notes: ReadHealthEvent[] = [], calls: ReadInput[] = [];
  let failWrite = false, failRead = false, changeScope = false, deferred = 0;
  const records = new Map<string, Versioned>();
  const repository = {
    async get(collection: string, id: string) { return collection === "workspaceSettings" ? structuredClone(settings) : records.get(collection + "/" + id) ?? null; },
    async change(collection: string, id: string, _rev: number, _actor: string, _action: string, update: (value: Versioned | null) => Versioned) { const value = update(null); records.set(collection + "/" + id, value); return value; },
    async noteReadHealth(event: ReadHealthEvent) { if (failWrite) throw Error("private-synthetic-marker"); notes.push(event); const next = mergeReadHealth(receipts.get(event.operation), event); if (next) receipts.set(event.operation, next); },
    async getReadHealth(operations: string[]) { const rows = operations.map(op => receipts.get(op) ?? null); if (changeScope) settings.revision++; return rows; },
    async deferReads(seconds: number) { deferred = seconds; }
  } as unknown as WorkspaceRepository;
  const result: OperationalRead = { operation, records: [{ ID: "14", PrivateField: "private-synthetic-marker" }], truncated: false,
    fetchedAt: "2026-11-02T19:01:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted" };
  const workspace = new OperationsWorkspace(repository, async input => { calls.push(input); if (failRead) throw new WorkflowError("read_budget_exhausted_retry_next_minute", 429, 20); return result; }, approved);
  return { settings, receipts, notes, calls, workspace, result, failWrite() { failWrite = true; }, failRead() { failRead = true; }, changeScope() { changeScope = true; }, deferred: () => deferred };
}
test("protected read-health route returns closed current-scope metadata without requesting HHA or private source values", async () => {
  const f = fixture();
  const first = await workspaceRoute(f.workspace, "GET", "/workspace/read-health", {}, "synthetic-admin");
  assert.equal(first?.status, 200); assert.equal(f.calls.length, 0);
  assert.equal((first?.body as { sources: { outcome: string }[] }).sources[0]!.outcome, "unobserved");
  assert.strictEqual(await f.workspace.query({ operation, id: "14" }, "synthetic-admin"), f.result);
  assert.equal(f.calls.length, 1); assert.equal(f.notes.length, 1);
  const after = await workspaceRoute(f.workspace, "GET", "/workspace/read-health", {}, "synthetic-admin");
  assert.equal(after?.status, 200); assert.equal(f.calls.length, 1);
  const body = after?.body as { sources: { outcome: string; records: number; lastSuccessAt: string }[] };
  assert.equal(body.sources[0]!.outcome, "success"); assert.equal(body.sources[0]!.records, 1);
  assert.equal(body.sources[0]!.lastSuccessAt, f.result.fetchedAt);
  assert.equal(JSON.stringify(after).includes("private-synthetic-marker"), false);
  assert.equal(JSON.stringify(f.notes).includes("private-synthetic-marker"), false);
});
test("read-health storage failures do not replace source results and admission failures retain their exact retry error", async () => {
  const broken = fixture(); broken.failWrite();
  assert.strictEqual(await broken.workspace.query({ operation, id: "14" }, "synthetic-admin"), broken.result);
  const f = fixture(); await f.workspace.query({ operation, id: "14" }, "synthetic-admin"); f.failRead();
  await assert.rejects(f.workspace.query({ operation, id: "14" }, "synthetic-admin"), (error: unknown) => error instanceof WorkflowError && error.retryAfterSeconds === 20 && error.code === "read_budget_exhausted_retry_next_minute");
  assert.equal(f.deferred(), 0); assert.equal(f.receipts.get(operation)?.outcome, "local_wait");
  assert.equal(f.receipts.get(operation)?.lastSuccess?.checkedAt, f.result.fetchedAt);
});
test("read-health requires data release and rejects changed scope without borrowing previous preferences", async () => {
  const locked = fixture(false);
  assert.equal((await workspaceRoute(locked.workspace, "GET", "/workspace/read-health", {}, "synthetic-admin"))?.status, 423);
  assert.equal(locked.calls.length, 0);
  const f = fixture(); await f.workspace.query({ operation, id: "14" }, "synthetic-admin");
  f.settings.revision++;
  assert.equal((await f.workspace.readHealth()).sources[0]!.outcome, "unobserved");
  f.changeScope(); await assert.rejects(f.workspace.readHealth(), /office_policy_changed_restart/);
});
