import { createHash } from "node:crypto";
import { identifier, readRequest, WorkflowError } from "../operations/reads.js";
import type { OperationsWorkspace, Versioned, WorkspaceRepository } from "../operations/workspace.js";
import { workspaceCursor } from "../operations/workspace.js";
import type { readOfficeDay } from "../views/officeDay.js";
import type { visitCallRead } from "../operations/visitCalls.js";

type Workspace = Pick<OperationsWorkspace, "settings">;
type Day = Awaited<ReturnType<typeof readOfficeDay>>;
type Row = Day["items"][number];
type Calls = Awaited<ReturnType<typeof visitCallRead>>;
export const CASE_STATES = ["in_review", "needs_attention", "awaiting_hha_action", "office_review_complete"] as const;
export const CASE_QUEUES = ["administrator", "office_staff", "supervisor", "office_manager"] as const;
export const PROPOSALS = ["investigate", "review_existing_calls", "review_confirmation"] as const;
type State = typeof CASE_STATES[number];
type Queue = typeof CASE_QUEUES[number];
type Proposal = { kind: typeof PROPOSALS[number]; selectedCallIds: string[]; rationale: string; sourceFingerprint: string };
type CallEvidence = { fetchedAt: string; membershipCheckedAt: string; truncated: boolean;
  relationship: "same_patient_caregiver_day_only"; visitLink: "not_supplied_by_source"; completeness: "bounded_response_not_complete_history";
  records: { CallDashboardID: string; CallTime: string | null; CallType: string | null; CallStatus: string | null }[] };
export interface MaintenanceCase extends Versioned {
  officeId: string; date: string; visitId: string; createdAt: string; createdBy: string;
  status: State; queue: Queue; followUpAt: string | null; hhaSubmission: "not_submitted";
  initialSource: Row; source: Row; sourceFingerprint: string; calls: CallEvidence | null; proposal: Proposal | null;
  events: { at: string; actor: string; action: string; note: string; status: State; queue: Queue; followUpAt: string | null;
    sourceFingerprint: string; proposal: Proposal | null }[];
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const factHash = (row: Row) => hash([row.id, row.patientId, row.caregiverId, row.scheduledStart, row.scheduledEnd,
  row.actualStart, row.actualEnd, row.evvStart, row.evvEnd, row.state]);
function bounded(value: MaintenanceCase) {
  // A 100-case page remains below the Function response limit even at capacity.
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 128000) throw new WorkflowError("maintenance_history_limit", 409);
  return value;
}
function object(value: unknown, fields: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new WorkflowError("invalid_maintenance_request");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) throw new WorkflowError("maintenance_note_required");
  return value.trim();
}
function member<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new WorkflowError("invalid_maintenance_choice");
  return value as T;
}

/** Local office work only. This service has no HHA write adapter. */
export class MaintenanceService {
  constructor(private repository: Pick<WorkspaceRepository, "get" | "page" | "change">, private workspace: Workspace,
    private day: (value: unknown) => Promise<Day>, private callRead: (value: unknown, actor: string) => Promise<Calls>,
    private now = () => new Date()) {}

