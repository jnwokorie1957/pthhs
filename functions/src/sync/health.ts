import type { IntegrationSync } from "../domain/models.js";
import type { SyncCursor } from "./state.js";

// Deliberately allowlist metadata. Never return cursors, source identifiers,
// exception messages, dead-letter payloads or individual patient records.
export function integrationHealth(cursor: SyncCursor | null, latest: IntegrationSync | null, now = new Date()) {
  const last = cursor?.lastSuccessfulAt;
  const timestamp = last ? Date.parse(last) : NaN;
  const valid = Number.isFinite(timestamp) && timestamp <= now.getTime();
  return {
    resource: "visit_changes_v5",
    state: latest?.status ?? (valid ? "unknown" : "never_synced"),
    lastSuccessfulAt: valid ? last : null,
    ageSeconds: valid ? Math.floor((now.getTime() - timestamp) / 1000) : null,
    freshness: "schedule_not_configured",
    processedCount: latest?.processedCount ?? 0,
    deadLetterCount: latest?.deadLetterCount ?? 0,
    replayRequired: latest?.status === "partial" || latest?.status === "failed",
    dataValidation: "pending",
  };
}

export function importLockHealth(lock: { active?: unknown; acquiredAt?: unknown } | null) {
  const acquiredAt = typeof lock?.acquiredAt === "string" && Number.isFinite(Date.parse(lock.acquiredAt)) ? lock.acquiredAt : null;
  return { state: lock?.active === true ? "held_worker_status_requires_verification" : "available", acquiredAt: lock?.active === true ? acquiredAt : null, automaticTakeover: false };
}
