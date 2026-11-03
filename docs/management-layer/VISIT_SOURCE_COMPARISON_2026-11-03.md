# Historical and current visit-source follow-up

November3, 04:10UTC trigger. Baseline `2e85cc1`; runtime `84c26e5` is unchanged.
Required handoff/checklists were reviewed and upstream refreshed. This pass uses
the authorized Primetime session and existing approved API-backed controls. It
does not import HHA web content or change source records, permissions or code.

## Current bounded source evidence

The first ten source records were inspected for each selected office date:

| Office service day | Search receipt, November3 UTC | Readable details | Recorded start/end pairs | EVV start/end pairs | Explicit empty ActualHours / rounded |
| --- | --- | --- | --- | --- | --- |
| October23 | 04:15:35.294 | 10 / 10 | 10 | 8 | 2 / 2 |
| October24 | 04:17:10.043 | 10 / 10 | 10 | 7 | 3 / 3 |
| November2, current office day | 04:11:03.815 | 10 / 10 | 5 | 5 | 5 / 5 |

There were no unavailable detail rows or unknown-hour labels in these three
pages. The missing-hour cases rendered the existing explicit-empty HHA labels.
Thus those cases are distinguishable from deferred/failed detail reads and
omitted/unknown values. Populated pairs and hour text remain source evidence;
neither establishes a completed, verified, worked, payable or billable visit.

These are current first-page observations. Exact membership was not reconciled
against earlier page cohorts, so changed aggregate counts cannot demonstrate
that a particular missing clock or hour was recovered. Office totals and complete
history remain unproved. The original October24 screenshot's independently
resolved October31 case is not reopened by this follow-up.

## Exact mapping and current refusal

The existing search/detail pipeline remains SearchVisitsV2, GetVisitInfoV3 and
fresh GetPatientDemographics office proof. Recorded source clocks use direct
`VisitInfo/VisitStartTime` and `VisitInfo/VisitEndTime`; original EVV clocks use
`VisitInfo/EVVStartTime` and `VisitInfo/EVVEndTime`. The two independent source
duration fields remain `VisitInfo/ActualHours` and `VisitInfo/ActualHoursRounded`.
Preview labels distinguish explicit empty strings from missing/unknown values;
no local calculation fills either hour field. Written recorded-clock spans,
schedule-duration components and payroll/billing data remain separate evidence.
The accepted exact-scalar projection is documented in
[time-field projection](VISIT_TIME_FIELD_PROJECTION_2026-11-02.md).

One new affected November2 context, with readable detail, a missing end and empty
actual-hour text, was selected through the existing EVV action. Its approved
GetCallDashBoardData read returned the existing patient/caregiver-mismatch refusal.
No event table, accepted source receipt or call records were exposed. This is a
subject-proof refusal, not successful empty data or demonstrated quota/cooldown.
This UI result does not identify which raw subject field failed or establish the
same diagnostic subtype as an earlier refused case. It was not retried.

Within that read, the exact displayed visit/patient/caregiver identities and all
schedule, recorded, EVV and actual-hour cells matched before and after. The refusal
did not replace or alter any time field. Without a verified subject and supported
event-to-visit contract, raw calls cannot repair the original EVV end. No schedule,
suggested, payroll or billed value was substituted.

## Remaining action and restored state

P03/E04 stay open. Continue the existing protected HHA/vendor follow-up to establish
the retained call endpoint's exact Patient/ID, Caregiver/ID, day/filter/retention
behavior and supported visit linkage. Preserve the refusal until usable subject
proof is established. Do not silently discard foreign/ambiguous rows, accept a
request filter as response identity, or add an unapproved alternate source read.
The existing same-profile HHA tab handoff remains pending in the other goal; no
duplicate login, approval question or communication was sent here.

The original tab was restored to Overview, Live and office today. The automatic
feed is connected/running with receipt 04:18:04.108UTC; related record tables and
read-subject inputs are clear. No current source failure was induced to test retry.
No new runtime defect or mapping correction was proved, so no unchanged test suite
or deployment was repeated. Existing release controls and source-interpretation
gates remain intact.

Evidence: private `outputs/primetime-time-source-followup-2026-11-03-0410.json`
contains only bounded counts, timestamps and outcome flags. No private source
identifier, clock value, hour value, raw response or credential is persisted.
