# Visit maintenance evidence checks

Prepared November 8, 2026 from the November 6 researched-feature heartbeat.

When a staff member selects a source visit, the maintenance workspace now
distinguishes readable responses with absent endpoints from unavailable detail
reads. It displays presence, not an accepted time comparison or visit status.
The selected visit uses its current feed receipt. Staff report cards and the
protected text export use each saved case's retained source receipt and state
explicitly that it may differ from the current feed.

## Source mapping and limits

Existing approved `GetVisitInfoV3` projection in
`functions/src/views/visits.ts` supplies these fields without new reads:

| Source field | Existing view field | Evidence display |
| --- | --- | --- |
| `ScheduleStartTime`, `ScheduleEndTime` | `scheduledStart`, `scheduledEnd` | HHA schedule field presence |
| `VisitStartTime`, `VisitEndTime` | `actualStart`, `actualEnd` | Recorded visit field presence |
| `EVVStartTime`, `EVVEndTime` | `evvStart`, `evvEnd` | EVV field presence |

A nonempty string is labeled supplied; absent or empty text in a readable
response is labeled not supplied in this response. An unavailable detail read
overrides clock presence and hides any retained clock text in the time boxes.
No clocks are parsed, subtracted, rounded, substituted or classified as worked,
payable, billable, verified, pending or complete. This change does not expose or
interpret `ActualHours`, `ActualHoursRounded`, schedule duration or payroll.

The owner-taught saved Calendar S / Schedule tab, SuggestedScheduleTime and
adjusted Bill Time distinction is displayed directly. The comparison remains
"Not established in Primetime" even when all endpoints are supplied. The
existing owner stop/unknown rule is visible before source maintenance. This is
guidance, not a new accepted comparison, automated workflow or HHA action gate.
The review note remains blank. Clock presence cannot supply member attestation.

## Permissions, record links and dependencies

No new endpoint, source read, import, grant, record type or case mutation is
introduced. Existing authenticated office scope, source IDs, selected visit and
saved case associations, source receipts, stale-feed controls and report scope
are retained. No public patient or staff record links are added. No HHA record
write or communication is performed. Submit to HHA remains locked behind the
existing source-action contract and independent readback requirements.

This implements the read-only presentation portion of the November 6
source-action/M03 research follow-up. General source action, original-event
linkage, modality, units, actual Calendar S equivalence, positive-overage and
uncertain-response acceptance remain open. The original October 24 screenshot
visit remains resolved by its October 31 reread. No missing time is claimed
recovered here. The owner/vendor technical contract and broader supervised
workflow acceptance remain the next actions documented in the cumulative
research and live-data checklist.

The caregiver portal is already published upstream at `c3a5a82`; dated research
describing PR #11 as draft is historical. This frontend change preserves that
release and all existing backend flags. Use the existing explicit Hosting-only
workflow after PR quality passes; do not redeploy unrelated Functions.

## Acceptance evidence

Four added regressions failed before the source edit and pass afterward:

- Readable partial endpoints remain distinct from an unestablished comparison;
  selection does not save a case or trigger calls/reason reads.
- Unavailable detail reads show unknown presence and suppress stale clock text.
- All six supplied endpoints still leave comparison and member verification
  unestablished, the note blank and source submission locked.
- Saved report evidence differs correctly from a newer current feed; protected
  export uses the saved receipt and sign-out clears the visible evidence.

Local November 8 results: 17/17 maintenance tests; 656/656 site and analytics
tests; deterministic Primetime and workforce asset checks; performance checks
on 141 pages; clean diff check. No test or asset budget was relaxed. Local
dependencies used the four pinned package.json versions through the installed
pnpm runtime because this Windows host has no npm executable; normal CI must
still run its locked npm-ci build and both PR quality jobs.

## Release and actual production checks

PR [#12](https://github.com/jnwokorie1957/pthhs/pull/12) merged at
`ad02ae529362101d357bdff59c7bea984cac5083`. Both normal PR quality jobs
([42484244304](https://github.com/jnwokorie1957/pthhs/actions/runs/42484244304))
passed. Existing explicit Hosting-only release
[42484358665](https://github.com/jnwokorie1957/pthhs/actions/runs/42484358665)
passed release_scope and build_and_deploy; backend and analytics deploy jobs were
skipped by design. No release control or backend parameter changed.

November 8 at 13:20:59 UTC: ten production artifacts match exact reviewed Git
bytes, including the maintenance shell/script/style, homepage/Careers and both
portal pages. Private-page meta/header noindex protections and anonymous
Primetime session 401/no-store/noindex pass. Public-byte checks are not
authenticated row acceptance or a claim of fresh HHA data.

Authenticated selected-visit production acceptance remains **pending**. A fresh
Primetime page requires sign-in; the retained authorized tab could not be
attached. The original operations page was not navigated or reloaded. No sign-in
message was sent, no credentials entered and no private source read, case save,
call read, source link/confirmation or real report download was attempted.

Precise next owner/operator action: restore the existing approved Primetime
session on the trusted browser, open Visit maintenance, select one source visit
and compare the new panel's labels with that exact row and receipt; verify Submit
to HHA remains locked. No save or source action is needed for this display check.
The four new synthetic regressions establish runtime and saved-report behavior;
they do not close this real-session acceptance item or the broader M03 contract.


## Saved office case navigation

November 9, 2026 UTC. The report could send users to an empty visit panel when a
saved case appeared ahead of its source row. A matching row also skipped the
standard case selection. [PR #14](https://github.com/jnwokorie1957/pthhs/pull/14)
fixes both paths. The visit, service date and valid patient must agree within the
current office scope to open the normal review. Otherwise, the report exposes a
read-only saved revision and a history disclosure with the saved receipt. The
saved view needs no new request or edit form.

Local validation passed 29 maintenance/search tests and 658 site/analytics
tests. Two new regressions reproduced both defects before the fix. Deterministic
assets, performance, repository audit and diff checks passed. Both new tests
also passed against the generated script served in production. Repository
quality [42554957630](https://github.com/jnwokorie1957/pthhs/actions/runs/42554957630)
and Hosting-only [42555134855](https://github.com/jnwokorie1957/pthhs/actions/runs/42555134855)
passed both required jobs. The release is `79912aa23d2f43e5cc8b3d0a333f6c0ffff99b09`.

At 03:14:08 UTC the live shell, versioned maintenance script and caregiver
setup shell matched the reviewed Git bytes. The script fingerprint matched the
shell reference. Anonymous Primetime access returned 401/no-store/noindex. Both
workforce configuration routes retained noindex/no-store, ready setup, and
closed application/document collection.

The fresh production page requires sign-in. Protected report acceptance remains
pending. In the approved Primetime session, expand the saved history on an
existing case without a matching readable source visit and confirm the date and
revision. Open a case with a matching readable visit to verify the usual review
and case revision. Use the existing records and keep the exercise read-only.
The two synthetic regressions establish both display paths independently of the
pending live session check.
