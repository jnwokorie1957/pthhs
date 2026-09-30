import type { Schedule, Visit } from "../domain/models.js";
import type { EvvObservation } from "../rules/evv.js";

export interface ScheduleVisitComparison {
  scheduleId: string;
  visitId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  startVarianceMinutes?: number;
  endVarianceMinutes?: number;
  durationVarianceMinutes?: number;
  observation: EvvObservation;
}

function parse(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : undefined;
}

export function compareScheduleToVisit(
  schedule: Schedule,
  visit: Visit | null,
): ScheduleVisitComparison {
  const scheduledStart = parse(schedule.scheduledStart);
  const scheduledEnd = parse(schedule.scheduledEnd);

  if (scheduledStart === undefined || scheduledEnd === undefined) {
    throw new Error("Schedule comparison requires parseable scheduled timestamps.");
  }

  const actualStart = parse(visit?.actualStart);
  const actualEnd = parse(visit?.actualEnd);
  const scheduledDuration = scheduledEnd - scheduledStart;

  const startVarianceMinutes =
    actualStart === undefined
      ? undefined
      : (actualStart - scheduledStart) / 60_000;
  const endVarianceMinutes =
    actualEnd === undefined
      ? undefined
      : (actualEnd - scheduledEnd) / 60_000;
  const durationVarianceMinutes =
    actualStart === undefined || actualEnd === undefined
      ? undefined
      : ((actualEnd - actualStart) - scheduledDuration) / 60_000;

  const observation: EvvObservation = {
    ...(visit?.id ? { visitId: visit.id } : {}),
    scheduleId: schedule.id,
    scheduledStart: schedule.scheduledStart,
    scheduledEnd: schedule.scheduledEnd,
    ...clockEvidence(visit),
    ...(visit?.confirmation
      ? { confirmed: visit.confirmation.confirmed }
      : {}),
  };

  return {
    scheduleId: schedule.id,
    ...(visit?.id ? { visitId: visit.id } : {}),
    scheduledStart: schedule.scheduledStart,
    scheduledEnd: schedule.scheduledEnd,
    ...(visit?.actualStart ? { actualStart: visit.actualStart } : {}),
    ...(visit?.actualEnd ? { actualEnd: visit.actualEnd } : {}),
    ...(startVarianceMinutes !== undefined ? { startVarianceMinutes } : {}),
    ...(endVarianceMinutes !== undefined ? { endVarianceMinutes } : {}),
    ...(durationVarianceMinutes !== undefined ? { durationVarianceMinutes } : {}),
    observation,
  };
}

// Reported/manual visit times are not proof that an EVV call occurred. Reject
// ambiguous or malformed evidence rather than silently choosing a clock event.
function clockEvidence(visit: Visit | null): Pick<EvvObservation, "clockIn" | "clockOut"> {
  const result: Pick<EvvObservation, "clockIn" | "clockOut"> = {};
  for (const [type, field] of [["clock_in", "clockIn"], ["clock_out", "clockOut"]] as const) {
    const events = visit?.clockEvents.filter(event => event.type === type && event.visitId === visit.id) ?? [];
    if (events.length > 1 || events.some(event => parse(event.occurredAt) === undefined)) {
      throw new Error("ambiguous_or_invalid_clock_evidence");
    }
    if (events[0]) result[field] = events[0].occurredAt;
  }
  return result;
}
