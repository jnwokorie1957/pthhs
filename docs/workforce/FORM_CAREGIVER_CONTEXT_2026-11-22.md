# Client-form preparation caregiver context

[PR52](https://github.com/jnwokorie1957/pthhs/pull/52) implements a bounded
office form-workflow correction. Runtime: afc91238ff377394c725d72e3a8379900cfe0fdb.

Changing the caregiver query invalidated lookup results but left the packet's
preparation context active. If a template read was delayed, preparation could
still send a draft save for the previous caregiver. A delayed save could reopen
that previous packet after the selection changed. A removed caregiver-result
button could also replace the current selection.

Caregiver edits and selections now advance the existing context/read counters
and clear packet navigation. Existing current-context guards stop preparation
after a stale template response and suppress old save/open/error responses.
A fresh explicit preparation uses the current selection. This preserves the
client/caregiver context acceptance described in
[role research](../management-layer/ROLE_WORKFLOW_RESEARCH.txt).

A local save already sent before the change may still finish under its original
data. The client cannot cancel that completed server action; this correction
does not delete or rewrite it. Its late response cannot reopen the old packet,
and saved drafts remain in the existing Saved client forms workflow. This does
not implement durable packet resume or clinical admission completeness.

Only the controller, its versioned workforce reference and regression test
change. API paths/payloads, record formats, office/role checks, source reads,
signature behavior, configuration and existing records are preserved. Already
open pages retain their requests without a forced reload. No patient/PT source
join, new role, field mapping or clinical/financial interpretation is added.

## Validation and delivery

Three new regressions fail against the previous controller. Ten focused tests
pass after correction, covering a delayed template read, a late save, a detached
caregiver choice and hiding an existing packet before preparing for a new
caregiver. All 758 frontend/tooling tests across 46 root files pass. Asset
references, repository audit and diff checks pass. The test uses fictional
people and simulated APIs; no real record is created.

The guarded release-scope check at
[440c251 / run44995753708](https://github.com/jnwokorie1957/pthhs/actions/runs/44995753708)
completed its scope step successfully, with Hosting, backend and analytics
deployment jobs skipped. This is the separate no-deploy control proof. The
current PR changes no release controls and follows the normal compatible
serial workflow; a window-deferred check was not substituted for scope proof.

Six production baseline artifacts match main at November 22 19:40:24 UTC,
including both relevant controllers, the unchanged Field Visits controller
and the workforce/caregiver/Primetime entries. Workforce/Primetime noindex/cache
and anonymous session 401/no-store/noindex pass.

Both [quality jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/45062151095)
and all four [normal release jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/45062312677)
pass. At **November 22 19:47:16 UTC**, six production artifacts match the exact
runtime. The workforce page references workflow `3830f5bcdb62`; private-PDF
`3a7b169dc233` and Field Visits `ac4601c681ed` remain unchanged. Workforce/
Primetime meta/header noindex and cache protections plus anonymous session
401/no-store/noindex pass. All ten focused tests pass against the actual served
workflow and private-PDF controllers, with simulated requests/PDF dependencies.
This verifies delivery and controller behavior, not authenticated office UI
acceptance. No native-browser acceptance is claimed.

## Remaining acceptance

Authenticated office UI acceptance remains separate. No current HHA UI/API
read, live-data comparison, production form upload/save, signature or message
was used for this check. Earlier URL-verification and sign-in observations
retain their dates. The owner still needs the approved blank form/business
version, exact field sources, signers/reviewer and permitted recipients before
clinical automation or sharing. Patient/PT assignment, typed clinical record
links and source duration/interpretation contracts stay open.

Original October 24 remains resolved by October 31. The existing source/vendor
and held-visit requirements are not cleared by this office workflow change.
Local evidence uses form-caregiver-context-*-20261122 output names. Rollback
is a scoped PR52 revert through the normal release workflow.
