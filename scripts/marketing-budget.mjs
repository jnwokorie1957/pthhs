import assert from 'node:assert/strict';

// Build-output safeguards, not Firebase storage quotas or billing settings.
// Allow a growing article archive while warning before its next capacity review.
export const MARKETING_BUDGET_BYTES = 5_000_000;
export const MARKETING_WARNING_BYTES = 4_000_000;

export function assessMarketingBudget(bytes) {
  assert(Number.isSafeInteger(bytes) && bytes >= 0, 'Expected a non-negative safe integer byte count');
  return {
    error: bytes > MARKETING_BUDGET_BYTES
      ? `marketing output exceeds 5 MB growth budget: ${bytes}` : null,
    warning: bytes >= MARKETING_WARNING_BYTES && bytes <= MARKETING_BUDGET_BYTES
      ? `marketing output is at or above the 4 MB review threshold: ${bytes}; optimize or review capacity before reaching 5 MB` : null,
  };
}
