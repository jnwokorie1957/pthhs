import { Buffer } from "node:buffer";
import type { Versioned, WorkspacePage, WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError, identifier } from "../operations/reads.js";

export type RevisionResource = "requirements" | "callMatches" | "exceptions";
export interface RevisionContext { officeId: string; actorId: string; roles: readonly string[]; dataApproved: boolean; mode: "demo" | "live"; }
export interface RecordEvent { actorId: string; at: string; action: string; note: string; revision: number; }
export interface ScopedRecord extends Versioned { officeId: string; events: RecordEvent[]; }
export interface SubjectReference { kind: "member" | "caregiver"; id: string; }
export type RequirementType = "supervisory_visit" | "initial_orientation" | "recurring_orientation";
export interface CompletionEvidence {
  id: string; completedOn: string; performedBy: string; documentReference: string; note: string;
  forDueDate: string; scheduledDueDate: string; overrideReason: string; ruleReference: string;
  recordedBy: string; recordedAt: string; reviewState: "pending_review" | "accepted" | "rejected";
  reviewedBy: string | null; reviewedAt: string | null; reviewNote: string | null;
}
export interface RequirementRecord extends ScopedRecord {
  type: RequirementType; subject: SubjectReference; program: string; service: string; assignedSupervisor: string;
  ruleReference: string; cadenceMonths: number | null; anchorMode: "fixed_due_date" | "completion_date";
  anchorDate: string; effectiveFrom: string; effectiveUntil: string | null;
  overrideDueDate: string | null; overrideReason: string; nextDueDate: string | null; completions: CompletionEvidence[];
}
export interface CallCandidate { callId: string; sourceHash: string; callTime: string | null; callType: string | null; caregiverId: string | null; patientId: string | null; }
export interface CallMatchRecord extends ScopedRecord {
  visitId: string; visitSourceHash: string; candidates: CallCandidate[];
  sourceScope?: { date: string; lastId: string; policyFingerprint: string } | null;
  sourceValidation: "source_unvalidated" | "accepted";
  state: "candidate" | "matched" | "ambiguous" | "unmatched" | "rejected" | "undone";
  matchedCallId: string | null; hhaVerification: "not_established";
  decisions: { action: "match" | "reject" | "undo"; callId: string | null; previousState: CallMatchRecord["state"]; previousCallId: string | null; actorId: string; at: string; reason: string }[];
}
export interface ExceptionReviewRecord extends ScopedRecord {
  visitId: string; ruleId: string; ruleVersion: string; sourceHash: string; diagnosis: string;
  sourceValidation: "accepted"; state: "open" | "acknowledged" | "in_review" | "resolved";
  assignee: string; followUpAt: string | null; acknowledgedBy: string | null; acknowledgedAt: string | null;
  hhaVerification: "not_established";
}

