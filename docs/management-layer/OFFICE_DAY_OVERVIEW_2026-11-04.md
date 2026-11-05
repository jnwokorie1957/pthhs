# Office-day Overview

The owner requested totals and charts for every visit in the selected office and
day. Overview now collects every detail batch returned by the existing guarded
visit endpoint, independently of the page displayed in Visit Preview. Normal
release has passed; complete authenticated production acceptance remains open
(see the November 5 reconciliation below).

## Source and counting

The captured SearchVisitsV2 contract takes office, start/end date and optional
patient/caregiver filters. It returns an unbounded VisitID list and declares no
source page number or total-count field. The existing visit_discovery projection
already retains all received identifiers under the unchanged SOAP byte ceiling.
The public operation-page recheck was unavailable; this is captured-contract
evidence, not newly verified vendor coverage or entitlement.

Overview uses the existing /views/visits route and its ten-detail batches. Every
batch retains authenticated administrator, operational release, enabled reads,
actor/office/date/policy-bound cursor, exact detail identity/day, fresh patient
office proof and settings checks. No new HHA method, grant or source write is
introduced. Stable search fingerprints and counts must agree throughout the
scan. Ordered positions reject skipped rows, repeated/foreign IDs and broken
continuations. Retry rows replace the same positions without double counting.
An earlier truncation remains incomplete even if a later page is untruncated.

The headline count is unique visit IDs returned by the office/day search. The
readable-detail denominator is the entire collected day. All six field-presence
charts, actual/EVV pair counts, assignment evidence, evidence gaps, EVV table and
visit-window rows use that same collected set. Unavailable detail reads are
counted separately and never contribute clock or assignment facts. Source-empty
fields remain empty; clocks do not become completion, compliance or paid hours.

All returned IDs must be checked before the scan is called finished. A finished
scan with unread details or truncated discovery remains explicitly incomplete.
The interface exposes checked/total counts and the first/last search receipts;
individual source controls retain independent detail and office-check receipts.
Sequential reads are not an atomic snapshot. No unsupported vendor-side census
guarantee is inferred from a successful HTTP response.

## Refresh and isolation

An active Overview collects batches from the current minute-fed first page or an
explicit selected-date read. The existing server feed still caches only the
current day's first page. The browser completes the remaining batches through
live API reads; it does not import or persist a scraped dataset. A completed scan
can therefore take multiple quota windows for a large office. Background first-
page updates cannot repeatedly interrupt an in-progress day scan. The next
automatic cycle starts after collection and the normal polling interval.
During a same-scope refresh, charts retain the last completed day and its source
fetch range, with an explicit refreshing/progress label. The new complete result
replaces it together; a new date/scope or failed continuation clears it.

Read entire day starts a fresh scan. Visit Preview keeps its own paging and
cannot turn an already collected day into one-page totals. Date, office, policy,
mode, session and explicit clear changes invalidate old evidence. Leaving the
Overview, hiding the page, pausing the feed or working with source records stops
the active collection. Resuming or returning to Overview starts a fresh read.
Vendor delays are honored on the same continuation, with bounded retry loops.
Failed/changed continuations remove success totals and receipts. No automatic
source retry is presented as missing source fields.

## Validation and bounded asset review

Seven collection checks cover 23 visits across three batches, successful empty,
all-field counts, discovery/scope/position/ID/cursor refusal, retry replacement,
unread details, sticky truncation, cancellation and bounded retries. The initial
six collection checks failed before the new collector existed. Six browser
integration checks cover full-day totals versus paged Preview, date changes,
Demo/sign-out/clear races, failed continuation and actual HTTP-quota waiting.
All500 current root/browser/tooling/analytics-source checks pass. All26 ordered
generation/source-preservation/site checks pass; Windows generation uses UTF-8,
matching CI. The existing privacy disclosure's four CSV line references are
regenerated; no legal or business text is changed.

The reviewed concurrent baseline0a2cd03 is423314raw/104195default-gzip bytes.
This feature is428645raw/105841gzip: +5331raw/+1646compressed, no new library,
and maximum asset103122bytes remains below the unchanged110000 per-file cap.
The explicit internal allowance is431000raw/107000gzip. After deterministic
generation, marketing is1953396bytes within the unchanged2000000 allowance.
The initial release's temporary marketing allowance expansion is reverted after
checking the actual generated bytes; the earlier upstream failure is not reproduced.
No checks, authentication, source budgets, clinical gates or release jobs are
removed. Other concurrent counter/article changes are preserved.

Initial72a7b8b release41960974920 passes scope, Hosting, backend and analytics
jobs, with13exact production assets and8anonymous protected boundaries. A signed-
in day scan has progressed beyond the first page and its six chart attributes,
pair counts and assignment counts reconcile with collected rows. Quota deferrals
remain explicit and retry the same positions. The subsequent same-scope refresh
refinement passed 500 checks. Its release was pending at that checkpoint;
November 5 release reconciliation follows. The full native scan remains open.

## November 5 release reconciliation

Same-scope refresh retention [859402f0](https://github.com/jnwokorie1957/pthhs/commit/859402f0c84ec09de4bcb24df5fa197a7e2072fe)
passed [workflow 41962310228](https://github.com/jnwokorie1957/pthhs/actions/runs/41962310228).
Quota-wait labeling [041e1935](https://github.com/jnwokorie1957/pthhs/commit/041e1935a93b42b818630205251a1e107e1083de)
passed [workflow 41988610071](https://github.com/jnwokorie1957/pthhs/actions/runs/41988610071).
All four jobs succeeded in each exact-SHA workflow, independently rechecked on
November 5. The retry-copy release record reports 293 focused and 542 aggregate
tests, 13 exact served files and 106182/107000 gzip bytes. These are dated release
results, not new test runs or a fresh public-byte comparison in this docs pass.

This correction labels retained same-scope evidence during quota waits; it does
not establish complete authenticated office-day reconciliation or V2 live
acceptance. Native, keyboard and assistive-technology gates remain OPEN. O03 stays
open. Source permissions and owner decisions are unchanged.

## Production acceptance still required

Verify exact deployed assets and protected anonymous boundaries after normal
release. In the signed-in app, complete a real office/day with more than ten
visits. Reconcile discovered IDs, distinct rendered visits, readable/unavailable
counts and all six field-chart numerators/denominators directly from source rows;
check first/middle/last evidence and original receipts. Check date changes,
Preview paging independence and automatic refresh. Keep patient/staff identifiers,
raw source values and private screenshots out of public evidence. Do not mark the
connection accepted merely because the synthetic tests or release checks pass.
