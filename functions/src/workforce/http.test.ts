import test from "node:test";
import assert from "node:assert/strict";
import { workforceApi } from "./http.js";
async function request(path: string, method = "GET") {
  assert.ok(workforceApi);
  process.env.WORKFORCE_STAFF_APPROVED = "false";
  process.env.WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED = "false";
  let status = 200, body: unknown;
  const headers: Record<string, string> = {};
  const req = { path, method };
  const res = { set: (k: string, v: string) => { headers[k] = v; }, status: (s: number) => { status = s; return res; }, json: (b: unknown) => { body = b; return res; } };
  await workforceApi(req as Parameters<NonNullable<typeof workforceApi>>[0], res as unknown as Parameters<NonNullable<typeof workforceApi>>[1]);
  return { status, body, headers };
}
test("public release remains empty without querying storage or requiring authentication", async () => {
  const result = await request("/caregiver/workforce-api/opportunities");
  assert.equal(result.status, 200); assert.deepEqual(result.body, { items: [], release: "pending" });
  assert.equal(result.headers["Cache-Control"], "no-store");
});
test("configuration cannot enable applicant collection and staff routes default closed", async () => {
  assert.deepEqual((await request("/caregiver/workforce-api/configuration")).body, { staffEnabled: false, accountsEnabled: false, applicationsEnabled: false, documentsEnabled: false });
  const result = await request("/primetime/workforce-api/staff/opportunities", "POST");
  assert.equal(result.status, 503); assert.deepEqual(result.body, { error: "workforce_release_pending" });
});
test("application and document writes fail closed before authentication or storage", async () => {
  for (const path of ["/application", "/application/submit", "/application/documents", "/application/documents/other-user-file"]) {
    const result = await request("/caregiver/workforce-api" + path, "POST");
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, { error: "application_collection_pending" });
  }
});
test("packet schema exposes blank questions and provenance, never an original scan or completed data", async () => {
  const response = await request("/caregiver/workforce-api/application/packet");
  assert.equal(response.status, 200);
  const body = response.body as { packet: { sourcePages: number[]; fields: unknown[] }; inventory: unknown[] };
  assert.deepEqual(body.packet.sourcePages, [3, 4, 5]);
  assert.ok(body.packet.fields.length > 50); assert.ok(body.inventory.length > 20);
  assert.ok(!JSON.stringify(body).includes("base64"));
});
