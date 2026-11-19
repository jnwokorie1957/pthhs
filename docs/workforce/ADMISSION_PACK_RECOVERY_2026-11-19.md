# Admission-pack progress and library refresh recovery

Implementation: [PR47](https://github.com/jnwokorie1957/pthhs/pull/47),
runtime `896666cec21842b46d4ca8ad4a4a84ab52749267`.
This implements the partial-pack progress acceptance described in the
[November 16 role research](../management-layer/ROLE_WORKFLOW_RESEARCH.txt).

## Problem and resulting behavior

The library loader caught a failed list refresh without returning its result.
After the importer saved every form, it could announce completion and disable
its retry even though that refresh failed. A throwing refresh also left the
button disabled. Mixed outcomes had per-form text but no separate counts.

The importer now retains added, already-present, failed and not-attempted
outcomes separately. Retry submits only unfinished forms. When every form has
an upload/duplicate result, a failed list refresh offers **Refresh library**;
that action calls the existing list loader without uploading the forms again.
Completion wording requires a successful refresh and still directs the office
to prepare a separate client copy. A library result is not a patient admission
or completed clinical packet.

`WorkforceAdmissionLibrary.load` returns true only after a current successful
list render and false after a failed or superseded read. Other existing callers
can ignore that result. `WorkforceAdmissionPack` keeps its current-context and
session-cleared checks around reads, uploads, errors and control recovery.

The four changed files are two public controllers, their versioned references
in the workforce entry and the regression test. API paths/payloads, office and
role checks, private storage, signatures, source records and configuration are
unchanged. Old open pages can continue their existing requests; no reload is
forced. The reviewed compatible release uses the existing serial workflow.

## Verification

Four new regressions failed before the correction. All eight focused tests
pass, including mixed duplicate/failure results, false/throwing refresh failures,
no duplicate upload on refresh-only retry, the real loader's result contract
and a late failure after sign-out. All 695 broader frontend/tooling tests pass.
Workforce asset references, repository audit and diff checks pass; existing
binary/vendor-file audit warnings remain unchanged.

The local browser fixture uses four fictional blank forms and simulated APIs.
It displays one added, one existing, one failed and one unattempted result.
Resuming submits only the two unfinished forms. The subsequent list refresh
fails explicitly; its retry changes the simulated read count from two to three
while upload requests remain five. It then displays three added and one
already present. No real template, client copy or signature was created.

Both [quality jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/44435144629)
passed. All four jobs in the
[normal compatible full release](https://github.com/jnwokorie1957/pthhs/actions/runs/44435315723)
passed: scope, backend, Hosting and analytics. At **November 19 01:19:50 UTC**,
six production artifacts match the exact runtime commit. The workforce entry
references pack `59ffd32dcadc` and library `f07475d77ba9`; the Field Visits
controller, caregiver and Primetime entries retain their preceding bytes.
Private page/header noindex and no-cache plus anonymous session 401/no-store/
noindex pass. All eight focused tests pass against both served controllers.
The six-artifact pre-release baseline also matched `fc2176c`.

A fresh production staff entry references both new versions and retains its
noindex metadata. It currently requires staff sign-in; the import control is
not rendered in that state. This is delivery and denied-access evidence, not
an authenticated real-office import. No sign-in link was sent. The normal
release summary was independently observed with all four jobs successful.

## Remaining acceptance and owner decisions

Real-office import acceptance must use the office's independently approved
blank form and ordinary authorized workflow. This task does not create test
records in production to clear that condition. The existing owner must approve
the form's business version, source field namespaces, signers/reviewer and
recipient roles before clinical automation or sharing. Typed HHA patient/office
linking, Medicaid/contract mappings and patient/PT access remain separate.

No current/historical HHA read or time recovery was performed. Original October
24 remains resolved by its October 31 receipt; the other original-event,
history/units/readback, CSM/private-channel and held-visit decisions remain open.

Local evidence uses `admission-pack-*-20261118` output names for the preparation
date; JSON `checkedAt` fields record actual delivery times. The browser fixture
and its screenshot are explicitly synthetic and remain outside public assets.
Rollback is a scoped revert of PR47 through the same release workflow.
