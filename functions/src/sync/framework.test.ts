import assert from "node:assert/strict";
import test from "node:test";
import { runIncrementalSync, type IncrementalSyncAdapter } from "./framework.js";
import { SyncStateStore } from "./state.js";
import { integrationHealth, importLockHealth } from "./health.js";

function fixture(rejectRecord = false) {
  let checkpoint = "original";
  const runs: string[] = [];
  let locked = false;
  const records = new Map<string, object>();
  const deadLetters: unknown[] = [];
  const state: Pick<SyncStateStore, "getRun" | "acquire" | "release" | "getCheckpoint" | "begin" | "succeed" | "partial" | "fail" | "deadLetter"> = {
    async getRun() { return undefined; },
    async acquire() { if (locked) throw new Error("sync_already_running_or_recovery_required"); locked = true; return "lock"; },
    async release() { locked = false; },
    async getCheckpoint() { return checkpoint; },
    async begin(resource) { return { id: "run", integration: "hhaexchange", resource, startedAt: "now", status: "running" }; },
    async succeed(_sync, _count, next) { checkpoint = next!; runs.push("success"); },
    async partial() { runs.push("partial"); },
    async fail(_sync, code) { runs.push(code); },
    async deadLetter(input) { deadLetters.push(input); return "letter"; },
  };
  const adapter: IncrementalSyncAdapter<{ sourceIdentifier: string }, { id: string; actualEnd?: string }> = {
    resource: "visit_changes_v5", collection: "visits",
    async fetchPage() { return { items: [{ sourceIdentifier: "synthetic" }], hasMore: false, nextCheckpoint: "next" }; },
    normalize() { if (rejectRecord) throw new Error("PRIVATE_SOURCE_PAYLOAD"); return { id: "visit" }; },
  };
  return { state, adapter, records, runs, deadLetters, checkpoint: () => checkpoint,
    management: { async upsert<T extends { id: string }>(_collection: unknown, entity: T, mode?: string, fence?: { token: string }) {
      assert.equal(mode, "replace"); assert.equal(fence?.token, "lock"); records.set(entity.id, entity);
    } } };
}

test("rejected imports remain partial and replayable without exposing upstream errors", async () => {
  const f = fixture(true);
  const result = await runIncrementalSync(f.adapter, {}, f.management, f.state);
  assert.equal(result.status, "partial");
  assert.equal(f.checkpoint(), "original");
  assert.deepEqual(f.runs, ["partial"]);
  assert.doesNotMatch(JSON.stringify(f.deadLetters), /PRIVATE_SOURCE_PAYLOAD/);
  f.adapter.normalize = () => ({ id: "visit" });
  await runIncrementalSync(f.adapter, {}, f.management, f.state);
  assert.equal(f.checkpoint(), "next");
  assert.equal(f.records.size, 1);
});

test("source snapshots replace cleared fields and replay remains idempotent", async () => {
  const f = fixture();
  f.records.set("visit", { id: "visit", actualEnd: "old", employeeId: "old" });
  await runIncrementalSync(f.adapter, {}, f.management, f.state);
  await runIncrementalSync(f.adapter, {}, f.management, f.state);
  assert.deepEqual(f.records.get("visit"), { id: "visit" });
  assert.equal(f.records.size, 1);
});

test("fetch failures retain checkpoint and persist only a fixed error code", async () => {
  const f = fixture();
  f.adapter.fetchPage = async () => { throw new Error("PRIVATE_SOURCE_PAYLOAD"); };
  await assert.rejects(runIncrementalSync(f.adapter, {}, f.management, f.state));
  assert.equal(f.checkpoint(), "original");
  assert.deepEqual(f.runs, ["sync_failed"]);
});

test("health distinguishes no sync, partial replay and age without inventing freshness", () => {
  assert.equal(integrationHealth(null, null).state, "never_synced");
  const health = integrationHealth({ integration: "hhaexchange", resource: "visit_changes_v5", updatedAt: "", lastSuccessfulAt: "2026-09-29T00:00:00Z", checkpoint: "PRIVATE_CURSOR" },
    { id: "run", integration: "hhaexchange", resource: "visit_changes_v5", startedAt: "", status: "partial", deadLetterCount: 1, errorCode: "PRIVATE_ERROR" }, new Date("2026-09-30T00:00:00Z"));
  assert.equal(health.ageSeconds, 86400);
  assert.equal(health.replayRequired, true);
  assert.equal(health.freshness, "schedule_not_configured");
  assert.doesNotMatch(JSON.stringify(health), /PRIVATE/);
});

test("single-flight acquisition precedes checkpoint reads and blocks concurrent import", async () => {
  const f = fixture(); let release!: () => void, entered!: () => void, fetches = 0;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const checkpoint = f.state.getCheckpoint;
  f.state.getCheckpoint = async resource => { entered(); await new Promise<void>(resolve => { release = resolve; }); return checkpoint(resource); };
  const fetch = f.adapter.fetchPage;
  f.adapter.fetchPage = async cursor => { fetches++; return fetch(cursor); };
  const first = runIncrementalSync(f.adapter, {}, f.management, f.state);
  await started;
  await assert.rejects(runIncrementalSync({ ...f.adapter, resource: "different_feed_version" }, {}, f.management, f.state), /sync_already_running_or_recovery_required/);
  release(); await first;
  assert.equal(fetches, 1);
  f.state.getCheckpoint = checkpoint;
  await runIncrementalSync(f.adapter, {}, f.management, f.state);
  assert.equal(fetches, 2);
});
test("ambiguous terminal persistence retains import lock and unchanged cursor for recovery", async () => {
  const f = fixture();
  f.state.succeed = async () => { throw new Error("synthetic commit interruption"); };
  f.state.fail = async () => { throw new Error("synthetic unavailable persistence"); };
  await assert.rejects(runIncrementalSync(f.adapter, {}, f.management, f.state));
  await assert.rejects(runIncrementalSync(f.adapter, {}, f.management, f.state), /sync_already_running_or_recovery_required/);
  assert.equal(f.checkpoint(), "original");
});

