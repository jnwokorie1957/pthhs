import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { IntegrationSync } from "../domain/models.js";

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

  async getCheckpoint(resource: string): Promise<string | undefined> {
    const snapshot = await this.db.collection("integrationCursors").doc(cursorId(resource)).get();
    if (!snapshot.exists) return undefined;
    return (snapshot.data() as SyncCursor).checkpoint;
  }

  async begin(resource: string, checkpoint?: string): Promise<IntegrationSync> {
    const sync: IntegrationSync = {
      id: randomUUID(),
      integration: "hhaexchange",
      resource,
      startedAt: new Date().toISOString(),
      ...(checkpoint ? { checkpoint } : {}),
      status: "running",
      processedCount: 0,
    };
    await this.db.collection("integrationSyncs").doc(sync.id).set(sync);
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

    const batch = this.db.batch();
    batch.set(this.db.collection("integrationSyncs").doc(sync.id), finalSync);
    const cursor: SyncCursor = {
      integration: "hhaexchange",
      resource: sync.resource,
      ...(checkpoint ? { checkpoint } : {}),
      lastSuccessfulAt: completedAt,
      updatedAt: completedAt,
    };
    batch.set(
      this.db.collection("integrationCursors").doc(cursorId(sync.resource)),
      cursor,
      { merge: true },
    );
    await batch.commit();
  }

  async fail(sync: IntegrationSync, errorCode: string): Promise<void> {
    await this.db.collection("integrationSyncs").doc(sync.id).set(
      {
        ...sync,
        status: "failed",
        completedAt: new Date().toISOString(),
        errorCode,
      },
      { merge: true },
    );
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
