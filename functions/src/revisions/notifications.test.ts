import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import type { Versioned, WorkspacePage } from "../operations/workspace.js";
import { WorkflowError } from "../operations/reads.js";
import { NotificationOutbox, TwilioRestAdapter, friendlySms, normalizeUsPhone, notificationKey, notificationDeliveryCursor, notificationAttention, validateTwilioFormSignature, validatedTwilioCallback,
  type NotificationConfig, type NotificationContact, type NotificationContext, type NotificationEvidence, type NotificationOutboxRecord,
  type NotificationRequest, type NotificationSubmission, type ProviderResult } from "./notifications.js";

class Repository {
  records = new Map<string, Versioned>();
  actions: string[] = [];
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> { return structuredClone(this.records.get(collection + "/" + id) as T ?? null); }
  async page<T extends Versioned>(collection: string) { return { items: [...this.records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, record]) => structuredClone(record) as T), nextCursor: null }; }
  async change<T extends Versioned>(collection: string, id: string, expected: number, _actor: string, action: string, update: (prior: T | null) => T): Promise<T> {
    // Check and mutate synchronously, modeling the repository's optimistic transaction boundary.
    const key = collection + "/" + id, prior = this.records.get(key) as T ?? null;
    if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
    const next = update(structuredClone(prior)); this.records.set(key, structuredClone(next)); this.actions.push(action); return structuredClone(next);
  }
}
const NOW = Date.parse("2026-10-10T18:00:00.000Z");
const context: NotificationContext = { officeId: "123", actorId: "worker-1", roles: ["worker"], dataApproved: true, mode: "live" };
const request: NotificationRequest = { rule: "missing_clock_out", visitId: "77", occurrenceId: "2026-10-10-no-out", recipientRef: "caregiver-6" };
const sid = "SM" + "a".repeat(32), account = "AC" + "b".repeat(32);
function fixture(config: NotificationConfig = {}) {
  let now = NOW, evidenceCalls = 0, contactCalls = 0;
  const repo = new Repository(), submissions: NotificationSubmission[] = [];
  const evidence: NotificationEvidence = { officeId: "123", visitId: "77", rule: "missing_clock_out", occurrenceId: request.occurrenceId,
    source: "server_verified", validation: "validated", sourceRevision: "source-1", ruleVersion: "rules-1", observedAt: new Date(now).toISOString(),
    detectedAt: new Date(now - 60_000).toISOString(), conditionActive: true, eligibleRecipientRefs: ["caregiver-6"], scheduledEnd: "12:00 PM" };
  const contact: NotificationContact = { officeId: "123", recipientRef: "caregiver-6", kind: "caregiver", phone: "832-403-0094", firstName: "Jamie",
    validatedAt: new Date(now).toISOString(), smsAllowed: true, optedOut: false };
  let submit: (input: NotificationSubmission) => Promise<ProviderResult> = async () => ({ state: "accepted", providerId: sid });
  let reconcile: () => Promise<ProviderResult> = async () => ({ state: "unknown", providerId: null });
  let source: () => Promise<NotificationEvidence> = async () => structuredClone(evidence);
  const gates: NotificationConfig = { capabilityApproved: true, configurationApproved: true, sendApproved: true, canSend: async () => true, ...config };
  const outbox = new NotificationOutbox(repo, { load: async input => { evidenceCalls++; assert.deepEqual(Object.keys(input).sort(), ["occurrenceId", "recipientRef", "rule", "visitId"]); return source(); } },
    { getContact: async () => { contactCalls++; return structuredClone(contact); } },
    { submit: async input => { submissions.push(input); return submit(input); }, reconcile: async () => reconcile() }, gates, () => now);
  return { repo, outbox, evidence, contact, gates, submissions, counts: () => ({ evidenceCalls, contactCalls }),
    advance: (ms: number) => { now += ms; }, setSubmit: (fn: typeof submit) => { submit = fn; }, setReconcile: (fn: typeof reconcile) => { reconcile = fn; }, setSource: (fn: typeof source) => { source = fn; } };
}
async function rejectsCode(action: Promise<unknown>, code: string) { await assert.rejects(action, error => error instanceof WorkflowError && error.code === code); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

test("US normalization infers +1 and rejects invalid countries, extensions and malformed plus signs", () => {
  for (const phone of ["8324030094", "(832) 403-0094", "1-832-403-0094", "+1 832 403 0094"]) assert.equal(normalizeUsPhone(phone), "+18324030094");
  for (const phone of ["+448324030094", "+18324030094+", "++18324030094", "8324030094 ext 2", "1234567890", "8321030094", "832403009"]) assert.throws(() => normalizeUsPhone(phone), /invalid_sms_phone/);
});

test("default capability, Live, role and data-release gates prevent evidence reads and queuing", async () => {
  const repo = new Repository(), outbox = new NotificationOutbox(repo, { load: async () => { throw new Error("must not fetch"); } }, { getContact: async () => { throw new Error("must not fetch"); } });
  await rejectsCode(outbox.queue(request, context), "notification_capability_not_approved");
  for (const patch of [{ mode: "demo" as const }, { dataApproved: false }]) await rejectsCode(outbox.queue(request, { ...context, ...patch }), "notification_live_data_not_approved");
  await rejectsCode(outbox.queue(request, { ...context, roles: ["viewer"] }), "notification_role_required");
  assert.equal(repo.records.size, 0);
});

test("queue rejects browser content/evidence and binds fresh evidence to office, occurrence and authorized recipient", async () => {
  const f = fixture();
  await rejectsCode(f.outbox.queue({ ...request, body: "untrusted text" } as NotificationRequest, context), "invalid_notification_request");
  assert.deepEqual(f.counts(), { evidenceCalls: 0, contactCalls: 0 });
  for (const patch of [{ officeId: "456" }, { occurrenceId: "different" }, { source: "browser" as "server_verified" }, { validation: "source_unvalidated" as "validated" }]) {
    Object.assign(f.evidence, patch); await rejectsCode(f.outbox.queue(request, context), "notification_source_evidence_mismatch");
    Object.assign(f.evidence, { officeId: "123", occurrenceId: request.occurrenceId, source: "server_verified", validation: "validated" });
  }
  f.evidence.eligibleRecipientRefs = ["other-caregiver"];
  await rejectsCode(f.outbox.queue(request, context), "notification_recipient_not_source_authorized");
  f.evidence.eligibleRecipientRefs = [request.recipientRef]; f.evidence.observedAt = new Date(NOW - 300_001).toISOString();
  await rejectsCode(f.outbox.queue(request, context), "notification_source_evidence_stale");
  f.evidence.observedAt = new Date(NOW + 1).toISOString();
  await rejectsCode(f.outbox.queue(request, context), "notification_source_evidence_stale"); assert.equal(f.repo.records.size, 0);
});

test("contacts must be validated, correctly scoped, permissioned and appropriate for the message", async () => {
  for (const [patch, code] of [[{ officeId: "456" }, "notification_contact_scope_mismatch"], [{ kind: "supervisor" }, "notification_recipient_kind_mismatch"],
    [{ optedOut: true }, "notification_contact_opted_out"], [{ smsAllowed: false }, "notification_contact_opted_out"],
    [{ validatedAt: "2026-01-01T00:00:00Z" }, "notification_contact_not_validated"], [{ phone: "+448324030094" }, "invalid_sms_phone"]] as [Partial<NotificationContact>, string][]) {
    const f = fixture(); Object.assign(f.contact, patch); await rejectsCode(f.outbox.queue(request, context), code); assert.equal(f.repo.records.size, 0);
  }
});

test("durable deduplication is atomic and includes office, visit, rule, occurrence and recipient", async () => {
  const f = fixture(), records = await Promise.all(Array.from({ length: 8 }, () => f.outbox.queue(request, context)));
  assert.equal(f.repo.records.size, 1); assert.ok(records.every(record => record.id === records[0]!.id));
  assert.equal(records[0]!.revision, 1);
  for (const patch of [{ visitId: "78" }, { rule: "early_ended" as const }, { occurrenceId: "next" }, { recipientRef: "other" }]) assert.notEqual(notificationKey("123", { ...request, ...patch }), records[0]!.id);
  assert.notEqual(notificationKey("456", request), records[0]!.id);
  assert.deepEqual((await f.outbox.page(context)).items.map(record => record.id), [records[0]!.id]);
  await rejectsCode(f.outbox.get(records[0]!.id, { ...context, officeId: "456" }), "notification_not_found");
});

test("send approval and approved office policy are mandatory; quiet hours defer without claiming", async () => {
  for (const disabled of ["sendApproved", "canSend"] as const) {
    const f = fixture(); if (disabled === "sendApproved") f.gates.sendApproved = false; else delete f.gates.canSend;
    const item = await f.outbox.queue(request, context);
    await rejectsCode(f.outbox.send(item.id, context), "notification_send_not_approved"); assert.equal(f.submissions.length, 0);
  }
  const f = fixture({ canSend: async () => false }), item = await f.outbox.queue(request, context);
  const result = await f.outbox.send(item.id, context); assert.equal(result.state, "queued"); assert.equal(result.attemptCount, 0); assert.equal(f.submissions.length, 0);
});

test("concurrent workers claim once and a duplicate send cannot dispatch again", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context), hold = deferred<ProviderResult>(); f.setSubmit(async () => hold.promise);
  const first = f.outbox.send(item.id, context);
  while (!f.submissions.length) await new Promise(done => setImmediate(done));
  const others = await Promise.all(Array.from({ length: 5 }, () => f.outbox.send(item.id, context)));
  assert.equal(f.submissions.length, 1); assert.ok(others.every(result => result.state === "claimed"));
  hold.resolve({ state: "accepted", providerId: sid }); const result = await first;
  assert.equal(result.state, "accepted"); assert.equal(result.attemptCount, 1); assert.equal(result.deliveredAt, null);
  await f.outbox.send(item.id, context); assert.equal(f.submissions.length, 1); assert.equal(f.submissions[0]!.to, "+18324030094");
});

