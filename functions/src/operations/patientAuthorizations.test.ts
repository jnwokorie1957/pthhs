import assert from "node:assert/strict";
import test from "node:test";
import { patientAuthorizationRead } from "./patientAuthorizations.js";
import { workspaceRoute } from "./routes.js";
import type { OperationsWorkspace } from "./workspace.js";
import type { OperationalRead, ReadInput } from "./reads.js";

const discovery = { operation: "SearchPatientAuthorizations", officeId: "12", patientId: "13" };
const detail = { ...discovery, operation: "GetPatientAuthorizationInfo", id: "14", contractId: "15" };
function source(operation: ReadInput["operation"], records: OperationalRead["records"], truncated = false): OperationalRead {
  return { operation, records, truncated, fetchedAt: "2026-10-15T19:16:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted" };
}
function fixture() {
  const state = { approved: true, revision: 1, officeId: "12", enabledReads: ["GetPatientDemographics", "SearchPatientAuthorizations", "GetPatientAuthorizationInfo"], changeAfterPatient: false, withdrawAfterDetail: false };
  const calls: ReadInput[] = [];
  let patient = source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "12" }]);
  let data = source("SearchPatientAuthorizations", [{ ID: "14", ContractID: "15", ContractName: "Same synthetic label", StartDate: "2026-10-01", StopDate: "2026-10-31" }]);
  const workspace = {
    async settings() { return { dataApproved: state.approved, settings: { officeId: state.officeId, revision: state.revision, enabledReads: [...state.enabledReads] } }; },
    async query(input: ReadInput) {
      calls.push(input);
      if (input.operation === "GetPatientDemographics") { if (state.changeAfterPatient) state.revision++; return patient; }
      if (state.withdrawAfterDetail) state.approved = false;
      return data;
    }
  } as unknown as OperationsWorkspace;
  return { state, calls, workspace, patient: (value: OperationalRead) => { patient = value; }, data: (value: OperationalRead) => { data = value; },
    read: (input: unknown = discovery) => patientAuthorizationRead(workspace, input, "synthetic-admin") };
}
const detailSource = (change: Record<string, string | null> = {}) => source("GetPatientAuthorizationInfo", [{ AuthorizationID: "14", "Patient/ID": "13", "Contract/ID": "15", "ServiceCode/ID": "16", MaxUnits: "0", RemainingUnits: "--", BankedHours: "", WeeklyMaxAuthorization: "-1", ...change }]);

test("patient authorization discovery checks current office and preserves bounded raw source evidence", async () => {
  const f = fixture(); const data = source("SearchPatientAuthorizations", [
    { ID: "14", ContractID: "15", ContractName: "Same synthetic label", StartDate: "2026-10-01", StopDate: "2026-10-31" },
    { ID: "24", ContractID: "25", ContractName: "Same synthetic label", StartDate: "2026-10-01", StopDate: "2026-10-31" }
  ], true); f.data(data);
  const result = await f.read();
  assert.deepEqual(f.calls, [{ operation: "GetPatientDemographics", id: "13" }, { operation: "SearchPatientAuthorizations", patientId: "13" }]);
  assert.deepEqual(result.records, data.records); assert.equal(result.truncated, true); assert.equal(result.fetchedAt, data.fetchedAt);
  assert.deepEqual(result.scope, { patientId: "13", officeId: "12" }); assert.equal(result.interpretation, "authorization_limits_unvalidated");
});

test("authorization detail verifies immutable IDs and preserves zero, blank, unavailable and negative raw strings", async () => {
  const f = fixture(); f.data(detailSource()); const result = await f.read(detail);
  assert.equal(result.records[0]!.MaxUnits, "0"); assert.equal(result.records[0]!.RemainingUnits, "--");
  assert.equal(result.records[0]!.BankedHours, ""); assert.equal(result.records[0]!.WeeklyMaxAuthorization, "-1");
  assert.equal(result.records[0]!.UnitMinutes, undefined); assert.equal(result.records[0]!.Utilization, undefined);
  assert.deepEqual(f.calls[1], { operation: "GetPatientAuthorizationInfo", patientId: "13", id: "14" });
});

test("approval, office and both existing read permissions are checked before source dispatch", async () => {
  for (const mode of ["approval", "office", "demographics", "operation"]) {
    const f = fixture();
    if (mode === "approval") f.state.approved = false;
    if (mode === "office") f.state.officeId = "99";
    if (mode === "demographics") f.state.enabledReads = ["SearchPatientAuthorizations"];
    if (mode === "operation") f.state.enabledReads = ["GetPatientDemographics"];
    await assert.rejects(f.read(), /operational_data_release_not_approved|office_scope_mismatch|read_not_owner_enabled/);
    assert.equal(f.calls.length, 0);
  }
});

test("foreign, missing, ambiguous or truncated patient identity cannot discover authorizations", async () => {
  for (const patient of [source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "99" }]), source("GetPatientDemographics", [{ PatientID: "99", OfficeID: "12" }]), source("GetPatientDemographics", []), source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "12" }], true)]) {
    const f = fixture(); f.patient(patient); await assert.rejects(f.read(), /patient_office_mismatch/); assert.equal(f.calls.length, 1);
  }
});

test("detail identity, contract changes and incomplete detail results fail without returning record data", async () => {
  for (const data of [detailSource({ AuthorizationID: "99" }), detailSource({ "Patient/ID": "99" }), detailSource({ "Contract/ID": "99" }), detailSource({ AuthorizationID: null }), source("GetPatientAuthorizationInfo", []), { ...detailSource(), truncated: true }]) {
    const f = fixture(); f.data(data); await assert.rejects(f.read(detail), /authorization_identity_mismatch|authorization_contract_changed_restart|authorization_identity_unavailable|authorization_detail_not_unique/);
  }
});

test("scope changes between source reads and withdrawn approval before response are fenced", async () => {
  const changed = fixture(); changed.state.changeAfterPatient = true;
  await assert.rejects(changed.read(), /office_policy_changed_restart/); assert.equal(changed.calls.length, 1);
  const withdrawn = fixture(); withdrawn.state.withdrawAfterDetail = true;
  await assert.rejects(withdrawn.read(), /office_policy_changed_restart/); assert.equal(withdrawn.calls.length, 2);
});

test("authorization wrapper rejects extra filters, wrong operations and invalid IDs before reads", async () => {
  for (const input of [null, { ...discovery, operation: "GetVisitInfoV3" }, { ...discovery, id: "14" }, { ...discovery, patientId: "0" }, { ...detail, contractId: "bad" }]) {
    const f = fixture(); await assert.rejects(f.read(input), /invalid_authorization_query|invalid_identifier/); assert.equal(f.calls.length, 0);
  }
});

test("protected workspace route exposes only the explicit authorization read method", async () => {
  const f = fixture();
  assert.equal((await workspaceRoute(f.workspace, "GET", "/workspace/patient-authorizations", discovery, "synthetic-admin"))?.status, 405);
  const read = await workspaceRoute(f.workspace, "POST", "/workspace/patient-authorizations", discovery, "synthetic-admin");
  assert.equal(read?.status, 200); assert.equal((read?.body as { ok: boolean }).ok, true);
  f.state.approved = false;
  assert.equal((await workspaceRoute(f.workspace, "POST", "/workspace/patient-authorizations", discovery, "synthetic-admin"))?.status, 423);
});
