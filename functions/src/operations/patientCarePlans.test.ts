import assert from "node:assert/strict";
import test from "node:test";
import { patientCarePlanRead } from "./patientCarePlans.js";
import { workspaceRoute } from "./routes.js";
import type { OperationsWorkspace } from "./workspace.js";
import type { OperationalRead, ReadInput } from "./reads.js";

const search = { operation: "SearchPatientPOC", patientId: "8", officeId: "9" };
const detail = { ...search, operation: "GetPatientPOCInfo", id: "7" };
const source = (operation: ReadInput["operation"], records: OperationalRead["records"], truncated = false): OperationalRead => ({
  operation, records, truncated, fetchedAt: "2026-11-02T20:00:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted"
});
function fixture() {
  const calls: ReadInput[] = [];
  const state = { approved: true, revision: 1, officeId: "9", enabledReads: ["GetPatientDemographics", "SearchPatientPOC", "GetPatientPOCInfo"], changeAfter: "", transferAfter: 0 };
  let data = source("SearchPatientPOC", [{ ID: "7", StartDate: "", StopDate: null, POCNumber: "0" }]);
  let patient = source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "9" }]);
  let patientReads = 0;
  const workspace = {
    async settings() { return { dataApproved: state.approved, settings: { officeId: state.officeId, revision: state.revision, enabledReads: [...state.enabledReads] } }; },
    async query(input: ReadInput) {
      calls.push(input);
      if (state.changeAfter === input.operation) state.revision++;
      if (input.operation === "GetPatientDemographics") {
        patientReads++; return state.transferAfter && patientReads > state.transferAfter ? source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "99" }]) : patient;
      }
      if (state.changeAfter === "withdraw") state.approved = false;
      return data;
    }
  } as unknown as OperationsWorkspace;
  return { state, calls, workspace, data: (value: OperationalRead) => { data = value; }, patient: (value: OperationalRead) => { patient = value; },
    read: (input: unknown = search) => patientCarePlanRead(workspace, input, "synthetic-admin") };
}
const detailSource = (change: Record<string, string | null> = {}) => source("GetPatientPOCInfo", [{ ID: "7", "Patient/ID": "8", StartDate: "", Tasks: '[{"ID":"1","Name":"Synthetic task","WeeklyMin":"0","Sunday":"","Monday":null}]', ...change }]);

test("care-plan discovery proves patient-office membership before and after the bounded source read", async () => {
  const f = fixture(); f.data(source("SearchPatientPOC", [{ ID: "7", StartDate: "", POCNumber: "0" }], true));
  const result = await f.read(); assert.equal(result.truncated, true); assert.equal(result.records[0]!.StartDate, "");
  assert.deepEqual(result.scope, { patientId: "8", officeId: "9" }); assert.ok(Number.isFinite(Date.parse(result.membershipCheckedAt)));
  assert.equal(result.fetchedAt, "2026-11-02T20:00:00.000Z");
  assert.deepEqual(f.calls, [{ operation: "GetPatientDemographics", id: "8" }, { operation: "SearchPatientPOC", patientId: "8" }, { operation: "GetPatientDemographics", id: "8" }]);
});

test("care-plan detail presents linked header/task definitions without inferring visits, clinical actions or units", async () => {
  const f = fixture(); f.data(detailSource()); const result = await f.read(detail);
  assert.equal(result.records.length, 2); assert.equal(result.records[0]!.Tasks, undefined);
  assert.equal(result.records[1]!.POCID, "7"); assert.equal(result.records[1]!.WeeklyMin, "0");
  assert.equal(result.records[1]!.Sunday, ""); assert.equal(result.records[1]!.Monday, null);
  assert.match(result.records[0]!.Interpretation!, /definitions only/); assert.equal(result.interpretation, "care_plan_definitions_unvalidated");
  assert.equal(result.records[1]!.VisitID, undefined); assert.equal(result.records[1]!.UnitMinutes, undefined);
  assert.deepEqual(f.calls[1], { operation: "GetPatientPOCInfo", id: "7" });
});

