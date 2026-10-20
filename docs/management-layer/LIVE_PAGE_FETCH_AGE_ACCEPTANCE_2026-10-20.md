# Live-page fetch age

P1-M from the October 20, 2026, 01:52 UTC implementation heartbeat is implemented
in `f6af1d7020180226e1cc1e57c7f78b69a85ea4b9`. Both normal jobs passed
[workflow 39356198078](https://github.com/jnwokorie1957/pthhs/actions/runs/39356198078).
Acceptance completed October 20 UTC, still October 19 in America/Chicago.
This report contains no private record identities or returned source values.

## Behavior and scope

Live Overview and Visit Preview show the same approximate age beside their
unchanged raw fetch receipt. One local minute timer belongs to the verified
source page. Age uses this device clock and explains that a source refresh
requires an explicit read. Raw timestamps, source wall times, page scope,
unavailable-detail exclusions and unknown office totals remain unchanged.

The explicit-offset parser and age formatter are shared with the existing
current-visit display. Parser, formatting and investigation semantics remain
unchanged. Each display keeps its own timer lifetime; filtering saved evidence
does not invalidate an otherwise current live page. Pending refresh, paging,
date, office/policy, mode and session changes stop the page timer and clear both
age paragraphs immediately. Inactive callbacks and late responses cannot alter
new evidence or cancel its timer. Demo mode has no source-age display.

Missing, malformed, impossible-date and timezone-ambiguous receipts stay unknown,
with no timer or fallback from source visit times. Future receipts and invalid
device clocks have explicit unavailable messages and can recover on a local tick.
Both paragraphs have aria-live off and introduce no focus movement. Ticks add no
request, preference, import, permission, source mutation or communication. Age is
not a clinical freshness threshold, care duration, EVV decision or billing status.
Existing initial/request behavior and release controls remain unchanged.

## Verification

- All 217 frontend tests passed, including eight new regressions covering shared
  two-view updates and evidence/focus retention; unknown receipts; clock changes;
  eight paging/refresh/date transitions; failures, blocked/conflict and malformed
  responses; mode/session/office/policy resets; late success/error; and independent
  current-visit/page timers. Existing current-visit and investigation tests pass.
  Isolated workspace fixtures now load the actual shared helper before restoring
  their mocked mode controller. Generated assets, repository and whitespace
  checks passed. Backend unchanged; both normal release jobs passed.
- At 01:57:16 UTC, production HTML, data-source, workspace, dashboard and CSS
  matched tested bytes. Private noindex/nofollow/noarchive and anonymous session/
  current-visit 401 boundaries remain.
- During a real 53-second observation, both ages advanced from less than 1 min
  to 1 min. Original receipt paragraphs, rows, chart attributes, page/date scope,
  readiness/status copy and keyboard focus stayed identical. Both aria-live
  settings stayed off. Switching to Visit Preview retained the same age and
  receipt and displayed its paragraph normally.
- First, next and previous source pages at 01:57:23, 01:59:19 and 02:00:00 UTC
  each returned ten readable visits. All six field-presence chart counts and
  denominators matched actual source fields. Next IDs were disjoint; Previous
  restored the first IDs. Pending next/previous requests immediately cleared
  both ages and raw receipt copy; their successful responses reset age.
- Explicit refresh also cleared age/receipt while pending, then returned a new
  receipt and less-than-one-minute age in both views. Its page at 02:00:19 UTC
  returned ten readable visits with all six chart comparisons matching. Partial,
  on-demand, source-unvalidated and unknown office-total labels remain. These
  are bounded reads, not a durable import, background sync or complete census.
- The line fit its 919px paragraph in the observed 1265px document viewport.
  Narrow layout was not revalidated. Invalid clocks, failures/revocation/races,
  date/office/policy/mode/session changes and exact timer cancellation use
  synthetic acceptance; none was induced on real source records. Browser timer
  delivery and device-clock accuracy remain limits of approximate age.
- HHA still showed normal Log In; no new tenant UI capture/import occurred.
  The visually checked screenshot contains only generic age text. Patient/capture/
  detail/read-ID fields remain empty; normal Primetime/HHA/Search Console tabs
  are retained for continuation.

Local aggregate evidence: `primetime-live-page-age-live-acceptance.json`,
`primetime-live-page-age-release-acceptance.json`,
`primetime-live-page-age-acceptance.txt` and `primetime-live-page-age.png`.
Screenshot SHA-256:
`22b9923d04a9393898468998f1d57f1573016209c3267d145c1c6b585c5008d8`.
Private source records stayed in protected application/browser state.

## Remaining work

P1-M is accepted for administrator source-page presentation only. Broader role
views still need approved account/assignment/office/action scopes and authoritative
source/configuration mappings. Normal HHA sign-in and protected representative
unit/period/identity/office/discipline/document validation, approved detail
entitlement, P1-B migration and external form/reviewer/signature prerequisites
remain open. No role or operational-policy completion is inferred from this work.
