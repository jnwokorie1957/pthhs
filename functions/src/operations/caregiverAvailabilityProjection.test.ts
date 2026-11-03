import assert from "node:assert/strict";
import test from "node:test";
import { parseHhaSoapResponse } from "../integrations/hhaexchange/parser.js";
import { operationalRead, readInputFields } from "./reads.js";

type Operation = "GetCaregiverPermanentWeekAvailability" | "GetCaregiverSpecialAvailability";
const operations: Operation[] = ["GetCaregiverPermanentWeekAvailability", "GetCaregiverSpecialAvailability"];
function names(operation: Operation) { return operation === operations[0] ? ["PermanentWeekAvailability", "PermanentWeekAvailabilityInfo", "PermanentWeekID"] as const : ["SpecialAvailability", "SpecialAvailabilityInfo", "SpecialAvailabilityID"] as const; }
function row(operation: Operation, id = "7", caregiver = "8", office = "9", extra = "") {
  const [, tag, key] = names(operation);
  return `<${tag}><AgencyID>6</AgencyID><${key}>${id}</${key}><CaregiverID>${caregiver}</CaregiverID><OfficeID>${office}</OfficeID>${extra}</${tag}>`;
}
function read(operation: Operation, xml: string) {
  return operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: xml }; } }, { operation, id: "8" });
}

test("availability requires direct unique record, caregiver and office identities before preview truncation", async () => {
  for (const operation of operations) {
    const [root, tag] = names(operation);
    for (const body of [row(operation, "7", "99"), row(operation).replace('<CaregiverID>8</CaregiverID>', '<Other><CaregiverID>8</CaregiverID></Other>'),
      row(operation).replace('<OfficeID>9</OfficeID>', '<OfficeID>9</OfficeID><OfficeID>9</OfficeID>'), row(operation, "7", "8", "0"), row(operation) + row(operation),
      Array.from({ length: 200 }, (_, i) => row(operation, String(i + 1))).join('') + row(operation, "201", "99")]) {
      await assert.rejects(read(operation, `<${root}>${body}</${root}>`), /caregiver_availability_(identity_unverified|caregiver_mismatch|response_shape_unverified)/);
    }
    await assert.rejects(read(operation, `<${root}><${tag} xsi:nil="true"/></${root}>`), /caregiver_availability_response_shape_unverified/);
  }
});

test("availability collection boundaries refuse nested, duplicated and nil-with-content source data", async () => {
  for (const operation of operations) {
    const [root] = names(operation), body = row(operation);
    for (const xml of [`<Wrapper><${root}>${body}</${root}></Wrapper>`, `<${root}><Wrapper>${body}</Wrapper></${root}>`, `<${root}/><${root}/>`, `<${root} xsi:nil="true">${body}</${root}>`, `<Result Status="Success"><${root}>${body}</${root}></Result>`])
      await assert.rejects(read(operation, xml), /caregiver_availability_response_shape_unverified/);
    for (const xml of ['<Result Status="Success"/>', `<${root}/>`, `<${root} xsi:nil="true"/>`]) assert.deepEqual((await read(operation, xml)).records, []);
  }
});

test("raw availability strings preserve explicit empty, unknown and zero without inferred hours or eligibility", async () => {
  for (const operation of operations) {
    const [root] = names(operation);
    const result = await read(operation, `<${root}>${row(operation, "7", "8", "9", '<MondayFrom/><MondayTo>0</MondayTo><MondayLiveIn xsi:nil="true"/><TuesdayFrom>08:00</TuesdayFrom><PrivateNote>private-note</PrivateNote>')}</${root}>`);
    assert.equal(result.records[0]!.MondayFrom, ""); assert.equal(result.records[0]!.MondayTo, "0");
    assert.equal(result.records[0]!.MondayLiveIn, null); assert.equal(result.records[0]!.TuesdayFrom, "08:00");
    assert.equal(result.records[0]!.TuesdayTo, null); assert.equal(result.records[0]!.AgencyID, undefined);
    assert.doesNotMatch(JSON.stringify(result), /private-note|eligible|workedHours/);
  }
});

test("duplicate or non-scalar clock fields cannot become plausible availability or a false source-empty field", async () => {
  for (const operation of operations) {
    const [root] = names(operation);
    for (const extra of ['<MondayFrom>08:00</MondayFrom><MondayFrom>09:00</MondayFrom>', '<MondayTo><Other>12:00</Other></MondayTo>', '<FromDate xsi:nil="true">2026-11-03</FromDate>']) {
      if (extra.startsWith('<FromDate') && operation === operations[0]) continue;
      await assert.rejects(read(operation, `<${root}>${row(operation, "7", "8", "9", extra)}</${root}>`), /caregiver_availability_response_shape_unverified/);
    }
  }
});

test("both availability operations accept actual SOAP BaseResponse metadata without exposing diagnostics", async () => {
  for (const operation of operations) {
    const [root] = names(operation);
    const body = '<Result Status="Success"><ErrorInfo><ErrorID>0</ErrorID><ErrorMessage/></ErrorInfo><Details><ErrorDetails>private-diagnostic</ErrorDetails></Details></Result>' + `<${root}>${row(operation)}</${root}>`;
    const result = await operationalRead({ async call(method) {
      const envelope = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method}Response xmlns="https://www.hhaexchange.com/apis/"><${method}Result>${body}</${method}Result></${method}Response></soap:Body></soap:Envelope>`;
      return { ...parseHhaSoapResponse(method, 200, true, envelope), correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false };
    } }, { operation, id: "8" });
    assert.equal(result.records.length, 1); assert.doesNotMatch(JSON.stringify(result), /private-diagnostic/);
  }
});

test("public availability input metadata requires both a targeted caregiver record and office", () => {
  for (const operation of operations) assert.deepEqual(readInputFields(operation), ["id", "officeId"]);
});
