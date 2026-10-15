import test from "node:test";
import assert from "node:assert/strict";
import { calendarCapture, manualSnapshotRoute } from "./manualSnapshots.js";
import { WorkflowError } from "./reads.js";
import type { OperationsWorkspace, WorkspaceRepository } from "./workspace.js";

function capture() { return { version: 1, source: "hhaexchange_ui", officeId: "12", patientId: "13", patientLabel: "Synthetic patient",
  period: "2026-09", capturedAt: "2026-10-01T10:00:00.000Z", authorizations: { columns: ["Payer", "Hours"], rows: [{ cells: ["Synthetic payer", "12 hrs"] }] },
  visits: [{ id: "14", date: "2026-09-30", text: "S: 09:00 AM - 11:00 AM\nV: 09:02 AM - 11:02 AM\nBilled: Y" }] }; }
function fixture() {
  const rows = new Map<string, any>(), audit: string[] = [];
  let approved = true, office = "12", patientOffice = "12", revision = 1, changePolicy = false;
  const repository = {
    async get(collection: string, id: string) { return rows.get(collection + "/" + id) ?? null; },
    async page(collection: string) { return { items: [...rows].filter(([key]) => key.startsWith(collection + "/")).map(([, value]) => value), nextCursor: null }; },
    async change(collection: string, id: string, expected: number, _actor: string, action: string, update: (prior: any) => any) {
      if (rows.has(collection + "/" + id) || expected !== 0) throw new WorkflowError("revision_conflict", 409);
      const result = update(null); rows.set(collection + "/" + id, result); audit.push(action); return result;
    }
  } as unknown as WorkspaceRepository;
  const workspace = {
    async settings() { return { dataApproved: approved, settings: { officeId: office, revision, enabledReads: ["GetPatientDemographics"] } }; },
    async query(input: { id: string }) { if (changePolicy) revision++; return { source: "hhaexchange", operation: "GetPatientDemographics", truncated: false, records: [{ PatientID: input.id, OfficeID: patientOffice }] }; }
  } as unknown as OperationsWorkspace;
  return { rows, audit, repository, workspace, set: (key: string, value: any) => { if (key === "approved") approved = value; if (key === "office") office = value; if (key === "patientOffice") patientOffice = value; if (key === "changePolicy") changePolicy = value; },
    call: (method: string, value: unknown) => manualSnapshotRoute(workspace, repository, method, value, "synthetic-admin") };
}
test("manual calendar imports are durable, immutable, scoped and idempotent", async () => {
  const f = fixture(); const saved: any = await f.call("POST", capture());
  assert.equal(saved.status, 200); assert.equal(saved.body.duplicate, false);
  assert.equal(saved.body.snapshot.validation, "manual_source_unvalidated");
  const repeated = { ...capture(), capturedAt: "2026-10-02T10:00:00.000Z" };
  assert.equal((await f.call("POST", repeated)).body.duplicate, true); assert.equal(f.rows.size, 1); assert.equal(f.audit.length, 1);
  const changed = capture(); changed.visits[0]!.text = "Changed source facts";
  await f.call("POST", changed); assert.equal(f.rows.size, 2);
  const list: any = await f.call("GET", { patientId: "13" });
  assert.equal(list.body.items.length, 2); assert.equal(list.body.items[0].visitCount, 1);
  assert.equal("visits" in list.body.items[0], false);
  const read: any = await f.call("GET", { patientId: "13", id: saved.body.snapshot.id });
  assert.equal(read.body.snapshot.visits[0].text, capture().visits[0]!.text);
  assert.equal((await f.call("GET", { patientId: "99", id: saved.body.snapshot.id })).status, 404);
});
test("manual source access checks current approval, patient office and policy", async () => {
  const f = fixture(); f.set("approved", false);
  assert.equal((await f.call("POST", capture())).status, 423);
  f.set("approved", true); f.set("patientOffice", "90");
  assert.equal((await f.call("POST", capture())).status, 403);
  assert.equal((await f.call("GET", { patientId: "13" })).status, 403);
  f.set("patientOffice", "12"); f.set("office", "11");
  assert.equal((await f.call("POST", capture())).status, 403);
  f.set("office", "12"); f.set("changePolicy", true);
  assert.equal((await f.call("POST", capture())).status, 409); assert.equal(f.rows.size, 0);
});
test("capture validation rejects duplicate visits, wrong dates, extra fields and malformed tables", () => {
  const a = capture(); a.visits.push(a.visits[0]!); assert.throws(() => calendarCapture(a), /invalid_calendar_capture/);
  for (const date of ["2026-09-31", "2026-10-01", "2026-09-99", "2026-09-00"]) { const value = capture(); value.visits[0]!.date = date; assert.throws(() => calendarCapture(value), /invalid_calendar_capture/); }
  assert.throws(() => calendarCapture({ ...capture(), extra: "ignored" }), /invalid_calendar_capture/);
  const b = capture(); b.authorizations.rows[0]!.cells.pop(); assert.throws(() => calendarCapture(b), /invalid_calendar_capture/);
  assert.throws(() => calendarCapture({ ...capture(), capturedAt: "2099-01-01T00:00:00.000Z" }), /invalid_calendar_capture/);
});
