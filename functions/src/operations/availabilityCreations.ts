import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { availabilityDayFields } from "./availability.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface AvailabilityCreation extends Versioned {
  operation: AvailabilityCreationOperation; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface AvailabilityCreationSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_availability_creation_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
export const AVAILABILITY_CREATIONS = ["AddCaregiverPermanentWeekAvailability", "AddCaregiverSpecialAvailability"] as const;
export type AvailabilityCreationOperation = typeof AVAILABILITY_CREATIONS[number];
export const availabilityCreationTarget = (facts: Facts) => `availability_create_${facts.Operation}_${identifier(facts.CaregiverID)}`;
function operation(value: unknown): AvailabilityCreationOperation { if (!AVAILABILITY_CREATIONS.includes(value as AvailabilityCreationOperation)) throw new WorkflowError("unsupported_availability_creation"); return value as AvailabilityCreationOperation; }
function date(value: unknown): string { if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new WorkflowError("availability_date_mapping_required", 409); return value; }
const identity = (op: string) => op === AVAILABILITY_CREATIONS[0] ? "PermanentWeekID" : "SpecialAvailabilityID";
const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const fields = days.flatMap(day => ["AvailabilityType", "LiveIn", "From", "To"].map(suffix => day + suffix));
export function sameAvailabilityCreationFacts(left: Facts, right: Facts) { const { RecordID: _a, ...a } = left, { RecordID: _b, ...b } = right; return sameSourceFacts(a, b); }
export async function currentAvailabilityCreation(read: (input: ReadInput) => Promise<OperationalRead>, facts: Facts, officeId: string): Promise<Facts> {
  const op = operation(facts.Operation), caregiverId = identifier(facts.CaregiverID), special = op === AVAILABILITY_CREATIONS[1];
  const results = await Promise.allSettled([read({ operation: "GetCaregiverDemographics", id: caregiverId }), read({ operation: special ? "GetCaregiverSpecialAvailability" : "GetCaregiverPermanentWeekAvailability", id: caregiverId })]);
  const failed = results.find(row => row.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
  const [caregiver, source] = results.map(row => (row as PromiseFulfilledResult<OperationalRead>).value);
  if (caregiver!.truncated || source!.truncated || caregiver!.records.length !== 1 || caregiver!.records[0]?.ID !== caregiverId) throw new WorkflowError("complete_availability_source_required", 409);
  let offices: unknown; try { offices = JSON.parse(caregiver!.records[0]?.OfficeIDs || ""); } catch { /* fail closed */ }
  // Create requests omit OfficeID. Only a single, verified caregiver office is supported.
  if (!Array.isArray(offices) || offices.length !== 1 || offices[0] !== officeId) throw new WorkflowError("single_caregiver_office_required", 409);
  const matches = source!.records.filter(row => {
    identifier(row[identity(op)]);
    if (row.CaregiverID !== caregiverId || row.OfficeID !== officeId) throw new WorkflowError("availability_source_scope_mismatch", 409);
    return !special || date(row.FromDate) <= date(facts.ToDate) && date(row.ToDate) >= date(facts.FromDate);
  });
  if (!matches.length) return { Exists: "false" };
  if (matches.length !== 1) throw new WorkflowError("overlapping_availability_requires_policy_review", 409);
  const row = matches[0]!;
  const current: Facts = { Exists: "true", Operation: op, CaregiverID: caregiverId, OfficeID: officeId, RecordID: row[identity(op)]!, ...(special ? { FromDate: date(row.FromDate), ToDate: date(row.ToDate) } : {}), ...Object.fromEntries(fields.map(key => [key, row[key] ?? null])) };
  availabilityCreationRequest(current);
  return current;
}
export function availabilityCreationRequest(facts: Facts): string {
  const op = operation(facts.Operation), special = op === AVAILABILITY_CREATIONS[1], tag = special ? "SpecialAvailabilityInfo" : "PermanentWeekAvailabilityInfo";
  let body = `<CaregiverID>${identifier(facts.CaregiverID)}</CaregiverID>`;
  if (special) { const from = date(facts.FromDate), to = date(facts.ToDate); if (from > to) throw new WorkflowError("invalid_availability_period"); body += `<FromDate>${from}T00:00:00</FromDate><ToDate>${to}T00:00:00</ToDate>`; }
  return `<${tag}>${body}${availabilityDayFields(facts)}</${tag}>`;
}
export async function submitAvailabilityCreation(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<AvailabilityCreationSubmission> {
  const op = operation(facts.Operation), response = await client.call(op, availabilityCreationRequest(facts), 1);
  if (!response.ok || !response.resultXml || extractElementText(response.resultXml, "CaregiverID") !== facts.CaregiverID) return { result: "unknown" };
  const recordId = extractElementText(response.resultXml, identity(op));
  try { identifier(recordId); return { result: "acknowledged", recordId: recordId! }; } catch { return { result: "unknown" }; }
}
export class AvailabilityCreationWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { enabled: readonly AvailabilityCreationOperation[]; submit: (facts: Facts) => Promise<AvailabilityCreationSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentAvailabilityCreation(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<AvailabilityCreation>("availabilityCreations", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    const op = operation(input.operation);
    if (Object.keys(input).some(key => !["id", "operation", "caregiverId", "fromDate", "toDate", "days", "rationale"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_availability_creation_proposal");
    const week = object(input.days); if (Object.keys(week).length !== fields.length || Object.keys(week).some(key => !fields.includes(key))) throw new WorkflowError("all_seven_availability_days_required");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const proposed: Facts = { Exists: "true", Operation: op, CaregiverID: identifier(input.caregiverId), OfficeID: officeId, ...Object.fromEntries(fields.map(key => [key, week[key] as string])), ...(op === AVAILABILITY_CREATIONS[1] ? { FromDate: date(input.fromDate), ToDate: date(input.toDate) } : {}) };
    if (op === AVAILABILITY_CREATIONS[0] && (input.fromDate || input.toDate)) throw new WorkflowError("permanent_availability_has_no_dates");
    availabilityCreationRequest(proposed);
    const before = await this.current(proposed, officeId);
    if (before.Exists !== "false") throw new WorkflowError("existing_availability_requires_update_or_policy_review", 409);
    return this.repository.change<AvailabilityCreation>("availabilityCreations", id, 0, actor, "availability_creation_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: op, officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: AvailabilityCreation["sourceCheck"] = "unavailable";
    try { sourceCheck = sameAvailabilityCreationFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<AvailabilityCreation>("availabilityCreations", prior.id, prior.revision, actor, "availability_creation_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<AvailabilityCreation>("availabilityCreations", prior.id, prior.revision, actor, "availability_creation_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.enabled.includes(prior.operation)) throw new WorkflowError("availability_creation_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = availabilityCreationTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameAvailabilityCreationFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    availabilityCreationRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<AvailabilityCreation>("availabilityCreations", prior.id, prior.revision, actor, "availability_creation_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: AvailabilityCreationSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<AvailabilityCreation>("availabilityCreations", prior.id, attempt.revision, actor, "availability_creation_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<AvailabilityCreation["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = sameAvailabilityCreationFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.RecordID === prior.execution.vendorRecordId) ? "matches_proposal" : sameAvailabilityCreationFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<AvailabilityCreation>("availabilityCreations", prior.id, prior.revision, actor, "availability_creation_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(availabilityCreationTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
