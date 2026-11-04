# Isolated async-button keyboard diagnosis

November4, 01:24UTC feature pass; local Chrome checks finished 01:34UTC.
Source baseline: `0d76777`, retaining runtime `15ba09d` and unchanged client
helper behavior from `9fb89f1`.

An isolated Chrome fixture kept the next Tab destination in logical order and
preserved a deliberate focus/draft change through asynchronous completion.
Whole-application keyboard and assistive-technology acceptance remain open.

The fixture copies `action()` and `button()` verbatim from
[workspace.js](../../source/primetime/workspace.js), with a local synthetic
callback and ordinary Before/After/draft controls. Helper SHA256:
`fc82e892f59cc9dd67ecc90ce97d211170686d1556661207304db6cbee1007b7`.
It has no authentication, HHA/Firebase connection or patient/staff records.
The temporary server bound only to loopback; the tab and server were closed.

| Local Chrome scenario | Observed result |
| --- | --- |
| Enter, success | BODY active while disabled and after settlement; Tab reaches After |
| Space, success | Same logical next Tab destination |
| Enter, source-empty fixture | Same destination; empty outcome text retained |
| Space, refusal fixture | Same destination; refusal text retained |
| Tab away and edit draft while pending | After receives Tab; deliberate draft focus/text survive completion |
| Two additional Enter keys while pending | Both key events observed during Pending; only one synthetic callback |

For the first four cases the button re-enabled, its callback count remained one,
and the next control matched `:focus-visible`. This is DOM/keyboard evidence,
not a pixel-contrast or screen-reader result. The long-delay text locator timed
out; a fresh AX/DOM read then confirmed Settled with the draft/focus preserved.
That observation is recorded as a tooling limit, not a product failure.

BODY as activeElement alone did not reproduce a broken Tab sequence in this
fixture. It therefore does not justify a global disabled-control replacement
or unconditional focus restoration. The real widget's inserted result controls,
styles, context removal and full permission/read lifecycle were not loaded.

Next: retain the [existing acceptance cases](ROLE_WORKFLOW_RESEARCH.txt) and
complete the exact-source widget check after the existing signed-in connector
handoff. Preserve deliberate moved focus, draft content, busy suppression,
cooldowns, release/permission locks and stale-response fences. No source failure
needs to be induced for acceptance.

No production code, generated asset, permission, source record or operational
decision changed. No actual time/hour recovery, external role, native whole-app
race, AT/full-WCAG result or runtime deployment is accepted by these six checks.
Safe private outputs: `primetime-button-keyboard-harness-2026-11-04-0124/` and
`primetime-keyboard-diagnosis-2026-11-04-0124.json`.