test("fresh condition recheck suppresses a resolved visit and newly opted-out contacts", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context); f.evidence.conditionActive = false;
  const result = await f.outbox.send(item.id, context); assert.equal(result.state, "suppressed"); assert.equal(result.suppression?.reason, "condition_resolved"); assert.equal(f.submissions.length, 0);
  const g = fixture(), other = await g.outbox.queue(request, context); g.contact.optedOut = true;
  await rejectsCode(g.outbox.send(other.id, context), "notification_contact_opted_out");
  assert.equal((await g.outbox.get(other.id, context)).state, "suppressed"); assert.equal(g.submissions.length, 0);
});

test("stale or unavailable recheck cannot send; subsequent fresh evidence may proceed", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context); f.advance(300_001);
  await rejectsCode(f.outbox.send(item.id, context), "notification_source_evidence_stale");
  assert.equal((await f.outbox.get(item.id, context)).state, "queued"); assert.equal(f.submissions.length, 0);
  f.evidence.observedAt = new Date(NOW + 300_001).toISOString();
  const result = await f.outbox.send(item.id, context); assert.equal(result.state, "accepted"); assert.equal(f.submissions.length, 1);
});

test("gate changes or evidence aging while an asynchronous policy check is pending prevent dispatch", async () => {
  const f = fixture({ maxEvidenceAgeMs: 1_000 }), item = await f.outbox.queue(request, context);
  let calls = 0; f.gates.canSend = async () => { if (++calls === 2) f.advance(1_001); return true; };
  await rejectsCode(f.outbox.send(item.id, context), "notification_source_evidence_stale"); assert.equal(f.submissions.length, 0);
  const g = fixture(), other = await g.outbox.queue(request, context); calls = 0;
  g.gates.canSend = async () => { if (++calls === 2) g.gates.sendApproved = false; return true; };
  await rejectsCode(g.outbox.send(other.id, context), "notification_send_not_approved"); assert.equal(g.submissions.length, 0);
});

