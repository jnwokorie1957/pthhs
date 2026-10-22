# Forms session initialization — October 22

Base: `42272e8f6a79ce64f0dbe48042ad23b9a3651aa4`.

A delayed Forms script could miss the ready event already emitted during cached
session verification. Initializing its local active flag from the existing
`primetimeDataMode.isActive()` strict boolean state handles that ordering.
Missing/inactive state stays disabled. Existing ready, sign-out and mode listeners
are unchanged; there is no automatic request or permission/storage change.

Deterministic tests: the unchanged source passed six existing tests and failed
three new initialization/context tests. The fix passes all nine. Coverage includes
ready before/after script load, missing/inactive/nonboolean state, live/Demo,
sign-out and late list responses. Existing upload/download integrity and stale
upload tests remain passing. All fixtures are synthetic.

Original implementation evidence: the full release gate passed (263 tests in
that gate), with the nine Forms tests run separately. Backend was unchanged.
The correction itself used synthetic fixtures and preserved upstream work.

## Independent review and bounded production acceptance

The one-line change reads the existing active-state helper with a strict true
check. Existing event listeners, Live-mode checks and request-generation fences
remain. Independent source/test review and all nine focused Forms tests passed
October 22 during the 12:55 UTC implementation heartbeat. No additional runtime
change or unchanged full-suite run was needed.

Feature `7e92ffe2333f0e107fc0d211a08b0911d24924a8` was already published; both
normal jobs passed [workflow 39701918292](https://github.com/jnwokorie1957/pthhs/actions/runs/39701918292).
Both normal jobs also passed the subsequent preserved baseline
`51d94e5fd0affb9e1536e35d3086a9da4c22279d` in workflow 39724439019. Public
HTML/eight referenced app assets matched that baseline, with noindex and
anonymous session/feed 401 protections retained.

A newly opened normal production tab restored the existing approved session
without a new sign-in. In Forms, Load files and Upload form were enabled, no file
was selected, and the ready status retained the storage/approval/sharing boundary.
Native Load files completed a protected one-page list, returned its Download
control and re-enabled the controls. No private filenames or file contents were
retained in evidence. No upload, download, permission or storage change occurred.

This verifies normal cached-session readiness and a successful protected list.
Exact script/event ordering, forced late responses, sign-out and Demo cases
remain deterministic fixture evidence; they were not induced in production.
Original byte-round-trip acceptance remains in
[the Forms library report](FORM_STORAGE_SCREENS_2026-10-21.md). Clinical records,
sharing, signatures and external-role contracts remain separate.

Private aggregate acceptance: `primetime-forms-initialization-acceptance-2026-10-22.json`.
The concurrent reason/action evidence parser and its blocked vendor operation
were preserved; this acceptance grants no source operation or correction.
