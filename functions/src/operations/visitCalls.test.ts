import assert from "node:assert/strict";
import test from "node:test";
import { visitCallRead, type CallSubjectDiagnostic } from "./visitCalls.js";
import { workspaceRoute } from "./routes.js";
import type { OperationsWorkspace } from "./workspace.js";
import { operationalRead, type OperationalRead, type ReadInput } from "./reads.js";
const input = { visitId: "14", patientId: "13", caregiverId: "15", officeId: "12", date: "2026-10-24" };
const source = (operation: ReadInput["operation"], records: OperationalRead["records"]): OperationalRead => ({ operation, records, source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted", fetchedAt: "2026-10-31T16:00:00Z", truncated: false });
function fixture() {
  const state = { approved: true, officeId: "12", revision: 1, enabledReads: ["GetVisitInfoV3", "GetPatientDemographics", "GetCallDashBoardData"], revokeAfterCalls: false };
  const rows = {
    GetVisitInfoV3: source("GetVisitInfoV3", [{ ID: "14", "Patient/ID": "13", "Caregiver/ID": "15", VisitDate: "2026-10-24T00:00:00" }]),
    GetPatientDemographics: source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "12" }]),
    GetCallDashBoardData: source("GetCallDashBoardData", [{ CallDashboardID: "16", "Patient/ID": "13", "Caregiver/ID": "15", CallTime: "2026-10-24 09:00", CallType: "Source type", CallStatus: "Source status" }])
  };
  const calls: ReadInput[] = [], diagnostics: CallSubjectDiagnostic[] = [];
  const workspace = { async settings() { return { dataApproved: state.approved, settings: { officeId: state.officeId, revision: state.revision, enabledReads: [...state.enabledReads] } }; },
    async query(value: ReadInput) { calls.push(value); if (value.operation === "GetCallDashBoardData" && state.revokeAfterCalls) state.approved = false; return rows[value.operation as keyof typeof rows]; } } as unknown as OperationsWorkspace;
  return { state, rows, calls, workspace, diagnostics, read: (value: unknown = input) => visitCallRead(workspace, value, "synthetic-admin", diagnostic => diagnostics.push(diagnostic)) };
}

test("rejected call identity diagnostics distinguish unavailable, invalid and different subjects without source values", async () => {
  for (const [patient, caregiver, expected] of [
    [null, "15", { patientIdentity: "unavailable", caregiverIdentity: "match" }],
    ["13", null, { patientIdentity: "match", caregiverIdentity: "unavailable" }],
    [null, null, { patientIdentity: "unavailable", caregiverIdentity: "unavailable" }],
    ["PRIVATE-UPSTREAM-VALUE", "15", { patientIdentity: "invalid", caregiverIdentity: "match" }],
    ["13", "0", { patientIdentity: "match", caregiverIdentity: "invalid" }],
    ["19", "15", { patientIdentity: "different", caregiverIdentity: "match" }],
    ["13", "19", { patientIdentity: "match", caregiverIdentity: "different" }],
    ["\n13\t", "15", { patientIdentity: "noncanonical_match", caregiverIdentity: "match" }],
    ["13", "+00015", { patientIdentity: "match", caregiverIdentity: "noncanonical_match" }],
    ["2147483648", "15", { patientIdentity: "invalid", caregiverIdentity: "match" }]
  ] as const) {
    const f = fixture();
    Object.assign(f.rows.GetCallDashBoardData.records[0]!, { "Patient/ID": patient, "Caregiver/ID": caregiver, CallTime: "PRIVATE-CLOCK", CallStatus: "PRIVATE-STATUS" });
    await assert.rejects(f.read(), error => (error as { code?: string; status?: number }).code === "call_subject_mismatch" && (error as { status?: number }).status === 403);
    assert.deepEqual(f.diagnostics, [{ ...expected, admissionIdentity: "expected_unavailable" }]);
    assert.doesNotMatch(JSON.stringify(f.diagnostics), /PRIVATE|"(?:patientId|caregiverId|CallTime|CallStatus|actor|visitId|officeId)"/);
    assert.equal(f.calls.length, 3, "diagnosis does not retry or fetch another source");
  }
});