test("a lease that expires before dispatch requires reconciliation and never sends", async () => {
  const f = fixture({ leaseMs: 5_000 }), item = await f.outbox.queue(request, context);
  let calls = 0; f.gates.canSend = async () => { if (++calls === 2) f.advance(5_001); return true; };
  const result = await f.outbox.send(item.id, context); assert.equal(result.state, "unknown"); assert.equal(f.submissions.length, 0);
  await f.outbox.send(item.id, context); assert.equal(f.submissions.length, 0);
});

test("provider timeout has an unknown outcome and is never blindly retried", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context); f.setSubmit(async () => { throw new Error("secret transport detail"); });
  const result = await f.outbox.send(item.id, context); assert.equal(result.state, "unknown"); assert.equal(result.providerErrorCode, "provider_outcome_unknown");
  await f.outbox.send(item.id, context); await f.outbox.reconcile(item.id, context); assert.equal(f.submissions.length, 1);
  f.setReconcile(async () => ({ state: "delivered", providerId: sid }));
  const reconciled = await f.outbox.reconcile(item.id, context); assert.equal(reconciled.state, "delivered"); assert.ok(reconciled.deliveredAt); assert.equal(f.submissions.length, 1);
});

test("definite pre-POST deferral preserves the occurrence and permits a later safe attempt", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context);
  f.setSubmit(async () => ({ state: "not_submitted", providerId: null, errorCode: "provider_preparation_unavailable" }));
  const deferred = await f.outbox.send(item.id, context);
  assert.equal(deferred.state, "queued"); assert.equal(deferred.providerId, null); assert.equal(deferred.leaseExpiresAt, null);
  assert.equal(deferred.id, item.id); assert.equal(deferred.occurrenceId, item.occurrenceId); assert.equal(deferred.attemptCount, 1);
  f.setSubmit(async () => ({ state: "accepted", providerId: sid }));
  const accepted = await f.outbox.send(item.id, context);
  assert.equal(accepted.state, "accepted"); assert.equal(accepted.attemptCount, 2); assert.notEqual(accepted.attemptId, deferred.attemptId);
  assert.equal(accepted.id, item.id); assert.equal(f.submissions.length, 2);
});

