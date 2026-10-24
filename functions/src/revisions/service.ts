import { createHash } from "node:crypto";
import type { OperationsWorkspace, Versioned, WorkspaceRepository } from "../operations/workspace.js";
import { WorkflowError, identifier, type OperationalRead, type ReadInput } from "../operations/reads.js";
import { adaptVisitEvidence, evidenceIsFresh, type NormalizedVisitEvidence } from "./evidence.js";
import { evaluateVisit, summarizeMissingTokenDays, type VisitDiagnosis, type VisitDiagnosisIssue } from "./diagnosis.js";
import { RevisionConfiguration, expectedRevision, recordId, strictObject, type RevisionPolicy } from "./policy.js";
import { RevisionRecords, requirementStatus, type RevisionContext } from "./records.js";
import { NotificationOutbox, notificationDeliveryCursor, type NotificationDeliveryAdapter, type NotificationEvidence, type NotificationRequest, type NotificationRule } from "./notifications.js";
import type { SmsFactoryConfig } from "./sms.js";
import { buildTokenGroups } from "./tokenGroups.js";
import { chooseMonitorWindow, advanceMonitorWindow, resetMonitorWindow, type MonitorPlanState } from "./monitorPlan.js";
import { adaptVerificationReceipt } from "./verification.js";
import { loadMemberContext, type MemberContextResult } from "./memberContext.js";
import { OverlapScanner, overlapContext, reviewedOverlapCandidate, type OverlapWindow } from "./overlap.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
export interface RevisionApprovals { data: boolean; source: boolean; monitor: boolean; smsCapability: boolean; smsConfiguration: boolean; smsSend: boolean; }
export interface RevisionActor { actorId: string; roles: readonly string[]; mode: "demo" | "live"; }
interface NotificationFact extends Versioned {
  officeId: string; date: string; rule: NotificationRule; visitId: string; occurrenceId: string;
  kind: VisitDiagnosisIssue["kind"]; relatedVisitId: string | null; detectedAt: string; policyFingerprint: string;
  relatedVisitDate?: string | null;
  tokenRosterId?: string;
}
interface TokenRoster extends Versioned { officeId: string; caregiverId: string; visits: { visitId: string; date: string }[]; policyFingerprint: string; coverage: "accepted_input_only"; }
interface MonitorCheckpoint extends Versioned { officeId: string; plan?: MonitorPlanState; leaseUntil: string; lastRunState: string; tokenCursor?: string | null; notificationCursor?: string | null; notificationCursorVersion?: 1; }
interface DiagnosisRecord extends Versioned { officeId: string; date: string; evidence: NormalizedVisitEvidence; diagnosis: VisitDiagnosis; }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) throw new WorkflowError("invalid_revision_date");
  return value;
}
export function officeDate(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  return ["year", "month", "day"].map(key => parts.find(item => item.type === key)!.value).join("-");
}
export class RevisionBackend {
  private deadline = Infinity;
  constructor(private repository: WorkspaceRepository, private workspace: Workspace, private approvals: RevisionApprovals,
    private adapter?: NotificationDeliveryAdapter, private now: () => Date = () => new Date()) {}
  private async query(value: ReadInput, actor: string): Promise<OperationalRead> {
    if (performance.now() >= this.deadline) throw new WorkflowError("revision_run_budget_deferred", 429, 300);
    try {
      const settings = (await this.workspace.settings()).settings;
      const result = await this.workspace.query(value, actor);
      if (value.operation === "GetVisitInfoV3" && !result.truncated && result.records.length === 1 && result.records[0]?.ID === value.id) {
        const patientId = identifier(result.records[0]?.["Patient/ID"]);
        const patient = await this.query({ operation: "GetPatientDemographics", id: patientId }, actor);
        if (!settings.officeId || patient.operation !== "GetPatientDemographics" || patient.source !== "hhaexchange" || patient.truncated || patient.records.length !== 1
          || patient.records[0]?.PatientID !== patientId || patient.records[0]?.OfficeID !== settings.officeId) throw new WorkflowError("visit_patient_office_mismatch", 403);
      }
      if (JSON.stringify((await this.workspace.settings()).settings) !== JSON.stringify(settings)) throw new WorkflowError("revision_policy_changed_restart", 409);
      return result;
    } catch (error) {
      if (error instanceof WorkflowError && error.code === "office_policy_changed_restart") throw new WorkflowError("revision_policy_changed_restart", 409);
      throw error;
    }
  }
  private role(actor: RevisionActor) {
    if (actor.mode !== "live") throw new WorkflowError("demo_revision_actions_disabled", 423);
    if (!actor.roles.some(role => role === "admin" || role === "office_supervisor")) throw new WorkflowError("revision_management_role_required", 403);
  }
  private async scope(actor: RevisionActor, requireData = true) {
    this.role(actor);
    const current = await this.workspace.settings();
    if (requireData && (!this.approvals.data || !current.dataApproved)) throw new WorkflowError("operational_data_release_not_approved", 423);
    const officeId = identifier(current.settings.officeId), timezone = current.settings.officeTimezone;
    try { if (!timezone) throw new Error(); new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { throw new WorkflowError("office_timezone_not_configured", 423); }
    return { current, officeId, timezone: timezone!, configuration: new RevisionConfiguration(this.repository, officeId, this.now) };
  }
  private context(actor: RevisionActor, officeId: string): RevisionContext { return { ...actor, officeId, dataApproved: this.approvals.data }; }
  async status(actor: RevisionActor) {
    this.role(actor);
    const current = await this.workspace.settings();
    let officeId: string | null = null, configuration: RevisionConfiguration | null = null;
    try { officeId = identifier(current.settings.officeId); configuration = new RevisionConfiguration(this.repository, officeId, this.now); } catch { /* Scope not configured. */ }
    const policy = configuration ? await configuration.policy() : null;
    const contract = this.approvals.source && configuration ? await configuration.sourceContract() : null;
    const data = this.approvals.data && current.dataApproved;
    const readsReady = ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"].every(operation => current.settings.enabledReads.includes(operation));
    let timezoneReady = false;
    try { if (current.settings.officeTimezone) { new Intl.DateTimeFormat("en", { timeZone: current.settings.officeTimezone }); timezoneReady = true; } } catch { /* Await owner timezone configuration. */ }
    const sourceReady = readsReady && timezoneReady && !!contract;
      if (JSON.stringify((await this.workspace.settings()).settings) !== JSON.stringify(current.settings)) throw new WorkflowError("revision_policy_changed_restart", 409);
      return { ok: true, mode: "live", officeId, source: "primetime", dataApproved: data, policy,
        workspaceScope: { officeId, officeTimezone: current.settings.officeTimezone, revision: current.settings.revision },
      capabilities: { diagnosis: data && sourceReady, records: data && !!officeId && timezoneReady, monitoring: data && sourceReady && this.approvals.monitor && policy?.monitoringEnabled === true,
        memberContext: data && sourceReady && contract?.memberContext?.accepted === true && ["GetScheduleInfo", "GetPatientContracts", "SearchPatientAuthorizations", "GetPatientAuthorizationInfo"].every(operation => current.settings.enabledReads.includes(operation)),
        overlapChecks: data && sourceReady && !!contract?.overlapCoverage && contract.overlapCoverage.timezone === current.settings.officeTimezone,
        notificationRecords: data && !!officeId && timezoneReady && this.approvals.smsCapability && this.approvals.smsConfiguration,
        sms: data && sourceReady && this.approvals.monitor && policy?.monitoringEnabled === true && this.approvals.smsCapability && this.approvals.smsConfiguration && this.approvals.smsSend && !!policy?.smsPolicyReference && !!policy.quietHours },
      sourceAcceptance: contract ? { version: contract.version, reference: contract.reviewReference, validUntil: contract.validUntil } : null,
      earlyReminderConfigured: policy?.earlyReminderMinutes !== null && policy?.earlyReminderMinutes !== undefined,
      sourceWritesEnabled: false, blockedReason: !data ? "operational_data_release_not_approved" : !officeId ? "office_not_configured" : !timezoneReady ? "office_timezone_not_configured" : !readsReady ? "revision_reads_not_enabled" : !contract ? "source_acceptance_pending" : null };
  }
  async policy(actor: RevisionActor, input?: unknown) {
    const { configuration } = await this.scope(actor, false);
    return input === undefined ? configuration.policy() : configuration.savePolicy(input, actor.actorId);
  }
  async contacts(actor: RevisionActor, input?: unknown, cursor?: string) {
    const { configuration } = await this.scope(actor);
    return input === undefined ? configuration.contacts(cursor) : configuration.saveContact(input, actor.actorId);
  }
  private async fence(actor: RevisionActor) {
    const scope = await this.scope(actor), policy = await scope.configuration.policy();
    const contract = this.approvals.source ? await scope.configuration.sourceContract() : null;
    const signature = hash({ settings: scope.current.settings, data: scope.current.dataApproved, policy, contract });
    const check = async () => {
      const fresh = await this.scope(actor), newPolicy = await fresh.configuration.policy(), newContract = this.approvals.source ? await fresh.configuration.sourceContract() : null;
      if (signature !== hash({ settings: fresh.current.settings, data: fresh.current.dataApproved, policy: newPolicy, contract: newContract })) throw new WorkflowError("revision_policy_changed_restart", 409);
    };
    return { ...scope, policy, contract, signature, check };
  }
  async visits(actor: RevisionActor, value: unknown) {
    const started = performance.now();
    const input = strictObject(value, ["date", "offset", "discovery", "limit"], ["date"]), serviceDate = date(input.date);
    const limit = input.limit === undefined ? 10 : Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10 || input.limit !== undefined && (typeof input.limit !== "string" || !/^(?:[1-9]|10)$/.test(input.limit))) throw new WorkflowError("invalid_revision_limit");
    const offset = input.offset === undefined ? 0 : Number(input.offset);
    if (!Number.isInteger(offset) || offset < 0 || offset >= 200 || (input.offset !== undefined && (typeof input.offset !== "string" || !/^\d{1,3}$/.test(input.offset)))) throw new WorkflowError("invalid_revision_offset");
    const scope = await this.fence(actor), discovery = await this.query({ operation: "SearchVisitsV2", officeId: scope.officeId, date: serviceDate }, actor.actorId);
    if (discovery.operation !== "SearchVisitsV2" || discovery.source !== "hhaexchange" || discovery.records.length > 200) throw new WorkflowError("invalid_visit_discovery_response", 502);
    const ids = [...new Set(discovery.records.map(item => identifier(item.VisitID)))].sort((a, b) => Number(a) - Number(b));
    const fingerprint = hash(ids);
    if (offset && input.discovery !== fingerprint) throw new WorkflowError("revision_discovery_changed_restart", 409);
    // Rich source joins use a smaller page so each visit has a bounded chance
    // to load its context rather than repeatedly starving the page's tail.
    const memberReadsReady = ["GetPatientDemographics", "GetScheduleInfo", "GetPatientContracts", "SearchPatientAuthorizations", "GetPatientAuthorizationInfo"].every(operation => scope.current.settings.enabledReads.includes(operation));
    const richContext = !!scope.contract?.memberContext && memberReadsReady;
    const selectedIds = ids.slice(offset, offset + (richContext ? Math.min(limit, 2) : limit)), evidence: NormalizedVisitEvidence[] = [];
    const memberContexts = new Map<string, MemberContextResult>();
    let sourceRetryAfter: number | null = null;
    for (const visitId of selectedIds) {
      await scope.check();
      let source: OperationalRead | null = null, readError: string | undefined;
      // A deferred ID must remain at the head of the next bounded read. It is
      // neither an evaluated visit nor progress that a monitor may checkpoint.
      if (performance.now() - started >= 25000) break;
      try { source = await this.query({ operation: "GetVisitInfoV3", id: visitId }, actor.actorId); }
      catch (error) {
        if (error instanceof WorkflowError && error.status === 429 && evidence.length) {
          // Keep only the completed, office-checked prefix. The throttled ID
          // stays at nextOffset so a retry cannot skip it or invent evidence.
          sourceRetryAfter = Math.max(1, Math.min(600, error.retryAfterSeconds ?? 60));
          break;
        }
        if (error instanceof WorkflowError && [403, 423, 429].includes(error.status)) throw error;
        readError = "source_read_failed";
      }
      const visit = this.adapt(source, visitId, serviceDate, ids, scope, readError);
      evidence.push(visit);
      if (scope.contract?.memberContext && memberReadsReady) {
        memberContexts.set(visitId, await loadMemberContext({ visit, query: input => this.query(input, actor.actorId), fence: scope.check,
          now: () => this.now().toISOString(), acceptance: scope.contract.memberContext, maxQueries: 7, maxAuthorizationDetails: 3,
          timeBudgetMs: Math.max(1, Math.min(20000, Math.floor(25000 - (performance.now() - started)))) }));
      }
    }
    await scope.check();
    if (selectedIds.length && !evidence.length) throw new WorkflowError("revision_batch_time_budget_deferred", 429, 60);
    const attemptedCount = evidence.length, nextOffset = offset + attemptedCount < ids.length ? offset + attemptedCount : null;
    let window: OverlapWindow | null = null;
    if (!sourceRetryAfter && scope.contract?.overlapCoverage && scope.contract.overlapCoverage.timezone === scope.timezone) {
      const contract = scope.contract, phaseLimit = Number.isFinite(this.deadline) ? 45000 : 25000;
      const scanner = new OverlapScanner(this.repository, {
        discover: async date => {
          const result = await this.query({ operation: "SearchVisitsV2", officeId: scope.officeId, date }, actor.actorId);
          if (result.operation !== "SearchVisitsV2" || result.source !== "hhaexchange") throw new WorkflowError("invalid_overlap_discovery", 502);
          return { visitIds: result.records.map(row => identifier(row.VisitID)), fetchedAt: result.fetchedAt, truncated: result.truncated };
        },
        read: async (id, date, discoveredIds) => this.adapt(await this.query({ operation: "GetVisitInfoV3", id }, actor.actorId), id, date, [...discoveredIds], scope),
        checkFence: scope.check, canContinue: () => performance.now() - started < phaseLimit && performance.now() < this.deadline && Date.parse(contract.overlapCoverage!.validUntil) > this.now().getTime(),
      }, () => this.now());
      window = await scanner.scan({ officeId: scope.officeId, date: serviceDate, timezone: scope.timezone, revision: scope.current.settings.revision,
        fence: scope.signature, acceptanceVersion: contract.version, maxAgeSeconds: contract.maxAgeSeconds, coverageAcceptance: contract.overlapCoverage ?? null },
      { actorId: actor.actorId, maxDetailReads: 2, maxDiscoveryReads: 3 });
    }
    await scope.check();
    const evaluatedAt = this.now().toISOString(), ruleVersion = this.ruleVersion(scope);
    const changedObservation = !!window && evidence.some(current => window.observations.some(cached => cached.visitId === current.visitId && cached.scope.date === current.scope.date && cached.provenance?.sourceRevision !== current.provenance?.sourceRevision));
    const items = evidence.map(item => {
      const member = memberContexts.get(item.visitId), related = window ? overlapContext(window, item, evaluatedAt, scope.contract?.overlapAllowances) : null;
      const fallback = evidence.filter(peer => peer.visitId !== item.visitId && (peer.patientId === item.patientId && !!item.patientId || peer.caregiverId === item.caregiverId && !!item.caregiverId)).map(peer => reviewedOverlapCandidate(item, peer, evaluatedAt, scope.contract?.overlapAllowances));
      const peerKey = (peer: NormalizedVisitEvidence) => peer.scope.date + ":" + peer.visitId;
      const peers = new Map(fallback.map(candidate => [peerKey(candidate.visit), candidate]));
      let changedPeer = changedObservation;
      for (const candidate of related?.overlaps ?? []) {
        const current = peers.get(peerKey(candidate.visit));
        if (current) { if (current.visit.provenance?.sourceRevision !== candidate.visit.provenance?.sourceRevision) changedPeer = true; }
        else peers.set(peerKey(candidate.visit), candidate);
      }
      const candidates = [...peers.values()], capped = candidates.length > 20;
      const coverage = related ? { ...related.coverage, complete: related.overlapWindowComplete && !changedPeer && !capped,
        reasons: [...new Set([...related.coverage.reasons, ...(changedPeer ? ["current_page_source_changed"] : []), ...(capped ? ["candidate_limit_reached"] : [])])] } : null;
      return { evidence: item, diagnosis: evaluateVisit(item, { version: ruleVersion, earlyReminderMinutes: scope.policy.earlyReminderMinutes }, evaluatedAt,
        { ...member?.context, overlaps: candidates.slice(0, 20), overlapWindowComplete: coverage?.complete ?? false }),
      memberContext: member ? { scope: item.scope, visitId: item.visitId, patientId: item.patientId, authorizationWindow: member.authorizationWindow, recordedEligibility: member.recordedEligibility, completeness: member.completeness,
        sources: member.sources.map(({ operation, state, reason, fetchedAt, sourceRevision }) => ({ operation, state, reason, fetchedAt, sourceRevision })) } : null,
      overlapCoverage: coverage };
    });
    return { ok: true, mode: "live" as const, source: "hhaexchange", scope: { officeId: scope.officeId, date: serviceDate, timezone: scope.timezone },
      evaluatedAt, items, nextOffset, discovery: fingerprint, ...(sourceRetryAfter ? { retryAfterSeconds: sourceRetryAfter } : {}),
      completeness: { complete: false, truncated: discovery.truncated, selectedCount: ids.length, pageSelectedCount: selectedIds.length,
        attemptedCount, evaluatedCount: evidence.length, deferredCount: selectedIds.length - attemptedCount },
      tokenSummary: summarizeMissingTokenDays(evidence, evaluatedAt), fence: scope.signature };
  }
  private ruleVersion(scope: Awaited<ReturnType<RevisionBackend["fence"]>>) { return `revision-v1:${scope.current.settings.revision}:${scope.policy.revision}:${scope.contract?.version ?? "pending"}`; }
  private adapt(source: OperationalRead | null, visitId: string, serviceDate: string, ids: string[], scope: Awaited<ReturnType<RevisionBackend["fence"]>>, readError?: string) {
    const contract = scope.contract, facts = source?.records[0], evvStart = facts?.EVVStartTime, evvEnd = facts?.EVVEndTime;
    const visitType = facts?.VisitType;
    const scheduleType = visitType && contract?.fixedVisitTypes.includes(visitType) ? "fixed" : visitType && contract?.variableVisitTypes.includes(visitType) ? "variable" : "unknown";
    const evidenceScope = { officeId: scope.officeId, date: serviceDate, timezone: scope.timezone, revision: scope.current.settings.revision };
    const evidence = adaptVisitEvidence(source, { scope: evidenceScope, visitId, now: this.now().toISOString(), ...(readError ? { readError } : {}),
      acceptance: contract ? { operation: "GetVisitInfoV3", version: contract.version, accepted: true, complete: true, scope: evidenceScope, visitIds: ids,
        maxAgeSeconds: contract.maxAgeSeconds, missingEvvMeansAbsent: contract.missingEvvMeansAbsent, serviceTimeBasis: contract.serviceTimeBasis } : null,
      scheduleType, variableScheduleAccepted: scheduleType === "variable", verification: "unknown",
      clockingMethod: contract?.clockingMethodField && facts?.[contract.clockingMethodField] && contract.tokenValues.includes(facts[contract.clockingMethodField]!) ? "token" : "unknown",
      clockingAttempt: contract?.clockingAttemptFromEvv ? evvStart || evvEnd ? "present" : "none" : "unknown",
      openState: contract?.nullEndMeansOpen && evvStart && !evvEnd && !facts?.VisitEndTime ? "open" : evvEnd ? "closed" : "unknown" });
    const verificationReceipt = adaptVerificationReceipt(evidence, { scope: evidenceScope, visitId, now: this.now().toISOString(), acceptance: contract?.verificationReceipt ?? null });
    return { ...evidence, verification: verificationReceipt.verification, verificationReceipt };
  }
  async records(actor: RevisionActor) {
    const { officeId } = await this.scope(actor);
    return new RevisionRecords(this.repository, this.context(actor, officeId), this.now);
  }
  async requirements(actor: RevisionActor, cursor?: string) {
    const { timezone } = await this.scope(actor), records = await this.records(actor), page = await records.page("requirements", { cursor });
    const asOfDate = officeDate(this.now(), timezone);
    return { ...page, asOfDate, items: page.items.map(item => ({ ...item, status: requirementStatus(item as import("./records.js").RequirementRecord, asOfDate) })) };
  }
  async callCandidates(actor: RevisionActor, value: unknown) {
    const input = strictObject(value, ["id", "revision", "date", "visitId", "lastId", "note"]), serviceDate = date(input.date), visitId = identifier(input.visitId), scope = await this.fence(actor);
    if (typeof input.lastId !== "string" || !/^(?:0|[1-9]\d{0,9})$/.test(input.lastId) || Number(input.lastId) > 2147483647) throw new WorkflowError("explicit_call_source_boundary_required");
    const discovery = await this.query({ operation: "SearchVisitsV2", officeId: scope.officeId, date: serviceDate }, actor.actorId);
    if (!discovery.records.some(item => item.VisitID === visitId)) throw new WorkflowError("visit_not_in_office_discovery", 403);
    await scope.check();
    const visit = await this.query({ operation: "GetVisitInfoV3", id: visitId }, actor.actorId), evidence = this.adapt(visit, visitId, serviceDate, [visitId], scope);
    if (!evidence.raw || !evidence.provenance) throw new WorkflowError("visit_source_unavailable", 503);
    const caregiverId = evidence.raw["Caregiver/ID"], patientId = evidence.raw["Patient/ID"];
    if (!caregiverId || !patientId) throw new WorkflowError("call_match_identity_unavailable", 423);
    const calls = await this.query({ operation: "GetCallDashBoardData", officeId: scope.officeId, date: serviceDate, patientId: identifier(patientId), caregiverId: identifier(caregiverId), lastId: input.lastId }, actor.actorId);
    if (calls.operation !== "GetCallDashBoardData" || calls.source !== "hhaexchange" || calls.truncated) throw new WorkflowError("call_discovery_incomplete", 423);
    if (scope.contract?.callsAccepted && !evidenceIsFresh(calls.fetchedAt, this.now().toISOString(), scope.contract.maxAgeSeconds)) throw new WorkflowError("call_source_not_fresh", 409);
    const candidates = calls.records.filter(item => item["Patient/ID"] === patientId && item["Caregiver/ID"] === caregiverId).slice(0, 10).map(item => ({ callId: identifier(item.CallDashboardID), sourceHash: hash(item), callTime: item.CallTime ?? null, callType: item.CallType ?? null, caregiverId, patientId }));
    await scope.check();
    const record = await (await this.records(actor)).saveCallMatch({ id: recordId(input.id), revision: expectedRevision(input.revision), officeId: scope.officeId, visitId,
      visitSourceHash: evidence.provenance.sourceRevision, candidates, sourceValidation: evidence.state === "ready" && scope.contract?.callsAccepted ? "accepted" : "source_unvalidated", note: input.note },
      { date: serviceDate, lastId: input.lastId as string, policyFingerprint: scope.signature });
    return record;
  }
  async decideCallMatch(actor: RevisionActor, value: unknown) {
    const input = strictObject(value, ["id", "revision", "officeId", "action", "callId", "reason"]), scope = await this.fence(actor), records = await this.records(actor);
    if (identifier(input.officeId) !== scope.officeId) throw new WorkflowError("office_scope_mismatch", 403);
    if (input.action === "match") {
      const record = await records.get<import("./records.js").CallMatchRecord>("callMatches", input.id), sourceScope = record?.sourceScope;
      if (!record || !sourceScope || sourceScope.policyFingerprint !== scope.signature || !scope.contract?.callsAccepted) throw new WorkflowError("call_match_source_recheck_required", 409);
      const discovery = await this.query({ operation: "SearchVisitsV2", officeId: scope.officeId, date: sourceScope.date }, actor.actorId);
      if (!discovery.records.some(item => item.VisitID === record.visitId)) throw new WorkflowError("call_match_visit_not_discovered", 409);
      await scope.check();
      const visit = this.adapt(await this.query({ operation: "GetVisitInfoV3", id: record.visitId }, actor.actorId), record.visitId, sourceScope.date, [record.visitId], scope);
      if (visit.state !== "ready" || visit.provenance?.sourceRevision !== record.visitSourceHash || !visit.patientId || !visit.caregiverId) throw new WorkflowError("call_match_source_changed", 409);
      const calls = await this.query({ operation: "GetCallDashBoardData", officeId: scope.officeId, date: sourceScope.date, patientId: visit.patientId, caregiverId: visit.caregiverId, lastId: sourceScope.lastId }, actor.actorId);
      const candidate = record.candidates.find(item => item.callId === input.callId), fresh = calls.records.find(item => item.CallDashboardID === input.callId);
      if (calls.operation !== "GetCallDashBoardData" || calls.source !== "hhaexchange" || calls.truncated || !evidenceIsFresh(calls.fetchedAt, this.now().toISOString(), scope.contract.maxAgeSeconds)
        || !candidate || !fresh || hash(fresh) !== candidate.sourceHash || fresh["Patient/ID"] !== visit.patientId || fresh["Caregiver/ID"] !== visit.caregiverId) throw new WorkflowError("call_match_source_changed", 409);
      await scope.check();
    }
    return records.decideCallMatch(value);
  }
  async smsConfiguration(actor: RevisionActor): Promise<{ config: SmsFactoryConfig; context: RevisionContext; fingerprint: string }> {
    const scope = await this.fence(actor);
    return { config: { projectId: "primetimehomehealthservices", allowedOfficeId: scope.officeId, callbackUrl: "https://pthhs.net/primetime/api/revisions/sms/status",
      capabilityApproved: this.approvals.smsCapability, configurationApproved: this.approvals.smsConfiguration, sendApproved: this.approvals.smsSend,
      sourceApproved: !!scope.contract, policyApproved: !!scope.policy.smsPolicyReference && !!scope.policy.quietHours },
      context: this.context(actor, scope.officeId), fingerprint: scope.signature };
  }
  async outbox(actor: RevisionActor) {
    const scope = await this.scope(actor), context = this.context(actor, scope.officeId);
    const box = new NotificationOutbox(this.repository, { load: (request, ctx) => this.notificationEvidence(actor, request, ctx.officeId) },
      { getContact: (officeId, ref) => officeId === scope.officeId ? scope.configuration.contact(ref) : Promise.resolve(null) }, this.adapter,
      { capabilityApproved: this.approvals.smsCapability, configurationApproved: this.approvals.smsConfiguration, sendApproved: this.approvals.smsSend,
        canSend: officeId => this.smsDispatchAllowed(actor, officeId) }, () => this.now().getTime());
    return { box, context };
  }
  async smsDispatchAllowed(actor: RevisionActor, officeId: string) {
    const fresh = await this.fence(actor), policy = fresh.policy;
    if (officeId !== fresh.officeId || !fresh.contract || !this.approvals.monitor || !policy.monitoringEnabled || !policy.smsPolicyReference || !policy.quietHours
      || !this.approvals.smsCapability || !this.approvals.smsConfiguration || !this.approvals.smsSend) return false;
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: fresh.timezone, hour: "2-digit", hourCycle: "h23" }).format(this.now()));
    const { startHour, endHour } = policy.quietHours;
    return !(startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour);
  }
  private async notificationEvidence(actor: RevisionActor, request: NotificationRequest, officeId: string): Promise<NotificationEvidence> {
    const fact = await this.repository.get<NotificationFact>("revisionNotificationFacts_office_" + officeId, hash([request.visitId, request.rule, request.occurrenceId]));
    if (!fact || fact.officeId !== officeId || fact.visitId !== request.visitId || fact.occurrenceId !== request.occurrenceId || fact.rule !== request.rule) throw new WorkflowError("notification_evidence_not_found", 404);
    const scope = await this.fence(actor);
    if (!scope.contract || scope.officeId !== officeId || fact.policyFingerprint !== scope.signature) throw new WorkflowError("notification_policy_changed_restart", 409);
    if (request.rule === "missing_token_days" && fact.tokenRosterId) {
      const roster = await this.repository.get<TokenRoster>("revisionTokenRoster_office_" + officeId, fact.tokenRosterId);
      if (!roster || roster.officeId !== officeId || roster.policyFingerprint !== scope.signature || roster.visits.length > 10) throw new WorkflowError("notification_token_group_changed", 409);
      const visits = await this.refreshTokenRoster(actor, roster, scope), group = buildTokenGroups(visits, this.now().toISOString()).groups.find(item => item.caregiverId === roster.caregiverId);
      await scope.check();
      if (visits.some(item => item.state !== "ready")) throw new WorkflowError("notification_token_group_unavailable", 423);
      const observedAt = visits.map(item => item.provenance!.fetchedAt).sort()[0];
      if (!observedAt) throw new WorkflowError("notification_token_group_unavailable", 423);
      return { officeId, visitId: request.visitId, rule: request.rule, occurrenceId: request.occurrenceId, source: "server_verified", validation: "validated",
        sourceRevision: hash(visits.map(item => [item.visitId, item.provenance?.sourceRevision])), ruleVersion: this.ruleVersion(scope), observedAt, detectedAt: fact.detectedAt,
        conditionActive: !!group && group.occurrenceId === request.occurrenceId, eligibleRecipientRefs: ["caregiver_" + roster.caregiverId],
        missingServiceDates: group?.serviceDates ?? [], ...(scope.policy.tokenInstructions ? { verifiedVendorInstructions: scope.policy.tokenInstructions } : {}) };
    }
    const discovery = await this.query({ operation: "SearchVisitsV2", officeId, date: fact.date }, actor.actorId);
    if (!discovery.records.some(item => item.VisitID === request.visitId)) throw new WorkflowError("notification_visit_not_discovered", 409);
    await scope.check();
    const visit = this.adapt(await this.query({ operation: "GetVisitInfoV3", id: request.visitId }, actor.actorId), request.visitId, fact.date, [request.visitId], scope);
    let peer: NormalizedVisitEvidence | null = null;
    if (fact.relatedVisitId) {
      const peerDate = date(fact.relatedVisitDate ?? fact.date);
      if (Math.abs(Date.parse(peerDate + "T00:00:00Z") - Date.parse(fact.date + "T00:00:00Z")) > 86400000) throw new WorkflowError("notification_related_visit_unavailable", 409);
      const peerDiscovery = peerDate === fact.date ? discovery : await this.query({ operation: "SearchVisitsV2", officeId, date: peerDate }, actor.actorId);
      if (peerDiscovery.operation !== "SearchVisitsV2" || peerDiscovery.source !== "hhaexchange" || !peerDiscovery.records.some(item => item.VisitID === fact.relatedVisitId)) throw new WorkflowError("notification_related_visit_unavailable", 409);
      await scope.check();
      peer = this.adapt(await this.query({ operation: "GetVisitInfoV3", id: fact.relatedVisitId }, actor.actorId), fact.relatedVisitId, peerDate, [fact.relatedVisitId], scope);
    }
    const diagnosis = evaluateVisit(visit, { version: this.ruleVersion(scope), earlyReminderMinutes: scope.policy.earlyReminderMinutes }, this.now().toISOString(),
      { overlaps: peer ? [reviewedOverlapCandidate(visit, peer, this.now().toISOString(), scope.contract?.overlapAllowances)] : [] });
    const issue = diagnosis.issues.find(item => item.kind === fact.kind && (item.facts.relatedVisitId ?? null) === fact.relatedVisitId);
    let active = !!issue && (request.rule.startsWith("supervisor_") ? issue.officeFollowUp : issue.caregiverReminder);
    const tokenSummary = summarizeMissingTokenDays([visit], this.now().toISOString());
    if (request.rule === "missing_token_days") active = tokenSummary.summaries.some(item => item.missingDayCount > 0);
    if (visit.state !== "ready" || !visit.provenance) throw new WorkflowError("notification_source_unaccepted", 423);
    await scope.check();
    return { officeId, visitId: request.visitId, rule: request.rule, occurrenceId: request.occurrenceId, source: "server_verified", validation: "validated",
      sourceRevision: peer ? hash([visit.provenance.sourceRevision, peer.provenance?.sourceRevision]) : visit.provenance.sourceRevision, ruleVersion: this.ruleVersion(scope), observedAt: peer?.provenance ? [visit.provenance.fetchedAt, peer.provenance.fetchedAt].sort()[0]! : visit.provenance.fetchedAt, detectedAt: fact.detectedAt,
      conditionActive: active, eligibleRecipientRefs: request.rule.startsWith("supervisor_") ? scope.policy.supervisorRecipientRefs : visit.caregiverId ? ["caregiver_" + visit.caregiverId] : [],
      ...(visit.times.scheduledEnd ? { scheduledEnd: this.timeLabel(visit.times.scheduledEnd.iso, scope.timezone) } : {}),
      ...((visit.serviceTimeBasis === "evv" ? visit.times.evvEnd : visit.times.actualEnd) ? { actualEnd: this.timeLabel((visit.serviceTimeBasis === "evv" ? visit.times.evvEnd : visit.times.actualEnd)!.iso, scope.timezone) } : {}),
      ...(diagnosis.metrics.earlyMinutes === null ? {} : { remainingMinutes: Math.ceil(diagnosis.metrics.earlyMinutes) }),
      missingServiceDates: tokenSummary.summaries.flatMap(item => item.days.map(day => day.date)), ...(scope.policy.tokenInstructions ? { verifiedVendorInstructions: scope.policy.tokenInstructions } : {}) };
  }
  private async persistAndQueue(actor: RevisionActor, item: { evidence: NormalizedVisitEvidence; diagnosis: VisitDiagnosis }, fingerprint: string) {
    if (item.evidence.state !== "ready" || item.diagnosis.state !== "ready" || !item.evidence.provenance?.maxAgeSeconds
      || !evidenceIsFresh(item.evidence.provenance.fetchedAt, this.now().toISOString(), item.evidence.provenance.maxAgeSeconds)) return;
    const scope = await this.fence(actor);
    if (scope.signature !== fingerprint) throw new WorkflowError("revision_policy_changed_restart", 409);
    const visitId = item.evidence.visitId, serviceDate = item.evidence.scope.date, collection = "revisionDiagnoses_office_" + scope.officeId, id = hash([serviceDate, visitId]);
    const prior = await this.repository.get<DiagnosisRecord>(collection, id);
    await this.repository.change<DiagnosisRecord>(collection, id, prior?.revision ?? 0, actor.actorId, "visit_diagnosed", () => ({ id, officeId: scope.officeId, date: serviceDate, revision: (prior?.revision ?? 0) + 1, updatedAt: this.now().toISOString(), ...item }));
    if (item.evidence.clockingMethod === "token" && item.evidence.caregiverId) {
      const rosterCollection = "revisionTokenRoster_office_" + scope.officeId, caregiverId = item.evidence.caregiverId, roster = await this.repository.get<TokenRoster>(rosterCollection, caregiverId);
      const minimumDate = new Date(Date.parse(officeDate(this.now(), scope.timezone) + "T12:00:00Z") - 6 * 86400000).toISOString().slice(0, 10);
      const existingVisits = roster?.policyFingerprint === fingerprint ? roster.visits : [];
      const visits = [...existingVisits.filter(entry => entry.visitId !== visitId), { visitId, date: serviceDate }].filter(entry => entry.date >= minimumDate)
        .sort((a, b) => a.date.localeCompare(b.date) || Number(a.visitId) - Number(b.visitId)).slice(0, 10);
      await this.repository.change<TokenRoster>(rosterCollection, caregiverId, roster?.revision ?? 0, actor.actorId, "token_evidence_window_updated", () => ({ id: caregiverId, revision: (roster?.revision ?? 0) + 1, updatedAt: this.now().toISOString(), officeId: scope.officeId, caregiverId, visits, policyFingerprint: fingerprint, coverage: "accepted_input_only" }));
    }
    const records = await this.records(actor);
    for (const issue of item.diagnosis.issues.filter(issue => issue.level !== "unknown")) {
      const existing = await records.get("exceptions", issue.id);
      if (!existing) await records.saveException({ id: issue.id, revision: 0, officeId: scope.officeId, visitId, ruleId: issue.kind, ruleVersion: item.diagnosis.ruleVersion,
        sourceHash: item.diagnosis.sourceRevision, sourceValidation: "accepted", diagnosis: issue.summary + " " + issue.nextAction + (issue.suggestedNote ? " " + issue.suggestedNote : ""),
        assignee: "", followUpAt: issue.officeFollowUp ? new Date(this.now().getTime() + 24 * 3600000).toISOString() : null, note: "Created from accepted server evidence; HHA verification remains separate." });
      if (!this.approvals.smsCapability || !this.approvals.smsConfiguration || !this.approvals.smsSend) continue;
      const rules: NotificationRule[] = [];
      if (issue.kind === "open_after_end" && issue.caregiverReminder) rules.push("missing_clock_out");
      if (issue.kind === "early_end" && issue.caregiverReminder) rules.push("early_ended");
      if (issue.officeFollowUp && ["open_after_end", "recorded_overage"].includes(issue.kind)) rules.push("supervisor_overage");
      if (issue.officeFollowUp && issue.kind.startsWith("overlap_") && issue.facts.relatedVisitId) rules.push("supervisor_overlap");
      for (const rule of rules) {
        const occurrenceKind = issue.kind.startsWith("overlap_") ? "overlap" : issue.kind;
        const occurrenceId = `${serviceDate}:${occurrenceKind}:${issue.facts.relatedVisitId ?? "single"}`, factId = hash([visitId, rule, occurrenceId]), factCollection = "revisionNotificationFacts_office_" + scope.officeId;
        await this.rememberNotificationFact(actor, factCollection, factId, { officeId: scope.officeId, date: serviceDate,
          rule, visitId, occurrenceId, kind: issue.kind, relatedVisitId: typeof issue.facts.relatedVisitId === "string" ? issue.facts.relatedVisitId : null,
          relatedVisitDate: typeof issue.facts.relatedServiceDate === "string" ? date(issue.facts.relatedServiceDate) : null, detectedAt: this.now().toISOString(), policyFingerprint: fingerprint });
        const refs = rule.startsWith("supervisor_") ? scope.policy.supervisorRecipientRefs : item.evidence.caregiverId ? ["caregiver_" + item.evidence.caregiverId] : [];
        for (const recipientRef of refs) {
          try { const { box, context } = await this.outbox(actor); await box.queue({ rule, visitId, occurrenceId, recipientRef }, context); }
          catch (error) { if (error instanceof WorkflowError && [403, 409, 423, 404].includes(error.status)) continue; throw error; }
        }
      }
    }
  }
  private async rememberNotificationFact(actor: RevisionActor, collection: string, id: string, values: Omit<NotificationFact, "id" | "revision" | "updatedAt">) {
    const prior = await this.repository.get<NotificationFact>(collection, id);
    if (prior) {
      if (prior.id !== id || prior.officeId !== values.officeId || prior.date !== values.date || prior.rule !== values.rule
        || prior.visitId !== values.visitId || prior.occurrenceId !== values.occurrenceId) throw new WorkflowError("notification_condition_identity_mismatch", 409);
      // The same occurrence may be rediscovered on an adjacent peer date or a
      // refreshed roster without any owner-policy change. Recheck metadata too.
      if (prior.policyFingerprint === values.policyFingerprint && prior.kind === values.kind && prior.relatedVisitId === values.relatedVisitId
        && (prior.relatedVisitDate ?? null) === (values.relatedVisitDate ?? null) && (prior.tokenRosterId ?? null) === (values.tokenRosterId ?? null)) return;
    }
    // Keep the same occurrence and original detection time across policy or source-metadata changes.
    // The outbox's stable occurrence key prevents this refresh from creating a second delivery.
    await this.repository.change<NotificationFact>(collection, id, prior?.revision ?? 0, actor.actorId, prior ? "notification_condition_refreshed" : "notification_condition_detected", () => ({
      ...values, id, occurrenceId: prior?.occurrenceId ?? values.occurrenceId, revision: (prior?.revision ?? 0) + 1, updatedAt: this.now().toISOString(), detectedAt: prior?.detectedAt ?? values.detectedAt
    }));
  }
  private timeLabel(instant: string, timezone: string) {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(instant));
  }
  private async refreshTokenRoster(actor: RevisionActor, roster: TokenRoster, scope: Awaited<ReturnType<RevisionBackend["fence"]>>) {
    const result: NormalizedVisitEvidence[] = [], discovery = new Map<string, string[]>();
    for (const item of roster.visits) {
      await scope.check();
      if (!discovery.has(item.date)) {
        const source = await this.query({ operation: "SearchVisitsV2", officeId: scope.officeId, date: item.date }, actor.actorId);
        if (source.operation !== "SearchVisitsV2" || source.source !== "hhaexchange") throw new WorkflowError("invalid_token_discovery", 502);
        discovery.set(item.date, source.records.map(row => identifier(row.VisitID)));
      }
      const ids = discovery.get(item.date)!;
      if (!ids.includes(item.visitId)) throw new WorkflowError("token_visit_no_longer_discovered", 409);
      await scope.check();
      result.push(this.adapt(await this.query({ operation: "GetVisitInfoV3", id: item.visitId }, actor.actorId), item.visitId, item.date, ids, scope));
    }
    await scope.check(); return result;
  }
  private async queueTokenGroup(actor: RevisionActor, cursor?: string) {
    if (!this.approvals.smsCapability || !this.approvals.smsConfiguration || !this.approvals.smsSend) return { nextCursor: cursor ?? null };
    const scope = await this.fence(actor);
    if (!scope.policy.tokenInstructions) return { nextCursor: cursor ?? null };
    const page = await this.repository.page<TokenRoster>("revisionTokenRoster_office_" + scope.officeId, cursor);
    const roster = page.items.find(item => item.officeId === scope.officeId && item.policyFingerprint === scope.signature && item.visits.length > 0);
    if (!roster) return { nextCursor: page.nextCursor };
    // Advance after this roster even when its missing entries have resolved.
    const boundary = Buffer.from(JSON.stringify({ updatedAt: roster.updatedAt, id: roster.id })).toString("base64url");
    const nextCursor = page.items.at(-1)?.id === roster.id ? page.nextCursor : boundary;
    let visits: NormalizedVisitEvidence[];
    try { visits = await this.refreshTokenRoster(actor, roster, scope); }
    catch (error) {
      if (error instanceof WorkflowError && ["token_visit_no_longer_discovered", "notification_token_group_unavailable", "notification_token_group_changed"].includes(error.code)) {
        await scope.check(); return { nextCursor };
      }
      throw error;
    }
    const group = buildTokenGroups(visits, this.now().toISOString()).groups.find(item => item.caregiverId === roster.caregiverId);
    if (!group) return { nextCursor };
    const representative = group.visits[0]!, rule: NotificationRule = "missing_token_days", occurrenceId = group.occurrenceId, factId = hash([representative.visitId, rule, occurrenceId]), collection = "revisionNotificationFacts_office_" + scope.officeId;
    await scope.check();
    await this.rememberNotificationFact(actor, collection, factId, { officeId: scope.officeId, date: representative.date,
      rule, visitId: representative.visitId, occurrenceId, kind: "no_punches", relatedVisitId: null, detectedAt: this.now().toISOString(), policyFingerprint: scope.signature, tokenRosterId: roster.id });
    const { box, context } = await this.outbox(actor);
    try { await box.queue({ rule, visitId: representative.visitId, occurrenceId, recipientRef: "caregiver_" + roster.caregiverId }, context); }
    catch (error) { if (!(error instanceof WorkflowError) || ![403, 404, 409, 423].includes(error.status)) throw error; }
    return { nextCursor };
  }
  async monitor() {
    if (!this.approvals.data || !this.approvals.source || !this.approvals.monitor) return { state: "disabled", processed: 0 };
    const actor: RevisionActor = { actorId: "revision_monitor", roles: ["admin"], mode: "live" }, scope = await this.fence(actor);
    if (!scope.policy.monitoringEnabled || !scope.contract || !["SearchVisitsV2", "GetVisitInfoV3"].every(operation => scope.current.settings.enabledReads.includes(operation))) return { state: "disabled", processed: 0 };
    this.deadline = performance.now() + 180000;
    const collection = "revisionMonitor_office_" + scope.officeId, previous = await this.repository.get<MonitorCheckpoint>(collection, "checkpoint"), at = this.now();
    if (previous && Date.parse(previous.leaseUntil) > at.getTime()) return { state: "already_running", processed: 0 };
    // Older checkpoints restart at today rather than carrying a cursor into another date.
    const plan = chooseMonitorWindow(previous?.plan ?? null, officeDate(at, scope.timezone));
    let lease: MonitorCheckpoint;
    try { lease = await this.repository.change<MonitorCheckpoint>(collection, "checkpoint", previous?.revision ?? 0, actor.actorId, "monitor_claimed", () => ({ id: "checkpoint", officeId: scope.officeId,
      revision: (previous?.revision ?? 0) + 1, updatedAt: at.toISOString(), leaseUntil: new Date(at.getTime() + 240000).toISOString(), plan: plan.state, tokenCursor: previous?.tokenCursor ?? null, notificationCursor: previous?.notificationCursorVersion === 1 ? previous.notificationCursor ?? null : null, notificationCursorVersion: 1, lastRunState: "running" })); }
    catch (error) { if (error instanceof WorkflowError && error.code === "revision_conflict") return { state: "already_running", processed: 0 }; throw error; }
    try {
      const result = await this.visits(actor, { date: plan.date, limit: "10", offset: String(plan.offset), ...(plan.discovery ? { discovery: plan.discovery } : {}) });
      for (const item of result.items) await this.persistAndQueue(actor, item, result.fence);
      const token = await this.queueTokenGroup(actor, lease.tokenCursor ?? undefined);
      let notificationCursor = lease.notificationCursor ?? null;
      let sent = 0;
      if (this.approvals.smsCapability && this.approvals.smsConfiguration && this.approvals.smsSend) {
        const { box, context } = await this.outbox(actor), page = await box.deliveryPage(context, lease.notificationCursor ?? undefined), deliveryPage = page.items.slice(0, 5);
        if (!page.items.length) notificationCursor = page.nextCursor;
        for (const record of deliveryPage) {
          if (performance.now() >= this.deadline) break;
          try { if (["unknown", "accepted", "claimed"].includes(record.state)) await box.reconcile(record.id, context); else await box.send(record.id, context); sent++; }
          catch (error) { if (!(error instanceof WorkflowError) || ![403, 404, 409, 423, 429].includes(error.status)) throw error; }
          notificationCursor = page.items.at(-1)?.id === record.id ? page.nextCursor : notificationDeliveryCursor(record.id);
        }
      }
      await scope.check();
      const state = result.completeness.deferredCount > 0 ? "partial_batch_time_budget" : "partial_window";
      await this.repository.change<MonitorCheckpoint>(collection, "checkpoint", lease.revision, actor.actorId, "monitor_completed", prior => ({ ...prior!, revision: lease.revision + 1, updatedAt: this.now().toISOString(), leaseUntil: new Date(0).toISOString(),
        plan: advanceMonitorWindow(plan, result), tokenCursor: token.nextCursor, notificationCursor, lastRunState: state === "partial_batch_time_budget" ? state : result.completeness.truncated ? "partial_source" : state }));
      return { state, processed: result.completeness.attemptedCount, sent, sourceTruncated: result.completeness.truncated };
    } catch (error) {
      const changed = error instanceof WorkflowError && error.code === "revision_discovery_changed_restart";
      await this.repository.change<MonitorCheckpoint>(collection, "checkpoint", lease.revision, actor.actorId, "monitor_deferred", prior => ({ ...prior!, revision: lease.revision + 1, updatedAt: this.now().toISOString(), leaseUntil: new Date(0).toISOString(),
        plan: changed ? resetMonitorWindow(plan) : { ...plan.state, turn: ((plan.state.turn + 1) % 4) as MonitorPlanState["turn"] }, lastRunState: error instanceof WorkflowError ? error.code : "monitor_unavailable" }));
      throw error;
    } finally { this.deadline = Infinity; }
  }
}
