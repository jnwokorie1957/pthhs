import assert from "node:assert/strict";
import test from "node:test";
import { patientVisitRead } from "./patientVisit.js";
import { workspaceRoute } from "./routes.js";
import type { OperationsWorkspace } from "./workspace.js";
import type { OperationalRead, ReadInput } from "./reads.js";

const input = { visitId: "14", patientId: "13", officeId: "12" };
function source(operation: ReadInput["operation"], records: OperationalRead["records"], truncated = false): OperationalRead {
  return { operation, records, truncated, fetchedAt: "2026-10-16T14:00:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted" };
}
function fixture() {
  const state = { approved: true, revision: 1, officeId: "12", enabledReads: ["GetPatientDemographics", "GetVisitInfoV3"], changeAfterVisit: false, withdrawAfterPatient: false };
  const calls: ReadInput[] = [];
  let visit = source("GetVisitInfoV3", [{ ID: "14", "Patient/ID": "13", EVVStartTime: null, ActualHours: "0", BilledAmount: "", TimeZone: "source zone" }]);
  let patient = source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "12" }]);
  const workspace = {
    async settings() { return { dataApproved: state.approved, settings: { officeId: state.officeId, revision: state.revision, enabledReads: [...state.enabledReads] } }; },
    async query(value: ReadInput) {
      calls.push(value);
      if (value.operation === "GetVisitInfoV3") { if (state.changeAfterVisit) state.revision++; return visit; }
      if (state.withdrawAfterPatient) state.approved = false;
      return patient;
    }
  } as unknown as OperationsWorkspace;
  return { state, calls, workspace, visit: (v: OperationalRead) => { visit = v; }, patient: (v: OperationalRead) => { patient = v; }, read: (value: unknown = input) => patientVisitRead(workspace, value, "synthetic-admin") };
}

test("saved visit lookup verifies current visit/patient/office and preserves raw evidence", async () => {
  const f = fixture(), result = await f.read();
  assert.deepEqual(f.calls, [{ operation: "GetVisitInfoV3", id: "14" }, { operation: "GetPatientDemographics", id: "13" }]);
  assert.deepEqual(result.scope, input); assert.equal(result.membershipCheckedAt, result.fetchedAt);
  assert.equal(result.interpretation, "visit_source_unvalidated"); assert.equal(result.records[0]!.EVVStartTime, null);
  assert.equal(result.records[0]!.ActualHours, "0"); assert.equal(result.records[0]!.BilledAmount, "");
  assert.equal(result.records[0]!.TimeZone, "source zone");
});
test("saved visit lookup enforces release, office and both read gates before dispatch", async () => {
  for (const mode of ["release", "office", "visit", "patient"]) {
    const f = fixture();
    if (mode === "release") f.state.approved = false;
    if (mode === "office") f.state.officeId = "99";
    if (mode === "visit") f.state.enabledReads = ["GetPatientDemographics"];
    if (mode === "patient") f.state.enabledReads = ["GetVisitInfoV3"];
    await assert.rejects(f.read(), /operational_data_release_not_approved|office_scope_mismatch|read_not_owner_enabled/);
    assert.equal(f.calls.length, 0);
  }
});
test("missing, foreign, reassigned or ambiguous current visits cannot return evidence", async () => {
  for (const visit of [source("GetVisitInfoV3", []), source("GetVisitInfoV3", [{ ID: "14", "Patient/ID": "13" }], true),
    source("GetVisitInfoV3", [{ ID: "14", "Patient/ID": "99" }]), source("GetVisitInfoV3", [{ ID: "99", "Patient/ID": "13" }]),
    source("GetVisitInfoV3", [{ ID: "14", "Patient/ID": null }]), source("GetVisitInfoV3", [{ ID: "14" }, { ID: "14" }]),
    source("GetVisitInfoV2", [{ ID: "14", "Patient/ID": "13" }])]) {
    const f = fixture(); f.visit(visit); await assert.rejects(f.read(), /visit_source_not_unique|visit_patient_mismatch/); assert.equal(f.calls.length, 1);
  }
});
test("current patient office must be unique and match after the visit read", async () => {
  for (const patient of [source("GetPatientDemographics", []), source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "99" }]),
    source("GetPatientDemographics", [{ PatientID: "99", OfficeID: "12" }]), source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "12" }], true)]) {
    const f = fixture(); f.patient(patient); await assert.rejects(f.read(), /patient_office_mismatch/);
  }
});
test("saved visit source reads fence policy changes and withdrawn approval before response", async () => {
  const changed = fixture(); changed.state.changeAfterVisit = true;
  await assert.rejects(changed.read(), /office_policy_changed_restart/); assert.equal(changed.calls.length, 1);
  const revoked = fixture(); revoked.state.withdrawAfterPatient = true;
  await assert.rejects(revoked.read(), /office_policy_changed_restart/); assert.equal(revoked.calls.length, 2);
});
test("invalid saved visit IDs and extra fields fail before source reads", async () => {
  for (const value of [null, [], { ...input, visitId: "0" }, { ...input, visitId: "2147483648" }, { ...input, patientId: "bad" }, { ...input, officeId: "" }, { ...input, operation: "GetVisitBillInfoV2" }]) {
    const f = fixture(); await assert.rejects(f.read(value), /invalid_patient_visit_query|invalid_identifier/); assert.equal(f.calls.length, 0);
  }
});
test("patient visit route is an explicit protected POST and errors return no source fields", async () => {
  const f = fixture(); assert.equal((await workspaceRoute(f.workspace, "GET", "/workspace/patient-visit", input, "synthetic-admin"))?.status, 405);
  assert.equal((await workspaceRoute(f.workspace, "POST", "/workspace/patient-visit", input, "synthetic-admin"))?.status, 200);
  f.patient(source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "99" }]));
  const denied = await workspaceRoute(f.workspace, "POST", "/workspace/patient-visit", input, "synthetic-admin");
  assert.equal(denied?.status, 403); assert.deepEqual(denied?.body, { ok: false, error: "patient_office_mismatch" });
});
