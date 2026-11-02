# Visit billed amount source connection — November 1

## Problem and resulting behavior

GetVisitInfoV3 already supplies BilledAmount through the verified visit-page DTO.
The browser's preview normalizer discarded billedAmount, and Billing & AR showed
only visit/patient references and an on-demand detailed-billing control. A live
historical source read confirmed a usable visit amount while the independently
requested GetVisitBillInfoV2 returned no record. An empty detailed response must
not hide a value actually supplied by the working visit source.

The normalizer now retains billedAmount under the same bounded nullable-string
validation as source duration fields. Billing & AR displays Visit billed amount
in place of the redundant source-detail status column. Failed details retain
their existing specific reason and admit no amount. Zero and decimal spelling
remain exact source strings; missing/empty values display Not supplied by HHA.
No currency, sum, rate, collection, adjudication, readiness or AR inference occurs.

The source label identifies GetVisitInfoV3 BilledAmount. The separate detailed
reader remains GetVisitBillInfoV2, with its own source result and identity/date/
office checks. Its empty state stays visible and does not become success through
a fallback. No API, permission, backend DTO, storage, source query or write was
added. Existing page receipts and Clear/date/Demo/session fences apply.

## Historical missing-time comparison

An October24 page had three rows with a missing end field among the eight rows
offering an exact call reader. One belongs to the patient already verified in
the authorized original HHA Calendar. Its exact rendered V: link and Visit Info
route match the fresh API visit/patient/caregiver/service date. Calendar office
and patient match the previously verified protected profile. Source identifiers,
clock values, amounts and names remain outside this record.

Original Bill Time In and Bill Time Out match fresh API VisitStartTime and
VisitEndTime by displayed written clock. API EVVEndTime is unavailable. The
original labeled EVV section has Clock In but no Clock Out label, and its rendered
EVV table contains one event matching API EVVStartTime, with no row matching the
recorded visit end. Event direction and the cause/history of the recorded end
were not established. Do not copy a recorded/bill time into the missing EVV end.

One exact patient/caregiver/office/day GetCallDashBoardData read succeeded with
zero events and separate call-read/office-check receipts. This does not negate
the original linked event, establish no clock-out anywhere, or prove complete
retained history. The [official Call Dashboard guide](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Visit/Visit-N-Call-Dashboard-P.htm),
checked November1, describes Call Maintenance as holding unmatched EVV and removing
calls after linking. Inference: its absence cannot establish absent visit evidence.
The captured SOAP contract has no VisitID or status selector in this method;
API-specific status/retention coverage and other missing-time cases remain open.

HHA's role survey was dismissed without submission. The original modal's Visit
Info frame stalled, so its exact rendered link was opened directly. Read-only
history controls did not establish a history result; no cause was guessed.
No Save, Link Call, rejection, correction, copy or clinical/financial action occurred.

## Verification and release

Two new regressions fail against the prior generated asset and pass after:
exact zero/decimal/negative/empty/null strings, invalid types and overlong values,
failed-detail stripping, live table output, no additional reads and removal after
Clear, missing date, Demo and sign-out. All213data-mode tests,356frontend/tooling
tests and46analytics tests pass. Full Windows release checks, asset generation,
performance, accessibility, preservation and repository checks pass.

Generated assets total375029bytes across11files. Existing420000raw/102000gzip
limits remain unchanged; internal output419978raw/101635gzip passes. No dependency,
minifier behavior or marketing output changed.

Runtime3b29a29f97b9238926f37ebd5c0376122f89dc77 passed all three normal jobs in
[workflow41364522832](https://github.com/jnwokorie1957/pthhs/actions/runs/41364522832):
Hosting23:57:03, backend23:57:18, analytics23:58:45UTC. At23:59:14.573UTC,
12exactassets and9anonymous401/private/noindex boundaries passed. The normal
authenticated browser loaded dashboard871cd256d94f and Live HHA mode. Its fresh
October24 page has10rows and eight supplied amounts; the exact selected visit/
patient value matches the verified GetVisitInfoV3 read. The detailed billing read
still returns no record and does not erase the separate visit amount. Source
Clear removes all rows/amounts and the detailed result. Other date/Demo/session
variants remain synthetic checks; no source failure was induced in production.

Remaining work: B02 still requires usable exact-record detailed billing fields
or precise provider evidence explaining the empty result. B01/B03 operational
pipeline/payment/AR acceptance stays open. E04 historical missing-time coverage
and supported raw-call status/retention/visit linkage stay open. This bounded
source-field connection cannot complete the overall live-data goal.
