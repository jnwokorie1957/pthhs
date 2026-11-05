import { evidenceIsFresh, normalizedInstant, sameEvidenceScope, validEvidenceScope, type EvidenceScope } from "./evidence.js";
import type { CallMatchRecord, ExceptionReviewRecord } from "./records.js";
import { WorkflowError, identifier } from "../operations/reads.js";

// Pure report projection, NOT an execution/authorization API or vendor adapter.
// All inputs must come from scoped protected records and independently accepted
// adapters, never browser assertions. No current HHA operation is accepted here.
export interface MaintenanceBinding {
  scope: EvidenceScope;
  patientId: string;
  caregiverId: string;
  visitId: string;
  actionId: string;
  actionKind: string; // Opaque accepted-adapter key, not a guessed SOAP operation.
}
export interface OriginalEvent {
  id: string;
  sourceReference: string;
  sourceHash: string;
  originalTime: string | null; // Preserve raw source text, including offset/unknown.
}
export interface VersionReference { id: string; version: string; reference: string; }
export interface MaintenanceProposal {
  binding: MaintenanceBinding;
  state: "draft" | "reviewed";
  actorId: string;
  reviewerId: string | null;
  explanation: string;
  events: readonly OriginalEvent[];
  before: Readonly<Record<string, string | null>>;
  proposed: Readonly<Record<string, string | null>>;
  rule: VersionReference | null;
  reason: { code: string; actionCode: string; note: string; catalog: VersionReference } | null;
}
export interface MaintenanceReceipt {
  id: string;
  sourceReference: string;
  sourceHash: string;
  fetchedAt: string;
  binding: MaintenanceBinding;
  events: readonly OriginalEvent[];
  values: Readonly<Record<string, string | null>>;
}
// This is a future protected acceptance receipt, not built from WSDL names or
// local review decisions. It defines only the evidence contract for this report.
export interface MaintenanceAcceptance {
  binding: MaintenanceBinding;
  contract: VersionReference;
  validUntil: string;
  maxAgeSeconds: number;
  fields: readonly string[];
  rule: VersionReference;
  catalog: VersionReference | null;
  noteRequired: boolean;
  independentReviewRequired: boolean;
}
export type MaintenanceSubmission = { state: "not_submitted" } | {
  state: "pending" | "unknown" | "transport_success";
  attemptId: string;
  submittedAt: string;
  binding: MaintenanceBinding;
  responseReference: string | null;
};
export interface MaintenanceReadback extends MaintenanceReceipt {
  attemptId: string;
  contract: VersionReference;
  rule: VersionReference;
  reason: MaintenanceProposal["reason"];
  relationship: "authoritative_action_event_visit" | "same_subject_day_only" | "unknown";
}
export interface MaintenanceReportInput {
  expected: MaintenanceBinding;
  now: string;
  assignedTo: string | null;
  local: {
    callMatch: Pick<CallMatchRecord, "id" | "officeId" | "visitId" | "state" | "hhaVerification"> | null;
    exception: Pick<ExceptionReviewRecord, "id" | "officeId" | "visitId" | "state" | "hhaVerification"> | null;
  };
  proposal: MaintenanceProposal | null;
  acceptance: MaintenanceAcceptance | null;
  beforeReceipt: MaintenanceReceipt | null;
  submission: MaintenanceSubmission;
  readback: MaintenanceReadback | null;
}
export type MaintenanceReportStatus = "local_review" | "draft_proposal" | "unsupported" | "unresolved" | "submission_pending" | "outcome_unknown" | "source_verified";
export type MaintenanceObstacle = "proposal_missing" | "contract_unaccepted" | "contract_expired" | "invalid_evidence" | "review_missing" | "rule_mismatch" | "catalog_mismatch" | "original_events_missing" | "event_conflict" | "before_read_missing" | "before_read_stale" | "before_values_conflict" | "submission_missing" | "readback_missing" | "readback_stale" | "readback_not_independent" | "readback_precedes_submission" | "attempt_mismatch" | "link_unestablished" | "readback_contract_mismatch" | "persisted_values_conflict";
export interface MaintenanceReport {
  status: MaintenanceReportStatus;
  hhaOutcome: "independently_verified" | "not_established";
  evidence: MaintenanceReportInput;
  obstacles: { code: MaintenanceObstacle; nextStep: string }[];
  explanation: string;
}
const NEXT: Record<MaintenanceObstacle, string> = {
  proposal_missing: "Prepare a scoped proposal from genuine source evidence; local review alone is not HHA confirmation.",
  contract_unaccepted: "Obtain the supported action, event linkage, catalog and independent readback contract; keep execution closed.",
  contract_expired: "Revalidate the expired action acceptance before interpreting a source outcome.",
  invalid_evidence: "Correct missing or invalid receipt identities, timestamps or field coverage from protected source evidence.",
  review_missing: "Record the proposal actor, explanation and review evidence required by the applicable accepted policy.",
  rule_mismatch: "Reconcile the exact approved rule ID, version and reference; do not infer a policy.",
  catalog_mismatch: "Validate the exact applicable reason/action catalog, raw codes and required note; do not map an API error to a reason.",
  original_events_missing: "Obtain genuine source event identities and original timestamps; do not manufacture an end time.",
  event_conflict: "Reconcile changed or conflicting event references, hashes or original times without rewriting originals.",
  before_read_missing: "Obtain the exact before-state source receipt for this proposal.",
  before_read_stale: "Refresh the before-state evidence and review the proposal against any changes.",
  before_values_conflict: "Reconcile the proposal with the before-state source values.",
  submission_missing: "No submission is recorded; keep the reviewed proposal separate from a completed HHA action.",
  readback_missing: "Reconcile this exact attempt with independent source readback before retrying or reporting completion.",
  readback_stale: "Refresh independent source readback under the accepted freshness policy.",
  readback_not_independent: "Obtain a distinct source read, not the before receipt or submission acknowledgement.",
  readback_precedes_submission: "Obtain an independent readback after the recorded attempt.",
  attempt_mismatch: "Resolve which exact submission attempt the readback establishes; do not join by subject/day.",
  link_unestablished: "Establish authoritative action/event/visit linkage; subject/day coincidence is insufficient.",
  readback_contract_mismatch: "Reconcile readback contract, rule and reason receipts with the accepted proposal.",
  persisted_values_conflict: "Review the actual persisted values; they do not exactly establish this proposed result.",
};
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const version = (value: VersionReference | null): boolean => !!value && [value.id, value.version, value.reference].every(text);
const sameVersion = (a: VersionReference | null, b: VersionReference | null) => a === null || b === null ? a === b : a.id === b.id && a.version === b.version && a.reference === b.reference;
const hash = (value: string) => /^[a-f0-9]{64}$/.test(value);
const sameBinding = (a: MaintenanceBinding, b: MaintenanceBinding) => sameEvidenceScope(a.scope, b.scope)
  && a.patientId === b.patientId && a.caregiverId === b.caregiverId && a.visitId === b.visitId
  && a.actionId === b.actionId && a.actionKind === b.actionKind;
