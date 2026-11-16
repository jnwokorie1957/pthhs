# Field-visit editor context protection

Prepared November 13, 2026 from reconciled main `418b88a`, rebased onto
concurrent `3834444`.
Released as PR35 / `864d2ec`, included in runtime `8c18cc0`. Delivery was
verified November 13 at 16:58 UTC. Authenticated staff acceptance remains open.

The existing staff Field Visits editor used a session-level check for delayed
work. Opening a new draft, closing the editor or changing office did not change
that session. A previous upload could therefore supply pages to another draft;
an earlier save or record-open response could replace the new editor; an old
PDF response could still open a preview after Close.

This change ties editor results and errors to the current record selection
and office, invalidates work on Close/new editor/office/session changes,
and aborts obsolete extraction. Upload-kind changes also invalidate the old
extraction and its progress callbacks. File selection is held while extraction
runs. Office-list reads retain their own sequence, including A-to-B-to-A
switches. An old request's cleanup cannot unlock a newer pending action.

Draft payloads use the record captured by that editor. A request already
accepted by the server can still complete for its original record; this change
does not roll it back. Source actions, signatures, permissions, form contents
and backend APIs are unchanged.

## Validation

Ten synthetic regressions exercise delayed saves/errors/uploads, upload-kind
changes, Close during PDF loading, office switches, a delayed record-open,
the newer-action lock and normal current-draft saving. Against the original
controller, nine fail and the normal current-draft case passes. All ten pass
afterward. The release build explicitly includes this test file.

All 710 site/tooling/analytics tests pass after the concurrent-source rebase
(705 before it). Syntax, deterministic workforce
asset versions and performance checks pass. The workforce entry carries the
new controller hash; Primetime operations and backend files are untouched.

Native Chrome tested the actual controller in a visibly labelled local fixture:
hold draft A's save, open and fill draft B, then return A's response. B remains
selected. The fixture uses synthetic names and a local API stub; it is not
authenticated tenant acceptance, a clinical form test or production data.

## Release and remaining acceptance

Both [PR35 quality jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/43466873581)
passed. A subsequent normal push for concurrent PR36 included the merged fix.
Its [combined release](https://github.com/jnwokorie1957/pthhs/actions/runs/43467413367)
passed release_scope, build_and_deploy, deploy_backend and website analytics.
No duplicate manual release was dispatched. PR35 itself changes no backend.

After all jobs succeeded, 32 public/private static artifacts matched the
released Git source. The controller hash is `2b232611500c`; all ten regressions
pass against its exact served bytes. Public caregiver configuration is unchanged;
private entry noindex/cache and anonymous JSON 401/no-store checks pass.
Native Chrome loads the new workforce controller but still requires staff
sign-in. No authenticated field-visit action was exercised.

Existing staff/office permission and sign-in prerequisites remain. Patient,
family and PT relationships/forms, HHA original events, time units and source
writes remain separate. No real field visit, signature, upload, HHA record,
communication, account or grant is created by this implementation pass.

Local nonsensitive receipts: `field-visits-before-20261113.log`,
`field-visits-rebased-site-tests-20261113.log` and
`field-visit-context-synthetic-20261113.png`.
Related proposed record-switch acceptance:
[Role workflow research](../management-layer/ROLE_WORKFLOW_RESEARCH.txt).

Production receipts: `field-visit-release-baseline-20261113.json` and
`field-visit-release-production-20261113.json`.
[Merged PR35](https://github.com/jnwokorie1957/pthhs/pull/35).