test("unknown task lists and explicitly partial task definitions remain disclosed", async () => {
  const missing = fixture(); missing.data(detailSource({ Tasks: null }));
  assert.equal((await missing.read(detail)).records[0]!.TaskListState, "Not supplied / unknown");
  const partial = fixture(); partial.data({ ...detailSource({ TasksTruncated: "true" }), truncated: true });
  const data = await partial.read(detail); assert.equal(data.truncated, true); assert.match(data.records[0]!.TaskListState!, /Partial/);
});

test("release, office and operation grants are enforced before any dispatch; malformed inputs cannot expand scope", async () => {
  for (const mode of ["approval", "office", "demographics", "operation"]) {
    const f = fixture();
    if (mode === "approval") f.state.approved = false;
    if (mode === "office") f.state.officeId = "99";
    if (mode === "demographics") f.state.enabledReads = ["SearchPatientPOC"];
    if (mode === "operation") f.state.enabledReads = ["GetPatientDemographics"];
    await assert.rejects(f.read(), /operational_data_release_not_approved|office_scope_mismatch|read_not_owner_enabled/); assert.equal(f.calls.length, 0);
  }
  for (const input of [null, [], { ...search, id: "7" }, { ...search, date: "2026-11-02" }, { ...detail, patientId: "0" }, { ...detail, officeId: undefined }, { ...detail, operation: "CreatePatientPOC" }]) {
    const f = fixture(); await assert.rejects(f.read(input), /invalid_care_plan_query|invalid_identifier/); assert.equal(f.calls.length, 0);
  }
});

test("foreign, absent, truncated or ambiguous patient identity cannot read care plans", async () => {
  for (const patient of [source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "99" }]), source("GetPatientDemographics", [{ PatientID: "99", OfficeID: "9" }]),
    source("GetPatientDemographics", []), source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "9" }], true), source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "9" }, { PatientID: "8", OfficeID: "9" }])]) {
    const f = fixture(); f.patient(patient); await assert.rejects(f.read(), /patient_office_mismatch/); assert.equal(f.calls.length, 1);
  }
});

test("missing/foreign/ambiguous source plan identity refuses detail and malformed task DTOs are closed", async () => {
  for (const data of [detailSource({ ID: "99" }), detailSource({ "Patient/ID": "99" }), detailSource({ "Patient/ID": null }), source("GetPatientPOCInfo", []), source("GetPatientPOCInfo", [{ ID: "7", "Patient/ID": "8" }, { ID: "7", "Patient/ID": "8" }]),
    detailSource({ Tasks: '{}' }), detailSource({ Tasks: '[{"Name":{}}]' })]) {
    const f = fixture(); f.data(data); await assert.rejects(f.read(detail), /care_plan_identity_unverified|care_plan_tasks_shape_unverified/);
  }
});

test("settings changes, approval withdrawal and a patient transfer during the read discard all results", async () => {
  for (const changeAfter of ["GetPatientDemographics", "SearchPatientPOC", "withdraw"]) {
    const f = fixture(); f.state.changeAfter = changeAfter; await assert.rejects(f.read(), /office_policy_changed_restart/);
  }
  const f = fixture(); f.state.transferAfter = 1; await assert.rejects(f.read(), /patient_office_mismatch/); assert.equal(f.calls.length, 3);
});

test("generic public read route cannot bypass patient scope, while other reads retain their interface", async () => {
  const f = fixture();
  const bad = await workspaceRoute(f.workspace, "POST", "/workspace/read", { operation: "GetPatientPOCInfo", id: "7" }, "synthetic-admin");
  assert.equal(bad?.status, 400); assert.equal(f.calls.length, 0);
  assert.equal((await workspaceRoute(f.workspace, "POST", "/workspace/read", search, "synthetic-admin"))?.status, 200);
  assert.equal((await workspaceRoute(f.workspace, "GET", "/workspace/read", search, "synthetic-admin"))?.status, 405);
});
