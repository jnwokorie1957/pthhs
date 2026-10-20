# Current source-field disclosure

The October 19, 2026, 20:24 UTC dashboard heartbeat completed P1-K in frontend
release `2d6794467181fd0243043e7287ebc889d8ea05a4`. Both normal jobs passed
[workflow 39319785934](https://github.com/jnwokorie1957/pthhs/actions/runs/39319785934).
This report contains no private record identities, times or returned values.

## Implemented behavior

The separately verified current-visit panel keeps its Schedule, Actual and EVV
groups visible and places the complete raw-field list in a native details/summary
disclosure. The summary displays the count of returned API projection fields;
this is not a count of all HHA fields or agency records. Each successful current
read starts closed. Opening and closing retain every returned key/value and the
original source/fetch context, including unknown, empty, whitespace and zero
distinctions. Source times and timezone remain unconverted and unvalidated.

The existing exact-ID caregiver control now precedes the disclosure, immediately
after the grouped evidence. Selection still prepares the existing read form;
source fetching remains a separate explicit action under existing owner gates.
Native Enter/Space and Tab behavior, a visible focus ring and a padded summary
provide keyboard access. There is no new toggle handler, fetch, stored preference,
backend code, grant, import, source mutation, decision or communication.

Pending and failed reads and context changes remove the whole current evidence
panel. A refreshed successful read creates a new closed disclosure. Existing
successful-request, patient, version, filter, page, office, policy, mode and session
guards remain; saved cells, full chart, authorizations and provenance stay separate.

## Verification

- All 203 frontend tests passed, including four new regressions for native closed
  markup, exact count/raw retention and no side effects; caregiver ordering and
  exact selection; expanded refresh/failure clearing; and context resets with
  detached-control fencing. Generated assets, repository and whitespace checks
  passed. Backend unchanged; both normal workflow jobs passed.
- Production HTML/workspace/dashboard/CSS matched tested bytes at 20:31 UTC.
  Private noindex/nofollow/noarchive and anonymous session/current-visit 401 remain.
- Normal-session production, Demo off: the selected current visit/patient matched
  exact saved identities under existing office checks. The disclosure started
  closed and its raw list was hidden. Enter opened all 23 returned fields; Space
  closed them. The count, all raw values and source/fetch copy stayed identical,
  and keyboard focus stayed on the summary. Caregiver -> Tab reached the summary.
- Caregiver Enter selected the exact returned ID and focused Record ID with
  existing entitlement feedback. No caregiver operation was enabled or fetched
  in this pass. Saved visible cells, three authorization rows, full October
  chart of 41 tiles and provenance remained identical.
- Refresh removed the expanded disclosure immediately while pending, then
  created a closed 23-field result. September selection removed current evidence
  and retained its full 36-tile chart. Real reassignment/revocation/races were not
  induced; fixtures cover these and other unavailable production distinctions.
- Fresh live first/next/previous pages fetched at 20:26:32, 20:27:35 and 20:28:07
  UTC each returned ten readable rows. The next ten IDs differed from the first
  ten; Previous restored the exact first IDs. All six chart values, denominators
  and displayed counts matched each page's actual source fields. A fresh
  post-release page at 20:34:27 UTC also matched. These reads remain bounded,
  partial, on-demand and source-unvalidated. Office totals remain unknown; no
  durable import, background synchronization or source interpretation is claimed.
- The summary fit the observed 1280px viewport. An optional 615px request still
  reported 1280px, so new narrow-viewport acceptance is unverified. The override
  was reset. Earlier P1-J narrow acceptance is separately dated evidence.
- The retained HHA tab redirected to normal Log In. No credential was entered
  and no new tenant UI capture/import occurred. Normal owner sign-in is required
  for further authorized tenant workflow observation.
- Reload cleared patient/capture/history/detail/read-ID fields; the normal signed-in
  Primetime tab and HHA login tab remain available. The final cropped summary
  screenshot was visually checked without patient/staff/account identifiers or
  private values/times. SHA-256:
  `d36d5c3131307b1d96dffa8190875457989292f5b4c6e0e0db5053893c824f6c`.

Local evidence: `primetime-current-source-disclosure-live-acceptance.json`,
`primetime-current-source-disclosure-release-acceptance.json`,
`primetime-current-source-disclosure-acceptance.txt` and
`primetime-current-source-disclosure.png` in task outputs. Record values stayed
in protected application/browser state and were not saved in these artifacts.

The prior P1-J documentation publication `e812ee10c5748f4a912cc6c099b1dbbb4ea34eb8`
now has both normal jobs completed successfully in
[workflow 39318824107](https://github.com/jnwokorie1957/pthhs/actions/runs/39318824107).
Its earlier unobserved-CI checkpoint is resolved; no release control changed.

## Remaining work

P1-K is accepted within protected administrator presentation only. Normal HHA
sign-in and protected representative unit/period, identity, office, discipline,
document and form/reviewer validation remain owner evidence actions. Caregiver/
authorization detail entitlement, P1-B office/supervisor migration and external
account/form/signature prerequisites remain open.

P1-L current-visit fetch age is implemented and accepted in the separately dated
[fetch-age report](CURRENT_FETCH_AGE_ACCEPTANCE_2026-10-19.md). It retains raw
receipts and source context, makes device-clock/unknown states explicit and
cancels local timers with read/context changes, without source polling,
persistence, permissions or operational freshness classifications.
