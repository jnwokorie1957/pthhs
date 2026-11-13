import { mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { HhaSoapClient } from "../lib/integrations/hhaexchange/client.js";
import { WorkflowError, identifier } from "../lib/operations/reads.js";
import { syntheticHhaApplication } from "../lib/workforce/hhaApplicantSample.js";
import { verifyHhaApplicantUpload } from "../lib/workforce/hhaApplicantUpload.js";

async function main() {
  const env = process.env;
  if (process.argv.length !== 3 || process.argv[2] !== "--approved-sandbox") {
    throw new Error("explicit_sandbox_confirmation_required");
  }
  const endpoint = URL.parse(env.HHA_APPLICANT_TEST_ENDPOINT || "");
  if (!endpoint || !/^https:\/\/(?:implementation|sandbox|test|uat)\.hhaexchange\.com\/Integration\/ENT\/V1\.8\/ws\.asmx$/.test(endpoint.href)) {
    throw new Error("vendor_sandbox_endpoint_required");
  }
  const officeId = identifier(env.HHA_APPLICANT_TEST_OFFICE);
  if (officeId === "503324") throw new Error("production_office_disallowed");
  const documentTypeId = identifier(env.HHA_APPLICANT_TEST_DOCUMENT_TYPE);
  const discipline = env.HHA_APPLICANT_TEST_DISCIPLINE || "";
  const employeeId = env.HHA_APPLICANT_TEST_RUN_ID || "";
  if (!/^PTHHS-TEST-[A-Za-z0-9]{4,20}$/.test(employeeId)) throw new Error("unique_synthetic_run_id_required");
  if (!discipline.trim() || discipline.length > 80) throw new Error("vendor_confirmed_discipline_required");
  const credentials = {
    appName: env.HHA_APPLICANT_TEST_APP_NAME,
    appKey: env.HHA_APPLICANT_TEST_APP_KEY,
    appSecret: env.HHA_APPLICANT_TEST_APP_SECRET,
  };
  if (Object.values(credentials).some(value => !value?.trim())) throw new Error("sandbox_only_credentials_required");

  const application = syntheticHhaApplication(employeeId, officeId, new Date().toISOString());
  const directory = resolve(tmpdir(), "pthhs-hha-applicant-verification");
  await mkdir(directory, { recursive: true });
  const receiptPath = resolve(directory, employeeId + ".jsonl");
  // Exclusive creation blocks concurrent/repeated dispatch for this run ID.
  const receipt = await open(receiptPath, "ax", 0o600);
  console.log("Sandbox receipt", receiptPath);
  try {
    const client = new HhaSoapClient(endpoint.href, credentials, undefined, "error");
    const result = await verifyHhaApplicantUpload(client, application, {
      officeId, documentTypeId, discipline, gender: "Female", employeeId,
    }, async evidence => {
      await receipt.appendFile(JSON.stringify({ ...evidence, at: new Date().toISOString() }) + "\n");
      await receipt.sync();
    });
    console.log(JSON.stringify(result));
  } finally {
    await receipt.close();
  }
}

try {
  await main();
} catch (error) {
  const code = error?.code === "EEXIST" ? "sandbox_run_id_already_used"
    : error instanceof WorkflowError ? error.code
    : /^[a-z][a-z0-9_]{1,100}$/.test(error?.message || "") ? error.message : "sandbox_verification_failed";
  console.error(code);
  process.exitCode = 1;
}
