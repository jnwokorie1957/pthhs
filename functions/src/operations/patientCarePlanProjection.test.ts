import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead, readInputFields, type ReadInput } from "./reads.js";

function read(xml: string, operation: ReadInput["operation"] = "GetPatientPOCInfo") {
  return operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200,
    correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: xml }; } }, { operation, id: "7", patientId: "8" });
}

test("care-plan task names use their direct source path, excluding category and clinical free text", async () => {
  const result = await read('<POCInfo><Patient><ID>8</ID><FirstName>private-name</FirstName></Patient><ID>7</ID><Notes>private-notes</Notes><Tasks><Task><ID>1</ID><Category><Name>private-category</Name></Category><Name>Correct task</Name><Code>0</Code><WeeklyMin>0</WeeklyMin><Sunday></Sunday><Instruction>private-instruction</Instruction></Task><Task><ID>2</ID><Category><Name>private-category</Name></Category></Task></Tasks></POCInfo>');
  const tasks = JSON.parse(result.records[0]!.Tasks!);
  assert.equal(tasks[0].Name, "Correct task"); assert.equal(tasks[1].Name, null);
  assert.equal(tasks[0].Code, "0"); assert.equal(tasks[0].WeeklyMin, "0");
  assert.equal(tasks[0].Sunday, ""); assert.equal(tasks[0].Monday, null);
  assert.equal(result.records[0]!["Patient/ID"], "8");
  assert.doesNotMatch(JSON.stringify(result), /private-/);
});

test("care-plan optional fields never borrow nested, duplicate, nil or non-scalar values", async () => {
  const result = await read('<POCInfo><Patient><Other><ID>8</ID></Other></Patient><ID>7</ID><StartDate><Value>2026-01-01</Value></StartDate><POCNumber>one</POCNumber><POCNumber>two</POCNumber><StopDate xsi:nil="true"/><Tasks><Task><ID>1</ID><Name><Value>nested</Value></Name></Task></Tasks></POCInfo>');
  for (const key of ["Patient/ID", "StartDate", "StopDate", "POCNumber"]) assert.equal(result.records[0]![key], null);
  assert.equal(JSON.parse(result.records[0]!.Tasks!)[0].Name, null);
});

test("absent, explicit empty and nil tasks remain distinct, with no invented task records", async () => {
  for (const [tasks, expected] of [["", null], ["<Tasks/>", "[]"], ['<Tasks xsi:nil="true"/>', null]] as const) {
    const result = await read('<POCInfo><ID>7</ID>' + tasks + '</POCInfo>');
    assert.equal(result.records[0]!.Tasks, expected);
  }
});

test("care-plan roots and collections reject nested, duplicate, malformed and nil-with-content shapes", async () => {
  for (const xml of ['<Wrapper><POCInfo><ID>7</ID></POCInfo></Wrapper>', '<POCInfo><ID>7</ID></POCInfo><POCInfo><ID>7</ID></POCInfo>',
    '<POCInfo><ID>7</ID><Tasks><Wrapper><Task><ID>1</ID></Task></Wrapper></Tasks></POCInfo>',
    '<POCInfo><ID>7</ID><Tasks/><Tasks/></POCInfo>', '<POCInfo xsi:nil="true"><ID>7</ID></POCInfo>', '<POCInfo><ID>7</POCInfo>']) {
    await assert.rejects(read(xml), /care_plan_response_shape_unverified/);
  }
  for (const xml of ['<Other><PatientPOC><POC><ID>7</ID></POC></PatientPOC></Other>', '<PatientPOC><Wrapper><POC><ID>7</ID></POC></Wrapper></PatientPOC>',
    '<PatientPOC><POC><ID>7</ID></POC><POC><ID>7</ID></POC></PatientPOC>', '<PatientPOC><POC><Other><ID>7</ID></Other></POC></PatientPOC>']) {
    await assert.rejects(read(xml, "SearchPatientPOC"), /care_plan_response_shape_unverified/);
  }
});

test("bounded task projections disclose truncation and preserve literal markup in scalar CDATA", async () => {
  const task = '<Task><ID>1</ID><Name><![CDATA[Literal <Task> text]]></Name></Task>';
  const result = await read('<POCInfo><ID>7</ID><Tasks>' + task.repeat(201) + '</Tasks></POCInfo>');
  assert.equal(result.truncated, true); assert.equal(result.records[0]!.TasksTruncated, "true");
  const tasks = JSON.parse(result.records[0]!.Tasks!); assert.equal(tasks.length, 200); assert.equal(tasks[0].Name, "Literal <Task> text");
});

test("care-plan discovery keeps explicit empty values and marks bounded results; inputs require subject and office", async () => {
  const result = await read('<PatientPOC>' + Array.from({ length: 201 }, (_, i) => '<POC><ID>' + (i + 1) + '</ID><StartDate/><POCNumber>0</POCNumber></POC>').join('') + '</PatientPOC>', "SearchPatientPOC");
  assert.equal(result.records.length, 200); assert.equal(result.truncated, true);
  assert.equal(result.records[0]!.StartDate, ""); assert.equal(result.records[0]!.POCNumber, "0");
  assert.deepEqual(readInputFields("SearchPatientPOC"), ["patientId", "officeId"]);
  assert.deepEqual(readInputFields("GetPatientPOCInfo"), ["patientId", "officeId", "id"]);
});
