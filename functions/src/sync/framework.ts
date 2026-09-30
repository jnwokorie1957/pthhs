import { logger } from "firebase-functions";
import { ManagementStore, type DomainCollection, type PersistableEntity } from "../persistence/firestore.js";
import { SyncStateStore } from "./state.js";

export interface SyncSourceItem {
  sourceIdentifier?: string;
}

export interface SyncPage<TSource extends SyncSourceItem> {
  items: TSource[];
  nextCheckpoint?: string;
  hasMore: boolean;
}

export interface IncrementalSyncAdapter<
  TSource extends SyncSourceItem,
  TEntity extends PersistableEntity,
> {
  resource: string;
  collection: DomainCollection;
  fetchPage(checkpoint?: string): Promise<SyncPage<TSource>>;
  normalize(source: TSource): Promise<TEntity> | TEntity;
}

export interface RunSyncOptions {
  checkpointOverride?: string;
  maxPages?: number;
  correlationId?: string;
}

export interface SyncRunResult {
  status: "success" | "partial";
  resource: string;
  processedCount: number;
  deadLetterCount: number;
  checkpoint?: string;
}

export async function runIncrementalSync<
  TSource extends SyncSourceItem,
  TEntity extends PersistableEntity,
>(
  adapter: IncrementalSyncAdapter<TSource, TEntity>,
  options: RunSyncOptions = {},
  management: Pick<ManagementStore, "upsert"> = new ManagementStore(),
  state: Pick<SyncStateStore, "getRun" | "acquire" | "release" | "getCheckpoint" | "begin" | "deadLetter" | "succeed" | "partial" | "fail"> = new SyncStateStore(),
): Promise<SyncRunResult> {
  // Serialize all HHA imports: different feed versions can write the same
  // domain collections, so per-feed locks are insufficient.
  const lockResource = "all_hha_imports";
  const lock = await state.acquire(lockResource);
  let finalized = false;
  try {
  const storedCheckpoint = await state.getCheckpoint(adapter.resource);
  let checkpoint = options.checkpointOverride ?? storedCheckpoint;
  const sync = await state.begin(adapter.resource, checkpoint, lock);

  let processedCount = 0;
  let deadLetterCount = 0;
  let pageCount = 0;

  try {
    do {
      if (pageCount >= (options.maxPages ?? 1000)) {
        throw new Error("sync_page_limit_exceeded");
      }

      const page = await adapter.fetchPage(checkpoint);
      pageCount += 1;

      for (const source of page.items) {
        try {
          const normalized = await adapter.normalize(source);
          await management.upsert(adapter.collection, normalized, "replace", { token: lock });
          processedCount += 1;
        } catch (error) {
          deadLetterCount += 1;
          await state.deadLetter({
            integration: "hhaexchange",
            resource: adapter.resource,
            ...(options.correlationId ? { correlationId: options.correlationId } : {}),
            ...(checkpoint ? { checkpoint } : {}),
            ...(source.sourceIdentifier ? { sourceIdentifier: source.sourceIdentifier } : {}),
            errorCode: "record_import_failed",
            errorMessage: "Record could not be imported; replay requires source validation.",
            attempts: 1,
          });
        }
      }

      // Do not lose rejected records by advancing the durable watermark. Stop
      // this run and replay from its original cursor after the cause is fixed.
      if (deadLetterCount > 0) {
        await state.partial(sync, processedCount, deadLetterCount);
        finalized = true;
        return { status: "partial", resource: adapter.resource, processedCount, deadLetterCount,
          ...(storedCheckpoint ? { checkpoint: storedCheckpoint } : {}) };
      }

      if (page.nextCheckpoint) {
        checkpoint = page.nextCheckpoint;
      }

      if (!page.hasMore) {
        break;
      }

      if (!page.nextCheckpoint) {
        throw new Error("sync_missing_next_checkpoint");
      }
    } while (true);

    await state.succeed(sync, processedCount, checkpoint);
    finalized = true;

    logger.info("Integration sync completed", {
      integration: "hhaexchange",
      resource: adapter.resource,
      syncId: sync.id,
      processedCount,
      deadLetterCount,
      pageCount,
    });

    return {
      status: "success",
      resource: adapter.resource,
      processedCount,
      deadLetterCount,
      ...(checkpoint ? { checkpoint } : {}),
    };
  } catch (error) {
    // A transaction may commit even when its acknowledgement is lost.
    // Read failure deliberately retains the lock; never overwrite uncertainty.
    const terminal = await state.getRun(sync.id);
    if (terminal && terminal.importLockToken === sync.importLockToken &&
        (terminal.status === "success" || terminal.status === "partial")) {
      finalized = true;
      return { status: terminal.status, resource: terminal.resource,
        processedCount: terminal.processedCount ?? 0, deadLetterCount: terminal.deadLetterCount ?? 0,
        ...(terminal.checkpoint ? { checkpoint: terminal.checkpoint } : {}) };
    }
    // Upstream exception messages can contain credentials, XML or patient data.
    const code = "sync_failed";
    await state.fail(sync, code);
    finalized = true;
    logger.error("Integration sync failed", {
      integration: "hhaexchange",
      resource: adapter.resource,
      syncId: sync.id,
      processedCount,
      deadLetterCount,
      pageCount,
      errorCode: code,
    });
    throw error;
  }
  } finally {
    // Release only after all awaited record operations and durable terminal state.
    // Ambiguous begin/finalization failures conservatively keep the lock.
    if (finalized) await state.release(lockResource, lock);
  }
}
