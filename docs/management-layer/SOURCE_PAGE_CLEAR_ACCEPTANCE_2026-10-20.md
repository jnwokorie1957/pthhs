# Explicit source-page clearing

P1-O is implemented in `837d86d70493d07431677bdc89859ecc1d0c7cf6`. Both normal
jobs passed [workflow 39427573529](https://github.com/jnwokorie1957/pthhs/actions/runs/39427573529).
The heartbeat triggered October 20, 2026, 04:22 UTC (October 19 in Chicago).
Production acceptance completed October 20 UTC and America/Chicago.
This report contains no private record identities or returned source values.

## Behavior and scope

Overview and Visit Preview now offer Clear source page beside Read source now.
It clears the shared browser preview: rows, source charts/evidence, raw receipts,
fetch-age text/timer and cursor history. Both views explicitly say no source page
is loaded, with no zero-count or complete-office interpretation. The selected
service date and Live mode remain. Focus returns to the corresponding Read source
now button; no read is started by clearing.

The clear control is available during an access/page request. It aborts the client
request and invalidates its context, so late responses and detached timers or
navigation cannot repopulate the cleared view. This does not establish cancellation
of work already dispatched on the server. A subsequent explicit read rechecks
access and starts at the first page. Clear is disabled after clearing and while
signed out, and hidden in Demo. Repeat activation does nothing.

Existing source-context invalidation may also clear a source-linked saved-history
display and require patient reselection. Stored imports are not deleted. Other
forms and independent protected records are not a global erasure target. Clearing
adds no source request, preference, permission, import, source mutation, clinical/
financial decision or communication. Existing backend/release/access gates remain.

## Verification

- All 227 frontend tests passed, including six new regressions covering both
  clear controls and focus/date/mode/no-request/no-storage behavior; pending page
  success/error and detached callbacks; a pending access-status body; cursor and
  detached source-navigation reset plus explicit access reread; retained capture
  data despite source-linked history display invalidation; and signed-out/Demo/
  repeated-clear behavior. Existing source/age/navigation/snapshot/investigation
  cases pass. Generated assets, repository and whitespace checks passed. Backend
  unchanged; both normal release jobs passed.
- Production HTML, data-source, workspace, dashboard and CSS matched tested bytes
  at 13:08:02 UTC. Private noindex/nofollow/noarchive and anonymous session/current-
  visit 401 boundaries remain.
- Fresh first and next pages at 13:08:22 and 13:09:05 UTC each returned ten readable
  visits, with distinct next-page IDs. All six field-presence chart counts and
  denominators matched their actual source fields. Partial/on-demand/source-
  unvalidated labels remain; this is not an import, sync or office census.
- Native Enter on Overview Clear source page removed all eight source hosts'
  evidence, receipts and ages in both views. Charts became explicit unavailable
  placeholders; there were no source table rows or progress bars. All page buttons
  hid, both clear controls disabled, both read controls enabled and focus returned
  to Overview Read source now. The chosen date and Demo-off/Live mode remained.
- Visit Preview mirrored the cleared state. A new explicit read was pending at
  access-status checking when its Clear control was clicked. Both views cleared
  again and focus returned to Visit Preview Read source now. After 79 observed
  seconds they remained cleared, with no rows/bars/receipts/age restored and no
  automatic reread. This verifies the visible result; exact response/timer fencing
  and absence of requests/storage writes are synthetic-tested without real-session
  network instrumentation.
- A subsequent explicit read at 13:12:01 UTC returned the first ten source IDs,
  a new receipt and age, with first-page scope and Previous hidden. All six chart
  calculations matched. A final pointer clear left both previews empty. Invalid/
  revoked/error conditions were not induced on real source records; narrow layout
  was not revalidated. The observed controls and cleared-state layout were usable.
- HHA still requires normal sign-in; no new tenant UI capture/import occurred.
  Patient-entry/read-ID/read-patient/capture/details/results fields remain empty.
  Normal signed-in Primetime Overview and existing HHA/Search Console tabs are
  retained. The screenshot contains only generic controls, selected service day
  and cleared-state text, with no private identities or source timestamps.

Local aggregate evidence: `primetime-source-page-clear-live-acceptance.json`,
`primetime-source-page-clear-release-acceptance.json`,
`primetime-source-page-clear-acceptance.txt` and `primetime-source-page-clear.png`.
Visually checked screenshot SHA-256:
`4d13a32318f33fc15ec099f220a737f9340fe708e77a8978430214b6299a47d7`.

## Remaining work

P1-O is accepted for explicit administrator preview clearing only. Normal HHA
sign-in and protected representative source/office/identity/unit/period/discipline/
document validation remain open. Existing owner read entitlement, P1-B and external
account/assignment/action/sharing/form/version/reviewer/signature prerequisites
remain. No broader role, clinical interpretation or source-import completion is
established by this local display control.
