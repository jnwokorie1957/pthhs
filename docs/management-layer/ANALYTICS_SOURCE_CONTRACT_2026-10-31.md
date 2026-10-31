# Analytics source contract — October 31, 2026

The former server adapter could turn a missing metric or summary row into zero,
default a missing timezone, lose report-quality/coverage evidence, and present a
property-wide realtime number alongside hostname-filtered website reports.
This change makes those source boundaries explicit. Google reporting access
remains pending under GA01; fixtures do not establish a populated live report.

## Behavior

The existing owner-only API and separate `website-analytics` codebase remain.
A bounded, hostname-filtered `runReport` first obtains the property's actual
reporting timezone. Probe metric values are discarded. The five-report batch
then requests explicit inclusive calendar dates for the selected completed-day
window and preceding equal window. Date arithmetic uses calendar dates across
DST. A timezone change or missing/invalid timezone fails verification.

Each returned report must match the requested dimensions, metrics, metric types,
finite nonnegative values, integer count bounds, date ranges and unique rows.
Missing/blank/malformed numeric fields cannot become zero. A missing summary
period stays null; source empty reasons remain available. Valid current facts
can display when the comparison period has no returned row. An empty contact
event set displays unavailable; only returned phone/email rows are summed.
Source-supplied zero remains zero. No prior report survives an invalid refresh.

Coverage retains returned versus total rows, an unknown total when omitted,
limits, thresholding, aggregation into `(other)`, sampling counts as integer
strings, truncation and metric restrictions. An explicitly restricted requested
metric fails verification instead of appearing as zero. Quality warnings and
exact requested current/previous dates appear beside the report; top-ten lists
are not full-property totals and daily gaps remain gaps.

Realtime requests filter the configured GA4 web `streamId`, explicitly covering
minutes29 through0. Its receipt is separate from the historical batch receipt.
Empty, invalid or failed realtime remains unavailable without discarding valid
historical facts. The UI labels selected-stream active users; it does not claim
hostname filtering for realtime. The existing two-minute UI freshness, Demo,
selection, navigation, authentication and late-response protections remain.

## Release and validation

The normal push workflow now deploys this existing independent codebase through
a third job after successful site checks/Hosting. It uses the existing Firebase
deployment account, pinned pnpm11.25.0/Firebase CLI15.30.0, the unchanged frozen
dependency lock, and `firebase.analytics.json` with only
`functions:website-analytics`. It does not deploy HHA Functions, rules or Storage.
Manual releases remain Hosting-only; regression tests cover all three job gates.
Source contract tests also run before Hosting can publish the matching UI.
Anonymous checks after analytics deployment must still receive401/private/no-store/
noindex for both site selectors. A deployment success is not report acceptance.

Local validation:40 adapter/query tests and347 frontend/tooling tests pass;
three new browser regressions fail against the former production module and pass
after this change. Frozen pnpm installation reuses the existing lock without
dependency updates or lifecycle scripts. Local Node24 reports the existing
Node22 engine requirement; normal CI tests/deploys on Node22. Windows generator,
source preservation, deterministic assets, public/privacy/accessibility and
performance checks pass. Concurrent8006dd4 visit-detail/office-check receipts were
preserved, including its535backend tests. A former workflow test read the pending
reporting step through the end of the entire YAML; its boundary now stops at the
next step/job while retaining its no-credential/no-failure-suppression assertions.
All535combined backend tests pass. Raw app419304bytes, compressed101431bytes. The reviewed
gzip allowance increases101000 to102000bytes for the565-byte increase; the
420000 raw,110000 per-asset and separate marketing limits stay unchanged.

Normal release and native production failure/Demo verification are pending at
this implementation checkpoint. Populated Google response/schema, real empty/
quality variants, exact calculations and separate receipts still need native
source acceptance after the specific GA01 access grant. These tests are synthetic.
No HHA setting, grant, source record, form file, clinical/financial decision,
communication, schedule or persistent-goal status changed.

Primary contracts rechecked October31:

- [Report response and rowCount](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse)
- [Metric types](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/MetricType)
- [Date ranges and reporting timezone](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange)
- [Empty, sampling, truncation and restriction metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData)
- [Realtime stream dimensions](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema)
- [pnpm CI and frozen locks](https://pnpm.io/continuous-integration)
