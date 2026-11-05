import { createHash, randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { identifier, readRequest, WorkflowError } from "../operations/reads.js";
import { visitPreview, visitContextFingerprint, type VisitPreviewItem } from "./visits.js";
import { officeDay } from "./liveFeed.js";

type Workspace = Parameters<typeof visitPreview>[0];
type Settings = Awaited<ReturnType<Workspace["settings"]>>;
type Page = Awaited<ReturnType<typeof visitPreview>>;
const WORKER = "scheduled_office_day_api_feed";
const READS = ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"] as const;
const FIELDS = ["id", "patientId", "caregiverId", "scheduledStart", "scheduledEnd", "actualStart", "actualEnd", "evvStart", "evvEnd", "detailFetchedAt", "officeCheckedAt", "state", "error"] as const;
type Item = Pick<VisitPreviewItem, Exclude<typeof FIELDS[number], "error">> & { error: string | null };
interface Scope { officeId: string; date: string; timezone: string; }
interface Target { scope: Scope; context: string; requestedAt: string; }
interface Snapshot { generation: string; startedAt: string; latestSearchAt: string; completedAt: string | null;
  fingerprint: string; total: number; checked: number; truncated: boolean; cursor: string | null; retryAt: string | null; blob: Uint8Array; }
export interface OfficeDayRecord { version: 1; revision: number; context: string; scope: Scope;
  working: Snapshot | null; published: Snapshot | null; attemptedAt: string; progressedAt: string | null; retryAt: string | null; error: string | null; }
export interface OfficeDayStore {
  target(): Promise<Target | null>;
  request(target: Target): Promise<void>;
  get(key: string): Promise<OfficeDayRecord | null>;
  save(key: string, expected: number | null, record: OfficeDayRecord): Promise<boolean>;
}
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function key(scope: Scope) { return hash([scope.officeId, scope.date]); }
function stamp(value: unknown): value is string { return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)); }
function sameScope(a: Scope, b: Scope) { return a?.officeId === b.officeId && a?.date === b.date && a?.timezone === b.timezone; }
function selected(settings: Settings, date: string) {
  if (!settings.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  const officeId = identifier(settings.settings.officeId), timezone = settings.settings.officeTimezone;
  if (!timezone || timezone.length > 80) throw new WorkflowError("office_timezone_not_configured", 423);
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { throw new WorkflowError("office_timezone_not_configured", 423); }
  if (READS.some(read => !settings.settings.enabledReads.includes(read))) throw new WorkflowError("visit_reads_not_owner_enabled", 423);
  readRequest({ operation: "SearchVisitsV2", officeId, date });
  return { scope: { officeId, date, timezone }, context: visitContextFingerprint(settings, WORKER, date) };
}
function item(value: VisitPreviewItem): Item {
  identifier(value.id);
  if (!["source_unvalidated", "unavailable"].includes(value.state)) throw new WorkflowError("office_day_cache_invalid", 502);
  if (value.state !== "unavailable" && (!stamp(value.detailFetchedAt) || !stamp(value.officeCheckedAt))) throw new WorkflowError("office_day_receipt_missing", 502);
  const result = Object.fromEntries(FIELDS.map(field => [field, value[field] ?? null])) as Item;
  for (const field of FIELDS) if (result[field] !== null && (typeof result[field] !== "string" || result[field]!.length > 1000)) throw new WorkflowError("office_day_cache_invalid", 502);
  if (value.state === "unavailable") for (const field of FIELDS) if (!["id", "state", "error"].includes(field)) result[field] = null as never;
  return result;
}
function pack(rows: Item[]) {
  const json = JSON.stringify(rows);
  if (rows.length > 10000 || Buffer.byteLength(json) > 5_000_000) throw new WorkflowError("office_day_capacity_limit", 503);
  const blob = gzipSync(json);
  if (blob.length > 300_000) throw new WorkflowError("office_day_capacity_limit", 503);
  return blob;
}
function unpack(snapshot: Snapshot): Item[] {
  try {
    if (!(snapshot.blob instanceof Uint8Array) || snapshot.blob.length > 300_000) throw new Error();
    const rows: unknown = JSON.parse(gunzipSync(snapshot.blob, { maxOutputLength: 5_000_000 }).toString("utf8"));
    if (!Array.isArray(rows) || rows.length !== snapshot.checked || rows.length > 10000) throw new Error();
    const clean = rows.map(row => item(row));
    if (new Set(clean.map(row => row.id)).size !== clean.length) throw new Error();
    return clean;
  } catch { throw new WorkflowError("office_day_cache_invalid", 503); }
}

/** Default Standard/Native database; server IAM only. No browser Firestore SDK. */
export class FirestoreOfficeDayStore implements OfficeDayStore {
  constructor(private db: Firestore = getFirestore()) {}
  async target() { const doc = await this.db.collection("officeDayApiFeed").doc("_target").get(); return doc.exists ? doc.data() as Target : null; }
  async request(target: Target) {
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("officeDayApiFeed").doc("_target"), old = (await tx.get(ref)).data();
      if (typeof old?.requestedAt === "string" && old.requestedAt > target.requestedAt) return;
      tx.set(ref, target);
    });
  }
  async get(id: string) { const doc = await this.db.collection("officeDayApiFeed").doc(id).get(); return doc.exists ? doc.data() as OfficeDayRecord : null; }
  async save(id: string, expected: number | null, record: OfficeDayRecord) {
    return this.db.runTransaction(async tx => {
      const ref = this.db.collection("officeDayApiFeed").doc(id), old = await tx.get(ref);
      if ((old.exists ? old.data()?.revision : null) !== expected) return false;
      tx.set(ref, record); return true;
    });
  }
}

