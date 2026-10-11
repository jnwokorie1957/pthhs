import assert from "node:assert/strict";
import test from "node:test";
import type { OperationalRead } from "../operations/reads.js";
import { adaptVisitEvidence, type NormalizedVisitEvidence } from "./evidence.js";
import { buildTokenGroups } from "./tokenGroups.js";
import { notificationKey } from "./notifications.js";

const now = "2026-10-11T12:20:00-05:00";
function token(visitId: string, serviceDate = "2026-10-10", options: {
  officeId?: string; caregiverId?: string; revision?: number; timezone?: string;
  fields?: Record<string, string | null>;
} = {}): NormalizedVisitEvidence {
  const scope = { officeId: options.officeId ?? "123", date: serviceDate, timezone: options.timezone ?? "America/Chicago", revision: options.revision ?? 3 };
  const source: OperationalRead = {
    operation: "GetVisitInfoV3", source: "hhaexchange", fetchedAt: now,
    validation: "source_unvalidated", timezone: "source_values_unconverted", truncated: false,
    records: [{ ID: visitId, VisitDate: serviceDate, "Patient/ID": "5", "Caregiver/ID": options.caregiverId ?? "6",
      ScheduleStartTime: serviceDate + "T08:00:00-05:00", ScheduleEndTime: serviceDate + "T12:00:00-05:00",
      VisitStartTime: null, VisitEndTime: null, EVVStartTime: null, EVVEndTime: null, ...options.fields }],
  };
  return adaptVisitEvidence(source, {
    scope, visitId, now, clockingMethod: "token", scheduleType: "fixed",
    acceptance: { operation: "GetVisitInfoV3", version: "synthetic-acceptance", accepted: true, complete: true, scope,
      visitIds: [visitId], maxAgeSeconds: 300, missingEvvMeansAbsent: true, serviceTimeBasis: "actual" },
  });
}

test("a caregiver token reminder counts distinct dates and unique visits rather than missing punches", () => {
  const first = token("77"), second = token("78"), previous = token("79", "2026-10-09");
  const result = buildTokenGroups([second, first, previous, first], now), group = result.groups[0]!;
  assert.deepEqual(group.serviceDates, ["2026-10-09", "2026-10-10"]);
  assert.deepEqual(group.visits, [{ visitId: "79", date: "2026-10-09" }, { visitId: "77", date: "2026-10-10" }, { visitId: "78", date: "2026-10-10" }]);
  assert.equal(group.missingDayCount, 2); assert.equal(group.visitCount, 3); assert.equal(group.totalVisitCount, 3);
  assert.equal(group.coverage, "accepted_input_only"); assert.equal(group.complete, false); assert.equal(group.truncated, false);
  assert.equal(result.complete, false); assert.equal(result.coverage, "accepted_input_only");
});

test("office, caregiver, accepted revision and timezone remain separate", () => {
  const result = buildTokenGroups([token("77"), token("78", "2026-10-10", { officeId: "124" }),
    token("79", "2026-10-10", { caregiverId: "7" }), token("80", "2026-10-10", { revision: 4 }),
    token("81", "2026-10-10", { timezone: "America/New_York" })], now);
  assert.equal(result.groups.length, 5);
  assert.equal(result.groups.filter(group => group.officeId === "123" && group.caregiverId === "6").length, 3);
  assert.ok(result.groups.every(group => group.visits.length === 1));
  assert.notEqual(result.groups.find(group => group.officeId === "124")!.occurrenceId, result.groups[0]!.occurrenceId);
  assert.notEqual(result.groups.find(group => group.caregiverId === "7")!.occurrenceId, result.groups[0]!.occurrenceId);
});

test("unavailable, unaccepted, stale or unknown-method evidence cannot make token reminders", () => {
  const evidence = token("77");
  for (const state of ["unavailable", "unaccepted", "stale", "incomplete", "failed"] as const) {
    const result = buildTokenGroups([{ ...evidence, state }], now);
    assert.equal(result.groups.length, 0); assert.deepEqual(result.excluded, [{ visitId: "77", reason: "evidence_not_ready" }]);
  }
  assert.equal(buildTokenGroups([evidence], "2026-10-11T12:25:00.001-05:00").groups.length, 0);
  assert.equal(buildTokenGroups([{ ...evidence, clockingMethod: "unknown" }], now).groups.length, 0);
  assert.equal(buildTokenGroups([{ ...evidence, caregiverId: null }], now).groups.length, 0);
});

test("future service events and completely recorded token visits are excluded from missing-day counts", () => {
  const future = token("77", "2026-10-12");
  const complete = token("78", "2026-10-10", { fields: { EVVStartTime: "2026-10-10T08:00:00-05:00", EVVEndTime: "2026-10-10T12:00:00-05:00" } });
  assert.equal(buildTokenGroups([future, complete], now).groups.length, 0);
});

test("the first missing date keeps the occurrence stable as missing-event kinds and later visits change", () => {
  const missingBoth = token("77", "2026-10-09"), missingEnd = token("77", "2026-10-09", { fields: { EVVStartTime: "2026-10-09T08:00:00-05:00" } });
  const first = buildTokenGroups([missingBoth], now).groups[0]!;
  const second = buildTokenGroups([token("78"), missingEnd], now).groups[0]!;
  assert.equal(first.occurrenceId, second.occurrenceId); assert.match(first.occurrenceId, /^[a-f0-9]{64}$/);
  assert.equal(first.firstMissingDate, "2026-10-09");
  assert.notEqual(first.occurrenceId, buildTokenGroups([token("77")], now).groups[0]!.occurrenceId);
  assert.match(notificationKey(first.officeId, { rule: "missing_token_days", visitId: first.visits[0]!.visitId,
    occurrenceId: first.occurrenceId, recipientRef: "caregiver_" + first.caregiverId }), /^[a-f0-9]{64}$/);
});

test("ten-visit cap keeps reminder dates and counts within the evidence window that can be rechecked", () => {
  const visits = Array.from({ length: 12 }, (_, index) => token(String(100 + index), index < 10 ? "2026-10-09" : "2026-10-10"));
  const group = buildTokenGroups(visits, now).groups[0]!;
  assert.equal(group.visits.length, 10); assert.equal(group.visitCount, 10); assert.equal(group.totalVisitCount, 12);
  assert.equal(group.truncated, true); assert.equal(group.complete, false);
  assert.deepEqual(group.serviceDates, ["2026-10-09"]); assert.equal(group.missingDayCount, 1); assert.equal(group.totalMissingDayCount, 2);
  assert.ok(group.visits.every(visit => group.serviceDates.includes(visit.date)));
});

test("bounded windows and occurrence IDs are deterministic regardless of input order", () => {
  const visits = Array.from({ length: 12 }, (_, index) => token(String(100 + index), "2026-10-" + String(9 + index % 3).padStart(2, "0")));
  assert.deepEqual(buildTokenGroups(visits, now), buildTokenGroups([...visits].reverse(), now));
  assert.deepEqual(buildTokenGroups([], now), { groups: [], excluded: [], coverage: "accepted_input_only", complete: false });
});
