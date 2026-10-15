import { createHash } from "node:crypto";
import { identifier, WorkflowError } from "./reads.js";
import { workspaceCursor, type OperationsWorkspace, type Versioned, type WorkspaceRepository } from "./workspace.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
interface CalendarCapture {
  version: 1; source: "hhaexchange_ui"; officeId: string; patientId: string;
  patientLabel: string; period: string; capturedAt: string;
  authorizations: { columns: string[]; rows: { cells: string[] }[] };
  visits: { id: string; date: string; text: string }[];
}
interface Snapshot extends Versioned, CalendarCapture {
  importedBy: string; contentHash: string; validation: "manual_source_unvalidated";
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_calendar_capture");
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).sort().join(",") !== keys.sort().join(",")) throw new WorkflowError("invalid_calendar_capture");
}
function text(value: unknown, maximum: number, empty = false): string {
  if (typeof value !== "string" || value.length > maximum || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new WorkflowError("invalid_calendar_capture");
  return value.trim();
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new WorkflowError("invalid_calendar_capture");
  return value;
}
export function calendarCapture(value: unknown, now = Date.now()): CalendarCapture {
  const input = object(value);
  exact(input, ["version", "source", "officeId", "patientId", "patientLabel", "period", "capturedAt", "authorizations", "visits"]);
  if (input.version !== 1 || input.source !== "hhaexchange_ui" || Buffer.byteLength(JSON.stringify(value), "utf8") > 450_000) throw new WorkflowError("invalid_calendar_capture");
  const period = text(input.period, 7), capturedAt = text(input.capturedAt, 24);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(capturedAt)
    || !Number.isFinite(Date.parse(capturedAt)) || new Date(capturedAt).toISOString() !== capturedAt || Date.parse(capturedAt) > now + 300_000) throw new WorkflowError("invalid_calendar_capture");
  const auth = object(input.authorizations); exact(auth, ["columns", "rows"]);
  const columns = array(auth.columns, 30).map(v => text(v, 160));
  if (!columns.length) throw new WorkflowError("invalid_calendar_capture");
  const rows = array(auth.rows, 100).map(value => {
    const row = object(value); exact(row, ["cells"]);
    const cells = array(row.cells, 30).map(v => text(v, 1000, true));
    if (cells.length !== columns.length) throw new WorkflowError("invalid_calendar_capture");
    return { cells };
  });
  const ids = new Set<string>();
  const visits = array(input.visits, 500).map(value => {
    const visit = object(value); exact(visit, ["id", "date", "text"]);
    const id = identifier(visit.id), date = text(visit.date, 10);
    if (!/^20\d{2}-\d\d-\d\d$/.test(date) || date.slice(0, 7) !== period || !Number.isFinite(Date.parse(date + "T00:00:00.000Z")) || new Date(date + "T00:00:00.000Z").toISOString().slice(0, 10) !== date || ids.has(id)) throw new WorkflowError("invalid_calendar_capture");
    ids.add(id); return { id, date, text: text(visit.text, 4000) };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { version: 1, source: "hhaexchange_ui", officeId: identifier(input.officeId), patientId: identifier(input.patientId),
    patientLabel: text(input.patientLabel, 200), period, capturedAt, authorizations: { columns, rows }, visits };
}
function summary(snapshot: Snapshot) {
  return { id: snapshot.id, patientId: snapshot.patientId, patientLabel: snapshot.patientLabel, period: snapshot.period,
    capturedAt: snapshot.capturedAt, importedAt: snapshot.updatedAt, officeId: snapshot.officeId,
    visitCount: snapshot.visits.length, authorizationCount: snapshot.authorizations.rows.length, validation: snapshot.validation };
}
export async function manualSnapshotRoute(workspace: Workspace, repository: WorkspaceRepository, method: string, value: unknown, actor: string) {
  try {
    if (method !== "GET" && method !== "POST") return { status: 405, body: { ok: false, error: "method_not_allowed" } };
    const current = await workspace.settings();
    if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
    const officeId = identifier(current.settings.officeId), input = object(value);
    const capture = method === "POST" ? calendarCapture(input) : null;
    if (!capture && Object.keys(input).some(key => !["patientId", "id", "cursor"].includes(key))) throw new WorkflowError("invalid_snapshot_query");
    const patientId = identifier(capture?.patientId ?? input.patientId);
    if (capture && capture.officeId !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    const patient = await workspace.query({ operation: "GetPatientDemographics", id: patientId }, actor);
    if (patient.operation !== "GetPatientDemographics" || patient.source !== "hhaexchange" || patient.truncated || patient.records.length !== 1
      || patient.records[0]?.PatientID !== patientId || patient.records[0]?.OfficeID !== officeId) throw new WorkflowError("patient_office_mismatch", 403);
    const latest = await workspace.settings();
    if (!latest.dataApproved || JSON.stringify(current.settings) !== JSON.stringify(latest.settings)) throw new WorkflowError("office_policy_changed_restart", 409);
    const collection = `manualSourceSnapshots_${officeId}_${patientId}`;
    if (capture) {
      const { capturedAt: _captureTime, ...facts } = capture;
      const id = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
      const prior = await repository.get<Snapshot>(collection, id);
      if (prior) return { status: 200, body: { ok: true, duplicate: true, snapshot: prior } };
      const record: Snapshot = { ...capture, id, revision: 1, updatedAt: new Date().toISOString(), importedBy: actor,
        contentHash: id, validation: "manual_source_unvalidated" };
      let saved: Snapshot;
      try { saved = await repository.change<Snapshot>(collection, id, 0, actor, "manual_calendar_imported", () => record); }
      catch (error) {
        if (!(error instanceof WorkflowError) || error.code !== "revision_conflict") throw error;
        const concurrent = await repository.get<Snapshot>(collection, id);
        if (!concurrent) throw error;
        return { status: 200, body: { ok: true, duplicate: true, snapshot: concurrent } };
      }
      return { status: 200, body: { ok: true, duplicate: false, snapshot: saved } };
    }
    if (input.id !== undefined) {
      if (input.cursor !== undefined || typeof input.id !== "string" || !/^[a-f0-9]{64}$/.test(input.id)) throw new WorkflowError("invalid_snapshot_query");
      const saved = await repository.get<Snapshot>(collection, input.id);
      if (!saved || saved.officeId !== officeId || saved.patientId !== patientId) throw new WorkflowError("snapshot_not_found", 404);
      return { status: 200, body: { ok: true, snapshot: saved } };
    }
    workspaceCursor(input.cursor);
    const page = await repository.page<Snapshot>(collection, typeof input.cursor === "string" ? input.cursor : undefined);
    return { status: 200, body: { ok: true, items: page.items.map(summary), nextCursor: page.nextCursor, source: "manual_snapshot" } };
  } catch (error) {
    return { status: error instanceof WorkflowError ? error.status : 503, body: { ok: false,
      error: error instanceof WorkflowError ? error.code : "manual_snapshot_unavailable" } };
  }
}
