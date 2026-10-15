import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowError, readRequest, type OperationalRead, type ReadInput } from "../operations/reads.js";
import { adaptVisitEvidence, type NormalizedVisitEvidence } from "./evidence.js";
import { evaluateVisit } from "./diagnosis.js";
import { loadMemberContext, validMemberContextAcceptance, type MemberContextAcceptance, type MemberContextOptions } from "./memberContext.js";

const NOW = "2026-10-10T17:20:00.000Z", scope = { officeId: "123", date: "2026-10-10", timezone: "America/Chicago", revision: 2 };
function acceptance(): MemberContextAcceptance {
  return { accepted: true, version: "synthetic-member-v1", sourceVersion: "synthetic-source-v1", reviewReference: "Synthetic standard schedule/service/date acceptance",
    scheduleOperation: "GetScheduleInfo", billTo: "primary", calendarDateEncoding: "iso_date_or_midnight", dateBounds: "inclusive", authorizationListComplete: true, contractListComplete: true };
}
const source = (operation: ReadInput["operation"], records: Record<string, string | null>[], truncated = false): OperationalRead => ({ operation, records, truncated,
  source: "hhaexchange", fetchedAt: NOW, validation: "source_unvalidated", timezone: "source_values_unconverted" });
function visit(): NormalizedVisitEvidence {
  return adaptVisitEvidence(source("GetVisitInfoV3", [{ ID: "77", VisitDate: scope.date, "Patient/ID": "5", "Caregiver/ID": "6",
    ScheduleStartTime: "2026-10-10T08:00:00-05:00", ScheduleEndTime: "2026-10-10T12:00:00-05:00", VisitStartTime: "2026-10-10T08:00:00-05:00", VisitEndTime: "2026-10-10T12:00:00-05:00",
    EVVStartTime: "2026-10-10T08:00:00-05:00", EVVEndTime: "2026-10-10T12:00:00-05:00" }]), { scope, visitId: "77", now: NOW, scheduleType: "fixed", openState: "closed",
    acceptance: { operation: "GetVisitInfoV3", version: "synthetic-source-v1", accepted: true, complete: true, scope, visitIds: ["77"], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" } });
}
function fixture() {
  let current = NOW, fences = 0;
  const calls: ReadInput[] = [], records = new Map<ReadInput["operation"], OperationalRead>([
    ["GetPatientDemographics", source("GetPatientDemographics", [{ PatientID: "5", OfficeID: "123", PayerID: "8", PatientStatusName: "Active",
      MedicaidStartDate: "2026-10-01", MedicaidEndDate: "2026-10-31", ManagedCareStartDate: "2026-10-01T00:00:00", ManagedCareEndDate: "2026-10-31T00:00:00" }])],
    ["GetScheduleInfo", source("GetScheduleInfo", [{ ID: "77", "Patient/ID": "5", "Caregiver/ID": "6", VisitDate: scope.date,
      ScheduleStartTime: "2026-10-10T08:00:00-05:00", ScheduleEndTime: "2026-10-10T12:00:00-05:00", "PrimaryBillTo/Contract/ID": "8", "PrimaryBillTo/ServiceCode/ID": "9", "SecondaryBillTo/Contract/ID": null, "SecondaryBillTo/ServiceCode/ID": null }])],
    ["GetPatientContracts", source("GetPatientContracts", [{ PlacementID: "10", "Contract/ID": "8", "ServiceCode/ID": "9", ServiceStartDate: "2026-10-01", DischargeDate: "2026-10-31" }])],
    ["SearchPatientAuthorizations", source("SearchPatientAuthorizations", [{ ID: "11", ContractID: "8", StartDate: "2026-10-01", StopDate: "2026-10-31" }])],
    ["GetPatientAuthorizationInfo", source("GetPatientAuthorizationInfo", [{ AuthorizationID: "11", "Patient/ID": "5", "Contract/ID": "8", "ServiceCode/ID": "9",
      StartDate: "2026-10-01", StopDate: "2026-10-31", MaxUnits: "100", RemainingUnits: "80", WeeklyMaxAuthorization: "20" }])],
  ]);
  let failOperation: ReadInput["operation"] | null = null, failure: Error = new Error("synthetic source private detail");
  let mutate: (input: ReadInput) => void = () => {};
  let failFence = false;
  const options: MemberContextOptions = { visit: visit(), acceptance: acceptance(), now: () => current,
    fence: async () => { fences++; if (failFence) throw new WorkflowError("revision_policy_changed_restart", 409); },
    query: async input => { readRequest(input); calls.push(structuredClone(input)); mutate(input); if (input.operation === failOperation) throw failure;
      const value = structuredClone(records.get(input.operation)!);
      if (input.operation === "GetPatientAuthorizationInfo" && value.records.length === 1) value.records[0]!.AuthorizationID = input.id!;
      return value;
    },
  };
  return { options, records, calls, fences: () => fences, advance: (ms: number) => { current = new Date(Date.parse(current) + ms).toISOString(); },
    fail: (operation: ReadInput["operation"], error = failure) => { failOperation = operation; failure = error; }, mutate: (fn: typeof mutate) => { mutate = fn; }, changePolicy: () => { failFence = true; } };
}

test("default/invalid source acceptance and unready visits do not initiate member source reads", async () => {
  const absent = fixture(); absent.options.acceptance = null;
  assert.equal((await loadMemberContext(absent.options)).context.authorization?.state, "unaccepted"); assert.equal(absent.calls.length, 0);
  const version = fixture(); version.options.acceptance!.sourceVersion = "different";
  assert.equal((await loadMemberContext(version.options)).context.authorization?.reason, "member_context_source_acceptance_changed"); assert.equal(version.calls.length, 0);
  const invalid = fixture(); invalid.options.acceptance = { ...acceptance(), dateBounds: "exclusive" } as unknown as MemberContextAcceptance;
  assert.equal((await loadMemberContext(invalid.options)).context.authorization?.reason, "member_context_acceptance_invalid"); assert.equal(invalid.calls.length, 0);
  for (const state of ["unaccepted", "failed", "unavailable", "incomplete", "stale"] as const) {
    const f = fixture(); f.options.visit = { ...f.options.visit, state }; assert.equal((await loadMemberContext(f.options)).context.authorization?.outcome, "unknown"); assert.equal(f.calls.length, 0);
  }
});

test("exact service/contract/date joins expose recorded windows without approving limits or actual payer eligibility", async () => {
  const f = fixture(), before = structuredClone(f.options.visit), result = await loadMemberContext(f.options);
  assert.deepEqual(f.options.visit, before);
  assert.deepEqual(f.calls.map(input => input.operation), ["GetPatientDemographics", "GetScheduleInfo", "GetPatientContracts", "SearchPatientAuthorizations", "GetPatientAuthorizationInfo"]);
  assert.deepEqual(f.calls.at(-1), { operation: "GetPatientAuthorizationInfo", patientId: "5", id: "11" });
  assert.equal(f.fences(), 11); assert.equal(result.authorizationWindow.relation, "matched"); assert.deepEqual(result.authorizationWindow.authorizationIds, ["11"]);
  assert.equal(result.authorizationWindow.approval, "not_established"); assert.equal(result.authorizationWindow.limitsValidation, "not_validated");
  assert.equal(result.context.authorization?.outcome, "unknown"); assert.equal(result.context.authorization?.state, "incomplete");
  assert.equal(result.recordedEligibility.medicaid.relation, "within_recorded_period"); assert.equal(result.recordedEligibility.managedCare.startDate, "2026-10-01");
  assert.equal(result.recordedEligibility.managedCare.rawStartDate, "2026-10-01T00:00:00"); assert.equal(result.recordedEligibility.payerVerified, false); assert.equal(result.context.eligibility?.outcome, "unknown");
  assert.equal(result.completeness.complete, false); assert.equal(result.completeness.authorizationDiscoveryComplete, true); assert.equal(result.completeness.contractDiscoveryComplete, true);
  const diagnosis = evaluateVisit(f.options.visit, { version: "synthetic", earlyReminderMinutes: null }, NOW, result.context);
  assert.ok(diagnosis.issues.some(issue => issue.kind === "authorization_unknown")); assert.ok(diagnosis.issues.some(issue => issue.kind === "eligibility_unknown"));
  assert.ok(result.sources.every(item => item.validation === "source_unvalidated" && item.sourceRevision));
});

test("an explicitly unaccepted profile provides bounded raw preview without accepted assessments", async () => {
  const f = fixture(); f.options.acceptance!.accepted = false;
  const result = await loadMemberContext(f.options);
  assert.equal(result.context.authorization?.state, "unaccepted"); assert.equal(result.context.authorization?.outcome, "unknown");
  assert.equal(result.context.eligibility?.state, "unaccepted"); assert.equal(result.recordedEligibility.medicaid.relation, "unaccepted");
  assert.equal(result.sources.length, 5); assert.equal(result.completeness.authorizationDiscoveryComplete, false); assert.equal(result.completeness.contractDiscoveryComplete, false);
});

test("complete accepted lists can identify missing and expired service authorization with inclusive calendar boundaries", async () => {
  for (const mode of ["missing", "expired", "outside_contract"] as const) {
    const f = fixture();
    if (mode === "missing") f.records.set("SearchPatientAuthorizations", source("SearchPatientAuthorizations", []));
    if (mode === "expired") for (const operation of ["SearchPatientAuthorizations", "GetPatientAuthorizationInfo"] as const) f.records.get(operation)!.records[0]!.StopDate = "2026-10-09";
    if (mode === "outside_contract") f.records.get("GetPatientContracts")!.records[0]!.DischargeDate = "2026-10-09";
    const result = await loadMemberContext(f.options);
    assert.equal(result.context.authorization?.state, "ready"); assert.equal(result.context.authorization?.outcome, "fail");
    assert.equal(result.authorizationWindow.relation, mode === "missing" ? "missing" : mode === "expired" ? "outside_period" : "contract_missing");
  }
  for (const boundary of ["StartDate", "StopDate"] as const) {
    const f = fixture(); for (const operation of ["SearchPatientAuthorizations", "GetPatientAuthorizationInfo"] as const) f.records.get(operation)!.records[0]![boundary] = scope.date;
    assert.equal((await loadMemberContext(f.options)).authorizationWindow.relation, "matched");
  }
});

test("missing records, unavailable source reads and a complete empty authorization list remain distinct", async () => {
  const unavailable = fixture(); unavailable.fail("GetPatientDemographics");
  const failed = await loadMemberContext(unavailable.options);
  assert.equal(failed.context.authorization?.state, "unavailable"); assert.equal(failed.context.authorization?.outcome, "unknown"); assert.equal(failed.sources[0]?.reason, "member_source_unavailable");
  const absent = fixture(); absent.records.set("GetPatientDemographics", source("GetPatientDemographics", []));
  const missing = await loadMemberContext(absent.options);
  assert.equal(missing.context.authorization?.state, "incomplete"); assert.equal(missing.context.authorization?.outcome, "unknown"); assert.equal(missing.sources[0]?.state, "ready");
  const discovery = fixture(); discovery.fail("SearchPatientAuthorizations");
  const unknown = await loadMemberContext(discovery.options); assert.equal(unknown.context.authorization?.state, "unavailable"); assert.equal(unknown.context.authorization?.outcome, "unknown");
  const empty = fixture(); empty.records.set("SearchPatientAuthorizations", source("SearchPatientAuthorizations", []));
  const confirmed = await loadMemberContext(empty.options);
  assert.equal(confirmed.context.authorization?.state, "ready"); assert.equal(confirmed.context.authorization?.outcome, "fail"); assert.equal(confirmed.authorizationWindow.relation, "missing");
});

test("service labels cannot substitute for the exact selected service-code identity", async () => {
  const f = fixture();
  f.records.get("GetScheduleInfo")!.records[0]!["PrimaryBillTo/ServiceCode/Name"] = "Same synthetic label";
  Object.assign(f.records.get("GetPatientAuthorizationInfo")!.records[0]!, { "ServiceCode/ID": "99", "ServiceCode/Name": "Same synthetic label" });
  const result = await loadMemberContext(f.options);
  assert.equal(result.authorizationWindow.relation, "missing"); assert.equal(result.context.authorization?.outcome, "fail");
  assert.deepEqual(result.authorizationWindow.authorizationIds, []);
});

test("partial, malformed, failed and undocumented lists never turn absence into an authorization failure", async () => {
  for (const mode of ["truncated", "unaccepted_list", "null_date", "invalid_date", "failed_detail", "duplicate", "unknown_contract_list"] as const) {
    const f = fixture(); f.records.get("GetPatientAuthorizationInfo")!.records[0]!["ServiceCode/ID"] = "99";
    if (mode === "truncated") f.records.get("SearchPatientAuthorizations")!.truncated = true;
    if (mode === "unaccepted_list") f.options.acceptance!.authorizationListComplete = false;
    if (mode === "unknown_contract_list") f.options.acceptance!.contractListComplete = false;
    if (mode === "null_date") f.records.get("GetPatientContracts")!.records[0]!.DischargeDate = null;
    if (mode === "invalid_date") f.records.get("SearchPatientAuthorizations")!.records[0]!.StartDate = "2026-02-30";
    if (mode === "failed_detail") f.fail("GetPatientAuthorizationInfo");
    if (mode === "duplicate") f.records.get("SearchPatientAuthorizations")!.records.push({ ...f.records.get("SearchPatientAuthorizations")!.records[0]! });
    const result = await loadMemberContext(f.options);
    assert.equal(result.context.authorization?.outcome, "unknown", mode); assert.equal(result.context.authorization?.state, "incomplete", mode);
    assert.equal(result.authorizationWindow.relation, "unknown", mode);
  }
});

test("office/member/visit/date and changed service-contract identity are fenced before later reads", async () => {
  for (const [operation, field, value, expected] of [
    ["GetPatientDemographics", "OfficeID", "124", /member_patient_office_scope_mismatch/], ["GetPatientDemographics", "PatientID", "99", /member_patient_office_scope_mismatch/],
    ["GetScheduleInfo", "Patient/ID", "99", /member_schedule_scope_mismatch/], ["GetScheduleInfo", "VisitDate", "2026-10-11", /member_schedule_scope_mismatch/],
    ["GetScheduleInfo", "ID", "78", /member_schedule_scope_mismatch/], ["GetScheduleInfo", "Caregiver/ID", "99", /member_schedule_source_changed/],
    ["GetScheduleInfo", "ScheduleStartTime", "2026-10-10T07:59:00-05:00", /member_schedule_source_changed/],
    ["GetPatientAuthorizationInfo", "Patient/ID", "99", /member_authorization_identity_mismatch/], ["GetPatientAuthorizationInfo", "Contract/ID", "99", /member_authorization_contract_changed/],
    ["GetPatientAuthorizationInfo", "StartDate", "2026-09-30", /member_authorization_dates_changed/],
  ] as const) {
    const f = fixture(); f.records.get(operation)!.records[0]![field] = value;
    await assert.rejects(loadMemberContext(f.options), expected);
    if (operation === "GetPatientDemographics") assert.equal(f.calls.length, 1);
    if (operation === "GetScheduleInfo") assert.equal(f.calls.length, 2);
  }
});

test("permission/release/quota/policy failures propagate and never become an empty successful context", async () => {
  for (const status of [403, 409, 423, 429]) {
    const f = fixture(); f.fail("GetPatientContracts", new WorkflowError("synthetic_guard_closed", status));
    await assert.rejects(loadMemberContext(f.options), error => error instanceof WorkflowError && error.code === "synthetic_guard_closed" && error.status === status);
  }
  const changed = fixture(); changed.mutate(input => { if (input.operation === "GetScheduleInfo") changed.changePolicy(); });
  await assert.rejects(loadMemberContext(changed.options), /revision_policy_changed_restart/); assert.equal(changed.calls.length, 2);
});

test("foreign rows in incomplete multi-record responses cannot escape through raw preview", async () => {
  for (const operation of ["GetPatientDemographics", "GetScheduleInfo", "GetPatientAuthorizationInfo"] as const) {
    const f = fixture(), original = f.records.get(operation)!.records[0]!;
    f.records.get(operation)!.records.push({ ...original, [operation === "GetPatientDemographics" ? "PatientID" : "Patient/ID"]: "99" });
    await assert.rejects(loadMemberContext(f.options), /member_patient_office_scope_mismatch|member_schedule_scope_mismatch|member_authorization_identity_mismatch/);
  }
  for (const operation of ["GetPatientDemographics", "GetScheduleInfo", "GetPatientAuthorizationInfo"] as const) {
    const f = fixture(); f.records.get(operation)!.records[0]![operation === "GetPatientDemographics" ? "PatientID" : "Patient/ID"] = null;
    const result = await loadMemberContext(f.options), preview = result.sources.find(item => item.operation === operation)!;
    assert.equal(result.context.authorization?.outcome, "unknown"); assert.equal(preview.state, "incomplete"); assert.deepEqual(preview.records, []);
  }
  const missingContract = fixture(); missingContract.records.get("GetPatientAuthorizationInfo")!.records[0]!["Contract/ID"] = null;
  assert.equal((await loadMemberContext(missingContract.options)).context.authorization?.outcome, "unknown");
});

test("authorization-detail and query budgets explicitly defer remaining work instead of asserting missing evidence", async () => {
  const f = fixture(); f.records.set("SearchPatientAuthorizations", source("SearchPatientAuthorizations", Array.from({ length: 7 }, (_, index) => ({ ID: String(index + 11), ContractID: "8", StartDate: "2026-10-01", StopDate: "2026-10-31" }))));
  f.records.get("GetPatientAuthorizationInfo")!.records[0]!["ServiceCode/ID"] = "99";
  const limited = await loadMemberContext(f.options);
  assert.equal(f.calls.length, 7); assert.equal(limited.completeness.authorizationDetailsTotal, 7); assert.equal(limited.completeness.authorizationDetailsRead, 3);
  assert.equal(limited.completeness.deferred, true); assert.equal(limited.context.authorization?.outcome, "unknown");
  const q = fixture(); q.options.maxQueries = 4;
  const stopped = await loadMemberContext(q.options); assert.equal(q.calls.length, 4); assert.equal(stopped.completeness.deferred, true); assert.equal(stopped.context.authorization?.outcome, "unknown");
  for (const option of [{ maxQueries: 10 }, { maxAuthorizationDetails: 6 }, { timeBudgetMs: 0 }]) await assert.rejects(loadMemberContext({ ...fixture().options, ...option }), /invalid_member_context_budget/);
});

test("the elapsed source-call budget defers discovery before another dispatch", async t => {
  let elapsed = 0; t.mock.method(performance, "now", () => elapsed);
  const f = fixture(); f.mutate(input => { if (input.operation === "GetPatientContracts") elapsed = 20000; });
  const result = await loadMemberContext(f.options);
  assert.equal(f.calls.length, 3); assert.equal(result.completeness.deferred, true); assert.equal(result.context.authorization?.outcome, "unknown");
  assert.equal(result.sources.at(-1)?.reason, "member_context_budget_deferred");
});

test("source aging during the join and changed visit source hashes prevent authoritative conclusions", async () => {
  const f = fixture(); f.records.set("SearchPatientAuthorizations", source("SearchPatientAuthorizations", []));
  f.mutate(input => { if (input.operation === "SearchPatientAuthorizations") f.advance(300001); });
  const result = await loadMemberContext(f.options); assert.equal(result.context.authorization?.state, "stale"); assert.equal(result.context.authorization?.outcome, "unknown");
  const changed = fixture(); changed.options.visit = { ...changed.options.visit, raw: { ...changed.options.visit.raw, "Patient/ID": "6" } };
  assert.equal((await loadMemberContext(changed.options)).context.authorization?.reason, "member_visit_source_revision_mismatch"); assert.equal(changed.calls.length, 0);
  const stale = fixture(); stale.advance(300001); assert.equal((await loadMemberContext(stale.options)).context.authorization?.state, "stale"); assert.equal(stale.calls.length, 0);
});

test("recorded expired/missing coverage and active patient status never become actual payer eligibility", async () => {
  for (const patch of [{ MedicaidEndDate: "2026-10-09" }, { MedicaidStartDate: null, MedicaidEndDate: null }, { ManagedCareEndDate: "2026-02-30" }]) {
    const f = fixture(); Object.assign(f.records.get("GetPatientDemographics")!.records[0]!, patch);
    const result = await loadMemberContext(f.options); assert.equal(result.context.eligibility?.outcome, "unknown"); assert.equal(result.recordedEligibility.payerVerified, false);
    assert.equal(result.recordedEligibility.medicaid.relation, patch.MedicaidEndDate === "2026-10-09" ? "outside_recorded_period" : patch.MedicaidStartDate === null ? "unavailable" : "within_recorded_period");
  }
});

test("calendar date parsing rejects naive non-midnight timestamps and does not mix primary and secondary billing legs", async () => {
  const bad = fixture(); bad.records.get("GetPatientContracts")!.records[0]!.ServiceStartDate = "2026-10-01T08:00:00";
  assert.equal((await loadMemberContext(bad.options)).context.authorization?.outcome, "unknown");
  const secondary = fixture(); secondary.options.acceptance!.billTo = "secondary";
  const missing = await loadMemberContext(secondary.options); assert.equal(missing.context.authorization?.reason, "member_schedule_service_contract_missing"); assert.equal(secondary.calls.length, 2);
  const f = fixture(); f.options.acceptance!.billTo = "secondary";
  Object.assign(f.records.get("GetScheduleInfo")!.records[0]!, { "PrimaryBillTo/Contract/ID": "99", "PrimaryBillTo/ServiceCode/ID": "98", "SecondaryBillTo/Contract/ID": "8", "SecondaryBillTo/ServiceCode/ID": "9" });
  assert.equal((await loadMemberContext(f.options)).authorizationWindow.relation, "matched");
});

test("protected profile validation rejects unit mappings, arbitrary fields and parent-version mismatch", () => {
  assert.equal(validMemberContextAcceptance(acceptance(), "synthetic-source-v1"), true);
  for (const patch of [{ accepted: "true" }, { sourceVersion: "other" }, { scheduleOperation: "GetLinkedScheduleInfo" }, { billTo: "either" }, { billTo: ["primary"] },
    { dateBounds: "exclusive" }, { calendarDateEncoding: "guess_local_timezone" }, { authorizationListComplete: "true" }, { reviewReference: "" }, { unitMinutes: 15 }, { payerVerified: true }])
    assert.equal(validMemberContextAcceptance({ ...acceptance(), ...patch }, "synthetic-source-v1"), false);
});
