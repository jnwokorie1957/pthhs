# Feed continuation — October 21

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
Independent review and publication are complete through
`42de1d306f12e03db7582b128af86a3fc4db5d31`. Both normal jobs passed
[workflow 39682594956](https://github.com/jnwokorie1957/pthhs/actions/runs/39682594956)
on the first attempt (Hosting 21:55:53 UTC; backend 21:56:13 UTC).
No backend, source dispatch budget, permission or HHA write behavior changes.
The feed remains a first-page cache, not a complete normalized visit import.

Independent-review correction: rollover now resets only the source page,
retains unrelated unavailable panels, and keeps Clear source page enabled
during and after the new-day request. Clearing during rollover fences both late
success and failure. Two additional deterministic regressions cover these cases.

## Independent acceptance

The 18:58 UTC dashboard heartbeat ran later, at 22:54 UTC onward on October 21.
It preserved concurrent public navigation and sync acknowledgement changes and
reran the affected data-mode suite: all 156 tests passed. No runtime code was
changed during this acceptance pass; the already-passing full release workflow
remains separate evidence.

At 22:55:10 UTC, deployed HTML and five referenced assets matched the released
sources. Private noindex/nofollow/noarchive and anonymous session/feed 401
boundaries remained intact. The previously open browser tab still showed the
prior day using the older script. Reload loaded the released script and selected
the current configured office day. Ten readable source details and all six
chart counts, native progress attributes, visible denominators and accessible
labels matched the source-row fields.

Native Tab placed keyboard focus inside the source-record controls without
opening a record read. At the next automatic check, feed display paused while
retaining that source focus, the exact receipt and every displayed row field;
all six charts still matched. The saved observation covered 44.722 seconds.
Explicit Resume returned to the scheduled feed. This verifies the normal focus
guard; the specific response-arrives-after-focus race remains synthetic evidence.

Browser automation stopped responding while returning that observation. After
recovery, a temporary feed warning was visible alongside a successful direct
read. Normal Pause/Resume returned a fresh scheduled receipt and matching charts.
The generic warning did not establish a particular server failure, and no
infrastructure, permission or source-acceptance control was changed to recover it.
Final automatic-update evidence is recorded in the protected handoff/aggregate
acceptance, independently of the successful direct read.
Without another source-read action, a subsequent automatic check displayed the
23:16:03.016 UTC scheduled receipt, ten readable details and all six matching
charts. Final Overview remains on October 21 with feed display enabled.

Midnight in daylight/standard time, explicit-day retention, pending prior-day
responses and rollover clearing remain controlled-clock regression evidence;
the real clock was not changed and a real midnight was not observed. Hidden-page,
failure/revocation and late-response cases likewise are not expanded into live
acceptance. Current source-page success does not establish complete office
coverage, normalized imports, clinical meaning or external-role authority.

The HHA portal still exposes the previously observed empty office/day search.
Intended application/tenant/office/filter alignment and protected same-record
source/unit/period review remain separate owner evidence actions. No web capture,
source mutation, clinical/financial decision or communication occurred.
