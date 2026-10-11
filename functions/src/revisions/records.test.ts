import assert from "node:assert/strict";
import test from "node:test";
import type { Versioned, WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError } from "../operations/reads.js";
import { RevisionRecords, addCalendarMonths, calendarDate, requirementStatus, type RequirementRecord, type CallMatchRecord, type ScopedRecord, type RevisionContext, type RevisionResource } from "./records.js";

class MemoryRepository implements Pick<WorkspaceRepository, "get" | "page" | "change"> {
  records = new Map<string, Versioned>();
  audit: { collection: string; actor: string; action: string; revision: number }[] = [];
  requests: string[] = [];
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> { this.requests.push(collection); return structuredClone(this.records.get(collection + "/" + id) as T ?? null); }
  async page<T extends Versioned>(collection: string, cursor?: string) {
    this.requests.push(collection);
    const all = [...this.records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, record]) => structuredClone(record) as T).sort((a, b) => a.id.localeCompare(b.id));
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) throw new WorkflowError("invalid_page_cursor");
    return { items: all.slice(offset, offset + 2), nextCursor: offset + 2 < all.length ? String(offset + 2) : null };
  }
  async change<T extends Versioned>(collection: string, id: string, expected: number, actor: string, action: string, update: (prior: T | null) => T): Promise<T> {
    const prior = await this.get<T>(collection, id);
    if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
    const next = update(prior);
    this.records.set(collection + "/" + id, structuredClone(next));
    this.audit.push({ collection, actor, action, revision: next.revision });
    return structuredClone(next);
  }
}
const context: RevisionContext = { officeId: "123", actorId: "supervisor-1", roles: ["office_supervisor"], dataApproved: true, mode: "live" };
const clock = () => new Date("2026-10-10T12:00:00.000Z");
function setup(overrides: Partial<RevisionContext> = {}) { const repository = new MemoryRepository(); return { repository, service: new RevisionRecords(repository, { ...context, ...overrides }, clock) }; }
function requirement(overrides: Record<string, unknown> = {}) { return { id: "req-1", revision: 0, officeId: "123", type: "supervisory_visit", subject: { kind: "member", id: "77" }, program: "Owner-defined synthetic program", service: "PAS", assignedSupervisor: "supervisor-1", ruleReference: "Reviewed program rule v1", cadenceMonths: 6, anchorMode: "fixed_due_date", anchorDate: "2024-01-31", effectiveFrom: "2024-01-01", effectiveUntil: null, overrideDueDate: null, overrideReason: "", note: "Configure documented obligation", ...overrides }; }
function completion(revision = 1, overrides: Record<string, unknown> = {}) { return { id: "req-1", revision, officeId: "123", completionId: "completion-1", completedOn: "2024-01-20", performedBy: "supervisor-1", documentReference: "protected-doc-1", note: "Completion evidence recorded for review", ...overrides }; }
function reviewCompletion(revision = 2, overrides: Record<string, unknown> = {}) { return { id: "req-1", revision, officeId: "123", completionId: "completion-1", action: "accept", note: "Document and applicable program obligation reviewed", ...overrides }; }
const sourceHash = "a".repeat(64), otherHash = "b".repeat(64);
function candidate(callId = "33") { return { callId, sourceHash: otherHash, callTime: "2026-10-10 08:00", callType: "Source call type", caregiverId: "44", patientId: "77" }; }
function callMatch(overrides: Record<string, unknown> = {}) { return { id: "match-1", revision: 0, officeId: "123", visitId: "55", visitSourceHash: sourceHash, candidates: [candidate()], note: "Candidates retain source evidence", ...overrides }; }
function decision(revision = 1, overrides: Record<string, unknown> = {}) { return { id: "match-1", revision, officeId: "123", action: "match", callId: "33", reason: "Human checked the identities and evidence", ...overrides }; }
function exception(overrides: Record<string, unknown> = {}) { return { id: "exception-1", revision: 0, officeId: "123", visitId: "55", ruleId: "EVV_NO_CLOCK_OUT", ruleVersion: "accepted-policy-v1", sourceHash, sourceValidation: "accepted", diagnosis: "Trusted synthetic server evaluation", assignee: "supervisor-1", followUpAt: null, note: "Persist accepted rule evidence", ...overrides }; }

