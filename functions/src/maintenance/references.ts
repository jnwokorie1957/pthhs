import { createHash } from "node:crypto";
import type { OperationsWorkspace } from "../operations/workspace.js";
import { identifier, WorkflowError } from "../operations/reads.js";

const catalogs = {
  schedule: { operation: "GetScheduleBillInfoEditReasons", status: "ReasonStatus", note: "NoteRequired", minimum: "MinCharacterCount" },
  missed_reason: { operation: "GetMissedVisitReasons", status: "Status", note: "ReasonNoteRequired", minimum: "ReasonNoteMinCharacterCount" },
  missed_action: { operation: "GetMissedVisitActionTaken", status: "Status", note: "", minimum: "" }
} as const;
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Agency reference lists are not a visit-specific reason/action approval. */
export async function maintenanceReferenceCodes(workspace: Pick<OperationsWorkspace, "settings" | "query">, value: unknown, actor: string) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join() !== "catalog") throw new WorkflowError("invalid_reference_catalog");
  const catalog = (value as {catalog?: unknown}).catalog;
  if (typeof catalog !== "string" || !Object.hasOwn(catalogs, catalog)) throw new WorkflowError("invalid_reference_catalog");
  const specification = catalogs[catalog as keyof typeof catalogs], initial = await workspace.settings();
  if (!initial.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  const officeContext = identifier(initial.settings.officeId);
  if (!initial.settings.enabledReads.includes(specification.operation)) throw new WorkflowError("read_not_owner_enabled", 423);
  const source = await workspace.query({ operation: specification.operation }, actor);
  if (fingerprint(await workspace.settings()) !== fingerprint(initial)) throw new WorkflowError("office_policy_changed_restart", 409);
  if (source.source !== "hhaexchange" || source.operation !== specification.operation || source.records.length > 200) throw new WorkflowError("reference_source_unverified", 502);
  const seen = new Set<string>();
  const items = source.records.map(row => {
    const id = row.ReasonID;
    if (typeof id !== "string" || !/^\d{1,10}$/.test(id) || seen.has(id)) throw new WorkflowError("reference_source_unverified", 502);
    seen.add(id);
    const text = (key: string) => { const result = key ? row[key] : null; if (result != null && (typeof result !== "string" || result.length > 2000)) throw new WorkflowError("reference_source_unverified", 502); return result ?? null; };
    return { id, label: text("Reason"), description: text("ReasonDescription"), status: text(specification.status), noteRequired: text(specification.note), minimumNoteCharacters: text(specification.minimum), isDefault: text("IsDefault") };
  });
  return { ok: true, catalog, operation: specification.operation, source: "hhaexchange", scope: "agency_reference", officeContext,
    fetchedAt: source.fetchedAt, truncated: source.truncated, applicability: "not_verified_for_selected_visit", supportsConfirmation: false, items };
}
