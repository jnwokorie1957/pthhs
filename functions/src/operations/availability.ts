import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";

export const AVAILABILITY_WRITES = ["UpdateCaregiverPermanentWeekAvailability", "UpdateCaregiverSpecialAvailability"] as const;
export type AvailabilityOperation = typeof AVAILABILITY_WRITES[number];
const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
type Facts = Record<string, string | null>;
export interface AvailabilityChange extends Versioned {
  operation: AvailabilityOperation; caregiverId: string; recordId: string; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"];
  recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_availability_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function operation(value: unknown): AvailabilityOperation { if (!AVAILABILITY_WRITES.includes(value as AvailabilityOperation)) throw new WorkflowError("unsupported_availability_operation"); return value as AvailabilityOperation; }
function date(value: unknown): string { if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new WorkflowError("availability_date_mapping_required", 409); return value + "T00:00:00"; }
const identity = (op: AvailabilityOperation) => op === AVAILABILITY_WRITES[0] ? "PermanentWeekID" : "SpecialAvailabilityID";
export function availabilityRequest(op: AvailabilityOperation, facts: Facts): string {
  operation(op); const special = op === AVAILABILITY_WRITES[1], tag = special ? "SpecialAvailabilityInfo" : "PermanentWeekAvailabilityInfo";
  let body = `<${identity(op)}>${identifier(facts[identity(op)])}</${identity(op)}><CaregiverID>${identifier(facts.CaregiverID)}</CaregiverID>`;
  if (special) { const from = date(facts.FromDate), to = date(facts.ToDate); if (from > to) throw new WorkflowError("invalid_availability_period"); body += `<FromDate>${from}</FromDate><ToDate>${to}</ToDate>`; }
  body += availabilityDayFields(facts);
  return `<${tag}>${body}</${tag}>`;
}
export function availabilityDayFields(facts: Facts): string {
  let body = "";
  for (const day of days) {
    const type = facts[day + "AvailabilityType"], live = facts[day + "LiveIn"], from = facts[day + "From"], to = facts[day + "To"];
    // Missing/blank source days cannot be round-tripped until vendor clear-vs-
    // preserve semantics are confirmed. Never erase them by omission or default.
    if (!["Preferred", "MightWork"].includes(type || "") || !["Yes", "No"].includes(live || "") || typeof from !== "string" || typeof to !== "string" || !/^(?:[01]\d|2[0-3])[0-5]\d$/.test(from) || !/^(?:[01]\d|2[0-3])[0-5]\d$/.test(to)) throw new WorkflowError("complete_availability_source_mapping_required", 409);
    if (from >= to) throw new WorkflowError("overnight_availability_semantics_required", 409);
    const order = ["Wednesday", "Thursday"].includes(day) ? ["AvailabilityType", "From", "To", "LiveIn"] : ["AvailabilityType", "LiveIn", "From", "To"];
    for (const suffix of order) body += `<${day}${suffix}>${facts[day + suffix]}</${day}${suffix}>`;
  }
  return body;
}
export async function submitAvailability(client: Pick<HhaSoapClient, "call">, op: AvailabilityOperation, facts: Facts): Promise<"acknowledged" | "unknown" | "not_submitted"> {
  const response = await client.call(op, availabilityRequest(op, facts), 1);
  return response.ok && response.resultXml && extractElementText(response.resultXml, identity(op)) === facts[identity(op)] && extractElementText(response.resultXml, "CaregiverID") === facts.CaregiverID ? "acknowledged" : "unknown";
}
export class AvailabilityWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { enabled: readonly AvailabilityOperation[]; submit: (op: AvailabilityOperation, facts: Facts) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private clock = () => performance.now()) {}
  private async current(op: AvailabilityOperation, caregiverId: string, recordId: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    const source = await this.read({ operation: op === AVAILABILITY_WRITES[0] ? "GetCaregiverPermanentWeekAvailability" : "GetCaregiverSpecialAvailability", id: caregiverId });
    const matches = source.records.filter(row => row.CaregiverID === caregiverId && row[identity(op)] === recordId && row.OfficeID === officeId);
    if (source.truncated || matches.length !== 1) throw new WorkflowError("availability_not_uniquely_returned", 409);
    return matches[0]!;
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<AvailabilityChange>("availabilityChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), op = operation(input.operation), id = docId(input.id), caregiverId = identifier(input.caregiverId), recordId = identifier(input.recordId);
    if (Object.keys(input).some(key => !["id", "operation", "caregiverId", "recordId", "day", "availabilityType", "liveIn", "from", "to", "rationale"].includes(key)) || !days.includes(String(input.day)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_availability_proposal");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const before = await this.current(op, caregiverId, recordId, officeId); availabilityRequest(op, before);
    const proposed = { ...before };
    for (const [suffix, key] of [["AvailabilityType", "availabilityType"], ["LiveIn", "liveIn"], ["From", "from"], ["To", "to"]]) { if (typeof input[key!] !== "string") throw new WorkflowError("invalid_availability_proposal"); proposed[String(input.day) + suffix] = input[key!] as string; }
    availabilityRequest(op, proposed); if (sameSourceFacts(before, proposed)) throw new WorkflowError("proposal_has_no_change");
    return this.repository.change<AvailabilityChange>("availabilityChanges", id, 0, actor, "availability_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: op, caregiverId, recordId, officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: AvailabilityChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameSourceFacts(await this.current(prior.operation, prior.caregiverId, prior.recordId, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<AvailabilityChange>("availabilityChanges", prior.id, prior.revision, actor, "availability_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<AvailabilityChange>("availabilityChanges", prior.id, prior.revision, actor, "availability_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.enabled.includes(prior.operation)) throw new WorkflowError("availability_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = `availability_${prior.operation}_${prior.caregiverId}_${prior.recordId}`;
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameSourceFacts(await this.current(prior.operation, prior.caregiverId, prior.recordId, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    availabilityRequest(prior.operation, prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<AvailabilityChange>("availabilityChanges", prior.id, prior.revision, actor, "availability_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.write.submit(prior.operation, prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<AvailabilityChange>("availabilityChanges", prior.id, attempt.revision, actor, "availability_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<AvailabilityChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.operation, prior.caregiverId, prior.recordId, prior.officeId); reconciliation = sameSourceFacts(current, prior.proposed) ? "matches_proposal" : sameSourceFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<AvailabilityChange>("availabilityChanges", prior.id, prior.revision, actor, "availability_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(`availability_${prior.operation}_${prior.caregiverId}_${prior.recordId}`, prior.id);
    return reconciled;
  }
}
