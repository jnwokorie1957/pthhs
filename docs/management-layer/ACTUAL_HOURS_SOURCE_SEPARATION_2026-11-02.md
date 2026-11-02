# Actual-hour source separation — November 2 UTC

This follows the November 1, 23:40 UTC heartbeat. The original source comparison
occurred November 1 at 23:56:24 UTC. Production acceptance continued November 2
UTC while the office date remained November 1 in America/Chicago.

## Verified historical evidence

A fresh October 24 API page returned 10 readable details and three missing
original EVV ends. One affected visit with supplied recorded endpoints was
selected. Its exact VisitID, patient, caregiver and day matched the original HHA
Calendar and Visit Info; Calendar office matched API scope. An independent
approved GetVisitInfoV3 read matched Bill Time In/Out and EVV Clock In as written,
without timezone conversion. Original EVV-out text was empty, and recorded/rounded
EVV duration displays were placeholders. One rendered EVV-row clock matched API
EVVStartTime; event direction was not adopted. API EVVEndTime, ActualHours and
ActualHoursRounded were unavailable. This establishes the inspected record/view;
complete retained history and the absence of every original event remain unproved.
The original screenshot case remains resolved by prior evidence.

The separate source tab used the already-rendered patient/Calendar route. Native
Calendar navigation was verified against the rendered October 24 date. The exact
V: link opened Schedule; no schedule/suggested values were edited. The blank Visit
Info modal's exact rendered NonskilledVisitInfo URL was opened directly and loaded.
No guessed endpoint, network/token access, source Save/Link/Copy action, role grant,
financial decision or web-scraped import occurred. Only nonsensitive evidence was
saved. The owned source tab was closed; the original user-held source tab stayed
untouched.

## Bounded display correction

GetVisitInfoV3/VisitInfo/ActualHours remains the raw HHA field. Previously Preview
and Review could display accepted calculated minutes or a written
VisitStartTime/VisitEndTime span in that field when ActualHours was absent. The
formatter now preserves missing, supplied-empty and explicit-zero source states.
ActualHoursRounded remains independent and never fills ActualHours.

A valid span appears beside the recorded clock pair, labelled "Recorded clock
span" and "written times". Existing same-offset/date validation and bounds remain;
no missing end/date or DST offset is guessed. A clock span does not establish
elapsed/worked duration, verification or payable/billable status. Unread details
and Demo do not acquire source calculations. Source fields, charts, diagnosis
metrics, server operations, permissions and persistence are unchanged. Schedule
presentation retains its separate contract.

## Validation and release

Three new regressions fail before and pass after: raw missing/empty/zero hours
versus accepted minutes; separate Preview cells; and Review list/detail separation.
Coverage includes missing/reversed/DST-offset pairs, no pay/EVV substitution and
no write. All 359 frontend/tooling and 46 analytics tests plus the full generator,
accessibility, performance and repository checks pass. Backend code is unchanged;
its suite was not repeated locally. The normal release retains backend tests.

Runtime 92c1468's first workflow, 41365232120, passed backend deployment but failed
Hosting's existing 420000-byte limit at 420468 bytes. No limit or control changed.
Removing 824 bytes of leading indentation from the first 120 static HTML lines,
outside pre/textarea/script/style contexts, preserved markup and functionality.
The corrected app/catalog is 419644 bytes; generated output is 11 files / 374695
bytes. The initial Windows child-generator encoding issue was corrected using
PYTHONUTF8=1; no encoding change or marketing semantic diff remains. A test's
source-fact assertion now excludes the separate fetch-age paragraph so a 10-hour
age cannot be mistaken for zero visit hours. All 359 checks pass.

Corrected runtime **372b2cfe3d6d5646894a68dee7f000727ad45c10**, reviewed tree
**1c9f9112d48889370989e864d0087db184aaf763**, passed standard workflow
[41380526324](https://github.com/jnwokorie1957/pthhs/actions/runs/41380526324):
Hosting 02:59:09 UTC, backend 02:59:20 UTC and analytics 03:00:50 UTC on November 2.
Public acceptance at 03:02:52 UTC matched all 12 deployed app assets, nine anonymous
JSON 401/no-store boundaries and private noindex protections.

## Authenticated production acceptance

At 03:04:21 UTC, October 24 Preview contained the exact source-compared visit and
matching patient/caregiver. Recorded endpoints were unchanged; HHA actual and
rounded hours remained "Not supplied by HHA". The written span appeared beside
the recorded pair, and the original EVV end remained unavailable.

At 03:11:52 UTC, Review list/detail matched the exact Visit reference and recorded
pair from GetVisitInfoV3, fetched at 03:05:35 UTC. Actual/rounded hours remained
missing with the span beside Recorded actual. The existing unaccepted
interpretation gate withheld patient/caregiver references; these were not treated
as mismatches or accepted diagnoses.

October 23 Preview at 03:13:03 UTC had 10 rows, nine recorded-pair spans, three
missing actual-hour fields and seven supplied field displays. No actual-hour cell
contained a calculated span. Current office day November 1 at 03:13:22 UTC had
10 rows, three recorded-pair spans, seven missing actual-hour fields and no span
in an actual-hour cell. The live receipt was fetched at 03:12:06 UTC. These are
bounded source-unvalidated pages, not a census, complete previews or accepted
operational facts. All inspected layouts had equal 1265px viewport/scroll widths.
Overview was restored with the current office day and live feed active.

P07's display/release acceptance is complete. P03/E04, retained date/status/filter
coverage and exact event-to-visit linkage remain open. No original punch was
recovered, source record changed, new permission requested or owner decision made.
Continue exact affected-record investigation when new source evidence supports
it; do not replay unchanged rejected/empty queries or substitute scheduled,
recorded, payable, billed or calculated time for missing source punches/hours.
