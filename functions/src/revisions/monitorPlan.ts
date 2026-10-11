import { WorkflowError } from "../operations/reads.js";

export interface MonitorPlanState {
  currentDate: string;
  currentOffset: number;
  currentDiscovery: string | null;
  backfillDayOffset: 1 | 2 | 3 | 4 | 5 | 6;
  backfillOffset: number;
  backfillDiscovery: string | null;
  turn: 0 | 1 | 2 | 3;
}
export interface MonitorWindowPlan {
  date: string;
  offset: number;
  discovery: string | null;
  kind: "current" | "backfill";
  state: MonitorPlanState;
}
const STATE_FIELDS: readonly (keyof MonitorPlanState)[] = ["currentDate", "currentOffset", "currentDiscovery", "backfillDayOffset", "backfillOffset", "backfillDiscovery", "turn"];
const DAY_MS = 86_400_000;
function day(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000") || !Number.isFinite(Date.parse(value + "T00:00:00Z"))
    || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) throw new WorkflowError("invalid_monitor_date");
  return value;
}
function previousDay(today: string, days: number): string {
  // These are calendar dates, not office-local instants; UTC avoids DST drift.
  return day(new Date(Date.parse(today + "T00:00:00Z") - days * DAY_MS).toISOString().slice(0, 10));
}
function cursor(offset: unknown, discovery: unknown): void {
  if (!Number.isInteger(offset) || Number(offset) < 0 || Number(offset) > 199 || (discovery !== null && (typeof discovery !== "string" || !/^[a-f0-9]{64}$/.test(discovery)))
    || (offset === 0 ? discovery !== null : discovery === null)) throw new WorkflowError("invalid_monitor_cursor");
}
function checkedState(value: MonitorPlanState): MonitorPlanState {
  if (!value || typeof value !== "object" || Array.isArray(value) || Reflect.ownKeys(value).some(key => typeof key !== "string" || !STATE_FIELDS.includes(key as keyof MonitorPlanState))
    || STATE_FIELDS.some(key => !Object.hasOwn(value, key))) throw new WorkflowError("invalid_monitor_state");
  day(value.currentDate); cursor(value.currentOffset, value.currentDiscovery); cursor(value.backfillOffset, value.backfillDiscovery);
  if (!Number.isInteger(value.backfillDayOffset) || value.backfillDayOffset < 1 || value.backfillDayOffset > 6 || !Number.isInteger(value.turn) || value.turn < 0 || value.turn > 3) throw new WorkflowError("invalid_monitor_state");
  return { currentDate: value.currentDate, currentOffset: value.currentOffset, currentDiscovery: value.currentDiscovery,
    backfillDayOffset: value.backfillDayOffset, backfillOffset: value.backfillOffset, backfillDiscovery: value.backfillDiscovery, turn: value.turn };
}
function nextTurn(turn: MonitorPlanState["turn"]): MonitorPlanState["turn"] { return ((turn + 1) % 4) as MonitorPlanState["turn"]; }
function checkedPlan(plan: MonitorWindowPlan): MonitorPlanState {
  if (!plan || typeof plan !== "object") throw new WorkflowError("invalid_monitor_plan");
  const state = checkedState(plan.state), current = state.turn !== 3;
  if (plan.kind !== (current ? "current" : "backfill") || plan.date !== (current ? state.currentDate : previousDay(state.currentDate, state.backfillDayOffset))
    || plan.offset !== (current ? state.currentOffset : state.backfillOffset) || plan.discovery !== (current ? state.currentDiscovery : state.backfillDiscovery)) throw new WorkflowError("invalid_monitor_plan");
  return state;
}

/** Allocate three runs to today's independent cursor and one to historical backfill. */
export function chooseMonitorWindow(prior: MonitorPlanState | null, today: string): MonitorWindowPlan {
  day(today);
  let state: MonitorPlanState = prior === null ? { currentDate: today, currentOffset: 0, currentDiscovery: null, backfillDayOffset: 1, backfillOffset: 0, backfillDiscovery: null, turn: 0 } : checkedState(prior);
  if (state.currentDate !== today) state = { ...state, currentDate: today, currentOffset: 0, currentDiscovery: null, backfillOffset: 0, backfillDiscovery: null, turn: 0 };
  const current = state.turn !== 3;
  return { date: current ? today : previousDay(today, state.backfillDayOffset), offset: current ? state.currentOffset : state.backfillOffset,
    discovery: current ? state.currentDiscovery : state.backfillDiscovery, kind: current ? "current" : "backfill", state };
}

/** Advance a successful bounded read without moving the other window's cursor. */
export function advanceMonitorWindow(plan: MonitorWindowPlan, result: { nextOffset: number | null; discovery: string }): MonitorPlanState {
  const state = checkedPlan(plan);
  if (!result || typeof result !== "object" || typeof result.discovery !== "string" || !/^[a-f0-9]{64}$/.test(result.discovery)
    || result.nextOffset !== null && (!Number.isInteger(result.nextOffset) || result.nextOffset <= plan.offset || result.nextOffset > 199 || result.nextOffset > plan.offset + 10)) throw new WorkflowError("invalid_monitor_page_result");
  if (plan.offset > 0 && plan.discovery !== result.discovery) throw new WorkflowError("revision_discovery_changed_restart", 409);
  const next = { ...state, turn: nextTurn(state.turn) };
  if (plan.kind === "current") return { ...next, currentOffset: result.nextOffset ?? 0, currentDiscovery: result.nextOffset === null ? null : result.discovery };
  return { ...next, backfillOffset: result.nextOffset ?? 0, backfillDiscovery: result.nextOffset === null ? null : result.discovery,
    backfillDayOffset: result.nextOffset === null ? ((state.backfillDayOffset % 6) + 1) as MonitorPlanState["backfillDayOffset"] : state.backfillDayOffset };
}

/** A changed discovery restarts only its own cursor; rotate so a retry cannot monopolize runs. */
export function resetMonitorWindow(plan: MonitorWindowPlan): MonitorPlanState {
  const state = checkedPlan(plan), next = { ...state, turn: nextTurn(state.turn) };
  return plan.kind === "current" ? { ...next, currentOffset: 0, currentDiscovery: null } : { ...next, backfillOffset: 0, backfillDiscovery: null };
}