test("Firestore import lock transactions reject cross-instance contenders and foreign release tokens", async () => {
  const documents = new Map<string, any>(); let tail = Promise.resolve();
  const db = {
    collection(name: string) { return { doc(id: string) { return { key: name + "/" + id }; } }; },
    runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
      const pending = tail.then(async () => {
        const writes: [string, any][] = [];
        const value = await callback({ async get(ref: any) { const data = documents.get(ref.key); return { exists: !!data, data: () => structuredClone(data) }; }, set(ref: any, data: any) { writes.push([ref.key, structuredClone(data)]); } });
        for (const [key, data] of writes) documents.set(key, data);
        return value;
      });
      tail = pending.then(() => {}, () => {}); return pending;
    }
  };
  const first = new SyncStateStore(db as any), second = new SyncStateStore(db as any);
  const results = await Promise.allSettled([first.acquire("all_hha_imports"), second.acquire("all_hha_imports")]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  const token = (results.find(row => row.status === "fulfilled") as PromiseFulfilledResult<string>).value;
  await assert.rejects(second.release("all_hha_imports", "foreign-token"), /sync_lock_owner_mismatch/);
  await assert.rejects(new SyncStateStore(db as any).acquire("all_hha_imports"), /sync_already_running_or_recovery_required/);
  const stale = await first.begin("synthetic", "old", token);
  await second.release("all_hha_imports", token);
  assert.notEqual(await first.acquire("all_hha_imports"), token);
  await assert.rejects(first.succeed(stale, 1, "stale-cursor"), /sync_lock_owner_mismatch/);
  await assert.rejects(first.fail(stale, "stale-failure"), /sync_lock_owner_mismatch/);
  assert.equal(documents.has("integrationCursors/hhaexchange__synthetic"), false);
});

test("import health discloses lock state without credentials, tokens or false worker-liveness claims", () => {
  const source = { active: true, acquiredAt: "2026-09-30T00:00:00Z", token: "PRIVATE_TOKEN", resource: "PRIVATE_RESOURCE" };
  const status = importLockHealth(source);
  assert.equal(status.state, "held_worker_status_requires_verification");
  assert.equal(status.automaticTakeover, false); assert.doesNotMatch(JSON.stringify(status), /PRIVATE/);
  assert.deepEqual(importLockHealth(null), { state: "available", acquiredAt: null, automaticTakeover: false });
});


test("lost terminal acknowledgement reads committed success without overwriting health", async () => {
  const f = fixture(); const succeed = f.state.succeed;
  let terminal: Awaited<ReturnType<SyncStateStore["getRun"]>>;
  f.state.getRun = async () => terminal;
  f.state.succeed = async (sync, count, checkpoint) => {
    await succeed(sync, count, checkpoint);
    terminal = { ...sync, status: "success", processedCount: count, ...(checkpoint ? { checkpoint } : {}) };
    throw new Error("lost acknowledgement after commit");
  };
  const result = await runIncrementalSync(f.adapter, {}, f.management, f.state);
  assert.equal(result.status, "success"); assert.equal(result.processedCount, 1);
  assert.equal(result.checkpoint, "next"); assert.equal(f.checkpoint(), "next");
  assert.deepEqual(f.runs, ["success"]);
  await f.state.acquire("all_hha_imports");
});

test("unreadable terminal state retains single-flight lock rather than marking failure", async () => {
  const f = fixture();
  f.state.succeed = async () => { throw new Error("unknown commit result"); };
  f.state.getRun = async () => { throw new Error("readback unavailable"); };
  await assert.rejects(runIncrementalSync(f.adapter, {}, f.management, f.state));
  assert.deepEqual(f.runs, []);
  await assert.rejects(f.state.acquire("all_hha_imports"), /sync_already_running/);
});


test("lost partial acknowledgement preserves committed counts and replay checkpoint", async () => {
  const f = fixture(true); const partial = f.state.partial;
  let terminal: Awaited<ReturnType<SyncStateStore["getRun"]>>;
  f.state.getRun = async () => terminal;
  f.state.partial = async (sync, count, deadLetterCount) => {
    await partial(sync, count, deadLetterCount);
    terminal = { ...sync, status: "partial", processedCount: count, deadLetterCount, checkpoint: "original" };
    throw new Error("lost acknowledgement after partial commit");
  };
  const result = await runIncrementalSync(f.adapter, {}, f.management, f.state);
  assert.equal(result.status, "partial"); assert.equal(result.deadLetterCount, 1);
  assert.equal(result.checkpoint, "original"); assert.deepEqual(f.runs, ["partial"]);
  await f.state.acquire("all_hha_imports");
});