  private async context(date: unknown) {
    const current = await this.workspace.settings();
    if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
    const officeId = identifier(current.settings.officeId);
    readRequest({ operation: "SearchVisitsV2", officeId, date: date as string });
    if (!["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"].every(read => current.settings.enabledReads.includes(read))) throw new WorkflowError("visit_reads_not_owner_enabled", 423);
    const check = async () => {
      if (hash(await this.workspace.settings()) !== hash(current)) throw new WorkflowError("office_policy_changed_restart", 409);
    };
    return { officeId, date: date as string, collection: `maintenanceCases_${officeId}_${date}`, check };
  }
  async cases(value: unknown) {
    const input = object(value, ["date", "cursor"]), ctx = await this.context(input.date);
    workspaceCursor(input.cursor);
    const result = await this.repository.page<MaintenanceCase>(ctx.collection, input.cursor as string | undefined);
    if (result.items.some(row => row.officeId !== ctx.officeId || row.date !== ctx.date)) throw new WorkflowError("maintenance_scope_mismatch", 403);
    await ctx.check();
    return { ok: true, scope: { officeId: ctx.officeId, date: ctx.date }, ...result, hhaWritesEnabled: false };
  }
  async save(value: unknown, actor: string) {
    const input = object(value, ["date", "visitId", "revision", "status", "queue", "followUpAt", "note", "proposalKind", "selectedCallIds", "sourceReceipt"]);
    const ctx = await this.context(input.date), visitId = identifier(input.visitId), id = hash([ctx.officeId, ctx.date, visitId]);
    const revision = input.revision;
    if (!Number.isSafeInteger(revision) || (revision as number) < 0) throw new WorkflowError("invalid_revision");
    const status = member(input.status, CASE_STATES), queue = member(input.queue, CASE_QUEUES), note = text(input.note);
    const followUpAt = input.followUpAt;
    if (followUpAt !== null && (typeof followUpAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(followUpAt) || !Number.isFinite(Date.parse(followUpAt)))) throw new WorkflowError("invalid_follow_up");
    const kind = member(input.proposalKind, PROPOSALS), ids = input.selectedCallIds;
    if (!Array.isArray(ids) || ids.length > 20 || new Set(ids).size !== ids.length) throw new WorkflowError("invalid_call_selection");
    ids.forEach(identifier);
    if (kind === "review_existing_calls" && ids.length === 0 || kind !== "review_existing_calls" && ids.length !== 0) throw new WorkflowError("invalid_call_selection");
    const data = await this.day({ date: ctx.date, officeId: ctx.officeId });
    const row = data.items.find(item => item.id === visitId);
    if (data.scope.officeId !== ctx.officeId || data.scope.date !== ctx.date || !row || row.state === "unavailable" || !row.patientId || !row.caregiverId) throw new WorkflowError("maintenance_source_unavailable", 409);
    if (data.officeDayCache.stale) throw new WorkflowError("maintenance_source_stale", 409);
    if (typeof input.sourceReceipt !== "string" || input.sourceReceipt !== row.detailFetchedAt) throw new WorkflowError("maintenance_source_changed_refresh", 409);
    const fingerprint = factHash(row), at = this.now().toISOString();
    await ctx.check();
    const result = await this.repository.change<MaintenanceCase>(ctx.collection, id, revision as number, actor, "maintenance_review_saved", prior => {
      if (prior && (prior.visitId !== visitId || prior.date !== ctx.date || prior.officeId !== ctx.officeId)) throw new WorkflowError("maintenance_scope_mismatch", 403);
      if ((prior?.events.length ?? 0) >= 150) throw new WorkflowError("maintenance_history_limit", 409);
      const sameSubjects = prior?.source.patientId === row.patientId && prior?.source.caregiverId === row.caregiverId;
      const calls = sameSubjects ? prior?.calls ?? null : null;
      if (ids.some(id => !calls?.records.some(call => call.CallDashboardID === id && call.CallTime && call.CallTime !== ctx.date))) throw new WorkflowError("call_selection_not_in_evidence", 409);
      const proposal: Proposal = { kind, selectedCallIds: ids as string[], rationale: note, sourceFingerprint: fingerprint };
      const event = { at, actor, action: prior ? "office_review_updated" : "office_case_opened", note, status, queue, followUpAt: followUpAt as string | null, sourceFingerprint: fingerprint, proposal };
      return bounded({ id, revision: (revision as number) + 1, updatedAt: at, officeId: ctx.officeId, date: ctx.date, visitId,
        createdAt: prior?.createdAt ?? at, createdBy: prior?.createdBy ?? actor, initialSource: prior?.initialSource ?? row,
        source: row, sourceFingerprint: fingerprint, calls, proposal, status, queue, followUpAt: followUpAt as string | null,
        hhaSubmission: "not_submitted", events: [...prior?.events ?? [], event] });
    });
    await ctx.check();
    return { ok: true, item: result, hhaWritesEnabled: false };
  }
  async calls(value: unknown, actor: string) {
    const input = object(value, ["date", "visitId", "revision"]), ctx = await this.context(input.date), visitId = identifier(input.visitId);
    if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 1) throw new WorkflowError("maintenance_save_case_first", 409);
    const id = hash([ctx.officeId, ctx.date, visitId]), prior = await this.repository.get<MaintenanceCase>(ctx.collection, id);
    if (!prior || prior.revision !== input.revision) throw new WorkflowError("revision_conflict", 409);
    if (prior.officeId !== ctx.officeId || prior.date !== ctx.date || prior.visitId !== visitId) throw new WorkflowError("maintenance_scope_mismatch", 403);
    const data = await this.callRead({ date: ctx.date, officeId: ctx.officeId, visitId, patientId: prior.source.patientId, caregiverId: prior.source.caregiverId }, actor);
    if (data.scope.officeId !== ctx.officeId || data.scope.date !== ctx.date || data.scope.visitId !== visitId
      || data.scope.patientId !== prior.source.patientId || data.scope.caregiverId !== prior.source.caregiverId) throw new WorkflowError("maintenance_scope_mismatch", 403);
    const records = data.records.map(row => ({ CallDashboardID: identifier(row.CallDashboardID), CallTime: row.CallTime ?? null, CallType: row.CallType ?? null, CallStatus: row.CallStatus ?? null }));
    const calls: CallEvidence = { records, fetchedAt: data.fetchedAt, membershipCheckedAt: data.membershipCheckedAt, truncated: data.truncated,
      relationship: "same_patient_caregiver_day_only", visitLink: "not_supplied_by_source", completeness: "bounded_response_not_complete_history" };
    await ctx.check();
    const result = await this.repository.change<MaintenanceCase>(ctx.collection, id, input.revision as number, actor, "maintenance_calls_read", current => {
      if (!current || current.events.length >= 150) throw new WorkflowError("maintenance_history_limit", 409);
      return bounded({ ...current, revision: current.revision + 1, updatedAt: this.now().toISOString(), calls, proposal: null,
        events: [...current.events, { at: this.now().toISOString(), actor, action: "call_evidence_refreshed", note: "Retained source call events; exact visit linkage is not supplied. Prior proposal cleared for review.",
          status: current.status, queue: current.queue, followUpAt: current.followUpAt, sourceFingerprint: current.sourceFingerprint, proposal: null }] });
    });
    await ctx.check();
    return { ok: true, item: result, hhaWritesEnabled: false };
  }
}

export async function maintenanceRoute(service: MaintenanceService, actor: { uid: string; roles: string[] }, method: string, path: string, value: unknown) {
  try {
    if (!actor.roles.includes("admin")) throw new WorkflowError("admin_required", 403);
    if (method === "GET" && path === "/maintenance/cases") return { status: 200, body: await service.cases(value) };
    if (method === "POST" && path === "/maintenance/save") return { status: 200, body: await service.save(value, actor.uid) };
    if (method === "POST" && path === "/maintenance/calls") return { status: 200, body: await service.calls(value, actor.uid) };
    return { status: 404, body: { ok: false, error: "maintenance_route_not_found" } };
  } catch (error) {
    return { status: error instanceof WorkflowError ? error.status : 503, body: { ok: false, error: error instanceof WorkflowError ? error.code : "maintenance_unavailable",
      ...(error instanceof WorkflowError && error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) } };
  }
}