test("calendar recurrence preserves calendar months, month ends and leap years", () => {
  assert.equal(addCalendarMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addCalendarMonths("2024-01-31", 2), "2024-03-31");
  assert.equal(addCalendarMonths("2023-08-31", 6), "2024-02-29");
  assert.equal(addCalendarMonths("2024-08-31", 6), "2025-02-28");
  assert.equal(addCalendarMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(addCalendarMonths("2024-01-31", 6), "2024-07-31");
  for (const invalid of ["2023-02-29", "2024-02-30", "2024-13-01", "2024-01-31T00:00:00Z", "01/31/2024", "0099-01-01"]) assert.throws(() => calendarDate(invalid), /invalid_calendar_date/);
  for (const invalid of [-1, 1.5, Number.NaN, 12001]) assert.throws(() => addCalendarMonths("2024-01-31", invalid), /invalid_cadence/);
  assert.throws(() => addCalendarMonths("9999-12-31", 1), /calendar_range_exceeded/);
});

test("six months requires an explicit owner rule; null recurrence stays unconfigured", async () => {
  const { service, repository } = setup();
  const record = await service.saveRequirement(requirement({ cadenceMonths: null }));
  assert.equal(record.nextDueDate, null);
  assert.equal(requirementStatus(record, "2024-02-01"), "not_configured");
  await assert.rejects(service.recordCompletion(completion()), /requirement_cadence_not_configured_or_completed/);
  await assert.rejects(service.saveRequirement(requirement({ id: "req-2", ruleReference: "" })), /invalid_record_text/);
  assert.equal(repository.audit.length, 1);
});

test("completion acceptance and fixed recurrence stay atomic, preserve month-end anchor and retain evidence", async () => {
  const { service, repository } = setup();
  let record = await service.saveRequirement(requirement({ cadenceMonths: 1 }));
  assert.equal(requirementStatus(record, "2024-01-30"), "upcoming");
  assert.equal(requirementStatus(record, "2024-01-31"), "due");
  assert.equal(requirementStatus(record, "2024-02-01"), "overdue");
  record = await service.recordCompletion(completion());
  assert.equal(record.nextDueDate, "2024-01-31");
  assert.equal(requirementStatus(record, "2024-02-01"), "evidence_under_review");
  record = await service.reviewCompletion(reviewCompletion());
  assert.equal(record.nextDueDate, "2024-02-29");
  const accepted = structuredClone(record.completions[0]);
  record = await service.recordCompletion(completion(3, { completionId: "completion-2", completedOn: "2024-02-27" }));
  record = await service.reviewCompletion(reviewCompletion(4, { completionId: "completion-2" }));
  assert.equal(record.nextDueDate, "2024-03-31");
  assert.deepEqual(record.completions[0], accepted);
  assert.equal(record.events.length, 5);
  assert.equal(repository.audit.length, 5);
  assert.ok(repository.audit.every(event => event.collection === "revisionRequirements_office_123" && event.actor === context.actorId));
  await assert.rejects(service.reviewCompletion(reviewCompletion(5)), /completion_review_final/);
  await assert.rejects(service.recordCompletion(completion(5)), /completion_identity_exists/);
});

test("completion-date anchor and documented due overrides have distinct, reproducible behavior", async () => {
  const { service } = setup();
  await service.saveRequirement(requirement({ anchorMode: "completion_date" }));
  await service.recordCompletion(completion());
  assert.equal((await service.reviewCompletion(reviewCompletion())).nextDueDate, "2024-07-20");
  const second = setup();
  await second.service.saveRequirement(requirement({ cadenceMonths: 1, overrideDueDate: "2024-02-15", overrideReason: "Documented supervisor reschedule" }));
  await second.service.recordCompletion(completion(1, { completedOn: "2024-02-12" }));
  const accepted = await second.service.reviewCompletion(reviewCompletion());
  assert.equal(accepted.completions[0]?.forDueDate, "2024-02-15");
  assert.equal(accepted.completions[0]?.scheduledDueDate, "2024-01-31");
  assert.equal(accepted.completions[0]?.overrideReason, "Documented supervisor reschedule");
  assert.equal(accepted.nextDueDate, "2024-02-29");
  assert.equal(accepted.overrideDueDate, null);
  await assert.rejects(second.service.saveRequirement(requirement({ id: "bad", overrideDueDate: "2024-02-15" })), /documented_due_override_required/);
});

test("orientation is one-time unless a distinct recurring orientation is explicitly configured", async () => {
  const { service } = setup();
  await assert.rejects(service.saveRequirement(requirement({ type: "initial_orientation" })), /initial_orientation_cannot_recur/);
  await service.saveRequirement(requirement({ type: "initial_orientation", cadenceMonths: null }));
  await service.recordCompletion(completion());
  const record = await service.reviewCompletion(reviewCompletion());
  assert.equal(record.nextDueDate, null);
  assert.equal(requirementStatus(record, "2024-02-01"), "completed");
});

test("rejected completion remains in the ledger; duplicate period acceptance and reused actual dates fail", async () => {
  const { service } = setup();
  await service.saveRequirement(requirement());
  await service.recordCompletion(completion());
  let record = await service.reviewCompletion(reviewCompletion(2, { action: "reject" }));
  assert.equal(record.nextDueDate, "2024-01-31");
  assert.equal(record.completions[0]?.reviewState, "rejected");
  await assert.rejects(service.reviewCompletion(reviewCompletion(3)), /completion_review_final/);
  await service.recordCompletion(completion(3, { completionId: "completion-2" }));
  await service.recordCompletion(completion(4, { completionId: "completion-3" }));
  record = await service.reviewCompletion(reviewCompletion(5, { completionId: "completion-2" }));
  await assert.rejects(service.reviewCompletion(reviewCompletion(6, { completionId: "completion-3" })), /requirement_period_already_completed/);
  await service.recordCompletion(completion(6, { completionId: "completion-4", completedOn: "2024-01-20" }));
  await assert.rejects(service.reviewCompletion(reviewCompletion(7, { completionId: "completion-4" })), /completion_date_must_advance/);
  assert.equal(record.completions[0]?.reviewState, "rejected");
});

test("subject and reviewed recurrence are immutable; stale revisions cannot overwrite evidence", async () => {
  const { service } = setup();
  await service.saveRequirement(requirement());
  await assert.rejects(service.saveRequirement(requirement()), /revision_conflict/);
  await assert.rejects(service.saveRequirement(requirement({ revision: 1, subject: { kind: "caregiver", id: "77" } })), /requirement_subject_immutable/);
  await service.recordCompletion(completion());
  await assert.rejects(service.saveRequirement(requirement({ revision: 2, cadenceMonths: 12 })), /requirement_rule_with_evidence_immutable/);
  await assert.rejects(service.saveRequirement(requirement({ revision: 2, completions: [] })), /unsupported_record_field/);
  const record = await service.saveRequirement(requirement({ revision: 2, assignedSupervisor: "supervisor-2" }));
  assert.equal(record.assignedSupervisor, "supervisor-2");
  assert.equal(record.completions.length, 1);
});

test("call candidates derive candidate, ambiguous and unmatched states without automatic matching", async () => {
  const { service } = setup();
  assert.equal((await service.saveCallMatch(callMatch())).state, "candidate");
  assert.equal((await service.saveCallMatch(callMatch({ id: "match-2", candidates: [candidate(), candidate("34")] }))).state, "ambiguous");
  assert.equal((await service.saveCallMatch(callMatch({ id: "match-3", candidates: [] }))).state, "unmatched");
  await assert.rejects(service.decideCallMatch(decision()), /call_evidence_not_accepted/);
  await assert.rejects(service.saveCallMatch(callMatch({ id: "match-4", candidates: [candidate(), candidate()] })), /duplicate_call_candidate/);
  await assert.rejects(service.saveCallMatch(callMatch({ id: "match-4", visitSourceHash: "unproven" })), /invalid_source_hash/);
});

test("human call match, reject and undo retain immutable hashes and decision history without HHA verification", async () => {
  const { service, repository } = setup();
  await service.saveCallMatch(callMatch({ sourceValidation: "accepted", candidates: [candidate(), candidate("34")] }));
  await assert.rejects(service.decideCallMatch(decision(1, { callId: "99" })), /call_not_candidate/);
  const matched = await service.decideCallMatch(decision());
  assert.equal(matched.state, "matched");
  assert.equal(matched.hhaVerification, "not_established");
  await assert.rejects(service.decideCallMatch(decision()), /revision_conflict/);
  await assert.rejects(service.saveCallMatch(callMatch({ revision: 2, visitId: "88" })), /call_match_evidence_immutable/);
  await assert.rejects(service.decideCallMatch(decision(2, { action: "reject", callId: null })), /invalid_call_transition/);
  const undone = await service.decideCallMatch(decision(2, { action: "undo", callId: null }));
  assert.equal(undone.state, "undone");
  assert.equal(undone.matchedCallId, null);
  assert.equal(undone.decisions[1]?.previousCallId, "33");
  assert.deepEqual(undone.candidates, matched.candidates);
  const rejected = await service.decideCallMatch(decision(3, { action: "reject", callId: null }));
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.decisions.length, 3);
  assert.equal(repository.audit.length, 4);
  assert.equal(rejected.visitSourceHash, sourceHash);
});

