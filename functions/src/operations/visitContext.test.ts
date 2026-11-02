import assert from "node:assert/strict";
import test from "node:test";
import { visitContextRead } from "./patientVisit.js";
import { workspaceRoute } from "./routes.js";
import { operationalRead, type OperationalRead, type ReadInput } from "./reads.js";
import type { OperationsWorkspace } from "./workspace.js";

const scope = { visitId: "14", patientId: "13", officeId: "12" };
const caregiverQuery = { ...scope, kind: "caregiver", caregiverId: "15" };
const billingQuery = { ...scope, kind: "billing" };
const source = (operation: ReadInput["operation"], records: OperationalRead["records"]): OperationalRead => ({ operation, records, source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted", truncated: false, fetchedAt: "2026-10-24T16:00:00Z" });
function fixture() {
  const state = { approved: true, officeId: "12", revision: 1, enabledReads: ["GetVisitInfoV3", "GetPatientDemographics", "GetCaregiverDemographics", "GetVisitBillInfoV2"], changeAt: 0, withdrawAt: 0 };
  const rows = {
    GetVisitInfoV3: source("GetVisitInfoV3", [{ ID: "14", "Patient/ID": "13", "Caregiver/ID": "15", VisitDate: "2026-10-24" }]),
    GetPatientDemographics: source("GetPatientDemographics", [{ PatientID: "13", OfficeID: "12" }]),
    GetCaregiverDemographics: source("GetCaregiverDemographics", [{ ID: "15", FirstName: "Synthetic", OfficeIDs: '["12","99"]' }]),
    GetVisitBillInfoV2: source("GetVisitBillInfoV2", [{ ID: "14", "Patient/ID": "13", "Caregiver/ID": "15", VisitDate: "2026-10-24", "PrimaryBillTo/BilledAmount": "0", "SecondaryBillTo/BilledMinutes": null }]),
    GetVisitBillInfo: source("GetVisitBillInfo", [{ ID: "14", "Patient/ID": "13", "Caregiver/ID": "15", VisitDate: "2026-10-24", "PrimaryBillTo/BilledAmount": "0" }])
  };
  const calls: ReadInput[] = [];
  const workspace = {
    async settings() { return { dataApproved: state.approved, settings: { officeId: state.officeId, revision: state.revision, enabledReads: [...state.enabledReads] } }; },
    async query(input: ReadInput) { calls.push(input); if (state.changeAt === calls.length) state.revision++; if (state.withdrawAt === calls.length) state.approved = false; return rows[input.operation as keyof typeof rows]; }
  } as unknown as OperationsWorkspace;
  return { state, rows, calls, workspace, read: (query: unknown) => visitContextRead(workspace, query, "synthetic-admin") };
}

test("visit context reads exact caregiver and billing facts after fresh patient-office proof", async () => {
  for (const kind of ["caregiver", "billing"] as const) {
    const f = fixture(), data = await f.read(kind === "caregiver" ? caregiverQuery : billingQuery);
    assert.deepEqual(f.calls, [{ operation: "GetVisitInfoV3", id: "14" }, { operation: "GetPatientDemographics", id: "13" }, { operation: kind === "caregiver" ? "GetCaregiverDemographics" : "GetVisitBillInfoV2", id: kind === "caregiver" ? "15" : "14" }]);
    assert.equal(data.interpretation, kind === "caregiver" ? "caregiver_profile_unvalidated" : "billing_source_unvalidated");
    assert.equal(data.membershipCheckedAt, "2026-10-24T16:00:00Z");
    assert.deepEqual(data.scope, { ...scope, ...(kind === "caregiver" ? { caregiverId: "15" } : {}) });
    if (kind === "billing") { assert.equal(data.records[0]!["PrimaryBillTo/BilledAmount"], "0"); assert.equal(data.records[0]!["SecondaryBillTo/BilledMinutes"], null); }
  }
});

test("visit context validates input and all release/read/office gates before any dispatch", async () => {
  for (const query of [null, [], { ...caregiverQuery, caregiverId: "0" }, { ...billingQuery, caregiverId: "15" }, { ...billingQuery, kind: "claims" }, { ...billingQuery, secret: "never" }]) {
    const f = fixture(); await assert.rejects(f.read(query)); assert.equal(f.calls.length, 0);
  }
  for (const query of [caregiverQuery, billingQuery]) for (const mode of ["release", "office", "read", "base"]) {
    const f = fixture();
    if (mode === "release") f.state.approved = false;
    if (mode === "office") f.state.officeId = "99";
    if (mode === "read") f.state.enabledReads = ["GetVisitInfoV3", "GetPatientDemographics"];
    if (mode === "base") f.state.enabledReads = ["GetCaregiverDemographics", "GetVisitBillInfoV2"];
    await assert.rejects(f.read(query)); assert.equal(f.calls.length, 0);
  }
});

test("caregiver reassignment, foreign offices and ambiguous membership fail closed", async () => {
  const changed = fixture(); changed.rows.GetVisitInfoV3.records[0]!["Caregiver/ID"] = "16";
  await assert.rejects(changed.read(caregiverQuery), /visit_caregiver_changed_restart/); assert.equal(changed.calls.length, 2);
  for (const offices of [null, "bad", "{}", "[]", '["99"]', '[12]', '["12","12"]', '["12",null]', '["12","2147483648"]']) {
    const f = fixture(); f.rows.GetCaregiverDemographics.records[0]!.OfficeIDs = offices;
    await assert.rejects(f.read(caregiverQuery), /caregiver_office_mismatch/);
  }
  const wrong = fixture(); wrong.rows.GetCaregiverDemographics.records[0]!.ID = "16"; await assert.rejects(wrong.read(caregiverQuery), /caregiver_office_mismatch/);
});

test("billing source must match current visit, patient, caregiver and source date", async () => {
  for (const [key, value, error] of [["ID", "99", "billing_visit_patient_mismatch"], ["Patient/ID", "99", "billing_visit_patient_mismatch"], ["Caregiver/ID", "99", "billing_source_changed_restart"], ["VisitDate", "2026-10-23", "billing_source_changed_restart"], ["VisitDate", null, "billing_source_changed_restart"]]) {
    const f = fixture(); f.rows.GetVisitBillInfoV2.records[0]![key!] = value!;
    await assert.rejects(f.read(billingQuery), new RegExp(error!));
  }
});

test("an empty related source result is explicit and never returns facts or zero balances", async () => {
  for (const query of [caregiverQuery, billingQuery]) {
    const f = fixture(), row = query.kind === "caregiver" ? f.rows.GetCaregiverDemographics : f.rows.GetVisitBillInfoV2;
    row.records = [];
    const result = await workspaceRoute(f.workspace, "POST", "/workspace/visit-context", query, "synthetic-admin");
    assert.equal(f.calls.length, 3);
    assert.equal(result?.status, 409);
    assert.deepEqual(result?.body, { ok: false, error: "visit_context_source_empty" });
    for (const invalid of ["truncated", "operation"] as const) {
      const changed = fixture(), data = query.kind === "caregiver" ? changed.rows.GetCaregiverDemographics : changed.rows.GetVisitBillInfoV2;
      data.records = [];
      if (invalid === "truncated") data.truncated = true; else data.operation = "GetPatientDemographics";
      const rejected = await workspaceRoute(changed.workspace, "POST", "/workspace/visit-context", query, "synthetic-admin");
      assert.deepEqual(rejected?.body, { ok: false, error: "visit_context_source_not_unique" });
    }
  }
});

test("related source responses cannot escape ambiguous reads, changed policy or withdrawn release", async () => {
  for (const query of [caregiverQuery, billingQuery]) for (const mode of ["duplicate", "truncated", "operation", "policy", "withdraw"]) {
    const f = fixture(), row = query.kind === "caregiver" ? f.rows.GetCaregiverDemographics : f.rows.GetVisitBillInfoV2;
    if (mode === "duplicate") row.records.push({ ...row.records[0] });
    if (mode === "truncated") row.truncated = true;
    if (mode === "operation") row.operation = "GetPatientDemographics";
    if (mode === "policy") f.state.changeAt = 3;
    if (mode === "withdraw") f.state.withdrawAt = 3;
    const result = await workspaceRoute(f.workspace, "POST", "/workspace/visit-context", query, "synthetic-admin");
    assert.notEqual(result?.status, 200); assert.equal("records" in (result!.body as object), false);
  }
  assert.equal((await workspaceRoute(fixture().workspace, "GET", "/workspace/visit-context", caregiverQuery, "synthetic-admin"))?.status, 405);
});

test("caregiver membership projection uses only unique direct IDs in the direct office list", async () => {
  async function read(xml: string) {
    return operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: `<CaregiverInfo>${xml}</CaregiverInfo>` }; } }, { operation: "GetCaregiverDemographics", id: "15" });
  }
  const valid = await read('<ID>15</ID><CaregiverOffices><Office><OfficeID>12</OfficeID><IsPrimary>false</IsPrimary></Office><Office><OfficeID>99</OfficeID></Office></CaregiverOffices>');
  assert.equal(valid.records[0]!.OfficeIDs, '["12","99"]'); assert.equal(valid.records[0]!.ID, "15");
  for (const body of ['<ID>15</ID><CaregiverOffices><Office><Nested><OfficeID>12</OfficeID></Nested></Office></CaregiverOffices>', '<ID>15</ID><CaregiverOffices><Office><OfficeID>12</OfficeID><OfficeID>99</OfficeID></Office></CaregiverOffices>', '<ID>15</ID><CaregiverOffices/><CaregiverOffices><Office><OfficeID>12</OfficeID></Office></CaregiverOffices>', '<ID>15</ID><CaregiverOffices><Office><OfficeID>12</OfficeID></Office><Office><OfficeID>12</OfficeID></Office></CaregiverOffices>']) {
    assert.equal((await read(body)).records[0]!.OfficeIDs, null);
  }
  assert.equal((await read('<Other><ID>15</ID><CaregiverOffices><Office><OfficeID>12</OfficeID></Office></CaregiverOffices></Other>')).records[0]!.ID, null);
  assert.equal((await read('<ID>15</ID><Other><CaregiverOffices><Office><OfficeID>12</OfficeID></Office></CaregiverOffices></Other>')).records[0]!.OfficeIDs, '[]');
});

