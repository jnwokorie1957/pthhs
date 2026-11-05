# Persistent office-day API collection

The requested all-returned-visit connection is accepted in authenticated
production: the November 5 office/day returned639 unique visits,639readable details
and receipt pairs, with zero unavailable details. All source-driven charts and
tables reconcile, including after a clean reload. The existing minute worker
resumes protected source batches from Firestore independently of any browser.
This replaces the earlier browser-only scan interrupted by computer suspension.

## Source and access

Only the existing enabled SearchVisitsV2, GetVisitInfoV3 and
GetPatientDemographics reads are used. The unchanged visitPreview boundary checks
office/day/visit identity, fresh patient-office proof, release/preferences and
actor-bound cursors. Every persisted generation has the same settings/office/
date/timezone context, source search fingerprint and ordered unique IDs. The
complete ID list must hash back to the source discovery fingerprint before
publication. A changed discovery restarts working collection without claiming a
new completed result. Shared source quotas and backoff remain unchanged.

GET /primetime/api/views/office-day uses the existing administrator session and
live-mode gates. It validates office/day and current release/read settings before
and after storage access. Reads request a selected-day refresh through a small
server-owned target record and never accept client-supplied HHA records or invoke
HHA. Historical requests remain active for ninety minutes after the last view;
otherwise the worker follows the configured office's current day.

## Protected cache and consistency

The existing (default) Standard/Native Firestore database in us-central1 is reused;
its provisioning/metadata evidence is in FIRESTORE_SETUP.md. No new database,
browser Firestore access, rules, index or IAM grant is introduced. Existing rules
deny every direct client read/write. The Admin SDK uses fixed document lookups
and compare-and-set transactions, not a new client query interface.

officeDayApiFeed stores one small active target and hashed office/day documents.
Each document holds a working generation and the last published generation.
Source rows are closed projections of visit/patient/caregiver references, six
clock fields, detail/office-check receipts and unavailable-state codes. Billing,
verification names, notes and unused V3 fields are omitted. Private records stay
in protected runtime storage, never public source/assets/research/log payloads.

Compressed byte fields keep each generation below300000bytes and both below the
1MiB document limit; decompressed JSON is bounded to5MB and10000items. Transaction
revision checks prevent overlapping/superseded workers from overwriting newer
state. Corrupt blobs, duplicate IDs and foreign scope are refused. No source
mutation, clinical/financial decision, message or manually scraped import occurs.
Cache metadata remains separate from normalized import history.

Source quotas, retry cursors/deadlines and progress survive separate invocations.
Working scans older than two hours restart instead of mixing very old receipts.
Published results remain separate while the next generation fills. Cache replies
expose source fetch ranges, update/progress receipts, known-versus-queued state,
unavailable details and explicit overdue flags. Sequential reads do not establish
an atomic source snapshot or unsupported vendor census/clinical semantics.

