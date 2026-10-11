import assert from "node:assert/strict";
import test from "node:test";
import { OperationsWorkspace, type Settings, type Versioned, type WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError } from "../operations/reads.js";
import { RevisionBackend, type RevisionActor } from "./service.js";
import { revisionRoute } from "./routes.js";

class Repository implements WorkspaceRepository {
  records = new Map<string, Versioned>(); changes = 0;
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> { return structuredClone(this.records.get(collection + "/" + id) as T ?? null); }
  async list<T extends Versioned>(collection: string): Promise<T[]> { return [...this.records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, item]) => structuredClone(item) as T); }
  async page<T extends Versioned>(collection: string) { return { items: await this.list<T>(collection), nextCursor: null }; }
  async change<T extends Versioned>(collection: string, id: string, expected: number, _actor: string, _action: string, update: (prior: T | null) => T): Promise<T> {
    const key = collection + "/" + id, prior = this.records.get(key) as T ?? null;
    if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
    const next = update(structuredClone(prior)); this.records.set(key, structuredClone(next)); this.changes++; return structuredClone(next);
  }
  async reserveRead() {} async deferReads() {} async getWriteTarget() { return null; } async reserveWriteTarget() {} async releaseWriteTarget() {}
}
const actor: RevisionActor = { actorId: "synthetic-admin", roles: ["admin"], mode: "live" };
function fixture(data = true) {
  const repository = new Repository(), settings: Settings = { id: "owner", revision: 1, updatedAt: "2026-10-10T17:20:00Z", officeId: "123", officeTimezone: "America/Chicago",
    enabledReads: ["SearchVisitsV2", "GetVisitInfoV3"], policyReference: "Synthetic policy", missingClockInMinutes: null, missingClockOutMinutes: null };
  repository.records.set("workspaceSettings/owner", settings); let sourceCalls = 0;
  const workspace = new OperationsWorkspace(repository, async () => { sourceCalls++; throw new WorkflowError("synthetic_vendor_backoff", 429, 20); }, data);
  const backend = new RevisionBackend(repository, workspace, { data, source: false, monitor: false, smsCapability: false, smsConfiguration: false, smsSend: false }, undefined, () => new Date("2026-10-10T17:20:00Z"));
  return { repository, backend, calls: () => sourceCalls };
}
test("revision router ignores unrelated paths and returns real safe status metadata", async () => {
  const f = fixture(); assert.equal(await revisionRoute(f.backend, actor, "GET", "/session", {}), null);
  const status = await revisionRoute(f.backend, actor, "GET", "/revisions/status", {});
  assert.equal(status?.status, 200); assert.equal((status?.body as Record<string, unknown>).sourceWritesEnabled, false);
  assert.equal(f.calls(), 0);
});
test("browser exception creation, diagnosis injection, source acceptance and delivery routes are unavailable", async () => {
  const f = fixture();
  for (const path of ["/revisions/exceptions/save", "/revisions/exceptions/create", "/revisions/diagnose", "/revisions/source-acceptance", "/revisions/notifications/send", "/revisions/notifications/queue", "/revisions/sms/status"]) {
    const result = await revisionRoute(f.backend, actor, "POST", path, { officeId: "123", sourceValidation: "accepted", conditionActive: true });
    assert.equal(result?.status, 404); assert.deepEqual(result?.body, { ok: false, error: "revision_route_not_found" });
  }
  assert.equal(f.repository.changes, 0); assert.equal(f.calls(), 0);
});
test("unsupported fields, malformed cursor types and unsupported methods do not dispatch or mutate", async () => {
  const f = fixture();
  for (const [path, value] of [["/revisions/status", { acceptance: true }], ["/revisions/policy", { sourceApproved: true }], ["/revisions/contacts", { cursor: ["bad"] }], ["/revisions/requirements", { cursor: 1 }], ["/revisions/notifications", { cursor: {} }]] as const) {
    assert.equal((await revisionRoute(f.backend, actor, "GET", path, value))?.status, 400);
  }
  assert.equal((await revisionRoute(f.backend, actor, "DELETE", "/revisions/policy", {}))?.status, 405);
  assert.equal(f.repository.changes, 0); assert.equal(f.calls(), 0);
});
test("real backend approval and role errors are serialized with no protected facts", async () => {
  const disabled = fixture(false), f = fixture();
  assert.deepEqual((await revisionRoute(disabled.backend, actor, "GET", "/revisions/visits", { date: "2026-10-10" }))?.body, { ok: false, error: "operational_data_release_not_approved" });
  assert.equal(disabled.calls(), 0);
  assert.equal((await revisionRoute(f.backend, { ...actor, mode: "demo" }, "GET", "/revisions/status", {}))?.status, 423);
  assert.equal((await revisionRoute(f.backend, { ...actor, roles: ["caregiver"] }, "GET", "/revisions/status", {}))?.status, 403);
  const backoff = await revisionRoute(f.backend, actor, "GET", "/revisions/visits", { date: "2026-10-10" });
  assert.equal(backoff?.status, 429); assert.deepEqual(backoff?.body, { ok: false, error: "synthetic_vendor_backoff", retryAfterSeconds: 20 });
});
test("real policy and contact routes retain review boundary and infer the user's +1 preference", async () => {
  const f = fixture(), input = { id: "caregiver_6", revision: 0, kind: "caregiver", phone: "832-403-0094", firstName: "Synthetic", smsAllowed: true, optedOut: false, reviewReference: "Synthetic contact review" };
  const result = await revisionRoute(f.backend, actor, "POST", "/revisions/contacts", input);
  assert.equal(result?.status, 200); assert.equal((result?.body as Record<string, unknown>).phone, "+18324030094");
  assert.equal((await revisionRoute(f.backend, actor, "POST", "/revisions/contacts", input))?.status, 409);
  const policy = await revisionRoute(f.backend, actor, "GET", "/revisions/policy", {});
  assert.equal(policy?.status, 200); assert.equal((policy?.body as Record<string, unknown>).earlyReminderMinutes, null);
  assert.equal(f.calls(), 0);
});
