# Current-visit fetch age

P1-L from the October 19, 2026, 23:17 UTC dashboard heartbeat is implemented in
`7889992c4899be3686ec05caca19cfa98502036c`. Both normal jobs passed
[workflow 39353834925](https://github.com/jnwokorie1957/pthhs/actions/runs/39353834925).
Production acceptance completed October 20 UTC, still October 19 in America/Chicago.
This report contains no private record identities or returned source values.

## Behavior and scope

The separately verified current-visit panel now shows Approximate fetch age next
to its unchanged fetch/office-check timestamp paragraph. It compares the explicit
fetch receipt with this device clock, using minutes, hours and days. Its text
explains that age updates locally each minute and source refresh requires an
explicit read. It does not age the manual capture, classify a visit as fresh or
stale, measure care duration, or establish clinical/EVV/payroll/billing acceptance.

Missing, malformed, impossible-date or timezone-ambiguous receipts stay unknown.
Future receipts and invalid device clocks have explicit unavailable messages;
clock changes can recover on a later local tick. All raw source values, source
timezone, fetch receipt and independent office-check context remain unchanged.
The existing explicit-offset parser is reused with an internal generic name;
investigation parsing and rules are unchanged.

One local minute timer belongs to the successful current read. A new read stops
it immediately. Filters, pages, versions, patient/source/office/policy changes,
mode/session resets, history reloads and import attempts invalidate it. Stopped
callbacks cannot modify old or new evidence. The text has aria-live off and adds
no focus movement or repeated live-region announcement. No request, stored
preference, permission, source mutation, import or communication is added by a tick.

## Verification

- All 209 frontend tests passed, including six new regressions for exact elapsed
  formatting/offsets and source retention; missing/invalid receipts; future and
  changed device clocks; pending/failed/refreshed reads; eleven context resets
  with detached callbacks; and late same-visit success/error. Tests verify no
  extra network/storage activity, focus changes or source mutation during ticks.
  Generated assets, repository and whitespace checks passed. Backend unchanged;
  both normal release jobs passed.
- Production HTML/workspace/dashboard/CSS matched tested bytes at 01:32:57 UTC.
  The private noindex/nofollow/noarchive directives and anonymous session/current-
  visit 401 responses remain. No release control was bypassed.
- Normal signed-in production matched the exact selected current visit/patient
  under existing office checks, retaining 23 returned fields and a closed native
  raw disclosure. After 84 seconds, the age advanced from less than 1 min to
  1 min. Every raw field and source/fetch paragraph stayed identical. Saved
  cells, chart attributes, authorizations and provenance stayed identical, and
  keyboard focus remained on the opened raw summary. The live-region setting
  was off. The saved October chart retained 31 day bars totaling 41, with labels
  matching their native value attributes.
- An explicit same-visit refresh removed age/raw evidence while pending, then
  created a new less-than-one-minute result with 23 fields and a closed raw
  disclosure. The new receipt and exact identities were verified. Local paging
  cleared age/raw evidence and retained the full chart of 41. September version
  selection cleared them and retained its full chart of 36.
- Fresh live first/next/previous pages at 01:41:03, 01:41:20 and 01:42:15 UTC
  each returned ten readable visits. Next IDs were disjoint; Previous restored
  the first IDs. All six field-presence chart values, denominators and counts
  matched each page's actual source fields. Partial, on-demand, source-unvalidated
  and unknown office-total labels remain. No office census, durable import or
  background synchronization is claimed. The dashboard script is unchanged.
- The age line fit the observed 1280px viewport. No new narrow-viewport acceptance
  is claimed. Future/invalid clocks, failures, revocation and response races use
  synthetic fixtures; those conditions were not forced in production. Browser
  timer delivery and device-clock accuracy remain limits of this approximate age.
- HHA still showed normal Log In. No new tenant UI capture/import was possible.
  Reload cleared patient/capture/detail/read-ID fields and age evidence; the
  signed-in Primetime tab and existing HHA/Search Console tabs were retained.
  The visually checked screenshot contains only the generic age paragraph.

Local evidence: `primetime-current-fetch-age-live-acceptance.json`,
`primetime-current-fetch-age-release-acceptance.json`,
`primetime-current-fetch-age-acceptance.txt` and `primetime-current-fetch-age.png`.
Screenshot SHA-256:
`792bc6f10e20d4632d1285e602f29aa29fe916c5299cc17369dbd99246db1132`.
Private source records stayed in protected application/browser state.

## Next work

P1-L is accepted only for current-visit administrator presentation. Normal HHA
sign-in and protected representative unit/period/identity/office/discipline/
document validation, approved detail entitlement, P1-B office/supervisor migration
and external account/form/reviewer/signature prerequisites remain open.

P1-M live Overview/Visit Preview fetch age is implemented and accepted in the
[separately dated report](LIVE_PAGE_FETCH_AGE_ACCEPTANCE_2026-10-20.md). It shares
these timestamp/clock semantics, retaining raw receipts and bounded scope with
independent timer lifetimes and explicit source reads.
