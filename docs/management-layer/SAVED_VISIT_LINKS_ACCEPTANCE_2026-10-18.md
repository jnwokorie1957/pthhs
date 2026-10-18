# Saved-calendar links to current visit evidence

P1-E was implemented for the October 16, 2026, 13:59 UTC dashboard heartbeat.
Code release `a59bf0a2d447934f1102c174b98bb27433870dc8` passed both normal
GitHub/Firebase jobs in
[workflow 38913095518](https://github.com/jnwokorie1957/pthhs/actions/runs/38913095518).
Initial acceptance began October 16; after the session resumed, fresh source
acceptance completed October 18. Source verification below is dated October 18,
not backdated to the trigger. Private identifiers and payloads are excluded.

## Behavior and access boundary

Each uniquely identified saved-calendar visit has an explicit **Read current
visit** action when the existing visit/demographics reads are enabled. Missing,
invalid or duplicate IDs and mismatched snapshot scope have no actionable link.
Opening a snapshot does not automatically read its current visits.

The protected administrator POST `/workspace/patient-visit` accepts only exact
visit, patient and current office IDs. It checks operational release, office and
both existing owner read gates before dispatch. A unique current GetVisitInfoV3
record must match the requested visit and patient. A subsequent current patient
demographics read must uniquely match that patient and current office. Settings
are checked between reads and before response. Historical tile membership alone
does not authorize current evidence. Existing source transport budgets, vendor
gates, no-store handling and operation-only read audit behavior are retained.

Current raw fields appear in a separate section with source fetch and
patient-office check times. Independent SOAP reads are not an atomic source
snapshot. Source timestamps are unconverted, interpretation remains unvalidated,
and no clinical, EVV, payroll or billing acceptance is inferred. The saved
capture, import time, chart and original source text remain unchanged.

Patient, version, policy/office, mode and session guards fence detached controls
and late responses. Only the latest explicit current-read request may render.
Failed or unverifiable reads clear current evidence while retaining the dated
saved capture. No source mutation, new import, access grant or notification was
added.

## Verification

- All 163 frontend tests and 471 backend tests passed, including six new UI and
  seven new server regressions. TypeScript compilation, generated assets,
  repository integrity and whitespace checks passed.
- Synthetic cases cover reassigned/foreign visits, foreign or incomplete patient
  office evidence, invalid IDs, ambiguous results, closed gates, policy changes,
  revoked release, stale successes/errors and detached controls. Production
  patient/office records were not altered to test these failures.
- Served workspace, index and dashboard artifacts matched tested bytes; the
  normal release's full build passed. Anonymous session/new-route access was
  401; private noindex/nofollow/noarchive remained intact, rechecked October 18.
- The normal administrator session was live with Demo off. Fresh October 18
  current reads from both retained monthly snapshots matched the selected exact
  visit/patient identities after server office verification. Both capture tables
  stayed byte-for-byte equivalent at the displayed source-cell level. October
  chart/table counts remained 41; September remained 36.
- Switching saved versions cleared prior current evidence. Fetch and membership
  check times and the saved/current distinction were visible.
- Fresh October 18 source paging returned ten readable records, ten different
  next-page records, then the identical first page on Previous. All six chart
  field counts and denominators matched visible evidence on each page. The
  preview remained partial/truncated/on-demand, not an office census or import.
- Patient fields, capture input and saved results were cleared before the
  final patient-free screenshot. HHAeXchange remains on normal login; no new
  browser captures or manual imports occurred.

## Remaining work

P1-E is complete within this administrator read-only scope. Representative
source-field/unit/period interpretation, approved authorization-detail
entitlement, P1-B office/supervisor migration and external-role/clinical gates
remain open. Normal HHA sign-in is the next owner action for further UI capture;
existing protected representative-record validation is still needed.

P1-F is a proposed independent follow-up: filter loaded saved-calendar rows by
date, visit ID or source text, show matched/loaded counts and a clear-filter
action, and preserve the full capture/chart and source provenance. It needs no
new source permissions and must not imply complete agency coverage.
