import assert from "node:assert/strict";
import test from "node:test";
import { nextWorkspaceCursor, OperationsWorkspace, workspaceCursor, type Settings, type Versioned, type WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError, type OperationalRead, type ReadInput } from "../operations/reads.js";
import { defaultRevisionPolicy, type ContactRecord, type RevisionPolicy, type SourceContract } from "./policy.js";
import { RevisionBackend, type RevisionActor } from "./service.js";
import type { NotificationOutboxRecord, NotificationSubmission } from "./notifications.js";
import { createSmsAdapter } from "./sms.js";

class MemoryRepository implements WorkspaceRepository {
  values = new Map<string, Versioned>();
  actions: { collection: string; action: string }[] = [];
  async get<T extends Versioned>(collection: string, id: string): Promise<T | null> { return structuredClone(this.values.get(collection + "/" + id) as T ?? null); }
  async list<T extends Versioned>(collection: string): Promise<T[]> { return [...this.values.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, value]) => structuredClone(value) as T); }
  async page<T extends Versioned>(collection: string, cursor?: string) {
    const boundary = workspaceCursor(cursor), values = (await this.list<T>(collection))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
      .filter(value => !boundary || value.updatedAt < boundary.updatedAt || value.updatedAt === boundary.updatedAt && value.id < boundary.id);
    const items = values.slice(0, 100), last = items.at(-1);
    return { items, nextCursor: values.length > 100 && last ? nextWorkspaceCursor(last.updatedAt, last.id) : null };
  }
  async change<T extends Versioned>(collection: string, id: string, expected: number, _actor: string, action: string, update: (prior: T | null) => T): Promise<T> {
    const key = collection + "/" + id, prior = this.values.get(key) as T ?? null;
    if ((prior?.revision ?? 0) !== expected) throw new WorkflowError("revision_conflict", 409);
    const result = update(structuredClone(prior)); this.values.set(key, structuredClone(result)); this.actions.push({ collection, action }); return structuredClone(result);
  }
  async reserveRead() {} async deferReads(_seconds: number) {}
  async getWriteTarget() { return null; } async reserveWriteTarget() {} async releaseWriteTarget() {}
}

