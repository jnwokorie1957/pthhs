import test from "node:test";
import assert from "node:assert/strict";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreWorkspaceRepository } from "./workspace.js";
import type { ReadHealthEvent } from "./readHealth.js";
const event: ReadHealthEvent = { operation: "SearchBilledVisits", officeId: "12", settingsRevision: 8, checkedAt: "2026-11-02T19:00:00.000Z", outcome: "empty", records: 0, truncated: false };
function fixture() {
  const docs = new Map<string, unknown>([["workspaceSettings/owner", { revision: 8, officeId: "12" }]]), writes: unknown[] = [];
  const snapshot = (ref: { path: string }) => ({ id: ref.path.split("/").at(-1), exists: docs.has(ref.path), data: () => docs.get(ref.path) });
  const db = {
    collection: (collection: string) => ({ doc: (id: string) => ({ path: collection + "/" + id }) }),
    async runTransaction(action: (tx: unknown) => unknown) { return action({ async get(ref: { path: string }) { return snapshot(ref); }, set(ref: { path: string }, value: unknown) { docs.set(ref.path, value); writes.push(value); } }); },
    async getAll(...refs: { path: string }[]) { return refs.map(snapshot).reverse(); }
  } as unknown as ReturnType<typeof getFirestore>;
  return { docs, writes, repository: new FirestoreWorkspaceRepository(db) };
}
test("receipt persistence atomically rejects old preferences and out-of-order events without borrowing old success", async () => {
  const f = fixture(); await f.repository.noteReadHealth(event);
  assert.equal(f.writes.length, 1);
  await f.repository.noteReadHealth({ ...event, checkedAt: "2026-11-02T18:59:00.000Z" });
  await f.repository.noteReadHealth({ ...event, settingsRevision: 7 });
  assert.equal(f.writes.length, 1);
  f.docs.set("workspaceSettings/owner", { revision: 9, officeId: "99" });
  await f.repository.noteReadHealth(event); assert.equal(f.writes.length, 1);
  await f.repository.noteReadHealth({ ...event, settingsRevision: 9, officeId: "99", checkedAt: "2026-11-02T19:01:00.000Z", outcome: "failed", records: null, truncated: null });
  assert.equal(f.writes.length, 2);
  assert.equal((f.writes[1] as { lastSuccess: unknown }).lastSuccess, null);
});
test("stored receipt shape excludes injected source/private fields and metadata lookup accepts only known methods", async () => {
  const f = fixture();
  await f.repository.noteReadHealth(Object.assign({ ...event }, { patientId: "private-synthetic-marker", xml: "private-synthetic-marker" }));
  const rows = await f.repository.getReadHealth([event.operation]);
  assert.equal(rows.length, 1); assert.equal((rows[0] as ReadHealthEvent).operation, event.operation); assert.equal(JSON.stringify(rows).includes("private-synthetic-marker"), false);
  await f.repository.noteReadHealth({ ...event, operation: "GetVisitInfoV3" });
  const reversed = await f.repository.getReadHealth([event.operation, "GetVisitInfoV3"]);
  assert.deepEqual(reversed.map(row => (row as ReadHealthEvent).operation), [event.operation, "GetVisitInfoV3"]);
  assert.deepEqual(await f.repository.getReadHealth([]), []);
  await assert.rejects(f.repository.getReadHealth(["private-synthetic-marker"]), /invalid_read_health_operation/);
});