test("a racing accepted or terminal receipt takes precedence over definite pre-POST deferral", async () => {
  for (const state of ["accepted", "delivered", "failed"] as const) {
    const f = fixture(), item = await f.outbox.queue(request, context), hold = deferred<ProviderResult>();
    f.setSubmit(async () => hold.promise);
    const sending = f.outbox.send(item.id, context);
    while (!f.submissions.length) await new Promise(done => setImmediate(done));
    const claimed = await f.outbox.get(item.id, context);
    const receipt = await f.outbox.applyCallback(item.id, claimed.attemptId!, { state, providerId: sid }, context);
    hold.resolve({ state: "not_submitted", providerId: null, errorCode: "provider_preparation_unavailable" });
    const result = await sending;
    assert.equal(result.state, state); assert.equal(result.providerId, sid); assert.equal(result.revision, receipt.revision);
    await f.outbox.send(item.id, context); assert.equal(f.submissions.length, 1);
  }
});

test("not-submitted results cannot include a receipt or requeue an earlier uncertain POST", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context);
  f.setSubmit(async () => ({ state: "not_submitted", providerId: sid }));
  await rejectsCode(f.outbox.send(item.id, context), "invalid_notification_provider_result");
  const g = fixture(), other = await g.outbox.queue(request, context);
  g.setSubmit(async () => ({ state: "unknown", providerId: null })); await g.outbox.send(other.id, context);
  g.setReconcile(async () => ({ state: "not_submitted", providerId: null }));
  await rejectsCode(g.outbox.reconcile(other.id, context), "notification_not_submitted_attempt_not_claimed");
  assert.equal((await g.outbox.get(other.id, context)).state, "unknown");
  await g.outbox.send(other.id, context); assert.equal(g.submissions.length, 1);
});

test("delivery pagination excludes terminal history and uses stable document-ID boundaries", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context);
  for (let index = 0; index < 125; index++) {
    const nextRequest = { ...request, visitId: String(index + 100) }, id = notificationKey(context.officeId, nextRequest);
    f.repo.records.set(`revisionNotificationOutbox_${context.officeId}/${id}`, { ...item, ...nextRequest, id, state: "delivered" } as NotificationOutboxRecord);
  }
  const first = await f.outbox.deliveryPage(context);
  assert.deepEqual(first.items.map(record => record.id), [item.id]); assert.equal(first.nextCursor, null);
  assert.deepEqual((await f.outbox.deliveryPage(context, notificationDeliveryCursor(item.id))).items, []);
  for (const cursor of ["", "not-a-cursor", Buffer.from(JSON.stringify({ updatedAt: NOW, id: item.id })).toString("base64url"), notificationDeliveryCursor(item.id) + "="])
    await rejectsCode(f.outbox.deliveryPage(context, cursor), "invalid_notification_delivery_cursor");
});