const actor: RevisionActor = { actorId: "synthetic-admin", roles: ["admin"], mode: "live" };
interface VisitState { date: string; caregiverId: string; complete: boolean; discovered: boolean; open?: boolean; }
function fixture() {
  const repo = new MemoryRepository(), calls: ReadInput[] = [], submissions: NotificationSubmission[] = [];
  let now = new Date("2026-10-11T17:20:00Z"), unavailableId: string | null = null, failedId: string | null = null;
  let beforeRead: ((input: ReadInput) => void) | null = null;
  const visits = new Map<string, VisitState>([
    ["77", { date: "2026-10-11", caregiverId: "6", complete: false, discovered: true }],
    ["78", { date: "2026-10-11", caregiverId: "6", complete: false, discovered: true }],
    ["79", { date: "2026-10-10", caregiverId: "6", complete: false, discovered: true }],
  ]);
  const settings: Settings = { id: "owner", revision: 2, updatedAt: now.toISOString(), officeId: "123", officeTimezone: "America/Chicago",
    enabledReads: ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"], policyReference: "Synthetic acceptance", missingClockInMinutes: null, missingClockOutMinutes: null };
  repo.values.set("workspaceSettings/owner", settings);
  const policy: RevisionPolicy = { ...defaultRevisionPolicy("123"), revision: 1, updatedAt: now.toISOString(),
    monitoringEnabled: true, quietHours: { startHour: 11, endHour: 13 }, smsPolicyReference: "Synthetic messaging consent policy",
    tokenInstructions: "the approved synthetic submission method", tokenInstructionsReference: "Synthetic vendor instructions" };
  repo.values.set("revisionPolicies_office_123/owner", policy);
  const contract: SourceContract = { id: "owner", officeId: "123", revision: 1, updatedAt: now.toISOString(), version: "synthetic-token-acceptance-v1",
    reviewReference: "Synthetic source acceptance only", validUntil: "2027-01-01T00:00:00Z", offsetsValidated: true, completeFieldSemantics: true,
    missingEvvMeansAbsent: true, serviceTimeBasis: "actual", nullEndMeansOpen: true, clockingAttemptFromEvv: true,
    fixedVisitTypes: ["synthetic-token"], variableVisitTypes: [], clockingMethodField: "VisitType", tokenValues: ["synthetic-token"], callsAccepted: false, maxAgeSeconds: 300 };
  repo.values.set("revisionSourceAcceptance_office_123/owner", contract);
  const contact: ContactRecord = { id: "caregiver_6", recipientRef: "caregiver_6", officeId: "123", revision: 1,
    updatedAt: now.toISOString(), kind: "caregiver", phone: "+18325550123", firstName: "Synthetic", smsAllowed: true, optedOut: false,
    validatedAt: now.toISOString(), reviewedBy: actor.actorId, reviewReference: "Synthetic caregiver consent" };
  repo.values.set("revisionContacts_office_123/caregiver_6", contact);
  const read = (operation: ReadInput["operation"], records: Record<string, string | null>[]): OperationalRead => ({ operation, records, source: "hhaexchange",
    fetchedAt: now.toISOString(), validation: "source_unvalidated", timezone: "source_values_unconverted", truncated: false });
  const workspace = new OperationsWorkspace(repo, async input => {
    calls.push(structuredClone(input));
    beforeRead?.(input);
    if (input.operation === "GetPatientDemographics") return read(input.operation, [{ PatientID: input.id!, OfficeID: "123" }]);
    if (input.operation === "SearchVisitsV2") return read(input.operation, [...visits].filter(([, value]) => value.date === input.date && value.discovered).map(([VisitID]) => ({ VisitID })));
    if (input.operation !== "GetVisitInfoV3") throw new Error("Unexpected source operation");
    if (input.id === unavailableId) throw new WorkflowError("synthetic_source_unavailable", 503);
    const state = visits.get(input.id!)!;
    const start = state.date + "T08:00:00-05:00", end = state.date + "T12:00:00-05:00";
    return read(input.operation, [{ ID: input.id!, VisitDate: state.date, "Patient/ID": "5", "Caregiver/ID": state.caregiverId, VisitType: "synthetic-token",
      ScheduleStartTime: start, ScheduleEndTime: end, VisitStartTime: state.complete || state.open ? start : null, VisitEndTime: state.complete ? end : null,
      EVVStartTime: state.complete || state.open ? start : null, EVVEndTime: state.complete ? end : null,
      ...(input.id === failedId ? { ScheduleStartTime: "08:00" } : {}) }]);
  }, true);
  const backend = new RevisionBackend(repo, workspace, { data: true, source: true, monitor: true, smsCapability: true, smsConfiguration: true, smsSend: true }, {
    submit: async input => { submissions.push(input); return { state: "accepted", providerId: "synthetic-provider-id" }; },
    reconcile: async input => ({ state: "unknown", providerId: input.providerId }),
  }, () => now);
  return { repo, backend, calls, submissions, visits,
    clock: () => new Date(now), beforeRead: (callback: (input: ReadInput) => void) => { beforeRead = callback; },
    advance: () => { now = new Date(now.getTime() + 3_600_000); },
    unavailable: (id: string) => { unavailableId = id; }, failed: (id: string) => { failedId = id; } };
}
async function queuedGroup(f: ReturnType<typeof fixture>): Promise<NotificationOutboxRecord> {
  await f.backend.monitor(); // Today's two visits share one missing service date.
  await f.backend.monitor(); // Today retains priority for three of four runs.
  await f.backend.monitor();
  await f.backend.monitor(); // The fourth run adds the previous day's missing date.
  const { box, context } = await f.backend.outbox(actor), page = await box.page(context);
  const record = page.items.find(item => item.rule === "missing_token_days" && item.visitId === "79");
  assert.ok(record, "A reminder should cover the caregiver's accepted two-day window");
  assert.equal(record.state, "queued"); assert.equal(f.submissions.length, 0, "Quiet hours must keep the fake adapter untouched");
  return record;
}

test("aggregated token reminders reread all visits and send one caregiver message counting distinct days", async () => {
  const f = fixture(), record = await queuedGroup(f), before = f.calls.length;
  f.advance(); const { box, context } = await f.backend.outbox(actor), result = await box.send(record.id, context);
  assert.equal(result.state, "accepted"); assert.equal(f.submissions.length, 1);
  assert.match(f.submissions[0]!.body, /missing token-device entries for 2 visit days/);
  assert.equal(f.submissions[0]!.to, "+18325550123");
  assert.deepEqual(f.calls.slice(before).filter(call => call.operation === "GetVisitInfoV3").map(call => call.id).sort(), ["77", "78", "79"]);
  assert.deepEqual(f.calls.slice(before).filter(call => call.operation === "SearchVisitsV2").map(call => call.date).sort(), ["2026-10-10", "2026-10-11"]);
  assert.ok(f.calls.every(call => ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"].includes(call.operation)), "The reminder must never perform an HHA source write");
});

test("resolved later dates reduce the current reminder count instead of using the saved missing-day count", async () => {
  const f = fixture(), record = await queuedGroup(f);
  f.visits.get("77")!.complete = true; f.visits.get("78")!.complete = true;
  f.advance(); const { box, context } = await f.backend.outbox(actor);
  assert.equal((await box.send(record.id, context)).state, "accepted");
  assert.equal(f.submissions.length, 1); assert.match(f.submissions[0]!.body, /missing token-device entries for 1 visit days/);
  assert.doesNotMatch(f.submissions[0]!.body, /for 2 visit days/);
});

test("resolution of the first missing date suppresses the obsolete occurrence without texting", async () => {
  const f = fixture(), record = await queuedGroup(f); f.visits.get("79")!.complete = true;
  f.advance(); const { box, context } = await f.backend.outbox(actor), result = await box.send(record.id, context);
  assert.equal(result.state, "suppressed"); assert.equal(result.suppression?.reason, "condition_resolved"); assert.equal(f.submissions.length, 0);
});

test("an unavailable or unusable visit in the aggregate prevents any SMS submission", async () => {
  for (const failure of ["unavailable", "failed"] as const) {
    const f = fixture(), record = await queuedGroup(f);
    f[failure]("78"); f.advance(); const { box, context } = await f.backend.outbox(actor);
    await assert.rejects(box.send(record.id, context), /synthetic_source_unavailable|notification_token_group_unavailable/);
    assert.equal(f.submissions.length, 0); assert.equal((await box.get(record.id, context)).state, "queued");
  }
});

test("a token visit removed from office discovery cannot trigger a reminder from cached evidence", async () => {
  const f = fixture(), record = await queuedGroup(f); f.visits.get("79")!.discovered = false;
  f.advance(); const { box, context } = await f.backend.outbox(actor);
  await assert.rejects(box.send(record.id, context), /token_visit_no_longer_discovered/);
  assert.equal(f.submissions.length, 0); assert.equal((await box.get(record.id, context)).state, "queued");
});

test("a resolved first roster cannot starve a later caregiver's missing token reminder", async () => {
  const f = fixture(); f.visits.delete("79");
  f.visits.set("80", { date: "2026-10-11", caregiverId: "8", complete: true, discovered: true });
  // Firestore's descending ID tie-breaker puts resolved caregiver 8 first.
  await f.backend.contacts(actor, { id: "caregiver_8", revision: 0, kind: "caregiver", phone: "8325550124", firstName: "Other synthetic",
    smsAllowed: true, optedOut: false, reviewReference: "Synthetic caregiver consent" });
  await f.backend.monitor();
  const first = await f.backend.outbox(actor);
  assert.equal((await first.box.page(first.context)).items.filter(item => item.rule === "missing_token_days").length, 0);
  await f.backend.monitor();
  const second = await f.backend.outbox(actor), notifications = (await second.box.page(second.context)).items;
  assert.equal(notifications.filter(item => item.rule === "missing_token_days" && item.recipientRef === "caregiver_6").length, 1);
  assert.equal(f.submissions.length, 0);
});

test("office supervisors can review notifications and build a gated provider adapter without dispatching SMS", async () => {
  const f = fixture(); await queuedGroup(f);
  const supervisor: RevisionActor = { ...actor, actorId: "synthetic-office-supervisor", roles: ["office_supervisor"] };
  const { box, context } = await f.backend.outbox(supervisor);
  assert.ok((await box.page(context)).items.some(item => item.rule === "missing_token_days"));
  const configuration = await f.backend.smsConfiguration(supervisor);
  let accesses = 0;
  const adapter = await createSmsAdapter(configuration.config, configuration.context, {
    getAccessToken: async () => ({ access_token: "synthetic-adc-token", expires_in: 3600 }),
    request: async url => {
      assert.match(String(url), /^https:\/\/secretmanager\.googleapis\.com\//); accesses++;
      const credentials = { accountSid: "AC" + "b".repeat(32), authToken: "synthetic-provider-secret", from: "+18325550123" };
      return new Response(JSON.stringify({ payload: { data: Buffer.from(JSON.stringify(credentials)).toString("base64") } }));
    },
  });
  assert.ok(adapter); assert.equal(accesses, 1); assert.equal(f.submissions.length, 0);
  const before = f.calls.length;
  await assert.rejects(f.backend.outbox({ ...supervisor, roles: ["viewer"] }), /revision_management_role_required/);
  assert.equal(f.calls.length, before);
});

interface NotificationFactForTest extends Versioned { officeId: string; rule: string; visitId: string; occurrenceId: string; detectedAt: string; policyFingerprint: string; }
const factCollection = "revisionNotificationFacts_office_123";
const checkpointKey = "revisionMonitor_office_123/checkpoint";
interface CheckpointForTest extends Versioned { tokenCursor: string | null; leaseUntil: string; lastRunState: string; plan: { turn: number }; }

for (const condition of ["token", "open"] as const) test(`an accepted policy refresh preserves the ${condition} occurrence, detection time and one SMS submission`, async () => {
  const f = fixture(); f.visits.delete("79");
  const rule = condition === "token" ? "missing_token_days" : "missing_clock_out";
  if (condition === "open") {
    f.visits.delete("78"); f.visits.get("77")!.open = true;
    const key = "revisionSourceAcceptance_office_123/owner", contract = await f.repo.get<SourceContract>("revisionSourceAcceptance_office_123", "owner");
    f.repo.values.set(key, { ...contract!, revision: contract!.revision + 1, clockingMethodField: null } as SourceContract);
  }
  await f.backend.monitor();
  const { box, context } = await f.backend.outbox(actor), original = (await box.page(context)).items.find(item => item.rule === rule)!;
  assert.ok(original); assert.equal(original.state, "queued"); assert.equal(f.submissions.length, 0);
  const initialFact = (await f.repo.list<NotificationFactForTest>(factCollection)).find(item => item.rule === rule)!;
  assert.ok(initialFact);
  f.advance();
  const priorPolicy = await f.repo.get<RevisionPolicy>("revisionPolicies_office_123", "owner");
  f.repo.values.set("revisionPolicies_office_123/owner", { ...priorPolicy!, revision: priorPolicy!.revision + 1, updatedAt: f.clock().toISOString(), earlyReminderMinutes: 30 } as RevisionPolicy);
  await assert.rejects(box.send(original.id, context), /notification_policy_changed_restart/);
  assert.equal(f.submissions.length, 0, "An old fence must not authorize delivery under the new policy");
  await f.backend.monitor();
  const refreshedFacts = (await f.repo.list<NotificationFactForTest>(factCollection)).filter(item => item.rule === rule);
  assert.equal(refreshedFacts.length, 1); assert.equal(refreshedFacts[0]!.id, initialFact.id); assert.equal(refreshedFacts[0]!.detectedAt, initialFact.detectedAt);
  assert.equal(refreshedFacts[0]!.occurrenceId, initialFact.occurrenceId); assert.notEqual(refreshedFacts[0]!.policyFingerprint, initialFact.policyFingerprint);
  assert.equal(refreshedFacts[0]!.revision, initialFact.revision + 1);
  const notifications = (await box.page(context)).items.filter(item => item.rule === rule);
  assert.equal(notifications.length, 1); assert.equal(notifications[0]!.id, original.id); assert.equal(notifications[0]!.detectedAt, original.detectedAt);
  assert.equal(f.submissions.length, 1); assert.equal(f.submissions[0]!.outboxId, original.id);
  await f.backend.monitor(); assert.equal(f.submissions.length, 1, "Reevaluation or provider reconciliation must not dispatch a second SMS");
});

async function twoCaregiverRosters() {
  const f = fixture(); f.visits.delete("79");
  f.visits.set("80", { date: "2026-10-11", caregiverId: "8", complete: false, discovered: true });
  await f.backend.contacts(actor, { id: "caregiver_8", revision: 0, kind: "caregiver", phone: "8325550124", firstName: "Other synthetic",
    smsAllowed: true, optedOut: false, reviewReference: "Synthetic caregiver consent" });
  await f.backend.monitor(); await f.backend.monitor();
  const { box, context } = await f.backend.outbox(actor), queued = (await box.page(context)).items;
  assert.ok(queued.some(item => item.recipientRef === "caregiver_8" && item.state === "queued"));
  assert.ok(queued.some(item => item.recipientRef === "caregiver_6" && item.state === "queued"));
  assert.equal((f.repo.values.get(checkpointKey) as CheckpointForTest).tokenCursor, null);
  return { f, box, context, queued };
}

test("a removed roster advances its cursor and monitor checkpoint while another queued caregiver message proceeds", async () => {
  const { f, box, context, queued } = await twoCaregiverRosters();
  f.visits.get("80")!.discovered = false; f.advance();
  const rosterKey = "revisionTokenRoster_office_123/8", roster = f.repo.values.get(rosterKey)!;
  // The invalid roster is first in the same-time Firestore ID order, exercising the skip path.
  f.repo.values.set(rosterKey, { ...roster, updatedAt: f.clock().toISOString(), revision: roster.revision + 1 });
  const before = f.calls.length, revision = (f.repo.values.get(checkpointKey) as CheckpointForTest).revision;
  assert.equal((await f.backend.monitor()).processed, 2);
  const checkpoint = f.repo.values.get(checkpointKey) as CheckpointForTest;
  assert.equal(checkpoint.revision, revision + 2); assert.equal(checkpoint.lastRunState, "partial_window"); assert.equal(Date.parse(checkpoint.leaseUntil), 0); assert.equal(checkpoint.plan.turn, 3);
  assert.ok(checkpoint.tokenCursor); assert.equal(JSON.parse(Buffer.from(checkpoint.tokenCursor!, "base64url").toString()).id, "8");
  assert.equal(f.calls.slice(before).some(input => input.operation === "GetVisitInfoV3" && input.id === "80"), false);
  assert.equal(f.submissions.length, 1); assert.equal(f.submissions[0]!.to, "+18325550123");
  const removed = queued.find(item => item.recipientRef === "caregiver_8")!, other = queued.find(item => item.recipientRef === "caregiver_6")!;
  assert.equal((await box.get(removed.id, context)).state, "queued"); assert.equal((await box.get(other.id, context)).state, "accepted");
  assert.ok(f.repo.actions.some(item => item.action === "monitor_completed"));
});

for (const change of ["policy", "office"] as const) test(`a change to ${change} during removed-roster recheck still aborts monitoring`, async () => {
  const { f } = await twoCaregiverRosters(); f.visits.get("80")!.discovered = false;
  let discoveries = 0;
  f.beforeRead(input => {
    if (input.operation !== "SearchVisitsV2" || ++discoveries !== 2) return;
    if (change === "policy") {
      const policy = f.repo.values.get("revisionPolicies_office_123/owner") as RevisionPolicy;
      f.repo.values.set("revisionPolicies_office_123/owner", { ...policy, revision: policy.revision + 1, earlyReminderMinutes: 30 } as RevisionPolicy);
    } else {
      const settings = f.repo.values.get("workspaceSettings/owner") as Settings;
      f.repo.values.set("workspaceSettings/owner", { ...settings, revision: settings.revision + 1, officeId: "124" } as Settings);
    }
  });
  const completedBefore = f.repo.actions.filter(item => item.action === "monitor_completed").length;
  await assert.rejects(f.backend.monitor(), /revision_policy_changed_restart/);
  assert.equal(f.repo.actions.filter(item => item.action === "monitor_completed").length, completedBefore);
  assert.equal((f.repo.values.get(checkpointKey) as CheckpointForTest).lastRunState, "revision_policy_changed_restart");
  assert.equal(f.submissions.length, 0, "A roster-local skip cannot hide a changed trusted scope");
});
