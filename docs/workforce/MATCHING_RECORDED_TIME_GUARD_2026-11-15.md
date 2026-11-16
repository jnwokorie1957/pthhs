# Recorded visit clocks do not establish paid matching hours

Prepared November 16 UTC (November 15 America/Chicago), against
f5c03348d9fad973974af53d3ccc401331f776cc. Concurrent caregiver matching,
Forms, session and release-policy work is preserved.

The new matching adapter had converted a past VisitStartTime/VisitEndTime
interval into a complete contribution to its paid-week eligibility calculation.
Its original test explicitly treated that interval as actual work. That exceeds
what recorded clocks establish; neither a clock span nor a raw duration string
proves paid work, original EVV linkage or financial verification.

## Exact mapping and bounded correction

The existing approved operation remains GetVisitInfoV3. Its matching-only
projection reads GetVisitInfoV3Result/VisitInfo direct ID, Caregiver/ID,
ScheduleStartTime, ScheduleEndTime, VisitStartTime and VisitEndTime. It does not
read EVV punches/history, ActualHours, ActualHoursRounded or payroll/bill fields.
The normal administrator projection and optional clock/duration display remain
unchanged, including missing versus explicitly empty versus unavailable details.

Missing/unfinished recorded clocks retain the existing pending outcome. A
completed interval overlapping the selected Sunday weeks now throws
matching_paid_hours_unverified instead of returning complete paid-hour evidence.
This also covers an overnight boundary and ignores an unverified raw hour value.
A fully earlier-week interval remains outside the selected weeks; future
schedule commitments retain their planning behavior. No paid/worked/verified
status is assigned by this change. No substitute duration, extra read, automatic
retry, source mutation, permission, activation or sending setting is added.

The operator text now calls incomplete clocks recorded visit times and explains
the paid-hours review hold. Existing matching/Maps/SMS/public-opening gates stay
closed; this code does not send a notice or SMS, or assign a caregiver.

## Verification and release scope

Three new regressions fail against the previous adapter: completed clock pair,
raw-hour strings alongside the pair, and an overnight interval crossing into
the selected week. After the fix, all nine focused source tests pass, including
future schedule and fully earlier-week behavior. All 1,035 backend tests and
five frontend/runtime/reference tests pass. TypeScript compilation and
deterministic readable-source/runtime and asset-reference checks pass.
Normal PR quality and the existing compatible full release are pending.

Compatibility: no endpoint, request/response schema, stored record format,
permission or session contract changes. Existing callers already hold a
candidate when source checks throw; old pages use their existing error fallback.
There is no forced reload. Backend deployment is required; a manual
Hosting-only release would not deliver this guard. The reviewed release marker
follows the current staff-release policy and does not change its controls.

## Source comparison and remaining evidence

At approximately 02:40 UTC, fresh approved-profile Primetime still requires
administrator sign-in. October 23/24 and current office-day comparisons could
not be refreshed; no source field or time was recovered. The original October 24
screenshot case remains resolved by the independent October 31 reread.

Next owner/vendor action for this matching gate: establish the supported
paid-hours source and units, paid adjustments/non-visit treatment, exact
caregiver/office/week linkage and accepted validation/readback. Then implement
and test the separate interpretation contract before considering activation.
Do not clear the gate with a clock pair, checkbox, copied/scheduled hours or an
unvalidated ActualHours/payroll/billed field. P03/E04 original-event/history,
duration and preservation/readback requirements and the held-visit disposition
remain separate. Restore the approved Primetime administrator session to resume
the bounded historical/current-day API comparison after any displayed delay.

Local nonsensitive evidence: matching-hours-before-20261115.log,
matching-hours-after-20261115.log and matching-hours-backend-tests-20261115.log.
Deployment and production boundary evidence remain pending. No real source
record, matching dispatch, staff decision or communication was exercised.