test("production delivery queries receive raw boundaries and reject invalid active pages", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context), calls: { collection: string; afterId: string | undefined }[] = [];
  const repository = Object.assign(f.repo, { pageActiveNotifications: async <T extends Versioned>(collection: string, afterId?: string): Promise<WorkspacePage<T>> => {
    calls.push({ collection, afterId }); return { items: [item] as unknown as T[], nextCursor: item.id };
  } });
  const box = new NotificationOutbox(repository, { load: async () => { throw new Error("delivery scan must not load evidence"); } }, { getContact: async () => null }, undefined, f.gates);
  const page = await box.deliveryPage(context);
  assert.equal(page.nextCursor, notificationDeliveryCursor(item.id)); assert.equal(calls[0]!.collection, "revisionNotificationOutbox_123"); assert.equal(calls[0]!.afterId, undefined);
  await rejectsCode(box.deliveryPage(context, page.nextCursor!), "invalid_notification_delivery_page"); assert.equal(calls[1]!.afterId, item.id);
  repository.pageActiveNotifications = async <T extends Versioned>() => ({ items: [{ ...item, state: "delivered" }] as unknown as T[], nextCursor: null });
  await rejectsCode(box.deliveryPage(context), "invalid_notification_delivery_page");
});

test("expired in-flight claim becomes unknown; a late successful response reconciles without a second send", async () => {
  const f = fixture({ leaseMs: 5_000 }), item = await f.outbox.queue(request, context), hold = deferred<ProviderResult>(); f.setSubmit(async () => hold.promise);
  const sending = f.outbox.send(item.id, context); while (!f.submissions.length) await new Promise(done => setImmediate(done));
  f.advance(5_001); const expired = await f.outbox.send(item.id, context); assert.equal(expired.state, "unknown"); assert.equal(f.submissions.length, 1);
  hold.resolve({ state: "accepted", providerId: sid }); assert.equal((await sending).state, "accepted");
  await f.outbox.send(item.id, context); assert.equal(f.submissions.length, 1);
});

test("callback identity is fenced and old statuses cannot roll back final delivery or acknowledgement", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context), accepted = await f.outbox.send(item.id, context);
  await rejectsCode(f.outbox.applyCallback(item.id, "wrong-attempt", { state: "delivered", providerId: sid }, context), "notification_attempt_mismatch");
  await rejectsCode(f.outbox.applyCallback(item.id, accepted.attemptId!, { state: "delivered", providerId: "SM" + "c".repeat(32) }, context), "notification_provider_identity_mismatch");
  const delivered = await f.outbox.applyCallback(item.id, accepted.attemptId!, { state: "delivered", providerId: sid }, context);
  const acknowledged = await f.outbox.acknowledge(item.id, context, "reviewed in office"); assert.equal(acknowledged.state, "delivered"); assert.ok(acknowledged.acknowledgement);
  for (const state of ["accepted", "unknown", "failed"] as const) {
    const result = await f.outbox.applyCallback(item.id, accepted.attemptId!, { state, providerId: sid }, context); assert.equal(result.state, "delivered"); assert.equal(result.deliveredAt, delivered.deliveredAt); assert.deepEqual(result.acknowledgement, acknowledged.acknowledgement);
  }
});

test("acknowledgement remains distinct from delivery and known failed delivery never retries", async () => {
  const f = fixture(), item = await f.outbox.queue(request, context); f.setSubmit(async () => ({ state: "failed", providerId: null, errorCode: "provider_http_400" }));
  const failed = await f.outbox.send(item.id, context); assert.equal(failed.state, "failed");
  const acknowledged = await f.outbox.acknowledge(item.id, context); assert.equal(acknowledged.state, "failed"); assert.equal(acknowledged.deliveredAt, null);
  await f.outbox.send(item.id, context); assert.equal(f.submissions.length, 1);
});

test("templates count distinct dates and never promise prevention, approval or undoing an HHA punch", () => {
  const f = fixture();
  const early = friendlySms({ ...f.evidence, rule: "early_ended", actualEnd: "11:30 AM", remainingMinutes: 30 }, f.contact);
  assert.match(early, /Was ending early intentional/); assert.match(early, /Please contact the office/); assert.doesNotMatch(early, /reply YES|reopened|approved your|undo|prevented/i);
  const tokens = friendlySms({ ...f.evidence, rule: "missing_token_days", missingServiceDates: ["2026-10-08", "2026-10-08", "2026-10-09"], verifiedVendorInstructions: "the approved office workflow" }, f.contact);
  assert.match(tokens, /for 2 visit days/); assert.throws(() => friendlySms({ ...f.evidence, rule: "missing_token_days", missingServiceDates: ["2026-02-30"], verifiedVendorInstructions: "office" }, f.contact));
  assert.match(friendlySms({ ...f.evidence, rule: "supervisor_overlap" }, { ...f.contact, kind: "supervisor" }), /Some overlaps may be allowed/);
});

