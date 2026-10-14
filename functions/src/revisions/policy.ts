import { WorkflowError, identifier } from "../operations/reads.js";
import type { Versioned, WorkspaceRepository } from "../operations/workspace.js";
import { normalizedInstant } from "./evidence.js";
import { normalizeUsPhone, type NotificationContact } from "./notifications.js";
import { validVerificationReceiptAcceptance, type VerificationReceiptAcceptance } from "./verification.js";

export interface RevisionPolicy extends Versioned {
  officeId: string; monitoringEnabled: boolean; earlyReminderMinutes: number | null;
  quietHours: { startHour: number; endHour: number } | null;
  smsPolicyReference: string; supervisorRecipientRefs: string[];
  tokenInstructions: string | null; tokenInstructionsReference: string;
}
// Provisioned by a trusted server operator after vendor acceptance, never via
// the dashboard. Deployment approval is a separate prerequisite.
export interface SourceContract extends Versioned {
  officeId: string; version: string; reviewReference: string; validUntil: string;
  offsetsValidated: boolean; completeFieldSemantics: boolean;
  missingEvvMeansAbsent: boolean; serviceTimeBasis: "actual" | "evv";
  nullEndMeansOpen: boolean; clockingAttemptFromEvv: boolean;
  fixedVisitTypes: string[]; variableVisitTypes: string[];
  clockingMethodField: string | null; tokenValues: string[];
  callsAccepted: boolean; maxAgeSeconds: number;
  verificationReceipt?: VerificationReceiptAcceptance;
}
export interface ContactRecord extends Versioned, NotificationContact { reviewedBy: string; reviewReference: string; }
type Repository = Pick<WorkspaceRepository, "get" | "page" | "change">;
export function strictObject(value: unknown, keys: readonly string[], required: readonly string[] = keys): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_revision_request");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !keys.includes(key)) || required.some(key => !Object.hasOwn(input, key))) throw new WorkflowError("unsupported_revision_field");
  return input;
}
export function recordId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new WorkflowError("invalid_revision_reference");
  return value;
}
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== "string" || value.length > max || /[\x00-\x1f\x7f]/.test(value) || (!empty && !value.trim())) throw new WorkflowError("invalid_revision_text");
  return value.trim();
}
export function expectedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1_000_000) throw new WorkflowError("invalid_revision");
  return Number(value);
}
export function bool(value: unknown): boolean { if (typeof value !== "boolean") throw new WorkflowError("invalid_revision_boolean"); return value; }
export function defaultRevisionPolicy(officeId: string): RevisionPolicy {
  return { id: "owner", revision: 0, updatedAt: new Date(0).toISOString(), officeId,
    monitoringEnabled: false, earlyReminderMinutes: null, quietHours: null,
    smsPolicyReference: "", supervisorRecipientRefs: [], tokenInstructions: null, tokenInstructionsReference: "" };
}
export class RevisionConfiguration {
  constructor(private repository: Repository, private officeId: string, private now: () => Date = () => new Date()) { identifier(officeId); }
  async policy() {
    const value = await this.repository.get<RevisionPolicy>("revisionPolicies_office_" + this.officeId, "owner") ?? defaultRevisionPolicy(this.officeId);
    if (value.officeId !== this.officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return value;
  }
  async savePolicy(value: unknown, actor: string) {
    const input = strictObject(value, ["revision", "monitoringEnabled", "earlyReminderMinutes", "quietHours", "smsPolicyReference", "supervisorRecipientRefs", "tokenInstructions", "tokenInstructionsReference"]);
    const early = input.earlyReminderMinutes;
    if (early !== null && (!Number.isInteger(early) || Number(early) < 1 || Number(early) > 1440)) throw new WorkflowError("invalid_early_reminder_threshold");
    let quiet: RevisionPolicy["quietHours"] = null;
    if (input.quietHours !== null) {
      const item = strictObject(input.quietHours, ["startHour", "endHour"]);
      if (![item.startHour, item.endHour].every(hour => Number.isInteger(hour) && Number(hour) >= 0 && Number(hour) <= 23) || item.startHour === item.endHour) throw new WorkflowError("invalid_quiet_hours");
      quiet = { startHour: Number(item.startHour), endHour: Number(item.endHour) };
    }
    if (!Array.isArray(input.supervisorRecipientRefs) || input.supervisorRecipientRefs.length > 25) throw new WorkflowError("invalid_supervisor_recipients");
    const refs = input.supervisorRecipientRefs.map(recordId);
    if (new Set(refs).size !== refs.length) throw new WorkflowError("duplicate_supervisor_recipient");
    const next = { id: "owner", officeId: this.officeId, revision: expectedRevision(input.revision) + 1, updatedAt: this.now().toISOString(),
      monitoringEnabled: bool(input.monitoringEnabled), earlyReminderMinutes: early as number | null, quietHours: quiet,
      smsPolicyReference: text(input.smsPolicyReference, 500, true), supervisorRecipientRefs: refs,
      tokenInstructions: input.tokenInstructions === null ? null : text(input.tokenInstructions, 250), tokenInstructionsReference: text(input.tokenInstructionsReference, 500, true) };
    if (next.tokenInstructions && !next.tokenInstructionsReference) throw new WorkflowError("token_instruction_reference_required");
    return this.repository.change<RevisionPolicy>("revisionPolicies_office_" + this.officeId, "owner", expectedRevision(input.revision), actor, "revision_policy_saved", () => next);
  }
  async sourceContract(): Promise<SourceContract | null> {
    const item = await this.repository.get<SourceContract>("revisionSourceAcceptance_office_" + this.officeId, "owner");
    if (!item) return null;
    try {
      if (item.officeId !== this.officeId || !/^[A-Za-z0-9_.:-]{1,80}$/.test(item.version) || !item.reviewReference || item.offsetsValidated !== true || item.completeFieldSemantics !== true
        || !["actual", "evv"].includes(item.serviceTimeBasis) || !Number.isInteger(item.maxAgeSeconds) || item.maxAgeSeconds < 60 || item.maxAgeSeconds > 3600
        || ![item.fixedVisitTypes, item.variableVisitTypes, item.tokenValues].every(items => Array.isArray(items) && items.length <= 30 && items.every(value => typeof value === "string" && value.length <= 80))
        || ![item.missingEvvMeansAbsent, item.nullEndMeansOpen, item.clockingAttemptFromEvv, item.callsAccepted].every(value => typeof value === "boolean")
        || (item.clockingMethodField !== null && !["VisitType"].includes(item.clockingMethodField))) return null;
      if (item.verificationReceipt !== undefined && !validVerificationReceiptAcceptance(item.verificationReceipt, item.version)) return null;
      if (normalizedInstant(item.validUntil).epochMs <= this.now().getTime()) return null;
    } catch { return null; }
    return item;
  }
  async contact(ref: string): Promise<ContactRecord | null> {
    const item = await this.repository.get<ContactRecord>("revisionContacts_office_" + this.officeId, recordId(ref));
    if (item && (item.officeId !== this.officeId || item.recipientRef !== ref)) throw new WorkflowError("office_scope_mismatch", 403);
    return item;
  }
  async contacts(cursor?: string) {
    const page = await this.repository.page<ContactRecord>("revisionContacts_office_" + this.officeId, cursor);
    if (page.items.some(item => item.officeId !== this.officeId)) throw new WorkflowError("office_scope_mismatch", 403);
    return page;
  }
  async saveContact(value: unknown, actor: string): Promise<ContactRecord> {
    const input = strictObject(value, ["id", "revision", "kind", "phone", "firstName", "smsAllowed", "optedOut", "reviewReference"]);
    const ref = recordId(input.id), kind = input.kind;
    if (kind !== "caregiver" && kind !== "supervisor") throw new WorkflowError("invalid_contact_kind");
    if (kind === "caregiver" && !/^caregiver_[1-9]\d{0,9}$/.test(ref)) throw new WorkflowError("caregiver_contact_reference_required");
    if (kind === "caregiver") identifier(ref.slice(10));
    const expected = expectedRevision(input.revision), at = this.now().toISOString();
    const next: ContactRecord = { id: ref, recipientRef: ref, officeId: this.officeId, revision: expected + 1, updatedAt: at,
      kind, phone: normalizeUsPhone(input.phone as string), firstName: text(input.firstName, 50), smsAllowed: bool(input.smsAllowed), optedOut: bool(input.optedOut),
      validatedAt: at, reviewedBy: actor, reviewReference: text(input.reviewReference, 500) };
    return this.repository.change<ContactRecord>("revisionContacts_office_" + this.officeId, ref, expected, actor, "revision_contact_reviewed", prior => {
      if (prior && prior.kind !== kind) throw new WorkflowError("contact_kind_immutable", 409);
      return next;
    });
  }
}
