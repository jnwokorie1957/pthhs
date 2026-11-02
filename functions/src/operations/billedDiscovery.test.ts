import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead, readRequest, readInputFields, type ReadInput, type OperationalRead } from "./reads.js";
import { OperationsWorkspace, type WorkspaceRepository, type Versioned } from "./workspace.js";

const input = { operation: "SearchBilledVisits", officeId: "12", patientId: "13", date: "2026-10-24" } as const;
const row = (fields = "<VisitID>14</VisitID><PatientID>13</PatientID><ContractID>15</ContractID><OtherChargeID>0</OtherChargeID>") => `<BilledVisits>${fields}</BilledVisits>`;
function read(xml: string) {
  return operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: xml }; } }, input);
}
test("billed discovery requires and transmits the exact patient/day/office filter", () => {
  assert.equal(readRequest(input), "<StartDate>2026-10-24T00:00:00</StartDate><EndDate>2026-10-24T23:59:59</EndDate><OfficeID>12</OfficeID><PatientID>13</PatientID>");
  assert.deepEqual(readInputFields(input.operation), ["officeId", "date", "patientId"]);
  assert.throws(() => readRequest({ operation: input.operation, officeId: input.officeId, date: input.date }), /invalid_identifier/);
  for (const patientId of ["", "0", "2147483648", "13</PatientID>"]) assert.throws(() => readRequest({ ...input, patientId }), /invalid_identifier/);
});
test("billed discovery uses direct record fields and checks every patient before the preview cap", async () => {
  const result = await read(`<SearchBilledVisits>${row("<Other><VisitID>99</VisitID></Other><VisitID>14</VisitID><PatientID>13</PatientID><ContractID>15</ContractID><OtherChargeID>0</OtherChargeID>")}</SearchBilledVisits>`);
  assert.deepEqual(result.records, [{ VisitID: "14", PatientID: "13", ContractID: "15", OtherChargeID: "0" }]);
  for (const field of ["<Other><PatientID>13</PatientID></Other>", "<PatientID>13</PatientID><PatientID>13</PatientID>", '<PatientID xsi:nil="true">13</PatientID>', "<PatientID>99</PatientID>"]) {
    await assert.rejects(read(`<SearchBilledVisits>${row(`<VisitID>14</VisitID>${field}`)}</SearchBilledVisits>`), /billed_visit_patient_mismatch/);
  }
  await assert.rejects(read(`<SearchBilledVisits>${row().replace("<BilledVisits>", '<BilledVisits xsi:nil="true">')}</SearchBilledVisits>`), /billed_visit_patient_mismatch/);
  for (const value of ["0", "", " raw "]) {
    const state = await read(`<SearchBilledVisits>${row(`<PatientID>13</PatientID><OtherChargeID>${value}</OtherChargeID><VisitID>14</VisitID><VisitID>99</VisitID><Other><ContractID>15</ContractID></Other>`)}</SearchBilledVisits>`);
    assert.equal(state.records[0]!.OtherChargeID, value); assert.equal(state.records[0]!.VisitID, null); assert.equal(state.records[0]!.ContractID, null);
  }
  const bounded = await read(`<SearchBilledVisits>${row().repeat(201)}</SearchBilledVisits>`);
  assert.equal(bounded.records.length, 200); assert.equal(bounded.truncated, true);
  await assert.rejects(read(`<SearchBilledVisits>${row().repeat(200)}${row("<VisitID>16</VisitID><PatientID>99</PatientID>")}</SearchBilledVisits>`), /billed_visit_patient_mismatch/);
});
test("billed discovery distinguishes a valid empty result from malformed or nested collections", async () => {
  for (const xml of ["<Status><Success>true</Success></Status>", "<SearchBilledVisits/>", '<SearchBilledVisits xsi:nil="true"/>']) assert.deepEqual((await read(xml)).records, []);
  for (const xml of [`<Other><SearchBilledVisits>${row()}</SearchBilledVisits></Other>`, `<SearchBilledVisits>${row()}</SearchBilledVisits><SearchBilledVisits/>`, `<SearchBilledVisits><Other>${row()}</Other></SearchBilledVisits>`, `<SearchBilledVisits xsi:nil="true">${row()}</SearchBilledVisits>`, `<SearchBilledVisits>${row()}`]) await assert.rejects(read(xml), /billed_visit_response_shape_unverified/);
});

function fixture() {
  const state = { officeId: "12", revision: 1, enabledReads: ["SearchBilledVisits", "GetPatientDemographics"], changeAfterPatient: false, changeAfterSearch: false };
  let patient: OperationalRead["records"] = [{ PatientID: "13", OfficeID: "12" }];
  const calls: ReadInput[] = [], records = new Map<string, Versioned>();
  const repository = {
    async get(collection: string, id: string) { return collection === "workspaceSettings" ? { id: "owner", ...state } : records.get(collection + "/" + id) ?? null; },
    async change(collection: string, id: string, _revision: number, _actor: string, _action: string, update: (prior: Versioned | null) => Versioned) { const key = collection + "/" + id, value = update(records.get(key) ?? null); records.set(key, value); return value; },
    async deferReads() {}
  } as unknown as WorkspaceRepository;
  const workspace = new OperationsWorkspace(repository, async value => {
    calls.push(value);
    if (value.operation === "GetPatientDemographics" && state.changeAfterPatient || value.operation === "SearchBilledVisits" && state.changeAfterSearch) state.revision++;
    return { operation: value.operation, fetchedAt: "2026-11-02T19:00:00Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted", records: value.operation === "GetPatientDemographics" ? patient : [{ VisitID: "14", PatientID: "13", ContractID: "15", OtherChargeID: "0" }], truncated: false };
  }, true);
  return { state, calls, workspace, setPatient(value: typeof patient) { patient = value; } };
}
test("billed discovery proves patient office before dispatch and keeps permission and policy fences", async () => {
  const f = fixture(), data = await f.workspace.query(input, "synthetic-admin");
  assert.equal(data.records.length, 1);
  assert.deepEqual(f.calls, [{ operation: "GetPatientDemographics", id: "13" }, input]);
  for (const mode of ["foreign-patient", "foreign-office", "no-patient", "patient-disabled", "search-disabled", "office-change", "late-change"]) {
    const x = fixture();
    if (mode === "foreign-patient") x.setPatient([{ PatientID: "99", OfficeID: "12" }]);
    if (mode === "foreign-office") x.setPatient([{ PatientID: "13", OfficeID: "99" }]);
    if (mode === "no-patient") x.setPatient([]);
    if (mode === "patient-disabled") x.state.enabledReads = ["SearchBilledVisits"];
    if (mode === "search-disabled") x.state.enabledReads = ["GetPatientDemographics"];
    if (mode === "office-change") x.state.changeAfterPatient = true;
    if (mode === "late-change") x.state.changeAfterSearch = true;
    await assert.rejects(x.workspace.query(input, "synthetic-admin"), /patient_office_mismatch|read_not_owner_enabled|office_policy_changed_restart/);
    if (mode !== "late-change") assert.equal(x.calls.some(call => call.operation === "SearchBilledVisits"), false, mode);
  }
});
