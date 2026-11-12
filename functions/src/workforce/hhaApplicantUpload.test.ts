import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import type { HhaCallResponse } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { verifyHhaApplicantUpload } from "./hhaApplicantUpload.js";
import { syntheticHhaApplication } from "./hhaApplicantSample.js";

const destination = { officeId: "12", employeeId: "PTHHS-TEST-A100", documentTypeId: "55", discipline: "Synthetic", gender: "Female" as const };
const application = syntheticHhaApplication(destination.employeeId, destination.officeId, "2026-11-09T18:00:00Z");

function sandbox(failure?: "office" | "employee" | "type" | "owner" | "ack" | "category" | "bytes") {
  const calls: string[] = [], stages: string[] = [];
  let file = "", filename = "";
  const client = {
    async call(operation: string, body = "", attempts?: number): Promise<HhaCallResponse> {
      calls.push(operation);
      assert.equal(attempts, 1);
      let resultXml: string;
      switch (operation) {
        case "CreateCaregiver":
          assert.equal(extractElementText(body, "EmployeeType"), "Applicant");
          assert.equal(extractElementText(body, "OfficeID"), destination.officeId);
          assert.equal(extractElementText(body, "EmployeeID"), destination.employeeId);
          resultXml = "<CaregiverInfo><CaregiverID>101</CaregiverID></CaregiverInfo>";
          break;
        case "GetCaregiverDemographics":
          assert.equal(extractElementText(body, "ID"), "101");
          resultXml = `<CaregiverInfo><ID>101</ID><EmployeeID>${failure === "employee" ? "OTHER" : destination.employeeId}</EmployeeID><EmployeeType>${failure === "type" ? "Employee" : "Applicant"}</EmployeeType><CaregiverOffices><Office><OfficeID>${failure === "office" ? "99" : "12"}</OfficeID></Office></CaregiverOffices></CaregiverInfo>`;
          break;
        case "SearchCaregiverDocument":
          assert.equal(extractElementText(body, "CaregiverID"), "101");
          resultXml = file
            ? `<CaregiverDocuments><CaregiverDocument><CaregiverID>${failure === "owner" ? "202" : "101"}</CaregiverID><CaregiverDocID>501</CaregiverDocID><CaregiverDocumentTypeID>${failure === "category" ? "56" : "55"}</CaregiverDocumentTypeID><FileName>${filename}</FileName></CaregiverDocument></CaregiverDocuments>`
            : "<CaregiverDocuments></CaregiverDocuments>";
          break;
        case "AddCaregiverDocument":
          assert.equal(extractElementText(body, "CaregiverID"), "101");
          assert.equal(extractElementText(body, "CaregiverDocumentTypeID"), "55");
          filename = extractElementText(body, "FileName")!;
          file = extractElementText(body, "StreamData")!;
          assert.equal((await PDFDocument.load(Buffer.from(file, "base64"))).getTitle(), "Private employment application");
          resultXml = `<CaregiverID>${failure === "ack" ? "202" : "101"}</CaregiverID><CaregiverDocID>501</CaregiverDocID>`;
          break;
        case "DownloadCaregiverDocument":
          assert.equal(extractElementText(body, "CaregiverDocID"), "501");
          resultXml = `<CaregiverDocument><CaregiverDocID>501</CaregiverDocID><FileName>${filename}</FileName><StreamData>${failure === "bytes" ? "d3Jvbmc=" : file}</StreamData></CaregiverDocument>`;
          break;
        default: throw new Error(`Unexpected operation ${operation}`);
      }
      return { operation, ok: true, status: "Success", resultXml, attempts: 1 } as HhaCallResponse;
    },
  };
  return {
    calls, stages, run: (input = application) => verifyHhaApplicantUpload(client, input, destination, async evidence => {
      stages.push(evidence.stage);
    }),
  };
}

test("signed application is uploaded to the returned applicant and verified by downloading the same PDF", async () => {
  const f = sandbox();
  const result = await f.run();
  assert.equal(result.caregiverId, "101");
  assert.equal(result.documentId, "501");
  assert.deepEqual(f.stages, ["creating_applicant", "applicant_created", "attaching_pdf", "pdf_acknowledged", "verified"]);
  assert.deepEqual(f.calls, [
    "CreateCaregiver", "GetCaregiverDemographics", "SearchCaregiverDocument", "AddCaregiverDocument",
    "SearchCaregiverDocument", "DownloadCaregiverDocument", "GetCaregiverDemographics", "SearchCaregiverDocument",
  ]);
});

test("a draft, wrong office, wrong external identity or employee status cannot attach a PDF", async () => {
  const f = sandbox();
  await assert.rejects(f.run({ ...application, state: "draft", signature: null }), /signed_application/);
  assert.deepEqual(f.calls, []);
  for (const mismatch of ["office", "employee", "type"] as const) {
    const target = sandbox(mismatch);
    await assert.rejects(target.run(), /applicant_identity_unverified/);
    assert.ok(!target.calls.includes("AddCaregiverDocument"));
  }
});

test("a wrong owner, upload acknowledgment, category or PDF cannot produce a verified receipt", async () => {
  for (const [mode, error] of [
    ["owner", /caregiver_document_owner_unverified/],
    ["ack", /application_attachment_unconfirmed/],
    ["category", /application_document_target_unverified/],
    ["bytes", /application_pdf_readback_mismatch/],
  ] as const) {
    const f = sandbox(mode);
    await assert.rejects(f.run(), error);
    assert.ok(!f.stages.includes("verified"));
    assert.equal(f.calls.filter(op => op === "AddCaregiverDocument").length, 1);
  }
});
