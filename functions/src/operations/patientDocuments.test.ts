import assert from "node:assert/strict";
import test from "node:test";
import { patientDocumentRead } from "./patientDocuments.js";
import { workspaceRoute } from "./routes.js";
import type { OperationsWorkspace } from "./workspace.js";
import type { OperationalRead, ReadInput } from "./reads.js";

const search = { operation: "SearchPatientDocument", patientId: "8", officeId: "9", id: "", documentTypeId: "", date: "" };
const download = { operation: "DownloadPatientDocument", patientId: "8", officeId: "9", id: "7" };
const source = (operation: ReadInput["operation"], records: OperationalRead["records"], truncated = false): OperationalRead => ({ operation, records, truncated, fetchedAt: "2026-11-02T21:00:00.000Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted" });
const metadata = (change: Record<string, string | null> = {}) => source("SearchPatientDocument", [{ PatientID: "8", PatientDocID: "7", PatientDocumentTypeID: "6", FileName: "synthetic.pdf", CreatedOn: "2026-11-02T15:00:00", FileSize: "4", ...change }]);
const file = (): OperationalRead => ({ ...source("DownloadPatientDocument", [{ PatientDocID: "7", FileName: "synthetic.pdf", FileSize: null, ContentType: "application/pdf" }]), attachment: { filename: "synthetic.pdf", byteLength: 4, base64: "dGVzdA==", contentType: "application/octet-stream" } });
function fixture() {
  const state = { approved: true, officeId: "9", revision: 1, reads: ["GetPatientDemographics", "SearchPatientDocument", "DownloadPatientDocument"], changeAt: 0, withdrawAt: 0, elapsed: 0, delay: 0 };
  const calls: ReadInput[] = [];
  let patient = source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "9" }]), patientAfter: OperationalRead | null = null;
  let meta = metadata(), metaAfter: OperationalRead | null = null, bytes = file();
  let patients = 0, metas = 0;
  const workspace = {
    async settings() { return { dataApproved: state.approved, settings: { officeId: state.officeId, revision: state.revision, enabledReads: [...state.reads] } }; },
    async query(input: ReadInput) {
      calls.push(input); state.elapsed += state.delay;
      if (state.changeAt === calls.length) state.revision++;
      if (state.withdrawAt === calls.length) state.approved = false;
      if (input.operation === "GetPatientDemographics") return ++patients > 1 && patientAfter ? patientAfter : patient;
      if (input.operation === "SearchPatientDocument") return ++metas > 1 && metaAfter ? metaAfter : meta;
      return bytes;
    }
  } as unknown as OperationsWorkspace;
  return { state, calls, workspace, patient: (v: OperationalRead) => { patient = v; }, patientAfter: (v: OperationalRead) => { patientAfter = v; }, meta: (v: OperationalRead) => { meta = v; }, metaAfter: (v: OperationalRead) => { metaAfter = v; }, bytes: (v: OperationalRead) => { bytes = v; },
    read: (input: unknown = search) => patientDocumentRead(workspace, input, "synthetic-admin", () => state.elapsed) };
}

test("patient document discovery proves current membership twice and preserves bounded, unknown and zero source metadata", async () => {
  const f = fixture(); f.meta({ ...metadata({ FileSize: "0", PatientDocumentType: "", Description: "private-description", CreatedBy: "private-actor", StreamData: "private-bytes" }), truncated: true });
  const result = await f.read(); assert.equal(result.records[0]!.FileSize, "0"); assert.equal(result.records[0]!.PatientDocumentType, ""); assert.equal(result.truncated, true);
  assert.deepEqual(result.scope, { patientId: "8", officeId: "9" }); assert.match(result.records[0]!.Interpretation!, /no clinical form instance/);
  assert.doesNotMatch(JSON.stringify(result), /private-/); assert.equal(result.fetchedAt, "2026-11-02T21:00:00.000Z");
  assert.deepEqual(f.calls, [{ operation: "GetPatientDemographics", id: "8" }, { operation: "SearchPatientDocument", patientId: "8" }, { operation: "GetPatientDemographics", id: "8" }]);
});

test("bounded file retrieval requires fresh exact metadata membership both before and after the read", async () => {
  const f = fixture(); const result = await f.read(download);
  assert.equal(result.attachment!.byteLength, 4); assert.equal(result.attachment!.contentType, "application/octet-stream"); assert.equal(result.records[0]!.FileSize, null);
  assert.equal(result.interpretation, "patient_document_file_unvalidated"); assert.ok(Number.isFinite(Date.parse(result.membershipCheckedAt)));
  assert.deepEqual(result.metadataReadAt, { before: "2026-11-02T21:00:00.000Z", after: "2026-11-02T21:00:00.000Z" });
  assert.deepEqual(f.calls.map(x=>x.operation), ["GetPatientDemographics", "SearchPatientDocument", "DownloadPatientDocument", "SearchPatientDocument", "GetPatientDemographics"]);
  assert.deepEqual(f.calls[1], { operation: "SearchPatientDocument", patientId: "8", id: "7" }); assert.deepEqual(f.calls[2], { operation: "DownloadPatientDocument", id: "7" });
});