test("empty billing diagnostics contain fixed categories only after the final policy check", async () => {
  const f = fixture(), captured: unknown[] = [];
  f.rows.GetVisitBillInfoV2.records = [];
  f.rows.GetVisitBillInfoV2.billingShape = Object.assign({ expected: "absent" as const, versioned: "paired" as const, encoded: false, successStatus: "explicit" as const }, { rawXml: "private-synthetic-marker", patientId: "private-synthetic-marker" });
  await assert.rejects(visitContextRead(f.workspace, billingQuery, "private-synthetic-actor", d => captured.push(d)), /visit_context_source_empty/);
  assert.deepEqual(captured, [{ expected: "absent", versioned: "paired", encoded: false, successStatus: "explicit" }]);
  assert.equal(JSON.stringify(captured).includes("private-synthetic"), false);
  const invalid = fixture(); invalid.rows.GetVisitBillInfoV2.records = [];
  invalid.rows.GetVisitBillInfoV2.billingShape = { expected: "private-synthetic-marker", versioned: "unknown", encoded: "private-synthetic-marker", successStatus: "private-synthetic-marker" } as never;
  await assert.rejects(visitContextRead(invalid.workspace, billingQuery, "actor", d => captured.push(d)), /visit_context_source_empty/);
  assert.deepEqual(captured[1], { expected: "unknown", versioned: "unknown", encoded: false, successStatus: "unknown" });
  await assert.rejects(visitContextRead(f.workspace, billingQuery, "actor", () => { throw Error("logger unavailable"); }), /visit_context_source_empty/);
  for (const mode of ["policy", "withdraw", "truncated", "operation", "caregiver"] as const) {
    const stopped = fixture(); stopped.rows.GetVisitBillInfoV2.records = [];
    if (mode === "policy") stopped.state.changeAt = 3;
    if (mode === "withdraw") stopped.state.withdrawAt = 3;
    if (mode === "truncated") stopped.rows.GetVisitBillInfoV2.truncated = true;
    if (mode === "operation") stopped.rows.GetVisitBillInfoV2.operation = "GetPatientDemographics";
    if (mode === "caregiver") stopped.rows.GetCaregiverDemographics.records = [];
    let emitted = 0;
    await assert.rejects(visitContextRead(stopped.workspace, mode === "caregiver" ? caregiverQuery : billingQuery, "actor", () => { emitted++; }));
    assert.equal(emitted, 0);
  }
});

