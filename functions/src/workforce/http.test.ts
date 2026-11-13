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
  assert.deepEqual((await request("/caregiver/workforce-api/configuration")).body, { staffEnabled: false, accountsEnabled: false, applicationsEnabled: false, documentsEnabled: false, addressLookupEnabled: false, enabledSignInProviders: [],existingAccessEnabled:false,existingCaregiverEnrollmentReady:false });
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

 test("HHA account release permits source access configuration without enabling applicant or upload collection",async()=>{
 process.env.WORKFORCE_STAFF_APPROVED="true";process.env.WORKFORCE_HHA_PORTAL_APPROVED="true";process.env.PRIMETIME_OPERATIONAL_DATA_APPROVED="true";process.env.WORKFORCE_APPLICANT_COLLECTION_APPROVED="false";
 let body:any;const res={set(){return res;},json(value:any){body=value;return res;}};
 await workforceApi!({path:"/configuration",method:"GET"} as any,res as any);
 assert.equal(body.existingAccessEnabled,true);assert.equal(body.accountsEnabled,true);assert.equal(body.applicationsEnabled,false);assert.equal(body.documentsEnabled,false);
 for(const key of ["WORKFORCE_STAFF_APPROVED","WORKFORCE_HHA_PORTAL_APPROVED","PRIMETIME_OPERATIONAL_DATA_APPROVED","WORKFORCE_APPLICANT_COLLECTION_APPROVED"])delete process.env[key];
 });

test('expired caregiver preview closes all caregiver entry points without opening collection',async()=>{
 process.env.WORKFORCE_PORTAL_PREVIEW_UNTIL='2000-01-01T00:00:00.000Z';process.env.WORKFORCE_PORTAL_LAUNCH_AT='2099-01-01T06:00:00.000Z';
 try{for(const path of ['/application/session','/application/packet','/application/hha-profile','/application/hha-files/1','/existing-caregiver/access','/opportunities']){const result=await request('/caregiver/workforce-api'+path);assert.equal(result.status,503);assert.deepEqual(result.body,{error:'caregiver_preview_closed'});}const result=await request('/caregiver/workforce-api/configuration');assert.equal((result.body as any).portalClosed,true);assert.equal((result.body as any).accountsEnabled,false);assert.equal((result.body as any).documentsEnabled,false);}
 finally{delete process.env.WORKFORCE_PORTAL_PREVIEW_UNTIL;delete process.env.WORKFORCE_PORTAL_LAUNCH_AT;}
});
