# Current-day website page views

The owner requested today's page views for both websites without waiting for
the completed-day report. The analytics panel now leads with three cards:
today's page views, selected-stream live visitors, and page views in the last
30 minutes. Each card includes its source receipt; today's card includes the
actual property's calendar date and timezone and is labeled preliminary.
Visible dashboards refresh every minute through the existing owner-only API.

The independent analytics function requests today's `screenPageViews` in a
separate hostname-filtered, explicit-date `runReport`. It never adds rolling
30-minute views to the day total. The stream-filtered realtime query now reads
both `activeUsers` and `screenPageViews` in the existing minutes29 through0.
Historical totals, date selectors, source-quality disclosures and auth/Demo/
freshness/late-response guards remain. Failed or empty current-day sources
remain unavailable/pending and explicit source zero stays zero. A failure of
today's read does not remove valid historical or realtime facts.

Source reference: Google's supported realtime metrics include screenPageViews:
https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema

Validation:49 source/query tests and245 frontend/generated-asset tests pass.
Tests cover both property/host allowlists, explicit current-day dates across
UTC midnight, independent source failures, zero versus missing, integer/type
and receipt/date validation, and removal of recent facts at refresh start.
Frontend controls and deterministic artifact verification pass. The compressed
app estimate is102648bytes, within the reviewed103000-byte cap; raw/per-file
limits remain unchanged. The performance command still reports the existing
marketing output over its2MB allowance (2014041bytes); no marketing file is
changed or deployed by this patch.

Release:only `functions:website-analytics` was deployed from
`firebase.analytics.json`; anonymous requests to both selectors still return
401 with private/no-store/noindex. Hosting version4713781106fec807 released
2026-11-05T02:39:39.758Z, changing only the analytics JS/CSS and app shell;
198production files and all Hosting configuration were retained. Each previous
file was compared byte-for-byte with the source baseline before release, with
release-identity checks before and after staging.

Native Chrome acceptance, November4 Central: PTHHS returned14today views,
1live visitor and4rolling views at20:39:45; Ride Primetime returned4today,
1live and3rolling views at20:39:56. Both retained their historical reports.
Today's actual source zones were Etc/GMT+5 and America/Chicago respectively.
No synthetic response or event was injected. Screenshots saved in the task's
outputs folder show both populated sets of recent cards. These are point-in-
time values; today's source total can lag and revise while Google processes it.
