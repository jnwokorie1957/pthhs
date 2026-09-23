import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEvvObservation, type EvvRuleSet } from "./evv.js";

const syntheticRules: EvvRuleSet = {
  version: "synthetic-test-v1",
  rules: {
    EVV_LATE_CLOCK_IN: {
      enabled: true,
      thresholdMinutes: 15,
      severity: "warning",
      audience: ["manager"],
      requiresHumanReview: true,
      automationEligible: false,
    },
    EVV_NO_CLOCK_OUT: {
      enabled: true,
      thresholdMinutes: 10,
      severity: "critical",
      audience: ["manager", "admin"],
      requiresHumanReview: true,
      automationEligible: false,
    },
  },
};

test("evaluates configured thresholds without embedding production policy", () => {
  const result = evaluateEvvObservation(
    {
      visitId: "visit-test",
      scheduledStart: "2026-09-22T08:00:00-05:00",
      scheduledEnd: "2026-09-22T12:00:00-05:00",
      clockIn: "2026-09-22T08:20:00-05:00",
    },
    syntheticRules,
    new Date("2026-09-22T12:20:00-05:00"),
  );

  assert.deepEqual(
    result.exceptions.map((item) => item.exception.type).sort(),
    ["EVV_LATE_CLOCK_IN", "EVV_NO_CLOCK_OUT"],
  );
  assert.equal(result.auditEvents.length, 2);
  assert.equal(result.exceptions.every((item) => item.requiresHumanReview), true);
});

test("disabled rules never emit exceptions", () => {
  const result = evaluateEvvObservation(
    {
      scheduledStart: "2026-09-22T08:00:00-05:00",
      scheduledEnd: "2026-09-22T12:00:00-05:00",
    },
    { version: "disabled", rules: {} },
    new Date("2026-09-22T18:00:00-05:00"),
  );
  assert.equal(result.exceptions.length, 0);
});