test("owner-enabled legacy billing is attempted once only after an empty verified V2 result", async () => {
  const f = fixture(); f.state.enabledReads.push("GetVisitBillInfo"); f.rows.GetVisitBillInfoV2.records = [];
  const data = await visitContextRead(f.workspace, billingQuery, "actor", () => {});
  assert.equal(data.operation, "GetVisitBillInfo");
  assert.equal(Reflect.get(data, "billingFallbackFrom"), "GetVisitBillInfoV2");
  assert.equal(data.records[0]?.["PrimaryBillTo/BilledAmount"], "0");
  assert.deepEqual(f.calls.map(c => c.operation), ["GetVisitInfoV3", "GetPatientDemographics", "GetVisitBillInfoV2", "GetVisitBillInfo"]);
  const primary = fixture(); primary.state.enabledReads.push("GetVisitBillInfo");
  assert.equal((await primary.read(billingQuery)).operation, "GetVisitBillInfoV2"); assert.equal(primary.calls.length, 3);
  const disabled = fixture(); disabled.rows.GetVisitBillInfoV2.records = [];
  await assert.rejects(visitContextRead(disabled.workspace, billingQuery, "actor", () => {}), /visit_context_source_empty/);
  assert.equal(disabled.calls.length, 3);
  const failed = fixture(); failed.state.enabledReads.push("GetVisitBillInfo");
  const original = failed.workspace.query.bind(failed.workspace);
  failed.workspace.query = async (input, actor) => { if ((input as ReadInput).operation === "GetVisitBillInfoV2") throw Error("synthetic_source_failure"); return original(input, actor); };
  await assert.rejects(failed.read(billingQuery), /synthetic_source_failure/);
  assert.equal(failed.calls.some(c => c.operation === "GetVisitBillInfo"), false);
});

