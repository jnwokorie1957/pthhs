# First-party live visitors

The owner requested live visitors to update like the first-party daily page
views. The primary visitor card now counts active browser sessions seen within
60 seconds and updates every 5 seconds. Google's 30-minute user count remains
separately labeled below it. No claim is made that browser sessions identify
unique people or match Google's reporting definitions.

The public script retains the fixed v1 page-view message. Separate, validated
v2 presence messages carry only a random browser session token, random document
token and active flag. A first-party localStorage record shares the session
across same-origin tabs and expires after 30 minutes of inactivity. Storage-
disabled browsers use a document-scoped fallback. Fifteen-second heartbeats
run only while visible; hide/pagehide signals mark that document inactive, and
BFCache restoration resumes presence. No heartbeat increments page views.
Canonical/public-host/private-path/noindex/DNT/GPC guards precede all tracking.
Requests omit credentials and referrer; no URL, form/contact or private app
content is collected. Both public privacy notices describe the new tokens.

The existing collector validates the exact presence fields, UUID formats,
boolean, body type and size. It derives the website from the four approved
Origins, caps view and presence traffic independently, and sends no aggregate
or session data to anonymous callers. Browser Origin checks are not intended
to authenticate scripts that forge HTTP headers or guarantee bot-free counts.

The default STANDARD Firestore database stores SHA-256 session/document keys
under websitePageViewCounters/{site}/websiteActiveSessions. Transactions retain
unexpired document presence so one browser with multiple active tabs counts
once; leaving one tab does not remove other active tabs. The server counts
only expiresAt > now using a server aggregation. Expiry takes effect in the
count even before storage cleanup. Only the new collection group's expiresAt
TTL setting was configured, preserving existing indexes. Its observed state
is ACTIVE; source firestore.indexes.json records the matching scoped policy.
Physical TTL deletion is asynchronous, typically within 24 hours. No IAM,
credential, Firestore client rule or clinical collection change was made.

The owner-only existing five-second endpoint returns the visitor aggregate
and its 60-second definition beside the durable day total. The browser checks
integers, date, website, receipt and window before rendering, retains all
selection/auth/Demo/visibility/stale-response fences, and clears unavailable
facts. GA4 refreshes do not overwrite either first-party primary card.

Validation: 313 source/query/privacy/browser-harness/generated-artifact tests
and 55 Ride tests pass. New tests cover multi-tab deduplication, site isolation,
departure and silent expiry without physical deletion, hashed storage, rejected
arbitrary fields, shared browser tokens, hidden heartbeat pause, no view-count
inflation and five-second visitor increase/decrease independent of GA4. Exact
rebuild and frontend controls pass. The app is 429164 raw / 106009 gzip bytes,
within the existing 431000 / 107000 caps. The prior marketing 2 MB check remains
over budget (2016258 bytes including the updated script and notice); this work
does not claim that broader marketing gate passed.

Only the existing website-analytics Functions codebase was deployed. Hosting
versions bda9f94b106ecd8b (PTHHS) and d8be7cc3187990a2 (Ride) retain the prior
production manifests except reviewed analytics assets, script versions and
privacy text. Existing dashboard bytes were checked against the source baseline
before overlay, and release identities were guarded during staging/release.
Hosting configuration did not change. Both report selectors and first-party
read paths continue to return 401/private/no-store/noindex anonymously.

Native Chrome acceptance on November 4 Central, with no dashboard Refresh:

- PTHHS: 0 at 21:48:10, 1 after visiting at 21:48:30, then 0 after closing the
  test page at 21:48:35.
- Ride Primetime: 0 at 21:48:45, 1 after visiting at 21:49:05, then 0 after
  closing the test page at 21:49:10.

New public script version e07b81562862 was loaded for the actual tests. The
task outputs contain the populated-card screenshots and aggregate test receipts.
No synthetic event or response was injected. Cached pre-release pages acquire
the new script when their HTML is revalidated, as with ordinary static releases.

References:
https://firebase.google.com/docs/firestore/query-data/aggregation-queries
https://firebase.google.com/docs/firestore/ttl