test("supervisor deadlines begin at verified detection and caregiver messages have no invented deadline", async () => {
  const f = fixture(); f.evidence.rule = "supervisor_overage"; f.contact.kind = "supervisor";
  const item = await f.outbox.queue({ ...request, rule: "supervisor_overage" }, context);
  assert.equal(item.deadlineAt, new Date(NOW - 60_000 + 86_400_000).toISOString());
  const g = fixture(); assert.equal((await g.outbox.queue(request, context)).deadlineAt, null);
});

test("office delivery guidance recognizes deadline boundaries without treating provider acceptance or acknowledgement as delivery", async () => {
  const f = fixture(), queued = await f.outbox.queue(request, context), deadlineAt = new Date(NOW + 1000).toISOString();
  const record = { ...queued, rule: "supervisor_overage" as const, deadlineAt };
  assert.equal(notificationAttention(record, NOW).deliveryTarget, "pending");
  const overdue = notificationAttention({ ...record, state: "accepted", providerId: sid, acceptedAt: new Date(NOW).toISOString() }, NOW + 1000);
  assert.equal(overdue.deliveryTarget, "overdue"); assert.equal(overdue.needsReview, true);
  assert.equal(overdue.reason, "delivery_overdue"); assert.match(overdue.nextAction!, /existing attempt/);
  const acknowledged = notificationAttention({ ...record, acknowledgement: { at: new Date(NOW).toISOString(), actorId: "office", note: "Called supervisor" } }, NOW + 1000);
  assert.equal(acknowledged.deliveryTarget, "overdue"); assert.equal(acknowledged.officeAcknowledged, true); assert.equal(acknowledged.needsReview, false);
  assert.equal(notificationAttention({ ...record, state: "delivered", deliveredAt: deadlineAt }, NOW + 1000).deliveryTarget, "met");
  const late = notificationAttention({ ...record, state: "delivered", deliveredAt: new Date(NOW + 1001).toISOString() }, NOW + 2000);
  assert.equal(late.deliveryTarget, "late"); assert.equal(late.reason, "delivery_late");
  assert.equal(notificationAttention(queued, NOW + 3 * 86_400_000).deliveryTarget, "not_applicable");
  assert.equal(notificationAttention({ ...record, state: "suppressed" }, NOW + 1000).deliveryTarget, "cancelled");
  assert.equal(f.submissions.length, 0);
});

test("uncertain, failed and expired attempts get distinct recovery guidance while invalid receipts never establish delivery", async () => {
  const f = fixture(), record = await f.outbox.queue(request, context);
  assert.equal(notificationAttention({ ...record, state: "unknown" }, NOW).reason, "delivery_unknown");
  assert.match(notificationAttention({ ...record, state: "unknown" }, NOW).nextAction!, /Confirm its outcome/);
  assert.equal(notificationAttention({ ...record, state: "failed" }, NOW).reason, "delivery_failed");
  const claimed = { ...record, state: "claimed" as const, leaseExpiresAt: new Date(NOW + 1000).toISOString() };
  assert.equal(notificationAttention(claimed, NOW).needsReview, false);
  assert.equal(notificationAttention(claimed, NOW + 1000).reason, "claim_expired");
  for (const patch of [{ state: "delivered" as const }, { state: "delivered" as const, deliveredAt: new Date(NOW + 1).toISOString() }, { deadlineAt: "invalid" }, { deliveredAt: new Date(NOW - 1).toISOString() }]) {
    const view = notificationAttention({ ...record, ...patch }, NOW);
    assert.equal(view.deliveryTarget, "unknown"); assert.equal(view.reason, "delivery_evidence_invalid"); assert.equal(view.needsReview, true);
  }
  assert.equal(f.submissions.length, 0);
});

