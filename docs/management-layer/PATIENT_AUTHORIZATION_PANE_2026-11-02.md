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

## Verification and bounded production acceptance

Six new checks pass, including independent/invalid receipt handling and isolation
from unrelated owner-control messages. Four behavioral regressions fail against
the prior generated app; the status regression fails against the first release.
All 370 frontend/tooling tests, 563 backend tests and 46 analytics tests pass.
The pane adds no backend operation or grant. Concurrent billing code is preserved.

Forty-eight syntax/prechecks and all 24 generator/QA steps pass. Marketing
generators preserve private app bytes. Local Bash syntax was unavailable;
unchanged shell files were checked by successful normal CI. Final app/catalog
output is 419973 bytes with gzip below 102000, within unchanged 420000/102000
limits. Twenty-four duplicate aliases exactly matched the HTML labels; sharing
them and shortening instructions funds both concurrent features without removing
controls, cautions or increasing budgets. Owner checkbox values/labels are intact.

Runtime 31344bfc2516e5990fb7c475b93b48afb14dcac4 passed all three normal jobs in
workflow 41477334165. Final status-isolation runtime
fcbe699db5e17c655325a65d45083299b6ba26a3 passed workflow 41478278435:
Hosting 16:07:36, backend 16:08:10 and analytics 16:09:11 UTC on November 2.
Public verification at 16:14:43 UTC matched twelve exact app artifacts,
eleven anonymous JSON401/no-store private boundaries and private noindex.
The later concurrent backend-only EVV projection bd16ce83a836ade938b4bc3f90167b769a37e535
was fast-forwarded without changing pane assets; its workflow 41479943139
also completed successfully. Existing billing activation/trial evidence is retained.

Authorized native acceptance, November 2, 16:17–16:24 UTC:
- Open patient authorizations routes to Patient workbench with one shared form,
  exact source-patient context, read-only inline IDs and hidden workflow selector.
  Selecting the action clears prior facts and makes no automatic source request.
- The first explicit discovery returns the same thirteen source records as the
  protected baseline. Thirteen exact selectors remain; thirteen obsolete duplicate
  selectors are gone. One exact patient/authorization/contract selection returns
  fourteen detail fields, all unchanged from baseline, with separate discovery
  and detail receipts and raw-unit caution.
- An unrelated successful Reload current preferences does not overwrite the
  authorization completion status or its fourteen facts. Changing the visit
  date to October 24 retains the independent patient/office authorization facts.
- Selecting a different current patient profile clears those facts, IDs and
  selection, restores the general reader and rejects former context. Reopening
  authorization discovery binds the new source patient with one shared form.
  Its explicit read returns twelve exact selections; no source write occurs.
- Advanced tools restores the workflow selector and editable general ID inputs.
  Demo clears populated results/inputs, restores and disables the source reader;
  returning Live retains no old authorization facts.
- Overview is restored to office day November 2 with live API feed active, ten
  readable first-page visit rows, source receipt 16:23:04.581 UTC and no horizontal
  page overflow at a 1280px desktop viewport. This is bounded page evidence.

Private identities, raw fields and before/after comparisons existed only in
temporary browser memory, which was reset after acceptance. No source values
were written to research, logs, assets or Git. Native mobile, sign-out/revocation,
malformed receipt, quota and late-response variants were not induced; applicable
failure/race cases remain covered by synthetic tests. No screenshot acceptance
is claimed.

## Status isolation and concurrent work

The first release exposed a UI-only issue: Reload current preferences could
overwrite the pane's read status. Only source-read selection/progress/completion/
error messages now address that status. The sixth regression and native reload
check pass. Other workspace actions retain their own messages. Source requests,
permissions and backend behavior did not change.

The first expected-head publication met concurrent billing commit 3b560b6. It
was not forced over that work. A path-limited stash preserved this pane; source,
tests and checklist merges were retained, and generated conflicts were resolved
by rebuilding merged sources. Billing readiness 82dcf0a and later bd16ce8 EVV/
billing evidence are retained. No grant was changed by this pane implementation;
the separate owner-approved legacy billing activation belongs to its own record.

T05 is accepted for this bounded administrator connection. This does not
activate external patient/family/staff/PT access, clinical forms, source writes,
billing decisions or communications. T03, P09 and the resolved original
screenshot case stay accepted. P1-B/P2 membership/assignment/form/sharing/action
evidence, S02, T04, B02 usable billing detail and source unit/period/service/
coverage interpretation remain separate. No new owner read grant or policy
attestation is needed for this administrator pane.