test("exception acknowledgement and local resolution preserve accepted evidence without verified source claims", async () => {
  const { service, repository } = setup();
  await assert.rejects(service.saveException(exception({ sourceValidation: "source_unvalidated" })), /exception_evidence_not_accepted/);
  await service.saveException(exception());
  const input = { id: "exception-1", revision: 1, officeId: "123", action: "acknowledge", note: "Supervisor received the review" };
  const acknowledged = await service.reviewException(input);
  assert.equal(acknowledged.acknowledgedBy, context.actorId);
  assert.equal(acknowledged.acknowledgedAt, clock().toISOString());
  await assert.rejects(service.reviewException(input), /revision_conflict/);
  const inReview = await service.reviewException({ ...input, revision: 2, action: "start_review" });
  assert.equal(inReview.state, "in_review");
  const resolved = await service.reviewException({ ...input, revision: 3, action: "resolve", assignee: "supervisor-2" });
  assert.equal(resolved.hhaVerification, "not_established");
  assert.equal(resolved.sourceHash, sourceHash);
  const reopened = await service.reviewException({ ...input, revision: 4, action: "reopen" });
  assert.equal(reopened.state, "open");
  assert.equal(reopened.acknowledgedBy, null);
  assert.equal(reopened.events.length, 5);
  await assert.rejects(service.reviewException({ ...input, revision: 5, diagnosis: "Changed facts" }), /unsupported_record_field/);
  await assert.rejects(service.saveException(exception({ revision: 5, visitId: "99" })), /exception_evidence_immutable/);
  assert.equal(repository.audit.length, 5);
});

