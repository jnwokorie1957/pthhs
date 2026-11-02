import assert from "node:assert/strict";
import test from "node:test";
import { parseHhaSoapResponse } from "../integrations/hhaexchange/parser.js";
import { operationalRead, type ReadInput } from "./reads.js";

const cases: { input: ReadInput; body: string; key: string; expected: string }[] = [
  { input: { operation: "SearchPatientDocument", patientId: "8" }, body: '<PatientDocuments><PatientDocument><PatientDocID>9</PatientDocID><PatientID>8</PatientID><FileName>synthetic.pdf</FileName></PatientDocument></PatientDocuments>', key: "PatientDocID", expected: "9" },
  { input: { operation: "DownloadPatientDocument", id: "9" }, body: '<PatientDocument><PatientDocID>9</PatientDocID><FileName>synthetic.pdf</FileName><StreamData>dGVzdA==</StreamData></PatientDocument>', key: "PatientDocID", expected: "9" },
  { input: { operation: "SearchPatientPOC", patientId: "8" }, body: '<PatientPOC><POC><ID>7</ID><POCNumber>0</POCNumber></POC></PatientPOC>', key: "ID", expected: "7" },
  { input: { operation: "GetPatientPOCInfo", id: "7" }, body: '<POCInfo><Patient><ID>8</ID></Patient><ID>7</ID><Tasks><Task><ID>1</ID><Category><Name>private-category</Name></Category><Name>Correct task</Name></Task></Tasks></POCInfo>', key: "ID", expected: "7" }
];
function client(payload: string) { return { async call(operation: string) {
  const envelope = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><' + operation + 'Response xmlns="https://www.hhaexchange.com/apis/"><' + operation + 'Result>' + payload + '</' + operation + 'Result></' + operation + 'Response></soap:Body></soap:Envelope>';
  return { ...parseHhaSoapResponse(operation, 200, true, envelope), correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false };
} }; }

for (const { input, body, key, expected } of cases) test(input.operation + " accepts the captured BaseResponse Result through the real SOAP parser", async () => {
  for (const metadata of ['<Result Status="Success"/>', '<Result Status="Success"><ErrorInfo><ErrorID>0</ErrorID><ErrorMessage/></ErrorInfo><Details><ErrorDetails>private-diagnostic</ErrorDetails></Details></Result>']) {
    const result = await operationalRead(client(metadata + body), input);
    assert.equal(result.records.length, 1); assert.equal(result.records[0]![key], expected);
    if (input.operation === "GetPatientPOCInfo") assert.equal(JSON.parse(result.records[0]!.Tasks!)[0].Name, "Correct task");
    if (input.operation === "DownloadPatientDocument") assert.equal(result.attachment!.byteLength, 4);
    assert.doesNotMatch(JSON.stringify(result), /private-/);
  }
});

test("failed SOAP application results do not become patient files, plans or successful empty reads", async () => {
  for (const { input, body } of cases) await assert.rejects(operationalRead(client('<Result Status="Failure"><ErrorInfo><ErrorID>99</ErrorID><ErrorMessage>private-error</ErrorMessage></ErrorInfo></Result>' + body), input), /hha_read_failed/);
});

test("ambiguous Result metadata or nested data cannot be mistaken for an absent collection", async () => {
  for (const { input, body } of [cases[0]!, cases[2]!]) for (const payload of ['<Result Status="Success"/><Result Status="Success"/>' + body, '<Result Status="Success">' + body + '</Result>', '<Result Status="Success"><Details/><Details/></Result>' + body]) {
    await assert.rejects(operationalRead(client(payload), input), /care_plan_response_shape_unverified|patient_document_response_shape_unverified/);
  }
});
