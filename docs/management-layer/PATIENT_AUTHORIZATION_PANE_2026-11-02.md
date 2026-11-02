# Patient authorization pane — November 2, 2026

This implements the next bounded administrator connection from the role research.
Open patient authorizations now opens the existing source reader inside Patient
workbench. The calendar-history Live authorizations entry uses the same pane.
The shared form and result nodes have one owner at a time; Advanced tools restores
the general reader. No duplicate reader or backend operation is added.

## Scope and source contract

The pane reuses the already approved SearchPatientAuthorizations and
GetPatientAuthorizationInfo route, current patient/office checks and exact unique
authorization/contract selection. The context-selected patient and authorization
ID fields are read-only while inline; the unrelated workflow selector is hidden.
Choosing another patient profile removes the old results and rejects late
responses. Office/release/Demo/sign-out transitions retain the existing reset and
permission fences, including the shared form after relocation. Changing a visit
date does not reinterpret this independent patient/office authorization scope.

Discovery and detail fetch receipts are separate. A detail retains its discovery
receipt, and malformed, bare-date or floating fetch timestamps fail validation
before facts display. Source errors are visible in the pane. There is no automatic
source request when selecting a patient or authorization. Each read remains an
explicit action under existing server quotas/read gates; this does not claim the
broader W03 retry/status matrix complete.

Only the existing exact selector remains. An obsolete duplicate Inspect
authorization units shortcut did not retain the discovered contract or apply the
newer selector's uniqueness guard; it has been removed. No missing identity,
unit, zero/empty limit or same-name contract is replaced by a label or inference.
MaxUnits, RemainingUnits, BankedHours and period limits stay raw; no utilization,
remaining hours, service eligibility or financial outcome is computed.

## Verification and release readiness

Four new behavioral regressions fail against the prior generated app. All six
new checks pass, including independent/invalid receipt handling. All 370 frontend
and tooling tests and 46 analytics tests pass. The concurrent legacy-billing implementation is preserved. The combined tree
passes 563 backend tests; the pane adds no backend operation or grant. Normal
backend CI still runs before production acceptance.

Forty-eight syntax/prechecks and all 24 generator/QA steps pass. The marketing
generators preserve private app bytes, and no generated release inputs drift.
Local Bash syntax could not run because Bash is unavailable; shell files are
unchanged and the normal CI workflow supplies that check. The app/catalog is
419973 bytes and gzip estimate below 102000, within unchanged 420000/102000 limits.
Twenty-four duplicate aliases already exactly matched the HTML option labels;
sharing those labels funds the pane without increasing a budget or removing a
control. Owner read checkbox operation values and their existing labels remain
the same.

Initial runtime31344bfc2516e5990fb7c475b93b48afb14dcac4 passed all three normal
jobs in workflow41477334165. The status-isolation follow-up and native acceptance
are pending. Do not mark this
connection complete from local tests alone. The protected pre-release session
remains authorized; one current patient returned 13 exact discovery selections
and 13 duplicate legacy shortcuts. Private identities and values remain in
temporary browser memory only for an exact before/after comparison.

This does not activate external patient/family/staff/PT access, clinical forms,
source writes, billing decisions or communications. T03 source acceptance,
P09 time-field acceptance and the resolved original screenshot case stay accepted.
Broader P1-B/P2 membership/assignment/form/sharing/action evidence, S02, T04 and
remaining source/unit/coverage interpretation remain separate. No new owner read
grant or policy attestation is needed for this administrator pane.

The first expected-head publication met a concurrent billing commit3b560b6. The
unpublished own commit was not forced over it. A path-limited stash preserved
the pane; source/test/checklist merges were retained and two generated conflicts
were resolved by rebuilding from merged sources. The combined root/backend and
asset/performance checks pass. Concise instructions and shared labels fund both
features under the original budgets; no control or warning gate was removed.

## Read-status isolation follow-up

A sixth regression reproduces an unrelated owner-controls reload overwriting the
inline authorization status. Only source-read selection, progress, completion
and errors now address that status. Other workspace actions keep their own
messages. The regression fails against31344b and all370frontend/tooling checks
pass after the correction. No source query, value, read permission or backend
behavior changes. Final normal release and native acceptance remain required.
