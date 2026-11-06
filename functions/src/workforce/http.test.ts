import test from "node:test";
import assert from "node:assert/strict";
import { workforceApi } from "./http.js";
async function request(path: string, method = "GET") {
  assert.ok(workforceApi);
  process.env.WORKFORCE_STAFF_APPROVED = "false";
  process.env.WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED = "false";
  let status = 200, body: unknown;
  const headers: Record<string, string> = {};
  const req = { path, method, get: () => undefined };
  const res = { set: (k: string, v: string) => { headers[k] = v; }, status: (s: number) => { status = s; return res; }, json: (b: unknown) => { body = b; return res; } };
  await workforceApi(req as unknown as Parameters<NonNullable<typeof workforceApi>>[0], res as unknown as Parameters<NonNullable<typeof workforceApi>>[1]);
  return { status, body, headers };
}
test("opportunities require sign-in even when release gates are closed", async () => {
  const result = await request("/caregiver/workforce-api/opportunities");
  assert.equal(result.status, 401); assert.deepEqual(result.body, { error: "sign_in_required" });
  assert.equal(result.headers["Cache-Control"], "no-store");
});
test("configuration cannot enable applicant collection and staff routes default closed", async () => {
  assert.deepEqual((await request("/caregiver/workforce-api/configuration")).body, { staffEnabled: false, accountsEnabled: false, applicationsEnabled: false, documentsEnabled: false, addressLookupEnabled: false, enabledSignInProviders: [],existingAccessEnabled:false });
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
  assert.deepEqual(body.packet.sourcePages, [5, 7, 9]);
  assert.ok(body.packet.fields.length > 35); assert.ok(body.inventory.length > 20);
  assert.ok(!JSON.stringify(body).includes("base64"));
});

test("name profiles and private print routes stay release-gated with no-store responses",async()=>{
 for(const path of ["/staff/accounts/candidate/profile","/staff/applications/candidate/pdf","/staff/applications/candidate/packet/pdf","/staff/applications/candidate/documents/file/print"]){
  const response=await request("/primetime/workforce-api"+path);assert.equal(response.status,503);assert.equal(response.headers["Cache-Control"],"no-store");assert.deepEqual(response.body,{error:"workforce_release_pending"});
 }
});

test("existing-caregiver provisioning is separately gated before any auth account or email can be created",async()=>{
 const response=await request("/caregiver/workforce-api/existing-caregiver/access","POST");assert.equal(response.status,503);assert.deepEqual(response.body,{error:"existing_access_pending"});assert.equal(response.headers["Cache-Control"],"no-store");
 for(const path of ["/application/hha-profile","/application/hha-files/501"]){assert.equal((await request("/caregiver/workforce-api"+path)).status,503);}
});
