# Connected patient history acceptance

The October 15, 2026, 19:01 UTC implementation pass completed researched P1-C.
Release `af2a833ba17bd48772d531bf9d3996d5cad3a9ca` passed both jobs in
GitHub/Firebase workflow `38791267449`. No private identifiers or source payloads
are included in this report.

## Result

- Readable live Overview and Visit Preview rows offer **Saved calendar history**
  when an exact numeric patient ID is present. Demo examples and unavailable
  details do not offer the shortcut.
- Selection carries the current office and exact patient ID into Patient
  workbench, clears prior evidence/capture input, focuses the patient field and
  loads the existing protected history GET route. It creates no import and
  enables no read or role permission.
- The server continues to re-read patient demographics and verify current
  patient/office membership and release settings on each history request.
- Source-page refresh, paging/date changes, mode/session or office/policy changes
  invalidate the selected source context. Patient changes fence late successes,
  late errors and detached saved-version/paging controls. A failed history read
  clears prior evidence and is not presented as an empty successful history.
- Saved versions retain manual-source interpretation, capture/import timestamps,
  original source text and daily recorded-tile charts. Live visit charts remain
  separate on-demand, partial source evidence.

## Validation

All 151 frontend tests passed, including six new connected-history regressions.
They cover both source views, exact GET targeting, manual provenance and chart
values, source refresh/detached controls, cross-patient late errors, lost access,
and malformed/foreign-office/locked/mode/session selections. Existing backend
scope/idempotency contracts are unchanged. Asset freshness, whitespace and
repository audit checks passed; the normal release workflow ran its full checks.

Normal-session production acceptance verified:

- Demo remained off and ordinary administrator sign-in restored after reload.
- Both source views opened Patient workbench with the same patient selected by
  the existing live-patient read action. That patient's empty history was
  correctly distinguished from unavailable access.
- Refreshing the source cleared the selected patient, saved list and details.
- The previously imported patient's two saved month versions remained readable.
  October rendered 41 visit rows and three authorization rows, with daily chart
  values totaling 41. September rendered 36 visit rows and three authorization
  rows, with chart values totaling 36. Capture/import provenance and manual
  labels remained visible. No import POST was performed in this acceptance pass.
- Served dashboard, workspace and app JavaScript matched tested build hashes.
  Anonymous session/history requests returned 401; `/primetime` retained
  `noindex, nofollow, noarchive`.

Late-response, foreign-office and revoked-access edge cases use synthetic
fixtures rather than production patient changes. This acceptance proves
administrator navigation and retained evidence; it does not release external
patient/therapist roles, validate authorization usage, classify EVV or establish
agency-wide source completeness.

## Next work

P1-D is bounded patient authorization discovery/detail selection through existing
read gates, preserving unknown units, period/basis and completeness. P1-B still
needs authoritative office/supervisor membership and legacy investigation
reconciliation. Owner representative-record interpretation and external-role
form/sharing prerequisites remain open. Further manual HHA capture requires
normal sign-in in the preserved HHA tab.
