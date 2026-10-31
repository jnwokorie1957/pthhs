# Analytics report validation — October 31, 2026

A failed analytics refresh could leave earlier metrics, chart rows and a realtime
visitor count visible. Missing or malformed numbers could format as zero. The
daily chart also created zero rows for dates absent from the returned report.

The browser now clears the former report before each read, validates the whole
response before rendering and clears every report section on failure. Selection,
account, navigation and Demo changes fence pending results. Demo prevents source
reads. Unknown, expired or materially future receipts cannot produce current
figures; the browser's two-minute receipt limit is a UI freshness policy, not a
Google processing guarantee. Retained reports also expire while the tab is hidden.

Validation covers the selected site/property and period, timestamp, reporting
timezone, required numeric fields, nonnegative safe counts, rates, bounded rows,
unique dimensions, real calendar dates and contact-count overflow. Explicit zero
counts remain zero; a missing realtime result remains unavailable. The chart and
daily table use sorted source dates, leaving gaps unfilled and unjoined.

The change does not enable GA4 access. The existing independent Google reporting
function, owner authentication, properties, tracking, grants and HHA operations
remain unchanged. Native reporting is still access-pending. In particular, this
frontend validation cannot recover metadata or distinguish zeroes already
substituted by the existing server adapter. Upstream report schema, explicit date
boundaries, empty reasons, sampling/truncation and genuine source calculations
remain separate acceptance work in GA03 of the [checklist](PRIMETIME_LIVE_DATA_CHECKLIST.txt).

Google's [report reference](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport)
and [response metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData)
were checked October 31. Their metadata supports reporting limitations; the
current server adapter does not yet retain all those fields.

The dependency-free validation adds 756 measured gzip bytes. The compressed app
allowance changes from 100,000 to 101,000 bytes; the 420,000-byte raw total,
110,000-byte per-file cap and independent marketing budget remain unchanged.
Measured combined total: 100,746 gzip bytes and 416,774 raw bytes; no new runtime
library or external request. The concurrent rounded HHA-hour mapping is retained.

Eight isolated frontend regressions cover failed refresh, malformed complete
responses, genuine zeroes, returned-date plotting, freshness expiry, scope races,
sign-out and Demo isolation. Populated-to-failed and malformed responses are
synthetic acceptance; a live access-pending response is not a populated report.
The combined tree passes 534 backend, 202 data-mode and 341 frontend/tooling tests
plus full Windows release checks. Eight new analytics regressions were isolated
against the former module: seven failed before the correction and all pass now.
Validation release `8a0eed0` passed normal workflow `41237844043`.
Native QA found that existing analytics CSS hid the Demo switch. Follow-up
`8c55dd7` restores that control on this screen and passed normal workflow
`41238210213` (Hosting 20:18:03 UTC; backend 20:18:19 UTC).

At 20:19 UTC, all 12 app artifacts and nine anonymous 401/noindex boundaries
matched production. A signed-in PTHHS read still returned the actual reporting
access blocker, with six unavailable metric cards and no chart, table rows,
realtime count or update receipt. Direct Demo activation on the same screen
cleared facts and disabled Refresh; direct Live activation restored the access
check. The switch remained visible within mobile390/desktop1280 viewports with
no horizontal page overflow. These checks do not prove populated Google reports
or reproduce malformed/populated-to-failed cases natively.

Final combined output after the switch CSS fix is 416,755 raw / 100,738 gzip
bytes, within the reviewed raw, per-file, gzip and marketing limits.
