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

Production deployment and browser acceptance are pending at this checkpoint.
Do not mark this document as live acceptance until both Hosting release jobs
succeed and actual production asset and authorized UI behavior are checked.
