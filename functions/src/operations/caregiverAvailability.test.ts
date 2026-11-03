import assert from "node:assert/strict";
import test from "node:test";
import { caregiverAvailabilityRead } from "./caregiverAvailability.js";
import { workspaceRoute } from "./routes.js";
import type { OperationsWorkspace } from "./workspace.js";
import type { OperationalRead, ReadInput } from "./reads.js";

const query = { operation: "GetCaregiverPermanentWeekAvailability", id: "8", officeId: "9" } as const;
const source = (operation: ReadInput["operation"], records: OperationalRead["records"], truncated = false): OperationalRead => ({ operation, records, truncated, fetchedAt: "2026-11-03T02:00:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted" });
const profile = () => source("GetCaregiverDemographics", [{ ID: "8", OfficeIDs: '["9"]' }]);
function fixture() {
  const state = { approved: true, officeId: "9", revision: 1, reads: ["GetCaregiverDemographics", "GetCaregiverPermanentWeekAvailability", "GetCaregiverSpecialAvailability"], changeAt: 0, withdrawAt: 0, elapsed: 0, delay: 0 };
  const calls: ReadInput[] = []; let profiles = 0;
  let caregiver = profile(), caregiverAfter: OperationalRead | null = null;
  let availability = source("GetCaregiverPermanentWeekAvailability", [{ PermanentWeekID: "7", CaregiverID: "8", OfficeID: "9", MondayFrom: "", MondayTo: "0", PrivateNote: "private-note" }]);
  const workspace = {
    async settings() { return { dataApproved: state.approved, settings: { officeId: state.officeId, revision: state.revision, enabledReads: [...state.reads] } }; },
    async query(input: ReadInput) {
      calls.push(input); state.elapsed += state.delay;
      if (state.changeAt === calls.length) state.revision++;
      if (state.withdrawAt === calls.length) state.approved = false;
      if (input.operation === "GetCaregiverDemographics") return ++profiles > 1 && caregiverAfter ? caregiverAfter : caregiver;
      return availability;
    }
  } as unknown as OperationsWorkspace;
  return { state, calls, workspace, caregiver: (v: OperationalRead) => { caregiver = v; }, after: (v: OperationalRead) => { caregiverAfter = v; }, availability: (v: OperationalRead) => { availability = v; },
    read: (value: unknown = query) => caregiverAvailabilityRead(workspace, value, "synthetic-admin", () => state.elapsed) };
}

test("availability returns only closed raw fields after fresh caregiver-office proof on both sides", async () => {
  const f = fixture(), result = await f.read();
  assert.deepEqual(f.calls, [{ operation: "GetCaregiverDemographics", id: "8" }, { operation: query.operation, id: "8" }, { operation: "GetCaregiverDemographics", id: "8" }]);
  assert.deepEqual(result.scope, { caregiverId: "8", officeId: "9" });
  assert.equal(result.membershipReadAt.before, result.membershipReadAt.after); assert.equal(result.membershipCheckedAt, result.membershipReadAt.after);
  assert.equal(result.records[0]!.MondayFrom, ""); assert.equal(result.records[0]!.MondayTo, "0"); assert.equal(result.records[0]!.TuesdayFrom, null);
  assert.match(result.records[0]!.Interpretation!, /No eligibility/); assert.doesNotMatch(JSON.stringify(result), /private-note/);
});

test("special availability preserves unvalidated period strings and successful empty reads stay empty", async () => {
  const f = fixture(); f.availability(source("GetCaregiverSpecialAvailability", [{ SpecialAvailabilityID: "7", CaregiverID: "8", OfficeID: "9", FromDate: "", ToDate: "source-date" }]));
  const result = await f.read({ ...query, operation: "GetCaregiverSpecialAvailability" });
  assert.equal(result.records[0]!.FromDate, ""); assert.equal(result.records[0]!.ToDate, "source-date");
  const empty = fixture(); empty.availability(source(query.operation, [])); assert.deepEqual((await empty.read()).records, []); assert.equal(empty.calls.length, 3);
});

test("release, configured office and both read grants are checked before any source dispatch", async () => {
  for (const mode of ["release", "office", "availability", "profile"]) {
    const f = fixture();
    if (mode === "release") f.state.approved = false;
    else if (mode === "office") f.state.officeId = "99";
    else f.state.reads = f.state.reads.filter(op => op !== (mode === "profile" ? "GetCaregiverDemographics" : query.operation));
    await assert.rejects(f.read(), /operational_data_release_not_approved|office_scope_mismatch|read_not_owner_enabled/); assert.equal(f.calls.length, 0);
  }
});

