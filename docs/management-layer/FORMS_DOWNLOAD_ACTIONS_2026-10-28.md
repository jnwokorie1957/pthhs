# Forms download control lifetime — October 28 UTC

Base: `d5941118ad9fbd738e539865a5e849b1964b2f1f`.

A Download callback captured its file metadata but entered `action()` using the
session generation at click time. A former control could therefore request its
old file after a folder change, Demo round trip or replacement signed-in session.
A removed control could also survive a library reload or cursor-page replacement.
The server still required the current administrator authorization and verified
the stored file; this finding does not establish an authorization bypass.

Each loaded list now owns a monotonically increasing revision. Download controls
check that revision and their original session generation before entering the
existing action. A new list invalidates previous controls immediately, including
when its response is empty or fails. Folder and session changes invalidate the
generation. Current controls retain the existing busy guard, protected request,
size/SHA-256/header verification and object-URL cleanup.

## Verification

The folder-change regression failed before the source correction: an old
control issued a second request when no new request was expected. The corrected
source passes all 12 Forms tests and all 313 frontend/tooling tests. Synthetic
cases cover:

- Folder change, Demo off/on and sign-out followed by ready.
- Replacement lists while pending and after ready, empty or failed responses.
- Server-cursor page replacement without reusing the preceding file control.
- No stale request, downloadable object or status change; a current replacement
  control still downloads and verifies the original bytes.

Generated assets pass the deterministic source/artifact check. Only `forms.js`
and its version reference in the generated app HTML change at runtime. Backend,
Storage, auth, read permissions, source requests and scheduling are unchanged.
Normal publication and production-byte evidence are recorded in the handoff
after the release completes. No private source or file was used for regression
testing. Exact queued/detached callback and replacement transitions remain
synthetic acceptance; they were not induced against production documents.

## Research and remaining work

This applies the existing [role research](ROLE_WORKFLOW_RESEARCH.txt) request-
lifetime requirement to the accepted administrator file library. It adds no
patient/visit/form instance, external sharing, clinical review or export-job
contract. Those proposals, P1-B supervisor membership and P2 assignment/form/
version/reviewer/signature/retention/action prerequisites remain open.

Next unblocked developer step: complete both normal release jobs and compare
the production artifacts and anonymous boundaries. A later native library check
can use the owning signed-in Primetime session, or a normally signed-in Codex
browser tab. No source operation, role grant or private-file download is needed
to accept the deterministic callback lifetime correction.
