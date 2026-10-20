# Automatic fetch-age display control

October 20, 2026: a shared Automatic age updates checkbox controls the local
elapsed-age displays in Overview, Visit Preview and current-visit evidence.
The setting starts on, remains in memory for this page session, survives view
changes, and resets on sign-out or reload. It is unavailable in Demo.

Pausing stops the display timers and labels each held age as paused. An explicit
new read while paused displays its initial age without starting a timer. Resuming
recalculates from the original receipt and current device clock. The two live
views share one page timer; current-visit evidence retains its independent timer.
Context changes and Clear source page still clear evidence immediately while
paused. Detached callbacks cannot revive or update a replacement display.

The control does not request source data or store a preference. Original fetch
receipts, source values, saved captures, charts and partial/on-demand labels are
unchanged. Missing or invalid timestamps remain unknown; future timestamps and
invalid device clocks remain explicit. No clinical freshness threshold or
operational interpretation is added.

## Local verification

- All 233 frontend tests passed, including six new regression groups for shared
  pause/resume, repeated toggles, initial readings while paused, context changes,
  detached callbacks, unknown/future/invalid clocks and session/Demo behavior.
  Existing response-ordering and independent-timer regressions remain covered.
- The full repository build and release verification passed with UTF-8 enabled
  for Python on Windows. Generated Primetime artifacts match their readable source.
- A local headless browser used only synthetic data and intercepted local
  requests. Space toggled the native checkbox; Tab moved focus normally.
  Pause/resume preserved receipts and focus, and view changes retained the choice.
  Toggles added zero requests and storage writes. Clear retained an empty display
  after resume. Demo hid the control. No browser script errors were observed.
- The control and paused text fit 1280px, 615px and 375px viewports without
  horizontal overflow. The narrow control screenshot was visually inspected.

The implementation checks above used synthetic data. Authenticated production
acceptance follows below. Backend code is unchanged; local backend tests were
not rerun.

## Authenticated production acceptance — 17:16 UTC heartbeat

Feature `e93c9cc3dfaf6c18facd2334f74f8f9db4da3f15` passed both normal jobs in
[workflow 39445575289](https://github.com/jnwokorie1957/pthhs/actions/runs/39445575289),
first attempt. At 17:18:14 UTC production HTML and all four referenced assets
matched the tested bytes. Private noindex/nofollow/noarchive and anonymous
session/current-visit 401 boundaries remain intact.

The normal administrator session restored with automatic updates on. Space
paused both page ages without changing their receipts, rows or charts; Tab moved
focus normally and the choice survived view changes. A separately verified
current visit, read while paused, matched its exact patient/visit and displayed
23 raw fields with all six grouped values matching their raw-field display.
The existing October capture retained its 41 chart tiles, three authorization
rows, visible saved cells and capture/import provenance.

Page ages stayed held for 145 observed seconds; the current-visit age stayed
held for 81. Resume recalculated both from their original receipts and the
current device clock. A subsequent 80-second observation advanced both page
ages and the independent current-visit age, with unchanged receipts/source
fields/groups/charts/capture evidence and retained checkbox focus.

First, next and previous source pages each had ten readable visits and all six
field-presence chart calculations matched. Next IDs were disjoint; Previous
restored the first IDs. Paging while paused cleared pending ages, then showed
the new page's initial paused age. Partial/on-demand/source-unvalidated labels
remain; missing fields do not establish visit or care status.

Clear source page while paused removed both page ages and all eight source
hosts. Independently selected saved/current evidence remained until the patient
input was cleared, which removed that display too. Resume restored no cleared
evidence. Cleanup left automatic updates on, Live mode, empty entry/results
fields and an explicitly cleared Overview. Stored captures remain separate.

Exact request/storage absence, timer counts, detached callbacks, invalid/future
clocks, revocation and session reset remain synthetic checks; no real-session
network instrumentation or induced permission/source failure was used. Narrow
layout remains local synthetic acceptance. HHA still requires normal sign-in;
no new tenant capture/import, entitlement change, source write or communication
occurred. These checks add no clinical/financial interpretation or external role.

Private aggregate artifacts: `primetime-automatic-age-control-live-acceptance.json`
and `primetime-automatic-age-control-release-acceptance.json`. The visually
checked `primetime-automatic-age-control.png` shows only the generic paused
checkbox/description, with no private identities or source timestamps; SHA-256
`576d94a60acfaa88d25e103a365df3360d751ceb5ff4785245b81a3d068547a2`.

## Remaining acceptance

Protected representative-source interpretation and broader operational/role
acceptance remain open in the existing developer and owner checklists. This
display-only improvement does not complete those gates.

For a regression, use a reviewed revert of this scoped change, regenerate/check
the assets and follow the existing release workflow. No stored-data migration
or source-state rollback is part of this feature.
