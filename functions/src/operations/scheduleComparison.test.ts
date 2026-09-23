import assert from "node:assert/strict";
import test from "node:test";
import type { Schedule, Visit } from "../domain/models.js";
import { compareScheduleToVisit } from "./scheduleComparison.js";

const schedule: Schedule = {
  id: "schedule-1",
  externalReferences: [],
  patientId: "patient-1",
  scheduledStart: "2026-09-22T08:00:00-05:00",
  scheduledEnd: "2026-09-22T12:00:00-05:00",
  status: "scheduled",
};

test("computes schedule vs actual variances without applying policy", () => {
  const visit: Visit = {
    id: "visit-1",
    externalReferences: [],
    patientId: "patient-1",
    scheduleId: "schedule-1",
    actualStart: "2026-09-22T08:12:00-05:00",
    actualEnd: "2026-09-22T11:50:00-05:00",
    status: "imported_unvalidated",
    clockEvents: [],
  };

  const result = compareScheduleToVisit(schedule, visit);
  assert.equal(result.startVarianceMinutes, 12);
  assert.equal(result.endVarianceMinutes, -10);
  assert.equal(result.durationVarianceMinutes, -22);
  assert.equal(result.observation.scheduleId, "schedule-1");
});

test("supports a scheduled visit with no actual visit yet", () => {
  const result = compareScheduleToVisit(schedule, null);
  assert.equal(result.visitId, undefined);
  assert.equal(result.startVarianceMinutes, undefined);
});
