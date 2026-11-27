import assert from "node:assert/strict";
import test from "node:test";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const cwd = fileURLToPath(new URL("../portal-test-build/", import.meta.url));
const project = "demo-portal-fixture";
const sender = "portal-qa@example.invalid";
function start(overrides, script = 'await import("./lib/portalTestEntry.js")') {
  const env = {PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GCLOUD_PROJECT: project, PORTAL_TEST_PROJECT: project, PORTAL_TEST_SENDER: sender, ...overrides};
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {cwd, env, encoding: "utf8"});
}
test("test artifact configures both handlers and all document resources", () => {
  const result = start({}, `
    import assert from "node:assert/strict";
    const manifest = JSON.parse((await import("node:fs")).readFileSync("package.json","utf8"));
    const portal = await import("./" + manifest.main);
    assert.deepEqual(Object.keys(portal).sort(), ["workforceApi", "workforceDocumentDecrypt"]);
    assert.equal(typeof portal.workforceApi,"function");
    assert.equal(typeof portal.workforceDocumentDecrypt,"function");
    const {resources} = await import("./lib/portalResources.js");
    const {FORM_BUCKET} = await import("./lib/forms/library.js");
    assert.deepEqual(resources, {project:"demo-portal-fixture", bucket:"demo-portal-fixture-portal-iam-test",sender:"portal-qa@example.invalid",testKey:"projects/demo-portal-fixture/locations/us-central1/keyRings/portal-test/cryptoKeys/documents"});
    assert.equal(FORM_BUCKET, resources.bucket);
    assert.equal(process.env.WORKFORCE_DOCUMENT_KMS_KEY, resources.testKey);
    const {kmsDocumentCipher} = await import("./lib/workforce/documentEncryption.js");
    assert.ok(kmsDocumentCipher());
    process.env.WORKFORCE_DOCUMENT_KMS_KEY += "-foreign";
    assert.throws(kmsDocumentCipher);
    const {GraphVerificationTransport} = await import("./lib/workforce/verificationMail.js");
    const uuid = "00000000-0000-4000-8000-000000000000";
    const requests = [];
    const transport = new GraphVerificationTransport(uuid, uuid, async (url, init) => {
      requests.push([url, init]);
      return requests.length === 1 ? Response.json({access_token:"fake",token_type:"Bearer"}) : new Response(null,{status:202});
    }, async () => "fake-assertion");
    await (await transport.prepare())({to:"applicant@example.invalid",code:"123456"});
    assert.equal(requests[1][0],"https://graph.microsoft.com/v1.0/users/portal-qa%40example.invalid/sendMail");
    assert.equal(JSON.parse(requests[1][1].body).message.toRecipients[0].emailAddress.address, resources.sender);
  `);
  assert.equal(result.status, 0, result.stderr);
});
test("test artifact refuses missing or mismatched resources before serving", () => {
  for (const overrides of [
    {PORTAL_TEST_PROJECT:""}, {PORTAL_TEST_SENDER:""}, {GCLOUD_PROJECT:"different-project"},
    {PORTAL_TEST_PROJECT:"primetimehomehealthservices",GCLOUD_PROJECT:"primetimehomehealthservices"},
    {FIREBASE_CONFIG:JSON.stringify({projectId:"different-project"})},
    {WORKFORCE_DOCUMENT_KMS_KEY:"projects/foreign/locations/us-central1/keyRings/portal-test/cryptoKeys/documents"},
  ]) {
    const result = start(overrides);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Portal test|PORTAL_TEST_SENDER/);
  }
});
