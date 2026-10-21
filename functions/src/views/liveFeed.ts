import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { WorkflowError, identifier } from "../operations/reads.js";
import { visitPreview, visitContextFingerprint } from "./visits.js";

type Workspace = Parameters<typeof visitPreview>[0];
type Settings = Awaited<ReturnType<Workspace["settings"]>>;
type Page = Awaited<ReturnType<typeof visitPreview>>;
export const LIVE_FEED_INTERVAL_SECONDS = 60;
export const LIVE_FEED_MAX_AGE_SECONDS = 180;
const WORKER = "scheduled_live_api_feed";
const READS = ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics"] as const;

export interface FeedRecord {
  version: 1;
  startedAt: string;
  completedAt: string;
  state: "connected" | "unavailable";
  context: string;
  error: string | null;
  page: Page | null;
}
export interface FeedStore {
  get(): Promise<FeedRecord | null>;
  publish(record: FeedRecord): Promise<boolean>;
}

/** Protected server cache, separate from manually captured/imported records. */
export class FirestoreFeedStore implements FeedStore {
  constructor(private db: Firestore = getFirestore()) {}
  async get(): Promise<FeedRecord | null> {
    const doc = await this.db.collection("liveApiFeed").doc("owner").get();
    return doc.exists ? doc.data() as FeedRecord : null;
  }
  async publish(record: FeedRecord): Promise<boolean> {
    return this.db.runTransaction(async tx => {
      const ref = this.db.collection("liveApiFeed").doc("owner"), old = (await tx.get(ref)).data();
      // An old worker must not overwrite a newer success or failure.
      if (typeof old?.startedAt === "string" && old.startedAt >= record.startedAt) return false;
      tx.set(ref, record);
      return true;
    });
  }
}

export function officeDay(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)?.value).join("-");
}
function scope(settings: Settings, now: Date) {
  if (!settings.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  const officeId = identifier(settings.settings.officeId), timezone = settings.settings.officeTimezone;
  if (!timezone || timezone.length > 80) throw new WorkflowError("office_timezone_not_configured", 423);
  let date: string;
  try { date = officeDay(now, timezone); } catch { throw new WorkflowError("office_timezone_not_configured", 423); }
  if (READS.some(read => !settings.settings.enabledReads.includes(read))) throw new WorkflowError("visit_reads_not_owner_enabled", 423);
  return { officeId, timezone, date, context: visitContextFingerprint(settings, WORKER, date) };
}
function safeError(error: unknown) {
  return error instanceof WorkflowError && /^[a-z][a-z0-9_]{0,100}$/.test(error.code) ? error.code : "live_api_feed_unavailable";
}

/** One current-office/day page every minute. No web scraping or HHA mutations. */
export async function refreshLiveFeed(workspace: Workspace, store: FeedStore,
  now: () => Date = () => new Date(), read: typeof visitPreview = visitPreview) {
  const startedAt = now().toISOString();
  let context = "";
  try {
    const current = await workspace.settings(), selected = scope(current, now());
    context = selected.context;
    const page = await read(workspace, { officeId: selected.officeId, date: selected.date, limit: "10" }, WORKER);
    if (scope(await workspace.settings(), now()).context !== context) throw new WorkflowError("live_feed_scope_changed", 409);
    if (page.scope.officeId !== selected.officeId || page.scope.date !== selected.date || page.page.offset !== 0 || page.items.length > 10) {
      throw new WorkflowError("live_feed_response_scope_invalid", 502);
    }
    // A search success with every detail denied does not prove a usable feed.
    if (page.items.length && page.page.returnedCount === 0) throw new WorkflowError("live_feed_no_readable_details", 503);
    const record: FeedRecord = { version: 1, startedAt, completedAt: now().toISOString(), state: "connected", context, error: null, page };
    await store.publish(record);
    return { state: "connected", fetchedAt: page.fetchedAt, readableCount: page.page.returnedCount, intervalSeconds: LIVE_FEED_INTERVAL_SECONDS };
  } catch (error) {
    const code = safeError(error);
    await store.publish({ version: 1, startedAt, completedAt: now().toISOString(), state: "unavailable", context, error: code, page: null });
    return { state: "unavailable", error: code, intervalSeconds: LIVE_FEED_INTERVAL_SECONDS };
  }
}

export async function readLiveFeed(workspace: Workspace, store: FeedStore, query: unknown, actor: string, now = new Date()) {
  const input = query as Record<string, unknown>;
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !["officeId", "date"].includes(key))) {
    throw new WorkflowError("invalid_live_feed_query");
  }
  const current = await workspace.settings(), selected = scope(current, now);
  if (input.officeId !== undefined && input.officeId !== selected.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  if (input.date !== undefined && input.date !== selected.date) throw new WorkflowError("live_feed_current_day_only", 409);
  const record = await store.get();
  if (scope(await workspace.settings(), now).context !== selected.context) throw new WorkflowError("live_feed_scope_changed", 409);
  if (!record || record.version !== 1 || record.context !== selected.context) throw new WorkflowError("live_feed_waiting_for_first_update", 503, 60);
  if (record.state !== "connected" || !record.page) throw new WorkflowError(record.error || "live_api_feed_unavailable", 503, 60);
  const fetched = Date.parse(record.page.fetchedAt), age = (now.getTime() - fetched) / 1000;
  if (!Number.isFinite(age) || age < 0 || age > LIVE_FEED_MAX_AGE_SECONDS) throw new WorkflowError("live_feed_update_overdue", 503, 60);
  const page = record.page;
  if (page.scope.officeId !== selected.officeId || page.scope.date !== selected.date || page.scope.timezone !== selected.timezone || page.page.offset !== 0) {
    throw new WorkflowError("live_feed_response_scope_invalid", 503);
  }
  // Stored cursors belong to the worker. Bind the continuation to this freshly
  // authorized caller so the ordinary detail endpoint keeps all existing checks.
  const nextCursor = page.page.nextOffset === null ? null : Buffer.from(JSON.stringify({ version: 1,
    scope: visitContextFingerprint(current, actor, selected.date), discovery: page.discovery.fingerprint, offset: page.page.nextOffset })).toString("base64url");
  return { ...page, nextCursor, feed: { kind: "scheduled_api" as const, intervalSeconds: LIVE_FEED_INTERVAL_SECONDS,
    maxAgeSeconds: LIVE_FEED_MAX_AGE_SECONDS, checkedAt: now.toISOString(), updatedAt: record.completedAt,
    background: true, persistedImport: false, coverage: "first_source_page" as const } };
}
