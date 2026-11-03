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
  for (const { input, body } of cases) await assert.rejects(operationalRead(client('<Result Status="Failure"><ErrorInfo><ErrorID>99</ErrorID><ErrorMessage>private-error</ErrorMessage></ErrorInfo></Result>' + body), input), /hha_read_failed|patient_document_download_failed_application_http_200_vendor_99/);
});

test("document download failures expose bounded protocol codes without leaking vendor messages, XML or credentials", async () => {
  await assert.rejects(operationalRead(client('<Result Status="Failure"><ErrorInfo><ErrorID>1095</ErrorID><ErrorMessage>private-credential private-filename private-patient</ErrorMessage></ErrorInfo><Details><ErrorDetails>private-details</ErrorDetails></Details></Result>'), { operation: "DownloadPatientDocument", id: "9" }), error => {
    assert.equal((error as { code: string }).code, "patient_document_download_failed_application_http_200_vendor_1095_reason_unclassified");
    assert.doesNotMatch(String(error), /private-|Result|ErrorMessage/); return true;
  });
});

test("download refusal messages are reduced to closed hints without returning any private message text", async () => {
  for (const [message, reason] of [['Access denied for private-filename', 'access_refused'], ['SOAPAction private-action was not recognized', 'method_refused'], ['File private-filename was not found', 'file_unavailable'], ['Object reference not set to private-object', 'source_null_reference'], ['private-credential and private-patient only', 'unclassified']]) {
    await assert.rejects(operationalRead(client('<Result Status="Failure"><ErrorInfo><ErrorID>-310</ErrorID><ErrorMessage>' + message + '</ErrorMessage></ErrorInfo></Result>'), { operation: "DownloadPatientDocument", id: "9" }), error => {
      assert.ok((error as { code: string }).code.endsWith('_reason_' + reason)); assert.doesNotMatch(String(error), /private-/); return true;
    });
  }
});

test("unknown failure fields stay closed and existing read backoff retains precedence over download diagnostics", async () => {
  const call = async (operation: string) => ({ operation, ok: false, transportOk: false, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    error: { kind: "private-kind", id: 999999999, code: "private-code", message: "private-message" } });
  await assert.rejects(operationalRead({ call } as never, { operation: "DownloadPatientDocument", id: "9" }), /patient_document_download_failed_unclassified_http_200_vendor_unknown/);
  await assert.rejects(operationalRead({ async call(operation: string) { return { ...await call(operation), retryAfter: "30" }; } } as never, { operation: "DownloadPatientDocument", id: "9" }), /vendor_backoff_active/);
});

test("ambiguous Result metadata or nested data cannot be mistaken for an absent collection", async () => {
  for (const { input, body } of [cases[0]!, cases[2]!]) for (const payload of ['<Result Status="Success"/><Result Status="Success"/>' + body, '<Result Status="Success">' + body + '</Result>', '<Result Status="Success"><Details/><Details/></Result>' + body]) {
    await assert.rejects(operationalRead(client(payload), input), /care_plan_response_shape_unverified|patient_document_response_shape_unverified/);
  }
});
