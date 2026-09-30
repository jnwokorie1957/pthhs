import assert from "node:assert/strict";
import test from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import { ManagementStore } from "./firestore.js";

test("replacement clears current fields while retaining immutable source history", async () => {
  const data = new Map<string, any>();
  const db = {
    collection: (collection: string) => ({ doc: (id: string) => ({ path: `${collection}/${id}` }) }),
    async runTransaction(run: (transaction: any) => Promise<void>) {
      await run({
        async get(ref: { path: string }) { return { exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) }; },
        set(ref: { path: string }, value: any, options: any) { data.set(ref.path, structuredClone(options?.merge ? { ...data.get(ref.path), ...value } : value)); },
        create(ref: { path: string }, value: any) { assert.equal(data.has(ref.path), false); data.set(ref.path, structuredClone(value)); },
        delete(ref: { path: string }) { data.delete(ref.path); },
      });
    },
  } as unknown as Firestore;
  const store = new ManagementStore(db);
  const base = { id: "synthetic-visit", patientId: "synthetic-patient", externalReferences: [{ system: "hhaexchange" as const, entityType: "visit", externalId: "synthetic", lastSyncedAt: "first", sourceVersionHash: "version-one" }] };
  await store.upsert("visits", { ...base, actualEnd: "original-clock", employeeId: "original-assignee" }, "replace");
  const updated = { ...base, externalReferences: [{ ...base.externalReferences[0]!, sourceVersionHash: "version-two" }] };
  await store.upsert("visits", updated, "replace");
  assert.equal(data.get("visits/synthetic-visit").actualEnd, undefined);
  assert.equal(data.get("visits/synthetic-visit").employeeId, undefined);
  const history = [...data.entries()].filter(([key]) => key.startsWith("visitImportHistory/"));
  assert.equal(history.length, 2);
  assert.ok(history.some(([, value]) => value.snapshot.actualEnd === "original-clock"));
  await store.upsert("visits", { ...updated, externalReferences: [{ ...updated.externalReferences[0]!, lastSyncedAt: "replayed" }] }, "replace");
  assert.deepEqual([...data.entries()].filter(([key]) => key.startsWith("visitImportHistory/")), history);
});

test("import transaction fences reject delayed writes after lock release or replacement", async () => {
  let lock = { active: true, token: "new-owner" }, writes = 0;
  const db = {
    collection: (collection: string) => ({ doc: (id: string) => ({ path: collection + "/" + id }) }),
    async runTransaction(run: (transaction: any) => Promise<void>) {
      await run({ async get(ref: { path: string }) { return { exists: ref.path.startsWith("integrationLocks/"), data: () => lock }; }, set() { writes++; }, create() { writes++; }, delete() { writes++; } });
    }
  } as unknown as Firestore;
  const store = new ManagementStore(db);
  await assert.rejects(store.upsert("patients", { id: "synthetic" }, "replace", { token: "old-owner" }), /sync_lock_owner_mismatch/);
  lock = { active: false, token: "old-owner" };
  await assert.rejects(store.upsert("patients", { id: "synthetic" }, "replace", { token: "old-owner" }), /sync_lock_owner_mismatch/);
  assert.equal(writes, 0);
});
