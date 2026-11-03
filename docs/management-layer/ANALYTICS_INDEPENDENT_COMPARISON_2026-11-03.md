# Independent analytics comparison — November 3, 2026

Signed-in Google Analytics reports now independently corroborate actual populated
Primetime historical reports for PTHHS and Ride Primetime. This is source
comparison, not a new analytics integration or a claim that every quality and
failure variant is verified. Runtime remains
`d4ae367fdf4379785f84aafc4a50a4c3dc3baea9`; no implementation changed.

## Matching source scope

PTHHS property 546711548 uses `pthhs.net` and `www.pthhs.net`; Ride Primetime
property 561765914 uses `rideprimetime.net` and `www.rideprimetime.net`.
Both sides request October 5 through November 1, 2026, inclusive, matching
Primetime's selected 28 complete days. Google report filters match the exact two
hostnames case-insensitively. No property-wide number is substituted for the
host-filtered report. Property identity is checked again after switching sites.

The independent reads use the normal signed-in Google Analytics web UI. The
separate GSC Wizard connector refused its property inventory because its
subscription had ended; that refusal was not treated as a Primetime source
failure or a reason to change Google access. No subscription, permission, account
setting or saved report was changed. Only temporary report filters and breakdowns
were used. No analytics event was injected.

## Actual matching observations

For BOTH sites, source Traffic acquisition reports corroborate the session total,
engagement rate rounded to Primetime's displayed precision and every returned
channel's session count. Source Pages and screens reports corroborate page-view
and active-user totals, each returned path's view count and per-path active users.
The actual source page lists are complete in these observations, containing nine
PTHHS paths and seven Ride Primetime paths. This is not evidence for every future
top-ten or truncated-report variant.

For BOTH sites, both returned dates and daily session counts match the complete
Google channel/date source rows. PTHHS daily page views match all fifteen returned
page/date-hour rows aggregated by calendar date; Ride Primetime daily page views
match its complete eight page/date rows. Only additive page views are summed
across page/hour rows; active users are never summed across paths or hours.
PTHHS's complete five-row event list and Ride Primetime's complete four-row event
list contain neither `phone_click` nor `email_click`, corroborating both
unavailable contact-click states. No zero is invented for an absent event.

Source comparisons verify both the pagination metadata and the actual rendered
row body count. Google can update its pagination counter before replacing the
old rows during a query; that intermediate state is not complete evidence and is
not classified as a Primetime calculation defect. Private values remain only in
browser memory during comparison. The saved output evidence contains checks,
scope and row metadata, without traffic counts or private source payloads.
Deidentified evidence files are `primetime-ga4-independent-pthhs-2026-11-03.json`
and `primetime-ga4-independent-rideprimetime-2026-11-03.json` under local outputs.

## Remaining limits

Average session duration has not been independently compared. The standard
Traffic acquisition report's average engagement time per session is a different
label and is not substituted for Primetime's requested `averageSessionDuration`.
Realtime, plot SVG coordinates, every sampling/thresholding/restriction variant,
all calendar boundaries, populated-to-failed/expired production transitions and
all report periods remain separate acceptance work. Exact daily table values
are independently corroborated; this does not claim every plot coordinate was
read from the browser.

Current report dates can still undergo Google processing. Equal observations in
this bounded period do not establish permanent immutability, full-property totals
from top lists or a clinical/operational data connection. GA02/GA03 and the full
live-source goal remain open. No HHA reads/grants, patient/staff data, clinical
interpretation, source writes or communications were added.
