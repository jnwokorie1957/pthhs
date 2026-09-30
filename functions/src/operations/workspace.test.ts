import { LINKED_SCHEDULE_EVIDENCE_VERIFIER_AVAILABLE, LinkedScheduleCreationWorkflow, createLinkedScheduleRequest, submitLinkedScheduleCreation } from "./linkedScheduleCreations.js";
import { CollectionNoteWorkflow, collectionNoteRequest, submitCollectionNote } from "./collectionNotes.js";
import { ReferralCreationWorkflow, createReferralRequest } from "./referralCreations.js";
import { ContractCreationWorkflow, createContractRequest } from "./contractCreations.js";
import { CaregiverPictureWorkflow, caregiverPictureRequest, pictureFile, submitCaregiverPicture } from "./caregiverPictures.js";
import { DocumentCreationWorkflow, documentCreationRequest } from "./documentCreations.js";
import { DocumentReplacementWorkflow, documentReplacementRequest, replacementFile } from "./documentReplacements.js";
import { MedicalCreationWorkflow, createMedicalRequest, submitMedicalCreation } from "./medicalCreations.js";
import { WriteRecoveryWorkflow } from "./recovery.js";
import { PatientClinicalWorkflow, patientClinicalRequest, submitPatientClinical } from "./patientClinical.js";
import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { documentMetadataRequest, submitDocumentMetadata } from "./documentMetadata.js";
import { patientNoteRequest, submitPatientNote } from "./patientNotes.js";
import { AVAILABILITY_CREATIONS, availabilityCreationRequest, submitAvailabilityCreation } from "./availabilityCreations.js";
import { patientContractRequest, submitPatientContract } from "./patientContracts.js";
import { createRateRequest, submitRateCreation } from "./rateCreations.js";
import { submitTopic, topicRequest } from "./topics.js";
import { documentTypeRequest, submitDocumentType } from "./documentTypes.js";
import { availabilityRequest, submitAvailability, AVAILABILITY_WRITES } from "./availability.js";
import assert from "node:assert/strict";
import test from "node:test";
import { OperationsWorkspace, workspaceCursor, nextWorkspaceCursor, type WorkspaceRepository, type Versioned, type Settings } from "./workspace.js";
import { WorkflowError, operationalRead, boundedAttachment, readRequest, READ_OPERATIONS, type OperationalRead, type ReadInput } from "./reads.js";
import { workspaceRoute } from "./routes.js";
import { rateWriteRequest, submitRate } from "./writes.js";

class MemoryRepository implements WorkspaceRepository {
  records = new Map<string, Versioned>(); audit: string[] = []; reads = 0; deferred = 0;
  async get<T extends Versioned>(collection: string, id: string) { return structuredClone(this.records.get(collection + "/" + id) as T ?? null); }
  async list<T extends Versioned>(collection: string) { return [...this.records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, value]) => structuredClone(value) as T); }
  async page<T extends Versioned>(collection: string, cursor?: string) {
    const boundary = workspaceCursor(cursor);
    const rows = (await this.list<T>(collection)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)).filter(row => !boundary || row.updatedAt < boundary.updatedAt || row.updatedAt === boundary.updatedAt && row.id < boundary.id);
    const items = rows.slice(0, 100), last = items.at(-1);
    return { items, nextCursor: rows.length > 100 && last ? nextWorkspaceCursor(last.updatedAt, last.id) : null };
  }
  async change<T extends Versioned>(collection: string, id: string, expected: number, actor: string, action: string, update: (prior: T | null) => T) {
    const prior = await this.get<T>(collection, id);
    if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
    const next = update(prior); this.records.set(collection + "/" + id, structuredClone(next)); this.audit.push(actor + ":" + action); return next;
  }
  targets = new Map<string, string>();
  async getWriteTarget(target: string) { const id = this.targets.get(target); return id ? { active: true, proposalId: id, updatedAt: "2026-01-01T00:00:00Z" } : null; }
  async reserveWriteTarget(target: string, proposalId: string) { if (this.targets.has(target)) throw new WorkflowError("source_target_locked_reconciliation_required", 409); this.targets.set(target, proposalId); }
  async releaseWriteTarget(target: string, proposalId: string) { if (this.targets.get(target) === proposalId) this.targets.delete(target); }
  async reserveRead() { this.reads++; }
  async deferReads(seconds: number) { this.deferred = seconds; }
}
const preferences = { revision: 0, officeId: "123", officeTimezone: "America/Chicago", enabledReads: ["SearchVisitsV2", "GetPatientDemographics"], policyReference: "synthetic approval", missingClockInMinutes: null, missingClockOutMinutes: null };
const result = (input: ReadInput): OperationalRead => ({ operation: input.operation, fetchedAt: "2026-09-30T00:00:00Z", source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted", records: [{ VisitID: "77" }], truncated: false });

test("workspace queues page tied timestamps without losing older rows and reject malformed cursors", async () => {
  const repository = new MemoryRepository(), service = new OperationsWorkspace(repository, async input => result(input), true);
  for (let i = 0; i < 205; i++) { const id = `case-${String(i).padStart(3, "0")}`; repository.records.set(`investigations/${id}`, { id, revision: 1, updatedAt: "2026-09-30T00:00:00.000Z" }); }
  const ids: string[] = []; let cursor: string | null = null;
  do {
    const response = await workspaceRoute(service, "GET", "/workspace/investigations", cursor ? { cursor } : {}, "owner");
    assert.equal(response?.status, 200);
    const body = response?.body as { investigations: Versioned[]; nextCursor: string | null };
    assert.ok(body.investigations.length <= 100); ids.push(...body.investigations.map(row => row.id)); cursor = body.nextCursor;
  } while (cursor);
  assert.equal(ids.length, 205); assert.equal(new Set(ids).size, 205); assert.equal(ids.at(-1), "case-000");
  assert.equal((await workspaceRoute(service, "GET", "/workspace/investigations", { cursor: "bad" }, "owner"))?.status, 400);
  assert.equal((await workspaceRoute(service, "GET", "/workspace/audit", { arbitrary: "field" }, "owner"))?.status, 400);
});

test("route integration keeps operational data default-closed independently of owner preferences", async () => {
  const repository = new MemoryRepository(); let calls = 0;
  const service = new OperationsWorkspace(repository, async input => { calls++; return result(input); }, false);
  const initial = await service.settings(); assert.equal(initial.settings.officeId, null); assert.deepEqual(initial.settings.enabledReads, []);
  assert.equal((await workspaceRoute(service, "POST", "/workspace/settings", preferences, "owner"))?.status, 200);
  assert.equal((await workspaceRoute(service, "POST", "/workspace/read", { operation: "SearchVisitsV2", officeId: "123", date: "2026-09-30" }, "owner"))?.status, 423);
  assert.equal((await workspaceRoute(service, "GET", "/workspace/investigations", null, "owner"))?.status, 423);
  assert.equal(calls, 0); assert.equal(repository.reads, 0);
  assert.equal((await workspaceRoute(service, "POST", "/workspace/settings", { ...preferences, revision: 1, dataApproved: true }, "owner"))?.status, 400);
});

test("owner controls persist across services, reject stale writes, enforce office and operation scope", async () => {
  const repository = new MemoryRepository(), service = new OperationsWorkspace(repository, async input => result(input), true);
  await service.saveSettings(preferences, "owner");
  const reloaded = new OperationsWorkspace(repository, async input => result(input), true);
  assert.equal((await reloaded.settings()).settings.officeId, "123");
  await assert.rejects(reloaded.saveSettings(preferences, "owner"), /revision_conflict/);
  await assert.rejects(reloaded.query({ operation: "SearchVisitsV2", officeId: "456", date: "2026-09-30" }, "owner"), /office_scope_mismatch/);
  await assert.rejects(reloaded.query({ operation: "GetVisitBillInfoV2", id: "77" }, "owner"), /read_not_owner_enabled/);
  assert.equal((await reloaded.query({ operation: "SearchVisitsV2", officeId: "123", date: "2026-09-30" }, "owner")).records[0]?.VisitID, "77");
  assert.equal(repository.reads, 1); assert.ok(repository.audit.some(value => value.includes("read_requested_SearchVisitsV2")));
});

test("investigation create, assign, outreach and resolve preserve append-only history with conflict protection", async () => {
  const repository = new MemoryRepository(), service = new OperationsWorkspace(repository, async input => result(input), true);
  const draft = { id: "case-1", revision: 0, visitId: "77", title: "Synthetic clock review", assignee: "supervisor", status: "open", followUpAt: "2026-10-01T09:00:00-05:00", note: "Contact attempt recorded" };
  const created = await service.saveInvestigation(draft, "owner");
  const resolved = await service.saveInvestigation({ ...draft, revision: 1, status: "resolved", note: "Evidence reviewed; no source edits" }, "supervisor");
  assert.equal(created.events.length, 1); assert.equal(resolved.events.length, 2); assert.equal(resolved.events[0]?.note, draft.note);
  await assert.rejects(service.saveInvestigation({ ...draft, revision: 1 }, "owner"), /revision_conflict/);
  await assert.rejects(service.saveInvestigation({ ...draft, revision: 2, visitId: "88" }, "owner"), /visit_reference_immutable/);
  assert.equal((await service.investigations())[0]?.status, "resolved");
  assert.equal(repository.audit.length, 2);
});

test("change proposals require an independent review and never submit HHA writes", async () => {
  const repository = new MemoryRepository(); let hhaCalls = 0;
  const service = new OperationsWorkspace(repository, async input => { hhaCalls++; return result(input); }, true);
  await service.saveIntent({ id: "intent-1", revision: 0, kind: "visit_correction_review", visitId: "77", rationale: "Synthetic discrepancy", proposed: "Review linked call; preserve originals" }, "requester");
  await assert.rejects(service.saveIntent({ id: "intent-1", revision: 1, state: "approved" }, "requester"), /independent_reviewer_required/);
  const approved = await service.saveIntent({ id: "intent-1", revision: 1, state: "approved" }, "reviewer");
  assert.equal(approved.state, "approved"); assert.equal(hhaCalls, 0);
  await assert.rejects(service.saveIntent({ id: "intent-1", revision: 2, state: "approved" }, "reviewer"), /intent_already_reviewed/);
});

test("typed reads use the WSDL request shape and strip sensitive/unselected fields", async () => {
  assert.match(readRequest({ operation: "SearchVisitsV2", officeId: "123", date: "2026-09-30" }), /PatientID xsi:nil="true"/);
  assert.throws(() => readRequest({ operation: "GetPatientDemographics", id: "1</ID>" }), /invalid_identifier/);
  assert.throws(() => readRequest({ operation: "SearchVisitsV2", officeId: "123", date: "2026-02-30" }), /invalid_date/);
  const data = await operationalRead({ async call(op, xml, attempts) {
    assert.equal(op, "GetPatientDemographics"); assert.equal(xml, "<PatientInfo><ID>77</ID></PatientInfo>"); assert.equal(attempts, 1);
    return { ok: true, transportOk: true, operation: op, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: "<PatientInfo><PatientID>77</PatientID><FirstName>Synthetic</FirstName><SSN>never-return</SSN><BirthDate>never-return</BirthDate></PatientInfo>" };
  } }, { operation: "GetPatientDemographics", id: "77" });
  assert.equal(data.records[0]?.FirstName, "Synthetic"); assert.doesNotMatch(JSON.stringify(data), /never-return|SSN|BirthDate/);
  assert.equal(data.records[0]?.PatientStatusName, null);
});

test("vendor backoff is persisted for all operational instances and returned to caller", async () => {
  const repository = new MemoryRepository(), service = new OperationsWorkspace(repository, async () => { throw new WorkflowError("vendor_backoff_active", 429, 120); }, true);
  await service.saveSettings(preferences, "owner");
  const response = await workspaceRoute(service, "POST", "/workspace/read", { operation: "SearchVisitsV2", officeId: "123", date: "2026-09-30" }, "owner");
  assert.equal(response?.status, 429); assert.equal(repository.deferred, 120); assert.equal((response?.body as any).retryAfterSeconds, 120);
});

test("every supported read has a bounded typed request and rejects arbitrary operations", () => {
  for (const operation of READ_OPERATIONS) {
    const body = readRequest({ operation, id: "77", officeId: "123", referralStatusId:"1", referralSourceId:"2", salesStaffId:"3", patientId: "88", caregiverId: "7", complianceType: "Medical", sequence: "0", appliesTo: "Patient", caregiverStatus: "1", status: operation.includes("Compliance") || operation === "GetCaregiverMedicalDetails" ? "Pending" : "Active", date: "2026-09-30", term: "O'Brien", contractId: "99", modifiedAfter: "2026-09-30T00:00:00", modifiedAfterUtc: "2026-09-30T00:00:00Z", lastId: "0", phone: "5555550123", page: "1" });
    assert.equal(typeof body, "string"); assert.doesNotMatch(body, /undefined|NaN/);
  }
  assert.throws(() => readRequest({ operation: "DeleteVisit" as any, id: "77" }), /unsupported_operation/);
  assert.match(readRequest({ operation: "SearchPatients", term: "A&B" }), /A&amp;B/);
  assert.equal(readRequest({ operation: "GetMissedVisitReasonsV2", id: "77" }), '<VisitInfo><VisitId>77</VisitId></VisitInfo>');
});

test("visit DTO preserves EVV, manual, actual, adjusted and pay facts independently", async () => {
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: '<VisitInfo><ID>77</ID><VisitStartTime>08:00</VisitStartTime><EVVStartTime>08:12</EVVStartTime><ActualHours>4.5</ActualHours><AdjustedHours>4</AdjustedHours><PayHours>4.5</PayHours><TimeZone>Source Office</TimeZone></VisitInfo>' }; } }, { operation: "GetVisitInfoV3", id: "77" });
  assert.equal(data.records[0]?.EVVStartTime, '08:12'); assert.equal(data.records[0]?.VisitStartTime, '08:00');
  assert.equal(data.records[0]?.ActualHours, '4.5'); assert.equal(data.records[0]?.AdjustedHours, '4'); assert.equal(data.records[0]?.PayHours, '4.5');
  assert.equal(data.records[0]?.EVVEndTime, null);
});

test("payroll batch selection is explicit and payroll facts never borrow billing or confidential employee fields", async () => {
  assert.equal(readRequest({ operation: "SearchPayrollBatchCaregivers", id: "77" }), "<BatchID>77</BatchID>");
  assert.throws(() => readRequest({ operation: "SearchPayrollBatchCaregivers" }), /invalid_identifier/);
  assert.throws(() => readRequest({ operation: "SearchPayrollBatches", date: "2026-02-30" }), /invalid_date/);
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: '<VisitPayrollInfo><ID>77</ID><Caregiver><ID>9</ID><CaregiverCode>FILE9</CaregiverCode><TimeAndAttendancePIN>secret-pin</TimeAndAttendancePIN><DateofBirth>secret-dob</DateofBirth></Caregiver><BilledAmount>300</BilledAmount><RegularHours><Minutes>240</Minutes><Amount>60</Amount></RegularHours><OTHours><Minutes>30</Minutes><Amount>12</Amount></OTHours><PayrollAdjustmentMinutes>15</PayrollAdjustmentMinutes></VisitPayrollInfo>' }; } }, { operation: "GetVisitPayrollInfoV2", id: "77" });
  assert.equal(data.records[0]?.["RegularHours/Minutes"], "240"); assert.equal(data.records[0]?.["OTHours/Minutes"], "30");
  assert.equal(data.records[0]?.PayrollAdjustmentMinutes, "15"); assert.equal(data.records[0]?.["Caregiver/CaregiverCode"], "FILE9");
  assert.doesNotMatch(JSON.stringify(data), /secret-|BilledAmount/);
});

test("care plan tasks and staffing preferences preserve repeated records while excluding free-text clinical instructions", async () => {
  const client = { async call(operation: string) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: '<POCInfo><ID>77</ID><Notes>secret-note</Notes><Tasks><Task><ID>1</ID><Name>Task A</Name><Required>Yes</Required><Instruction>secret-instruction</Instruction></Task><Task><ID>2</ID><Name>Task B</Name></Task></Tasks></POCInfo>' }; } };
  const data = await operationalRead(client, { operation: "GetPatientPOCInfo", id: "77" });
  const tasks = JSON.parse(data.records[0]?.Tasks ?? "[]"); assert.equal(tasks.length, 2); assert.equal(tasks[1].Name, "Task B");
  assert.equal(tasks[1].Required, null); assert.doesNotMatch(JSON.stringify(data), /secret-/);
  assert.equal(readRequest({ operation: "GetPatientDeclinedCaregivers", patientId: "88" }), '<PatientInfo><PatientID>88</PatientID></PatientInfo>');
  assert.equal(readRequest({ operation: "GetPatientReferralInfo", patientId: "88" }), '<PatientID>88</PatientID>');
});