test("office outbox pages derive current guidance without rewriting records or invoking providers", async () => {
  const f = fixture(), record = await f.outbox.queue(request, context), actions = f.repo.actions.length;
  const before = await f.outbox.page(context);
  assert.equal(before.items[0]!.attention.reason, "none");
  const key = "revisionNotificationOutbox_123/" + record.id;
  const failed: NotificationOutboxRecord = { ...record, state: "failed" };
  f.repo.records.set(key, failed);
  const after = await f.outbox.page(context);
  assert.equal(after.items[0]!.attention.needsReview, true);
  assert.equal((f.repo.records.get(key) as NotificationOutboxRecord).state, "failed");
  assert.ok(!Object.hasOwn(f.repo.records.get(key)!, "attention"));
  assert.equal(f.repo.actions.length, actions); assert.equal(f.submissions.length, 0);
});

test("Twilio adapter uses only injected fetch, form encoding, Basic auth, known callback URL and normalized phones", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const adapter = new TwilioRestAdapter({ accountSid: account, authToken: "server-secret", from: "8324030094", statusCallbackUrl: "https://example.com/sms/callback?fixed=1" }, async (url, init) => {
    calls.push({ url: String(url), init: init! }); return new Response(JSON.stringify({ sid, status: "queued" }), { status: 201 });
  });
  const result = await adapter.submit({ outboxId: "d".repeat(64), attemptId: "attempt-1", to: "8324030094", body: "Synthetic test only" });
  assert.deepEqual(result, { state: "accepted", providerId: sid }); assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`);
  const form = new URLSearchParams(calls[0]!.init.body as string); assert.equal(form.get("To"), "+18324030094"); assert.equal(form.get("From"), "+18324030094");
  const callback = new URL(form.get("StatusCallback")!); assert.equal(callback.origin, "https://example.com"); assert.equal(callback.searchParams.get("outboxId"), "d".repeat(64)); assert.equal(callback.searchParams.get("attemptId"), "attempt-1"); assert.equal(callback.searchParams.get("fixed"), "1");
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Basic " + Buffer.from(account + ":server-secret").toString("base64"));
  assert.equal(calls[0]!.init.redirect, "error"); assert.ok(calls[0]!.init.signal);
});

test("Twilio status reconciliation never creates messages; missing receipts, 5xx and transport failures remain unknown", async () => {
  let calls = 0;
  const adapter = new TwilioRestAdapter({ accountSid: account, authToken: "secret", messagingServiceSid: "MG" + "d".repeat(32) }, async (url, init) => {
    calls++; assert.equal(init?.method, "GET"); assert.equal(String(url), `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages/${sid}.json`);
    return new Response(JSON.stringify({ sid, status: "delivered" }));
  });
  assert.equal((await adapter.reconcile({ outboxId: "x", attemptId: "a", providerId: null })).state, "unknown"); assert.equal(calls, 0);
  assert.equal((await adapter.reconcile({ outboxId: "x", attemptId: "a", providerId: sid })).state, "delivered"); assert.equal(calls, 1);
  for (const response of [new Response("server-secret +18324030094", { status: 500 }), new Response(JSON.stringify({ message: "server-secret" }), { status: 401 })]) {
    const bad = new TwilioRestAdapter({ accountSid: account, authToken: "secret", from: "8324030094" }, async () => response);
    const result = await bad.submit({ outboxId: "x", attemptId: "a", to: "8324030094", body: "test" }); assert.doesNotMatch(JSON.stringify(result), /server-secret|18324030094/);
    assert.equal(result.state, response.status === 401 ? "failed" : "unknown");
  }
  const failing = new TwilioRestAdapter({ accountSid: account, authToken: "secret", from: "8324030094" }, async () => { throw new Error("server-secret"); });
  assert.deepEqual(await failing.submit({ outboxId: "x", attemptId: "a", to: "8324030094", body: "test" }), { state: "unknown", providerId: null, errorCode: "provider_outcome_unknown" });
});

test("Twilio request timeout aborts injected transport without retry", async () => {
  let calls = 0;
  const adapter = new TwilioRestAdapter({ accountSid: account, authToken: "secret", from: "8324030094", timeoutMs: 1_000 }, async (_url, init) => {
    calls++; return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  });
  const result = await adapter.submit({ outboxId: "x", attemptId: "a", to: "8324030094", body: "test" }); assert.equal(result.state, "unknown"); assert.equal(calls, 1);
});

test("every failed status GET preserves the receipt and a later authenticated delivered callback wins", async () => {
  for (const status of [400, 401, 403, 404, 422, 429, 500, 502]) {
    const f = fixture(), item = await f.outbox.queue(request, context), accepted = await f.outbox.send(item.id, context);
    const adapter = new TwilioRestAdapter({ accountSid: account, authToken: "secret", from: "8324030094" }, async (_url, init) => {
      assert.equal(init?.method, "GET"); return new Response("Sensitive provider error", { status });
    });
    const lookup = await adapter.reconcile({ outboxId: item.id, attemptId: accepted.attemptId!, providerId: sid });
    assert.deepEqual(lookup, { state: "unknown", providerId: sid, errorCode: "provider_http_" + status });
    f.setReconcile(async () => lookup);
    const unresolved = await f.outbox.reconcile(item.id, context);
    assert.equal(unresolved.state, "accepted"); assert.equal(unresolved.providerId, sid); assert.equal(unresolved.deliveredAt, null);
    const externalUrl = `https://example.com/callback?outboxId=${item.id}&attemptId=${accepted.attemptId}`;
    const values = { AccountSid: account, MessageSid: sid, MessageStatus: "delivered" }, rawForm = new URLSearchParams(values).toString();
    const signature = createHmac("sha1", "token").update(externalUrl + Object.keys(values).sort().map(key => key + values[key as keyof typeof values]).join("")).digest("base64");
    const callback = validatedTwilioCallback({ authToken: "token", accountSid: account, externalUrl, rawForm, signature, contentType: "application/x-www-form-urlencoded" });
    const delivered = await f.outbox.applyCallback(item.id, accepted.attemptId!, callback, context);
    assert.equal(delivered.state, "delivered"); assert.equal(delivered.providerId, sid); assert.ok(delivered.deliveredAt); assert.equal(f.submissions.length, 1);
  }
});

