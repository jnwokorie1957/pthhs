import assert from "node:assert/strict";
import test from "node:test";
import { advanceMonitorWindow, chooseMonitorWindow, resetMonitorWindow, type MonitorPlanState, type MonitorWindowPlan } from "./monitorPlan.js";

const today = "2026-10-11", discovery = "a".repeat(64), changed = "b".repeat(64);
const state = (overrides: Partial<MonitorPlanState> = {}): MonitorPlanState => ({ currentDate: today, currentOffset: 0, currentDiscovery: null, backfillDayOffset: 1, backfillOffset: 0, backfillDiscovery: null, turn: 0, ...overrides });

test("today owns three of every four windows with independent cursors", () => {
  let checkpoint: MonitorPlanState | null = null;
  const windows: MonitorWindowPlan[] = [];
  for (let run = 0; run < 12; run++) {
    const plan = chooseMonitorWindow(checkpoint, today); windows.push(plan);
    checkpoint = advanceMonitorWindow(plan, { nextOffset: plan.offset + 10, discovery });
  }
  assert.deepEqual(windows.map(plan => plan.kind), ["current", "current", "current", "backfill", "current", "current", "current", "backfill", "current", "current", "current", "backfill"]);
  assert.deepEqual(windows.filter(plan => plan.kind === "current").map(plan => plan.offset), [0, 10, 20, 30, 40, 50, 60, 70, 80]);
  assert.deepEqual(windows.filter(plan => plan.kind === "backfill").map(plan => plan.offset), [0, 10, 20]);
  assert.ok(windows.filter(plan => plan.kind === "backfill").every(plan => plan.date === "2026-10-10"));
});

test("all 200 current visits are covered once within 26 runs and the next band restarts today", () => {
  let checkpoint: MonitorPlanState | null = null;
  const covered: number[] = []; let runs = 0, currentWindows = 0;
  while (currentWindows < 20) {
    const plan = chooseMonitorWindow(checkpoint, today); runs += 1;
    if (plan.kind === "current") { currentWindows += 1; covered.push(...Array.from({ length: 10 }, (_, index) => plan.offset + index)); }
    checkpoint = advanceMonitorWindow(plan, { nextOffset: plan.offset + 10 < 200 ? plan.offset + 10 : null, discovery });
  }
  assert.equal(runs, 26); assert.deepEqual(covered, Array.from({ length: 200 }, (_, index) => index));
  assert.equal(checkpoint!.currentOffset, 0); assert.equal(checkpoint!.currentDiscovery, null);
  assert.equal(chooseMonitorWindow(checkpoint, today).offset, 0);
  assert.equal(chooseMonitorWindow(checkpoint, today).kind, "current");
});

test("completed historical windows rotate through the previous six days without starving today", () => {
  let checkpoint: MonitorPlanState | null = null;
  const currentRuns: number[] = [], history: string[] = [];
  for (let run = 0; run < 28; run++) {
    const plan = chooseMonitorWindow(checkpoint, today);
    if (plan.kind === "current") currentRuns.push(run); else history.push(plan.date);
    checkpoint = advanceMonitorWindow(plan, { nextOffset: null, discovery });
  }
  assert.deepEqual(history, ["2026-10-10", "2026-10-09", "2026-10-08", "2026-10-07", "2026-10-06", "2026-10-05", "2026-10-10"]);
  assert.equal(currentRuns.length, 21);
  assert.ok(currentRuns.slice(1).every((run, index) => run - currentRuns[index]! <= 2));
});

test("long backfill pages preserve their day and current progress", () => {
  const prior = state({ turn: 3, currentOffset: 190, currentDiscovery: discovery, backfillDayOffset: 6, backfillOffset: 40, backfillDiscovery: discovery });
  const plan = chooseMonitorWindow(prior, today), next = advanceMonitorWindow(plan, { nextOffset: 50, discovery });
  assert.equal(plan.date, "2026-10-05"); assert.equal(next.backfillDayOffset, 6); assert.equal(next.backfillOffset, 50); assert.equal(next.currentOffset, 190);
  assert.equal(next.currentDiscovery, discovery); assert.equal(next.turn, 0); assert.deepEqual(prior, state({ turn: 3, currentOffset: 190, currentDiscovery: discovery, backfillDayOffset: 6, backfillOffset: 40, backfillDiscovery: discovery }));
});

test("partial attempted prefixes advance only their own window and retain the next deferred visit", () => {
  const initial = chooseMonitorWindow(null, today), first = advanceMonitorWindow(initial, { nextOffset: 1, discovery });
  assert.equal(first.currentOffset, 1); assert.equal(first.currentDiscovery, discovery); assert.equal(first.turn, 1);
  const retry = chooseMonitorWindow(first, today), next = advanceMonitorWindow(retry, { nextOffset: 3, discovery });
  assert.equal(retry.offset, 1); assert.equal(next.currentOffset, 3);
  const historical = chooseMonitorWindow({ ...next, turn: 3, backfillOffset: 40, backfillDiscovery: discovery }, today);
  const partial = advanceMonitorWindow(historical, { nextOffset: 41, discovery });
  assert.equal(partial.backfillOffset, 41); assert.equal(partial.backfillDayOffset, 1); assert.equal(partial.currentOffset, 3); assert.equal(partial.turn, 0);
});

