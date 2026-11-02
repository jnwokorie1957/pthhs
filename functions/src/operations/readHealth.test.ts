import test from "node:test";
import assert from "node:assert/strict";
import { mergeReadHealth, readHealthView, readFailureOutcome, type ReadHealthEvent } from "./readHealth.js";
import { WorkflowError } from "./reads.js";
const base: ReadHealthEvent = { operation: "SearchBilledVisits", settingsRevision: 8, officeId: "12", checkedAt: "2026-11-02T19:00:00.000Z", outcome: "empty", records: 0, truncated: false };
test("read receipts preserve honest empty, one-response coverage and last success across failures", () => {
  const empty = mergeReadHealth(null, base)!;
  assert.deepEqual(readHealthView(base.operation, 8, "12", empty), { operation: base.operation, outcome: "empty", checkedAt: base.checkedAt, lastSuccessAt: base.checkedAt, records: 0, truncated: false });
  const success = mergeReadHealth(empty, { ...base, checkedAt: "2026-11-02T19:01:00.000Z", outcome: "success", records: 200, truncated: true })!;
  const failed = mergeReadHealth(success, { ...base, checkedAt: "2026-11-02T19:02:00.000Z", outcome: "vendor_wait", records: null, truncated: null })!;
  assert.equal(failed.outcome, "vendor_wait"); assert.deepEqual(failed.lastSuccess, success.lastSuccess);
  assert.equal(readHealthView(base.operation, 8, "12", failed).truncated, true);
  assert.equal(mergeReadHealth(failed, base), null);
});
test("health views fence old preferences and malformed metadata; reducers never retain private extras", () => {
  const privateFields = { patientId: "private-synthetic-marker", xml: "private-synthetic-marker", error: "private-synthetic-marker" };
  const stored = mergeReadHealth(null, Object.assign({ ...base }, privateFields))!;
  assert.equal(JSON.stringify(stored).includes("private-synthetic-marker"), false);
  for (const [revision, office] of [[9, "12"], [8, "99"]] as const) {
    const view = readHealthView(base.operation, revision, office, stored);
    assert.equal(view.outcome, "unobserved"); assert.equal(view.lastSuccessAt, null); assert.equal(view.records, null);
  }
  const changed = mergeReadHealth(stored, { ...base, settingsRevision: 9, outcome: "failed", records: null, truncated: null });
  assert.equal(changed?.lastSuccess, null);
  const malformed = readHealthView(base.operation, 8, "12", { ...stored, checkedAt: "private-synthetic-marker" });
  assert.equal(malformed.outcome, "metadata_unverified"); assert.equal(malformed.records, null);
  assert.equal(JSON.stringify(malformed).includes("private-synthetic-marker"), false);
  for (const delta of [{ outcome: "success", records: 0 }, { records: -1 }, { records: 1_000_001 }, { checkedAt: "bad" }, { officeId: "0" }]) assert.throws(() => mergeReadHealth(null, { ...base, ...delta } as ReadHealthEvent), /invalid_read_health_metadata/);
});
test("read-health failures distinguish admission and vendor waits without storing arbitrary messages", () => {
  assert.equal(readFailureOutcome(new WorkflowError("read_budget_exhausted_retry_next_minute", 429)), "local_wait");
  assert.equal(readFailureOutcome(new WorkflowError("vendor_backoff_active", 429)), "vendor_wait");
  assert.equal(readFailureOutcome(new WorkflowError("office_policy_changed_restart", 409)), "scope_changed");
  assert.equal(readFailureOutcome(new WorkflowError("private-synthetic-marker", 403)), "scope_refused");
  assert.equal(readFailureOutcome(Error("private-synthetic-marker")), "failed");
});
