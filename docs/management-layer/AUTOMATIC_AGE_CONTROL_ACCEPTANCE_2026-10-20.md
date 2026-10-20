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

No real authenticated source acceptance was performed for this change.
Backend code is unchanged; local backend tests were not rerun. Deployment and
public artifact verification are separate release evidence.

## Remaining acceptance

Protected representative-source interpretation and broader operational/role
acceptance remain open in the existing developer and owner checklists. This
display-only improvement does not complete those gates.

For a regression, use a reviewed revert of this scoped change, regenerate/check
the assets and follow the existing release workflow. No stored-data migration
or source-state rollback is part of this feature.