const COLLECTIONS = new Map<RevisionResource, string>([["requirements", "revisionRequirements"], ["callMatches", "revisionCallMatches"], ["exceptions", "revisionExceptions"]]);
const MAX_EVENTS = 256, MAX_COMPLETIONS = 100, MAX_CANDIDATES = 10, MAX_DECISIONS = 100;
function request(value: unknown, allowed: readonly string[], required: readonly string[] = allowed): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new WorkflowError("invalid_request");
  const input = value as Record<string, unknown>;
  if (Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowed.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(input, key) ?? {}, "value"))
    || required.some(key => !Object.hasOwn(input, key))) throw new WorkflowError("unsupported_record_field");
  try { if (Buffer.byteLength(JSON.stringify(input), "utf8") > 24576) throw new Error(); } catch { throw new WorkflowError("record_request_too_large"); }
  return input;
}
function text(value: unknown, max = 1000, optional = false): string {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (!optional && !value.trim())) throw new WorkflowError("invalid_record_text");
  return value.trim();
}
function id(value: unknown): string { const result = text(value, 128); if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new WorkflowError("invalid_record_id"); return result; }
function revision(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new WorkflowError("invalid_revision"); return value; }
function choice<T extends string>(value: unknown, options: readonly T[]): T { if (typeof value !== "string" || !options.includes(value as T)) throw new WorkflowError("invalid_record_state"); return value as T; }
function hash(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new WorkflowError("invalid_source_hash"); return value; }
export function calendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900 || !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) throw new WorkflowError("invalid_calendar_date");
  return value;
}
export function addCalendarMonths(value: string, months: number): string {
  calendarDate(value);
  if (!Number.isSafeInteger(months) || months < 0 || months > 12000) throw new WorkflowError("invalid_cadence");
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)) - 1, day = Number(value.slice(8, 10));
  const absolute = year * 12 + month + months, nextYear = Math.floor(absolute / 12), nextMonth = absolute % 12;
  if (nextYear > 9999) throw new WorkflowError("calendar_range_exceeded");
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
function timestamp(value: unknown): string | null {
  if (value === null) return null;
  const result = text(value, 40);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(result) || !Number.isFinite(Date.parse(result))) throw new WorkflowError("invalid_record_timestamp");
  calendarDate(result.slice(0, 10));
  return result;
}
function subject(value: unknown): SubjectReference { const input = request(value, ["kind", "id"]); return { kind: choice(input.kind, ["member", "caregiver"]), id: identifier(input.id) }; }
function same(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function scheduledDueDate(record: RequirementRecord): string | null {
  const accepted = record.completions.filter(item => item.reviewState === "accepted");
  if (record.type === "initial_orientation") return accepted.length ? null : record.anchorDate;
  if (record.cadenceMonths === null) return null;
  if (record.anchorMode === "completion_date") {
    const latest = accepted.at(-1);
    return latest ? addCalendarMonths(latest.completedOn, record.cadenceMonths) : record.anchorDate;
  }
  let due = record.anchorDate;
  // Use the original anchor for every period, avoiding Jan31 -> Feb28 -> Mar28 drift.
  for (let period = 0; period <= MAX_COMPLETIONS; period++) {
    due = addCalendarMonths(record.anchorDate, period * record.cadenceMonths);
    if (!accepted.some(item => item.scheduledDueDate === due)) return due;
  }
  throw new WorkflowError("completion_ledger_limit", 409);
}
export function requirementNextDue(record: RequirementRecord): string | null {
  const scheduled = scheduledDueDate(record);
  if (!scheduled) return null;
  const result = record.overrideDueDate ?? scheduled;
  return record.effectiveUntil && result > record.effectiveUntil ? null : result;
}
export function requirementStatus(record: RequirementRecord, asOfDate: string): "not_configured" | "upcoming" | "due" | "overdue" | "completed" | "evidence_under_review" | "outside_effective_period" {
  calendarDate(asOfDate);
  if (asOfDate < record.effectiveFrom || (record.effectiveUntil && asOfDate > record.effectiveUntil)) return "outside_effective_period";
  if (record.completions.some(item => item.reviewState === "pending_review")) return "evidence_under_review";
  const due = requirementNextDue(record);
  if (!due) return record.type === "initial_orientation" && record.completions.some(item => item.reviewState === "accepted") ? "completed" : "not_configured";
  return due < asOfDate ? "overdue" : due === asOfDate ? "due" : "upcoming";
}

export class RevisionRecords {
  private readonly context: RevisionContext;
  constructor(private readonly repository: Pick<WorkspaceRepository, "get" | "page" | "change">, context: RevisionContext, private readonly now: () => Date = () => new Date()) {
    this.context = Object.freeze({ officeId: identifier(context.officeId), actorId: text(context.actorId, 128), roles: Object.freeze([...context.roles]), dataApproved: context.dataApproved, mode: context.mode });
  }
  private gate() {
    if (this.context.mode !== "live") throw new WorkflowError("demo_record_actions_disabled", 423);
    if (this.context.dataApproved !== true) throw new WorkflowError("operational_data_release_not_approved", 423);
    if (!this.context.roles.some(role => role === "admin" || role === "office_supervisor")) throw new WorkflowError("revision_management_role_required", 403);
  }
  private collection(resource: RevisionResource): string {
    this.gate();
    const name = COLLECTIONS.get(resource);
    if (!name) throw new WorkflowError("unsupported_revision_resource");
    return name + "_office_" + this.context.officeId;
  }
  private office(value: unknown) { if (identifier(value) !== this.context.officeId) throw new WorkflowError("office_scope_mismatch", 403); }
  private scoped<T extends ScopedRecord>(record: T): T { this.office(record.officeId); return record; }
  private at(): string { const at = this.now(); if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw new WorkflowError("invalid_record_clock", 503); return at.toISOString(); }
  private event(prior: ScopedRecord | null, action: string, note: string, at: string): RecordEvent[] {
    if ((prior?.events.length ?? 0) >= MAX_EVENTS) throw new WorkflowError("record_history_limit", 409);
    return [...(prior?.events ?? []), { actorId: this.context.actorId, at, action, note, revision: (prior?.revision ?? 0) + 1 }];
  }
  private bounded<T extends ScopedRecord>(record: T): T { if (Buffer.byteLength(JSON.stringify(record), "utf8") > 262144) throw new WorkflowError("record_size_limit", 409); return record; }
  async get<T extends ScopedRecord>(resource: RevisionResource, value: unknown): Promise<T | null> {
    const record = await this.repository.get<T>(this.collection(resource), id(value));
    return record ? this.scoped(record) : null;
  }
  async page<T extends ScopedRecord>(resource: RevisionResource, value: unknown = {}): Promise<WorkspacePage<T>> {
    const collection = this.collection(resource), input = request(value, ["cursor"], []);
    let cursor: string | undefined;
    if (input.cursor !== undefined && input.cursor !== null && input.cursor !== "") {
      try {
        const token = text(input.cursor, 1500), decoded = request(JSON.parse(Buffer.from(token, "base64url").toString("utf8")), ["officeId", "resource", "cursor"]);
        this.office(decoded.officeId);
        if (decoded.resource !== resource) throw new WorkflowError("revision_cursor_scope_mismatch", 403);
        cursor = text(decoded.cursor, 400);
      } catch (error) { if (error instanceof WorkflowError && error.status === 403) throw error; throw new WorkflowError("invalid_revision_cursor"); }
    }
    const result = await this.repository.page<T>(collection, cursor);
    return { items: result.items.map(record => this.scoped(record)), nextCursor: result.nextCursor ? Buffer.from(JSON.stringify({ officeId: this.context.officeId, resource, cursor: result.nextCursor })).toString("base64url") : null };
  }
  async saveRequirement(value: unknown): Promise<RequirementRecord> {
    const collection = this.collection("requirements"), input = request(value, ["id", "revision", "officeId", "type", "subject", "program", "service", "assignedSupervisor", "ruleReference", "cadenceMonths", "anchorMode", "anchorDate", "effectiveFrom", "effectiveUntil", "overrideDueDate", "overrideReason", "note"]);
    this.office(input.officeId);
    const documentId = id(input.id), expected = revision(input.revision), type = choice<RequirementType>(input.type, ["supervisory_visit", "initial_orientation", "recurring_orientation"]), identity = subject(input.subject);
    const cadenceMonths = input.cadenceMonths === null ? null : input.cadenceMonths;
    if (cadenceMonths !== null && (typeof cadenceMonths !== "number" || !Number.isInteger(cadenceMonths) || cadenceMonths < 1 || cadenceMonths > 120)) throw new WorkflowError("invalid_cadence");
    if (type === "initial_orientation" && cadenceMonths !== null) throw new WorkflowError("initial_orientation_cannot_recur");
    const anchorDate = calendarDate(input.anchorDate), effectiveFrom = calendarDate(input.effectiveFrom), effectiveUntil = input.effectiveUntil === null ? null : calendarDate(input.effectiveUntil);
    if (anchorDate < effectiveFrom || (effectiveUntil && (effectiveUntil < effectiveFrom || anchorDate > effectiveUntil))) throw new WorkflowError("invalid_requirement_date_range");
    const overrideDueDate = input.overrideDueDate === null ? null : calendarDate(input.overrideDueDate), overrideReason = text(input.overrideReason, 500, true);
    if ((overrideDueDate === null) !== (overrideReason === "") || (overrideDueDate && (overrideDueDate < effectiveFrom || (effectiveUntil && overrideDueDate > effectiveUntil))) || (overrideDueDate && type !== "initial_orientation" && cadenceMonths === null)) throw new WorkflowError("documented_due_override_required");
    const fields = { type, subject: identity, program: text(input.program, 100), service: text(input.service, 100), assignedSupervisor: text(input.assignedSupervisor, 128, true), ruleReference: text(input.ruleReference, 500), cadenceMonths: cadenceMonths as number | null, anchorMode: choice(input.anchorMode, ["fixed_due_date", "completion_date"]), anchorDate, effectiveFrom, effectiveUntil, overrideDueDate, overrideReason };
    const note = text(input.note), at = this.at();
    return this.repository.change<RequirementRecord>(collection, documentId, expected, this.context.actorId, "revision_requirement_saved", prior => {
      if (prior) {
        this.scoped(prior);
        if (prior.type !== type || !same(prior.subject, identity)) throw new WorkflowError("requirement_subject_immutable", 409);
        if (prior.completions.length && ["program", "service", "ruleReference", "cadenceMonths", "anchorMode", "anchorDate", "effectiveFrom", "effectiveUntil"].some(key => !same(prior[key as keyof RequirementRecord], fields[key as keyof typeof fields]))) throw new WorkflowError("requirement_rule_with_evidence_immutable", 409);
      }
      const next: RequirementRecord = { ...fields, id: documentId, officeId: this.context.officeId, revision: expected + 1, updatedAt: at, completions: prior?.completions ?? [], nextDueDate: null, events: this.event(prior, "requirement_saved", note, at) };
      next.nextDueDate = requirementNextDue(next);
      return this.bounded(next);
    });
  }
  async recordCompletion(value: unknown): Promise<RequirementRecord> {
    const collection = this.collection("requirements"), input = request(value, ["id", "revision", "officeId", "completionId", "completedOn", "performedBy", "documentReference", "note"]);
    this.office(input.officeId);
    const documentId = id(input.id), expected = revision(input.revision), completionId = id(input.completionId), completedOn = calendarDate(input.completedOn), performedBy = text(input.performedBy, 128), documentReference = text(input.documentReference, 500), note = text(input.note), at = this.at();
    return this.repository.change<RequirementRecord>(collection, documentId, expected, this.context.actorId, "revision_completion_recorded", prior => {
      if (!prior) throw new WorkflowError("requirement_not_found", 404);
      this.scoped(prior);
      if (prior.completions.length >= MAX_COMPLETIONS) throw new WorkflowError("completion_ledger_limit", 409);
      if (prior.completions.some(item => item.id === completionId)) throw new WorkflowError("completion_identity_exists", 409);
      const scheduled = scheduledDueDate(prior), due = requirementNextDue(prior);
      if (!scheduled || !due) throw new WorkflowError("requirement_cadence_not_configured_or_completed", 409);
      if (completedOn < prior.effectiveFrom || (prior.effectiveUntil && completedOn > prior.effectiveUntil)) throw new WorkflowError("completion_outside_rule_dates");
      const completion: CompletionEvidence = { id: completionId, completedOn, performedBy, documentReference, note, forDueDate: due, scheduledDueDate: scheduled, overrideReason: prior.overrideReason, ruleReference: prior.ruleReference, recordedBy: this.context.actorId, recordedAt: at, reviewState: "pending_review", reviewedBy: null, reviewedAt: null, reviewNote: null };
      return this.bounded({ ...prior, revision: expected + 1, updatedAt: at, completions: [...prior.completions, completion], events: this.event(prior, "completion_recorded", note, at) });
    });
  }
  async reviewCompletion(value: unknown): Promise<RequirementRecord> {
    const collection = this.collection("requirements"), input = request(value, ["id", "revision", "officeId", "completionId", "action", "note"]);
    this.office(input.officeId);
    const documentId = id(input.id), expected = revision(input.revision), completionId = id(input.completionId), action = choice(input.action, ["accept", "reject"]), note = text(input.note), at = this.at();
    return this.repository.change<RequirementRecord>(collection, documentId, expected, this.context.actorId, "revision_completion_" + action, prior => {
      if (!prior) throw new WorkflowError("requirement_not_found", 404);
      this.scoped(prior);
      const completion = prior.completions.find(item => item.id === completionId);
      if (!completion) throw new WorkflowError("completion_not_found", 404);
      if (completion.reviewState !== "pending_review") throw new WorkflowError("completion_review_final", 409);
      if (action === "accept" && prior.completions.some(item => item.reviewState === "accepted" && item.scheduledDueDate === completion.scheduledDueDate)) throw new WorkflowError("requirement_period_already_completed", 409);
      if (action === "accept" && prior.type !== "initial_orientation" && prior.completions.some(item => item.reviewState === "accepted" && item.completedOn >= completion.completedOn)) throw new WorkflowError("completion_date_must_advance", 409);
      const next: RequirementRecord = { ...prior, revision: expected + 1, updatedAt: at,
        completions: prior.completions.map(item => item.id === completionId ? { ...item, reviewState: action === "accept" ? "accepted" : "rejected", reviewedBy: this.context.actorId, reviewedAt: at, reviewNote: note } : item),
        overrideDueDate: action === "accept" ? null : prior.overrideDueDate, overrideReason: action === "accept" ? "" : prior.overrideReason,
        events: this.event(prior, "completion_" + action, note, at) };
      next.nextDueDate = requirementNextDue(next);
      return this.bounded(next);
    });
  }
  async saveCallMatch(value: unknown, sourceScope?: NonNullable<CallMatchRecord["sourceScope"]>): Promise<CallMatchRecord> {
    const collection = this.collection("callMatches"), input = request(value, ["id", "revision", "officeId", "visitId", "visitSourceHash", "candidates", "sourceValidation", "note"], ["id", "revision", "officeId", "visitId", "visitSourceHash", "candidates", "note"]);
    this.office(input.officeId);
    const documentId = id(input.id), expected = revision(input.revision), visitId = identifier(input.visitId), visitSourceHash = hash(input.visitSourceHash), sourceValidation = input.sourceValidation === undefined ? "source_unvalidated" : choice(input.sourceValidation, ["source_unvalidated", "accepted"]);
    if (!Array.isArray(input.candidates) || input.candidates.length > MAX_CANDIDATES) throw new WorkflowError("invalid_call_candidates");
    const candidates: CallCandidate[] = input.candidates.map(value => { const candidate = request(value, ["callId", "sourceHash", "callTime", "callType", "caregiverId", "patientId"]); return { callId: identifier(candidate.callId), sourceHash: hash(candidate.sourceHash), callTime: candidate.callTime === null ? null : text(candidate.callTime, 80), callType: candidate.callType === null ? null : text(candidate.callType, 80), caregiverId: candidate.caregiverId === null ? null : identifier(candidate.caregiverId), patientId: candidate.patientId === null ? null : identifier(candidate.patientId) }; });
    if (new Set(candidates.map(item => item.callId)).size !== candidates.length) throw new WorkflowError("duplicate_call_candidate");
    const note = text(input.note), at = this.at();
    if (sourceScope && (!/^(?:0|[1-9]\d{0,9})$/.test(sourceScope.lastId) || Number(sourceScope.lastId) > 2147483647)) throw new WorkflowError("explicit_call_source_boundary_required");
    const checkedScope = sourceScope ? { date: calendarDate(sourceScope.date), lastId: sourceScope.lastId, policyFingerprint: hash(sourceScope.policyFingerprint) } : null;
    return this.repository.change<CallMatchRecord>(collection, documentId, expected, this.context.actorId, "revision_call_match_created", prior => {
      if (prior) { this.scoped(prior); throw new WorkflowError("call_match_evidence_immutable", 409); }
      return this.bounded({ id: documentId, revision: 1, updatedAt: at, officeId: this.context.officeId, visitId, visitSourceHash, candidates, sourceScope: checkedScope, sourceValidation, state: candidates.length === 0 ? "unmatched" : candidates.length === 1 ? "candidate" : "ambiguous", matchedCallId: null, hhaVerification: "not_established", decisions: [], events: this.event(null, "call_match_created", note, at) });
    });
  }
  async decideCallMatch(value: unknown): Promise<CallMatchRecord> {
    const collection = this.collection("callMatches"), input = request(value, ["id", "revision", "officeId", "action", "callId", "reason"]);
    this.office(input.officeId);
    const documentId = id(input.id), expected = revision(input.revision), action = choice(input.action, ["match", "reject", "undo"]), callId = input.callId === null ? null : identifier(input.callId), reason = text(input.reason), at = this.at();
    if ((action === "match") !== (callId !== null)) throw new WorkflowError("invalid_call_decision");
    return this.repository.change<CallMatchRecord>(collection, documentId, expected, this.context.actorId, "revision_call_" + action, prior => {
      if (!prior) throw new WorkflowError("call_match_not_found", 404);
      this.scoped(prior);
      if (action === "undo" ? !["matched", "rejected"].includes(prior.state) : ["matched", "rejected"].includes(prior.state)) throw new WorkflowError("invalid_call_transition", 409);
      if (action === "match" && prior.sourceValidation !== "accepted") throw new WorkflowError("call_evidence_not_accepted", 423);
      if (action === "match" && !prior.candidates.some(item => item.callId === callId)) throw new WorkflowError("call_not_candidate");
      if (prior.decisions.length >= MAX_DECISIONS) throw new WorkflowError("record_history_limit", 409);
      return this.bounded({ ...prior, revision: expected + 1, updatedAt: at, state: action === "match" ? "matched" : action === "reject" ? "rejected" : "undone", matchedCallId: action === "match" ? callId : null,
        decisions: [...prior.decisions, { action, callId, previousState: prior.state, previousCallId: prior.matchedCallId, actorId: this.context.actorId, at, reason }], events: this.event(prior, "call_" + action, reason, at) });
    });
  }
  /** Trusted server evaluation only. HTTP routes must never accept browser diagnoses as validated evidence. */
  async saveException(value: unknown): Promise<ExceptionReviewRecord> {
    const collection = this.collection("exceptions"), input = request(value, ["id", "revision", "officeId", "visitId", "ruleId", "ruleVersion", "sourceHash", "sourceValidation", "diagnosis", "assignee", "followUpAt", "note"]);
    this.office(input.officeId);
    if (input.sourceValidation !== "accepted") throw new WorkflowError("exception_evidence_not_accepted", 423);
    const documentId = id(input.id), expected = revision(input.revision), visitId = identifier(input.visitId), ruleId = id(input.ruleId), ruleVersion = text(input.ruleVersion, 100), sourceHash = hash(input.sourceHash), diagnosis = text(input.diagnosis, 2000), assignee = text(input.assignee, 128, true), followUpAt = timestamp(input.followUpAt), note = text(input.note), at = this.at();
    return this.repository.change<ExceptionReviewRecord>(collection, documentId, expected, this.context.actorId, "revision_exception_created", prior => {
      if (prior) { this.scoped(prior); throw new WorkflowError("exception_evidence_immutable", 409); }
      return this.bounded({ id: documentId, revision: 1, updatedAt: at, officeId: this.context.officeId, visitId, ruleId, ruleVersion, sourceHash, diagnosis, sourceValidation: "accepted", state: "open", assignee, followUpAt, acknowledgedBy: null, acknowledgedAt: null, hhaVerification: "not_established", events: this.event(null, "exception_created", note, at) });
    });
  }
  async reviewException(value: unknown): Promise<ExceptionReviewRecord> {
    const collection = this.collection("exceptions"), input = request(value, ["id", "revision", "officeId", "action", "note", "assignee", "followUpAt"], ["id", "revision", "officeId", "action", "note"]);
    this.office(input.officeId);
    const documentId = id(input.id), expected = revision(input.revision), action = choice(input.action, ["acknowledge", "start_review", "resolve", "reopen"]), note = text(input.note), at = this.at();
    const assignee = input.assignee === undefined ? undefined : text(input.assignee, 128, true), followUpAt = input.followUpAt === undefined ? undefined : timestamp(input.followUpAt);
    return this.repository.change<ExceptionReviewRecord>(collection, documentId, expected, this.context.actorId, "revision_exception_" + action, prior => {
      if (!prior) throw new WorkflowError("exception_not_found", 404);
      this.scoped(prior);
      const allowed = action === "reopen" ? prior.state === "resolved" : action === "acknowledge" ? prior.state === "open" : action === "start_review" ? ["open", "acknowledged"].includes(prior.state) : prior.state !== "resolved";
      if (!allowed) throw new WorkflowError("invalid_exception_transition", 409);
      return this.bounded({ ...prior, revision: expected + 1, updatedAt: at, state: action === "acknowledge" ? "acknowledged" : action === "start_review" ? "in_review" : action === "resolve" ? "resolved" : "open", assignee: assignee ?? prior.assignee, followUpAt: followUpAt === undefined ? prior.followUpAt : followUpAt,
        acknowledgedBy: action === "acknowledge" ? this.context.actorId : action === "reopen" ? null : prior.acknowledgedBy,
        acknowledgedAt: action === "acknowledge" ? at : action === "reopen" ? null : prior.acknowledgedAt,
        events: this.event(prior, "exception_" + action, note, at) });
    });
  }
}
