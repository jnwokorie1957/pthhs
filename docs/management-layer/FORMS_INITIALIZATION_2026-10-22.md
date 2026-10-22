# Forms initialization candidate — October 22

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

Full release gate passed (263 tests in that gate); the nine Forms tests were
run separately and passed. Backend tests were not rerun: backend is unchanged. Independent review, publication, CI and authenticated
runtime acceptance pending. No private browser, patient records, HHA calls or
backend changes were used for this correction. Upstream Forms and office-today
work is preserved. The older checkout and its dirty files are untouched.