test("status GET transport or malformed responses retain their original receipt", async () => {
  for (const request of [async () => { throw new Error("Sensitive transport error"); }, async () => new Response("invalid JSON"), async () => new Response("x".repeat(64_001))]) {
    const adapter = new TwilioRestAdapter({ accountSid: account, authToken: "secret", from: "8324030094" }, request);
    const result = await adapter.reconcile({ outboxId: "x", attemptId: "a", providerId: sid });
    assert.equal(result.state, "unknown"); assert.equal(result.providerId, sid); assert.doesNotMatch(JSON.stringify(result), /Sensitive/);
  }
});

test("form signature matches Twilio published vector and rejects changed URL, fields and ambiguous duplicate parameters", () => {
  const url = "https://example.com/myapp.php?foo=1&bar=2";
  const form = new URLSearchParams({ CallSid: "CA1234567890ABCDE", Caller: "+14158675310", Digits: "1234", From: "+14158675310", To: "+18005551212" }).toString();
  assert.equal(validateTwilioFormSignature("12345", url, form, "L/OH5YylLD5NRKLltdqwSvS0BnU="), true);
  assert.equal(validateTwilioFormSignature("12345", url + "x", form, "L/OH5YylLD5NRKLltdqwSvS0BnU="), false);
  assert.equal(validateTwilioFormSignature("12345", url, form + "&Digits=1234", "L/OH5YylLD5NRKLltdqwSvS0BnU="), false);
  assert.equal(validateTwilioFormSignature("12345", url, form.replace("1234", "9999"), "L/OH5YylLD5NRKLltdqwSvS0BnU="), false);
});

test("validated callbacks bind account, exact external URL, all evolving form fields and MessageSid", () => {
  const externalUrl = "https://example.com/callback?outboxId=x&attemptId=a", values = { AccountSid: account, MessageSid: sid, MessageStatus: "delivered", NewTwilioField: " unchanged " };
  const rawForm = new URLSearchParams(values).toString();
  const signature = createHmac("sha1", "token").update(externalUrl + Object.keys(values).sort().map(key => key + values[key as keyof typeof values]).join("")).digest("base64");
  const input = { authToken: "token", accountSid: account, externalUrl, rawForm, signature, contentType: "application/x-www-form-urlencoded; charset=utf-8" };
  assert.deepEqual(validatedTwilioCallback(input), { state: "delivered", providerId: sid });
  assert.throws(() => validatedTwilioCallback({ ...input, contentType: "application/json" }), /invalid_notification_callback_signature/);
  assert.throws(() => validatedTwilioCallback({ ...input, externalUrl: "https://attacker.example/callback" }), /invalid_notification_callback_signature/);
  assert.throws(() => validatedTwilioCallback({ ...input, accountSid: "AC" + "e".repeat(32) }), /notification_callback_identity_mismatch/);
});
