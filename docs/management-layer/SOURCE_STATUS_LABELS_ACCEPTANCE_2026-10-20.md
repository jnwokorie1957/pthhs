# Source status labels

October 20, 2026: the shared Live badge and environment description now follow
source-access checking and terminal outcomes. Previously an invalid date or a
409/423 response could leave loading labels, and a failed or blocked access check
could retain labels from a previously returned page after its rows were cleared.

Access checking now has its own pending labels. Failed or blocked access reports
unavailable; a missing date requests a service date; a 409 requests a refresh.
Cleared access and signed-out states also replace former source-success labels.
Successful retry retains the existing returned-source labels. The change only
assigns display text in existing branches; requests, permissions, source values,
partial/on-demand scope, paging, context guards and age behavior are unchanged.

## Verification

- Before the fix, four new synthetic regression groups failed on retained
  loading/success labels. The Demo isolation group already passed.
- After the fix, all 238 frontend tests and the full local release gate passed.
  Five new groups cover successful reads followed by failed/malformed/blocked
  access checks, invalid dates, 409/423 outcomes, retry success, pending access,
  stale failure and late responses after switching to Demo. Assertions also
  verify cleared receipts and no visit request for blocked access/invalid dates.
- Generated artifacts match their readable source. Backend and permission code
  are unchanged. No real source failure or access restriction was induced.

## Bounded production acceptance — October 21 UTC / October 20 local

The 00:38 UTC heartbeat verified the normal administrator session with the latest
discovery release. Production assets matched tested bytes and both normal jobs
passed. A successful page showed Live / HHA source. Clearing the selected date
showed Live / date required and Choose a service date, with no former rows,
receipts or ages. Restoring the selected service day returned the first IDs and
the source-success labels. Paging cleared pending evidence and restored only
the returned page, with matching chart calculations.

An explicit refresh showed Live / checking access and Checking HHA source access.
Clear source page during that check replaced the pending labels with Live / no
source page and retained an empty preview during the subsequent idle check.
Automatic age updates stayed on and all entry/results fields were emptied.

Blocked/failed access, malformed metadata, 409/423, revocation and late-failure
cases remain synthetic coverage; no real source failure or access restriction
was induced. These observations do not establish all terminal-error behavior in
production or broader source interpretation. Existing membership, role and
operational gates remain open. No new HHA capture/import or source write occurred.

Aggregate evidence is in `primetime-source-discovery-live-acceptance-2026-10-21.json`
and `primetime-source-discovery-release-acceptance-2026-10-21.json`. The visually
checked `primetime-source-date-required.png` contains only generic missing-date
text, without identities or source timestamps; SHA-256
`8093ff1f7c2bc400d1729bdbbb9a80a1b5dcdc32acb6beee125011f4c857ea17`.

Rollback is a reviewed revert through the normal release checks; there is no
data migration or source-record change.