test("source-backed rate proposals require unique current evidence, independent review and truthful rechecks without writes", async () => {
  const repository = new MemoryRepository(); let rate = "15.00", unavailable = false; const operations: string[] = [];
  const service = new OperationsWorkspace(repository, async input => {
    operations.push(input.operation); if (unavailable) throw new WorkflowError("hha_read_failed", 502);
    return { ...result(input), records: [{ CaregiverID: "9", CaregiverRateID: "7", HourlyRate: rate, DailyRate: "0", PatientID: null }] };
  }, true);
  await service.saveSettings({ ...preferences, enabledReads: ["GetCaregiverRates"] }, "owner");
  const draft = { id: "rate-review", caregiverId: "9", rateId: "7", hourlyRate: "16.25", rationale: "Synthetic proposal" };
  assert.equal((await workspaceRoute(service, "POST", "/workspace/rate-proposals", { ...draft, hourlyRate: "NaN" }, "requester"))?.status, 400);
  const prepared = await service.prepareRate(draft, "requester"); assert.equal(prepared.preparation?.before.HourlyRate, "15.00");
  await assert.rejects(service.prepareRate(draft, "requester"), /revision_conflict/);
  await assert.rejects(service.saveIntent({ id: draft.id, revision: 1, state: "approved" }, "reviewer"), /unchanged_source_recheck_required/);
  const checked = await service.recheckRate({ id: draft.id, revision: 1 }, "reviewer"); assert.equal(checked.preparation?.sourceCheck, "unchanged");
  await assert.rejects(service.saveIntent({ id: draft.id, revision: 2, state: "approved" }, "requester"), /independent_reviewer_required/);
  rate = "15.50";
  const changed = await service.recheckRate({ id: draft.id, revision: 2 }, "reviewer"); assert.equal(changed.preparation?.sourceCheck, "changed");
  assert.equal(changed.preparation?.before.HourlyRate, "15.00");
  await assert.rejects(service.saveIntent({ id: draft.id, revision: 3, state: "approved" }, "reviewer"), /unchanged_source_recheck_required/);
  unavailable = true; const failed = await service.recheckRate({ id: draft.id, revision: 3 }, "reviewer"); assert.equal(failed.preparation?.sourceCheck, "unavailable");
  unavailable = false; rate = "15.00"; await service.recheckRate({ id: draft.id, revision: 4 }, "reviewer");
  const approved = await service.saveIntent({ id: draft.id, revision: 5, state: "approved" }, "reviewer"); assert.equal(approved.state, "approved");
  assert.ok(operations.every(op => op === "GetCaregiverRates"));
});

test("reference catalogs preserve vendor spelling and parameter order and cannot be mistaken for live financial facts", async () => {
  assert.equal(readRequest({ operation: "GetCollectionRepresentatives", officeId: "123", status: "Active" }), '<Status>Active</Status><OfficeID>123</OfficeID>');
  assert.equal(readRequest({ operation: "GetLanguages" }), "");
  assert.throws(() => readRequest({ operation: "GetReferralStatus", status: "<injected/>" }), /invalid_reference_status/);
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: '<PatientDischargeToRasons><PatientDischargeToRason><PatientDischargeToID>7</PatientDischargeToID><PatientDischargeToName>Synthetic destination</PatientDischargeToName></PatientDischargeToRason></PatientDischargeToRasons>' }; } }, { operation: "GetPatientDischargeTo" });
  assert.equal(data.records[0]?.PatientDischargeToID, "7"); assert.equal(data.records[0]?.PatientDischargeToName, "Synthetic destination");
  const repository = new MemoryRepository(), service = new OperationsWorkspace(repository, async input => result(input), true);
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientTeams"] }, "owner");
  await assert.rejects(service.query({ operation: "GetPatientTeams", officeId: "456" }, "owner"), /office_scope_mismatch/);
});

test("bounded evidence review distinguishes manual clocks, partial reads and deferred visits", async () => {
  const repository = new MemoryRepository(); const calls: string[] = [];
  const service = new OperationsWorkspace(repository, async input => {
    calls.push(input.id!);
    if (input.id === "2") throw new WorkflowError("vendor_backoff_active", 429, 90);
    return { ...result(input), records: [{ ID: input.id!, VisitStartTime: "08:00", EVVStartTime: null, EVVEndTime: null, ActualHours: "4", PayHours: "4" }] };
  }, true);
  await service.saveSettings({ ...preferences, enabledReads: ["GetVisitInfoV3"] }, "owner");
  await assert.rejects(service.reviewVisits({ visitIds: Array(11).fill("1") }, "owner"), /select_one_to_ten_visits/);
  const data = await service.reviewVisits({ visitIds: ["1", "2", "3"] }, "owner");
  assert.equal(data.state, "partial"); assert.equal(data.policyEvaluated, false);
  assert.match(data.visits[0]?.flags.join(" ") ?? "", /Visit times do not establish EVV/);
  assert.equal(data.visits[0]?.facts?.PayHours, "4"); assert.equal(data.visits[1]?.facts, null);
  assert.equal(data.visits[2]?.error, "not_attempted_after_batch_gate"); assert.deepEqual(calls, ["1", "2"]); assert.equal(repository.deferred, 90);
});

test("slow visit reviews return completed evidence and explicitly defer remaining visits", async () => {
  const repository = new MemoryRepository(); let elapsed = 0; const calls: string[] = [];
  const service = new OperationsWorkspace(repository, async input => {
    calls.push(input.id!); elapsed += 20_000;
    return { ...result(input), records: [{ ID: input.id!, EVVStartTime: "08:00", EVVEndTime: "12:00" }] };
  }, true, undefined, () => elapsed);
  await service.saveSettings({ ...preferences, enabledReads: ["GetVisitInfoV3"] }, "owner");
  const data = await service.reviewVisits({ visitIds: ["1", "2", "3", "4"] }, "owner");
  assert.equal(data.state, "partial"); assert.deepEqual(calls, ["1", "2"]);
  assert.deepEqual(data.visits.map(row => row.error), [null, null, "not_attempted_batch_time_budget", "not_attempted_batch_time_budget"]);
});

test("visit discovery accepts validated patient and caregiver filters within one office-local day", () => {
  const xml = readRequest({ operation: "SearchVisitsV2", officeId: "123", date: "2026-09-30", patientId: "9", caregiverId: "7" });
  assert.match(xml, /<PatientID>9<\/PatientID><CaregiverID>7<\/CaregiverID>/);
  assert.match(xml, /2026-09-30T00:00:00/); assert.match(xml, /2026-09-30T23:59:59/);
  assert.throws(() => readRequest({ operation: "SearchVisitsV2", officeId: "123", date: "2026-09-30", caregiverId: "0" }), /invalid_identifier/);
});

test("guide-absent methods cannot be enabled or executed through stale owner settings", async () => {
  const repository = new MemoryRepository(); let calls = 0;
  const service = new OperationsWorkspace(repository, async input => { calls++; return result(input); }, true);
  await assert.rejects(service.saveSettings({ ...preferences, enabledReads: ["GetMissedVisitReasonsV2"] }, "owner"), /vendor_contract_clarification_required/);
  await assert.rejects(service.query({ operation: "GetVisitEditReasonActionTaken", id: "7" }, "owner"), /vendor_contract_clarification_required/);
  assert.equal(calls, 0); assert.equal((await service.settings()).contractOnlyReads.length, 3);
});

test("documented payroll filters retain zero rows by default and collection lookups remain scoped", () => {
  const body = readRequest({ operation: "GetPayrollBatchDetails", id: "7" });
  assert.match(body, /<BatchID>7<\/BatchID>/); assert.match(body, /<ExcludeZeroAmount>NO<\/ExcludeZeroAmount>/); assert.match(body, /<GroupByVisit>No<\/GroupByVisit>/);
  assert.throws(() => readRequest({ operation: "GetPayrollBatchDetails", id: "7", groupByVisit: "unexpected" }), /invalid_payroll_view_filter/);
  assert.throws(() => readRequest({ operation: "GetCollectionNotes", id: "7", patientId: "8" }), /invalid_identifier/);
  assert.match(readRequest({ operation: "GetCollectionNotes", id: "7", patientId: "8", contractId: "9" }), /<CollectionNoteDetailID xsi:nil="true"\/>/);
});

const completeRate = { CaregiverID: "9", CaregiverRateID: "7", HourlyRate: "15.00", DailyRate: "0", VisitRate: null, PatientID: null, FromDate: "2026-09-01", ToDate: "2026-12-31", Status: "Active" };
async function approvedRate(service: OperationsWorkspace) {
  await service.saveSettings({ ...preferences, enabledReads: ["GetCaregiverRates"] }, "owner");
  await service.prepareRate({ id: "submit-rate", caregiverId: "9", rateId: "7", hourlyRate: "16.25", rationale: "Synthetic approved proposal" }, "requester");
  await service.recheckRate({ id: "submit-rate", revision: 1 }, "reviewer");
  return service.saveIntent({ id: "submit-rate", revision: 2, state: "approved" }, "reviewer");
}

test("rate submission defaults closed and never fills missing source dates or amounts", async () => {
  const service = new OperationsWorkspace(new MemoryRepository(), async input => ({ ...result(input), records: [completeRate] }), true);
  await approvedRate(service);
  await assert.rejects(service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer"), /rate_write_release_not_approved/);
  assert.throws(() => rateWriteRequest({ ...completeRate, DailyRate: null }, "16.25"), /invalid_source_rate_decimal/);
  assert.throws(() => rateWriteRequest({ ...completeRate, FromDate: "09\/01\/2026" }, "16.25"), /source_rate_date_mapping_required/);
  const xml = rateWriteRequest(completeRate, "16.25"); assert.match(xml, /<DailyRate>0<\/DailyRate>/); assert.match(xml, /<VisitRate xsi:nil="true"\/>/);
});

test("ambiguous rate write is recorded before submission, never repeats, and reconciles without writing", async () => {
  const repository = new MemoryRepository(); let writes = 0;
  const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [completeRate] }), true, { approved: true, async submit() {
    writes++; assert.equal((await repository.get<any>("writeIntents", "submit-rate"))?.execution.result, "submitting");
    throw new Error("synthetic timeout after possible submission");
  } });
  await approvedRate(service);
  await assert.rejects(service.executeRate({ id: "submit-rate", revision: 3 }, "requester"), /independent_approving_reviewer_required/);
  const attempted = await service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.result, "unknown"); assert.equal(attempted.execution?.reconciliation, "source_unchanged");
  await assert.rejects(service.executeRate({ id: "submit-rate", revision: attempted.revision }, "reviewer"), /write_already_attempted_reconcile_only/);
  await service.reconcileRate({ id: "submit-rate", revision: attempted.revision }, "reviewer"); assert.equal(writes, 1);
});

test("acknowledged rate update requires source readback and source drift prevents submission", async () => {
  let current = { ...completeRate }, writes = 0;
  const service = new OperationsWorkspace(new MemoryRepository(), async input => ({ ...result(input), records: [current] }), true, { approved: true, async submit() { writes++; current = { ...completeRate, HourlyRate: "16.2500" }; return "acknowledged"; } });
  await approvedRate(service); current = { ...completeRate, DailyRate: "20" };
  await assert.rejects(service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer"), /source_changed_prepare_new_proposal/); assert.equal(writes, 0);
  current = { ...completeRate }; const attempted = await service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.result, "acknowledged"); assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(writes, 1);
});

test("typed rate writer uses one attempt and validates returned identifiers", async () => {
  const acknowledged = await submitRate({ async call(operation, body, attempts) { assert.equal(operation, "UpdateCaregiverRate"); assert.equal(attempts, 1); assert.match(body!, /<HourlyRate>16.25<\/HourlyRate>/); return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<CaregiverRateID>7</CaregiverRateID><CaregiverID>9</CaregiverID>' }; } }, completeRate, "16.25");
  assert.equal(acknowledged, "acknowledged");
  const mismatch = await submitRate({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<CaregiverRateID>8</CaregiverRateID><CaregiverID>9</CaregiverID>' }; } }, completeRate, "16.25"); assert.equal(mismatch, "unknown");
});

test("change previews retain vendor wall time, support documented V4 shape differences and never imply completion", async () => {
  const modifiedAfter = "2026-09-30T08:15:00";
  assert.equal(readRequest({ operation: "GetVisitChangesV4", modifiedAfter, page: "2" }), '<GetVisitChanges><ModifiedAfter>2026-09-30T08:15:00</ModifiedAfter><PageNumber>2</PageNumber></GetVisitChanges>');
  assert.throws(() => readRequest({ operation: "GetVisitChangesV4", modifiedAfter: modifiedAfter + "Z" }), /vendor_est_timestamp_required/);
  assert.throws(() => readRequest({ operation: "GetDeletedVisits", modifiedAfter: "2026-02-30T08:15:00" }), /invalid_date/);
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: '<GetVisitChangesInfo><VisitID>77</VisitID><EVVStartTime>2026-09-30 08:15</EVVStartTime><Caregiver><TimeAndAttendancePIN>secret</TimeAndAttendancePIN></Caregiver></GetVisitChangesInfo>' }; } }, { operation: "GetVisitChangesV4", modifiedAfter, page: "2" });
  assert.equal(data.records[0]?.VisitID, "77"); assert.equal(data.changePreview?.modifiedAfter, modifiedAfter);
  assert.equal(data.changePreview?.checkpointAdvanced, false); assert.equal(data.changePreview?.completeness, "not_inferred"); assert.doesNotMatch(JSON.stringify(data), /secret/);
});


test("compliance review validates source filters and retains due facts without exposing medical narratives", async () => {
  assert.throws(() => readRequest({ operation: "GetCaregiverComplianceItemDue", officeId: "123", id: "8", complianceType: "Medical" }), /explicit_compliance_sequence_required/);
  assert.throws(() => readRequest({ operation: "GetNumberOfComplianceItemDue", officeId: "123", id: "8", complianceType: "Medical", status: "Eligible" }), /invalid_compliance_status/);
  const client = { async call(operation: string) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: operation === "GetNumberOfComplianceItemDue" ? '<NumberOfComplianceItemDue>0</NumberOfComplianceItemDue>' : '<CaregiverMedicalDetails><CaregiverID>7</CaregiverID><Required>Yes</Required><Status>Pending</Status><DueDate>2026-10-01</DueDate><Notes>private-narrative</Notes><Result>private-result</Result></CaregiverMedicalDetails>' }; } };
  const data = await operationalRead(client, { operation: "GetCaregiverMedicalDetails", caregiverId: "7", status: "Pending" });
  assert.equal(data.records[0]?.DueDate, "2026-10-01"); assert.equal(data.records[0]?.Status, "Pending");
  assert.doesNotMatch(JSON.stringify(data), /private-/);
  const count = await operationalRead(client, { operation: "GetNumberOfComplianceItemDue", officeId: "123", id: "8", complianceType: "Medical" });
  assert.equal(count.records[0]?.NumberOfComplianceItemDue, "0");
  const repository = new MemoryRepository(), service = new OperationsWorkspace(repository, async input => result(input), true);
  await service.saveSettings({ ...preferences, enabledReads: ["GetNumberOfComplianceItemDue"] }, "owner");
  await assert.rejects(service.query({ operation: "GetNumberOfComplianceItemDue", officeId: "456", id: "8", complianceType: "Medical" }, "owner"), /office_scope_mismatch/);
});


test("document metadata stays subject scoped, keeps optional filters nil and excludes content", async () => {
  assert.throws(() => readRequest({ operation: "SearchPatientDocument" }), /invalid_identifier/);
  assert.throws(() => readRequest({ operation: "GetPatientDocumentType" }), /invalid_identifier/);
  const xml = readRequest({ operation: "SearchCaregiverDocument", caregiverId: "7" });
  assert.match(xml, /<CaregiverID>7<\/CaregiverID>/); assert.match(xml, /CaregiverDocumentID xsi:nil="true"/); assert.match(xml, /FromDate xsi:nil="true"/);
  assert.throws(() => readRequest({ operation: "SearchPatientDocument", patientId: "8", date: "2026-02-30" }), /invalid_date/);
  const client = { async call(operation: string) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: '<PatientDocuments><PatientDocument><PatientDocID>9</PatientDocID><PatientID>8</PatientID><FileName>synthetic.pdf</FileName><FileSize>1234</FileSize><Description>private-description</Description><StreamData>private-bytes</StreamData></PatientDocument></PatientDocuments>' }; } };
  const data = await operationalRead(client, { operation: "SearchPatientDocument", patientId: "8" });
  assert.equal(data.records[0]?.PatientDocID, "9"); assert.equal(data.records[0]?.FileSize, "1234"); assert.doesNotMatch(JSON.stringify(data), /private-/);
});


test("slow rate submission persists its outcome and leaves reconciliation for a separate read", async () => {
  let elapsed = 0, reads = 0, writes = 0, readDelay = 20_000;
  const service = new OperationsWorkspace(new MemoryRepository(), async input => {
    reads++; elapsed += readDelay; return { ...result(input), records: [completeRate] };
  }, true, { approved: true, async submit() { writes++; elapsed += 20_000; return "unknown"; } }, () => elapsed);
  await approvedRate(service); const before = reads;
  const attempted = await service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer");
  assert.equal(reads, before + 1); assert.equal(writes, 1);
  assert.equal(attempted.execution?.result, "unknown"); assert.equal(attempted.execution?.reconciliation, "not_checked");
  readDelay = 0;
  const checked = await service.reconcileRate({ id: "submit-rate", revision: attempted.revision }, "reviewer");
  assert.equal(checked.execution?.reconciliation, "source_unchanged"); assert.equal(writes, 1);
});


