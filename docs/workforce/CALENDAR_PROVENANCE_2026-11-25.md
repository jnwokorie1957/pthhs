# Caregiver calendar references and update provenance — November 25, 2026 UTC

[PR68](https://github.com/jnwokorie1957/pthhs/pull/68) implements the bounded
calendar projection proposed in the November 25
[role research](../management-layer/ROLE_WORKFLOW_RESEARCH.txt).
Feature source: `3ca8601aac1b4293528df0517709171436984cd4`.
Final validated source: `743c406a51897ada91901056be717297247168a5`, including PR69/PR70.
It is staged source for separately approved Phase 2 scheduling.

The previous own-calendar response contained only the recurring schedule,
location and weekly hours. Equal-looking assignments had no stable returned
reference, and the view could not distinguish an office edit from a new read.

## Result and boundaries

The existing authenticated own-schedule read now returns:

- `assignmentRef`: a stable opaque SHA-256 reference scoped to the existing
  recipient, office, caregiver calendar and assignment identity. An office
  schedule edit retains the reference. It grants no access and adds no lookup
  route. Internal application/caregiver/office/account IDs are not projected.
- `revision` and `updatedAt`: the stored positive safe-integer version and
  canonical UTC office-change instant. Missing/invalid values become null.
- `origin: office_confirmed_portal` and `timeZone: America/Chicago`: the existing
  local schedule model's source and timezone.
- A separate top-level `fetchedAt` for this portal read. This is not an HHA
  receipt, office edit time or claim that a source visit is live.

Each card retains its validated opaque reference in a data attribute and
displays its office-confirmed origin, schedule version and last office change.
A separate checked-time label shows when the portal response was read.
Timestamps display Central time with the applicable zone abbreviation. Missing
or malformed legacy metadata stays unavailable; no reference or update is
invented. Late replies cannot render after leaving the view.

The existing recipient, linked-office, reciprocal caregiver-link, recent
authentication and scheduling-release checks remain. Stored records and assignments retain their schema and data. The metadata
read adds no writes, HHA calls, signature changes, IAM changes or permission
grants. Weekly hours remain nominal
planned coverage, and local conflict checks still concern local assignments.
No HHA visit, patient/PT encounter/document, authorization, EVV, paid-hour or
billing linkage is established.

Older clients can ignore the additive response fields. A new client receiving
an older response still renders schedules with unavailable metadata. Active
sessions are not forcibly reloaded. The caregiver and workforce entry changes
are limited to the schedule asset version, `901537497ec2`.

## Validation and release evidence

Four frontend and two backend regressions fail on the prior source. All 17
affected store tests pass, including recipient/office/link/module boundaries,
stable distinct references, office revision updates, invalid metadata and
read-only behavior. Four controller cases pass against both editable and
generated code, covering receipt/update distinction, equal-looking cards,
legacy metadata, revised labels, empty replies and departed-view suppression.

All 779 root frontend/tooling tests across 47 discovered files and 1,059 backend tests pass.
TypeScript, JavaScript syntax, deterministic runtime/assets, repository audit
and diff checks pass. Calendar coverage is registered from the existing navigation suite, preserving
the release-control test runner. Existing workforce budgets of 392 KB raw / 134 KB gzip remain.
Fictional records and simulated services only; no production data was used.

Both PR68 quality jobs pass in run45641742449. Its main release scope correctly
refuses mixed application and release-control changes in run45642037469: the
added build-and-verify.sh invocation was a release-control edit. All three
deployment jobs skip. PR69 restores the runner exactly to pre-feature bytes. Both quality jobs pass
in run45642673632. Its isolated main proof, run45642988257 at
438a1434a021f65736bdab174195fb61c3895a26, explicitly selects scope none and
skips all three deployment jobs. PR70 registers unchanged calendar cases through
the existing navigation suite. Both [PR70 quality jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/45643465128)
pass. The [normal push scope](https://github.com/jnwokorie1957/pthhs/actions/runs/45643774885)
verifies the final source and completes successfully. Hosting, backend and
analytics jobs all skip under the publication-date hold. This is not production
delivery. The test runner retains its exact pre-feature bytes.

Forward fixes preserve that failed/mixed first-parent history. Scheduled
publication must retain the existing refusal until release-history review is
reconciled under the normal workflow. An isolated follow-up success is not a
waiver of that history, and no allowlist, classifier, date or force-push exception
is introduced. The January 1, 2027
Central publication hold and separate scheduling-module approval remain.
No manual publication or date/message override is introduced.

## Remaining acceptance

After permitted publication and scheduling approval, use approved test records
to verify distinct equal-looking assignments, stable references across an office
edit, the new version/update label versus read receipt, and legacy unavailable
metadata. Confirm other-account/office, withdrawn-link, recent-login and closed-
module boundaries in the actual deployed application. Record exact source and
browser evidence before closing production/authenticated acceptance.

The preceding browser input-geometry failure remains separate; this work does
not establish a current authenticated Primetime/HHA session. Patient/representative
capabilities, effective PT assignment and exact source encounter/form/version/
reviewer/released-copy mappings remain open. Original October 24 remains resolved
by October 31. No communication or clinical/financial decision was made.

Local evidence uses `calendar-provenance-*-20261125`. Recovery is a reviewed
forward revert through the normal workflow; no data migration is required.