The design follows Google's [transaction documentation](https://firebase.google.com/docs/firestore/manage-data/transactions)
and [document-size limits](https://firebase.google.com/docs/firestore/quotas),
checked November 5. Fixed document reads and atomic replacement are used for
cache consistency; no client SDK or query/pipeline dependency is added.

## Validation and release history

Fourteen new checks pass, including a642-ID collection with no browser request,
cross-invocation resume, historical dates, stored quota deadlines, atomic prior-
generation retention, settings/release/office failures, discovery changes,
staleness, corrupt bytes, superseded writers, interrupted-scan reset and post-read
revocation. All 657 backend checks pass. These are synthetic/source-boundary
results, not complete authenticated production acceptance.

Backend release 853572e0e0bddc7b0995a719b3d498e35419a115 completed all four normal
workflow jobs in 42056329529. Frontend now consumes the protected office-day cache
when advertised by server metadata; the older collector remains only for rolling
compatibility with servers lacking that capability. Cache reads do not spend HHA
quota or follow detail cursors in the browser. Preview paging stays independent.
Cache polls pause while hidden, signed out, in Demo or away from Overview; source
work continues on the server. Delayed cached results and a queued unknown count
are explicit. Revoked access, corrupt receipts and foreign/duplicate rows clear
office evidence. A preview quota delay does not disable cache refresh.

All 536 current frontend/contract/release/analytics tests pass, including the
642-row server-cache view, paged-preview independence, queued/unknown states,
quota independence, prior-result retention and late date/mode/session fencing.
The performance check passes at 435755 internal raw bytes and 107476 gzip bytes. The
adapter adds approximately 7.1 KB raw / 1.3 KB gzip with no runtime library; bounded caps
are 437000 raw / 109000 gzip, preserving the 110000 per-file and 2 MB marketing limits.
At that frontend checkpoint, production UI acceptance was still pending and was
not inferred from the synthetic tests.

The final polling refinement 099117ea63118dad9022ec2663748a53bc5a33a6 passed all
four normal jobs in 42059940978. The initial UI release da6f5ab3cce3167e32b88f496acaae4c5782ff61
also passed all four jobs in42057889397. Overview's minute check now reads only
its office-day endpoint; first-page feed failures cannot clear healthy whole-day
charts. Copy describes all returned visits and quota-limited background batches.
All 537 frontend/contract/release/analytics checks pass. Final assets measure
436127 raw / 107553 default-Node-gzip bytes; maximum 103685, within all reviewed caps.
Thirteen production files match exact local bytes; nine anonymous private routes,
including /views/office-day, return 401 JSON/no-store/noindex.

## Authenticated production acceptance, November 5

The actual source search range was 15:37:13.803Z through 16:13:13.478Z; the last
detail/office proof arrived 16:13:18.446Z. At 16:13:24.605Z the native signed-in UI
showed 639 / 639 returned IDs,639 distinct rendered visits and 639 readable details,
with zero unavailable details. The protected worker requires exhaustion of the
source cursor and matching ordered-ID discovery hash before publishing a result.

Independent DOM reconciliation matched all six source-field progress values and
denominators, actual/EVV pair cards, assignment coverage and evidence-gap totals.
Every EVV table row matched the corresponding source timeline clocks. All 592 SVG
bars had the exact source-wall-clock position/width; 1325 lanes correctly omitted a
bar for absent, nonmatching-day or unsupported intervals. There were 0 geometry or
table mismatches and no page overflow in the current 319 px DOM viewport.
All 639readable visits had valid individual detail and office-check receipts;
none were missing or invalid. No patient/staff identifier or original clock value
is published in this evidence.

Pausing the display while collection continued advanced source progress 146 to 177.
A reload during collection returned the persisted progress. After completion,
Preview's next page respected an actual 12 second source delay and returned 10
readable, unique visits disjoint from its first 10, while Overview stayed 639.
Changing to November 4 cleared the November 5 rows and showed a queued unknown
count; returning November 5 immediately restored all 639. This does not accept a
complete November 4 collection. A clean final reload returned all 639 again and all
four reconciliation checks passed unchanged. The next background generation
showed 28 then 36 of 639 checked while retaining the complete charts and original
fetch range. Following-office-today/Live/automatic feed was restored. A screenshot
of aggregate totals only is retained locally; no private row image is committed.

O03's requested all-returned-ID coverage is accepted. This is a live API cache,
not a manually scraped/imported snapshot. Each full source scan is sequential and
quota limited: about 36 minutes for this observation, despite minute worker/view
checks. The fetch range and refresh progress remain visible. No atomic source
snapshot, unsupported vendor census, normalized import, inferred clock, clinical,
EVV-compliance, payroll or billing decision is established. Source fields absent
in HHA remain absent. Broader checklist items and native keyboard/assistive-
technology matrices remain open; the older browser fallback is compatibility only.

Resource review clarification: the shared 60-read/minute guard is enforced by
Primetime's FirestoreWorkspaceRepository.reserveRead, with separate vendor
backoff. The observed scan timing does not establish HHA's maximum throughput.
The new [maintenance resource pack](evv-maintenance-resources/README.md) records
published provider-limit and incremental-feed references for a future capacity
review. No limit, source grant, worker or production behavior changed in that pass.
