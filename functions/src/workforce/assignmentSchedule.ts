import {WorkforceError} from "./policy.js";
import type {PublicFields} from "./opportunities.js";

export interface WeeklySchedule {
  start: string;
  end: string;
  days: number[];
  from: string;
  to: string;
}

const calendarDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const clock = (value: unknown): value is string => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export function weeklySchedule(input: unknown, opening: PublicFields): WeeklySchedule {
  const fail = () => new WorkforceError(400, "invalid_assignment_schedule");
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => !["start","end","days","from","to"].includes(key))) throw fail();
  const {start,end,days,from,to} = input as WeeklySchedule;
  if (!calendarDate(start) || (end !== "" && (!calendarDate(end) || end < start)) ||
      !clock(from) || !clock(to) || to <= from || !Array.isArray(days) || !days.length || days.length > 7 ||
      new Set(days).size !== days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6) ||
      !days.includes(new Date(start).getUTCDay())) throw fail();
  if (days.some(d => opening.schedule === "weekdays" ? d === 0 || d === 6 : opening.schedule === "weekends" && d !== 0 && d !== 6)) throw fail();
  if ((minutes(to) - minutes(from)) * days.length !== Math.round(opening.weeklyHours * 60)) {
    throw new WorkforceError(400, "schedule_hours_mismatch");
  }
  return {start,end,days:[...days].sort((a,b)=>a-b),from,to};
}

export function schedulesOverlap(a: WeeklySchedule, b: WeeklySchedule) {
  if (a.to <= b.from || b.to <= a.from) return false;
  const start = a.start > b.start ? a.start : b.start;
  const end = [a.end,b.end].filter(Boolean).sort()[0];
  const first = new Date(start + "T12:00:00Z");
  return a.days.some(day => {
    if (!b.days.includes(day)) return false;
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + (day - first.getUTCDay() + 7) % 7);
    return !end || date.toISOString().slice(0,10) <= end;
  });
}