test("a separate admission reference is compared exactly for diagnosis without admitting failed patient proof", async () => {
  for (const [expected, returned, state] of [["SYNTHETIC-ADMISSION", "SYNTHETIC-ADMISSION", "match"], ["00013", "13", "different"], ["Admission-A", "admission-a", "different"], ["SYNTHETIC-ADMISSION", null, "unavailable"], [null, "SYNTHETIC-ADMISSION", "expected_unavailable"], ["SYNTHETIC-ADMISSION", "bad\nvalue", "invalid"]] as const) {
    const f = fixture(); f.rows.GetPatientDemographics.records[0]!.AdmissionID = expected;
    Object.assign(f.rows.GetCallDashBoardData.records[0]!, { "Patient/ID": "0", "Patient/AdmissionID": returned });
    await assert.rejects(f.read(), error => (error as { code?: string }).code === "call_subject_mismatch");
    assert.deepEqual(f.diagnostics, [{ patientIdentity: "invalid", caregiverIdentity: "match", admissionIdentity: state }]);
    assert.doesNotMatch(JSON.stringify(f.diagnostics), /SYNTHETIC|ADMISSION|00013|bad|value/); assert.equal(f.calls.length, 3);
  }
});

test("rejected call identity diagnostics require current scope and do not run for accepted or empty data", async () => {
  const revoked = fixture(); revoked.state.revokeAfterCalls = true; revoked.rows.GetCallDashBoardData.records[0]!["Patient/ID"] = null;
  await assert.rejects(revoked.read()); assert.deepEqual(revoked.diagnostics, []);
  const accepted = fixture(); await accepted.read(); assert.deepEqual(accepted.diagnostics, []);
  const empty = fixture(); empty.rows.GetCallDashBoardData.records = []; await empty.read(); assert.deepEqual(empty.diagnostics, []);
  const failedLogger = fixture(); failedLogger.rows.GetCallDashBoardData.records[0]!["Patient/ID"] = null;
  await assert.rejects(visitCallRead(failedLogger.workspace, input, "synthetic-admin", () => { throw new Error("diagnostic unavailable"); }), error => (error as { code?: string }).code === "call_subject_mismatch");
});
test("call evidence checks fresh visit and office before an exact filtered API read, without inferring visit linkage", async () => {
  const f = fixture(), result = await f.read();
  assert.deepEqual(f.calls, [{ operation: "GetVisitInfoV3", id: "14" }, { operation: "GetPatientDemographics", id: "13" }, { operation: "GetCallDashBoardData", patientId: "13", caregiverId: "15", officeId: "12", date: "2026-10-24", lastId: "0" }]);
  assert.deepEqual(result.scope, input); assert.equal(result.state, "ready"); assert.equal(result.visitLink, "not_supplied_by_source");
  assert.equal(result.relationship, "same_patient_caregiver_day_only"); assert.equal(result.completeness, "bounded_response_not_complete_history");
  assert.equal(result.records[0]!.CallType, "Source type"); assert.equal(result.records[0]!.CallStatus, "Source status"); assert.equal("EVVEndTime" in result.records[0]!, false);
});
test("call evidence rejects invalid scope, withdrawn release and disabled reads before dispatch", async () => {
  for (const value of [null, [], { ...input, date: "2026-02-30" }, { ...input, caregiverId: "0" }, { ...input, lastId: "20" }, { ...input, operation: "GetCallDashBoardData" }]) {
    const f = fixture(); await assert.rejects(f.read(value)); assert.equal(f.calls.length, 0);
  }
  for (const mode of ["release", "office", "read"]) {
    const f = fixture(); if (mode === "release") f.state.approved = false; if (mode === "office") f.state.officeId = "99"; if (mode === "read") f.state.enabledReads = ["GetVisitInfoV3", "GetPatientDemographics"];
    await assert.rejects(f.read()); assert.equal(f.calls.length, 0);
  }
});
test("changed visit caregiver or date, foreign call subjects and ambiguous IDs never return call fields", async () => {
  for (const mode of ["caregiver", "visit_date", "patient", "call_caregiver", "call_date", "duplicate", "id", "operation", "withdraw"]) {
    const f = fixture(), call = f.rows.GetCallDashBoardData.records[0]!;
    if (mode === "caregiver") f.rows.GetVisitInfoV3.records[0]!["Caregiver/ID"] = "99";
    if (mode === "visit_date") f.rows.GetVisitInfoV3.records[0]!.VisitDate = "2026-10-23";
    if (mode === "patient") call["Patient/ID"] = "99";
    if (mode === "call_caregiver") call["Caregiver/ID"] = "99";
    if (mode === "call_date") call.CallTime = "2026-10-23 09:00";
    if (mode === "duplicate") f.rows.GetCallDashBoardData.records.push({ ...call });
    if (mode === "id") call.CallDashboardID = "0";
    if (mode === "operation") f.rows.GetCallDashBoardData.operation = "GetVisitInfoV3";
    if (mode === "withdraw") f.state.revokeAfterCalls = true;
    const result = await workspaceRoute(f.workspace, "POST", "/workspace/visit-calls", input, "synthetic-admin");
    assert.notEqual(result?.status, 200, mode); assert.equal("records" in (result!.body as object), false, mode);
    if (["caregiver", "visit_date"].includes(mode)) assert.equal(f.calls.length, 2);
  }
  assert.equal((await workspaceRoute(fixture().workspace, "GET", "/workspace/visit-calls", input, "synthetic-admin"))?.status, 405);
});
test("empty and truncated source call pages retain distinct bounded source states", async () => {
  const empty = fixture(); empty.rows.GetCallDashBoardData.records = []; const a = await empty.read(); assert.equal(a.state, "empty"); assert.equal(a.records.length, 0);
  const partial = fixture(); partial.rows.GetCallDashBoardData.truncated = true; const b = await partial.read(); assert.equal(b.state, "partial"); assert.equal(b.records.length, 1);
  const missing = fixture(); missing.rows.GetCallDashBoardData.records[0]!.CallTime = null; assert.equal((await missing.read()).records[0]!.CallTime, null);
});
test("call event projection excludes phone/PIN/name data and refuses borrowed or duplicate identity fields", async () => {
  const xml = '<Calls><CallInfo><CallDashboardID>16</CallDashboardID><Patient><ID>13</ID><FirstName>PRIVATE</FirstName></Patient><Caregiver><ID>15</ID><TimeAndAttendancePIN>PRIVATE</TimeAndAttendancePIN><Phone1>PRIVATE</Phone1></Caregiver><CallTime>2026-10-24 09:00</CallTime><CallType>Source</CallType><CallStatus>Source</CallStatus></CallInfo></Calls>';
  async function read(resultXml: string) { return operationalRead({ async call(operation) { return { operation, resultXml, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false }; } }, { operation: "GetCallDashBoardData", officeId: "12", patientId: "13", caregiverId: "15", date: "2026-10-24", lastId: "0" }); }
  const result = await read(xml); assert.equal(result.records[0]!["Patient/ID"], "13"); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|Phone1|TimeAndAttendancePIN/);
  const borrowed = await read(xml.replace('<Patient><ID>13</ID>', '<Patient><Nested><ID>13</ID></Nested>')); assert.equal(borrowed.records[0]!["Patient/ID"], null);
  const duplicate = await read(xml.replace('<CallDashboardID>16</CallDashboardID>', '<CallDashboardID>16</CallDashboardID><CallDashboardID>17</CallDashboardID>')); assert.equal(duplicate.records[0]!.CallDashboardID, null);
});

