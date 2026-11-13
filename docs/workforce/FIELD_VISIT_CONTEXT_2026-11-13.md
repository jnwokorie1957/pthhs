# Field-visit editor context protection

Prepared November 13, 2026 from reconciled main `418b88a`, rebased onto
concurrent `3834444`.
Release and production acceptance are pending at this checkpoint.

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

Use the normal GitHub quality workflow, then the existing Hosting-only release.
Both required release jobs must pass before checking the served controller and
its entry hash. Re-run the regressions against the exact served bytes and
preserve the private noindex/cache/anonymous-access boundary.

Existing staff/office permission and sign-in prerequisites remain. Patient,
family and PT relationships/forms, HHA original events, time units and source
writes remain separate. No real field visit, signature, upload, HHA record,
communication, account or grant is created by this implementation pass.

Local nonsensitive receipts: `field-visits-before-20261113.log`,
`field-visits-rebased-site-tests-20261113.log` and
`field-visit-context-synthetic-20261113.png`.
Related proposed record-switch acceptance:
[Role workflow research](../management-layer/ROLE_WORKFLOW_RESEARCH.txt).
