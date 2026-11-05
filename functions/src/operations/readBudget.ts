import { WorkflowError } from "./reads.js";
export type ReadLane = "interactive" | "background";
/** One unchanged 60-call/minute guard; collectors leave ten slots for operators. */
export function readReservation(prior: { minute?: unknown; count?: unknown; nextAllowedAt?: unknown } | undefined, now: number, lane: ReadLane = "interactive") {
  const minute = Math.floor(now / 60000), nextAllowedAt = Number(prior?.nextAllowedAt ?? 0);
  if (!Number.isFinite(nextAllowedAt)) throw new WorkflowError("read_budget_state_invalid", 503);
  if (nextAllowedAt > now) throw new WorkflowError("vendor_backoff_active", 429, Math.ceil((nextAllowedAt - now) / 1000));
  const count = prior?.minute === minute ? Number(prior.count) : 0;
  if (!Number.isSafeInteger(count) || count < 0 || count > 60) throw new WorkflowError("read_budget_state_invalid", 503);
  const remainingSeconds = 60 - Math.floor(now / 1000) % 60;
  if (count >= 60) throw new WorkflowError("read_budget_exhausted_retry_next_minute", 429, remainingSeconds);
  if (lane === "background" && count >= 50) throw new WorkflowError("background_read_budget_reserved", 429, remainingSeconds);
  return { minute, count: count + 1, nextAllowedAt };
}
