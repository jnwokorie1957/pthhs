# Field-visit lookup context — November 15, 2026

Prepared November 16 UTC (November 15 America/Chicago), against main
d1dc6cce17a024cfe4da36329446f5cfc3fe95ec. Concurrent PR38 admissions/client
directory/activity history and PR39 admission-pack import, plus the reviewed
laundry article, are preserved.

Changing a client/caregiver query previously left older matches selectable.
A delayed result or failure could appear under replacement text, and the
pending action blocked a new lookup. Returning to the same text also accepted
the earlier result. Six behavioral regressions reproduce these failures on
the current upstream controller (15 tests pass; six fail).

Each lookup now captures its editor, office and action version. Typing clears
old matches and invalidates their callbacks. It releases only that lookup's
pending UI action so an explicit new Find can proceed. Old errors and cleanup
cannot affect the newer action. Typing during an unrelated draft save leaves
that save locked. An already issued API read may still finish on the server.
Typing itself performs no read, automatic selection, retry or source action.

Verification before release:
- All 21 controller tests pass; seven added cases cover client/caregiver
  query changes, obsolete selectable matches, replacement requests, A-B-A text,
  old errors and unrelated pending saves.
- All 710 site/tooling/analytics tests across 40 files pass on current source.
  Eight fallback-time tests in each of UTC, America/Chicago and Pacific/Auckland
  passed separately before the unrelated concurrent changes.
- Deterministic workforce references, controller syntax, form layout,
  accessibility and performance checks pass. Windows Python uses UTF-8 mode.
- The shipped controller is whitespace-compacted using the existing locked
  Terser 5.51.2, compress:false, mangle:false, format:{quote_style:1}.
  No identifier/property mangling, logic optimization, new dependency or
  performance-budget increase is introduced. The test stub replaces only
  the extractor import expression, tolerating harmless await parentheses.
- Labelled localhost/fake-API Chrome verification holds an old lookup,
  completes a newer lookup, then releases the older response. Only the new
  match remains and explicit selection populates its synthetic name/member
  reference. No real patient, staff, visit, upload, signature or HHA read.

Release completed: PR40, source c6dcc7e9b4c5a06c45c36c6b186f189755b19b81.
Both quality jobs (43784656232) and Hosting-only release scope/build/deploy
(43784887030) succeeded; backend/analytics were skipped. At 01:14:45 UTC,
all 37 production artifacts match Git, caregiver configuration is unchanged
and private noindex/cache/anonymous API-denial protections pass. All 21 tests
pass against the exact served controller (SHA-256
9806f920ff72ebc781f605b250cb36b348a12cd254137ce9d5ea1a93071ecb89).
The approved workforce session and blank Forms editor render at 01:15-01:17
UTC, with both lookup controls present. The unsaved editor was closed. No real
source query, save, upload, signature, communication or grant was made.
Ordinary staff real-record replacement lookup acceptance remains separate and
should occur only within an independently authorized workflow.
This is a local Field Visits presentation fix. The researched clinical/source
bridge still requires exact HHA patient/visit/document-instance relationships
and accepted role/form/sharing contracts. No source ID/link, clinical assignment,
document status, original EVV clock/hour, backend behavior, read grant or
signing/sending policy is added. Original October 24 remains resolved by the
independent October 31 reread; other source blockers keep their dated evidence.

Rollback: revert controller/test/reference changes through the normal release
workflow, retaining earlier editor/signing/source guards.

Local nonsensitive evidence: field-visit-lookup-regression-receipt-20261115.json,
field-visit-lookup-integrated-site-tests-20261115.log,
field-visit-lookup-baseline-20261115.json and
field-visit-lookup-synthetic-20261115.png.
