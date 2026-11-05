# First-party live daily page views

The owner requested that today's page views change immediately after visiting
either website. GA4's intraday total cannot provide that behavior. Today's
primary card now reads a separate, durable first-party aggregate every5seconds;
the GA4 processed-today total stays beneath it with its processing delay.

Both public tracking scripts send one fixed `{"v":1}` POST per document load to
`https://pthhs.net/api/public-page-view`, with credentials omitted, no referrer,
and keepalive. Existing canonical/production-host, noindex/private-path, DNT,
GPC and duplicate-initialization guards apply before either counter or GA4.
No URL, cookie, visitor ID, phone/email, form or private operations data is sent
to the counter. Each public privacy page describes aggregate counting.

The independent `websitePageView` function derives the site only from the four
explicit public Origin values, validates method/type/body/size, and bounds the
process to120accepted writes per site per minute. OPTIONS does not count.
Success is204 only after the durable transaction completes. This is an
anonymous raw page-load metric, not unique visitors or a bot-proof GA4 metric.
Origin validation is a browser boundary, not authentication against scripts
that forge headers. Traffic filters/blockers/cache rollout can create
differences from Google; the two totals are never added together.

The existing us-central1/default Firestore instance was independently listed
and inspected: STANDARD/FIRESTORE_NATIVE. Two root documents in the separate
`websitePageViewCounters` collection hold startedAt/timezone. Their date-keyed
days subcollections contain only aggregate count and updatedAt. Transactions
create the first start receipt and increment the day's count atomically.
Chicago calendar dates include DST; a new day without a row is an actual zero
only when tracking has started. No prior-day GA4 number is used as a seed.
The first partial day is explicitly labeled with its counting start time.

The existing owner-authenticated analytics function serves the new exact
`/primetime/api/website-live-views?site=...` read. Its path/query allowlist,
private/no-store/noindex response and fresh owner authentication are retained.
Only two Hosting rewrites were added. Ride's public CSP adds only the owner's
https://pthhs.net endpoint. Firestore client rules remain deny-all; no IAM,
credential, clinical source, operational backend or security-rule change.

The separate dashboard module polls only in the signed-in, visible Live
analytics panel, with one request in flight, ten-second timeout, bounded
receipt/date/numeric validation and twenty-second freshness. Selection, mode,
navigation, visibility and sign-out cancel and fence late responses. An
unavailable GA4 report cannot overwrite the independent live total. No chart
or tracking library was added. Source/compiled assets and versioned public
tracking references are committed in both repositories.

Validation:303 source/query/privacy/browser-harness/generated-asset tests pass;
Ride's55tests pass, with the static network prohibition narrowed to exactly
the reviewed fixed anonymous counter request. Frontend controls and exact
rebuild checks pass. Raw app423314bytes / gzip104195 fit425000/105000-byte
caps; per-file cap is unchanged. The pre-existing marketing2MB check still
fails (2014828bytes including the new privacy notice). This change does not
claim the complete marketing release gate passed.

Release:only the independent website-analytics codebase was deployed. Native
Hosting release2f98303adcecaa1a (PTHHS) and a758e1f1cab82d3c (Ride) preserve
all previous live page contents apart from the new script version and privacy
notice, plus the reviewed dashboard/runtime/config changes. The current live
manifest and release identity were guarded before staging and release; no
unrelated pending booking or operational source was deployed. Both owner-only
report paths still reject anonymous reads with401.

Native Chrome acceptance November4 Central: PTHHS began at21:05:30, displayed1,
then changed automatically to2 after another public page load. Ride began at
21:06:05, displayed1, then changed automatically to2 after another public page
load. No dashboard Refresh was clicked for either increment. GA4 processed
totals stayed14and4 below the new counters. Screenshot evidence is in the
task's outputs/pthhs-live-daily-counter.png and ride-live-daily-counter.png.
These are real browser page loads; no synthetic event/response was injected.
