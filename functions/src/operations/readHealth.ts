import { READ_OPERATIONS, WorkflowError, identifier, type ReadOperation } from "./reads.js";

export const READ_OUTCOMES = ["success", "empty", "local_wait", "vendor_wait", "scope_changed", "scope_refused", "invalid_request", "failed"] as const;
export type ReadOutcome = typeof READ_OUTCOMES[number];
export interface ReadHealthEvent {
  operation: ReadOperation; settingsRevision: number; officeId: string | null;
  checkedAt: string; outcome: ReadOutcome; records: number | null; truncated: boolean | null;
}
export interface ReadHealthReceipt extends ReadHealthEvent {
  lastSuccess: { checkedAt: string; records: number; truncated: boolean } | null;
}
function time(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function count(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000; }
function event(value: unknown): value is ReadHealthEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as ReadHealthEvent;
  try { if (row.officeId !== null) identifier(row.officeId); } catch { return false; }
  return READ_OPERATIONS.includes(row.operation) && Number.isSafeInteger(row.settingsRevision) && row.settingsRevision >= 0 && time(row.checkedAt)
    && READ_OUTCOMES.includes(row.outcome) && (["success", "empty"].includes(row.outcome)
      ? count(row.records) && typeof row.truncated === "boolean" && (row.outcome === "empty" ? row.records === 0 : row.records! > 0)
      : row.records === null && row.truncated === null);
}
function receipt(value: unknown): value is ReadHealthReceipt {
  if (!event(value)) return false;
  const row = value as ReadHealthReceipt, last = row.lastSuccess;
  if (last === null) return row.outcome !== "success" && row.outcome !== "empty";
  return !!last && time(last.checkedAt) && last.checkedAt <= row.checkedAt && count(last.records) && typeof last.truncated === "boolean"
    && (!["success", "empty"].includes(row.outcome) || last.checkedAt === row.checkedAt && last.records === row.records && last.truncated === row.truncated);
}
export function mergeReadHealth(prior: unknown, next: ReadHealthEvent): ReadHealthReceipt | null {
  if (!event(next)) throw new WorkflowError("invalid_read_health_metadata");
  const same = receipt(prior) && prior.operation === next.operation && prior.officeId === next.officeId && prior.settingsRevision === next.settingsRevision;
  if (same && prior.checkedAt > next.checkedAt) return null;
  const last = ["success", "empty"].includes(next.outcome)
    ? { checkedAt: next.checkedAt, records: next.records!, truncated: next.truncated! }
    : same && prior.lastSuccess ? { checkedAt: prior.lastSuccess.checkedAt, records: prior.lastSuccess.records, truncated: prior.lastSuccess.truncated } : null;
  // Construct a closed metadata shape: never retain source values, subjects,
  // filters, actor IDs, request/response bodies or arbitrary error strings.
  return { operation: next.operation, settingsRevision: next.settingsRevision, officeId: next.officeId, checkedAt: next.checkedAt,
    outcome: next.outcome, records: next.records, truncated: next.truncated, lastSuccess: last };
}
export function readHealthView(operation: ReadOperation, revision: number, officeId: string | null, stored: unknown) {
  const current = receipt(stored) && stored.operation === operation && stored.settingsRevision === revision && stored.officeId === officeId;
  const malformed = stored != null && !receipt(stored);
  return { operation, outcome: current ? stored.outcome : malformed ? "metadata_unverified" as const : "unobserved" as const,
    checkedAt: current ? stored.checkedAt : null, lastSuccessAt: current ? stored.lastSuccess?.checkedAt ?? null : null,
    records: current ? stored.lastSuccess?.records ?? null : null, truncated: current ? stored.lastSuccess?.truncated ?? null : null };
}
export function readHealthCells(row: Omit<ReturnType<typeof readHealthView>, "outcome"> & { outcome: ReturnType<typeof readHealthView>["outcome"] | "contract_blocked" }) {
  const labels = { success: "Returned records", empty: "Successful empty response", local_wait: "Local read limit", vendor_wait: "Vendor retry delay", scope_changed: "Preferences changed", scope_refused: "Scope refused", invalid_request: "Invalid request", failed: "Read failed", unobserved: "No current receipt", metadata_unverified: "Receipt unverified", contract_blocked: "Vendor contract blocked" };
  return [row.operation, labels[row.outcome] + (row.checkedAt ? " · " + row.checkedAt : ""), row.lastSuccessAt ?? "Not recorded",
    row.records === null ? "Unknown" : `${row.records} · ${row.truncated ? "truncated" : "no truncation flag"}`];
}
export function readFailureOutcome(error: unknown): ReadOutcome {
  if (!(error instanceof WorkflowError)) return "failed";
  if (error.code === "read_budget_exhausted_retry_next_minute" && error.status === 429) return "local_wait";
  if (error.code === "vendor_backoff_active" && error.status === 429) return "vendor_wait";
  if (error.code === "office_policy_changed_restart") return "scope_changed";
  if (error.status === 403) return "scope_refused";
  return error.status === 400 ? "invalid_request" : "failed";
}