test("staffing evidence preserves patient-first sources and scoped candidate reads without eligibility or assignment claims", async () => {
  const repository = new MemoryRepository(), calls: ReadInput[] = [];
  const service = new OperationsWorkspace(repository, async input => { calls.push(input); return { ...result(input), records: [] }; }, true);
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientPreferences", "GetPatientDeclinedCaregivers", "GetCaregiverPreferences", "GetCaregiverPermanentWeekAvailability", "GetCaregiverSpecialAvailability", "SearchVisitsV2"] }, "owner");
  const input = { patientId: "8", officeId: "123", date: "2026-09-30", caregiverIds: ["7", "9"] };
  await assert.rejects(service.reviewStaffing({ ...input, officeId: "456" }, "owner"), /office_scope_mismatch/); assert.equal(calls.length, 0);
  const response = await workspaceRoute(service, "POST", "/workspace/staffing-review", input, "owner");
  assert.equal(response?.status, 200);
  const data = response?.body as any;
  assert.equal(data.evidence.length, 10); assert.equal(data.eligibility, "not_determined"); assert.equal(data.assignmentChanged, false); assert.equal(data.rankingApplied, false);
  assert.deepEqual(calls.slice(0, 2).map(row => row.operation), ["GetPatientPreferences", "GetPatientDeclinedCaregivers"]);
  assert.deepEqual(calls.filter(row => row.operation === "SearchVisitsV2").map(row => [row.officeId, row.date, row.caregiverId]), [["123", "2026-09-30", "7"], ["123", "2026-09-30", "9"]]);
});

test("staffing review stops on vendor backoff and reports every unattempted evidence source", async () => {
  const repository = new MemoryRepository(); let calls = 0;
  const service = new OperationsWorkspace(repository, async () => { calls++; throw new WorkflowError("vendor_backoff_active", 429, 90); }, true);
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientPreferences"] }, "owner");
  const data = await service.reviewStaffing({ patientId: "8", officeId: "123", date: "2026-09-30", caregiverIds: ["7"] }, "owner");
  assert.equal(calls, 1); assert.equal(data.state, "partial"); assert.equal(data.evidence.length, 6);
  assert.equal(data.evidence[0]?.error, "vendor_backoff_active"); assert.ok(data.evidence.slice(1).every(row => row.error === "not_attempted_vendor_backoff"));
});


test("UTC feeds require explicit UTC while EST feeds reject UTC conversion and long cursors retain precision", () => {
  assert.throws(() => readRequest({ operation: "GetPatientNotes", patientId: "8", modifiedAfterUtc: "2026-09-30T00:00:00", lastId: "0" }), /explicit_utc_timestamp_required/);
  assert.throws(() => readRequest({ operation: "GetCaregiverPictureChanges", modifiedAfter: "2026-09-30T00:00:00Z" }), /vendor_est_timestamp_required/);
  const xml = readRequest({ operation: "GetPatientNotes", patientId: "8", modifiedAfterUtc: "2026-09-30T00:00:00Z", lastId: "9223372036854775807" });
  assert.match(xml, /9223372036854775807/);
  assert.throws(() => readRequest({ operation: "GetPatientNotes", patientId: "8", modifiedAfterUtc: "2026-09-30T00:00:00Z", lastId: "9223372036854775808" }), /explicit_source_cursor_required/);
  assert.throws(() => readRequest({ operation: "GetCaregiverPreferenceChanges", officeId: "123", modifiedAfterUtc: "2026-09-30T00:00:00Z", lastId: "2147483648" }), /explicit_source_cursor_required/);
});

test("attachments validate identity, bytes and size and never expose base64 in source-record fields", async () => {
  const record = { PatientDocID: "8", FileName: "../synthetic.pdf", FileSize: "4", StreamData: "dGVzdA==" };
  assert.equal(boundedAttachment(record, "PatientDocID", "8").byteLength, 4);
  assert.doesNotMatch(boundedAttachment(record, "PatientDocID", "8").filename, /[\\/]/);
  assert.throws(() => boundedAttachment(record, "PatientDocID", "9"), /download_identity_mismatch/);
  assert.throws(() => boundedAttachment({ ...record, FileSize: "5" }, "PatientDocID", "8"), /download_size_mismatch/);
  assert.throws(() => boundedAttachment({ ...record, StreamData: "garbage!" }, "PatientDocID", "8"), /invalid_or_oversize_download/);
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<PatientDocument><PatientDocID>8</PatientDocID><FileName>synthetic.pdf</FileName><FileSize>4</FileSize><StreamData>dGVzdA==</StreamData></PatientDocument>' }; } }, { operation: "DownloadPatientDocument", id: "8" });
  assert.equal(data.attachment?.contentType, "application/octet-stream"); assert.equal(data.records[0]?.StreamData, undefined);
});

test("phone discovery separates patient and caregiver identities without extra demographic fields", async () => {
  assert.throws(() => readRequest({ operation: "SearchPhoneNumber", officeId: "123", phone: "555-555-0123" }), /ten_digit_phone_required/);
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<Patients><Patient><PatientID>8</PatientID><FirstName>Synthetic</FirstName><Zip5>private-zip</Zip5></Patient></Patients><Caregivers><Caregiver><CaregiverID>9</CaregiverID><FirstName>Synthetic</FirstName></Caregiver></Caregivers>' }; } }, { operation: "SearchPhoneNumber", officeId: "123", phone: "5555550123" });
  assert.deepEqual(data.records.map(row => [row.Subject, row.ID]), [["Patient", "8"], ["Caregiver", "9"]]); assert.doesNotMatch(JSON.stringify(data), /private-/);
});


function availabilityFacts(): Record<string, string | null> {
  const facts: Record<string, string | null> = { CaregiverID: "9", OfficeID: "123", PermanentWeekID: "7", SpecialAvailabilityID: "8", FromDate: "2026-09-01", ToDate: "2026-09-30" };
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) Object.assign(facts, { [day + "AvailabilityType"]: "Preferred", [day + "LiveIn"]: "No", [day + "From"]: "0800", [day + "To"]: "1700" });
  return facts;
}
test("availability proposals reject missing source semantics and preserve every unchanged day", async () => {
  const before = availabilityFacts();
  assert.throws(() => availabilityRequest(AVAILABILITY_WRITES[0], { ...before, SundayFrom: null }), /complete_availability_source_mapping_required/);
  assert.throws(() => availabilityRequest(AVAILABILITY_WRITES[0], { ...before, MondayFrom: "2200", MondayTo: "0600" }), /overnight_availability_semantics_required/);
  const service = new OperationsWorkspace(new MemoryRepository(), async input => ({ ...result(input), records: [before] }), true);
  await service.saveSettings({ ...preferences, enabledReads: ["GetCaregiverPermanentWeekAvailability"] }, "owner");
  const proposed = await service.availability("prepare", { id: "availability", operation: AVAILABILITY_WRITES[0], caregiverId: "9", recordId: "7", day: "Monday", availabilityType: "MightWork", liveIn: "No", from: "0900", to: "1600", rationale: "Synthetic caregiver request" }, "requester");
  assert.equal(proposed.proposed.MondayFrom, "0900"); assert.equal(proposed.before.MondayFrom, "0800"); assert.equal(proposed.proposed.TuesdayFrom, "0800");
  await assert.rejects(service.availability("review", { id: proposed.id, revision: 1, decision: "approved" }, "requester"), /independent_reviewer_required/);
  await service.availability("recheck", { id: proposed.id, revision: 1 }, "reviewer");
  await service.availability("review", { id: proposed.id, revision: 2, decision: "approved" }, "reviewer");
  await assert.rejects(service.availability("execute", { id: proposed.id, revision: 3 }, "reviewer"), /availability_write_release_not_approved/);
});
test("availability write is submit-once, persists ambiguous outcome and reconciles without repeating", async () => {
  let current = availabilityFacts(), writes = 0; const repository = new MemoryRepository();
  const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [current] }), true, undefined, undefined, { enabled: [AVAILABILITY_WRITES[1]], async submit(op, proposed) { writes++; current = { ...proposed }; assert.equal(op, AVAILABILITY_WRITES[1]); throw new Error("synthetic ambiguous transport"); } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetCaregiverSpecialAvailability"] }, "owner");
  await service.availability("prepare", { id: "special", operation: AVAILABILITY_WRITES[1], caregiverId: "9", recordId: "8", day: "Monday", availabilityType: "MightWork", liveIn: "No", from: "0900", to: "1600", rationale: "Synthetic request" }, "requester");
  await service.availability("recheck", { id: "special", revision: 1 }, "reviewer");
  await service.availability("review", { id: "special", revision: 2, decision: "approved" }, "reviewer");
  current = { ...current, TuesdayFrom: "0700" };
  await assert.rejects(service.availability("execute", { id: "special", revision: 3 }, "reviewer"), /source_changed_prepare_new_proposal/); assert.equal(writes, 0);
  current = availabilityFacts(); const attempted = await service.availability("execute", { id: "special", revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.result, "unknown"); assert.equal(attempted.execution?.reconciliation, "matches_proposal");
  await assert.rejects(service.availability("execute", { id: "special", revision: attempted.revision }, "reviewer"), /write_already_attempted_reconcile_only/);
  await service.availability("reconcile", { id: "special", revision: attempted.revision }, "reviewer"); assert.equal(writes, 1);
  const ack = await submitAvailability({ async call(op, body, attempts) { assert.equal(attempts, 1); assert.match(body!, /<WednesdayFrom>0800<\/WednesdayFrom>/); return { operation: op, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<SpecialAvailabilityID>8</SpecialAvailabilityID><CaregiverID>9</CaregiverID>' }; } }, AVAILABILITY_WRITES[1], current);
  assert.equal(ack, "acknowledged");
});


test("distinct rate proposals cannot write the same source target while an outcome is unresolved", async () => {
  const repository = new MemoryRepository(); let current = { ...completeRate }, writes = 0;
  const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [current] }), true, { approved: true, async submit() { writes++; return "unknown"; } });
  await approvedRate(service);
  const approved = await repository.get<any>("writeIntents", "submit-rate"); repository.records.set("writeIntents/competing-rate", { ...approved, id: "competing-rate" });
  const attempted = await service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "source_unchanged"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.executeRate({ id: "competing-rate", revision: 3 }, "reviewer"), /source_target_locked_reconciliation_required/); assert.equal(writes, 1);
  current = { ...completeRate, HourlyRate: "16.25" };
  await service.reconcileRate({ id: "submit-rate", revision: attempted.revision }, "reviewer"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.executeRate({ id: "competing-rate", revision: 3 }, "reviewer"), /source_target_locked_reconciliation_required/); assert.equal(writes, 1); assert.equal(repository.targets.size, 1);
});

for (const operation of AVAILABILITY_WRITES) {
  test(`${operation} serializes target writes across service restart and preserves uncertain locks`, async () => {
    const repository = new MemoryRepository(); let current = availabilityFacts(), writes = 0;
    const read = async (input: ReadInput) => ({ ...result(input), records: [current] });
    let finish!: (value: "unknown") => void, started!: () => void;
    const inFlight = new Promise<void>(resolve => { started = resolve; });
    const writer = { enabled: [operation], async submit() { writes++; started(); return new Promise<"unknown">(resolve => { finish = resolve; }); } };
    const service = new OperationsWorkspace(repository, read, true, undefined, undefined, writer);
    const permanent = operation === AVAILABILITY_WRITES[0];
    await service.saveSettings({ ...preferences, enabledReads: [permanent ? "GetCaregiverPermanentWeekAvailability" : "GetCaregiverSpecialAvailability"] }, "owner");
    await service.availability("prepare", { id: "first", operation, caregiverId: "9", recordId: permanent ? "7" : "8", day: "Monday", availabilityType: "MightWork", liveIn: "No", from: "0900", to: "1600", rationale: "Synthetic request" }, "requester");
    await service.availability("recheck", { id: "first", revision: 1 }, "reviewer");
    const approved = await service.availability("review", { id: "first", revision: 2, decision: "approved" }, "reviewer");
    repository.records.set("availabilityChanges/second", { ...approved, id: "second" });
    const pending = service.availability("execute", { id: "first", revision: 3 }, "reviewer");
    await inFlight;
    const restarted = new OperationsWorkspace(repository, read, true, undefined, undefined, writer);
    await assert.rejects(restarted.availability("execute", { id: "second", revision: 3 }, "reviewer"), /source_target_locked_reconciliation_required/);
    await assert.rejects(restarted.availability("reconcile", { id: "first", revision: 4 }, "reviewer"), /write_attempt_in_progress/);
    finish("unknown"); const attempted = await pending;
    current = { ...approved.proposed };
    await restarted.availability("reconcile", { id: "first", revision: attempted.revision }, "reviewer");
    await assert.rejects(restarted.availability("execute", { id: "second", revision: 3 }, "reviewer"), /source_target_locked_reconciliation_required/);
    assert.equal(writes, 1); assert.equal(repository.targets.size, 1);
  });
}

test("rate target reservation precedes fresh source validation and abandoned reservations survive restart", async () => {
  const repository = new MemoryRepository(); let current = { ...completeRate }, writes = 0;
  const read = async (input: ReadInput) => ({ ...result(input), records: [current] });
  const writer = { approved: true, async submit(): Promise<"acknowledged"> { writes++; return "acknowledged"; } };
  const service = new OperationsWorkspace(repository, read, true, writer);
  await approvedRate(service);
  const reserve = repository.reserveWriteTarget.bind(repository);
  repository.reserveWriteTarget = async (target, id) => { await reserve(target, id); current = { ...completeRate, HourlyRate: "17" }; };
  await assert.rejects(service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer"), /source_changed_prepare_new_proposal/);
  assert.equal(writes, 0); assert.equal(repository.targets.size, 0);
  await reserve("rate_9_7", "crashed-process");
  const restarted = new OperationsWorkspace(repository, read, true, writer);
  await assert.rejects(restarted.executeRate({ id: "submit-rate", revision: 3 }, "reviewer"), /source_target_locked_reconciliation_required/);
  assert.equal(writes, 0);
});

test("concurrent approved rates cannot bypass target lock or reconcile a live submission", async () => {
  const repository = new MemoryRepository(); let writes = 0;
  let finish!: (value: "unknown") => void, started!: () => void;
  const inFlight = new Promise<void>(resolve => { started = resolve; });
  const read = async (input: ReadInput) => ({ ...result(input), records: [completeRate] });
  const writer = { approved: true, async submit() { writes++; started(); return new Promise<"unknown">(resolve => { finish = resolve; }); } };
  const service = new OperationsWorkspace(repository, read, true, writer);
  await approvedRate(service);
  const approved = await repository.get<any>("writeIntents", "submit-rate");
  repository.records.set("writeIntents/second", { ...approved, id: "second" });
  const pending = service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer");
  await inFlight;
  const restarted = new OperationsWorkspace(repository, read, true, writer);
  await assert.rejects(restarted.executeRate({ id: "second", revision: 3 }, "reviewer"), /source_target_locked_reconciliation_required/);
  await assert.rejects(restarted.reconcileRate({ id: "submit-rate", revision: 4 }, "reviewer"), /write_attempt_in_progress/);
  finish("unknown"); await pending;
  assert.equal(writes, 1); assert.equal(repository.targets.size, 1);
});

for (const operation of AVAILABILITY_WRITES) {
  test(`${operation} validates fresh source only after acquiring its target lock`, async () => {
    const repository = new MemoryRepository(); let current = availabilityFacts(), writes = 0;
    const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [current] }), true, undefined, undefined, { enabled: [operation], async submit() { writes++; return "acknowledged"; } });
    const permanent = operation === AVAILABILITY_WRITES[0];
    await service.saveSettings({ ...preferences, enabledReads: [permanent ? "GetCaregiverPermanentWeekAvailability" : "GetCaregiverSpecialAvailability"] }, "owner");
    await service.availability("prepare", { id: "fresh", operation, caregiverId: "9", recordId: permanent ? "7" : "8", day: "Monday", availabilityType: "MightWork", liveIn: "No", from: "0900", to: "1600", rationale: "Synthetic request" }, "requester");
    await service.availability("recheck", { id: "fresh", revision: 1 }, "reviewer");
    await service.availability("review", { id: "fresh", revision: 2, decision: "approved" }, "reviewer");
    const reserve = repository.reserveWriteTarget.bind(repository);
    repository.reserveWriteTarget = async (target, id) => { await reserve(target, id); current = { ...current, TuesdayFrom: "0700" }; };
    await assert.rejects(service.availability("execute", { id: "fresh", revision: 3 }, "reviewer"), /source_changed_prepare_new_proposal/);
    assert.equal(writes, 0); assert.equal(repository.targets.size, 0);
  });
}

