import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID, createHash } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText, extractElementBodies } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface TopicChange extends Versioned {
  operation: "CreateInserviceTopics"; topic: string; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface TopicSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_topic_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
const topicKey = (value: string) => value.normalize("NFKC").trim().toLowerCase();
export const topicTarget = (topic: string, officeId: string) => `topic_${officeId}_${createHash("sha256").update(topicKey(topic)).digest("hex")}`;
export function sameTopicFacts(left: Facts, right: Facts) { const { TopicID: _a, ...a } = left, { TopicID: _b, ...b } = right; return sameSourceFacts(a, b); }
export async function currentTopic(read: (input: ReadInput) => Promise<OperationalRead>, topic: string, officeId: string): Promise<Facts> {
  const source = await read({ operation: "GetInServiceTopics", officeId });
  if (source.truncated) throw new WorkflowError("complete_topic_catalog_required", 409);
  if (source.records.some(row => typeof row.TopicDescription !== "string" || !row.TopicDescription.trim() || !row.TopicID || !/^[1-9]\d*$/.test(row.TopicID))) throw new WorkflowError("source_topic_identity_required", 409);
  const matches = source.records.filter(row => typeof row.TopicDescription === "string" && topicKey(row.TopicDescription) === topicKey(topic));
  if (matches.length > 1) throw new WorkflowError("topic_not_unique", 409);
  if (!matches.length) return { Exists: "false" };
  const row = matches[0]!;
  if (!row.TopicID || !/^[1-9]\d*$/.test(row.TopicID)) throw new WorkflowError("source_topic_identity_required", 409);
  return { Exists: "true", TopicID: row.TopicID, Topic: row.TopicDescription!, OfficeID: officeId, Status: row.Status ?? null, CountTowardsCompliance: row.CountTowardsCompliance ?? null };
}
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export function topicRequest(facts: Facts): string {
  identifier(facts.OfficeID);
  if (typeof facts.Topic !== "string" || !facts.Topic.trim() || facts.Topic !== facts.Topic.trim() || facts.Topic.length > 200 || /[\x00-\x1f]/.test(facts.Topic) || !["Active", "Inactive"].includes(facts.Status || "") || !["Yes", "No"].includes(facts.CountTowardsCompliance || "")) throw new WorkflowError("invalid_topic_fields");
  return '<InserviceTopicsInfo>' + ["Topic", "OfficeID", "Status", "CountTowardsCompliance"].map(key => `<${key}>${escaped(facts[key]!)}</${key}>`).join("") + '</InserviceTopicsInfo>';
}
export async function submitTopic(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<TopicSubmission> {
  const response = await client.call("CreateInserviceTopics", topicRequest(facts), 1);
  if (!response.ok || !response.resultXml) return { result: "unknown" };
  const matches = extractElementBodies(response.resultXml, "OfficeInserviceTopic").filter(body => extractElementText(body, "OfficeID") === facts.OfficeID);
  const recordId = matches.length === 1 ? extractElementText(matches[0]!, "InserviceTopicID") : undefined;
  return recordId && /^[1-9]\d*$/.test(recordId) ? { result: "acknowledged", recordId } : { result: "unknown" };
}
export class TopicWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<TopicSubmission> }, private clock = () => performance.now()) {}
  private async current(topic: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentTopic(this.read, topic, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<TopicChange>("topicChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    if (Object.keys(input).some(key => !["id", "topic", "status", "countTowardsCompliance", "rationale"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_topic_proposal");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const proposed: Facts = { Exists: "true", Topic: input.topic as string, OfficeID: officeId, Status: input.status as string, CountTowardsCompliance: input.countTowardsCompliance as string };
    topicRequest(proposed);
    const before = await this.current(proposed.Topic!, officeId);
    if (before.Exists !== "false") throw new WorkflowError("topic_already_exists", 409);
    return this.repository.change<TopicChange>("topicChanges", id, 0, actor, "topic_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "CreateInserviceTopics", topic: proposed.Topic!, officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: TopicChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameTopicFacts(await this.current(prior.topic, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<TopicChange>("topicChanges", prior.id, prior.revision, actor, "topic_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<TopicChange>("topicChanges", prior.id, prior.revision, actor, "topic_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("topic_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = topicTarget(prior.topic, prior.officeId);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameTopicFacts(await this.current(prior.topic, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    topicRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<TopicChange>("topicChanges", prior.id, prior.revision, actor, "topic_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: TopicSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<TopicChange>("topicChanges", prior.id, attempt.revision, actor, "topic_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<TopicChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.topic, prior.officeId); reconciliation = sameTopicFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.TopicID === prior.execution.vendorRecordId) ? "matches_proposal" : sameTopicFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<TopicChange>("topicChanges", prior.id, prior.revision, actor, "topic_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(topicTarget(prior.topic, prior.officeId), prior.id);
    return reconciled;
  }
}
