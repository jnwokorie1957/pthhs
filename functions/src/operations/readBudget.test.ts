import assert from "node:assert/strict";
import test from "node:test";
import { readReservation } from "./readBudget.js";
import { WorkflowError } from "./reads.js";
const now = Date.parse("2026-11-05T18:30:25.000Z"), minute = Math.floor(now / 60000);
test("background feeds leave ten existing slots for interactive reads without increasing the total", () => {
  let state = { minute, count: 0, nextAllowedAt: 0 };
  for (let index = 0; index < 50; index++) state = readReservation(state, now, "background");
  assert.throws(() => readReservation(state, now, "background"), error => error instanceof WorkflowError && error.code === "background_read_budget_reserved" && error.retryAfterSeconds === 35);
  for (let index = 0; index < 10; index++) state = readReservation(state, now);
  for (const lane of ["background", "interactive"] as const) assert.throws(() => readReservation(state, now, lane), /read_budget_exhausted_retry_next_minute/);
  assert.equal(state.count, 60);
});
test("interactive calls consume the same counter and reduce available collector work", () => {
  let state = { minute, count: 12, nextAllowedAt: 0 };
  for (let index = 0; index < 38; index++) state = readReservation(state, now, "background");
  assert.equal(state.count, 50); assert.throws(() => readReservation(state, now, "background"), /background_read_budget_reserved/);
  assert.equal(readReservation(state, now, "interactive").count, 51);
});
test("vendor backoff still blocks both lanes, including a new minute", () => {
  for (const lane of ["background", "interactive"] as const) assert.throws(() => readReservation({ minute: minute - 1, count: 1, nextAllowedAt: now + 22000 }, now, lane), error => error instanceof WorkflowError && error.code === "vendor_backoff_active" && error.retryAfterSeconds === 22);
});
test("minute rollover restores capacity while retaining an expired vendor receipt", () => {
  assert.deepEqual(readReservation({ minute: minute - 1, count: 60, nextAllowedAt: now - 1 }, now, "background"), { minute, count: 1, nextAllowedAt: now - 1 });
  assert.equal(readReservation(undefined, now).count, 1);
});
test("corrupt counters and invalid vendor receipts fail closed", () => {
  for (const count of [NaN, -1, 61, 1.5]) assert.throws(() => readReservation({ minute, count }, now), /read_budget_state_invalid/);
  assert.throws(() => readReservation({ nextAllowedAt: "invalid" }, now), /read_budget_state_invalid/);
});
