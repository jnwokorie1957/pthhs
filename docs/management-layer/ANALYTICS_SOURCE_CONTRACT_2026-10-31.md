# Analytics source contract — October 31, 2026

The former server adapter could turn a missing metric or summary row into zero,
default a missing timezone, lose report-quality/coverage evidence, and present a
property-wide realtime number alongside hostname-filtered website reports.
This change makes those source boundaries explicit. Subsequent native reads
verify both Google connections for empty historical reports and returned stream
realtime counts. Populated historical calculations/quality variants stay open.

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

Normal [workflow41242691339](https://github.com/jnwokorie1957/pthhs/actions/runs/41242691339)
passed all three jobs: Hosting21:15:35UTC, HHA backend21:16:48UTC and independent
analytics21:17:40UTC. At21:20:00.995UTC the production verifier matched12exact
app assets and all9anonymous401/private/noindex boundaries.

Native Chrome reads for BOTH sites subsequently succeeded with actual empty
historical sections, six unavailable historical/contact cards, no invented
zero/chart/table rows, and a returned selected-stream realtime count. Dates,
source-quality/omitted-row-total notes and receipts display. Switching sites
cleared the previous realtime/receipt before its new response. Actual source
zones are PTHHS `Etc/GMT+5` and Ride Primetime `America/Chicago`; the former
timezone fallback would have hidden this difference. Native desktop geometry
fits the viewport. No fake response or analytics event was injected.

Post-deploy Cloud Run identity remains the same verified compute account. No
Google permission change was submitted by this agent. The previously requested
restricted Viewer grant is unnecessary now; its unsubmitted form was closed and
the old question is superseded. The reason the earlier403 changed is unknown.

The40source and347frontend/tooling tests remain synthetic. Native acceptance
does not yet cover populated historical calculations, sampled/truncated/restricted
variants, exact malformed responses or failure/expiry after historical facts.
No HHA setting, grant, source record, form file, clinical/financial decision,
communication, schedule or persistent-goal status changed.

## November 1 native follow-up

PTHHS now returns populated historical sections: one daily row, six page rows
and two channel rows. Both SVG point titles exactly match the daily table;
rendered view/session summary amounts equal their daily sums. No source traffic
amounts are included here. This is actual rendered consistency, not an independent
Google UI/raw-response comparison, every metric or every quality/failure variant.
The source timezone remains `Etc/GMT+5`; explicit ranges advanced with its
calendar. No local central-time fallback or zero-filled comparison was used.

Realtime currently reports unavailable or invalid, despite successful historical
data. GA04 now maps the exact stream/report and the next safe diagnostic change:
separate provider status/timeout from strict response rejection without leaking
tokens, bodies or private values. Do not infer a grant issue or fabricate zero.

The user's older open analytics bundle461e27e76e85 rejected the new nullable
summary contract. A normal reload of that read-only page loaded0724fd3720d3 and
accepted the historical response. The browser observation timed out once during
reload; its same handle was re-observed, without issuing another reload.
Chrome later reconnected under a new surface after the former browser was
unavailable. The documented inventory/recovery path located the same existing
tab; no tokens, credentials or unrelated automation tabs were accessed.

## November 1 realtime diagnostics

The realtime catch now distinguishes strict response rejection from provider
HTTP403/429/other statuses, request timeout and network failure. The protected
response adds `realtimeDiagnostic` with only a fixed category, bounded numeric
HTTP status or null, and an allowlisted structural reason or null. The function
logs only that object for a failed uncached owner query. Raw responses, errors,
headers, tokens and metric values are never included in the new diagnostic.
This adds no source read, retry, grant or default realtime zero. Historical
results and their receipt remain available when realtime fails.

43source tests pass. Cases cover exact categories, rejection of arbitrary error
content, a missing metric field, retained historical facts and no extra retry.
Normal three-job release and current native/log cause inspection are pending;
the diagnostic alone is not a repair or full GA04 acceptance. The existing
frontend displays the bounded error message; no public asset/budget changed.

Primary contracts rechecked November1:
[realtime API](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runRealtimeReport),
[separate realtime/core quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas).

Primary contracts rechecked October31:

- [Report response and rowCount](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse)
- [Metric types](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/MetricType)
- [Date ranges and reporting timezone](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange)
- [Empty, sampling, truncation and restriction metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData)
- [Realtime stream dimensions](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema)
- [pnpm CI and frozen locks](https://pnpm.io/continuous-integration)