test("Demo, data approval and trusted management roles gate reads and writes before repository access", async () => {
  for (const overrides of [{ mode: "demo" as const }, { dataApproved: false }, { roles: ["collections_reviewer"] }, { roles: ["office_supervisor_from_request"] }]) {
    const { service, repository } = setup(overrides);
    await assert.rejects(service.page("requirements"));
    await assert.rejects(service.get("callMatches", "match-1"));
    await assert.rejects(service.saveRequirement(requirement()));
    assert.equal(repository.requests.length, 0);
    assert.equal(repository.audit.length, 0);
  }
  const admin = setup({ roles: ["admin"] });
  assert.equal((await admin.service.saveRequirement(requirement())).officeId, "123");
});

test("wrong offices, inherited keys, arbitrary resources and oversized payloads cannot reach other collections", async () => {
  const { service, repository } = setup();
  await assert.rejects(service.saveRequirement(requirement({ officeId: "999" })), /office_scope_mismatch/);
  await assert.rejects(service.saveRequirement(Object.create(requirement())), /invalid_request/);
  for (const resource of ["__proto__", "constructor", "workspaceSettings", "requirements/office_999"]) await assert.rejects(service.page(resource as RevisionResource), /unsupported_revision_resource/);
  await assert.rejects(service.saveRequirement(requirement({ note: "x".repeat(25000) })), /record_request_too_large/);
  await assert.rejects(service.saveRequirement(requirement({ note: "x".repeat(1001) })), /invalid_record_text/);
  assert.equal(repository.requests.length, 0);
  await service.saveRequirement(requirement());
  const record = await service.get<RequirementRecord>("requirements", "req-1");
  assert.ok(record);
  repository.records.set("revisionRequirements_office_123/req-1", { ...record, officeId: "999" } as RequirementRecord);
  await assert.rejects(service.get("requirements", "req-1"), /office_scope_mismatch/);
  await assert.rejects(service.page("requirements"), /office_scope_mismatch/);
});