const sameEvents = (a: readonly OriginalEvent[], b: readonly OriginalEvent[]) => a.length === b.length && a.every(event => b.some(other => event.id === other.id && event.sourceReference === other.sourceReference && event.sourceHash === other.sourceHash && event.originalTime === other.originalTime));
const exactFields = (values: Readonly<Record<string, string | null>>, fields: readonly string[]) => Object.keys(values).length === fields.length && fields.every(field => Object.hasOwn(values, field) && (values[field] === null || typeof values[field] === "string"));
const sameValues = (a: Readonly<Record<string, string | null>>, b: Readonly<Record<string, string | null>>, fields: readonly string[]) => exactFields(a, fields) && exactFields(b, fields) && fields.every(field => a[field] === b[field]);
const validEvents = (events: readonly OriginalEvent[]) => events.length > 0 && new Set(events.map(e => e.id)).size === events.length && events.every(e => text(e.id) && text(e.sourceReference) && hash(e.sourceHash) && text(e.originalTime));
const validReceipt = (r: MaintenanceReceipt) => text(r.id) && text(r.sourceReference) && hash(r.sourceHash) && validEvents(r.events);

export function projectMaintenanceReport(input: MaintenanceReportInput): MaintenanceReport {
  // Refuse cross-scope projection before returning any private record contents.
  const expected = input.expected;
  validEvidenceScope(expected.scope);
  for (const id of [expected.patientId, expected.caregiverId, expected.visitId]) identifier(id);
  if (!text(expected.actionId) || !text(expected.actionKind)) throw new WorkflowError("invalid_maintenance_binding");
  for (const item of [input.proposal, input.acceptance, input.beforeReceipt, input.readback, input.submission.state === "not_submitted" ? null : input.submission]) {
    if (item && !sameBinding(expected, item.binding)) throw new WorkflowError("maintenance_report_scope_mismatch", 403);
  }
  for (const local of [input.local.callMatch, input.local.exception]) {
    if (local && (local.officeId !== expected.scope.officeId || local.visitId !== expected.visitId)) throw new WorkflowError("maintenance_report_scope_mismatch", 403);
  }
  const obstacles: MaintenanceObstacle[] = [];
  const add = (code: MaintenanceObstacle) => { if (!obstacles.includes(code)) obstacles.push(code); };
  const proposal = input.proposal, acceptance = input.acceptance, before = input.beforeReceipt, readback = input.readback, submission = input.submission;
  const output = (status: MaintenanceReportStatus): MaintenanceReport => ({
    status, hhaOutcome: status === "source_verified" ? "independently_verified" as const : "not_established" as const,
    // Detached copies retain exact source references/raw event times without mutation.
    evidence: structuredClone(input), obstacles: obstacles.map(code => ({ code, nextStep: NEXT[code] })),
    explanation: status === "source_verified" ? "Independent source readback establishes the exact reviewed action result under the supplied accepted contract." : "No HHA maintenance resolution is established by this projection.",
  });
  if (!proposal) { add("proposal_missing"); return output(submission.state === "pending" ? "submission_pending" : submission.state !== "not_submitted" ? "outcome_unknown" : "local_review"); }
  if (!acceptance) add("contract_unaccepted");
  try {
    const now = normalizedInstant(input.now).epochMs;
    if (acceptance) {
      if (!version(acceptance.contract) || !version(acceptance.rule) || !acceptance.fields.length || new Set(acceptance.fields).size !== acceptance.fields.length || !acceptance.fields.every(text)
        || typeof acceptance.noteRequired !== "boolean" || typeof acceptance.independentReviewRequired !== "boolean") add("invalid_evidence");
      if (normalizedInstant(acceptance.validUntil).epochMs < now) add("contract_expired");
      evidenceIsFresh(input.now, input.now, acceptance.maxAgeSeconds);
      if (!sameVersion(proposal.rule, acceptance.rule)) add("rule_mismatch");
      if (acceptance.catalog ? !version(acceptance.catalog) || !proposal.reason || !sameVersion(proposal.reason.catalog, acceptance.catalog) || !text(proposal.reason.code) || !text(proposal.reason.actionCode) || (acceptance.noteRequired && !text(proposal.reason.note)) : proposal.reason !== null || acceptance.noteRequired) add("catalog_mismatch");
    }
    if (proposal.state !== "reviewed" || !text(proposal.actorId) || !text(proposal.explanation)
      || (acceptance?.independentReviewRequired && (!text(proposal.reviewerId) || proposal.actorId === proposal.reviewerId))) add("review_missing");
    if (!validEvents(proposal.events)) add("original_events_missing");
    if (!before) add("before_read_missing");
    else {
      if (!validReceipt(before)) add("invalid_evidence");
      if (!sameEvents(proposal.events, before.events)) add("event_conflict");
      // Before evidence freshness is judged at submission for historical outcomes.
      const at = submission.state === "not_submitted" ? input.now : submission.submittedAt;
      if (normalizedInstant(at).epochMs > now) add("invalid_evidence");
      if (acceptance && !evidenceIsFresh(before.fetchedAt, at, acceptance.maxAgeSeconds)) add("before_read_stale");
      if (acceptance && !sameValues(before.values, proposal.before, acceptance.fields)) add("before_values_conflict");
    }
    if (submission.state === "not_submitted") add("submission_missing");
    else {
      if (!text(submission.attemptId) || normalizedInstant(submission.submittedAt).epochMs > now) add("invalid_evidence");
      if (!readback) add("readback_missing");
      else {
        if (!validReceipt(readback)) add("invalid_evidence");
        if (!sameEvents(proposal.events, readback.events)) add("event_conflict");
        if (readback.attemptId !== submission.attemptId) add("attempt_mismatch");
        if (readback.relationship !== "authoritative_action_event_visit") add("link_unestablished");
        if (readback.id === before?.id || readback.sourceReference === before?.sourceReference || readback.sourceReference === submission.responseReference) add("readback_not_independent");
        if (normalizedInstant(readback.fetchedAt).epochMs <= normalizedInstant(submission.submittedAt).epochMs) add("readback_precedes_submission");
        if (acceptance && !evidenceIsFresh(readback.fetchedAt, input.now, acceptance.maxAgeSeconds)) add("readback_stale");
        if (acceptance && (!sameVersion(readback.contract, acceptance.contract) || !sameVersion(readback.rule, acceptance.rule) || !sameVersion(readback.reason?.catalog ?? null, acceptance.catalog) || readback.reason?.code !== proposal.reason?.code || readback.reason?.actionCode !== proposal.reason?.actionCode || readback.reason?.note !== proposal.reason?.note)) add("readback_contract_mismatch");
        if (acceptance && !sameValues(readback.values, proposal.proposed, acceptance.fields)) add("persisted_values_conflict");
      }
    }
  } catch { add("invalid_evidence"); }
  if (!obstacles.length) return output("source_verified");
  // A possible write retains its uncertainty even if contract/evidence is missing.
  if (submission.state === "pending") return output("submission_pending");
  if (submission.state !== "not_submitted") return output("outcome_unknown");
  if (!acceptance) return output("unsupported");
  return output(proposal.state === "draft" ? "draft_proposal" : "unresolved");
}
