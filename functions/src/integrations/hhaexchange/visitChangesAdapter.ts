import { createHash } from "node:crypto";
import type { ExternalReference, Visit, ClockEvent } from "../../domain/models.js";
import { ManagementStore } from "../../persistence/firestore.js";
import type { IncrementalSyncAdapter, SyncPage } from "../../sync/framework.js";
import {
  extractElementBody,
  extractElementText,
} from "./parser.js";
import { HhaSoapClient } from "./client.js";
import {
  getVisitChangesV5,
  type HhaVisitChangeRecord,
} from "./visits.js";

interface VisitCheckpoint {
  modifiedAfter: string;
  page: number;
}

function encodeCheckpoint(value: VisitCheckpoint): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCheckpoint(value: string | undefined, initialModifiedAfter: string): VisitCheckpoint {
  if (!value) {
    return { modifiedAfter: initialModifiedAfter, page: 1 };
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<VisitCheckpoint>;
    if (
      typeof parsed.modifiedAfter !== "string" ||
      !parsed.modifiedAfter.trim() ||
      typeof parsed.page !== "number" ||
      !Number.isInteger(parsed.page) ||
      parsed.page < 1
    ) {
      throw new Error("invalid_visit_checkpoint");
    }
    return { modifiedAfter: parsed.modifiedAfter, page: parsed.page };
  } catch {
    throw new Error("invalid_visit_checkpoint");
  }
}

function latestModified(records: HhaVisitChangeRecord[], fallback: string): string {
  let latest = fallback;
  let latestTime = Date.parse(fallback);

  for (const record of records) {
    if (!record.lastModifiedDate) continue;
    const candidate = Date.parse(record.lastModifiedDate);
    if (Number.isFinite(candidate) && (!Number.isFinite(latestTime) || candidate > latestTime)) {
      latest = record.lastModifiedDate;
      latestTime = candidate;
    }
  }

  return latest;
}

function externalReference(
  entityType: string,
  externalId: string,
  sourceUpdatedAt?: string,
  sourceVersionHash?: string,
): ExternalReference {
  return {
    system: "hhaexchange",
    entityType,
    externalId,
    ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
    lastSyncedAt: new Date().toISOString(),
    ...(sourceVersionHash ? { sourceVersionHash } : {}),
  };
}

function textWithin(xml: string, parent: string, child: string): string | undefined {
  const body = extractElementBody(xml, parent);
  return body === undefined ? undefined : extractElementText(body, child);
}

function clockEvent(
  visitId: string,
  type: "clock_in" | "clock_out",
  occurredAt: string | undefined,
): ClockEvent | null {
  if (!occurredAt) return null;
  return {
    id: visitId + "__" + type,
    visitId,
    type,
    occurredAt,
    source: "hhaexchange_evv",
    externalReferences: [],
  };
}

export function createVisitChangesAdapter(
  client: HhaSoapClient,
  initialModifiedAfter: string,
  management = new ManagementStore(),
): IncrementalSyncAdapter<HhaVisitChangeRecord, Visit> {
  if (!initialModifiedAfter.trim()) {
    throw new Error("Visit sync requires an explicit initial ModifiedAfter boundary.");
  }

  let maxObservedModifiedAfter = initialModifiedAfter;

  return {
    resource: "visit_changes_v5",
    collection: "visits",

    async fetchPage(checkpoint): Promise<SyncPage<HhaVisitChangeRecord>> {
      const cursor = decodeCheckpoint(checkpoint, initialModifiedAfter);
      const page = await getVisitChangesV5(client, cursor.modifiedAfter, cursor.page);

      if (!page.response.ok) {
        const errorId = page.response.error?.id;
        throw new Error(errorId !== undefined ? "hha_" + errorId : "hha_visit_changes_failed");
      }

      maxObservedModifiedAfter = latestModified(page.records, maxObservedModifiedAfter);
      const hasMore = page.currentPage < page.totalPages;

      return {
        items: page.records,
        hasMore,
        nextCheckpoint: hasMore
          ? encodeCheckpoint({
              modifiedAfter: cursor.modifiedAfter,
              page: page.currentPage + 1,
            })
          : encodeCheckpoint({
              modifiedAfter: maxObservedModifiedAfter,
              page: 1,
            }),
      };
    },

    async normalize(source): Promise<Visit> {
      const rawHash = createHash("sha256").update(source.xml).digest("hex");
      const visitReference = externalReference(
        "visit",
        source.visitId,
        source.lastModifiedDate,
        rawHash,
      );
      const visitId = await management.resolveOrCreateId("visits", visitReference);

      const patientExternalId = textWithin(source.xml, "Patient", "ID");
      if (!patientExternalId) {
        throw new Error("visit_missing_patient_id");
      }

      const patientReference = externalReference("patient", patientExternalId);
      const patientId = await management.resolveOrCreateId("patients", patientReference);

      const caregiverExternalId = textWithin(source.xml, "Caregiver", "ID");
      const employeeId = caregiverExternalId
        ? await management.resolveOrCreateId(
            "employees",
            externalReference("caregiver", caregiverExternalId),
          )
        : undefined;

      const actualStart =
        extractElementText(source.xml, "EVVStartTime") ??
        extractElementText(source.xml, "VisitStartTime");
      const actualEnd =
        extractElementText(source.xml, "EVVEndTime") ??
        extractElementText(source.xml, "VisitEndTime");

      const clockEvents = [
        clockEvent(visitId, "clock_in", extractElementText(source.xml, "EVVStartTime")),
        clockEvent(visitId, "clock_out", extractElementText(source.xml, "EVVEndTime")),
      ].filter((event): event is ClockEvent => event !== null);

      return {
        id: visitId,
        externalReferences: [visitReference],
        patientId,
        ...(employeeId ? { employeeId } : {}),
        ...(actualStart ? { actualStart } : {}),
        ...(actualEnd ? { actualEnd } : {}),
        status: "imported_unvalidated",
        clockEvents,
      };
    },
  };
}

export const visitCheckpointCodec = {
  encode: encodeCheckpoint,
  decode: decodeCheckpoint,
};
