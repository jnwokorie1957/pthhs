import { createHash } from "node:crypto";
import type { OperationsWorkspace } from "../operations/workspace.js";
import { identifier, readRequest, WorkflowError, type OperationalRead } from "../operations/reads.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
type WorkspaceSettings = Awaited<ReturnType<Workspace["settings"]>>;
const REQUIRED_READS = ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"] as const;
const TIME_BUDGET_MS = 25_000;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_visit_query");
  return value as Record<string, unknown>;
}

function officeSettings(settings: { officeId: string | null; officeTimezone: string | null }) {
  let officeId: string | null = null, officeTimezone: string | null = null;
  try { officeId = identifier(settings.officeId); } catch { /* Unconfigured source scope. */ }
  if (typeof settings.officeTimezone === "string" && settings.officeTimezone.length <= 80) {
    try { new Intl.DateTimeFormat("en", { timeZone: settings.officeTimezone }); officeTimezone = settings.officeTimezone; } catch { /* Unknown timezone. */ }
  }
  return { officeId, officeTimezone };
}

function statusFromSettings(current: WorkspaceSettings) {
  const settings = officeSettings(current.settings);
  const blockedReason = !current.dataApproved ? "operational_data_release_not_approved"
    : !settings.officeId || !settings.officeTimezone ? "office_timezone_not_configured"
    : REQUIRED_READS.some(operation => !current.settings.enabledReads.includes(operation)) ? "visit_reads_not_owner_enabled" : null;
  return { ok: true, mode: "live" as const, dataApproved: current.dataApproved, settings: { ...settings, revision: current.settings.revision },
    panels: { visits: { available: blockedReason === null, blockedReason } }, sourceValidation: "pending" as const };
}
export async function dataStatus(workspace: Workspace) { return statusFromSettings(await workspace.settings()); }

// A mode marker is an intent guard. It never substitutes for authentication,
// deployment approval, office membership, or owner operation controls.
export function assertLiveDataMode(method: string, path: string, mode: string | undefined) {
  if (mode === undefined) return; // Existing operational clients remain compatible.
  const value = mode.trim().toLowerCase();
  if (value !== "live" && value !== "demo") throw new WorkflowError("invalid_data_mode");
  if (value === "demo" && !(method === "GET" && ["/session", "/status", "/data/status"].includes(path))) {
    throw new WorkflowError("demo_mode_live_request_denied", 403);
  }
}