test("uncertain write recovery requires independent evidence review, persists terminal state and never resubmits", async () => {
  const repository = new MemoryRepository(); let writes = 0;
  const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [completeRate] }), true, { approved: true, async submit() { writes++; return "unknown"; } });
  await approvedRate(service);
  const attempted = await service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer");
  await assert.rejects(service.recoverWrite("prepare", { family: "rate", id: attempted.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "vendor-case-123", runtimeTerminationReference: "runtime-ended-456" }, "requester"), /recovery_outcome_source_mismatch/);
  const prepared = await service.recoverWrite("prepare", { family: "rate", id: attempted.id, revision: attempted.revision, outcome: "not_applied", vendorCaseReference: "vendor-case-123", runtimeTerminationReference: "runtime-ended-456" }, "requester");
  assert.equal(repository.targets.size, 1);
  await assert.rejects(service.recoverWrite("approve", { family: "rate", id: prepared.id, revision: prepared.revision }, "requester"), /independent_recovery_reviewer_required/);
  const release = repository.releaseWriteTarget.bind(repository); let interrupted = true;
  repository.releaseWriteTarget = async (target, id) => { if (interrupted) { interrupted = false; throw new Error("synthetic crash after recovery commit"); } await release(target, id); };
  await assert.rejects(service.recoverWrite("approve", { family: "rate", id: prepared.id, revision: prepared.revision }, "reviewer"), /synthetic crash/);
  const resolved = await repository.get<any>("writeIntents", prepared.id);
  assert.equal(resolved.recovery.state, "resolved"); assert.equal(repository.targets.size, 1);
  await service.recoverWrite("approve", { family: "rate", id: resolved.id, revision: resolved.revision }, "reviewer");
  assert.equal(repository.targets.size, 0);
  await assert.rejects(service.executeRate({ id: resolved.id, revision: resolved.revision }, "reviewer"), /proposal_in_recovery_or_resolved/);
  assert.equal(writes, 1); assert.ok(repository.audit.includes("reviewer:write_recovery_independently_resolved"));
});

test("crashed pre-submit reservations require worker age and evidence before recovery", async () => {
  const repository = new MemoryRepository();
  const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [completeRate] }), true);
  await approvedRate(service); await repository.reserveWriteTarget("rate_9_7", "submit-rate");
  const input = { family: "rate", id: "submit-rate", revision: 3, outcome: "not_applied", vendorCaseReference: "vendor-case-123", runtimeTerminationReference: "runtime-ended-456" };
  const old = repository.getWriteTarget.bind(repository);
  repository.getWriteTarget = async target => { const lock = await old(target); return lock ? { ...lock, updatedAt: new Date().toISOString() } : null; };
  await assert.rejects(service.recoverWrite("prepare", input, "requester"), /write_recovery_wait_for_worker_termination/);
  repository.getWriteTarget = old;
  const prepared = await service.recoverWrite("prepare", input, "requester");
  await service.recoverWrite("approve", { family: "rate", id: prepared.id, revision: prepared.revision }, "reviewer");
  assert.equal(repository.targets.size, 0);
});

for (const operation of AVAILABILITY_WRITES) {
  test(`${operation} recovery verifies current outcome and retains lock when source drifts`, async () => {
    const repository = new MemoryRepository(); let current = availabilityFacts(), writes = 0;
    const permanent = operation === AVAILABILITY_WRITES[0];
    const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [current] }), true, undefined, undefined, { enabled: [operation], async submit(_operation, proposed) { writes++; current = { ...proposed }; return "unknown"; } });
    await service.saveSettings({ ...preferences, enabledReads: [permanent ? "GetCaregiverPermanentWeekAvailability" : "GetCaregiverSpecialAvailability"] }, "owner");
    await service.availability("prepare", { id: "recover", operation, caregiverId: "9", recordId: permanent ? "7" : "8", day: "Monday", availabilityType: "MightWork", liveIn: "No", from: "0900", to: "1600", rationale: "Synthetic request" }, "requester");
    await service.availability("recheck", { id: "recover", revision: 1 }, "reviewer");
    await service.availability("review", { id: "recover", revision: 2, decision: "approved" }, "reviewer");
    const attempt = await service.availability("execute", { id: "recover", revision: 3 }, "reviewer");
    const prepared = await service.recoverWrite("prepare", { family: "availability", id: "recover", revision: attempt.revision, outcome: "applied", vendorCaseReference: "vendor-completed-case", runtimeTerminationReference: "runtime-ended-case" }, "requester");
    const expected = { ...current }; current.TuesdayFrom = "0600";
    await assert.rejects(service.recoverWrite("approve", { family: "availability", id: "recover", revision: prepared.revision }, "reviewer"), /recovery_outcome_source_mismatch/);
    assert.equal(repository.targets.size, 1); current = expected;
    const resolved = await service.recoverWrite("approve", { family: "availability", id: "recover", revision: prepared.revision }, "reviewer");
    assert.equal(repository.targets.size, 0);
    await assert.rejects(service.availability("execute", { id: "recover", revision: resolved.revision }, "reviewer"), /proposal_in_recovery_or_resolved/);
    assert.equal(writes, 1);
  });
}

test("document type update preserves description, reviews independently, submits once and recovers unknown outcomes", async () => {
  const repository = new MemoryRepository(); let current = { PatientDocumentTypeID: "7", PatientDocumentType: "Original", Description: "Preserve & retain", Status: "Active" }, writes = 0;
  const read = async (input: ReadInput) => ({ ...result(input), records: [current] });
  const closed = new OperationsWorkspace(repository, read, true);
  await closed.saveSettings({ ...preferences, enabledReads: ["GetPatientDocumentType"] }, "owner");
  const proposal = await closed.documentType("prepare", { id: "doc-type", userRole: "Patient", documentId: "8", recordId: "7", name: "Updated", status: "Inactive", rationale: "Synthetic metadata change" }, "requester");
  assert.equal(proposal.proposed.Description, "Preserve & retain");
  await closed.documentType("recheck", { id: proposal.id, revision: 1 }, "reviewer");
  await assert.rejects(closed.documentType("review", { id: proposal.id, revision: 2, decision: "approved" }, "requester"), /independent_reviewer_required/);
  await closed.documentType("review", { id: proposal.id, revision: 2, decision: "approved" }, "reviewer");
  await assert.rejects(closed.documentType("execute", { id: proposal.id, revision: 3 }, "reviewer"), /document_type_write_release_not_approved/);
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, { approved: true, async submit(facts) { writes++; current = { ...current, PatientDocumentType: facts.DocumentType!, Status: facts.Status! }; return "unknown"; } });
  const attempted = await service.documentType("execute", { id: proposal.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.documentType("execute", { id: proposal.id, revision: attempted.revision }, "reviewer"), /write_already_attempted/);
  const recovery = await service.recoverWrite("prepare", { family: "document_type", id: proposal.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "vendor-completed-case", runtimeTerminationReference: "runtime-ended-case" }, "requester");
  await service.recoverWrite("approve", { family: "document_type", id: proposal.id, revision: recovery.revision }, "reviewer");
  assert.equal(repository.targets.size, 0); assert.equal(writes, 1);
  assert.match(documentTypeRequest(proposal.proposed), /Preserve &amp; retain/);
  assert.throws(() => documentTypeRequest({ ...proposal.proposed, Description: null }), /complete_document_type_source_required/);
  const ack = await submitDocumentType({ async call(operation, body, attempts) { assert.equal(operation, "UpdateDocumentType"); assert.equal(attempts, 1); assert.match(body!, /<Status>Inactive/); return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: "<DocumentTypeID>7</DocumentTypeID>" }; } }, proposal.proposed);
  assert.equal(ack, "acknowledged");
});