test("legacy billing cannot rescue an unverified primary or escape final identity and policy proof", async () => {
  for (const mode of ["primary-truncated", "primary-operation", "primary-identity", "primary-policy", "legacy-identity", "legacy-date", "legacy-caregiver", "legacy-empty", "legacy-truncated", "legacy-operation", "legacy-policy", "legacy-withdraw"] as const) {
    const f = fixture(); f.state.enabledReads.push("GetVisitBillInfo"); f.rows.GetVisitBillInfoV2.records = [];
    if (mode === "primary-truncated") f.rows.GetVisitBillInfoV2.truncated = true;
    if (mode === "primary-operation") f.rows.GetVisitBillInfoV2.operation = "GetVisitInfoV3";
    if (mode === "primary-identity") f.rows.GetVisitBillInfoV2.records = [{ ID: "99" }];
    if (mode === "primary-policy") f.state.changeAt = 3;
    if (mode === "legacy-identity") f.rows.GetVisitBillInfo.records[0]!.ID = "99";
    if (mode === "legacy-date") f.rows.GetVisitBillInfo.records[0]!.VisitDate = "2026-10-23";
    if (mode === "legacy-caregiver") f.rows.GetVisitBillInfo.records[0]!["Caregiver/ID"] = "99";
    if (mode === "legacy-empty") f.rows.GetVisitBillInfo.records = [];
    if (mode === "legacy-truncated") f.rows.GetVisitBillInfo.truncated = true;
    if (mode === "legacy-operation") f.rows.GetVisitBillInfo.operation = "GetVisitBillInfoV2";
    if (mode === "legacy-policy") f.state.changeAt = 4;
    if (mode === "legacy-withdraw") f.state.withdrawAt = 4;
    await assert.rejects(visitContextRead(f.workspace, billingQuery, "actor", () => {}));
    assert.equal(f.calls.length, mode.startsWith("primary-") ? 3 : 4, mode);
  }
});

test("legacy billing identity fields require unique direct paths too", async () => {
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: '<VisitBillInfo><Other><ID>14</ID></Other><Patient><Other><ID>13</ID></Other></Patient><Caregiver><ID>15</ID><ID>16</ID></Caregiver><VisitDate>2026-10-24</VisitDate><VisitDate>2026-10-23</VisitDate></VisitBillInfo>' }; } }, { operation: "GetVisitBillInfo", id: "14" });
  for (const key of ["ID", "Patient/ID", "Caregiver/ID", "VisitDate"]) assert.equal(data.records[0]?.[key], null, key);
});

test("billing record roots cannot borrow nested, nil or ambiguous source identities", async () => {
  const valid = '<VisitBillInfo><ID>14</ID><Patient><ID>13</ID></Patient></VisitBillInfo>';
  for (const operation of ["GetVisitBillInfoV2", "GetVisitBillInfo"] as const) {
    const read = (xml: string) => operationalRead({ async call() { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: xml }; } }, { operation, id: "14" });
    for (const xml of [`<Other>${valid}</Other>`, valid + '<VisitBillInfo/>', valid.replace('<VisitBillInfo>', '<VisitBillInfo xsi:nil="true">'), '<VisitBillInfo><ID>14</ID>']) await assert.rejects(read(xml), /billing_record_shape_unverified/);
    for (const xml of ['', '<VisitBillInfo/>', '<VisitBillInfo xsi:nil="true"/>', '<VisitBillInfo></VisitBillInfo>']) assert.equal((await read(xml || '<Result Status="Success"/>')).records.length, 0);
    assert.equal((await read(valid)).records[0]?.ID, "14");
  }
});