test("office-scoped pages retain cursor scope and reject cross-office and cross-resource reuse", async () => {
  const { service, repository } = setup();
  for (let index = 0; index < 3; index++) await service.saveRequirement(requirement({ id: `req-${index}` }));
  const first = await service.page<RequirementRecord>("requirements");
  assert.equal(first.items.length, 2); assert.ok(first.nextCursor);
  const second = await service.page<RequirementRecord>("requirements", { cursor: first.nextCursor });
  assert.equal(second.items.length, 1); assert.equal(second.nextCursor, null);
  await assert.rejects(service.page("callMatches", { cursor: first.nextCursor }), /revision_cursor_scope_mismatch/);
  const wrongOffice = new RevisionRecords(repository, { ...context, officeId: "999" }, clock);
  await assert.rejects(wrongOffice.page("requirements", { cursor: first.nextCursor }), /office_scope_mismatch/);
  await assert.rejects(service.page("requirements", { cursor: "bad" }), /invalid_revision_cursor/);
  await assert.rejects(service.page("requirements", { collection: "workspaceSettings" }), /unsupported_record_field/);
});

test("completion ledger, candidate lists, history and stored bytes are explicitly bounded", async () => {
  const { service, repository } = setup();
  await service.saveRequirement(requirement());
  const record = await service.get<RequirementRecord>("requirements", "req-1"); assert.ok(record);
  const entry = { id: "seed", completedOn: "2024-01-01", performedBy: "staff", documentReference: "doc", note: "evidence", forDueDate: "2024-01-31", scheduledDueDate: "2024-01-31", overrideReason: "", ruleReference: "rule", recordedBy: "staff", recordedAt: clock().toISOString(), reviewState: "rejected" as const, reviewedBy: "staff", reviewedAt: clock().toISOString(), reviewNote: "reviewed" };
  repository.records.set("revisionRequirements_office_123/req-1", { ...record, completions: Array.from({ length: 100 }, (_, index) => ({ ...entry, id: `seed-${index}` })) } as RequirementRecord);
  await assert.rejects(service.recordCompletion(completion()), /completion_ledger_limit/);
  await assert.rejects(service.saveCallMatch(callMatch({ candidates: Array.from({ length: 11 }, (_, index) => candidate(String(index + 1))) })), /invalid_call_candidates/);
  await service.saveCallMatch(callMatch({ sourceValidation: "accepted" }));
  const matched = await service.get<CallMatchRecord>("callMatches", "match-1"); assert.ok(matched);
  repository.records.set("revisionCallMatches_office_123/match-1", { ...matched, events: Array.from({ length: 256 }, () => ({ actorId: "staff", at: clock().toISOString(), action: "prior", note: "retained", revision: 1 })) } as CallMatchRecord);
  await assert.rejects(service.decideCallMatch(decision()), /record_history_limit/);
  repository.records.set("revisionCallMatches_office_123/match-1", { ...matched, candidates: [{ ...candidate(), callTime: "x".repeat(262144) }] } as CallMatchRecord);
  await assert.rejects(service.decideCallMatch(decision()), /record_size_limit/);
});
