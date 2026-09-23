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
  management = new ManagementStore(),
  state = new SyncStateStore(),
): Promise<SyncRunResult> {
  const storedCheckpoint = await state.getCheckpoint(adapter.resource);
  let checkpoint = options.checkpointOverride ?? storedCheckpoint;
  const sync = await state.begin(adapter.resource, checkpoint);

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
          await management.upsert(adapter.collection, normalized);
          processedCount += 1;
        } catch (error) {
          deadLetterCount += 1;
          await state.deadLetter({
            integration: "hhaexchange",
            resource: adapter.resource,
            ...(options.correlationId ? { correlationId: options.correlationId } : {}),
            ...(checkpoint ? { checkpoint } : {}),
            ...(source.sourceIdentifier ? { sourceIdentifier: source.sourceIdentifier } : {}),
            errorCode: error instanceof Error ? error.name || "normalization_error" : "normalization_error",
            errorMessage: error instanceof Error ? error.message : "Unknown normalization failure",
            attempts: 1,
          });
        }
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

    logger.info("Integration sync completed", {
      integration: "hhaexchange",
      resource: adapter.resource,
      syncId: sync.id,
      processedCount,
      deadLetterCount,
      pageCount,
    });

    return {
      resource: adapter.resource,
      processedCount,
      deadLetterCount,
      ...(checkpoint ? { checkpoint } : {}),
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "sync_failed";
    await state.fail(sync, code);
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
}
