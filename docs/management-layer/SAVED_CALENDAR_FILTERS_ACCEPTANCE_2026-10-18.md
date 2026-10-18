# Filtering loaded saved-calendar visits

The October 18, 2026, 21:55 UTC dashboard pass implemented P1-F. Frontend release
`4180f181631844def918c181104b32f18a86a16c` passed both normal GitHub/Firebase jobs
in [workflow 39170261640](https://github.com/jnwokorie1957/pthhs/actions/runs/39170261640).
This report contains no patient/staff identifiers or source text.

## Implemented behavior

A loaded protected calendar capture offers labeled date, exact visit ID and
case-insensitive literal source-text filters. Filters compose, retain source
order and show matched/loaded visit-tile counts. No matches is distinct from an
empty import history. Clear saved filters restores all rows, clears all three
fields and focuses the date control.

These controls apply only to the selected, loaded manual capture. They do not
query HHA, alter an import, persist search terms or imply agency-wide coverage.
The chart is explicitly labeled as the full saved capture and retains every
saved tile, including when the filtered table has zero rows. Authorization rows,
capture/import provenance and stored facts remain unchanged.

Filter changes clear separate current evidence and fence in-flight reads and
detached row buttons. Version/patient, office/policy, mode and session guards
remain in effect. A duplicate ID remains non-actionable even if filtering shows
only one occurrence. Current reads from matching rows still use P1-E's exact
visit/patient/office checks and existing release/read gates. No backend policy,
permission, source write, new import or communication was introduced.

## Verification

- All 170 frontend tests passed, including seven new filter regressions. These
  cover combined filters, exact/literal matching, empty matches, reset, unchanged
  capture/chart, disabled/duplicate IDs, late responses, detached controls and a
  saved-version load pending while old filter controls fire. No filter/reset
  source calls were observed in the synthetic harness. Backend code was
  unchanged; the full normal release checks passed.
- Generated assets, repository integrity and whitespace checks passed. Served
  HTML, workspace JavaScript and CSS exactly matched tested bytes. Private
  noindex/nofollow/noarchive and anonymous session/current-read 401 remained
  intact.
- Normal-session production, Demo off: October opened with 41 saved rows and a
  chart total of 41. A date filter matched the expected two rows; combined
  date/ID/text filters selected the exact row. Uppercase text search matched the
  expected source text. A no-match query showed 0 of 41 while the chart stayed
  at 41 and authorization rows stayed unchanged. Reset restored the original
  ordered source cells and empty fields.
- An explicit read from a filtered row returned the exact selected visit/patient
  with current fetch evidence. Changing filters cleared that current section.
  Reassignment/revocation/race edge cases remain synthetic; no real record was
  altered to test them.
- Switching to September reset the filters and current section, showing all 36
  saved rows with chart total 36. All controls fit the current narrow viewport.
- A fresh live source page retained ten readable rows and all six chart values
  matched visible field counts. Source paging was unchanged and remains at its
  separately dated P1-E acceptance; this task adds no source paging or durable
  sync. Partial/on-demand/source-unvalidated labels remain in place.
- Patient/capture fields and saved results were cleared before the final
  patient-free screenshot. HHA remains on normal login; no new browser capture
  or import occurred.

## Remaining work

P1-F is complete within this local administrator workflow. P1-G is a proposed
independent follow-up: paginate the loaded matching calendar rows, disclose the
visible range/matched/loaded counts, reset the page when filters/version change
and fence detached page/current-read controls. Preserve the full chart and
manual/current distinction; no new source requests or agency totals are implied.

P1-B office/supervisor migration, external-role/form/signature prerequisites,
representative source-field/unit/period validation and approved detail-read
entitlement remain open. Normal owner HHA sign-in is needed for additional UI
capture; existing approved rules govern protected source-field validation.
