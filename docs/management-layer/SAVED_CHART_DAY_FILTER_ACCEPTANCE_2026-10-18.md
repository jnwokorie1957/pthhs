# Saved-chart day filtering

The October 19, 2026, 00:30 UTC live-dashboard heartbeat (October 18 in
America/Chicago) completed P1-H in frontend release
`56303d8a124e9bda8921b1609422777915dd0360`. Both normal jobs passed
[workflow 39183800704](https://github.com/jnwokorie1957/pthhs/actions/runs/39183800704).
This report contains no patient/staff identifiers or captured source text.

## Implemented behavior

Each day in the full saved-capture chart has a native date-filter button with
an accessible name, controlled-table reference, pressed state and visible focus.
Select a day to set the existing exact-date filter; select it again to clear only
the date. ID/text filters remain applied. A visible selected-date message and
existing status announcement describe the result. Manual date input, clear and
version changes keep button states synchronized.

Selection starts at local page one, retains visible/matched/loaded counts and
clears separate current evidence. Chart bars/counts continue to represent the
full immutable manual capture. Source order/text, authorization rows and
capture/import provenance remain unchanged. No new source/storage request or
persisted preference is added by chart selection.

Detached chart controls cannot act after patient/version, office/policy, mode
or session changes, or cancel an in-flight version load. Existing row/page
revision and current-read sequence checks fence stale actions and responses.
Duplicate IDs across the entire capture remain non-actionable. P1-E's protected
current visit/patient/office checks and existing read/release gates are unchanged.
No backend code, import, source mutation, permission, communication or clinical/
financial decision changed.

## Verification

- All 185 frontend tests passed, including seven new regressions for composed
  selection/toggle, manual/reset feedback, immutable chart/provenance, pending
  reads/versions, detached contexts, duplicates, disabled reads and exact current
  identity. Backend unchanged; both normal workflow jobs passed. Generated
  assets, repository integrity and whitespace checks passed.
- Production HTML/workspace/dashboard/CSS match tested bytes. Private noindex,
  nofollow and noarchive remain. Anonymous session/current-visit requests return
  401.
- Signed-in production, Demo off: October retains 41 tiles across 31 day controls;
  every bar matches its visible count. Enter selected a two-tile day, reset
  paging, returned the exact saved rows and retained the chart, authorizations
  and provenance. Space cleared the date and restored the original first page.
  Native focus stayed on the selected date button.
- Combined ID/text/date filters selected the expected row. Its explicit current
  read matched exact visit/patient identity. Toggling the day retained ID/text
  fields and cleared current evidence. Manual date input updated the pressed
  control and could correctly produce zero matches with the full chart retained.
- September reopened at page one with empty filters, no current evidence and no
  pressed day; chart total remained 36 and selecting a day matched its count.
  Reopening October restored the original first page and empty filters. Race,
  reassignment and revocation cases remain synthetic; no real settings or
  records were altered to test them.
- At the current 615px viewport, date buttons fit and exceed a 24px target size.
  The cropped chart screenshot was visually checked for focus/selection and
  contains no patient/staff identifiers. Patient/capture fields and saved results
  were cleared after capture; existing authorized tabs remain open.
- Fresh live-source first/next/previous pages each had ten readable rows. Next
  returned distinct visit IDs and Previous restored the original IDs. All six
  field-presence chart values/denominators matched each page's actual fields.
  Fetch timestamps are fresh October 19 UTC. Partial/on-demand/source-unvalidated
  labels and unknown office totals remain explicit. These are separate current
  reads, not saved captures or a durable live import; no clinical/EVV/billing
  status is inferred from supplied fields.

## Remaining work

HHA's browser still requires normal sign-in; no new source capture/import was
possible. Owner action remains normal HHA sign-in for further UI evidence and
protected representative field/unit/period validation under existing approved
rules. Approved detail entitlement, P1-B office/supervisor migration and external
identity/discipline/form/signature prerequisites remain open.

Subsequent P1-I caregiver selection is now implemented under existing gates:
[current-visit caregiver acceptance](CURRENT_VISIT_CAREGIVER_ACCEPTANCE_2026-10-19.md).
The chart-day observations above retain their original release scope and date.
