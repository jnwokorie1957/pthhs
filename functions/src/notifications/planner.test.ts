import assert from "node:assert/strict";
import test from "node:test";
import { notificationsForEvaluation } from "./planner.js";
import type { EvvEvaluation } from "../rules/evv.js";

const evaluation: EvvEvaluation = {
  exceptions: [
    {
      exception: {
        id: "exception-1",
        visitId: "visit-1",
        type: "EVV_NO_CLOCK_OUT",
        ruleVersion: "test-v1",
        severity: "critical",
        createdAt: "2026-09-22T12:30:00-05:00",
        employeeVisible: false,
        managerVisible: true,
        reason: "Synthetic fixture",
      },
      audience: ["manager", "admin"],
      requiresHumanReview: true,
      automationEligible: false,
    },
  ],
  auditEvents: [],
};

test("notification planning is deterministic for deduplication", () => {
  const first = notificationsForEvaluation(
    evaluation,
    "2026-09-22T12:31:00-05:00",
  );
  const second = notificationsForEvaluation(
    evaluation,
    "2026-09-22T12:32:00-05:00",
  );

  assert.equal(first.length, 1);
  assert.equal(first[0]?.id, second[0]?.id);
  assert.deepEqual(first[0]?.audience, ["manager", "admin"]);
  assert.equal(first[0]?.deliveryStatus, "planned");
});
