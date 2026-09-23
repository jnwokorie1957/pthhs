import { createHash, randomUUID } from "node:crypto";
import type {
  AuditEvent,
  NotificationAudience,
  VisitException,
  VisitExceptionType,
} from "../domain/models.js";

export interface EvvObservation {
  visitId?: string;
  scheduleId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  clockIn?: string;
  clockOut?: string;
  confirmed?: boolean;
}

export interface EvvRulePolicy {
  enabled: boolean;
  thresholdMinutes?: number;
  severity: VisitException["severity"];
  audience: NotificationAudience[];
  requiresHumanReview: boolean;
  automationEligible: boolean;
}

export interface EvvRuleSet {
  version: string;
  rules: Partial<Record<VisitExceptionType, EvvRulePolicy>>;
}

export interface EvaluatedException {
  exception: VisitException;
  audience: NotificationAudience[];
  requiresHumanReview: boolean;
  automationEligible: boolean;
}

export interface EvvEvaluation {
  exceptions: EvaluatedException[];
  auditEvents: AuditEvent[];
}

function minutes(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    throw new Error("EVV rule threshold must be a non-negative number.");
  }
  return value;
}

function time(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid EVV timestamp: " + field);
  }
  return parsed;
}

function deterministicExceptionId(
  type: VisitExceptionType,
  ruleVersion: string,
  visitId: string | undefined,
  scheduleId: string | undefined,
): string {
  return createHash("sha256")
    .update([type, ruleVersion, visitId ?? "", scheduleId ?? ""].join("\0"))
    .digest("hex");
}

function evaluateRule(
  type: VisitExceptionType,
  policy: EvvRulePolicy | undefined,
  condition: boolean,
  observation: EvvObservation,
  reason: string,
): EvaluatedException | null {
  if (!policy?.enabled || !condition) return null;

  const exception: VisitException = {
    id: deterministicExceptionId(
      type,
      reason.split(" | rule=")[1] ?? "unknown",
      observation.visitId,
      observation.scheduleId,
    ),
    ...(observation.visitId ? { visitId: observation.visitId } : {}),
    ...(observation.scheduleId ? { scheduleId: observation.scheduleId } : {}),
    type,
    ruleVersion: reason.split(" | rule=")[1] ?? "unknown",
    severity: policy.severity,
    createdAt: new Date().toISOString(),
    employeeVisible: policy.audience.includes("employee"),
    managerVisible:
      policy.audience.includes("manager") ||
      policy.audience.includes("admin") ||
      policy.audience.includes("owner"),
    reason: reason.split(" | rule=")[0] ?? reason,
  };

  return {
    exception,
    audience: [...policy.audience],
    requiresHumanReview: policy.requiresHumanReview,
    automationEligible: policy.automationEligible,
  };
}

export function evaluateEvvObservation(
  observation: EvvObservation,
  rules: EvvRuleSet,
  now = new Date(),
): EvvEvaluation {
  if (!rules.version.trim()) {
    throw new Error("EVV rule set requires a version.");
  }

  const scheduledStart = time(observation.scheduledStart, "scheduledStart");
  const scheduledEnd = time(observation.scheduledEnd, "scheduledEnd");
  const nowMs = now.getTime();
  const clockIn = observation.clockIn
    ? time(observation.clockIn, "clockIn")
    : undefined;
  const clockOut = observation.clockOut
    ? time(observation.clockOut, "clockOut")
    : undefined;

  const results: EvaluatedException[] = [];
  const add = (
    type: VisitExceptionType,
    condition: boolean,
    reason: string,
  ) => {
    const policy = rules.rules[type];
    const evaluated = evaluateRule(
      type,
      policy,
      condition,
      observation,
      reason + " | rule=" + rules.version,
    );
    if (evaluated) results.push(evaluated);
  };

  const missingClockIn = rules.rules.EVV_NO_CLOCK_IN;
  if (missingClockIn?.enabled) {
    const threshold = minutes(missingClockIn.thresholdMinutes);
    add(
      "EVV_NO_CLOCK_IN",
      clockIn === undefined && nowMs >= scheduledStart + threshold * 60_000,
      "No clock-in recorded after the configured grace period.",
    );
  }

  const lateClockIn = rules.rules.EVV_LATE_CLOCK_IN;
  if (lateClockIn?.enabled && clockIn !== undefined) {
    const threshold = minutes(lateClockIn.thresholdMinutes);
    add(
      "EVV_LATE_CLOCK_IN",
      clockIn > scheduledStart + threshold * 60_000,
      "Clock-in exceeds the configured start-time variance.",
    );
  }

  const missingClockOut = rules.rules.EVV_NO_CLOCK_OUT;
  if (missingClockOut?.enabled) {
    const threshold = minutes(missingClockOut.thresholdMinutes);
    add(
      "EVV_NO_CLOCK_OUT",
      clockOut === undefined && nowMs >= scheduledEnd + threshold * 60_000,
      "No clock-out recorded after the configured end-time grace period.",
    );
  }

  const earlyClockOut = rules.rules.EVV_EARLY_CLOCK_OUT;
  if (earlyClockOut?.enabled && clockOut !== undefined) {
    const threshold = minutes(earlyClockOut.thresholdMinutes);
    add(
      "EVV_EARLY_CLOCK_OUT",
      clockOut < scheduledEnd - threshold * 60_000,
      "Clock-out is earlier than the configured end-time variance.",
    );
  }

  if (clockIn !== undefined && clockOut !== undefined) {
    const scheduledDuration = scheduledEnd - scheduledStart;
    const actualDuration = clockOut - clockIn;

    const shortVisit = rules.rules.EVV_SHORT_VISIT;
    if (shortVisit?.enabled) {
      const threshold = minutes(shortVisit.thresholdMinutes);
      add(
        "EVV_SHORT_VISIT",
        actualDuration < scheduledDuration - threshold * 60_000,
        "Actual visit duration is shorter than the configured variance.",
      );
    }

    const longVisit = rules.rules.EVV_LONG_VISIT;
    if (longVisit?.enabled) {
      const threshold = minutes(longVisit.thresholdMinutes);
      add(
        "EVV_LONG_VISIT",
        actualDuration > scheduledDuration + threshold * 60_000,
        "Actual visit duration is longer than the configured variance.",
      );
    }
  }

  const unconfirmed = rules.rules.VISIT_UNCONFIRMED;
  if (unconfirmed?.enabled) {
    add(
      "VISIT_UNCONFIRMED",
      observation.confirmed === false && nowMs >= scheduledEnd,
      "Visit is not confirmed after the scheduled end.",
    );
  }

  const auditEvents: AuditEvent[] = results.map(({ exception, automationEligible, requiresHumanReview }) => ({
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    actorType: "system",
    action: "evv_rule_triggered",
    entityType: "visit_exception",
    entityId: exception.id,
    metadata: {
      ruleType: exception.type,
      ruleVersion: rules.version,
      severity: exception.severity,
      automationEligible,
      requiresHumanReview,
    },
  }));

  return { exceptions: results, auditEvents };
}