test("a successful page cannot claim zero progress at a nonzero cursor", () => {
  const prior = state({ currentOffset: 10, currentDiscovery: discovery }), plan = chooseMonitorWindow(prior, today);
  assert.throws(() => advanceMonitorWindow(plan, { nextOffset: 10, discovery }), /invalid_monitor_page_result/);
  assert.deepEqual(prior, state({ currentOffset: 10, currentDiscovery: discovery }));
});

test("changed current discovery restarts only today and changed backfill cannot monopolize runs", () => {
  const prior = state({ currentOffset: 90, currentDiscovery: discovery, backfillDayOffset: 4, backfillOffset: 30, backfillDiscovery: changed, turn: 2 });
  const next = resetMonitorWindow(chooseMonitorWindow(prior, today));
  assert.equal(next.currentOffset, 0); assert.equal(next.currentDiscovery, null); assert.equal(next.backfillOffset, 30); assert.equal(next.backfillDiscovery, changed); assert.equal(next.turn, 3);
  const reset = resetMonitorWindow(chooseMonitorWindow(next, today));
  assert.equal(reset.backfillOffset, 0); assert.equal(reset.backfillDiscovery, null); assert.equal(reset.backfillDayOffset, 4); assert.equal(reset.turn, 0);
  assert.equal(chooseMonitorWindow(reset, today).kind, "current");
});

test("discovery fingerprint changes require an explicit restart before accepting new offsets", () => {
  const plan = chooseMonitorWindow(state({ currentOffset: 10, currentDiscovery: discovery }), today);
  assert.throws(() => advanceMonitorWindow(plan, { nextOffset: 20, discovery: changed }), /revision_discovery_changed_restart/);
  const reset = resetMonitorWindow(plan), restarted = chooseMonitorWindow(reset, today);
  assert.equal(restarted.offset, 0); assert.equal(restarted.discovery, null);
  assert.equal(advanceMonitorWindow(restarted, { nextOffset: 10, discovery: changed }).currentDiscovery, changed);
});

test("office-date rollover resets both cursor scopes, retains backfill day and starts today first", () => {
  const prior = state({ turn: 3, currentOffset: 190, currentDiscovery: discovery, backfillDayOffset: 6, backfillOffset: 70, backfillDiscovery: changed });
  const plan = chooseMonitorWindow(prior, "2026-10-12");
  assert.deepEqual(plan.state, state({ currentDate: "2026-10-12", backfillDayOffset: 6 }));
  assert.equal(plan.date, "2026-10-12"); assert.equal(plan.kind, "current"); assert.equal(plan.offset, 0);
  const backfill = chooseMonitorWindow({ ...plan.state, turn: 3 }, "2026-10-12"); assert.equal(backfill.date, "2026-10-06");
});

test("calendar backfill crosses leap days, month ends, years and daylight-saving boundaries", () => {
  for (const [date, offset, expected] of [["2024-03-01", 1, "2024-02-29"], ["2023-03-01", 1, "2023-02-28"], ["2026-01-01", 6, "2025-12-26"], ["2026-03-09", 1, "2026-03-08"], ["2026-11-02", 1, "2026-11-01"]] as const) {
    const plan = chooseMonitorWindow(state({ currentDate: date, backfillDayOffset: offset, turn: 3 }), date);
    assert.equal(plan.date, expected);
  }
});

test("state, calendars and cursors reject invalid or inherited scope fields", () => {
  for (const date of ["2023-02-29", "2026-02-30", "2026-13-01", "2026-10-11T12:00:00Z", "0000-01-01"]) assert.throws(() => chooseMonitorWindow(null, date));
  for (const edit of [{ currentOffset: 200 }, { currentOffset: -1 }, { currentOffset: 1.5 }, { currentOffset: 10, currentDiscovery: null }, { currentOffset: 0, currentDiscovery: discovery },
    { backfillOffset: 200 }, { backfillDayOffset: 0 }, { backfillDayOffset: 7 }, { turn: 4 }, { currentDiscovery: "not-a-hash" }, { unexpected: true }]) assert.throws(() => chooseMonitorWindow({ ...state(), ...edit } as MonitorPlanState, today));
  const inherited = Object.create(state()) as MonitorPlanState; assert.throws(() => chooseMonitorWindow(inherited, today));
});

test("next offsets are bounded to ten reads and 0..199 and forged plans are rejected", () => {
  const plan = chooseMonitorWindow(null, today);
  for (const offset of [0, -1, 1.5, 11, 200, Number.NaN]) assert.throws(() => advanceMonitorWindow(plan, { nextOffset: offset, discovery }));
  assert.throws(() => advanceMonitorWindow(plan, { nextOffset: 10, discovery: "invalid" }));
  const edge = chooseMonitorWindow(state({ currentOffset: 199, currentDiscovery: discovery }), today);
  assert.equal(advanceMonitorWindow(edge, { nextOffset: null, discovery }).currentOffset, 0);
  assert.throws(() => resetMonitorWindow({ ...plan, date: "2026-10-10" }));
  assert.throws(() => resetMonitorWindow({ ...plan, kind: "backfill" }));
  assert.throws(() => resetMonitorWindow({ ...plan, offset: 10 }));
});
