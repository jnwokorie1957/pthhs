import { createHash } from "node:crypto";
import { summarizeMissingTokenDays } from "./diagnosis.js";
import type { NormalizedVisitEvidence } from "./evidence.js";

export interface TokenGroupVisit { visitId: string; date: string; }
export interface TokenGroup {
  officeId: string;
  caregiverId: string;
  revision: number;
  timezone: string;
  serviceDates: readonly string[];
  visits: readonly TokenGroupVisit[];
  missingDayCount: number;
  visitCount: number;
  totalVisitCount: number;
  totalMissingDayCount: number;
  firstMissingDate: string;
  occurrenceId: string;
  coverage: "accepted_input_only";
  complete: false;
  truncated: boolean;
}
export interface TokenGroups {
  groups: readonly TokenGroup[];
  excluded: readonly { visitId: string; reason: string }[];
  coverage: "accepted_input_only";
  complete: false;
}

/** A bounded, server-evidence-only reminder window. Counts and dates refer to
 * the same visits the sender can recheck. Additional input is reported without
 * treating either this window or the supplied input as complete agency data.
 * An occurrence remains the same when a visit changes from two missing punches
 * to one, so the change does not create a second token reminder.
 */
export function buildTokenGroups(visits: readonly NormalizedVisitEvidence[], now: string): TokenGroups {
  const summary = summarizeMissingTokenDays(visits, now);
  const groups = summary.summaries.map((item): TokenGroup => {
    const allVisits = item.days.flatMap(day => day.visitIds.map(visitId => ({ visitId, date: day.date })));
    const selected = allVisits.slice(0, 10);
    const serviceDates = [...new Set(selected.map(visit => visit.date))];
    const firstMissingDate = item.days[0]!.date;
    const occurrenceId = createHash("sha256")
      .update(JSON.stringify(["token-missing-days-v1", item.officeId, item.caregiverId, firstMissingDate]))
      .digest("hex");
    return {
      officeId: item.officeId, caregiverId: item.caregiverId, revision: item.revision, timezone: item.timezone,
      serviceDates, visits: selected, missingDayCount: serviceDates.length, visitCount: selected.length,
      totalVisitCount: allVisits.length, totalMissingDayCount: item.missingDayCount,
      firstMissingDate, occurrenceId, coverage: "accepted_input_only", complete: false,
      truncated: selected.length !== allVisits.length,
    };
  });
  return { groups, excluded: summary.excluded, coverage: "accepted_input_only", complete: false };
}
