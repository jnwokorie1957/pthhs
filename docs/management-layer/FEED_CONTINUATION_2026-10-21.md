# Feed continuation candidate — October 21

Base: `20cf0d550ddb3d62e9c3a98090fd5a5c1ce12201`.

A pending scheduled-feed response could replace source rows after the reader
focused them. The response and rejection paths now recheck focus immediately
before changing evidence, pause display updates and preserve the focused rows.
Existing context and cancellation guards remain in place.

The untouched current-office-day default could remain on yesterday at midnight,
stopping further feed checks. Automatic checks now advance this default using the
configured office timezone, clear prior-day evidence/cursors before requesting
today, and reject a pending prior-day response after midnight. Explicit date
selections stay fixed, including an explicitly selected current day. Hidden and
paused displays wait until resumed; source focus is preserved before rollover.

Synthetic coverage includes pending success/error focus, explicit resume,
Chicago midnight in daylight and standard time, explicit historical/current-day
selection, responses spanning midnight, and hidden/focused rollover. Existing
sign-out, Demo, context, paging, partial/error and receipt tests remain in scope.
Base-code reproduction fails the focus, default-rollover and pending-yesterday
regressions while the explicit-date preservation regression passes.

Validation: 156 data-mode tests passed; revised full release gate passed (256 tests).
Tests use synthetic data and a controlled clock; no authenticated runtime test
or private browser access was performed. Backend code is unchanged and its
suite was not rerun for this frontend-only candidate.
Independent review, publication, CI and authenticated runtime acceptance pending.
No backend, source dispatch budget, permission or HHA write behavior changes.
The feed remains a first-page cache, not a complete normalized visit import.

Independent-review correction: rollover now resets only the source page,
retains unrelated unavailable panels, and keeps Clear source page enabled
during and after the new-day request. Clearing during rollover fences both late
success and failure. Two additional deterministic regressions cover these cases.
