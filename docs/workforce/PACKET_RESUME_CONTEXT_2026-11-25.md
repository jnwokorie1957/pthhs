# Saved-packet resume context — November 25, 2026 UTC

[PR66](https://github.com/jnwokorie1957/pthhs/pull/66) is merged as
`2c6d335927207b40e82f560a2f99ae9e61c26876`. This is tested staged source
for the later admissions/forms phase. It has not been published to production.

A delayed saved-packet response could replace a newer packet choice. It could
also reopen an old document after changing form type or editor context. A late
document-read error could replace the current packet status. Four synthetic
regressions reproduce these failures against the prior controller at 405ae92.

Resume now captures the existing navigation generation and editor context
before its read, and checks both before replacing packet membership or opening
a document. A newer resume, form selection, client/caregiver context or editor
selection invalidates the old response. Document-read failures use the same
current-context conditions; a current failure still appears for recovery.
Existing saved-packet and local-document IDs continue to link the same records.

Only the editable controller, generated asset, asset version in workforce.html
and its regression tests change. The generated workflow version is
`537565512e8e`. API paths/payloads, persistence, signatures, role/office checks
and release controls retain their existing contracts. Reads cannot make a
document signed or clinically complete. Previously sent local writes are not
cancelled, deleted or reassigned by this client correction.

## Validation and staging

All four new regressions fail before correction, while the prior 13 tests
pass. After correction all 17 focused tests pass against both editable source
and the generated asset. All 775 root frontend/tooling tests across 47 files
pass. Runtime/asset currency, JavaScript syntax, repository audit and diff
checks pass. The audit retains existing unrelated warnings. Test data and APIs
are fictional; these tests do not create a production record.

Both [Repository quality jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/45531133785)
pass, including the full static build/verification and backend test job.
The [normal release workflow](https://github.com/jnwokorie1957/pthhs/actions/runs/45531274060)
is subject to the January 1, 2027 Central publication hold in
[staff release policy](../releases/STAFF_RELEASE_POLICY.md).
Run45531274060 completed successfully: publication-date and release-scope steps
pass, and Hosting, backend and analytics deployment jobs are all skipped.
This confirms the publication hold; it is not production delivery of PR66. No manual release or commit-message override is authorized
by this change.

## Remaining role acceptance

The date gate and later admissions/forms module approval are distinct.
After permitted publication and module approval, an authorized office reviewer
should use approved non-sensitive test records to resume two packets in quick
succession under a delayed read, change form type and editor selection while
resume is pending, and confirm that only the latest context opens. Verify that
the same saved packet/document membership survives reload, current read errors
remain recoverable, and signing/export still require the existing permissions
and document-specific steps. Record the exact deployed source and actual
browser result. Until then native/authenticated office acceptance is pending.

Patient/representative access still needs explicit released-copy permissions.
PT/staff clinical documentation still needs effective assignment, encounter and
document/version linkage. This local office navigation fix supplies neither
clinical source linkage nor a new role grant. Approved blank forms, field
sources, signers/reviewer and permitted recipients remain owner dependencies.

No fresh HHA UI/API read, time comparison, form save/signature, clinical or
financial decision, communication or access expansion was used. The prior
browser URL-verification blocker was not bypassed. Original October 24 remains
resolved by the October 31 independent reread. Local evidence uses
`packet-resume-context-*-20261125`; rollback is a reviewed forward PR66 revert.
