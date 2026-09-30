import { LinkedScheduleCreationWorkflow, type LinkedScheduleCreationSubmission } from "./linkedScheduleCreations.js";
import { CollectionNoteWorkflow, type CollectionNoteSubmission } from "./collectionNotes.js";
import { ReferralCreationWorkflow, type ReferralCreationSubmission } from "./referralCreations.js";
import { ContractCreationWorkflow, type ContractCreationSubmission } from "./contractCreations.js";
import { CaregiverPictureWorkflow } from "./caregiverPictures.js";
import { DocumentCreationWorkflow, type DocumentCreationOperation, type DocumentCreationSubmission } from "./documentCreations.js";
import { DocumentReplacementWorkflow, type DocumentReplacementOperation } from "./documentReplacements.js";
import { MedicalCreationWorkflow, type MedicalCreationSubmission } from "./medicalCreations.js";
import { PatientClinicalWorkflow } from "./patientClinical.js";
import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { DocumentMetadataWorkflow, type DocumentMetadataOperation } from "./documentMetadata.js";
import { PatientNoteWorkflow, type PatientNoteSubmission } from "./patientNotes.js";
import { AvailabilityCreationWorkflow, type AvailabilityCreationOperation, type AvailabilityCreationSubmission } from "./availabilityCreations.js";
import { PatientContractWorkflow } from "./patientContracts.js";
import { RateCreationWorkflow, type RateCreationSubmission } from "./rateCreations.js";
import { TopicWorkflow, type TopicSubmission } from "./topics.js";
import { DocumentTypeWorkflow } from "./documentTypes.js";
import { WriteRecoveryWorkflow, type WriteRecovery } from "./recovery.js";
import { AvailabilityWorkflow, type AvailabilityOperation } from "./availability.js";
import { randomUUID } from "node:crypto";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { vendorContractBlocked } from "../integrations/hhaexchange/contractGates.js";
import { rateWriteRequest, sameSourceFacts, sameDecimal } from "./writes.js";
import { READ_OPERATIONS, OFFICE_SCOPED_READS, readInputFields, readRequest, WorkflowError, identifier, type ReadInput, type OperationalRead } from "./reads.js";

