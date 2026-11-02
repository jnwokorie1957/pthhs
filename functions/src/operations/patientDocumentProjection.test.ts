import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead, boundedAttachment, readInputFields, type ReadInput } from "./reads.js";

function read(xml: string, operation: ReadInput["operation"] = "SearchPatientDocument", extra: Partial<ReadInput> = {}) {
  return operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: xml }; } },
    { operation, patientId: "8", ...(operation === "DownloadPatientDocument" ? { id: "9" } : {}), ...extra });
}
const row = (id = "9", patient = "8") => '<PatientDocument><PatientDocID>' + id + '</PatientDocID><PatientID>' + patient + '</PatientID><PatientDocumentTypeID>7</PatientDocumentTypeID><FileName>synthetic.pdf</FileName><CreatedOn>2026-11-02T10:00:00</CreatedOn></PatientDocument>';

test("patient document metadata identities use direct paths and enforce all returned subjects before truncation", async () => {
  for (const xml of ['<PatientDocuments>' + row("9", "99") + '</PatientDocuments>', '<PatientDocuments><PatientDocument><PatientDocID>9</PatientDocID><Other><PatientID>8</PatientID></Other></PatientDocument></PatientDocuments>',
    '<PatientDocuments><PatientDocument><PatientDocID>9</PatientDocID><PatientID>8</PatientID><PatientID>8</PatientID></PatientDocument></PatientDocuments>',
    '<PatientDocuments>' + Array.from({ length: 200 }, (_, i) => row(String(i + 1))).join('') + row("201", "99") + '</PatientDocuments>']) {
    await assert.rejects(read(xml), /patient_document_identity_unverified|patient_document_patient_mismatch/);
  }
});

test("patient document roots, duplicate IDs, nil-with-content and non-direct collection records are refused", async () => {
  for (const xml of ['<Wrapper><PatientDocuments>' + row() + '</PatientDocuments></Wrapper>', '<PatientDocuments>' + row() + row() + '</PatientDocuments>',
    '<PatientDocuments><Wrapper>' + row() + '</Wrapper></PatientDocuments>', '<PatientDocuments/ ><PatientDocuments/>',
    '<PatientDocuments xsi:nil="true">' + row() + '</PatientDocuments>', '<PatientDocuments>' + row() + '</PatientDocument>']) {
    await assert.rejects(read(xml), /patient_document_response_shape_unverified|patient_document_identity_unverified/);
  }
  for (const xml of ['<Status>Success</Status>', '<PatientDocuments/>', '<PatientDocuments xsi:nil="true"/>']) assert.deepEqual((await read(xml)).records, []);
});

test("exact document/type filters must be honored by every source row", async () => {
  await assert.rejects(read('<PatientDocuments>' + row() + '</PatientDocuments>', "SearchPatientDocument", { id: "99" }), /patient_document_filter_not_honored/);
  await assert.rejects(read('<PatientDocuments>' + row() + '</PatientDocuments>', "SearchPatientDocument", { documentTypeId: "99" }), /patient_document_filter_not_honored/);
});

test("metadata omits content/actors/descriptions and preserves blank, zero and unknown optional fields", async () => {
  const data = await read('<PatientDocuments><PatientDocument><PatientDocID>9</PatientDocID><PatientID>8</PatientID><FileSize>0</FileSize><FileName/><PatientDocumentType><Name>private-nested</Name></PatientDocumentType><Description>private-description</Description><CreatedBy>private-actor</CreatedBy><StreamData>private-content</StreamData></PatientDocument></PatientDocuments>');
  assert.equal(data.records[0]!.FileSize, "0"); assert.equal(data.records[0]!.FileName, ""); assert.equal(data.records[0]!.PatientDocumentType, null);
  assert.doesNotMatch(JSON.stringify(data), /private-/);
});

test("optional download size can be unknown or explicitly empty without becoming zero; declared invalid/mismatched size still fails", async () => {
  for (const FileSize of [undefined, null, ""]) {
    const data = boundedAttachment({ PatientDocID: "9", FileName: "synthetic.pdf", StreamData: "dGVzdA==", ...(FileSize === undefined ? {} : { FileSize }) }, "PatientDocID", "9");
    assert.equal(data.byteLength, 4);
  }
  for (const FileSize of ["0", "3", "5", " ", "4KB", "-1", "4.0"]) assert.throws(() => boundedAttachment({ PatientDocID: "9", FileSize, StreamData: "dGVzdA==" }, "PatientDocID", "9"), /download_size_mismatch/);
  const data = await read('<PatientDocument><PatientDocID>9</PatientDocID><FileName>synthetic.pdf</FileName><StreamData>dGVzdA==</StreamData></PatientDocument>', "DownloadPatientDocument");
  assert.equal(data.attachment!.byteLength, 4); assert.equal(data.records[0]!.FileSize, null); assert.equal(data.records[0]!.StreamData, undefined);
});

test("download identities cannot be borrowed, duplicate or nested, and bytes remain bounded and canonical", async () => {
  for (const xml of ['<Other><PatientDocument><PatientDocID>9</PatientDocID><StreamData>dGVzdA==</StreamData></PatientDocument></Other>',
    '<PatientDocument><Other><PatientDocID>9</PatientDocID></Other><StreamData>dGVzdA==</StreamData></PatientDocument>',
    '<PatientDocument><PatientDocID>9</PatientDocID><PatientDocID>9</PatientDocID><StreamData>dGVzdA==</StreamData></PatientDocument>',
    '<PatientDocument><PatientDocID>9</PatientDocID><StreamData><Other>dGVzdA==</Other></StreamData></PatientDocument>']) await assert.rejects(read(xml, "DownloadPatientDocument"), /patient_document_response_shape_unverified|patient_document_identity_unverified|invalid_or_oversize_download/);
  for (const StreamData of ["garbage!", "dGVzdB==", "YQ==".repeat(700000)]) assert.throws(() => boundedAttachment({ PatientDocID: "9", StreamData }, "PatientDocID", "9"), /invalid_or_oversize_download|download_size_mismatch/);
});

test("public document input metadata requires patient/office for metadata and bounded file retrieval", () => {
  assert.deepEqual(readInputFields("SearchPatientDocument"), ["patientId", "officeId", "documentTypeId", "id", "date"]);
  assert.deepEqual(readInputFields("DownloadPatientDocument"), ["patientId", "officeId", "id"]);
});

test("ambiguous/nested declared sizes cannot bypass attachment validation; internal description scope remains separate", async () => {
  for (const size of ['<FileSize>4</FileSize><FileSize>99</FileSize>', '<FileSize><Value>4</Value></FileSize>', '<FileSize xsi:nil="true">4</FileSize>']) {
    await assert.rejects(read('<PatientDocument><PatientDocID>9</PatientDocID><StreamData>dGVzdA==</StreamData>' + size + '</PatientDocument>', "DownloadPatientDocument"), /patient_document_response_shape_unverified/);
  }
  const xml = '<PatientDocuments><PatientDocument><PatientDocID>9</PatientDocID><PatientID>8</PatientID><Description>Internal synthetic description</Description><CreatedBy>private-actor</CreatedBy></PatientDocument></PatientDocuments>';
  const client = { async call(operation: string) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: xml }; } };
  const data = await operationalRead(client, { operation: "SearchPatientDocument", patientId: "8", id: "9" }, "document_metadata");
  assert.equal(data.records[0]!.Description, "Internal synthetic description"); assert.doesNotMatch(JSON.stringify(data), /private-actor/);
});
