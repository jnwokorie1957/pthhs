import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Versioned, WorkspacePage, WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError } from "../operations/reads.js";

export type NotificationRule = "missing_clock_out" | "early_ended" | "missing_token_days" | "supervisor_overage" | "supervisor_overlap";
export interface NotificationContext { officeId: string; actorId: string; roles: readonly string[]; dataApproved: boolean; mode: "demo" | "live"; }
export interface NotificationRequest { rule: NotificationRule; visitId: string; occurrenceId: string; recipientRef: string; }
/** Only a server adapter may produce this evidence. Never deserialize it from a browser request. */
export interface NotificationEvidence {
  officeId: string; visitId: string; rule: NotificationRule; occurrenceId: string;
  source: "server_verified"; validation: "validated"; sourceRevision: string; ruleVersion: string;
  observedAt: string; detectedAt: string; conditionActive: boolean;
  eligibleRecipientRefs: readonly string[];
  scheduledEnd?: string; actualEnd?: string; remainingMinutes?: number;
  missingServiceDates?: readonly string[]; verifiedVendorInstructions?: string;
}
export interface NotificationEvidenceSource { load(request: NotificationRequest, context: NotificationContext): Promise<NotificationEvidence>; }
export interface NotificationContact {
  officeId: string; recipientRef: string; kind: "caregiver" | "supervisor"; phone: string;
  firstName: string; validatedAt: string; smsAllowed: boolean; optedOut: boolean;
}
export interface NotificationContactSource { getContact(officeId: string, recipientRef: string): Promise<NotificationContact | null>; }
export type DeliveryState = "queued" | "claimed" | "accepted" | "delivered" | "failed" | "unknown" | "suppressed";
export interface ProviderResult { state: "accepted" | "delivered" | "failed" | "unknown" | "not_submitted"; providerId: string | null; errorCode?: string; }
export interface NotificationSubmission { outboxId: string; attemptId: string; to: string; body: string; }
export interface NotificationDeliveryAdapter {
  submit(input: NotificationSubmission): Promise<ProviderResult>;
  reconcile(input: { outboxId: string; attemptId: string; providerId: string | null }): Promise<ProviderResult>;
}
export interface NotificationConfig {
  capabilityApproved?: boolean; configurationApproved?: boolean; sendApproved?: boolean;
  maxEvidenceAgeMs?: number; maxContactAgeMs?: number; leaseMs?: number;
  /** Server policy must implement approved office-local quiet hours/cadence. Missing policy blocks delivery. */
  canSend?: (officeId: string, rule: NotificationRule, at: string) => Promise<boolean>;
}
export interface NotificationOutboxRecord extends Versioned, NotificationRequest {
  officeId: string; ruleVersion: string; sourceRevision: string; sourceObservedAt: string;
  detectedAt: string; plannedSendAt: string; deadlineAt: string | null; templateVersion: "friendly-v1";
  state: DeliveryState; attemptCount: number; attemptId: string | null; leaseExpiresAt: string | null;
  providerId: string | null; providerErrorCode: string | null; recipientFingerprint: string;
  acceptedAt: string | null; deliveredAt: string | null;
  acknowledgement: { actorId: string; at: string; note: string } | null;
  suppression: { at: string; reason: string } | null;
}
type Repository = Pick<WorkspaceRepository, "get" | "page" | "change"> & {
  /** Active-state query ordered by ascending document ID. Boundaries are raw document IDs. */
  pageActiveNotifications?<T extends Versioned>(collection: string, afterId?: string): Promise<WorkspacePage<T>>;
};
const RULES: readonly NotificationRule[] = ["missing_clock_out", "early_ended", "missing_token_days", "supervisor_overage", "supervisor_overlap"];
const terminal = (state: DeliveryState) => ["delivered", "failed", "suppressed"].includes(state);
const active = (state: DeliveryState) => ["queued", "claimed", "unknown", "accepted"].includes(state);
export function notificationDeliveryCursor(value: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new WorkflowError("invalid_notification_delivery_cursor");
  return Buffer.from(JSON.stringify({ id: value })).toString("base64url");
}
function deliveryBoundary(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    if (typeof value !== "string" || value.length > 150 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { id?: unknown };
    if (!parsed || Object.keys(parsed).length !== 1 || typeof parsed.id !== "string" || notificationDeliveryCursor(parsed.id) !== value) throw new Error();
    return parsed.id;
  } catch { throw new WorkflowError("invalid_notification_delivery_cursor"); }
}
const id = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) throw new WorkflowError("invalid_notification_reference");
  return value;
};
function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new WorkflowError("invalid_notification_time");
  return Date.parse(value);
}
function display(value: unknown, max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new WorkflowError("invalid_notification_template_value");
  return value.trim();
}
function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < min || result > max) throw new WorkflowError("invalid_notification_configuration");
  return result;
}
export function normalizeUsPhone(value: string): string {
  if (typeof value !== "string" || value.length > 40 || !/^\+?[\d ()\-.]+$/.test(value.trim())) throw new WorkflowError("invalid_sms_phone");
  const digits = value.replace(/[^\d]/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if ((value.includes("+") && !value.trim().startsWith("+1")) || !/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new WorkflowError("invalid_sms_phone");
  return "+1" + national;
}
export function notificationKey(officeId: string, request: NotificationRequest): string {
  return createHash("sha256").update(JSON.stringify([id(officeId), id(request.visitId), request.rule, id(request.occurrenceId), id(request.recipientRef)])).digest("hex");
}
function validateRequest(request: NotificationRequest): NotificationRequest {
  if (!request || Object.keys(request).some(key => !["rule", "visitId", "occurrenceId", "recipientRef"].includes(key)) || !RULES.includes(request.rule)) throw new WorkflowError("invalid_notification_request");
  return { rule: request.rule, visitId: id(request.visitId), occurrenceId: id(request.occurrenceId), recipientRef: id(request.recipientRef) };
}
export function friendlySms(evidence: NotificationEvidence, contact: NotificationContact): string {
  const name = display(contact.firstName, 50);
  switch (evidence.rule) {
    case "missing_clock_out": return `Hi ${name}, this is Primetime. Your visit was scheduled to end at ${display(evidence.scheduledEnd)}, and we have not received a clock-out. If you have finished, please use your approved clock-out method. If care is still in progress or you need help recording the end, please contact the office. Thank you.`;
    case "early_ended": {
      if (!Number.isInteger(evidence.remainingMinutes) || evidence.remainingMinutes! <= 0 || evidence.remainingMinutes! > 1440) throw new WorkflowError("invalid_notification_template_value");
      return `Hi ${name}, we received your clock-out at ${display(evidence.actualEnd)}. Your scheduled end was ${display(evidence.scheduledEnd)}, with ${evidence.remainingMinutes} minutes remaining. Was ending early intentional? If care was complete or the member asked you to leave, that is okay. Please contact the office to confirm or if the record needs review.`;
    }
    case "missing_token_days": {
      if (!Array.isArray(evidence.missingServiceDates) || !evidence.missingServiceDates.length || evidence.missingServiceDates.length > 366) throw new WorkflowError("invalid_notification_token_dates");
      const dates = new Set(evidence.missingServiceDates.map(date => {
        if (!/^\d{4}-\d\d-\d\d$/.test(date) || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) throw new WorkflowError("invalid_notification_token_dates");
        return date;
      }));
      return `Hi ${name}, this is a friendly Primetime reminder. We are missing token-device entries for ${dates.size} visit days. Please submit your recorded device codes using ${display(evidence.verifiedVendorInstructions, 250)}. If the device did not work or you no longer have the codes, please contact the office so we can review the visits. Thank you.`;
    }
    case "supervisor_overage": return "Primetime visit review needed: recorded time may exceed the scheduled time. Please review the source evidence and any approved additional care in the secure office dashboard within 24 hours. Record the time actually worked; this alert does not change or verify an HHA visit.";
    case "supervisor_overlap": return "Primetime visit review needed: recorded service intervals may overlap. Please review the source evidence, applicable program and authorizations in the secure office dashboard within 24 hours. Some overlaps may be allowed; this alert does not change or verify an HHA visit.";
  }
}

export class NotificationOutbox {
  private readonly evidenceAge: number;
  private readonly contactAge: number;
  private readonly leaseMs: number;
  constructor(private repository: Repository, private evidence: NotificationEvidenceSource, private contacts: NotificationContactSource, private adapter?: NotificationDeliveryAdapter, private config: NotificationConfig = {}, private clock: () => number = Date.now) {
    this.evidenceAge = bounded(config.maxEvidenceAgeMs, 5 * 60_000, 1_000, 15 * 60_000);
    this.contactAge = bounded(config.maxContactAgeMs, 30 * 86_400_000, 1_000, 90 * 86_400_000);
    this.leaseMs = bounded(config.leaseMs, 60_000, 5_000, 5 * 60_000);
  }
  private collection(officeId: string) { return `revisionNotificationOutbox_${id(officeId)}`; }
  private guard(context: NotificationContext, sending = false) {
    id(context.officeId); id(context.actorId);
    if (context.mode !== "live" || !context.dataApproved) throw new WorkflowError("notification_live_data_not_approved", 423);
    if (!context.roles.some(role => ["owner", "admin", "office_supervisor", "supervisor", "worker", "service"].includes(role))) throw new WorkflowError("notification_role_required", 403);
    if (this.config.capabilityApproved !== true || this.config.configurationApproved !== true) throw new WorkflowError("notification_capability_not_approved", 423);
    if (sending && (this.config.sendApproved !== true || !this.adapter || !this.config.canSend)) throw new WorkflowError("notification_send_not_approved", 423);
  }
  private scoped(record: NotificationOutboxRecord, context: NotificationContext) {
    if (record.officeId !== context.officeId || record.id !== notificationKey(context.officeId, record)) throw new WorkflowError("notification_office_scope_mismatch", 403);
  }
  private async loadEvidence(request: NotificationRequest, context: NotificationContext): Promise<NotificationEvidence> {
    const evidence = await this.evidence.load({ rule: request.rule, visitId: request.visitId, occurrenceId: request.occurrenceId, recipientRef: request.recipientRef }, context);
    this.validateEvidence(evidence, request, context); return evidence;
  }
  private validateEvidence(evidence: NotificationEvidence, request: NotificationRequest, context: NotificationContext) {
    const now = this.clock();
    if (evidence.source !== "server_verified" || evidence.validation !== "validated" || evidence.officeId !== context.officeId || evidence.visitId !== request.visitId || evidence.rule !== request.rule || evidence.occurrenceId !== request.occurrenceId) throw new WorkflowError("notification_source_evidence_mismatch", 409);
    if (!Array.isArray(evidence.eligibleRecipientRefs) || evidence.eligibleRecipientRefs.length > 100 || !evidence.eligibleRecipientRefs.includes(request.recipientRef)) throw new WorkflowError("notification_recipient_not_source_authorized", 403);
    id(evidence.sourceRevision); id(evidence.ruleVersion);
    const observed = instant(evidence.observedAt), detected = instant(evidence.detectedAt);
    if (observed > now || now - observed > this.evidenceAge || detected > observed) throw new WorkflowError("notification_source_evidence_stale", 409);
    if (typeof evidence.conditionActive !== "boolean") throw new WorkflowError("notification_source_evidence_unvalidated", 409);
  }
  private async loadContact(request: NotificationRequest, context: NotificationContext): Promise<NotificationContact & { phone: string }> {
    const contact = await this.contacts.getContact(context.officeId, request.recipientRef), now = this.clock();
    if (!contact || contact.officeId !== context.officeId || contact.recipientRef !== request.recipientRef) throw new WorkflowError("notification_contact_scope_mismatch", 403);
    const expectedKind = request.rule.startsWith("supervisor_") ? "supervisor" : "caregiver";
    if (contact.kind !== expectedKind) throw new WorkflowError("notification_recipient_kind_mismatch", 403);
    const validated = instant(contact.validatedAt);
    if (validated > now || now - validated > this.contactAge) throw new WorkflowError("notification_contact_not_validated", 409);
    if (!contact.smsAllowed || contact.optedOut) throw new WorkflowError("notification_contact_opted_out", 409);
    return { ...contact, phone: normalizeUsPhone(contact.phone) };
  }
  private async mutate(record: NotificationOutboxRecord, context: NotificationContext, action: string, changes: Partial<NotificationOutboxRecord>): Promise<NotificationOutboxRecord> {
    return this.repository.change<NotificationOutboxRecord>(this.collection(context.officeId), record.id, record.revision, context.actorId, action, prior => {
      if (!prior) throw new WorkflowError("notification_not_found", 404);
      this.scoped(prior, context);
      return { ...prior, ...changes, id: prior.id, officeId: prior.officeId, revision: prior.revision + 1, updatedAt: new Date(this.clock()).toISOString() };
    });
  }
  private async read(outboxId: string, context: NotificationContext) {
    if (!/^[a-f0-9]{64}$/.test(outboxId)) throw new WorkflowError("invalid_notification_reference");
    const record = await this.repository.get<NotificationOutboxRecord>(this.collection(context.officeId), outboxId);
    if (!record) throw new WorkflowError("notification_not_found", 404);
    this.scoped(record, context); return record;
  }
  async queue(value: NotificationRequest, context: NotificationContext): Promise<NotificationOutboxRecord> {
    this.guard(context); const request = validateRequest(value), outboxId = notificationKey(context.officeId, request);
    const existing = await this.repository.get<NotificationOutboxRecord>(this.collection(context.officeId), outboxId);
    if (existing) { this.scoped(existing, context); return existing; }
    const evidence = await this.loadEvidence(request, context), contact = await this.loadContact(request, context);
    friendlySms(evidence, contact); // Validate server template values before persisting an actionable item.
    const now = new Date(this.clock()).toISOString();
    const record: NotificationOutboxRecord = { ...request, id: outboxId, officeId: context.officeId, revision: 1, updatedAt: now,
      ruleVersion: evidence.ruleVersion, sourceRevision: evidence.sourceRevision, sourceObservedAt: evidence.observedAt,
      detectedAt: evidence.detectedAt, plannedSendAt: now, deadlineAt: request.rule.startsWith("supervisor_") ? new Date(instant(evidence.detectedAt) + 24 * 3_600_000).toISOString() : null,
      templateVersion: "friendly-v1", state: evidence.conditionActive ? "queued" : "suppressed", attemptCount: 0, attemptId: null, leaseExpiresAt: null,
      providerId: null, providerErrorCode: null, recipientFingerprint: createHash("sha256").update(contact.phone).digest("hex"), acceptedAt: null, deliveredAt: null, acknowledgement: null,
      suppression: evidence.conditionActive ? null : { at: now, reason: "condition_resolved" } };
    try { return await this.repository.change(this.collection(context.officeId), outboxId, 0, context.actorId, "notification_queued", () => record); }
    catch (error) { if (error instanceof WorkflowError && error.code === "revision_conflict") return this.read(outboxId, context); throw error; }
  }
  async page(context: NotificationContext, cursor?: string): Promise<WorkspacePage<NotificationOutboxRecord>> {
    this.guard(context); const page = await this.repository.page<NotificationOutboxRecord>(this.collection(context.officeId), cursor);
    page.items.forEach(record => this.scoped(record, context)); return page;
  }
  async deliveryPage(context: NotificationContext, cursor?: string): Promise<WorkspacePage<NotificationOutboxRecord>> {
    this.guard(context);
    const afterId = deliveryBoundary(cursor), collection = this.collection(context.officeId);
    let page: WorkspacePage<NotificationOutboxRecord>;
    if (this.repository.pageActiveNotifications) {
      page = await this.repository.pageActiveNotifications<NotificationOutboxRecord>(collection, afterId);
      if (page.items.length > 100 || page.items.some((record, index) => !active(record.state) || afterId !== undefined && record.id <= afterId || index > 0 && record.id <= page.items[index - 1]!.id)
        || page.nextCursor !== null && page.nextCursor !== page.items.at(-1)?.id) throw new WorkflowError("invalid_notification_delivery_page", 503);
    } else {
      // Test repositories may only expose their ordinary in-memory page.
      const source = await this.repository.page<NotificationOutboxRecord>(collection);
      const eligible = source.items.filter(record => active(record.state) && (afterId === undefined || record.id > afterId)).sort((left, right) => left.id.localeCompare(right.id));
      const items = eligible.slice(0, 100);
      page = { items, nextCursor: eligible.length > 100 ? items.at(-1)!.id : null };
    }
    page.items.forEach(record => this.scoped(record, context));
    return { items: page.items, nextCursor: page.nextCursor === null ? null : notificationDeliveryCursor(page.nextCursor) };
  }
  async get(outboxId: string, context: NotificationContext): Promise<NotificationOutboxRecord> { this.guard(context); return this.read(outboxId, context); }
  async send(outboxId: string, context: NotificationContext): Promise<NotificationOutboxRecord> {
    this.guard(context, true); let record = await this.read(outboxId, context);
    if (record.state === "claimed" && instant(record.leaseExpiresAt) <= this.clock()) return this.reconcile(outboxId, context);
    if (record.state !== "queued") return record; // No automatic retries, including uncertain or failed deliveries.
    if (!await this.config.canSend!(context.officeId, record.rule, new Date(this.clock()).toISOString())) return record;
    const attemptId = randomUUID();
    try { record = await this.mutate(record, context, "notification_claimed", { state: "claimed", attemptId, attemptCount: record.attemptCount + 1, leaseExpiresAt: new Date(this.clock() + this.leaseMs).toISOString() }); }
    catch (error) { if (error instanceof WorkflowError && error.code === "revision_conflict") return this.read(outboxId, context); throw error; }
    let evidence: NotificationEvidence, contact: NotificationContact & { phone: string }, body: string;
    try {
      evidence = await this.loadEvidence(record, context);
      if (!evidence.conditionActive) return await this.mutate(record, context, "notification_suppressed", { state: "suppressed", leaseExpiresAt: null, suppression: { at: new Date(this.clock()).toISOString(), reason: "condition_resolved" } });
      contact = await this.loadContact(record, context); body = friendlySms(evidence, contact);
      if (!await this.config.canSend!(context.officeId, record.rule, new Date(this.clock()).toISOString())) return await this.mutate(record, context, "notification_policy_deferred", { state: "queued", leaseExpiresAt: null });
      this.guard(context, true); this.validateEvidence(evidence, record, context);
      if (instant(record.leaseExpiresAt) <= this.clock()) return await this.mutate(record, context, "notification_claim_expired_before_dispatch", { state: "unknown", leaseExpiresAt: null, providerErrorCode: "claim_expired_reconciliation_required" });
      record = await this.mutate(record, context, "notification_dispatch_evidence_checked", { sourceRevision: evidence.sourceRevision, sourceObservedAt: evidence.observedAt, recipientFingerprint: createHash("sha256").update(contact.phone).digest("hex") });
      this.guard(context, true); this.validateEvidence(evidence, record, context);
      if (instant(record.leaseExpiresAt) <= this.clock()) return await this.mutate(record, context, "notification_claim_expired_before_dispatch", { state: "unknown", leaseExpiresAt: null, providerErrorCode: "claim_expired_reconciliation_required" });
    } catch (error) {
      // No adapter call has occurred. Opt-out suppresses; unavailable evidence remains queued for a fresh check.
      const optedOut = error instanceof WorkflowError && error.code === "notification_contact_opted_out";
      try { await this.mutate(record, context, optedOut ? "notification_opt_out_suppressed" : "notification_source_check_failed", { state: optedOut ? "suppressed" : "queued", leaseExpiresAt: null, ...(optedOut ? { suppression: { at: new Date(this.clock()).toISOString(), reason: "contact_opted_out" } } : {}) }); } catch { /* A concurrent state change wins. */ }
      throw error;
    }
    let result: ProviderResult;
    try { result = await this.adapter!.submit({ outboxId: record.id, attemptId, to: contact.phone, body }); }
    catch { result = { state: "unknown", providerId: null, errorCode: "provider_outcome_unknown" }; }
    return this.applyResult(record.id, attemptId, result, context);
  }
  private async applyResult(outboxId: string, attemptId: string, result: ProviderResult, context: NotificationContext): Promise<NotificationOutboxRecord> {
    for (let tries = 0; tries < 3; tries++) {
      const record = await this.read(outboxId, context);
      if (record.attemptId !== attemptId) throw new WorkflowError("notification_attempt_mismatch", 409);
      if (!["accepted", "delivered", "failed", "unknown", "not_submitted"].includes(result.state) || (result.providerId !== null && !/^[A-Za-z0-9_-]{1,100}$/.test(result.providerId)) || (["accepted", "delivered"].includes(result.state) && !result.providerId)
        || result.state === "not_submitted" && result.providerId !== null) throw new WorkflowError("invalid_notification_provider_result");
      if (record.providerId && result.providerId && record.providerId !== result.providerId) throw new WorkflowError("notification_provider_identity_mismatch", 409);
      if (terminal(record.state) || (record.state === "accepted" && ["accepted", "unknown"].includes(result.state))) return record;
      if (result.state === "not_submitted") {
        // The adapter guarantees no POST occurred for this attempt. A received
        // acceptance/delivery still wins if it raced with the adapter's return.
        if (record.providerId || record.acceptedAt || record.deliveredAt || record.state === "accepted" || record.state === "queued") return record;
        if (record.state !== "claimed") throw new WorkflowError("notification_not_submitted_attempt_not_claimed", 409);
        const safeError = result.errorCode && /^[A-Za-z0-9_]{1,60}$/.test(result.errorCode) ? result.errorCode : null;
        try { return await this.mutate(record, context, "notification_dispatch_deferred", { state: "queued", leaseExpiresAt: null, providerErrorCode: safeError }); }
        catch (error) { if (!(error instanceof WorkflowError) || error.code !== "revision_conflict") throw error; continue; }
      }
      if (!["claimed", "unknown", "accepted"].includes(record.state)) throw new WorkflowError("notification_callback_not_dispatchable", 409);
      const now = new Date(this.clock()).toISOString();
      const safeError = result.errorCode && /^[A-Za-z0-9_]{1,60}$/.test(result.errorCode) ? result.errorCode : null;
      try { return await this.mutate(record, context, "notification_provider_" + result.state, { state: result.state, leaseExpiresAt: null, providerId: result.providerId ?? record.providerId, providerErrorCode: safeError, acceptedAt: result.state === "accepted" || result.state === "delivered" ? record.acceptedAt ?? now : record.acceptedAt, deliveredAt: result.state === "delivered" ? now : record.deliveredAt }); }
      catch (error) { if (!(error instanceof WorkflowError) || error.code !== "revision_conflict") throw error; }
    }
    throw new WorkflowError("revision_conflict", 409);
  }
  /** Call only after authentication/signature validation at the server boundary. */
  async applyCallback(outboxId: string, attemptId: string, result: ProviderResult, context: NotificationContext): Promise<NotificationOutboxRecord> {
    this.guard(context); return this.applyResult(outboxId, attemptId, result, context);
  }
  async reconcile(outboxId: string, context: NotificationContext): Promise<NotificationOutboxRecord> {
    this.guard(context, true); let record = await this.read(outboxId, context);
    if (record.state === "claimed") {
      if (instant(record.leaseExpiresAt) > this.clock()) return record;
      try { record = await this.mutate(record, context, "notification_expired_claim_unknown", { state: "unknown", leaseExpiresAt: null, providerErrorCode: "claim_expired_reconciliation_required" }); }
      catch (error) { if (error instanceof WorkflowError && error.code === "revision_conflict") return this.read(outboxId, context); throw error; }
    }
    if (!["unknown", "accepted"].includes(record.state) || !record.attemptId) return record;
    let result: ProviderResult;
    try { result = await this.adapter!.reconcile({ outboxId, attemptId: record.attemptId, providerId: record.providerId }); }
    catch { result = { state: "unknown", providerId: record.providerId, errorCode: "provider_reconciliation_unavailable" }; }
    return this.applyResult(outboxId, record.attemptId, result, context);
  }
  async acknowledge(outboxId: string, context: NotificationContext, note = ""): Promise<NotificationOutboxRecord> {
    this.guard(context); const record = await this.read(outboxId, context);
    if (note.length > 500 || /[\x00-\x1f\x7f]/.test(note)) throw new WorkflowError("invalid_notification_acknowledgement");
    if (record.acknowledgement) return record;
    return this.mutate(record, context, "notification_acknowledged", { acknowledgement: { actorId: context.actorId, at: new Date(this.clock()).toISOString(), note: note.trim() } });
  }
}

export interface TwilioConfig { accountSid: string; authToken: string; from?: string; messagingServiceSid?: string; statusCallbackUrl?: string; timeoutMs?: number; }
/** Server secrets only. No retries: a timed-out POST may already have created a message.
 * Protocol: https://www.twilio.com/docs/messaging/api/message-resource
 */
export class TwilioRestAdapter implements NotificationDeliveryAdapter {
  private readonly timeout: number;
  constructor(private config: TwilioConfig, private request: typeof fetch = fetch) {
    if (!/^AC[0-9a-fA-F]{32}$/.test(config.accountSid) || !config.authToken || config.authToken.length > 256 || (!config.from && !config.messagingServiceSid) || (config.from && config.messagingServiceSid)) throw new WorkflowError("invalid_twilio_configuration");
    if (config.from) normalizeUsPhone(config.from);
    if (config.messagingServiceSid && !/^MG[0-9a-fA-F]{32}$/.test(config.messagingServiceSid)) throw new WorkflowError("invalid_twilio_configuration");
    if (config.statusCallbackUrl) { const url = new URL(config.statusCallbackUrl); if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new WorkflowError("invalid_twilio_configuration"); }
    this.timeout = bounded(config.timeoutMs, 10_000, 1_000, 30_000);
  }
  private endpoint(providerId?: string) { return `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages${providerId ? "/" + providerId : ""}.json`; }
  private async perform(url: string, init: RequestInit, existingProviderId: string | null = null): Promise<ProviderResult> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.request(url, { ...init, signal: controller.signal, redirect: "error", headers: { Authorization: "Basic " + Buffer.from(this.config.accountSid + ":" + this.config.authToken).toString("base64"), ...(init.headers ?? {}) } });
      // A status lookup failure says nothing about delivery of an existing message.
      // Preserve its receipt so a later lookup or signed callback can resolve it.
      if (!response.ok && existingProviderId) return { state: "unknown", providerId: existingProviderId, errorCode: "provider_http_" + response.status };
      if (!response.ok && [400, 401, 403, 404, 422, 429].includes(response.status)) return { state: "failed", providerId: null, errorCode: "provider_http_" + response.status };
      const text = await response.text();
      if (text.length > 64_000) return { state: "unknown", providerId: existingProviderId, errorCode: "provider_response_invalid" };
      let body: Record<string, unknown>;
      try { body = JSON.parse(text) as Record<string, unknown>; } catch { return { state: "unknown", providerId: existingProviderId, errorCode: "provider_response_invalid" }; }
      const sid = typeof body.sid === "string" && /^SM[0-9a-fA-F]{32}$/.test(body.sid) ? body.sid : null;
      if (!response.ok) return { state: "unknown", providerId: sid, errorCode: "provider_http_" + response.status };
      return twilioResult(body.status, sid, body.error_code);
    } catch { return { state: "unknown", providerId: existingProviderId, errorCode: "provider_outcome_unknown" }; }
    finally { clearTimeout(timer); }
  }
  async submit(input: NotificationSubmission): Promise<ProviderResult> {
    const body = new URLSearchParams({ To: normalizeUsPhone(input.to), Body: display(input.body, 1600) });
    if (this.config.from) body.set("From", normalizeUsPhone(this.config.from));
    if (this.config.messagingServiceSid) body.set("MessagingServiceSid", this.config.messagingServiceSid);
    if (this.config.statusCallbackUrl) { const callback = new URL(this.config.statusCallbackUrl); callback.searchParams.set("outboxId", input.outboxId); callback.searchParams.set("attemptId", input.attemptId); body.set("StatusCallback", callback.toString()); }
    return this.perform(this.endpoint(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  }
  async reconcile(input: { outboxId: string; attemptId: string; providerId: string | null }): Promise<ProviderResult> {
    if (!input.providerId || !/^SM[0-9a-fA-F]{32}$/.test(input.providerId)) return { state: "unknown", providerId: null, errorCode: "provider_receipt_missing" };
    return this.perform(this.endpoint(input.providerId), { method: "GET" }, input.providerId);
  }
}
export function twilioResult(status: unknown, providerId: string | null, code?: unknown): ProviderResult {
  const errorCode = typeof code === "number" && Number.isInteger(code) && code >= 0 ? "twilio_" + code : typeof code === "string" && /^\d{1,8}$/.test(code) ? "twilio_" + code : undefined;
  const state = status === "delivered" ? "delivered" : ["failed", "undelivered", "canceled"].includes(String(status)) ? "failed" : ["accepted", "queued", "sending", "sent"].includes(String(status)) ? "accepted" : "unknown";
  return { state: providerId ? state : "unknown", providerId, ...(errorCode ? { errorCode } : {}) };
}
/** Form-POST helper only; JSON webhooks are rejected. URL must be the configured external URL, never a forwarded header.
 * Algorithm and published vector: https://www.twilio.com/docs/usage/security
 * Twilio recommends its SDK validator; keep this dependency-free helper behind the reviewed callback capability gate.
 */
export function validateTwilioFormSignature(authToken: string, externalUrl: string, rawForm: string, signature: string): boolean {
  try {
    const url = new URL(externalUrl);
    if (!authToken || url.protocol !== "https:" || url.username || url.password || url.hash || rawForm.length > 32_000 || !/^[A-Za-z0-9+/]{27}=$/.test(signature)) return false;
    const form = new URLSearchParams(rawForm), values = new Map<string, string>();
    for (const [name, value] of form) { if (values.has(name)) return false; values.set(name, value); }
    const signed = externalUrl + [...values.keys()].sort().map(name => name + values.get(name)).join("");
    const expected = createHmac("sha1", authToken).update(signed).digest();
    const supplied = Buffer.from(signature, "base64");
    return supplied.length === expected.length && timingSafeEqual(expected, supplied);
  } catch { return false; }
}
export function validatedTwilioCallback(input: { authToken: string; accountSid: string; externalUrl: string; rawForm: string; signature: string; contentType: string }): ProviderResult {
  if (input.contentType.split(";")[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded" || !validateTwilioFormSignature(input.authToken, input.externalUrl, input.rawForm, input.signature)) throw new WorkflowError("invalid_notification_callback_signature", 403);
  const form = new URLSearchParams(input.rawForm), sid = form.get("MessageSid");
  if (form.get("AccountSid") !== input.accountSid || !sid || !/^SM[0-9a-fA-F]{32}$/.test(sid)) throw new WorkflowError("notification_callback_identity_mismatch", 403);
  return twilioResult(form.get("MessageStatus"), sid, form.get("ErrorCode"));
}