test("topic creation rejects duplicates, requires independent review, verifies returned identity and recovers ambiguity", async () => {
  const repository = new MemoryRepository(); let rows: Record<string, string | null>[] = [], writes = 0;
  const read = async (input: ReadInput) => ({ ...result(input), records: rows });
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, { approved: true, async submit(facts) { writes++; rows = [{ TopicID: "88", TopicDescription: facts.Topic!, Status: facts.Status!, CountTowardsCompliance: facts.CountTowardsCompliance! }]; return { result: "unknown" }; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetInServiceTopics"] }, "owner");
  const proposed = await service.topic("prepare", { id: "new-topic", topic: "Synthetic topic", status: "Active", countTowardsCompliance: "No", rationale: "Synthetic metadata" }, "requester");
  await service.topic("recheck", { id: proposed.id, revision: 1 }, "reviewer");
  await service.topic("review", { id: proposed.id, revision: 2, decision: "approved" }, "reviewer");
  const closed = new OperationsWorkspace(repository, read, true);
  await assert.rejects(closed.topic("execute", { id: proposed.id, revision: 3 }, "reviewer"), /topic_write_release_not_approved/);
  const attempted = await service.topic("execute", { id: proposed.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.topic("prepare", { id: "duplicate-topic", topic: "synthetic topic", status: "Active", countTowardsCompliance: "No", rationale: "Duplicate" }, "requester"), /topic_already_exists/);
  const recovery = await service.recoverWrite("prepare", { family: "topic", id: proposed.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "vendor-confirmed-case", runtimeTerminationReference: "runtime-ended-case" }, "requester");
  await service.recoverWrite("approve", { family: "topic", id: proposed.id, revision: recovery.revision }, "reviewer");
  assert.equal(repository.targets.size, 0); assert.equal(writes, 1);
  const ack = await submitTopic({ async call(operation, body, attempts) { assert.equal(attempts, 1); assert.match(body!, /<CountTowardsCompliance>No/); return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<CreateInserviceTopicsInfo><InserviceTopicID>99</InserviceTopicID><OfficeInserviceTopic><InserviceTopicID>88</InserviceTopicID><OfficeID>123</OfficeID></OfficeInserviceTopic></CreateInserviceTopicsInfo>' }; } }, proposed.proposed);
  assert.deepEqual(ack, { result: "acknowledged", recordId: "88" });
  assert.throws(() => topicRequest({ ...proposed.proposed, CountTowardsCompliance: "" }), /invalid_topic_fields/);
});

test("acknowledged topic creation does not release a lock when readback has a different office topic identity", async () => {
  const repository = new MemoryRepository(); let rows: Record<string, string | null>[] = [];
  const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: rows }), true, undefined, undefined, undefined, undefined, { approved: true, async submit(facts) { rows = [{ TopicID: "89", TopicDescription: facts.Topic!, Status: facts.Status!, CountTowardsCompliance: facts.CountTowardsCompliance! }]; return { result: "acknowledged", recordId: "88" }; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetInServiceTopics"] }, "owner");
  await service.topic("prepare", { id: "identity-topic", topic: "Synthetic", status: "Active", countTowardsCompliance: "No", rationale: "Synthetic" }, "requester");
  await service.topic("recheck", { id: "identity-topic", revision: 1 }, "reviewer");
  await service.topic("review", { id: "identity-topic", revision: 2, decision: "approved" }, "reviewer");
  const attempted = await service.topic("execute", { id: "identity-topic", revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "different"); assert.equal(repository.targets.size, 1);
});

test("rate creation verifies caregiver office and discipline, rejects overlap, and reconciles returned identity", async () => {
  const repository = new MemoryRepository(); let rates: Record<string, string | null>[] = [], writes = 0, office = "123";
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetCaregiverDemographics" ? [{ ID: "9", OfficeIDs: JSON.stringify([office]), EmploymentDisciplines: JSON.stringify(["HHA"]) }] : input.operation === "GetPayRateCodes" ? [{ PayRateCodeID: "4", DisciplineID: "3", Discipline: "HHA", Active: "Y" }] : rates });
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, undefined, { approved: true, async submit(facts) { writes++; rates = [{ CaregiverRateID: "88", CaregiverID: facts.CaregiverID!, Discipline: "HHA", PayCodeID: facts.PayCodeID!, PatientID: facts.PatientID!, FromDate: facts.FromDate!, ToDate: facts.ToDate!, HourlyRate: "16.2500", DailyRate: "0.0000", VisitRate: null, Status: "Active" }]; return { result: "acknowledged", recordId: "88" }; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetCaregiverDemographics", "GetPayRateCodes", "GetCaregiverRates"] }, "owner");
  const input = { id: "create-rate", caregiverId: "9", disciplineId: "3", payCodeId: "4", patientId: null, fromDate: "2026-10-01", toDate: "2026-12-31", hourlyRate: "16.25", dailyRate: "0", visitRate: null, status: "Active", rationale: "Synthetic payroll authorization" };
  office = "456"; await assert.rejects(service.createRate("prepare", input, "requester"), /caregiver_office_paycode_discipline_mismatch/); office = "123";
  const proposed = await service.createRate("prepare", input, "requester");
  await service.createRate("recheck", { id: proposed.id, revision: 1 }, "reviewer");
  await service.createRate("review", { id: proposed.id, revision: 2, decision: "approved" }, "reviewer");
  const closed = new OperationsWorkspace(repository, read, true);
  await assert.rejects(closed.createRate("execute", { id: proposed.id, revision: 3 }, "reviewer"), /rate_creation_write_release_not_approved/);
  const attempted = await service.createRate("execute", { id: proposed.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 0); assert.equal(writes, 1);
  await assert.rejects(service.createRate("prepare", { ...input, id: "overlap" }, "requester"), /overlapping_rate_requires_separate_policy_review/);
  await assert.rejects(service.createRate("execute", { id: proposed.id, revision: attempted.revision }, "reviewer"), /write_already_attempted/);
  assert.match(createRateRequest(proposed.proposed), /<Discipline>3<\/Discipline><PayCodeID>4/);
  const ack = await submitRateCreation({ async call(operation, body, attempts) { assert.equal(attempts, 1); assert.match(body!, /<PatientID xsi:nil="true"/); return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<CaregiverRateID>88</CaregiverRateID><CaregiverID>9</CaregiverID>' }; } }, proposed.proposed);
  assert.deepEqual(ack, { result: "acknowledged", recordId: "88" });
});

test("caregiver discipline and office projections exclude demographic secrets", async () => {
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<CaregiverInfo><ID>9</ID><SSN>PRIVATE</SSN><EmploymentTypes><Discipline>HHA</Discipline><Discipline>PCA</Discipline></EmploymentTypes><CaregiverOffices><Office><OfficeID>123</OfficeID><OfficeName>PRIVATE</OfficeName><IsPrimary>true</IsPrimary></Office></CaregiverOffices></CaregiverInfo>' }; } }, { operation: "GetCaregiverDemographics", id: "9" });
  assert.deepEqual(JSON.parse(data.records[0]!.OfficeIDs!), ["123"]); assert.deepEqual(JSON.parse(data.records[0]!.EmploymentDisciplines!), ["HHA", "PCA"]); assert.doesNotMatch(JSON.stringify(data), /PRIVATE/);
});

test("contract identity workflow preserves primary and service fields, submits once and recovers unknown outcome", async () => {
  const repository = new MemoryRepository(); let writes = 0, office = "123";
  let contract = { PlacementID: "7", AltPatientID: "OLD", IsPrimaryContract: "Y", "Contract/ID": "4", ServiceStartDate: "2026-01-01", "ServiceCode/ID": "5", DischargeDate: null };
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetPatientDemographics" ? [{ PatientID: "8", OfficeID: office }] : [contract] });
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, undefined, undefined, { approved: true, async submit(facts) { writes++; contract = { ...contract, AltPatientID: facts.AltPatientID! }; return "unknown"; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientDemographics", "GetPatientContracts"] }, "owner");
  const input = { id: "contract-id", patientId: "8", date: "2026-09-30", recordId: "7", altPatientId: "NEW<&", rationale: "Synthetic verified payer identity" };
  office = "456"; await assert.rejects(service.patientContract("prepare", input, "requester"), /contract_patient_office_mismatch/); office = "123";
  await assert.rejects(service.patientContract("prepare", { ...input, isPrimaryContract: false }, "requester"), /invalid_patient_contract_proposal/);
  const prepared = await service.patientContract("prepare", input, "requester");
  const xml = patientContractRequest(prepared.proposed);
  assert.match(xml, /<AltPateintID>NEW&lt;&amp;<\/AltPateintID>/); assert.match(xml, /<IsPrimaryContract>true/);
  for (const field of ["StartDate", "ServiceCode", "DischargeDate"]) assert.match(xml, new RegExp(`<Update${field}>false`));
  await service.patientContract("recheck", { id: input.id, revision: 1 }, "reviewer");
  await assert.rejects(service.patientContract("review", { id: input.id, revision: 2, decision: "approved" }, "requester"), /independent_reviewer_required/);
  await service.patientContract("review", { id: input.id, revision: 2, decision: "approved" }, "reviewer");
  const closed = new OperationsWorkspace(repository, read, true);
  await assert.rejects(closed.patientContract("execute", { id: input.id, revision: 3 }, "reviewer"), /patient_contract_write_release_not_approved/);
  const attempted = await service.patientContract("execute", { id: input.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.patientContract("execute", { id: input.id, revision: attempted.revision }, "reviewer"), /write_already_attempted/);
  const recovery = await service.recoverWrite("prepare", { family: "patient_contract", id: input.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "vendor-completed-case", runtimeTerminationReference: "runtime-ended-case" }, "requester");
  await service.recoverWrite("approve", { family: "patient_contract", id: input.id, revision: recovery.revision }, "reviewer");
  assert.equal(repository.targets.size, 0); assert.equal(writes, 1); assert.equal(contract.IsPrimaryContract, "Y"); assert.equal(contract.ServiceStartDate, "2026-01-01");
  const ack = await submitPatientContract({ async call(operation, body, attempts) { assert.equal(attempts, 1); assert.equal(operation, "UpdatePatientContract"); return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<PatientContractInfo><PatientID>8</PatientID><PlacementID>7</PlacementID></PatientContractInfo>' }; } }, prepared.proposed);
  assert.equal(ack, "acknowledged");
  const route = await workspaceRoute(service, "GET", "/workspace/patient-contracts", {}, "owner"); assert.equal(route?.status, 200);
});

test("contract changes serialize targets and reread preserved fields after acquiring the lock", async () => {
  const repository = new MemoryRepository(); let writes = 0, primary = "N";
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetPatientDemographics" ? [{ PatientID: "8", OfficeID: "123" }] : [{ PlacementID: "7", AltPatientID: "OLD", IsPrimaryContract: primary }] });
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, undefined, undefined, { approved: true, async submit() { writes++; return "unknown"; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientDemographics", "GetPatientContracts"] }, "owner");
  for (const id of ["first-contract", "second-contract"]) {
    await service.patientContract("prepare", { id, patientId: "8", date: "2026-09-30", recordId: "7", altPatientId: id, rationale: "Synthetic" }, "requester");
    await service.patientContract("recheck", { id, revision: 1 }, "reviewer");
    await service.patientContract("review", { id, revision: 2, decision: "approved" }, "reviewer");
  }
  primary = "Y";
  await assert.rejects(service.patientContract("execute", { id: "first-contract", revision: 3 }, "reviewer"), /source_changed_prepare_new_proposal/);
  assert.equal(writes, 0); assert.equal(repository.targets.size, 0); primary = "N";
  await service.patientContract("execute", { id: "first-contract", revision: 3 }, "reviewer");
  await assert.rejects(service.patientContract("execute", { id: "second-contract", revision: 3 }, "reviewer"), /source_target_locked/);
  assert.equal(writes, 1); assert.equal(repository.targets.size, 1);
});

for (const operation of AVAILABILITY_CREATIONS) test(`${operation} verifies office, rejects overlap, serializes creation and recovers unknown results`, async () => {
  const repository = new MemoryRepository(); let rows: Record<string, string | null>[] = [], offices = ["123"], writes = 0;
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetCaregiverDemographics" ? [{ ID: "9", OfficeIDs: JSON.stringify(offices) }] : rows });
  const special = operation === "AddCaregiverSpecialAvailability", identity = special ? "SpecialAvailabilityID" : "PermanentWeekID";
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { enabled: [operation], async submit(facts) { writes++; rows = [{ ...facts, [identity]: "88" }]; return { result: "unknown" }; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetCaregiverDemographics", "GetCaregiverPermanentWeekAvailability", "GetCaregiverSpecialAvailability"] }, "owner");
  const days = Object.fromEntries(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].flatMap(day => [[day + "AvailabilityType", "Preferred"], [day + "LiveIn", "No"], [day + "From", "0800"], [day + "To", "1700"]]));
  const input = { id: "new-availability", operation, caregiverId: "9", fromDate: special ? "2026-10-01" : "", toDate: special ? "2026-10-31" : "", days, rationale: "Synthetic caregiver preference" };
  offices = ["123", "456"]; await assert.rejects(service.createAvailability("prepare", input, "requester"), /single_caregiver_office_required/); offices = ["123"];
  await assert.rejects(service.createAvailability("prepare", { ...input, days: { ...days, MondayFrom: "2300" } }, "requester"), /overnight_availability_semantics_required/);
  const prepared = await service.createAvailability("prepare", input, "requester");
  for (const id of [input.id, "competing-new-availability"]) {
    if (id !== input.id) await service.createAvailability("prepare", { ...input, id }, "requester");
    await service.createAvailability("recheck", { id, revision: 1 }, "reviewer");
    await service.createAvailability("review", { id, revision: 2, decision: "approved" }, "reviewer");
  }
  const closed = new OperationsWorkspace(repository, read, true);
  await assert.rejects(closed.createAvailability("execute", { id: input.id, revision: 3 }, "reviewer"), /availability_creation_write_release_not_approved/);
  const attempted = await service.createAvailability("execute", { id: input.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.createAvailability("execute", { id: "competing-new-availability", revision: 3 }, "reviewer"), /source_target_locked/);
  await assert.rejects(service.createAvailability("prepare", { ...input, id: "overlap-new" }, "requester"), /existing_availability_requires_update_or_policy_review/);
  const recovery = await service.recoverWrite("prepare", { family: "availability_create", id: input.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "vendor-completed-case", runtimeTerminationReference: "runtime-ended-case" }, "requester");
  await service.recoverWrite("approve", { family: "availability_create", id: input.id, revision: recovery.revision }, "reviewer");
  assert.equal(writes, 1); assert.equal(repository.targets.size, 0);
  assert.doesNotMatch(availabilityCreationRequest(prepared.proposed), /<PermanentWeekID>|<SpecialAvailabilityID>|<OfficeID>/);
  const ack = await submitAvailabilityCreation({ async call(op, body, attempts) { assert.equal(op, operation); assert.equal(attempts, 1); return { operation: op, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: `<CaregiverID>9</CaregiverID><${identity}>88</${identity}>` }; } }, prepared.proposed);
  assert.deepEqual(ack, { result: "acknowledged", recordId: "88" });
});

test("internal patient notes prohibit email and service changes, review source reasons and recover a single unknown write", async () => {
  const repository = new MemoryRepository(); let notes: Record<string, string | null>[] = [], reason = "General", writes = 0;
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetPatientDemographics" ? [{ PatientID: "8", OfficeID: "123" }] : input.operation === "GetPatientNoteReasons" ? [{ ID: "7", OfficeID: "123", Name: reason, Active: "Y" }] : notes });
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { approved: true, async submit(facts) { writes++; notes = [{ PatientNoteID: "88", PatientID: "8", "NoteReason/ID": "7", Note: facts.Note!, Internal: "Y", EmergencyOfPriority: "N", NoteType: null, FromDate: null, ToDate: null }]; return { result: "unknown" }; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientDemographics", "GetPatientNoteReasons", "GetPatientNotes"] }, "owner");
  const input = { id: "internal-note", patientId: "8", reasonId: "7", note: "Synthetic callback logged & reviewed", rationale: "Internal operational record" };
  await assert.rejects(service.patientNote("prepare", { ...input, emailTo: "someone@example.invalid" }, "requester"), /invalid_patient_note_proposal/);
  reason = "Change In Service"; await assert.rejects(service.patientNote("prepare", input, "requester"), /service_schedule_note_requires_separate_workflow/); reason = "General";
  const prepared = await service.patientNote("prepare", input, "requester");
  const xml = patientNoteRequest(prepared.proposed); assert.doesNotMatch(xml, /EmailTo/); assert.match(xml, /<Internal>Y/); assert.match(xml, /<EmergencyOfPriroity>N/); assert.match(xml, /&amp;/);
  await service.patientNote("recheck", { id: input.id, revision: 1 }, "reviewer");
  await assert.rejects(service.patientNote("review", { id: input.id, revision: 2, decision: "approved" }, "requester"), /independent_reviewer_required/);
  await service.patientNote("review", { id: input.id, revision: 2, decision: "approved" }, "reviewer");
  const closed = new OperationsWorkspace(repository, read, true);
  await assert.rejects(closed.patientNote("execute", { id: input.id, revision: 3 }, "reviewer"), /patient_note_write_release_not_approved/);
  const attempted = await service.patientNote("execute", { id: input.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.patientNote("execute", { id: input.id, revision: attempted.revision }, "reviewer"), /write_already_attempted/);
  await assert.rejects(service.patientNote("prepare", { ...input, id: "duplicate-note" }, "requester"), /matching_note_already_in_review_window/);
  const recovery = await service.recoverWrite("prepare", { family: "patient_note", id: input.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "vendor-completed-case", runtimeTerminationReference: "runtime-ended-case" }, "requester");
  await service.recoverWrite("approve", { family: "patient_note", id: input.id, revision: recovery.revision }, "reviewer");
  assert.equal(writes, 1); assert.equal(repository.targets.size, 0);
  const ack = await submitPatientNote({ async call(operation, body, attempts) { assert.equal(operation, "CreatePatientNote"); assert.equal(attempts, 1); assert.doesNotMatch(body!, /EmailTo/); return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<PatientID>8</PatientID><NoteID>88</NoteID>' }; } }, prepared.proposed);
  assert.deepEqual(ack, { result: "acknowledged", recordId: "88" });
});

test("patient-note acknowledgement with mismatched identity cannot release its lock", async () => {
  const repository = new MemoryRepository(); let notes: Record<string, string | null>[] = [];
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetPatientDemographics" ? [{ PatientID: "8", OfficeID: "123" }] : input.operation === "GetPatientNoteReasons" ? [{ ID: "7", OfficeID: "123", Name: "General", Active: "Y" }] : notes });
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { approved: true, async submit(facts) { notes = [{ PatientNoteID: "89", PatientID: "8", "NoteReason/ID": "7", Note: facts.Note!, Internal: "Y", EmergencyOfPriority: "N", NoteType: null, FromDate: null, ToDate: null }]; return { result: "acknowledged", recordId: "88" }; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientDemographics", "GetPatientNoteReasons", "GetPatientNotes"] }, "owner");
  await service.patientNote("prepare", { id: "note-identity", patientId: "8", reasonId: "7", note: "Synthetic", rationale: "Synthetic" }, "requester");
  await service.patientNote("recheck", { id: "note-identity", revision: 1 }, "reviewer");
  await service.patientNote("review", { id: "note-identity", revision: 2, decision: "approved" }, "reviewer");
  const attempted = await service.patientNote("execute", { id: "note-identity", revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "different"); assert.equal(repository.targets.size, 1);
});

for (const userRole of ["Patient", "Caregiver"] as const) test(`${userRole} document description updates preserve bytes, verify ownership before download and recover uncertainty`, async () => {
  const repository = new MemoryRepository(); let content = "test", description = "Original", office = "123", downloads = 0, writes = 0;
  const read = async (input: ReadInput): Promise<OperationalRead> => {
    if (input.operation.startsWith("Get")) return { ...result(input), records: [userRole === "Patient" ? { PatientID: "8", OfficeID: office } : { ID: "8", OfficeIDs: JSON.stringify([office]) }] };
    if (input.operation.startsWith("Search")) return { ...result(input), records: [{ [userRole + "ID"]: "8", [userRole + "DocID"]: "9", [userRole + "DocumentTypeID"]: "7", Description: description, FileName: "synthetic.txt" }] };
    downloads++; return { ...result(input), records: [{ [userRole + "DocID"]: "9", FileName: "synthetic.txt" }], attachment: { filename: "synthetic.txt", byteLength: Buffer.byteLength(content), base64: Buffer.from(content).toString("base64"), contentType: "application/octet-stream" } };
  };
  const operation = userRole === "Patient" ? "UpdatePatientDocument" : "UpdateCaregiverDocument";
  const service = new OperationsWorkspace(repository, read, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { enabled: [operation], async submit(facts, base64) { writes++; assert.equal(Buffer.from(base64, "base64").toString(), "test"); description = facts.Description!; return "unknown"; } });
  await service.saveSettings({ ...preferences, enabledReads: ["GetPatientDemographics", "GetCaregiverDemographics", "SearchPatientDocument", "SearchCaregiverDocument", "DownloadPatientDocument", "DownloadCaregiverDocument"] }, "owner");
  const input = { id: "document-description", userRole, subjectId: "8", documentId: "9", description: "Updated & reviewed", rationale: "Synthetic metadata correction" };
  office = "456"; await assert.rejects(service.documentMetadata("prepare", input, "requester"), /document_subject_office_mismatch/); assert.equal(downloads, 0); office = "123";
  await assert.rejects(service.documentMetadata("prepare", { ...input, streamData: "replacement" }, "requester"), /invalid_document_metadata_proposal/);
  const prepared = await service.documentMetadata("prepare", input, "requester");
  assert.doesNotMatch(JSON.stringify(prepared), /dGVzdA==|base64|StreamData/); assert.equal(prepared.before.FileSHA256, prepared.proposed.FileSHA256);
  const xml = documentMetadataRequest(prepared.proposed, Buffer.from("test").toString("base64")); assert.match(xml, /Updated &amp; reviewed/); assert.match(xml, /<StreamData>dGVzdA==<\/StreamData>/);
  assert.throws(() => documentMetadataRequest(prepared.proposed, Buffer.from("DIFF").toString("base64")), /attachment_changed_never_submit/);
  for (const id of [input.id, "competing-description"]) {
    if (id !== input.id) await service.documentMetadata("prepare", { ...input, id }, "requester");
    await service.documentMetadata("recheck", { id, revision: 1 }, "reviewer");
    await service.documentMetadata("review", { id, revision: 2, decision: "approved" }, "reviewer");
  }
  const closed = new OperationsWorkspace(repository, read, true);
  await assert.rejects(closed.documentMetadata("execute", { id: input.id, revision: 3 }, "reviewer"), /document_metadata_write_release_not_approved/);
  content = "DIFF"; await assert.rejects(service.documentMetadata("execute", { id: input.id, revision: 3 }, "reviewer"), /source_changed_prepare_new_proposal/); assert.equal(writes, 0); assert.equal(repository.targets.size, 0); content = "test";
  const attempted = await service.documentMetadata("execute", { id: input.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 1);
  await assert.rejects(service.documentMetadata("execute", { id: "competing-description", revision: 3 }, "reviewer"), /source_target_locked/);
  const recovery = await service.recoverWrite("prepare", { family: "document_metadata", id: input.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "vendor-completed-case", runtimeTerminationReference: "runtime-ended-case" }, "requester");
  await service.recoverWrite("approve", { family: "document_metadata", id: input.id, revision: recovery.revision }, "reviewer");
  assert.equal(writes, 1); assert.equal(repository.targets.size, 0); assert.doesNotMatch(JSON.stringify([...repository.records]), /dGVzdA==|base64|StreamData/);
  const ack = await submitDocumentMetadata({ async call(op, body, attempts) { assert.equal(op, operation); assert.equal(attempts, 1); return { operation: op, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: `<${userRole}ID>8</${userRole}ID><${userRole}DocID>9</${userRole}DocID>` }; } }, prepared.proposed, Buffer.from("test").toString("base64"));
  assert.equal(ack, "acknowledged");
});

test("document description projection is confined to the internal metadata workflow", async () => {
  const client = { async call(operation: string) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml: '<PatientDocuments><PatientDocument><PatientID>8</PatientID><PatientDocID>9</PatientDocID><Description>Reviewed description</Description><StreamData>PRIVATE-BYTES</StreamData><CreatedBy>PRIVATE-ACTOR</CreatedBy></PatientDocument></PatientDocuments>' }; } };
  const input: ReadInput = { operation: "SearchPatientDocument", patientId: "8", id: "9" };
  const ordinary = await operationalRead(client, input), scoped = await operationalRead(client, input, "document_metadata");
  assert.equal(ordinary.records[0]?.Description, undefined); assert.equal(scoped.records[0]?.Description, "Reviewed description"); assert.doesNotMatch(JSON.stringify(scoped), /PRIVATE-/);
});


test("provable pre-dispatch denial is durably not submitted and releases only its target", async () => {
  const repository = new MemoryRepository();
  const service = new OperationsWorkspace(repository, async input => ({ ...result(input), records: [completeRate] }), true,
    { approved: true, async submit() { throw new HhaNotSubmittedError(); } });
  await approvedRate(service);
  const denied = await service.executeRate({ id: "submit-rate", revision: 3 }, "reviewer");
  assert.equal(denied.execution?.result, "not_submitted");
  assert.equal(denied.execution?.reconciliation, "not_checked");
  assert.equal((await repository.get<any>("writeIntents", "submit-rate"))?.execution.result, "not_submitted");
  await repository.reserveWriteTarget("rate_9_7", "new-proposal");
  await assert.rejects(service.executeRate({ id: "submit-rate", revision: denied.revision }, "reviewer"), /write_already_attempted/);
});


const clinicalFacts = { PatientID: "8", Comments: "Prior reviewed comment", Allergies: "Preserve exact allergy text", NursingVisitsDue: "30", MDOrderRequired: "Yes", MDOrderDue: "60", MDVisitDue: "90" };
test("clinical comments preserve clinical settings, require independent review and retain unknown locks", async () => {
  const repository = new MemoryRepository(); let facts = { ...clinicalFacts }, calls = 0;
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetPatientDemographics" ? [{ PatientID: "8", OfficeID: "123" }] : [facts] });
  const flow = new PatientClinicalWorkflow(repository, read, async () => "123", { approved: true, async submit(proposed) {
    calls++; assert.equal(proposed.Allergies, clinicalFacts.Allergies); assert.equal(proposed.MDOrderDue, "60");
    facts = { ...facts, Comments: proposed.Comments! }; return "unknown";
  } });
  const prepared = await flow.prepare({ id: "clinical-1", patientId: "8", comments: "Exact authorized comment", rationale: "Synthetic", authorityReference: "synthetic-order-1" }, "requester");
  assert.deepEqual(prepared.proposed, { ...clinicalFacts, Comments: "Exact authorized comment" });
  await assert.rejects(flow.review({ id: prepared.id, revision: 1, decision: "approved" }, "requester"), /independent_reviewer/);
  await flow.recheck({ id: prepared.id, revision: 1 }, "reviewer");
  await flow.review({ id: prepared.id, revision: 2, decision: "approved" }, "reviewer");
  const closed = new PatientClinicalWorkflow(repository, read, async () => "123");
  await assert.rejects(closed.execute({ id: prepared.id, revision: 3 }, "reviewer"), /release_not_approved/);
  const executed = await flow.execute({ id: prepared.id, revision: 3 }, "reviewer");
  assert.equal(executed.execution?.result, "unknown"); assert.equal(executed.execution?.reconciliation, "matches_proposal");
  assert.equal(calls, 1); assert.equal((await repository.getWriteTarget("patient_clinical_8"))?.active, true);
  await repository.change<Settings>("workspaceSettings", "owner", 0, "owner", "synthetic_settings", () => ({ ...preferences, id: "owner", revision: 1, updatedAt: new Date().toISOString() }));
  const recovery = new WriteRecoveryWorkflow(repository, read);
  const pending = await recovery.handle("prepare", { family: "patient_clinical", id: prepared.id, revision: executed.revision, outcome: "applied", vendorCaseReference: "synthetic-vendor-complete", runtimeTerminationReference: "synthetic-worker-ended" }, "requester");
  await assert.rejects(recovery.handle("approve", { family: "patient_clinical", id: prepared.id, revision: pending.revision }, "requester"), /independent_recovery/);
  const resolved = await recovery.handle("approve", { family: "patient_clinical", id: prepared.id, revision: pending.revision }, "reviewer");
  assert.equal(resolved.recovery?.state, "resolved"); assert.equal(repository.targets.size, 0);

  await assert.rejects(flow.execute({ id: prepared.id, revision: resolved.revision }, "reviewer"), /proposal_in_recovery_or_resolved/);
  assert.throws(() => patientClinicalRequest({ ...clinicalFacts, MDOrderRequired: null }), /mapping_required/);
  assert.throws(() => patientClinicalRequest({ ...clinicalFacts, NursingVisitsDue: null }), /complete_clinical_due/);
});

test("clinical comments reject office mismatch, extra clinical edits, missing authority and source drift", async () => {
  const repository = new MemoryRepository(); let office = "999", clinicalReads = 0, facts = { ...clinicalFacts }, submitted = 0;
  const read = async (input: ReadInput) => { if (input.operation === "GetPatientClinicalInfo") clinicalReads++; return { ...result(input), records: input.operation === "GetPatientDemographics" ? [{ PatientID: "8", OfficeID: office }] : [facts] }; };
  const flow = new PatientClinicalWorkflow(repository, read, async () => "123", { approved: true, async submit() { submitted++; return "acknowledged"; } });
  const proposal = { id: "clinical-2", patientId: "8", comments: "Reviewed", rationale: "Synthetic", authorityReference: "synthetic-order-2" };
  await assert.rejects(flow.prepare(proposal, "requester"), /office_mismatch/); assert.equal(clinicalReads, 0);
  office = "123";
  await assert.rejects(flow.prepare({ ...proposal, Allergies: "forbidden" }, "requester"), /invalid_patient_clinical_proposal/);
  await assert.rejects(flow.prepare({ ...proposal, authorityReference: "" }, "requester"), /authority_reference/);
  await flow.prepare(proposal, "requester"); await flow.recheck({ id: proposal.id, revision: 1 }, "reviewer"); await flow.review({ id: proposal.id, revision: 2, decision: "approved" }, "reviewer");
  facts = { ...facts, MDOrderDue: "61" };
  await assert.rejects(flow.execute({ id: proposal.id, revision: 3 }, "reviewer"), /source_changed/); assert.equal(submitted, 0);
  assert.notEqual((await repository.getWriteTarget("patient_clinical_8"))?.active, true);
});

test("clinical comment submission validates patient identity and preserves escaped text", async () => {
  let requests = 0;
  const acknowledgement = await submitPatientClinical({ async call(operation, body, attempts) {
    requests++; assert.equal(operation, "UpdatePatientClinicalInfo"); assert.equal(attempts, 1); assert.match(body!, /<Comments>A &amp; B<\/Comments>/);
    return { ok: true, resultXml: "<PatientID>9</PatientID>" } as any;
  } }, { ...clinicalFacts, Comments: "A & B" });
  assert.equal(acknowledgement, "unknown"); assert.equal(requests, 1);
});


test("clinical review strings are lossless and excluded from general source DTOs", async () => {
  const client = { async call() { return { ok: true, resultXml: "<PatientClinicalInfo><PatientID>8</PatientID><Comments>  Before &amp; after  </Comments><Allergies><![CDATA[  <reviewed> allergy text  ]]></Allergies><NursingVisitsDue>30</NursingVisitsDue><MDOrderRequired>Yes</MDOrderRequired><MDOrderDue>60</MDOrderDue><MDVisitDue>90</MDVisitDue></PatientClinicalInfo>" } as any; } };
  const input = { operation: "GetPatientClinicalInfo" as const, patientId: "8" };
  const publicResult = await operationalRead(client, input);
  assert.equal("Comments" in publicResult.records[0]!, false); assert.equal("Allergies" in publicResult.records[0]!, false);
  const internal = await operationalRead(client, input, "clinical_review");
  assert.equal(internal.records[0]?.Comments, "  Before & after  ");
  assert.equal(internal.records[0]?.Allergies, "  <reviewed> allergy text  ");
  const xml = patientClinicalRequest(internal.records[0]!);
  assert.match(xml, /<Allergies>  &lt;reviewed&gt; allergy text  <\/Allergies>/);
});


test("medical due creation has no clinical result, verifies office and reconciles returned identity", async () => {
  const repository = new MemoryRepository(); let rows: Record<string,string|null>[] = [], calls = 0;
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetCaregiverDemographics" ? [{ ID: "9", OfficeIDs: '["123"]' }] : input.operation === "GetCaregiverMedicals" ? [{ MedicalID: "7", OfficeID: "123", MedicalName: "Synthetic requirement", Active: "Y", Require: "Y" }] : rows });
  const flow = new MedicalCreationWorkflow(repository, read, async () => "123", { approved: true, async submit(facts) {
    calls++; const xml = createMedicalRequest(facts); assert.match(xml, /<DateCompleted xsi:nil="true"\/>/); assert.match(xml, /<ResultID xsi:nil="true"\/>/); assert.doesNotMatch(xml, /StreamData/);
    rows = [{ OfficeID: "123", CaregiverID: "9", MedicalID: "7", CaregiverMedicalID: "88", Status: "Pending", DueDate: facts.DueDate!, DatePerformed: null, Result: null, Notes: "", DocumentName: null }];
    return { result: "acknowledged", recordId: "88" };
  } });
  const proposal = { id: "medical-1", caregiverId: "9", medicalId: "7", dueDate: "2026-12-01", rationale: "Synthetic policy evidence", authorityReference: "synthetic-policy-reference" };
  const prepared = await flow.prepare(proposal, "requester");
  await assert.rejects(flow.review({ id: prepared.id, revision: 1, decision: "approved" }, "requester"), /independent_reviewer/);
  await flow.recheck({ id: prepared.id, revision: 1 }, "reviewer"); await flow.review({ id: prepared.id, revision: 2, decision: "approved" }, "reviewer");
  const closed = new MedicalCreationWorkflow(repository, read, async () => "123");
  await assert.rejects(closed.execute({ id: prepared.id, revision: 3 }, "reviewer"), /release_not_approved/);
  const attempted = await flow.execute({ id: prepared.id, revision: 3 }, "reviewer");
  assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(calls, 1); assert.equal(repository.targets.size, 0);
  await assert.rejects(flow.prepare({ ...proposal, id: "duplicate" }, "requester"), /existing_medical_requires_renewal_review/);
  await assert.rejects(flow.execute({ id: prepared.id, revision: attempted.revision }, "reviewer"), /write_already_attempted/);
});

test("medical creation rejects multi-office ambiguity, extra result fields and unapproved due policy", async () => {
  const repository = new MemoryRepository(); let offices = '["123","456"]', furtherReads = 0;
  const read = async (input: ReadInput) => { if (input.operation !== "GetCaregiverDemographics") furtherReads++; return { ...result(input), records: input.operation === "GetCaregiverDemographics" ? [{ ID: "9", OfficeIDs: offices }] : [] }; };
  const flow = new MedicalCreationWorkflow(repository, read, async () => "123");
  const proposal = { id: "medical-2", caregiverId: "9", medicalId: "7", dueDate: "2026-12-01", rationale: "Synthetic", authorityReference: "synthetic-policy-reference" };
  await assert.rejects(flow.prepare(proposal, "requester"), /single_office_required/); assert.equal(furtherReads, 0);
  await assert.rejects(flow.prepare({ ...proposal, resultId: "7" }, "requester"), /invalid_medical_creation/);
  await assert.rejects(flow.prepare({ ...proposal, authorityReference: "" }, "requester"), /authority_reference/);
  assert.throws(() => createMedicalRequest({ CaregiverID: "9", MedicalID: "7", DueDate: "2026-02-30", DateCompleted: null, Result: null, Notes: "", DocumentName: null }), /date_mapping/);
  const ack = await submitMedicalCreation({ async call() { return { ok: true, resultXml: "<CaregiverID>10</CaregiverID><CaregiverMedicalID>88</CaregiverMedicalID>" } as any; } }, { CaregiverID: "9", MedicalID: "7", DueDate: "2026-12-01", DateCompleted: null, Result: null, Notes: "", DocumentName: null });
  assert.equal(ack.result, "unknown");
});


for (const outcome of ["unknown", "not_submitted"] as const) test(`medical creation ${outcome} preserves dispatch certainty and permits only reviewed recovery`, async () => {
  const repository = new MemoryRepository(); let rows: Record<string,string|null>[] = [];
  const read = async (input: ReadInput) => ({ ...result(input), records: input.operation === "GetCaregiverDemographics" ? [{ ID: "9", OfficeIDs: '["123"]' }] : input.operation === "GetCaregiverMedicals" ? [{ MedicalID: "7", OfficeID: "123", MedicalName: "Synthetic", Active: "Y", Require: "Y" }] : rows });
  const flow = new MedicalCreationWorkflow(repository, read, async () => "123", { approved: true, async submit(facts) {
    if (outcome === "not_submitted") throw new HhaNotSubmittedError();
    rows = [{ OfficeID: "123", CaregiverID: "9", MedicalID: "7", CaregiverMedicalID: "88", Status: "Pending", DueDate: facts.DueDate!, DatePerformed: null, Result: null, Notes: "", DocumentName: null }];
    return { result: "unknown" };
  } });
  await flow.prepare({ id: "medical-uncertain", caregiverId: "9", medicalId: "7", dueDate: "2026-12-01", rationale: "Synthetic", authorityReference: "synthetic-policy-reference" }, "requester");
  await flow.recheck({ id: "medical-uncertain", revision: 1 }, "reviewer"); await flow.review({ id: "medical-uncertain", revision: 2, decision: "approved" }, "reviewer");
  const executed = await flow.execute({ id: "medical-uncertain", revision: 3 }, "reviewer");
  assert.equal(executed.execution?.result, outcome); assert.equal(repository.targets.size, outcome === "unknown" ? 1 : 0);
  if (outcome === "unknown") {
    await repository.change<Settings>("workspaceSettings", "owner", 0, "owner", "synthetic_settings", () => ({ ...preferences, id: "owner", revision: 1, updatedAt: new Date().toISOString() }));
    const recovery = new WriteRecoveryWorkflow(repository, read);
    const pending = await recovery.handle("prepare", { family: "medical_create", id: executed.id, revision: executed.revision, outcome: "applied", vendorCaseReference: "synthetic-vendor-complete", runtimeTerminationReference: "synthetic-worker-ended" }, "requester");
    await recovery.handle("approve", { family: "medical_create", id: executed.id, revision: pending.revision }, "reviewer");
    assert.equal(repository.targets.size, 0);
  }
});


for (const userRole of ["Patient", "Caregiver"] as const) test(`${userRole} attachment replacement verifies reviewed bytes and shares metadata locks`, async () => {
  const repository = new MemoryRepository(); let bytes = Buffer.from("old attachment"), filename = "original.txt", calls = 0;
  const operation = userRole === "Patient" ? "ChangePatientDocument" : "ChangeCaregiverDocument";
  const read = async (input: ReadInput): Promise<OperationalRead> => {
    if (input.operation.includes("Demographics")) return { ...result(input), records: userRole === "Patient" ? [{ PatientID: "8", OfficeID: "123" }] : [{ ID: "8", OfficeIDs: '["123"]' }] };
    if (input.operation.startsWith("Search")) return { ...result(input), records: [{ [userRole+"ID"]: "8", [userRole+"DocID"]: "9", [userRole+"DocumentTypeID"]: "7", Description: "Preserved description", FileName: filename }] };
    return { ...result(input), records: [{ [userRole+"DocID"]: "9" }], attachment: { filename, byteLength: bytes.length, base64: bytes.toString("base64"), contentType: "application/octet-stream" } };
  };
  const replacement = Buffer.from("reviewed replacement attachment").toString("base64");
  const flow = new DocumentReplacementWorkflow(repository, read, async () => "123", { enabled: [operation], async submit(facts, base64) {
    calls++; const xml = documentReplacementRequest(facts, base64); assert.doesNotMatch(xml, /DocumentTypeID|<Description>/);
    bytes = Buffer.from(base64, "base64"); filename = facts.FileName!; return "unknown";
  } });
  const proposal = { id: "replace-file", userRole, subjectId: "8", documentId: "9", filename: "replacement.txt", base64: replacement, retainedOriginalReference: "synthetic-archive-original", rationale: "Synthetic replacement" };
  await assert.rejects(flow.prepare({ ...proposal, retainedOriginalReference: "" }, "requester"), /retained_original/);
  const prepared = await flow.prepare(proposal, "requester"); assert.equal(JSON.stringify(prepared).includes(replacement), false);
  await flow.recheck({ id: prepared.id, revision: 1 }, "reviewer");
  await assert.rejects(flow.review({ id: prepared.id, revision: 2, decision: "approved", base64: replacement }, "requester"), /independent_reviewer/);
  await assert.rejects(flow.review({ id: prepared.id, revision: 2, decision: "approved", base64: "d3Jvbmc=" }, "reviewer"), /reviewed_replacement/);
  await flow.review({ id: prepared.id, revision: 2, decision: "approved", base64: replacement }, "reviewer");
  const closed = new DocumentReplacementWorkflow(repository, read, async () => "123");
  await assert.rejects(closed.execute({ id: prepared.id, revision: 3, base64: replacement }, "reviewer"), /release_not_approved/);
  await assert.rejects(flow.execute({ id: prepared.id, revision: 3, base64: "d3Jvbmc=" }, "reviewer"), /reviewed_replacement/);
  await repository.reserveWriteTarget(`document_subject_${userRole}_8`, "description-proposal");
  await assert.rejects(flow.execute({ id: prepared.id, revision: 3, base64: replacement }, "reviewer"), /source_target_locked/);
  await repository.releaseWriteTarget(`document_subject_${userRole}_8`, "description-proposal");
  const attempted = await flow.execute({ id: prepared.id, revision: 3, base64: replacement }, "reviewer");
  assert.equal(attempted.execution?.result, "unknown"); assert.equal(attempted.execution?.reconciliation, "matches_proposal"); assert.equal(repository.targets.size, 1); assert.equal(calls, 1);
  assert.equal(JSON.stringify([...repository.records]).includes(replacement), false);
  await repository.change<Settings>("workspaceSettings", "owner", 0, "owner", "synthetic_settings", () => ({ ...preferences, id: "owner", revision: 1, updatedAt: new Date().toISOString() }));
  const recovery = new WriteRecoveryWorkflow(repository, read);
  const pending = await recovery.handle("prepare", { family: "document_replacement", id: attempted.id, revision: attempted.revision, outcome: "applied", vendorCaseReference: "synthetic-vendor-complete", runtimeTerminationReference: "synthetic-worker-ended" }, "requester");
  await recovery.handle("approve", { family: "document_replacement", id: attempted.id, revision: pending.revision }, "reviewer");
  assert.equal(repository.targets.size, 0);
});

test("replacement files reject empty, path-bearing and oversized inputs without persisting bytes", () => {
  assert.throws(() => replacementFile("../outside.txt", "dGVzdA=="), /filename/);
  assert.throws(() => replacementFile("test.txt", ""), /invalid_replacement/);
  assert.throws(() => replacementFile("test.txt", Buffer.alloc(2*1024*1024+1).toString("base64")), /invalid_replacement/);
});


for (const userRole of ["Patient", "Caregiver"] as const) test(`${userRole} attachment creation verifies type reference and new file identity without persisting bytes`, async () => {
 const repository = new MemoryRepository(); let created = false, calls = 0, typeStatus = "Active";
 const base64 = Buffer.from("new related file").toString("base64");
 const rows = () => [{ [userRole+"ID"]:"8", [userRole+"DocID"]:"9", [userRole+"DocumentTypeID"]:"7", FileName:"reference.txt", Description:"Reference" }, ...(created ? [{ [userRole+"ID"]:"8", [userRole+"DocID"]:"10", [userRole+"DocumentTypeID"]:"7", FileName:"new.txt", Description:"Reviewed description" }] : [])];
 const read = async (input: ReadInput): Promise<OperationalRead> => {
  if (input.operation.includes("Demographics")) return { ...result(input), records:userRole === "Patient" ? [{PatientID:"8",OfficeID:"123"}] : [{ID:"8",OfficeIDs:'["123"]'}] };
  if (input.operation.endsWith("DocumentType")) return { ...result(input), records: [{[userRole+"DocumentTypeID"]:"7",Status:typeStatus}] };
  if (input.operation.startsWith("Search")) return { ...result(input), records: input.id ? rows().filter(row => row[userRole+"DocID"] === input.id) : rows() };
  return { ...result(input), records:[{[userRole+"DocID"]:"10"}], attachment:{filename:"new.txt",byteLength:Buffer.from(base64,"base64").length,base64,contentType:"application/octet-stream"} };
 };
 const operation = userRole === "Patient" ? "AddPatientDocument" : "AddCaregiverDocument";
 const flow = new DocumentCreationWorkflow(repository, read, async()=>"123", {enabled:[operation],async submit(facts,file){calls++;assert.equal(file,base64);assert.doesNotMatch(documentCreationRequest(facts,file),/<PatientDocID>|<CaregiverDocID>/);created=true;return {result:"acknowledged",recordId:"10"};}});
 const proposal={id:"new-document",userRole,subjectId:"8",referenceDocumentId:"9",filename:"new.txt",base64,description:"Reviewed description",rationale:"Synthetic"};
 await assert.rejects(flow.prepare({...proposal,referenceDocumentId:"999"},"requester"),/type_reference_required/);
 typeStatus="Inactive";await assert.rejects(flow.prepare(proposal,"requester"),/active_document_type_required/);typeStatus="Active";
 await flow.prepare(proposal,"requester"); await flow.recheck({id:proposal.id,revision:1},"reviewer");
 await assert.rejects(flow.review({id:proposal.id,revision:2,decision:"approved",base64:"d3Jvbmc="},"reviewer"),/reviewed_replacement/);
 await flow.review({id:proposal.id,revision:2,decision:"approved",base64},"reviewer");
 const closed=new DocumentCreationWorkflow(repository,read,async()=>"123");await assert.rejects(closed.execute({id:proposal.id,revision:3,base64},"reviewer"),/release_not_approved/);
 await repository.reserveWriteTarget(`document_subject_${userRole}_8`,"replacement-in-progress");
 await assert.rejects(flow.execute({id:proposal.id,revision:3,base64},"reviewer"),/source_target_locked/);await repository.releaseWriteTarget(`document_subject_${userRole}_8`,"replacement-in-progress");
 const executed=await flow.execute({id:proposal.id,revision:3,base64},"reviewer");assert.equal(executed.execution?.reconciliation,"matches_proposal");assert.equal(calls,1);assert.equal(repository.targets.size,0);
 assert.equal(JSON.stringify([...repository.records]).includes(base64),false);
 await assert.rejects(flow.prepare({...proposal,id:"duplicate"},"requester"),/filename_already_exists/);
});


test("medical definitions must explicitly remain active through submission", async () => {
 const repository=new MemoryRepository();let active:string|null="N",submitted=0;
 const read=async(input:ReadInput)=>({...result(input),records:input.operation==="GetCaregiverDemographics"?[{ID:"9",OfficeIDs:'["123"]'}]:input.operation==="GetCaregiverMedicals"?[{MedicalID:"7",OfficeID:"123",MedicalName:"Synthetic",Active:active,Require:"Y"}]:[]});
 const flow=new MedicalCreationWorkflow(repository,read,async()=>"123",{approved:true,async submit(){submitted++;return {result:"unknown"};}});
 const proposal={id:"inactive-medical",caregiverId:"9",medicalId:"7",dueDate:"2026-12-01",rationale:"Synthetic",authorityReference:"synthetic-reference"};
 for(const value of ["N",null,"", "unknown"]){active=value;await assert.rejects(flow.prepare(proposal,"requester"),/active_medical_definition_required/);}
 active="Y";await flow.prepare(proposal,"requester");await flow.recheck({id:proposal.id,revision:1},"reviewer");await flow.review({id:proposal.id,revision:2,decision:"approved"},"reviewer");
 active="N";await assert.rejects(flow.execute({id:proposal.id,revision:3},"reviewer"),/active_medical_definition_required/);assert.equal(submitted,0);assert.equal(repository.targets.size,0);
});

const syntheticPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
test("caregiver picture replacement requires reviewed bytes, serializes target and retains unknown results", async () => {
 const repository=new MemoryRepository();let file={filename:"old.png",base64:syntheticPng},calls=0,office="123",missing=false;
 const read=async(input:ReadInput):Promise<OperationalRead>=> input.operation==="GetCaregiverDemographics" ? {...result(input),records:[{ID:"8",OfficeIDs:JSON.stringify([office])}]} : {...result(input),records:[{CaregiverID:"8"}],...(missing?{}:{attachment:{...file,byteLength:Buffer.from(file.base64,"base64").length,contentType:"application/octet-stream" as const}})};
 const flow=new CaregiverPictureWorkflow(repository,read,async()=>"123",{approved:true,async submit(facts,base64){calls++;caregiverPictureRequest(facts,base64);file={filename:facts.FileName!,base64};return "unknown";}});
 const input={id:"picture",caregiverId:"8",filename:"reviewed.png",base64:syntheticPng,retainedOriginalReference:"synthetic-archive",rationale:"Synthetic picture replacement"};
 office="999";await assert.rejects(flow.prepare(input,"requester"),/single_office/);office="123";
 missing=true;await assert.rejects(flow.prepare(input,"requester"),/absence_not_proven/);missing=false;
 const prepared=await flow.prepare(input,"requester");assert.equal(JSON.stringify(prepared).includes(syntheticPng),false);
 await flow.recheck({id:"picture",revision:1},"reviewer");
 await assert.rejects(flow.review({id:"picture",revision:2,decision:"approved",base64:syntheticPng},"requester"),/independent_reviewer/);
 await flow.review({id:"picture",revision:2,decision:"approved",base64:syntheticPng},"reviewer");
 const closed=new CaregiverPictureWorkflow(repository,read,async()=>"123");
 await assert.rejects(closed.execute({id:"picture",revision:3,base64:syntheticPng},"reviewer"),/release_not_approved/);
 await repository.reserveWriteTarget("caregiver_picture_8","competing");
 await assert.rejects(flow.execute({id:"picture",revision:3,base64:syntheticPng},"reviewer"),/target_locked/);
 await repository.releaseWriteTarget("caregiver_picture_8","competing");
 const attempted=await flow.execute({id:"picture",revision:3,base64:syntheticPng},"reviewer");
 assert.equal(calls,1);assert.equal(attempted.execution?.result,"unknown");assert.equal(attempted.execution?.reconciliation,"matches_proposal");assert.equal(repository.targets.size,1);
 await assert.rejects(flow.execute({id:"picture",revision:attempted.revision,base64:syntheticPng},"reviewer"),/already_attempted/);
 await repository.change<Settings>("workspaceSettings","owner",0,"owner","synthetic",()=>({...preferences,id:"owner",revision:1,updatedAt:new Date().toISOString()}));
 const recovery=new WriteRecoveryWorkflow(repository,read);
 const pending=await recovery.handle("prepare",{family:"caregiver_picture",id:"picture",revision:attempted.revision,outcome:"applied",vendorCaseReference:"synthetic-confirmation",runtimeTerminationReference:"synthetic-worker-ended"},"requester");
 await recovery.handle("approve",{family:"caregiver_picture",id:"picture",revision:pending.revision},"reviewer");assert.equal(repository.targets.size,0);
});
test("caregiver picture serialization rejects invalid bytes and mismatched acknowledgements",async()=>{
 assert.throws(()=>pictureFile("file.png","dGVzdA=="),/png_or_jpeg/);
 assert.throws(()=>pictureFile("file.exe",syntheticPng),/png_or_jpeg/);
 const facts={CaregiverID:"8",...pictureFile("reviewed.png",syntheticPng)};
 assert.throws(()=>caregiverPictureRequest({...facts,FileSHA256:"wrong"},syntheticPng),/reviewed_picture/);
 let calls=0;const status=await submitCaregiverPicture({async call(){calls++;return {ok:true,resultXml:"<CaregiverID>999</CaregiverID>"};}} as never,facts,syntheticPng);
 assert.equal(status,"unknown");assert.equal(calls,1);
});

test("secondary contract creation verifies payer/service, independent authority review and returned placement",async()=>{
 const repository=new MemoryRepository();let rows:Record<string,string|null>[]=[],active="Y",office="123",calls=0;
 const read=async(input:ReadInput):Promise<OperationalRead>=>{readRequest(input);return {...result(input),records:input.operation==="GetPatientDemographics"?[{PatientID:"8",OfficeID:office}]:input.operation==="GetContracts"?[{ContractID:"4",ContractName:"Synthetic payer",Active:active}]:input.operation==="GetBillingServiceCodes"?[{ServiceCodeID:"5",ContractID:"4",ServiceCodeName:"Synthetic service"}]:rows};};
 const flow=new ContractCreationWorkflow(repository,read,async()=>"123",{approved:true,async submit(facts){calls++;assert.match(createContractRequest(facts),/<IsPrimaryContract>false/);rows=[{PlacementID:"99","Contract/ID":"4",ServiceStartDate:facts.StartDate!,AltPatientID:facts.AltPatientID!,"ServiceCode/ID":"5",IsPrimaryContract:"N",DischargeDate:null}];return {result:"unknown"};}});
 const input={id:"contract-create",patientId:"8",contractId:"4",serviceCodeId:"5",startDate:"2026-10-01",altPatientId:"SYNTHETIC",authorityReference:"synthetic-coverage-authority",rationale:"Synthetic secondary payer"};
 office="999";await assert.rejects(flow.prepare(input,"requester"),/office_mismatch/);office="123";
 active="N";await assert.rejects(flow.prepare(input,"requester"),/active_contract/);active="Y";
 await assert.rejects(flow.prepare({...input,serviceCodeId:"6"},"requester"),/service_mapping/);
 await flow.prepare(input,"requester");await flow.recheck({id:input.id,revision:1},"reviewer");
 await assert.rejects(flow.review({id:input.id,revision:2,decision:"approved"},"requester"),/independent_reviewer/);
 await flow.review({id:input.id,revision:2,decision:"approved"},"reviewer");
 const closed=new ContractCreationWorkflow(repository,read,async()=>"123");await assert.rejects(closed.execute({id:input.id,revision:3},"reviewer"),/release_not_approved/);
 active="N";await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/active_contract/);assert.equal(calls,0);assert.equal(repository.targets.size,0);active="Y";
 await repository.reserveWriteTarget("patient_contracts_8","existing-contract-edit");await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/target_locked/);await repository.releaseWriteTarget("patient_contracts_8","existing-contract-edit");
 const attempted=await flow.execute({id:input.id,revision:3},"reviewer");assert.equal(calls,1);assert.equal(attempted.execution?.reconciliation,"matches_proposal");assert.equal(repository.targets.size,1);
 await assert.rejects(flow.prepare({...input,id:"duplicate"},"requester"),/existing_contract/);
 await repository.change<Settings>("workspaceSettings","owner",0,"owner","synthetic",()=>({...preferences,id:"owner",revision:1,updatedAt:new Date().toISOString()}));
 const recovery=new WriteRecoveryWorkflow(repository,read);const pending=await recovery.handle("prepare",{family:"contract_create",id:input.id,revision:attempted.revision,outcome:"applied",vendorCaseReference:"synthetic-case-confirmation",runtimeTerminationReference:"synthetic-worker-ended"},"requester");await recovery.handle("approve",{family:"contract_create",id:input.id,revision:pending.revision},"reviewer");assert.equal(repository.targets.size,0);
});

test("inactive referral creation verifies offices and type, rejects duplicate names and reconciles returned identity",async()=>{
 const repository=new MemoryRepository();let rows:Record<string,string|null>[]=[],typeStatus="Active",calls=0;
 const read=async(input:ReadInput):Promise<OperationalRead>=>{readRequest(input);return {...result(input),records:input.operation==="GetOfficesV2"?[{OfficeID:"123",OfficeName:"Synthetic office",Status:"Active"}]:input.operation==="GetReferralSourceType"?[{ReferralSourceTypeID:"7",ReferralSourceTypeName:"Hospital",Status:typeStatus}]:rows};};
 const flow=new ReferralCreationWorkflow(repository,read,async()=>"123",{approved:true,async submit(facts){calls++;const xml=createReferralRequest(facts);assert.match(xml,/<ReferralSourceID>0/);assert.match(xml,/<StatusID>0/);assert.match(xml,/<MarketerId xsi:nil="true"/);rows=[{ReferralSourceID:"88",ReferralSourceName:facts.Name!,ReferralSourceType:"Hospital",Status:"Inactive",OfficeIDs:'["123"]'}];return {result:"acknowledged",recordId:"88"};}});
 const input={id:"new-source",name:"Synthetic hospital",typeId:"7",authorityReference:"synthetic-source-review",rationale:"Synthetic inactive source"};
 typeStatus="Inactive";await assert.rejects(flow.prepare(input,"requester"),/active_referral/);typeStatus="Active";
 await flow.prepare(input,"requester");await flow.recheck({id:input.id,revision:1},"reviewer");await assert.rejects(flow.review({id:input.id,revision:2,decision:"approved"},"requester"),/independent/);await flow.review({id:input.id,revision:2,decision:"approved"},"reviewer");
 const closed=new ReferralCreationWorkflow(repository,read,async()=>"123");await assert.rejects(closed.execute({id:input.id,revision:3},"reviewer"),/release_not_approved/);
 const executed=await flow.execute({id:input.id,revision:3},"reviewer");assert.equal(calls,1);assert.equal(executed.execution?.reconciliation,"matches_proposal");assert.equal(repository.targets.size,0);
 await assert.rejects(flow.prepare({...input,id:"duplicate",name:"SYNTHETIC HOSPITAL"},"requester"),/existing_referral/);
 rows[0]!.OfficeIDs='["999"]';await assert.rejects(flow.prepare({...input,id:"wrong-office"},"requester"),/office_readback/);
});
test("referral source projection preserves explicit office IDs without inventing a default office",async()=>{
 const output=await operationalRead({async call(){return {ok:true,resultXml:'<GetReferralSource><ReferralSourceInfo><ReferralSourceID>8</ReferralSourceID><ReferralSourceName>Synthetic</ReferralSourceName><Offices><Office><OfficeID>123</OfficeID><OfficeName>Synthetic</OfficeName></Office><Office><OfficeID>456</OfficeID></Office></Offices></ReferralSourceInfo></GetReferralSource>'};}} as never,{operation:"GetReferralSource",officeId:"123",status:"All"});
 assert.equal(output.records[0]?.OfficeIDs,'["123","456"]');
});

const collectionReferences:Record<string,Record<string,string>>={GetCollectionARNoteReasons:{ReasonID:"1",Reason:"Synthetic AR reason"},GetCollectionRepresentatives:{RefCollectionRepID:"2",CollectionRep:"Synthetic collector"},GetCollectionStatus:{CollectionStatusID:"3",CollectionStatusValue:"I-InProgress"},GetCollectionClaimStatus:{RefClaimStatusID:"4",ClaimStatusName:"Appeal"},GetCollectionReasonForNonPayment:{RefReasonForNonPaymentID:"5",NonPaymentName:"Review pending"},GetCollectionFollowUpRepresentatives:{RepresentativeID:"6",Representative:"Synthetic follow-up"}};
for(const outcome of ["acknowledged","unknown","budget"] as const)test(`collection note ${outcome} preserves submit certainty, fresh history and explicit financial statuses`,async()=>{
 const repository=new MemoryRepository();let notes:Record<string,string|null>[]=[],active="True",office="123",billed=true,calls=0,billingStatus:string|null="Yes",otherCharge:string|null=null,billContract="4";const exactIds:string[]=[];
 const read=async(input:ReadInput):Promise<OperationalRead>=>{readRequest(input);let records:Record<string,string|null>[];
 if(input.operation==="GetPatientDemographics")records=[{PatientID:"8",OfficeID:office}];
 else if(input.operation==="GetScheduleInfo")records=[{ID:"77","Patient/ID":"8","PrimaryBillTo/Contract/ID":"4",VisitDate:"2026-09-30"}];
 else if(input.operation==="GetVisitBillInfoV2")records=[{ID:"77","Patient/ID":"8","PrimaryBillTo/BilledAmount":"100.00","PrimaryBillTo/Contract/ID":billContract,"PrimaryBillTo/IsBilled":billingStatus}];
 else if(input.operation==="SearchBilledVisits")records=billed?[{VisitID:"77",PatientID:"8",ContractID:"4",OtherChargeID:otherCharge}]:[];
 else if(input.operation==="GetCollectionNotes"){if(input.noteId)exactIds.push(input.noteId);records=notes;}
 else records=[{...collectionReferences[input.operation]!,Active:active}];return {...result(input),records};};
 const flow=new CollectionNoteWorkflow(repository,read,async()=>"123",{approved:true,async submit(facts){if(outcome==="budget")throw new HhaNotSubmittedError();calls++;assert.match(collectionNoteRequest(facts),/<OtherChargeID xsi:nil="true"/);notes=[{CreatedDate:"2026-09-30T10:00:00",Notes:facts.Notes!,Reason:facts.Reason!,ColRep:facts.ColRep!,CollectionStatus:facts.CollectionStatus!,ClaimStatusName:facts.ClaimStatusName!,NonPaymentName:facts.NonPaymentName!,CollectionFollowUpRep:facts.CollectionFollowUpRep!,FollowupDate:facts.FollowupDate!+"T00:00:00"}];return {result:outcome,recordId:"88"};}});
 const input={id:"collection",patientId:"8",visitId:"77",contractId:"4",reasonId:"1",representativeId:"2",collectionStatusId:"3",claimStatusId:"4",nonPaymentReasonId:"5",followUpRepresentativeId:"6",followupDate:"2026-10-05",note:"Synthetic reviewed collection note",authorityReference:"synthetic-collection-authority",rationale:"Synthetic follow-up"};
 office="999";await assert.rejects(flow.prepare(input,"requester"),/office_mismatch/);office="123";active="False";await assert.rejects(flow.prepare(input,"requester"),/active_collection/);active="True";billed=false;await assert.rejects(flow.prepare(input,"requester"),/billed_contract/);billed=true;
 for(const invalid of ["No","",null,"unknown","true","Y"]){billingStatus=invalid;await assert.rejects(flow.prepare(input,"requester"),/billing_status/);}billingStatus="Yes";
 for(const invalid of ["99","0",""]){otherCharge=invalid;await assert.rejects(flow.prepare(input,"requester"),/billed_contract/);}otherCharge=null;
 billContract="999";await assert.rejects(flow.prepare(input,"requester"),/billing_status/);billContract="4";
 await flow.prepare(input,"requester");await flow.recheck({id:input.id,revision:1},"reviewer");await assert.rejects(flow.review({id:input.id,revision:2,decision:"approved"},"requester"),/independent/);await flow.review({id:input.id,revision:2,decision:"approved"},"reviewer");
 const closed=new CollectionNoteWorkflow(repository,read,async()=>"123");await assert.rejects(closed.execute({id:input.id,revision:3},"reviewer"),/release_not_approved/);
 billingStatus="No";await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/billing_status/);billingStatus="Yes";
 otherCharge="99";await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/billed_contract/);otherCharge=null;assert.equal(calls,0);assert.equal(repository.targets.size,0);
 notes=[{CreatedDate:"2026-09-30T09:00:00",Notes:"Concurrent source note"}];await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/source_changed/);assert.equal(calls,0);assert.equal(repository.targets.size,0);notes=[];
 await repository.reserveWriteTarget("collection_note_77_4","competing");await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/target_locked/);await repository.releaseWriteTarget("collection_note_77_4","competing");
 const attempted=await flow.execute({id:input.id,revision:3},"reviewer");assert.equal(attempted.execution?.result,outcome==="budget"?"not_submitted":outcome);assert.equal(calls,outcome==="budget"?0:1);
 if(outcome!=="budget"){assert.equal(attempted.execution?.reconciliation,"matches_proposal");assert.deepEqual(exactIds,["88"]);await assert.rejects(flow.prepare({...input,id:"duplicate"},"requester"),/already_exists/);}
 assert.equal(repository.targets.size,outcome==="unknown"?1:0);
 if(outcome==="unknown"){await repository.change<Settings>("workspaceSettings","owner",0,"owner","synthetic",()=>({...preferences,id:"owner",revision:1,updatedAt:new Date().toISOString()}));const recovery=new WriteRecoveryWorkflow(repository,read);const pending=await recovery.handle("prepare",{family:"collection_note",id:input.id,revision:attempted.revision,outcome:"applied",vendorCaseReference:"synthetic-completed-case",runtimeTerminationReference:"synthetic-worker-ended"},"requester");await recovery.handle("approve",{family:"collection_note",id:input.id,revision:pending.revision},"reviewer");assert.equal(repository.targets.size,0);}
});
test("collection catalog and note-ID filter follow the captured response and request elements",async()=>{
 const result=await operationalRead({async call(){return {ok:true,resultXml:'<CollectionStatuses><CollectionStatus><CollectionStatusID>3</CollectionStatusID><CollectionStatusValue>I-InProgress</CollectionStatusValue><Active>True</Active></CollectionStatus></CollectionStatuses>'};}} as never,{operation:"GetCollectionStatus",status:"All"});assert.equal(result.records[0]?.CollectionStatusID,"3");
 assert.match(readRequest({operation:"GetCollectionNotes",id:"77",patientId:"8",contractId:"4",noteId:"88"}),/<CollectionNoteDetailID>88/);
});

test("collection acknowledgement for an ancillary charge never confirms a visit note",async()=>{
 const facts={VisitID:"77",PatientID:"8",ContractID:"4",OfficeID:"123",ARNotesReasonID:"1",CollectionRepID:"2",CollectionStatusID:"3",RefClaimStatusID:"4",RefReasonForNonPaymentID:"5",FollowUpRepID:"6",Notes:"Synthetic",FollowupDate:"2026-10-05"};
 const response=await submitCollectionNote({async call(){return {ok:true,resultXml:"<VisitID>77</VisitID><PatientID>8</PatientID><ContractID>4</ContractID><CollectionNotesDetailID>88</CollectionNotesDetailID><OtherChargeID>99</OtherChargeID>"};}} as never,facts);
 assert.equal(response.result,"unknown");
});

test("referral profiles require exact identity and all explicit filter IDs without sentinels",async()=>{
 const input:ReadInput={operation:"GetReferralProfile",id:"77",officeId:"123",referralStatusId:"1",referralSourceId:"2",salesStaffId:"3",contractId:"4"};
 const xml=readRequest(input);assert.match(xml,/<ReferralID>77<\/ReferralID>/);assert.match(xml,/<ReferralContractID>4/);
 for(const key of ["id","officeId","referralStatusId","referralSourceId","salesStaffId","contractId"] as const){for(const value of [undefined,"0","-1","<xml>"]){assert.throws(()=>readRequest({...input,[key]:value}),/invalid_identifier/);}}
 const client=(id:string)=>({async call(){return {ok:true,resultXml:`<ReferralSearch><ReferralSearchInfo><ReferralID>${id}</ReferralID><ReferralName>Synthetic</ReferralName><Phone>PRIVATE</Phone><ContactName>PRIVATE</ContactName></ReferralSearchInfo></ReferralSearch>`};}} as never);
 const output=await operationalRead(client("77"),input);assert.equal(output.records[0]?.ReferralName,"Synthetic");assert.equal(JSON.stringify(output).includes("PRIVATE"),false);
 await assert.rejects(operationalRead(client("88"),input),/exact_filter_not_honored/);
 const repository=new MemoryRepository(),service=new OperationsWorkspace(repository,async q=>result(q),true);
 await service.saveSettings({...preferences,enabledReads:["GetReferralProfile"]},"owner");
 assert.equal((await workspaceRoute(service,"POST","/workspace/read",{...input,officeId:"999"},"owner"))?.status,403);
});

for(const outcome of ["acknowledged","unknown","budget"] as const)test(`linked schedule ${outcome} checks conflicts, target serialization and exact identity`,async()=>{
 const repository=new MemoryRepository();let created=false,calls=0,conflict=false,active="Active",ambiguous=false,truncated=false,wrongIdentity=false;
 const read=async(input:ReadInput):Promise<OperationalRead>=>{readRequest(input);let records:Record<string,string|null>[]=[];
 if(input.operation==="GetPatientDemographics")records=[{PatientID:"8",OfficeID:"123",PatientStatusName:"Active"}];
 else if(input.operation==="GetCaregiverDemographics")records=[{ID:"9",OfficeIDs:'["123"]',"Status/Name":active}];
 else if(input.operation==="GetLinkedContractServiceCodes")records=input.scheduleType==="Skilled"&&!ambiguous?[]:[{ServiceCodeID:"5",ServiceCodeName:"Synthetic linked service"}];
 else if(input.operation==="GetCaregiverPayCodes")records=[{PayCodeID:"4",PayCodeName:"Synthetic pay"}];
 else if(input.operation==="SearchVisitsV2")records=conflict||created&&input.date==="2026-10-10"?[{VisitID:"77"}]:[];
 else if(input.operation==="GetLinkedScheduleInfo")records=[{ID:wrongIdentity?"99":"77","Patient/ID":"8","Caregiver/ID":"9","Caregiver/PayCode/ID":"4","PrimaryBillTo/ServiceCode/ID":"5",VisitDate:"2026-10-10",ScheduleStartTime:"0900",ScheduleEndTime:"1200"}];
 return {...result(input),records,truncated:input.operation==="SearchVisitsV2"&&truncated};};
 const flow=new LinkedScheduleCreationWorkflow(repository,read,async()=>"123",{approved:true,async submit(facts){if(outcome==="budget")throw new HhaNotSubmittedError();calls++;createLinkedScheduleRequest(facts);created=true;return {result:outcome,recordId:"77"};}});
 const input={id:"linked-create",patientId:"8",caregiverId:"9",payCodeId:"4",serviceCodeId:"5",date:"2026-10-10",startTime:"0900",endTime:"1200",authorityReference:"synthetic-assignment-coverage",rationale:"Synthetic schedule"};
 conflict=true;await assert.rejects(flow.prepare(input,"requester"),/adjacent_day/);conflict=false;
 active="Inactive";await assert.rejects(flow.prepare(input,"requester"),/active_single_office/);active="Active";
 ambiguous=true;await assert.rejects(flow.prepare(input,"requester"),/unambiguous_non_skilled/);ambiguous=false;
 truncated=true;await assert.rejects(flow.prepare(input,"requester"),/complete_schedule/);truncated=false;
 await assert.rejects(flow.prepare({...input,endTime:"0800"},"requester"),/same_day_non_skilled/);
 await flow.prepare(input,"requester");await flow.recheck({id:input.id,revision:1},"reviewer");
 await assert.rejects(flow.review({id:input.id,revision:2,decision:"approved"},"requester"),/independent/);
 await flow.review({id:input.id,revision:2,decision:"approved"},"reviewer");
 const closed=new LinkedScheduleCreationWorkflow(repository,read,async()=>"123");await assert.rejects(closed.execute({id:input.id,revision:3},"reviewer"),/release_not_approved/);
 active="Inactive";await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/active_single_office/);active="Active";assert.equal(calls,0);assert.equal(repository.targets.size,0);
 await repository.reserveWriteTarget("schedule_office_123","competing");await assert.rejects(flow.execute({id:input.id,revision:3},"reviewer"),/target_locked/);await repository.releaseWriteTarget("schedule_office_123","competing");
 const attempted=await flow.execute({id:input.id,revision:3},"reviewer");assert.equal(calls,outcome==="budget"?0:1);assert.equal(attempted.execution?.result,outcome==="budget"?"not_submitted":outcome);assert.equal(repository.targets.size,outcome==="budget"?0:1);
 if(outcome!=="budget"){assert.equal(attempted.execution?.reconciliation,"matched_returned_fields");await assert.rejects(flow.prepare({...input,id:"duplicate"},"requester"),/existing_schedule/);wrongIdentity=true;const check=await flow.reconcile({id:input.id,revision:attempted.revision},"reviewer");assert.equal(check.execution?.reconciliation,"unavailable");wrongIdentity=false;
 {await repository.change<Settings>("workspaceSettings","owner",0,"owner","synthetic",()=>({...preferences,id:"owner",revision:1,updatedAt:new Date().toISOString()}));const recovery=new WriteRecoveryWorkflow(repository,read);await assert.rejects(recovery.handle("prepare",{family:"linked_schedule_create",id:input.id,revision:check.revision,outcome:"applied",vendorCaseReference:"aaaaaaaa",runtimeTerminationReference:"bbbbbbbb"},"requester"),/vendor_evidence_verifier/);await assert.rejects(recovery.handle("prepare",{family:"linked_schedule_create",id:input.id,revision:check.revision,outcome:"applied",confirmedScheduleType:"Non-Skilled",vendorCaseReference:"aaaaaaaa",runtimeTerminationReference:"bbbbbbbb"},"requester"),/vendor_evidence_verifier/);assert.equal(repository.targets.size,1);
 const key="linkedScheduleCreations/"+input.id, saved=repository.records.get(key)!;
 for(const state of ["pending_review","resolved"]){repository.records.set(key,{...saved,recovery:{state,outcome:"applied",confirmedScheduleType:"Non-Skilled",vendorCaseReference:"aaaaaaaa",runtimeTerminationReference:"bbbbbbbb",requestedBy:"requester",reviewedBy:"reviewer",sourceFingerprint:"unverified"}} as Versioned);await assert.rejects(recovery.handle("approve",{family:"linked_schedule_create",id:input.id,revision:saved.revision},"reviewer"),/vendor_evidence_verifier/);assert.equal(repository.targets.size,1);}
 }}
});
test("linked schedule acknowledgement must identify the reviewed patient and a positive visit",async()=>{
 assert.equal(LINKED_SCHEDULE_EVIDENCE_VERIFIER_AVAILABLE,false);
 const facts={OfficeID:"123",PatientID:"8",CaregiverID:"9",PayCodeID:"4",ServiceCodeID:"5",ScheduleType:"Non-Skilled",VisitDate:"2026-10-10",ScheduleStartTime:"0900",ScheduleEndTime:"1200"};let calls=0;
 for(const xml of ["<PatientID>99</PatientID><VisitID>77</VisitID>","<PatientID>8</PatientID><VisitID>0</VisitID>"]){const result=await submitLinkedScheduleCreation({async call(){calls++;return {ok:true,resultXml:xml};}} as never,facts);assert.equal(result.result,"unknown");}assert.equal(calls,2);
 assert.throws(()=>createLinkedScheduleRequest({...facts,ScheduleType:"Skilled"}),/same_day_non_skilled/);
});

test("schedule preservation review is scoped, read-only and rejects inconsistent source snapshots",async()=>{
 const repository=new MemoryRepository();let office="123",changed=false;const calls:string[]=[];
 const common={ID:"77","Patient/ID":"8","Caregiver/ID":"9",VisitDate:"2026-10-10",ScheduleStartTime:"0900",ScheduleEndTime:"1200"};
 const read=async(input:ReadInput):Promise<OperationalRead>=>{calls.push(input.operation);return {...result(input),records:[input.operation==="GetPatientDemographics"?{PatientID:"8",OfficeID:office}:input.operation==="GetVisitInfoV2"?{...common,ScheduleStartTime:changed?"0800":"0900",IsScheduleTemporary:"Yes",IsCaregiverTemporary:"No",EVVStartTime:null,ActualHours:null}:common]};};
 const service=new OperationsWorkspace(repository,read,true);
 await service.saveSettings({...preferences,enabledReads:["GetScheduleInfo","GetLinkedScheduleInfo","GetPatientDemographics","GetVisitInfoV2","GetVisitBillInfoV2"]},"owner");
 const response=await workspaceRoute(service,"POST","/workspace/schedule-review",{visitId:"77",kind:"standard"},"owner");assert.equal(response?.status,200);const body=response!.body as any;assert.equal(body.submissionAvailable,false);assert.equal(body.sources[1].records[0].ActualHours,null);assert.equal(body.sources[1].records[0].IsScheduleTemporary,"Yes");assert.equal(body.sources.length,3);assert.ok(calls.every(op=>op.startsWith("Get")));assert.equal(repository.targets.size,0);
 changed=true;assert.equal((await workspaceRoute(service,"POST","/workspace/schedule-review",{visitId:"77",kind:"standard"},"owner"))?.status,409);changed=false;
 office="999";calls.length=0;assert.equal((await workspaceRoute(service,"POST","/workspace/schedule-review",{visitId:"77",kind:"standard"},"owner"))?.status,403);assert.deepEqual(calls,["GetScheduleInfo","GetPatientDemographics"]);office="123";
 const linked=await service.reviewSchedule({visitId:"77",kind:"linked"},"owner");assert.equal(linked.sources.length,1);assert.match(linked.unresolved[0]!,/ScheduleType and Comments/);
 const closed=new OperationsWorkspace(repository,read,false);await assert.rejects(closed.reviewSchedule({visitId:"77",kind:"standard"},"owner"),/release_not_approved/);
});
test("visit V2 preserves documented temporary, duration and budget fields without interpreting defaults",async()=>{
 const output=await operationalRead({async call(){return {ok:true,resultXml:'<VisitInfo><ID>77</ID><IsScheduleTemporary>Yes</IsScheduleTemporary><IsCaregiverTemporary>No</IsCaregiverTemporary><BudgetNumber>3</BudgetNumber><ScheduleDuration><ScheduleDurationHours>4</ScheduleDurationHours><ScheduleDurationMinutes>15</ScheduleDurationMinutes></ScheduleDuration><SuggestedStartTime>0900</SuggestedStartTime><BilledAmount>0.00</BilledAmount></VisitInfo>'};}} as never,{operation:"GetVisitInfoV2",id:"77"});
 assert.equal(output.records[0]?.IsScheduleTemporary,"Yes");assert.equal(output.records[0]?.BudgetNumber,"3");assert.equal(output.records[0]?.["ScheduleDuration/ScheduleDurationMinutes"],"15");assert.equal(output.records[0]?.SuggestedEndTime,null);assert.equal(output.records[0]?.BilledAmount,"0.00");
});
