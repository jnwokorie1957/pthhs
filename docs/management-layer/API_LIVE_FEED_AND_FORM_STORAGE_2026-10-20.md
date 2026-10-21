# Automatic HHA API feed and private form storage

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

Remaining release work: review the diff, publish through the existing
GitHub/Firebase workflow, then verify two
actual scheduled API receipts and corresponding production charts. A configured
Scheduler or passing synthetic suite is not production connection acceptance.
No record values or credentials belong in this report.
