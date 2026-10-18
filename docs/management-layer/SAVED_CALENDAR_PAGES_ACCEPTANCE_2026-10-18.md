# Paging loaded saved-calendar visits

The October 18, 2026, 22:15 UTC implementation pass completed P1-G in frontend
release `3148dd4534047a74fcfc1ecc004af693207e27f3`. Both normal jobs passed
[workflow 39171681932](https://github.com/jnwokorie1957/pthhs/actions/runs/39171681932).
This report contains no patient/staff identifiers or source text.

## Implemented behavior

Loaded saved-calendar visits render ten matching tiles per page, in original
source order. The count distinguishes visible range, matched rows and all tiles
in the loaded capture. Previous/Next saved visits have disabled boundary states;
the page summary explicitly identifies local paging and no additional source
fetch. Controls precede the table, and page changes focus the count message.

Filters compose over the full loaded capture, then paginate their matches. Filter
changes, clear and opening another version start at page one. Empty matches show
zero matched with the loaded denominator retained. The chart continues to show
the full saved capture. Authorization rows, captured text and import/capture
provenance are unchanged. This is dated manual evidence, not a complete office
census, durable live import or validated clinical/financial interpretation.

Page/filter changes clear separate current evidence and fence in-flight reads,
late errors and detached row/page controls. Detached controls cannot cancel a
new version load or act after patient, office/policy, mode or session changes.
Duplicate IDs are checked across the entire capture, including other pages.
Explicit current reads retain P1-E's server visit/patient/current-office checks
and existing gates. No backend code, permission, source write, import or
communication changed.

## Verification

- All 178 frontend tests passed, including eight new pagination regressions:
  ordered traversal/conservation, boundaries, filter/empty/reset states, chart
  and provenance preservation, duplicate IDs across pages, later-page identity,
  late successes/errors, detached contexts and pending version loads. Synthetic
  page/filter actions made no extra source/storage requests. Backend unchanged;
  both normal release jobs passed.
- Generated asset, repository integrity and whitespace checks passed. Served
  HTML/workspace/dashboard/CSS exactly matched tested bytes. Private noindex,
  nofollow and noarchive remained; anonymous session/current-visit requests
  returned 401.
- Fresh signed-in production, Demo off: October traversed 10/10/10/10/1 rows,
  all 41 unique visit IDs, with full chart total 41, three authorization rows and
  unchanged provenance. Previous restored the original fourth-page cells.
  Last-page Next was disabled.
- A current read from the last page matched the selected visit and patient;
  navigating back cleared current evidence. Reassignment/revocation/race cases
  remain synthetic; no real record was changed to test them.
- A date filter matched its expected source rows and reset the page. Uppercase
  text filtering produced 31 matches; its first/second pages exactly matched the
  expected ordered subset. Adding an exact ID reset to one matching row. A
  no-match query showed zero of zero matched, 41 loaded, both controls disabled
  and the full chart retained. Clear restored the original first page.
- Opening September reset all filters/current evidence and began page one of
  four. Traversal produced 10/10/10/6 rows with chart total 36; displayed bar
  values matched visible counts. Last-page Next was disabled.
- Controls and count/navigation text were visible at the current 615px viewport.
  A cropped screenshot was visually verified free of patient/staff details.
  Patient/capture fields and saved results/history were cleared afterward.
  Existing tabs are preserved. HHA remains on normal login; no new capture or
  import was performed. Live source paging/charts are unchanged from prior
  acceptance; this pass did not revalidate source paging or agency coverage.

## Remaining work

P1-G is complete in the protected administrator presentation scope. Proposed
P1-H: let a full-capture day-chart control select the existing saved-date filter,
with keyboard operation, explicit selected-date feedback and stale-control
guards. Preserve the full chart, loaded denominator and current-read fences.

P1-B office/supervisor migration, external identity/form/signature prerequisites,
representative field/unit/period validation and approved detail entitlement remain
open. Normal owner HHA sign-in is needed for more tenant UI evidence; protected
representative mappings must use existing approved operational rules.