test("invalid, inherited and unexpected input fields cannot widen caregiver or office scope", async () => {
  for (const value of [null, [], { ...query, id: "0" }, { ...query, officeId: "" }, { ...query, caregiverId: "99" }, Object.create(query), { ...query, operation: "SearchCaregivers" }]) {
    const f = fixture(); await assert.rejects(f.read(value)); assert.equal(f.calls.length, 0);
  }
});

test("missing, foreign, ambiguous and truncated caregiver membership refuses before availability", async () => {
  for (const offices of [null, "[]", '["99"]', '["9","9"]', '[9]', '"9"', '["09"]']) {
    const f = fixture(); f.caregiver(source("GetCaregiverDemographics", [{ ID: "8", OfficeIDs: offices }]));
    await assert.rejects(f.read(), /caregiver_office_mismatch/); assert.equal(f.calls.length, 1);
  }
  for (const data of [source("GetCaregiverDemographics", []), source("GetCaregiverDemographics", [{ ID: "99", OfficeIDs: '["9"]' }]), { ...profile(), truncated: true }, { ...profile(), records: [...profile().records, ...profile().records] }]) {
    const f = fixture(); f.caregiver(data); await assert.rejects(f.read(), /caregiver_office_mismatch/); assert.equal(f.calls.length, 1);
  }
});

test("every returned availability row must match the caregiver and configured office without hidden filtering", async () => {
  for (const patch of [{ CaregiverID: "99" }, { OfficeID: "99" }, { PermanentWeekID: "0" }]) {
    const f = fixture(); f.availability(source(query.operation, [{ PermanentWeekID: "7", CaregiverID: "8", OfficeID: "9" }, { PermanentWeekID: "6", CaregiverID: "8", OfficeID: "9", ...patch }]));
    await assert.rejects(f.read(), /caregiver_availability_(caregiver_mismatch|office_mismatch|identity_unverified)/); assert.equal(f.calls.length, 2);
  }
});

test("office transfer after availability invalidates the result and supported preview truncation remains explicit", async () => {
  const f = fixture(); f.after(source("GetCaregiverDemographics", [{ ID: "8", OfficeIDs: '["99"]' }])); await assert.rejects(f.read(), /caregiver_office_mismatch/); assert.equal(f.calls.length, 3);
  const partial = fixture(); partial.availability(source(query.operation, [{ PermanentWeekID: "7", CaregiverID: "8", OfficeID: "9" }], true)); assert.equal((await partial.read()).truncated, true);
});

test("settings and release changes fence every read, including the final membership read", async () => {
  for (const at of [1, 2, 3]) for (const mode of ["settings", "release"]) {
    const f = fixture(); if (mode === "settings") f.state.changeAt = at; else f.state.withdrawAt = at;
    await assert.rejects(f.read(), /office_policy_changed_restart/); assert.equal(f.calls.length, at);
  }
});

test("unexpected operation/source, attachments, duplicate IDs and malformed raw values never escape the public boundary", async () => {
  const row = { PermanentWeekID: "7", CaregiverID: "8", OfficeID: "9" };
  for (const data of [{ ...source(query.operation, [row]), operation: "SearchPatients" as const }, { ...source(query.operation, [row]), source: "other" },
    source(query.operation, [row, row]), source(query.operation, Array.from({ length: 201 }, (_, i) => ({ ...row, PermanentWeekID: String(i + 1) }))),
    { ...source(query.operation, [row]), attachment: { filename: "synthetic.bin", contentType: "application/octet-stream" as const, base64: "YQ==", byteLength: 1 } },
    source(query.operation, [{ ...row, MondayFrom: {} as unknown as string }])]) {
    const f = fixture(); f.availability(data as OperationalRead); await assert.rejects(f.read());
  }
});

test("bounded elapsed time defers remaining verification without a retry or unverified partial release", async () => {
  const f = fixture(); f.state.delay = 16000; await assert.rejects(f.read(), /caregiver_availability_read_budget_deferred/); assert.equal(f.calls.length, 2);
});

test("the public workspace read route cannot bypass caregiver-office membership or an owner-disabled read", async () => {
  const f = fixture(); f.state.reads = ["GetCaregiverDemographics"];
  const result = await workspaceRoute(f.workspace, "POST", "/workspace/read", query, "synthetic-admin");
  assert.equal(result?.status, 423); assert.equal(f.calls.length, 0);
});