function append(previous: Snapshot | null, page: Page, now: string): Snapshot {
  const offset = page.page.offset, total = page.discovery.selectedCount;
  if (!stamp(page.fetchedAt) || !Number.isSafeInteger(total) || total < 0 || total > 10000 || page.items.length > 10
    || (!previous && offset !== 0) || (previous && (previous.fingerprint !== page.discovery.fingerprint || previous.total !== total))) throw new WorkflowError("office_day_source_changed", 409);
  const rows = previous ? unpack(previous) : [], positions = new Map(rows.map((row, index) => [row.id, index]));
  for (let index = 0; index < page.items.length; index++) {
    const row = item(page.items[index]!), position = offset + index;
    if (position > rows.length || position >= total || (rows[position] && rows[position]!.id !== row.id)
      || (positions.has(row.id) && positions.get(row.id) !== position)) throw new WorkflowError("office_day_source_changed", 409);
    positions.set(row.id, position); rows[position] = row;
  }
  const end = offset + page.items.length;
  if (page.page.nextOffset !== (end < total ? end : null) || Boolean(page.nextCursor) !== (end < total)
    || (end < total && !page.items.length)) throw new WorkflowError("office_day_source_changed", 409);
  const cursor = page.retry?.cursor ?? page.nextCursor;
  if (!cursor && (rows.length !== total || hash(rows.map(row => row.id)) !== page.discovery.fingerprint)) throw new WorkflowError("office_day_source_changed", 409);
  return { generation: previous?.generation ?? randomUUID(), startedAt: previous?.startedAt ?? page.fetchedAt,
    latestSearchAt: page.fetchedAt, completedAt: cursor ? null : now, fingerprint: page.discovery.fingerprint,
    total, checked: rows.length, truncated: Boolean(previous?.truncated || page.discovery.truncated || page.completeness.truncated),
    cursor, retryAt: page.retry ? new Date(Date.parse(now) + page.retry.afterSeconds * 1000).toISOString() : null, blob: pack(rows) };
}