test("all required grants, release and configured office are checked before any source dispatch", async () => {
  for (const mode of ["approval", "office", "GetPatientDemographics", "SearchPatientDocument", "DownloadPatientDocument"]) {
    const f = fixture(); if (mode === "approval") f.state.approved = false; else if (mode === "office") f.state.officeId = "99"; else f.state.reads = f.state.reads.filter(op=>op!==mode);
    await assert.rejects(f.read(download), /operational_data_release_not_approved|office_scope_mismatch|read_not_owner_enabled/); assert.equal(f.calls.length, 0);
  }
});

test("invalid filters and expanded inputs fail before source reads, while optional empty filters remain nil", async () => {
  for (const input of [null, [], { ...search, patientId: "0" }, { ...search, date: "2026-02-30" }, { ...search, id: "0" }, { ...search, documentTypeId: null }, { ...search, caregiverId: "10" }, { ...download, date: "2026-11-02" }, { ...download, id: "" }, { ...download, operation: "AddPatientDocument" }]) {
    const f = fixture(); await assert.rejects(f.read(input), /invalid_patient_document_query|invalid_identifier|invalid_date/); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); await f.read({ ...search, id: "7", documentTypeId: "6", date: "2026-11-02" });
  assert.deepEqual(f.calls[1], { operation: "SearchPatientDocument", patientId: "8", id: "7", documentTypeId: "6", date: "2026-11-02" });
});

test("wrong/unknown/truncated/ambiguous patient identity cannot read metadata or bytes", async () => {
  for (const data of [source("GetPatientDemographics", []), source("GetPatientDemographics", [{ PatientID: "99", OfficeID: "9" }]), source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "99" }]), source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "9" }], true), source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "9" }, { PatientID: "8", OfficeID: "9" }])]) {
    const f = fixture(); f.patient(data); await assert.rejects(f.read(download), /patient_office_mismatch/); assert.equal(f.calls.length, 1);
  }
});

test("unknown, foreign or non-unique document membership is refused before any blob request", async () => {
  for (const data of [metadata({ PatientID: "99" }), metadata({ PatientDocID: "99" }), source("SearchPatientDocument", []), { ...metadata(), truncated: true }, source("SearchPatientDocument", [...metadata().records, ...metadata().records])]) {
    const f = fixture(); f.meta(data); await assert.rejects(f.read(download), /patient_document_membership_unverified/); assert.equal(f.calls.some(x=>x.operation.startsWith('Download')), false);
  }
});

test("changed metadata or patient transfer during a download discards the attachment", async () => {
  for (const change of [{ FileName: "changed.pdf" }, { PatientDocumentTypeID: "99" }, { CreatedOn: "" }, { FileSize: "5" }]) {
    const f = fixture(); f.metaAfter(metadata(change)); await assert.rejects(f.read(download), /patient_document_changed_restart/);
  }
  const moved = fixture(); moved.patientAfter(source("GetPatientDemographics", [{ PatientID: "8", OfficeID: "99" }])); await assert.rejects(moved.read(download), /patient_office_mismatch/);
});

test("attachment size/name and closed byte metadata are verified without guessing source size units", async () => {
  for (const FileSize of ["0", "3", "4KB", " "]) {
    const f = fixture(); f.meta(metadata({ FileSize })); await assert.rejects(f.read(download), /patient_document_size_unverified/);
  }
  for (const FileSize of [null, ""]) { const f = fixture(); f.meta(metadata({ FileSize })); assert.equal((await f.read(download)).attachment!.byteLength, 4); }
  for (const change of [{ byteLength: 3 }, { filename: "../bad.pdf" }, { contentType: "text/html" }, { base64: "invalid!" }]) {
    const f = fixture(); const data = file(); Object.assign(data.attachment!, change); f.bytes(data); await assert.rejects(f.read(download), /patient_document_download_unverified|download_size_mismatch|invalid_or_oversize_download/);
  }
  const mismatch = fixture(); mismatch.meta(metadata({ FileName: "different.pdf" })); await assert.rejects(mismatch.read(download), /patient_document_changed_restart/);
});

test("settings/release races and elapsed budget stop subsequent requests without returning bytes", async () => {
  for (const at of [1, 2, 3, 4, 5]) {
    const f = fixture(); f.state.changeAt = at; await assert.rejects(f.read(download), /office_policy_changed_restart/); assert.equal(f.calls.length, at);
  }
  const withdraw = fixture(); withdraw.state.withdrawAt = 3; await assert.rejects(withdraw.read(download), /office_policy_changed_restart/); assert.equal(withdraw.calls.length, 3);
  const slow = fixture(); slow.state.delay = 20_000; await assert.rejects(slow.read(download), /patient_document_read_budget_deferred/); assert.equal(slow.calls.length, 2);
});

test("the existing protected public route cannot bypass patient/office checks for a file read", async () => {
  const f = fixture(); const missing = await workspaceRoute(f.workspace, "POST", "/workspace/read", { operation: "DownloadPatientDocument", id: "7" }, "synthetic-admin");
  assert.equal(missing?.status, 400); assert.equal(f.calls.length, 0);
  const result = await workspaceRoute(f.workspace, "POST", "/workspace/read", download, "synthetic-admin"); assert.equal(result?.status, 200);
});