interface Cursor { version: 1; scope: string; discovery: string; offset: number; }
function fingerprint(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function parseCursor(value: unknown): Cursor | null {
  if (value === undefined) return null;
  try {
    if (typeof value !== "string" || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) throw new Error();
    const cursor = object(JSON.parse(decoded.toString("utf8")));
    if (Object.keys(cursor).sort().join(",") !== "discovery,offset,scope,version" || cursor.version !== 1
      || typeof cursor.scope !== "string" || !/^[a-f0-9]{64}$/.test(cursor.scope)
      || typeof cursor.discovery !== "string" || !/^[a-f0-9]{64}$/.test(cursor.discovery)
      || !Number.isSafeInteger(cursor.offset) || Number(cursor.offset) < 1) throw new Error();
    return cursor as unknown as Cursor;
  } catch { throw new WorkflowError("invalid_visit_cursor"); }
}

export interface VisitPreviewItem {
  id: string; scheduledStart: string | null; scheduledEnd: string | null;
  actualStart: string | null; actualEnd: string | null; evvStart: string | null; evvEnd: string | null;
  patientId: string | null; caregiverId: string | null;
  visitType: string | null; sourceTimezone: string | null;
  actualHours: string | null; payHours: string | null; billedAmount: string | null;
  scheduleDurationHours: string | null; scheduleDurationMinutes: string | null;
  verifiedBy: string | null; verifiedDate: string | null;
  state: "source_unvalidated" | "unavailable"; error?: string;
}
function unavailable(id: string, error: string): VisitPreviewItem {
  return { id, scheduledStart: null, scheduledEnd: null, actualStart: null, actualEnd: null,
    evvStart: null, evvEnd: null, patientId: null, caregiverId: null, visitType: null, sourceTimezone: null,
    actualHours: null, payHours: null, billedAmount: null, scheduleDurationHours: null, scheduleDurationMinutes: null,
    verifiedBy: null, verifiedDate: null, state: "unavailable", error };
}
function validateSource(source: OperationalRead, operation: "SearchVisitsV2" | "GetVisitInfoV3") {
  if (source.operation !== operation || source.source !== "hhaexchange" || !Array.isArray(source.records)
    || typeof source.truncated !== "boolean" || (operation !== "SearchVisitsV2" && source.records.length > 200)) throw new WorkflowError("invalid_visit_source_response", 502);
}
function detailItem(id: string, date: string, source: OperationalRead): VisitPreviewItem {
  validateSource(source, "GetVisitInfoV3");
  const facts = source.records[0];
  if (source.truncated || source.records.length !== 1 || !facts || facts.ID !== id) throw new WorkflowError("visit_not_uniquely_returned", 502);
  // Compare the vendor's calendar field without guessing UTC or interpreting
  // schedule/EVV wall times. A changed day must not leak facts into this view.
  if (typeof facts.VisitDate !== "string" || !new RegExp(`^${date}(?:$|T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|[+-]\\d\\d:\\d\\d)?)$`).test(facts.VisitDate)) {
    throw new WorkflowError("visit_date_scope_mismatch", 409);
  }
  const field = (name: string): string | null => {
    const value = facts[name];
    if (value !== undefined && value !== null && typeof value !== "string") throw new WorkflowError("invalid_visit_source_response", 502);
    return value ?? null;
  };
  return { id, scheduledStart: field("ScheduleStartTime"), scheduledEnd: field("ScheduleEndTime"),
    actualStart: field("VisitStartTime"), actualEnd: field("VisitEndTime"),
    evvStart: field("EVVStartTime"), evvEnd: field("EVVEndTime"),
    patientId: field("Patient/ID"), caregiverId: field("Caregiver/ID"), visitType: field("VisitType"), sourceTimezone: field("TimeZone"),
    actualHours: field("ActualHours"), payHours: field("PayHours"), billedAmount: field("BilledAmount"),
    scheduleDurationHours: field("ScheduleDuration/ScheduleDurationHours"), scheduleDurationMinutes: field("ScheduleDuration/ScheduleDurationMinutes"),
    verifiedBy: field("Verification/VerifiedBy"), verifiedDate: field("Verification/VerifiedDate"), state: "source_unvalidated" };
}

export async function visitPreview(workspace: Workspace, value: unknown, actor: string, clock: () => number = () => performance.now()) {
  const started = clock(), input = object(value);
  if (Object.keys(input).some(key => !["officeId", "date", "limit", "cursor"].includes(key))) throw new WorkflowError("invalid_visit_query");
  const cursor = parseCursor(input.cursor);
  const limitValue = input.limit === undefined ? "10" : input.limit;
  if (typeof limitValue !== "string" || !/^(?:[1-9]|10)$/.test(limitValue)) throw new WorkflowError("invalid_visit_limit");
  const limit = Number(limitValue), current = await workspace.settings(), status = statusFromSettings(current);
  if (status.panels.visits.blockedReason) throw new WorkflowError(status.panels.visits.blockedReason, 423);
  const officeId = status.settings.officeId!, timezone = status.settings.officeTimezone!;
  if (input.officeId !== undefined && (typeof input.officeId !== "string" || identifier(input.officeId) !== officeId)) throw new WorkflowError("office_scope_mismatch", 403);
  readRequest({ operation: "SearchVisitsV2", officeId, date: input.date as string });
  const date = input.date as string;
  const scopeFingerprint = (value: WorkspaceSettings) => fingerprint({ actor, date,
    officeId: value.settings.officeId, timezone: value.settings.officeTimezone,
    revision: value.settings.revision, dataApproved: value.dataApproved, enabledReads: [...value.settings.enabledReads].sort() });
  const scope = scopeFingerprint(current);
  const assertCurrentScope = async () => {
    if (scopeFingerprint(await workspace.settings()) !== scope) throw new WorkflowError("visit_preview_policy_changed_restart", 409);
  };
  if (cursor && cursor.scope !== scope) throw new WorkflowError("visit_cursor_scope_mismatch", 409);
  const discovery = await workspace.query({ operation: "SearchVisitsV2", officeId, date }, actor, "visit_discovery");
  validateSource(discovery, "SearchVisitsV2");
  let ids: string[];
  try { ids = [...new Set(discovery.records.map(row => identifier(row.VisitID)))].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)); }
  catch { throw new WorkflowError("invalid_visit_discovery_response", 502); }
  if (discovery.truncated && ids.length === 0) throw new WorkflowError("invalid_visit_discovery_response", 502);
  const sourceFingerprint = fingerprint(ids);
  if (cursor && (cursor.discovery !== sourceFingerprint || cursor.offset >= ids.length)) throw new WorkflowError("visit_preview_changed_restart", 409);
  const offset = cursor?.offset ?? 0, page = ids.slice(offset, offset + limit), items: VisitPreviewItem[] = [];
  let deferred: string | null = null;
  for (const id of page) {
    if (deferred || clock() - started >= TIME_BUDGET_MS) {
      items.push(unavailable(id, deferred ? "not_attempted_after_batch_gate" : "not_attempted_batch_time_budget"));
      continue;
    }
    // Detail reads are not office-filtered themselves. A policy change after
    // discovery must stop further details and must never publish the old view.
    await assertCurrentScope();
    if (clock() - started >= TIME_BUDGET_MS) { items.push(unavailable(id, "not_attempted_batch_time_budget")); continue; }
    try {
      const item = detailItem(id, date, await workspace.query({ operation: "GetVisitInfoV3", id }, actor));
      const patientId = identifier(item.patientId);
      await assertCurrentScope();
      const patient = await workspace.query({ operation: "GetPatientDemographics", id: patientId }, actor);
      if (patient.operation !== "GetPatientDemographics" || patient.source !== "hhaexchange" || patient.truncated || patient.records.length !== 1
        || patient.records[0]?.PatientID !== patientId || patient.records[0]?.OfficeID !== officeId) throw new WorkflowError("visit_patient_office_mismatch", 403);
      await assertCurrentScope();
      items.push(item);
    }
    catch (error) {
      const code = error instanceof WorkflowError ? error.code : "visit_preview_unavailable";
      items.push(unavailable(id, code));
      if (!(error instanceof WorkflowError) || [429, 403, 423, 503].includes(error.status)) deferred = code;
    }
  }
  await assertCurrentScope();
  const nextOffset = offset + page.length;
  const nextCursor = nextOffset < ids.length ? Buffer.from(JSON.stringify({ version: 1, scope, discovery: sourceFingerprint, offset: nextOffset } satisfies Cursor)).toString("base64url") : null;
  const partial = discovery.truncated || nextCursor !== null || items.some(item => item.state === "unavailable");
  const unavailableCount = items.filter(item => item.state === "unavailable").length;
  return { ok: true, mode: "live" as const, source: "hhaexchange" as const,
    state: partial ? "partial" as const : items.length ? "ready" as const : "empty" as const,
    scope: { officeId, date, timezone }, fetchedAt: discovery.fetchedAt,
    validation: "source_unvalidated" as const, timezone: "source_values_unconverted" as const,
    items, nextCursor,
    // Counts describe the bounded source response and detail page. They are not
    // operational totals or an assertion of vendor coverage or field semantics.
    discovery: { fingerprint: sourceFingerprint, selectedCount: ids.length, totalReceived: discovery.records.length, discoveryCompleteness: "unknown" as const, truncated: discovery.truncated },
    page: { offset, selectedCount: page.length, returnedCount: items.length - unavailableCount, unavailableCount, nextOffset: nextCursor ? nextOffset : null },
    completeness: { complete: false as const, truncated: discovery.truncated, sourceDiscoveryComplete: false as const,
      detailsComplete: offset === 0 && nextCursor === null && unavailableCount === 0 }, totals: null };
}

export async function viewRoute(workspace: Workspace, method: string, path: string, query: unknown, actor: string) {
  if (!["/data/status", "/views/visits"].includes(path)) return null;
  if (method !== "GET") return { status: 405, body: { ok: false, error: "method_not_allowed" } };
  try { return { status: 200, body: path === "/data/status" ? await dataStatus(workspace) : await visitPreview(workspace, query, actor) }; }
  catch (error) { return { status: error instanceof WorkflowError ? error.status : 503,
    body: { ok: false, error: error instanceof WorkflowError ? error.code : "visit_view_unavailable",
      ...(error instanceof WorkflowError && error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) } }; }
}
