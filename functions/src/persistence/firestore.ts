import { createHash, randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ExternalReference } from "../domain/models.js";

if (getApps().length === 0) {
  initializeApp();
}

export type DomainCollection =
  | "employees"
  | "patients"
  | "schedules"
  | "visits"
  | "authorizations"
  | "caregiverAvailability"
  | "serviceCodes"
  | "billingRecords"
  | "collectionRecords"
  | "notifications"
  | "auditEvents"
  | "visitExceptions";

export interface PersistableEntity {
  id: string;
  externalReferences?: ExternalReference[];
}

interface ExternalReferenceLookup {
  system: string;
  entityType: string;
  externalId: string;
  collection: DomainCollection;
  entityId: string;
  updatedAt: string;
}

function assertDocumentId(id: string): void {
  if (!id || id.includes("/")) {
    throw new Error("PTHHS entity IDs must be non-empty Firestore document IDs.");
  }
}

function lookupId(reference: Pick<ExternalReference, "system" | "entityType" | "externalId">): string {
  return createHash("sha256")
    .update(reference.system + "\0" + reference.entityType + "\0" + reference.externalId)
    .digest("hex");
}

export function newInternalId(): string {
  return randomUUID();
}

export class ManagementStore {
  constructor(private readonly db: Firestore = getFirestore()) {}

  async upsert<T extends PersistableEntity>(
    collection: DomainCollection,
    entity: T,
  ): Promise<void> {
    assertDocumentId(entity.id);
    const entityRef = this.db.collection(collection).doc(entity.id);

    await this.db.runTransaction(async (transaction) => {
      const previous = await transaction.get(entityRef);
      const prior = previous.exists
        ? (previous.data() as PersistableEntity | undefined)
        : undefined;

      const oldRefs = prior?.externalReferences ?? [];
      const newRefs = entity.externalReferences ?? [];
      const currentKeys = new Set(newRefs.map(lookupId));

      for (const reference of oldRefs) {
        const key = lookupId(reference);
        if (!currentKeys.has(key)) {
          transaction.delete(this.db.collection("externalReferences").doc(key));
        }
      }

      transaction.set(entityRef, entity, { merge: true });

      const updatedAt = new Date().toISOString();
      for (const reference of newRefs) {
        const lookup: ExternalReferenceLookup = {
          system: reference.system,
          entityType: reference.entityType,
          externalId: reference.externalId,
          collection,
          entityId: entity.id,
          updatedAt,
        };
        transaction.set(
          this.db.collection("externalReferences").doc(lookupId(reference)),
          lookup,
          { merge: true },
        );
      }
    });
  }

  async get<T extends PersistableEntity>(
    collection: DomainCollection,
    id: string,
  ): Promise<T | null> {
    assertDocumentId(id);
    const snapshot = await this.db.collection(collection).doc(id).get();
    return snapshot.exists ? (snapshot.data() as T) : null;
  }

  async findByExternalReference<T extends PersistableEntity>(
    reference: Pick<ExternalReference, "system" | "entityType" | "externalId">,
  ): Promise<{ collection: DomainCollection; entity: T } | null> {
    const snapshot = await this.db
      .collection("externalReferences")
      .doc(lookupId(reference))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const lookup = snapshot.data() as ExternalReferenceLookup;
    const entity = await this.get<T>(lookup.collection, lookup.entityId);
    return entity ? { collection: lookup.collection, entity } : null;
  }
}
