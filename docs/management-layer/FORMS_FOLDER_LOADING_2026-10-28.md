# Forms folder loading — October 28

Baseline: `bcb452766bb72a5488264abf6d5cc6d645b65d00`.

A folder-change event queued before a Forms request disabled its controls could
run while that request was pending. The handler changed the session generation
but left `busy` true. The former action's cleanup correctly rejected its old
generation, so it could never release that flag. Load files then stayed disabled
in the new folder. This was reproduced with a synthetic event; the exact race
was not induced against production files.

The folder-change handler now releases the old busy state when it invalidates
that generation. The current explicit load owns its new busy state. Former
successes, failures and cleanup cannot change the new folder's rows, cursor,
status or controls. Folder selection itself makes no request. Current permitted
downloads retain their byte/hash checks and originating-list guard.

The new regression first failed on the disabled Load files control. It now
covers a pending list, failed list, download, upload file read and already-sent
upload response. In each case the new folder can load, late work cannot unlock
its pending replacement or repopulate old data, and its current file can still
download with verified bytes. All 13 Forms tests and 314 frontend/tooling tests
pass. The normal aggregate release script now includes the Forms suite; it had
previously omitted that suite. Generated assets and repository checks apply to
the exact release, with final workflow/delivery evidence in the handoff.

This implements the context and delivery separation in the
[role research](ROLE_WORKFLOW_RESEARCH.txt). It changes browser state ownership,
not server authorization or storage operations. An upload already dispatched
may still finish on the server; changing folders does not cancel or undo it.
The existing duplicate-content behavior and reload guidance remain. No private
file was uploaded or downloaded to reproduce the race.

Patient/family document sharing, therapist account/assignment/form authority,
office document review/export, retention, source interpretation and P1-B/P2
contracts remain separate. The administrator file library does not establish
clinical instance relationships. No new role, grant, source read operation or
clinical/financial decision is introduced. Native normal-library checks and
synthetic queued-event acceptance must retain their distinct evidence scopes.