/** Resumes persisted source cursors even with every browser closed or asleep. */
export async function refreshOfficeDay(workspace: Workspace, store: OfficeDayStore, now: () => Date = () => new Date(), read: typeof visitPreview = visitPreview, steps = 2) {
  const current = await workspace.settings(), timezone = current.settings.officeTimezone;
  if (!timezone) throw new WorkflowError("office_timezone_not_configured", 423);
  const today = officeDay(now(), timezone), wanted = await store.target();
  let choice = selected(current, today);
  if (wanted && stamp(wanted.requestedAt) && now().getTime() - Date.parse(wanted.requestedAt) >= 0
    && now().getTime() - Date.parse(wanted.requestedAt) < 90 * 60_000) {
    const candidate = selected(current, wanted.scope.date);
    if (candidate.context === wanted.context && candidate.scope.officeId === wanted.scope.officeId) choice = candidate;
  }
  const id = key(choice.scope);
  let prior = await store.get(id);
  let state: OfficeDayRecord = prior?.version === 1 && prior.context === choice.context && sameScope(prior.scope, choice.scope) ? prior
    : { version: 1, revision: prior?.revision ?? 0, context: choice.context, scope: choice.scope, working: null, published: null, attemptedAt: now().toISOString(), progressedAt: null, retryAt: null, error: null };
  if (state.working && (!stamp(state.working.startedAt) || now().getTime() - Date.parse(state.working.startedAt) > 2 * 60 * 60_000)) state = { ...state, working: null, retryAt: null };
  const assertScope = async () => { if (selected(await workspace.settings(), choice.scope.date).context !== choice.context) throw new WorkflowError("office_day_policy_changed", 409); };
  for (let step = 0; step < Math.min(2, steps); step++) {
    if (state.retryAt && Date.parse(state.retryAt) > now().getTime()) return { state: "waiting" };
    const attemptedAt = now().toISOString();
    try {
      await assertScope();
      const page = await read(workspace, { officeId: choice.scope.officeId, date: choice.scope.date, limit: "10", ...(state.working?.cursor ? { cursor: state.working.cursor } : {}) }, WORKER);
      await assertScope();
      if (page.scope.officeId !== choice.scope.officeId || page.scope.date !== choice.scope.date || page.scope.timezone !== choice.scope.timezone) throw new WorkflowError("office_day_source_changed", 409);
      const snapshot = append(state.working, page, now().toISOString());
      const next: OfficeDayRecord = { ...state, revision: state.revision + 1, attemptedAt, progressedAt: now().toISOString(), retryAt: snapshot.retryAt, error: null,
        working: snapshot.completedAt ? null : snapshot, published: snapshot.completedAt ? snapshot : state.published };
      if (!await store.save(id, prior?.revision ?? null, next)) return { state: "superseded" };
      state = next; prior = next;
      if (snapshot.completedAt) return { state: "ready" };
    } catch (error) {
      await assertScope();
      const code = error instanceof WorkflowError && /^[a-z][a-z0-9_]{0,100}$/.test(error.code) ? error.code : "office_day_source_unavailable";
      const restart = error instanceof WorkflowError && error.status === 409;
      const retryAt = new Date(now().getTime() + (error instanceof WorkflowError && error.retryAfterSeconds ? error.retryAfterSeconds : 60) * 1000).toISOString();
      const next: OfficeDayRecord = { ...state, revision: state.revision + 1, attemptedAt, error: code, retryAt,
        working: restart ? null : state.working ? { ...state.working, retryAt } : null };
      await store.save(id, prior?.revision ?? null, next);
      return { state: restart ? "restarting" : "waiting" };
    }
  }
  return { state: "collecting" };
}

/** Cache reads never fetch HHA or accept browser-provided source records. */
export async function readOfficeDay(workspace: Workspace, store: OfficeDayStore, value: unknown, now = new Date()) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(name => !["date", "officeId"].includes(name))) throw new WorkflowError("invalid_office_day_query");
  const input = value as Record<string, unknown>, current = await workspace.settings(), choice = selected(current, input.date as string);
  if (input.officeId !== undefined && input.officeId !== choice.scope.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  await store.request({ ...choice, requestedAt: now.toISOString() });
  const record = await store.get(key(choice.scope));
  if (selected(await workspace.settings(), choice.scope.date).context !== choice.context) throw new WorkflowError("office_day_policy_changed", 409);
  const valid = record?.version === 1 && record.context === choice.context && sameScope(record.scope, choice.scope) ? record : null;
  const snapshot = valid?.published ?? valid?.working ?? null;
  const items = snapshot ? unpack(snapshot) : [];
  const done = Boolean(snapshot?.completedAt), age = valid?.progressedAt ? (now.getTime() - Date.parse(valid.progressedAt)) / 1000 : null;
  const snapshotAge = snapshot ? (now.getTime() - Date.parse(snapshot.startedAt)) / 1000 : null;
  const stale = age === null || !Number.isFinite(age) || age < 0 || age > 180 || snapshotAge === null || !Number.isFinite(snapshotAge) || snapshotAge < 0 || snapshotAge > 7200;
  return { ok: true, mode: "live" as const, source: "hhaexchange" as const, validation: "source_unvalidated" as const,
    timezone: "source_values_unconverted" as const, scope: choice.scope, state: done ? items.length ? "ready" : "empty" : "partial",
    items, fetchedAt: snapshot?.latestSearchAt ?? null, totals: null,
    discovery: { selectedCount: snapshot?.total ?? null, truncated: snapshot?.truncated ?? false },
    officeDayCache: { kind: "scheduled_office_day_api" as const, persistedImport: false, background: true, known: snapshot !== null,
      done, complete: done && !snapshot?.truncated && items.every(row => row.state !== "unavailable"),
      startedAt: snapshot?.startedAt ?? null, latestSearchAt: snapshot?.latestSearchAt ?? null, completedAt: snapshot?.completedAt ?? null,
      checkedAt: now.toISOString(), updatedAt: valid?.progressedAt ?? null, stale, error: valid?.error ?? null,
      progress: { checked: valid?.working?.checked ?? snapshot?.checked ?? 0, total: valid?.working?.total ?? snapshot?.total ?? null,
        retryAt: valid?.retryAt ?? null, refreshing: Boolean(valid?.working && valid.published) } } };
}