export interface Versioned { id: string; revision: number; updatedAt: string; }
export interface WorkspacePage<T> { items: T[]; nextCursor: string | null; }
export function workspaceCursor(value: unknown): { updatedAt: string; id: string } | null {
  if (value === undefined || value === null || value === "") return null;
  try {
    if (typeof value !== "string" || value.length > 400) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString());
    if (typeof parsed.updatedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(parsed.updatedAt) || !Number.isFinite(Date.parse(parsed.updatedAt)) || typeof parsed.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(parsed.id)) throw new Error();
    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch { throw new WorkflowError("invalid_page_cursor"); }
}
export function nextWorkspaceCursor(updatedAt: string, id: string): string { return Buffer.from(JSON.stringify({ updatedAt, id })).toString("base64url"); }
export interface Settings extends Versioned {
  officeId: string | null; officeTimezone: string | null; enabledReads: string[];
  policyReference: string; missingClockInMinutes: number | null; missingClockOutMinutes: number | null;
}
export interface Investigation extends Versioned {
  visitId: string; title: string; assignee: string; followUpAt: string | null;
  status: "open" | "in_progress" | "resolved";
  events: { actor: string; at: string; action: string; note: string }[];
}
export interface WriteIntent extends Versioned {
  recovery?: WriteRecovery;
  visitId: string; kind: "visit_correction_review" | "schedule_change_review" | "caregiver_rate_review";
  rationale: string; proposed: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected" | "cancelled";
  preparation?: { operation: "UpdateCaregiverRate"; caregiverId: string; rateId: string; before: Record<string, string | null>; proposedHourlyRate: string; fetchedAt: string; checkedAt: string | null; sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable" };
  execution?: { vendorRecordId?: string; attemptId: string; actor: string; startedAt: string; result: "submitting" | "acknowledged" | "unknown" | "not_submitted"; reconciliation: "not_checked" | "matches_proposal" | "matched_returned_fields" | "source_unchanged" | "different" | "unavailable"; checkedAt: string | null };
}
export interface WorkspaceRepository {
  get<T extends Versioned>(collection: string, id: string): Promise<T | null>;
  list<T extends Versioned>(collection: string): Promise<T[]>;
  page<T extends Versioned>(collection: string, cursor?: string): Promise<WorkspacePage<T>>;
  change<T extends Versioned>(collection: string, id: string, expected: number, actor: string, action: string, update: (prior: T | null) => T): Promise<T>;
  reserveRead(): Promise<void>;
  deferReads(seconds: number): Promise<void>;
  getWriteTarget(target: string): Promise<{ active: boolean; proposalId: string; updatedAt: string } | null>;
  reserveWriteTarget(target: string, proposalId: string): Promise<void>;
  releaseWriteTarget(target: string, proposalId: string): Promise<void>;
}
export class FirestoreWorkspaceRepository implements WorkspaceRepository {
  constructor(private db = getFirestore()) {}
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> {
    const result = await this.db.collection(collection).doc(id).get();
    return result.exists ? result.data() as T : null;
  }
  async list<T extends Versioned>(collection: string): Promise<T[]> {
    const result = await this.db.collection(collection).orderBy("updatedAt", "desc").limit(100).get();
    return result.docs.map(doc => doc.data() as T);
  }
  async page<T extends Versioned>(collection: string, cursor?: string): Promise<WorkspacePage<T>> {
    let query = this.db.collection(collection).orderBy("updatedAt", "desc").orderBy(FieldPath.documentId(), "desc").limit(101);
    const boundary = workspaceCursor(cursor);
    if (boundary) query = query.startAfter(boundary.updatedAt, boundary.id);
    const snapshot = await query.get(), docs = snapshot.docs.slice(0, 100), last = docs.at(-1);
    return { items: docs.map(doc => doc.data() as T), nextCursor: snapshot.size > 100 && last ? nextWorkspaceCursor(last.data().updatedAt, last.id) : null };
  }
  async change<T extends Versioned>(collection: string, id: string, expected: number, actor: string, action: string, update: (prior: T | null) => T): Promise<T> {
    return this.db.runTransaction(async tx => {
      const ref = this.db.collection(collection).doc(id), snapshot = await tx.get(ref);
      const prior = snapshot.exists ? snapshot.data() as T : null;
      if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
      const next = update(prior);
      tx.set(ref, next);
      const auditId = randomUUID();
      tx.create(this.db.collection("workspaceAudit").doc(auditId), { id: auditId, updatedAt: next.updatedAt, actor, action, entityId: id, collection, revision: next.revision });
      return next;
    });
  }
  async reserveRead(): Promise<void> {
    // Shared across instances, with conservative headroom under vendor limits.
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("integrationLimits").doc("interactive_reads"), snapshot = await tx.get(ref);
      const minute = Math.floor(Date.now() / 60000), prior = snapshot.data();
      const nextAllowedAt = Number(prior?.nextAllowedAt ?? 0);
      if (nextAllowedAt > Date.now()) throw new WorkflowError("vendor_backoff_active", 429, Math.ceil((nextAllowedAt - Date.now()) / 1000));
      const count = prior?.minute === minute ? Number(prior.count) : 0;
      if (count >= 60) throw new WorkflowError("read_budget_exhausted_retry_next_minute", 429, 60 - Math.floor(Date.now() / 1000) % 60);
      tx.set(ref, { minute, count: count + 1, nextAllowedAt: prior?.nextAllowedAt ?? 0 });
    });
  }
  async getWriteTarget(target: string) {
    const snapshot = await this.db.collection("sourceWriteLocks").doc(target).get();
    return snapshot.exists ? snapshot.data() as { active: boolean; proposalId: string; updatedAt: string } : null;
  }
  async reserveWriteTarget(target: string, proposalId: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("sourceWriteLocks").doc(target), prior = await tx.get(ref);
      if (prior.data()?.active) throw new WorkflowError("source_target_locked_reconciliation_required", 409);
      tx.set(ref, { active: true, proposalId, updatedAt: new Date().toISOString() });
    });
  }
  async releaseWriteTarget(target: string, proposalId: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("sourceWriteLocks").doc(target), prior = await tx.get(ref);
      if (prior.data()?.active && prior.data()?.proposalId === proposalId) tx.set(ref, { ...prior.data(), active: false, updatedAt: new Date().toISOString() });
    });
  }
  async deferReads(seconds: number): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("integrationLimits").doc("interactive_reads"), snapshot = await tx.get(ref);
      tx.set(ref, { nextAllowedAt: Math.max(snapshot.data()?.nextAllowedAt ?? 0, Date.now() + seconds * 1000) }, { merge: true });
    });
  }
}
const defaults = (): Settings => ({ id: "owner", revision: 0, updatedAt: "", officeId: null, officeTimezone: null, enabledReads: [], policyReference: "", missingClockInMinutes: null, missingClockOutMinutes: null });
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_request");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 2000, required = true): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new WorkflowError("invalid_text");
  return value.trim();
}
function revision(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new WorkflowError("invalid_revision");
  return Number(value);
}
function followUp(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new WorkflowError("invalid_follow_up");
  return value;
}
function documentId(value: unknown): string {
  const id = text(value, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new WorkflowError("invalid_document_id");
  return id;
}
export class OperationsWorkspace {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput, projectionScope?: "document_metadata" | "clinical_review" | "medical_review" | "write_recovery") => Promise<OperationalRead>, private dataApproved: boolean, private rateWrite?: { approved: boolean; submit: (before: Record<string, string | null>, hourlyRate: string) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private elapsedClock: () => number = () => performance.now(), private availabilityWrite?: { enabled: readonly AvailabilityOperation[]; submit: (operation: AvailabilityOperation, facts: Record<string, string | null>) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private documentTypeWrite?: { approved: boolean; submit: (facts: Record<string, string | null>) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private topicWrite?: { approved: boolean; submit: (facts: Record<string, string | null>) => Promise<TopicSubmission> }, private rateCreationWrite?: { approved: boolean; submit: (facts: Record<string, string | null>) => Promise<RateCreationSubmission> }, private patientContractWrite?: { approved: boolean; submit: (facts: Record<string, string | null>) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private availabilityCreationWrite?: { enabled: readonly AvailabilityCreationOperation[]; submit: (facts: Record<string, string | null>) => Promise<AvailabilityCreationSubmission> }, private patientNoteWrite?: { approved: boolean; submit: (facts: Record<string, string | null>) => Promise<PatientNoteSubmission> }, private documentMetadataWrite?: { enabled: readonly DocumentMetadataOperation[]; submit: (facts: Record<string, string | null>, base64: string) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private patientClinicalWrite?: { approved: boolean; submit: (facts: Record<string, string | null>) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private medicalCreationWrite?: { approved: boolean; submit: (facts: Record<string, string | null>) => Promise<MedicalCreationSubmission> }, private documentReplacementWrite?: { enabled: readonly DocumentReplacementOperation[]; submit: (facts: Record<string, string | null>, base64: string) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private documentCreationWrite?: { enabled: readonly DocumentCreationOperation[]; submit: (facts: Record<string, string | null>, base64: string) => Promise<DocumentCreationSubmission> }, private caregiverPictureWrite?: { approved: boolean; submit: (facts: Record<string, string | null>, base64: string) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private contractCreationWrite?: { approved: boolean; submit: (facts: Record<string,string|null>) => Promise<ContractCreationSubmission> }, private referralCreationWrite?: { approved: boolean; submit: (facts: Record<string,string|null>) => Promise<ReferralCreationSubmission> }, private collectionNoteWrite?: { approved: boolean; submit: (facts: Record<string,string|null>) => Promise<CollectionNoteSubmission> }, private linkedScheduleCreationWrite?: { approved: boolean; submit: (facts: Record<string,string|null>) => Promise<LinkedScheduleCreationSubmission> }) {}
  private requireData() { if (!this.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423); }
  async settings() { return { settings: await this.repository.get<Settings>("workspaceSettings", "owner") ?? defaults(), dataApproved: this.dataApproved, linkedScheduleCreationWritesEnabled: this.dataApproved && this.linkedScheduleCreationWrite?.approved === true, collectionNoteWritesEnabled: this.dataApproved && this.collectionNoteWrite?.approved === true, referralCreationWritesEnabled: this.dataApproved && this.referralCreationWrite?.approved === true, contractCreationWritesEnabled: this.dataApproved && this.contractCreationWrite?.approved === true, caregiverPictureWritesEnabled: this.dataApproved && this.caregiverPictureWrite?.approved === true, documentCreationWrites: this.dataApproved ? this.documentCreationWrite?.enabled ?? [] : [], documentReplacementWrites: this.dataApproved ? this.documentReplacementWrite?.enabled ?? [] : [], medicalCreationWritesEnabled: this.dataApproved && this.medicalCreationWrite?.approved === true, patientClinicalWritesEnabled: this.dataApproved && this.patientClinicalWrite?.approved === true, documentMetadataWrites: this.dataApproved ? this.documentMetadataWrite?.enabled ?? [] : [], patientNoteWritesEnabled: this.dataApproved && this.patientNoteWrite?.approved === true, availabilityCreationWrites: this.dataApproved ? this.availabilityCreationWrite?.enabled ?? [] : [], patientContractWritesEnabled: this.dataApproved && this.patientContractWrite?.approved === true, rateCreationWritesEnabled: this.dataApproved && this.rateCreationWrite?.approved === true, topicWritesEnabled: this.dataApproved && this.topicWrite?.approved === true, documentTypeWritesEnabled: this.dataApproved && this.documentTypeWrite?.approved === true, writesEnabled: this.dataApproved && this.rateWrite?.approved === true, availabilityWrites: this.dataApproved ? this.availabilityWrite?.enabled ?? [] : [], supportedReads: READ_OPERATIONS.filter(op => !vendorContractBlocked(op)), contractOnlyReads: READ_OPERATIONS.filter(vendorContractBlocked), readInputs: Object.fromEntries(READ_OPERATIONS.map(op => [op, readInputFields(op)])) }; }
  async saveSettings(value: unknown, actor: string) {
    const input = object(value), allowed = ["revision", "officeId", "officeTimezone", "enabledReads", "policyReference", "missingClockInMinutes", "missingClockOutMinutes"];
    if (Object.keys(input).some(key => !allowed.includes(key))) throw new WorkflowError("unsupported_setting");
    const officeId = input.officeId === null || input.officeId === "" ? null : identifier(input.officeId);
    const timezone = input.officeTimezone === null || input.officeTimezone === "" ? null : text(input.officeTimezone, 80);
    if (timezone) { try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { throw new WorkflowError("invalid_timezone"); } }
    if (!Array.isArray(input.enabledReads) || input.enabledReads.some(op => !READ_OPERATIONS.includes(op))) throw new WorkflowError("unsupported_read");
    const enabledReads = [...new Set(input.enabledReads as string[])];
    if (enabledReads.some(vendorContractBlocked)) throw new WorkflowError("vendor_contract_clarification_required", 423);
    const policyReference = text(input.policyReference, 300, false);
    const needsOffice = enabledReads.some(operation => operation !== "GetOfficesV2");
    if ((enabledReads.length && !policyReference) || (needsOffice && (!officeId || !timezone))) throw new WorkflowError("office_timezone_and_review_reference_required");
    const threshold = (value: unknown): number | null => { if (value === null || value === "") return null; if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1440) throw new WorkflowError("invalid_threshold"); return value; };
    const missingClockInMinutes = threshold(input.missingClockInMinutes), missingClockOutMinutes = threshold(input.missingClockOutMinutes);
    return this.repository.change<Settings>("workspaceSettings", "owner", revision(input.revision), actor, "settings_saved", prior => ({ id: "owner", revision: (prior?.revision ?? 0) + 1, updatedAt: new Date().toISOString(), officeId, officeTimezone: timezone, enabledReads, policyReference, missingClockInMinutes, missingClockOutMinutes }));
  }
  async query(value: unknown, actor: string, projectionScope?: "document_metadata" | "clinical_review" | "medical_review" | "write_recovery") {
    this.requireData();
    const input = object(value) as ReadInput;
    if (!READ_OPERATIONS.includes(input.operation)) throw new WorkflowError("unsupported_read");
    if (vendorContractBlocked(input.operation)) throw new WorkflowError("vendor_contract_clarification_required", 423);
    const { settings } = await this.settings();
    if (!settings.enabledReads.includes(input.operation)) throw new WorkflowError("read_not_owner_enabled", 423);
    if (OFFICE_SCOPED_READS.includes(input.operation) && input.officeId !== settings.officeId) throw new WorkflowError("office_scope_mismatch", 403);
    await this.repository.reserveRead();
    const id = randomUUID();
    await this.repository.change("readRequests", id, 0, actor, "read_requested_" + input.operation, () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: input.operation }));
    try { return await this.read(input, projectionScope); }
    catch (error) {
      if (error instanceof WorkflowError && error.retryAfterSeconds) await this.repository.deferReads(error.retryAfterSeconds);
      throw error;
    }
  }
  async investigations() { this.requireData(); return this.repository.list<Investigation>("investigations"); }
  async reviewSchedule(value: unknown, actor: string) {
    this.requireData(); const input = object(value);
    if (Object.keys(input).some(key => !["visitId", "kind"].includes(key)) || !["standard", "linked"].includes(String(input.kind))) throw new WorkflowError("explicit_schedule_review_kind_required");
    const visitId = identifier(input.visitId), operation = input.kind === "linked" ? "GetLinkedScheduleInfo" : "GetScheduleInfo";
    const schedule = await this.query({ operation, id: visitId }, actor);
    if (schedule.truncated || schedule.records.length !== 1 || schedule.records[0]?.ID !== visitId) throw new WorkflowError("unique_schedule_review_source_required", 409);
    const facts = schedule.records[0]!, patientId = identifier(facts["Patient/ID"]);
    const { settings } = await this.settings();
    if (!settings.officeId) throw new WorkflowError("office_scope_required", 409);
    const patient = await this.query({ operation: "GetPatientDemographics", id: patientId }, actor);
    if (patient.truncated || patient.records.length !== 1 || patient.records[0]?.PatientID !== patientId || patient.records[0]?.OfficeID !== settings.officeId) throw new WorkflowError("schedule_review_patient_office_mismatch", 403);
    const sources: OperationalRead[] = [schedule];
    const unresolved = input.kind === "linked" ? ["Persisted ScheduleType and Comments are absent from linked-schedule readback; no inferred preservation or complete reconciliation."] : ["Edit-reason/note behavior and complete field preservation still require the typed UpdateSchedule workflow; this review cannot execute it."];
    if (input.kind === "standard") {
      const [visit, billing] = await Promise.all([this.query({ operation: "GetVisitInfoV2", id: visitId }, actor), this.query({ operation: "GetVisitBillInfoV2", id: visitId }, actor)]);
      for (const source of [visit, billing]) if (source.truncated || source.records.length !== 1 || source.records[0]?.ID !== visitId || source.records[0]?.["Patient/ID"] !== patientId) throw new WorkflowError("schedule_review_evidence_identity_mismatch", 409);
      for (const key of ["VisitDate", "Caregiver/ID", "ScheduleStartTime", "ScheduleEndTime"]) if (facts[key] == null || visit.records[0]![key] !== facts[key]) throw new WorkflowError("schedule_review_source_changed_or_incomplete", 409);
      sources.push(visit, billing);
    }
    return { state: "review_only", visitId, kind: input.kind, officeId: settings.officeId, sources, unresolved, submissionAvailable: false, caution: "Independent source reads are not an atomic snapshot. Null means unknown; actual EVV, payroll and billing evidence is preserved and never recalculated." };
  }
  async reviewVisits(value: unknown, actor: string) {
    this.requireData(); const input = object(value);
    if (Object.keys(input).some(key => key !== "visitIds") || !Array.isArray(input.visitIds) || input.visitIds.length < 1 || input.visitIds.length > 10) throw new WorkflowError("select_one_to_ten_visits");
    const ids = [...new Set(input.visitIds.map(identifier))];
    const visits: { visitId: string; state: "reviewed" | "unavailable"; fetchedAt: string | null; flags: string[]; facts: Record<string, string | null> | null; error: string | null }[] = [];
    const started = this.elapsedClock();
    for (const visitId of ids) {
      // Leave a full 20-second vendor timeout plus response/storage headroom
      // inside the function's 60-second deadline. Never hide unattempted visits.
      if (this.elapsedClock() - started >= 25_000) {
        for (const pending of ids.slice(visits.length)) visits.push({ visitId: pending, state: "unavailable", fetchedAt: null, flags: [], facts: null, error: "not_attempted_batch_time_budget" });
        break;
      }
      try {
        const source = await this.query({ operation: "GetVisitInfoV3", id: visitId }, actor);
        const matches = source.records.filter(row => row.ID === visitId);
        if (source.truncated || matches.length !== 1) throw new WorkflowError("visit_not_uniquely_returned", 502);
        const facts = matches[0]!, flags: string[] = [];
        if (!facts.EVVStartTime) flags.push("EVV clock-in not supplied; investigate source evidence");
        if (!facts.EVVEndTime) flags.push("EVV clock-out not supplied; investigate source evidence");
        if (facts.VisitStartTime && !facts.EVVStartTime || facts.VisitEndTime && !facts.EVVEndTime) flags.push("Visit times do not establish EVV clock evidence");
        visits.push({ visitId, state: "reviewed", fetchedAt: source.fetchedAt, flags, facts, error: null });
      } catch (error) {
        visits.push({ visitId, state: "unavailable", fetchedAt: null, flags: [], facts: null, error: error instanceof WorkflowError ? error.code : "visit_review_unavailable" });
        // Stop the batch on backoff or changed permissions; do not hammer the vendor.
        if (error instanceof WorkflowError && [429, 403, 423].includes(error.status)) {
          for (const pending of ids.slice(visits.length)) visits.push({ visitId: pending, state: "unavailable", fetchedAt: null, flags: [], facts: null, error: "not_attempted_after_batch_gate" });
          break;
        }
      }
    }
    return { visits, state: visits.some(row => row.state === "unavailable") ? "partial" : "complete", policyEvaluated: false, sourceValidated: false };
  }
  async availability(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const workflow = new AvailabilityWorkflow(this.repository, input => this.query(input, actor), async () => (await this.settings()).settings.officeId, this.availabilityWrite, this.elapsedClock);
    return workflow[action](value, actor);
  }
  async reviewStaffing(value: unknown, actor: string) {
    this.requireData(); const input = object(value);
    if (Object.keys(input).some(key => !["patientId", "officeId", "date", "caregiverIds"].includes(key)) || !Array.isArray(input.caregiverIds) || input.caregiverIds.length < 1 || input.caregiverIds.length > 3) throw new WorkflowError("select_one_to_three_caregivers");
    const patientId = identifier(input.patientId), officeId = identifier(input.officeId), date = input.date as string;
    const caregiverIds = [...new Set(input.caregiverIds.map(identifier))];
    // Validate the discovery scope before making any source requests.
    readRequest({ operation: "SearchVisitsV2", officeId, date });
    if ((await this.settings()).settings.officeId !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    const started = this.elapsedClock(); let deferred = false;
    const evidence: { subject: string; operation: string; source: OperationalRead | null; error: string | null }[] = [];
    const readEvidence = async (subject: string, request: ReadInput) => {
      if (deferred || this.elapsedClock() - started >= 25_000) {
        evidence.push({ subject, operation: request.operation, source: null, error: deferred ? "not_attempted_vendor_backoff" : "not_attempted_batch_time_budget" }); return;
      }
      try { evidence.push({ subject, operation: request.operation, source: await this.query(request, actor), error: null }); }
      catch (error) {
        if (error instanceof WorkflowError && error.status === 429) deferred = true;
        evidence.push({ subject, operation: request.operation, source: null, error: error instanceof WorkflowError ? error.code : "staffing_evidence_unavailable" });
      }
    };
    await readEvidence(`patient:${patientId}`, { operation: "GetPatientPreferences", patientId });
    await readEvidence(`patient:${patientId}`, { operation: "GetPatientDeclinedCaregivers", patientId });
    for (const id of caregiverIds) {
      for (const operation of ["GetCaregiverPreferences", "GetCaregiverPermanentWeekAvailability", "GetCaregiverSpecialAvailability"] as const) await readEvidence(`caregiver:${id}`, { operation, id });
      await readEvidence(`caregiver:${id}`, { operation: "SearchVisitsV2", officeId, date, caregiverId: id });
    }
    return { patientId, officeId, date, caregiverIds, evidence, state: evidence.some(item => item.error || item.source?.truncated) ? "partial" : "complete", eligibility: "not_determined", rankingApplied: false, assignmentChanged: false, warning: "Selected-day visit IDs do not establish overlapping shifts, free capacity or travel feasibility. Review patient choice, declines, source availability and verified schedule details before a human assignment." };
  }
  async page<T extends Versioned>(collection: "investigations" | "writeIntents" | "workspaceAudit" | "availabilityChanges" | "documentTypeChanges" | "topicChanges" | "rateCreations" | "patientContractChanges" | "availabilityCreations" | "patientNoteChanges" | "documentMetadataChanges" | "patientClinicalChanges" | "medicalCreations" | "documentReplacementChanges" | "documentCreationChanges" | "caregiverPictureChanges" | "contractCreations" | "referralCreations" | "collectionNoteChanges" | "linkedScheduleCreations", query: unknown): Promise<WorkspacePage<T>> {
    this.requireData();
    const input = object(query ?? {});
    if (Object.keys(input).some(key => key !== "cursor")) throw new WorkflowError("invalid_page_query");
    workspaceCursor(input.cursor);
    return this.repository.page<T>(collection, typeof input.cursor === "string" ? input.cursor : undefined);
  }
  async saveInvestigation(value: unknown, actor: string) {
    this.requireData(); const input = object(value), id = documentId(input.id), expected = revision(input.revision);
    const status = input.status;
    if (!["open", "in_progress", "resolved"].includes(String(status))) throw new WorkflowError("invalid_status");
    const note = text(input.note), visitId = identifier(input.visitId), title = text(input.title, 160), assignee = text(input.assignee, 128, false), followUpAt = followUp(input.followUpAt);
    return this.repository.change<Investigation>("investigations", id, expected, actor, "investigation_updated", prior => {
      if (prior && prior.visitId !== visitId) throw new WorkflowError("visit_reference_immutable");
      if ((prior?.events.length ?? 0) >= 50) throw new WorkflowError("investigation_history_limit_reached", 409);
      const at = new Date().toISOString();
      return { id, revision: expected + 1, updatedAt: at, visitId, title, assignee, followUpAt, status: status as Investigation["status"], events: [...(prior?.events ?? []), { actor, at, action: String(status), note }] };
    });
  }
  async intents() { this.requireData(); return this.repository.list<WriteIntent>("writeIntents"); }
  async prepareRate(value: unknown, actor: string) {
    this.requireData(); const input = object(value);
    if (Object.keys(input).some(key => !["id", "caregiverId", "rateId", "hourlyRate", "rationale"].includes(key))) throw new WorkflowError("unsupported_proposal_field");
    const id = documentId(input.id), caregiverId = identifier(input.caregiverId), rateId = identifier(input.rateId), rationale = text(input.rationale);
    const rate = input.hourlyRate;
    if (typeof rate !== "string" || !/^\d{1,6}(?:\.\d{1,4})?$/.test(rate)) throw new WorkflowError("invalid_rate_decimal");
    if (await this.repository.get("writeIntents", id)) throw new WorkflowError("revision_conflict", 409);
    const source = await this.query({ operation: "GetCaregiverRates", id: caregiverId }, actor);
    const matches = source.records.filter(record => record.CaregiverRateID === rateId && record.CaregiverID === caregiverId);
    if (source.truncated || matches.length !== 1 || matches[0]?.HourlyRate === null) throw new WorkflowError("source_rate_not_uniquely_verified", 409);
    const before = matches[0]!;
    return this.repository.change<WriteIntent>("writeIntents", id, 0, actor, "caregiver_rate_prepared", () => ({
      id, revision: 1, updatedAt: new Date().toISOString(), visitId: "", kind: "caregiver_rate_review", rationale,
      proposed: `Hourly rate proposal: ${rate}. Currency, effective dates and the complete write contract still require review.`, requestedBy: actor, reviewedBy: null, state: "pending_review",
      preparation: { operation: "UpdateCaregiverRate", caregiverId, rateId, before, proposedHourlyRate: rate, fetchedAt: source.fetchedAt, checkedAt: null, sourceCheck: "not_rechecked" },
    }));
  }
  async recheckRate(value: unknown, actor: string) {
    this.requireData(); const input = object(value), id = documentId(input.id), expected = revision(input.revision);
    if (Object.keys(input).some(key => !["id", "revision"].includes(key))) throw new WorkflowError("unsupported_proposal_field");
    const prior = await this.repository.get<WriteIntent>("writeIntents", id);
    if (!prior?.preparation || prior.preparation.operation !== "UpdateCaregiverRate") throw new WorkflowError("prepared_rate_required", 404);
    if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    if (prior.revision !== expected) throw new WorkflowError("revision_conflict", 409);
    let source: OperationalRead | null = null;
    try { source = await this.query({ operation: "GetCaregiverRates", id: prior.preparation.caregiverId }, actor); }
    catch (error) { if (!(error instanceof WorkflowError) || ![429, 502, 503].includes(error.status)) throw error; }
    const matches = source?.records.filter(row => row.CaregiverRateID === prior.preparation!.rateId && row.CaregiverID === prior.preparation!.caregiverId) ?? [];
    const canonical = (row: Record<string, string | null>) => JSON.stringify(Object.keys(row).sort().map(key => [key, row[key]]));
    const sourceCheck = !source || source.truncated || matches.length !== 1 ? "unavailable" : canonical(matches[0]!) === canonical(prior.preparation.before) ? "unchanged" : "changed";
    return this.repository.change<WriteIntent>("writeIntents", id, expected, actor, "caregiver_rate_rechecked", current => ({
      ...current!, revision: expected + 1, updatedAt: new Date().toISOString(),
      preparation: { ...current!.preparation!, checkedAt: source?.fetchedAt ?? new Date().toISOString(), sourceCheck },
    }));
  }
  async createRate(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    return new RateCreationWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.rateCreationWrite, this.elapsedClock)[action](value, actor);
  }
  async topic(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    return new TopicWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.topicWrite, this.elapsedClock)[action](value, actor);
  }
  async createMedical(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new MedicalCreationWorkflow(this.repository, input => this.query(input, actor, "medical_review"), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.medicalCreationWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async patientClinical(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new PatientClinicalWorkflow(this.repository, input => this.query(input, actor, "clinical_review"), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.patientClinicalWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async collectionNote(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new CollectionNoteWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.collectionNoteWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async createLinkedSchedule(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new LinkedScheduleCreationWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.linkedScheduleCreationWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async createReferral(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new ReferralCreationWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.referralCreationWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async createContract(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new ContractCreationWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.contractCreationWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async caregiverPicture(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new CaregiverPictureWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.caregiverPictureWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async documentCreation(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new DocumentCreationWorkflow(this.repository, input => this.query(input, actor, "document_metadata"), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.documentCreationWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async documentReplacement(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new DocumentReplacementWorkflow(this.repository, input => this.query(input, actor, "document_metadata"), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.documentReplacementWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async documentMetadata(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new DocumentMetadataWorkflow(this.repository, input => this.query(input, actor, "document_metadata"), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.documentMetadataWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async patientNote(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new PatientNoteWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.patientNoteWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async createAvailability(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new AvailabilityCreationWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.availabilityCreationWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async patientContract(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new PatientContractWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.patientContractWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async documentType(action: "prepare" | "recheck" | "review" | "execute" | "reconcile", value: unknown, actor: string) {
    this.requireData();
    const flow = new DocumentTypeWorkflow(this.repository, input => this.query(input, actor), async () => (await this.repository.get<Settings>("workspaceSettings", "owner"))?.officeId ?? null, this.documentTypeWrite, this.elapsedClock);
    return flow[action](value, actor);
  }
  async recoverWrite(action: "prepare" | "approve", value: unknown, actor: string) {
    this.requireData();
    return new WriteRecoveryWorkflow(this.repository, input => this.query(input, actor, "write_recovery")).handle(action, value, actor);
  }
  async executeRate(value: unknown, actor: string) {
    this.requireData();
    const started = this.elapsedClock();
    if (!this.rateWrite?.approved) throw new WorkflowError("rate_write_release_not_approved", 423);
    const input = object(value), id = documentId(input.id), expected = revision(input.revision);
    if (Object.keys(input).some(key => !["id", "revision"].includes(key))) throw new WorkflowError("unsupported_proposal_field");
    const prior = await this.repository.get<WriteIntent>("writeIntents", id);
    if (!prior?.preparation || prior.revision !== expected || prior.state !== "approved") throw new WorkflowError("approved_current_rate_proposal_required", 409);
    if (actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = `rate_${prior.preparation.caregiverId}_${prior.preparation.rateId}`;
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    const source = await this.query({ operation: "GetCaregiverRates", id: prior.preparation.caregiverId }, actor);
    const rows = source.records.filter(row => row.CaregiverRateID === prior.preparation!.rateId && row.CaregiverID === prior.preparation!.caregiverId);
    if (source.truncated || rows.length !== 1 || !sameSourceFacts(rows[0]!, prior.preparation.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    rateWriteRequest(prior.preparation.before, prior.preparation.proposedHourlyRate);
    await this.repository.reserveRead(); // Writes consume the same shared vendor-call budget.
    if (this.elapsedClock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<WriteIntent>("writeIntents", id, expected, actor, "rate_write_attempt_started", current => {
      if (current?.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
      return { ...current!, revision: expected + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } };
    });
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.rateWrite.submit(attempt.preparation!.before, attempt.preparation!.proposedHourlyRate); }
    catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<WriteIntent>("writeIntents", id, attempt.revision, actor, "rate_write_result_recorded", current => ({ ...current!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...current!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    // The submission outcome is durable. A separate read-only request can
    // reconcile it without risking another 20-second call at this deadline.
    if (this.elapsedClock() - started >= 25_000) return recorded;
    return this.reconcileRate({ id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcileRate(value: unknown, actor: string) {
    this.requireData(); const input = object(value), id = documentId(input.id), expected = revision(input.revision);
    if (Object.keys(input).some(key => !["id", "revision"].includes(key))) throw new WorkflowError("unsupported_proposal_field");
    const prior = await this.repository.get<WriteIntent>("writeIntents", id);
    if (!prior?.preparation || !prior.execution || prior.revision !== expected) throw new WorkflowError("attempted_current_rate_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<WriteIntent["execution"]>["reconciliation"] = "unavailable";
    try {
      const source = await this.query({ operation: "GetCaregiverRates", id: prior.preparation.caregiverId }, actor);
      const rows = source.records.filter(row => row.CaregiverRateID === prior.preparation!.rateId && row.CaregiverID === prior.preparation!.caregiverId);
      if (!source.truncated && rows.length === 1) {
        const row = rows[0]!, before = prior.preparation.before;
        if (sameSourceFacts({ ...row, HourlyRate: before.HourlyRate ?? null }, before) && sameDecimal(row.HourlyRate, prior.preparation.proposedHourlyRate)) reconciliation = "matches_proposal";
        else reconciliation = sameSourceFacts(row, before) ? "source_unchanged" : "different";
      }
    } catch { /* Preserve an explicit unavailable check; never retain a prior success. */ }
    const reconciled = await this.repository.change<WriteIntent>("writeIntents", id, expected, actor, "rate_write_reconciled", current => ({
      ...current!, revision: expected + 1, updatedAt: new Date().toISOString(),
      execution: { ...current!.execution!, result: current!.execution!.result === "submitting" ? "unknown" : current!.execution!.result, reconciliation, checkedAt: new Date().toISOString() },
    }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(`rate_${prior.preparation.caregiverId}_${prior.preparation.rateId}`, prior.id);
    return reconciled;
  }
  async saveIntent(value: unknown, actor: string) {
    this.requireData(); const input = object(value), id = documentId(input.id), expected = revision(input.revision);
    return this.repository.change<WriteIntent>("writeIntents", id, expected, actor, "write_intent_reviewed", prior => {
      const base = { id, revision: expected + 1, updatedAt: new Date().toISOString() };
      if (!prior) {
        if (!["visit_correction_review", "schedule_change_review"].includes(String(input.kind))) throw new WorkflowError("unsupported_intent");
        return { ...base, kind: input.kind as WriteIntent["kind"], visitId: identifier(input.visitId), rationale: text(input.rationale), proposed: text(input.proposed), requestedBy: actor, reviewedBy: null, state: "pending_review" };
      }
      if (prior.state !== "pending_review") throw new WorkflowError("intent_already_reviewed", 409);
      if (!["approved", "rejected", "cancelled"].includes(String(input.state))) throw new WorkflowError("invalid_review");
      if (input.state !== "cancelled" && actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
      if (input.state === "approved" && prior.preparation && prior.preparation.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
      if (input.state === "cancelled" && actor !== prior.requestedBy) throw new WorkflowError("requester_required", 403);
      return { ...prior, ...base, reviewedBy: actor, state: input.state as WriteIntent["state"] };
    });
  }
  async audit() { this.requireData(); return this.repository.list<Versioned>("workspaceAudit"); }
}
