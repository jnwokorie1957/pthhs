# Visit time-field projection — November 2, 2026

The approved GetVisitInfoV3 reader now projects schedule, recorded actual, original
EVV and source-hour fields from their exact optional WSDL paths. Generic descendant
text extraction previously collapsed a self-closing empty element into null,
trimmed source text and could borrow a similarly named nested value or the first
of multiple fields. This is a verified parser defect; it does not establish why
any particular historical punch was absent from the source.

The corrected paths are VisitInfo/ScheduleStartTime, ScheduleEndTime,
VisitStartTime, VisitEndTime, EVVStartTime, EVVEndTime, ActualHours and
ActualHoursRounded, plus VisitInfo/ScheduleDuration/ScheduleDurationHours and
ScheduleDurationMinutes. The captured GetVisitInfoDetailsV3 and ScheduleDurations
types in hharefs/hha-wdsl.xml define these paths; the duration components are
separate hour/minute components, not a decimal-hour reinterpretation.

One unique direct scalar preserves exact source text, an explicit empty string
and zero independently. Missing, nil (including XML boolean whitespace), duplicate
or nested/non-scalar evidence remains unproved. An ambiguous field does not erase
the remaining verified identity/profile. The same source request and office/date/
patient checks remain; no additional operation, retry, grant, import or source
write is added. Suggested, payroll, billed and calculated spans never fill an
actual/EVV endpoint or hour field. No clinical, payable, billable or verification
state is inferred. V2 and other unrelated projections are unchanged.

## Verification before release

Two new parser regressions fail against 6af8e87 and pass after the correction.
They cover every clock/hour field, explicit empty and zero, exact text, namespace
prefixes, duplicate/nested/nil evidence and schedule-duration parents. A third
integration test carries real synthetic XML through the office-checked preview:
empty, unknown and zero remain distinct, foreign nested text stays absent, totals
stay unknown and no transient retry is invented.

TypeScript compilation and all 559 backend tests pass. The existing 258 relevant
browser data-mode/review tests pass. Generated browser assets remain byte-current
(11 files, 374641 bytes; catalog unchanged). Repository audit and diff checks pass;
existing suffix/duplicate-content warnings remain. Runtime `afc4f4a` passed all
three normal jobs in workflow41458487191: Hosting14:05:08, backend14:06:31 and
analytics14:06:47UTC. Postrelease native acceptance is recorded below; broader
remaining source coverage is not completed by this parser correction.

## Postrelease native verification

After all three jobs succeeded, fresh October23 and October24 first pages each
returned10 readable details and7 complete EVV pairs. October23 supplied9 complete
recorded pairs; October24 supplied10. Each page displayed3 explicitly empty
ActualHours and ActualHoursRounded fields, with7 supplied fields of each kind.
The October23 source receipt is14:07:39.627UTC; October24 was refreshed again
afterward through the ordinary date picker. These are selected pages, not a census.

One October24 row with empty actual-hour fields was selected through its existing
Open records / Open visit read controls. An independent approved GetVisitInfoV3
read returned one matching visit identity. Both scheduled and recorded endpoints
were supplied; EVVStartTime was supplied; EVVEndTime, ActualHours and
ActualHoursRounded were explicitly empty. Direct source states agree with the
Preview. No identifier or private source value is retained in this document.
This accepts the bounded projection/display behavior. An empty EVV endpoint
still needs supported retained-call/visit evidence before it can be populated.

## Dated protected baseline and remaining source work

At 13:52 UTC, the current November 2 first source page had ten readable records,
with schedules supplied but no complete recorded/EVV pairs or supplied actual/
rounded hours. This does not classify these visits as pending, missed or completed.

Fresh October 24 first-page receipt 13:55:06.235 UTC: ten readable records,
ten recorded pairs, seven EVV pairs and seven supplied actual/rounded-hour fields.
Additional IDs 11–20 receipt 13:56:14.225 UTC: ten readable records, seven recorded
pairs, five EVV pairs and five supplied actual/rounded-hour fields. One additional
exact affected selection was independently read through approved GetVisitInfoV3:
the visit identity matched, schedule endpoints were supplied, while recorded/EVV
endpoints, both actual-hour fields and schedule-duration components were unavailable.
Only counts/states are retained here; no source identifiers or values are saved.

These are bounded source pages, not complete-office coverage or a newly recovered
clock-out. The original October 24 screenshot case remains resolved within its
October 31 evidence. P03/E04 still need protected original EVV/call-history and
supported API retention/status/filter/linkage proof for remaining gaps. Do not
retry the unchanged rejected call context or infer absence from an empty call API.
Authorization-detail T03 remains accepted and enabled; no repeat approval is needed.
