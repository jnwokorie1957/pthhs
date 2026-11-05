# Persistent office-day API collection

The actual large-day browser scan was interrupted by computer suspension before
completion. A browser-only collector is insufficient for the requested live
office-day view. The existing minute worker now resumes protected source batches
from Firestore, independently of any browser. Frontend integration and complete
authenticated production acceptance are still pending.

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
checked November5. Fixed document reads and atomic replacement are used for
cache consistency; no client SDK or query/pipeline dependency is added.

## Validation and next acceptance

Fourteen new checks pass, including a642-ID collection with no browser request,
cross-invocation resume, historical dates, stored quota deadlines, atomic prior-
generation retention, settings/release/office failures, discovery changes,
staleness, corrupt bytes, superseded writers, interrupted-scan reset and post-read
revocation. All657 backend checks pass. These are synthetic/source-boundary
results, not complete authenticated production acceptance.

Backend release853572e0e0bddc7b0995a719b3d498e35419a115 completed all four normal
workflow jobs in42056329529. Frontend now consumes the protected office-day cache
when advertised by server metadata; the older collector remains only for rolling
compatibility with servers lacking that capability. Cache reads do not spend HHA
quota or follow detail cursors in the browser. Preview paging stays independent.
Cache polls pause while hidden, signed out, in Demo or away from Overview; source
work continues on the server. Delayed cached results and a queued unknown count
are explicit. Revoked access, corrupt receipts and foreign/duplicate rows clear
office evidence. A preview quota delay does not disable cache refresh.

All536 current frontend/contract/release/analytics tests pass, including the
642-row server-cache view, paged-preview independence, queued/unknown states,
quota independence, prior-result retention and late date/mode/session fencing.
The performance check passes at435755internal raw bytes and107476gzip bytes. The
adapter adds approximately7.1KBraw/1.3KBgzip with no runtime library; bounded caps
are437000raw/109000gzip, preserving the110000per-file and2MBmarketing limits.
Production UI acceptance remains pending and must not be inferred from tests.

Next: deploy the frontend normally; verify real
background progress while the browser is paused, complete one actual selected
office/day, reconcile every source row/chart/receipt and confirm reload returns
the completed dataset without starting a browser-only full scan. Keep O03 open
until those checks pass. Browser compatibility fallback is temporary and must
not be called persistent server acceptance.
