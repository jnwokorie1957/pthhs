# Automatic HHA API feed and private form storage

October 21 follow-up: the administrator upload/download Forms screen is now
connected and production-verified. See the separate
[forms acceptance](FORM_STORAGE_SCREENS_2026-10-21.md). The initial bucket-only
setup described below is retained as dated evidence.

Owner request: October 20, 2026, America/Chicago (October 21 UTC).
Use the existing HHA API credentials, establish a verified live feed, and avoid
manual web-scraped imports. The owner also requested Firebase Storage for forms
and explicitly selected the Codex browser when Chrome was unavailable.

## Automatic API feed

The existing one-minute server Scheduler handler refreshes the selected office's
current service day's first source page using `SearchVisitsV2`, `GetVisitInfoV3`
and exact patient-office checks through `GetPatientDemographics`. Credentials stay
in the existing `HHAEXCHANGE_CREDENTIALS` Secret Manager binding. The fixed vendor
endpoint, shared sixty-dispatch-per-minute budget, vendor retry delays, ten-detail
and response/time bounds remain. No HHA web page, browser session or manual capture
is used to obtain these records.

A protected `liveApiFeed/owner` Firestore document contains the latest bounded
API projection, its source fetch timestamp and policy context. It replaces the
prior cache atomically. Recorded failed updates remove prior cached source records; older
workers cannot overwrite newer outcomes. The existing default Standard Native
database and deny-all direct client rules are retained. The authenticated admin
`GET /primetime/api/views/feed` checks the current deployment, enabled reads,
office/policy revision and office-local day on every request, and rejects source
receipts older than three minutes or ahead of the server clock. Cached continuation
cursors are rebound to the actual caller before ordinary paging validation.
If database writes themselves fail, prior receipts still expire at the same
three-minute limit; storage failure cannot manufacture a new successful receipt.

The dashboard checks the feed every minute and updates both source views and their
charts when a new source receipt arrives. It starts enabled for signed-in Live
sessions. Hidden pages suspend dashboard checks while the server continues.
Pause live feed pauses display updates; it does not stop the server. Keyboard
focus within source evidence and explicit source-record navigation also pause
replacement to preserve the reader's context. Clear source
page pauses display updates and removes current rows/receipts/ages. Paging pauses
display replacement; Resume returns to the current day's first page. Historical
dates retain explicit direct API reads. Sign-out, Demo, scope changes, failed
updates and late responses cannot restore prior unauthorized source values.

This is a scheduled API feed with a bounded private cache. It is not a complete
office census, a normalized visit-change/schedule import, a clinical assessment,
an EVV/billing/payroll verdict or patient/staff portal authorization. Empty source
searches retain unknown completeness; charts cover only readable details on the
displayed page. Source acceptance, revision diagnosis/monitoring, SMS and HHA
mutation approval controls remain separate and unchanged. Operator stop controls
are the existing operational release/read allowlist; display Pause is explicitly
labeled separately. Source records/credentials do not enter public assets or logs.

## Firebase Storage for forms

Created through the normal signed-in Firebase console:

- Bucket: `gs://primetimehomehealthservices.firebasestorage.app`
- Location: `us-central1`, alongside the existing backend/database
- Namespaces: `forms/templates/` and `forms/submissions/`
- Rules: production mode, `allow read, write: if false`
- Website Hosting initialization configuration reports this same bucket.

The checked-in `storage.rules` mirrors that deployed policy. No public/tokenized
form download URLs, additional IAM grants or private form files were created.
Anonymous Firebase Storage list, object GET and upload probes each returned 403.
Privileged operators can manage templates in the console under existing IAM.
Bucket setup does not add application form upload/download routes; those require
reviewed form/patient/office/action scopes before private submissions are exposed.
The normal Hosting/Functions release does not publish Storage rules implicitly.

Reference: [Firebase Storage setup](https://firebase.google.com/docs/storage/web/start)
and [Storage security](https://firebase.google.com/docs/storage/security), reviewed
October 21 UTC. Private bucket access and application authorization are distinct.

## Verification checkpoint

Fresh normal production reference check returned **Reference API reachable**
using backend credentials before the implementation. Local backend suite passes
493 tests, including eight new feed scope, expiry, failure, membership and cursor
tests. The root tooling/frontend suites pass 262 tests; the data-mode suite
passes 149 tests, including six new automatic-feed
timer/context/late-response tests. Existing age-display assertions now distinguish
local age updates from separate scheduled source reads.

Asset/repository and Windows release checks passed, with private generated assets
unchanged by marketing generators. Native Bash syntax checks remain normal CI
work because that shell is unavailable locally. Console metadata independently
confirms the default database is Standard / Firestore Native in us-central1.
Concurrent source-time/hour display commits through `5067e0b` were preserved;
generated assets were rebuilt from the combined sources and the affected suites
rerun successfully.

## Authenticated production acceptance

Feature `3a8db49966c489d3914f85ba8cc5c49ae22715dd` passed both normal jobs in
[workflow 39533867946](https://github.com/jnwokorie1957/pthhs/actions/runs/39533867946)
on its first attempt: Hosting completed 02:36:01 UTC and backend 02:37:33 UTC,
October 21 (October 20 America/Chicago). Concurrent source-duration and subsequent
role-research work were preserved. Eight production Primetime artifacts matched
the tested bytes at 02:39:24 UTC; anonymous session and feed requests returned
401 with private noindex headers. Hosting's initialization configuration reports
the newly provisioned Storage bucket.

The normal administrator UI loaded the scheduled feed with source fetch receipt
02:39:11.740 UTC. Display updates were paused for 62 observed seconds beginning
02:40:56 UTC. Resuming read a new server receipt of 02:41:07.075 UTC, a fetch made
inside the observed pause interval. No browser-triggered source read was requested during
that pause. A subsequent dashboard timer check, without manual refresh, displayed
receipt 02:42:09.242 UTC. These source receipts and the endpoint implementation
verify an independently updating server API cache, rather than browser capture
or manual import. This observation does not guarantee every minute's latency or
complete source coverage.

Both feed pages had ten readable details and all six chart counts/denominators
matched their displayed source fields. The cached continuation also worked for
the real administrator: the next ten positions had disjoint visit IDs, nine
readable details and one explicitly unavailable detail, with all six charts
matching the nine readable records. Resume returned to the first cached page
with ten readable details and matching charts. The one unavailable row was not
converted into missing/zero clinical evidence. No full-day scan, normalized import,
clinical/financial verdict or additional source entitlement is claimed.

Final normal Overview remains signed in, Live, on the configured current office
day with automatic feed display updates enabled. The server continues on its
minute schedule. The proof crop contains only generic feed controls and its
fetch receipt, with no account or patient/staff fields. Raw identifiers and source
records were used transiently for the comparisons and were not saved in these
acceptance artifacts. No HHA web UI data was scraped. No private form was uploaded.

Private aggregate evidence: `primetime-api-feed-release-acceptance-2026-10-21.json`,
`primetime-api-live-feed-production-acceptance-2026-10-21.json`,
`primetime-api-live-feed-verified-2026-10-21.png`,
`firebase-form-storage-acceptance-2026-10-21.json` and
`firebase-form-storage-rules-2026-10-21.png`. Source-record meaning, intended HHA
application/office alignment, external role/form scopes and broader operational
acceptance remain separate from this verified API connection.
