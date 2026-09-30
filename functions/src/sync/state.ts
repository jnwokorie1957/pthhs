import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { IntegrationSync } from "../domain/models.js";
import { integrationHealth, importLockHealth } from "./health.js";

if (getApps().length === 0) {
  initializeApp();
}

export interface SyncDeadLetter {
  id: string;
  integration: "hhaexchange";
  resource: string;
  occurredAt: string;
  correlationId?: string;
  checkpoint?: string;
  sourceIdentifier?: string;
  errorCode: string;
  errorMessage: string;
  attempts: number;
  resolvedAt?: string;
}

export interface SyncCursor {
  integration: "hhaexchange";
  resource: string;
  checkpoint?: string;
  lastSuccessfulAt?: string;
  updatedAt: string;
}

function cursorId(resource: string): string {
  return "hhaexchange__" + resource.replace(/[^A-Za-z0-9_.-]/g, "_");
}

export class SyncStateStore {
  constructor(private readonly db: Firestore = getFirestore()) {}

  // No TTL takeover: a paused process must never race a replacement importer.
  // A crash leaves a durable lock for explicitly verified operational recovery.
  async acquire(resource: string): Promise<string> {
    const token = randomUUID();
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("integrationLocks").doc(cursorId(resource));
      const prior = await tx.get(ref);
      if (prior.data()?.active) throw new Error("sync_already_running_or_recovery_required");
      tx.set(ref, { resource, token, active: true, acquiredAt: new Date().toISOString() });
    });
    return token;
  }
  async release(resource: string, token: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("integrationLocks").doc(cursorId(resource));
      const prior = await tx.get(ref);
      if (!prior.data()?.active || prior.data()?.token !== token) throw new Error("sync_lock_owner_mismatch");
      tx.set(ref, { ...prior.data(), active: false, releasedAt: new Date().toISOString() });
    });
  }

  async health() {
    const id = cursorId("visit_changes_v5");
    const [cursor, latest, lock] = await Promise.all([
      this.db.collection("integrationCursors").doc(id).get(),
      this.db.collection("integrationHealth").doc(id).get(),
      this.db.collection("integrationLocks").doc(cursorId("all_hha_imports")).get(),
    ]);
    return { ...integrationHealth(
      cursor.exists ? cursor.data() as SyncCursor : null,
      latest.exists ? latest.data() as IntegrationSync : null,
    ), singleFlight: importLockHealth(lock.exists ? lock.data()! : null) };
  }

  private async recordRun(sync: IntegrationSync): Promise<void> {
    await this.db.runTransaction(async tx => {
      const lock = await tx.get(this.db.collection("integrationLocks").doc(cursorId("all_hha_imports")));
      if (!sync.importLockToken || !lock.data()?.active || lock.data()?.token !== sync.importLockToken) throw new Error("sync_lock_owner_mismatch");
      const existing = await tx.get(this.db.collection("integrationSyncs").doc(sync.id));
      if (existing.exists && existing.data()?.status !== "running") throw new Error("sync_already_terminal");
      tx.set(this.db.collection("integrationSyncs").doc(sync.id), sync);
      tx.set(this.db.collection("integrationHealth").doc(cursorId(sync.resource)), sync);
    });
  }

  async getRun(id: string): Promise<IntegrationSync | undefined> {
    const snapshot = await this.db.collection("integrationSyncs").doc(id).get();
    return snapshot.exists ? snapshot.data() as IntegrationSync : undefined;
  }

  async getCheckpoint(resource: string): Promise<string | undefined> {
    const snapshot = await this.db.collection("integrationCursors").doc(cursorId(resource)).get();
    if (!snapshot.exists) return undefined;
    return (snapshot.data() as SyncCursor).checkpoint;
  }

  async begin(resource: string, checkpoint: string | undefined, importLockToken: string): Promise<IntegrationSync> {
    const sync: IntegrationSync = {
      id: randomUUID(),
      importLockToken,
      integration: "hhaexchange",
      resource,
      startedAt: new Date().toISOString(),
      ...(checkpoint ? { checkpoint } : {}),
      status: "running",
      processedCount: 0,
    };
    await this.recordRun(sync);
    return sync;
  }

  async succeed(
    sync: IntegrationSync,
    processedCount: number,
    checkpoint?: string,
  ): Promise<void> {
    const completedAt = new Date().toISOString();
    const finalSync: IntegrationSync = {
      ...sync,
      status: "success",
      completedAt,
      processedCount,
      ...(checkpoint ? { checkpoint } : {}),
    };

    const cursor: SyncCursor = {
      integration: "hhaexchange", resource: sync.resource,
      ...(checkpoint ? { checkpoint } : {}), lastSuccessfulAt: completedAt, updatedAt: completedAt,
    };
    await this.db.runTransaction(async tx => {
      const lock = await tx.get(this.db.collection("integrationLocks").doc(cursorId("all_hha_imports")));
      if (!sync.importLockToken || !lock.data()?.active || lock.data()?.token !== sync.importLockToken) throw new Error("sync_lock_owner_mismatch");
      tx.set(this.db.collection("integrationSyncs").doc(sync.id), finalSync);
      tx.set(this.db.collection("integrationHealth").doc(cursorId(sync.resource)), finalSync);
      tx.set(this.db.collection("integrationCursors").doc(cursorId(sync.resource)), cursor, { merge: true });
    });
  }

  async fail(sync: IntegrationSync, errorCode: string): Promise<void> {
    await this.recordRun(
      {
        ...sync,
        status: "failed",
        completedAt: new Date().toISOString(),
        errorCode,
      },
    );
  }

  async partial(sync: IntegrationSync, processedCount: number, deadLetterCount: number): Promise<void> {
    await this.recordRun({
      ...sync, status: "partial", completedAt: new Date().toISOString(),
      processedCount, deadLetterCount, errorCode: "record_import_failed",
    });
  }

  async deadLetter(input: Omit<SyncDeadLetter, "id" | "occurredAt">): Promise<string> {
    const item: SyncDeadLetter = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      ...input,
    };
    await this.db.collection("integrationDeadLetters").doc(item.id).set(item);
    return item.id;
  }
}