test("admission diagnostic references use unique direct source fields on both approved readers", async () => {
  for (const operation of ["GetCallDashBoardData", "GetPatientDemographics"] as const) {
    for (const [element, expected] of [["<AdmissionID>SYNTHETIC</AdmissionID>", "SYNTHETIC"], ["", null], ["<Nested><AdmissionID>SYNTHETIC</AdmissionID></Nested>", null], ["<AdmissionID>SYNTHETIC</AdmissionID><AdmissionID>OTHER</AdmissionID>", null], ["<AdmissionID xsi:nil=\"true\"/>", null]] as const) {
      const xml = operation === "GetCallDashBoardData" ? `<Calls><CallInfo><CallDashboardID>16</CallDashboardID><Patient><ID>13</ID>${element}</Patient></CallInfo></Calls>` : `<PatientInfo><PatientID>13</PatientID><OfficeID>12</OfficeID>${element}</PatientInfo>`;
      const result = await operationalRead({ async call() { return { operation, resultXml: xml, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false }; } }, operation === "GetCallDashBoardData" ? { operation, officeId: "12", patientId: "13", caregiverId: "15", date: "2026-10-24", lastId: "0" } : { operation, id: "13" });
      assert.equal(result.records[0]![operation === "GetCallDashBoardData" ? "Patient/AdmissionID" : "AdmissionID"], expected);
    }
  }
});
