# October 15 technical SEO and task review

## Confirmed defect and repair

The read-only Search Console sitemap inventory included the historical
`https://www.pthhs.net/sitemap_index.xml` submission with errors. Direct live
checks confirmed that both apex and www variants ended at a 404 HTML response.
The current `/sitemap.xml` was valid XML containing the existing 27 reviewed
canonical URLs. Robots advertised that canonical child sitemap correctly.

The SEO generator now preserves `/sitemap_index.xml` as a small XML index pointing
only to `https://pthhs.net/sitemap.xml`. The release verifier checks its namespace,
root, single sitemap and canonical child. This follows Google's
[sitemap-index format](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps).
No new publication routes or modification dates were introduced. Public titles,
descriptions, business facts, service claims and approved payer logos were retained.

Release `c5762185ede2aa6ef29d68e7e1ca67a08a813a8e` passed both jobs in
[workflow 38774771753](https://github.com/jnwokorie1957/pthhs/actions/runs/38774771753).
Production verification established:

- Apex `/sitemap_index.xml`: HTTP 200, application/xml, one canonical child.
- Www `/sitemap_index.xml`: 301 to the apex index, then HTTP 200 XML.
- Child sitemap: HTTP 200, exactly 27 URLs, matching the tested local artifact
  and excluding `/primetime`.
- Homepage, services and contact: HTTP 200 with exact local artifact matches and
  no noindex response header.
- `/primetime`: retained noindex/nofollow/noarchive response protection;
  anonymous `/primetime/api/session` remained 401 with the same protection.

## Search evidence and interpretation

The connected property can be read; its query/page baseline is now available in
the owner's private local outputs. The current daily report has sparse observed
dates, and the preceding comparison window has no returned observations. No
traffic or ranking gain is inferred. Full query analysis and the partial page
report remain distinct from a complete URL census.

The sitemap API's `contents[].indexed` field is deprecated and must not be used
as a page-indexing count, according to the
[Search Console API reference](https://developers.google.com/webmaster-tools/v1/sitemaps).
The homepage URL Inspection report retrieved October 15 reported indexed status,
successful mobile crawling and matching apex declared/Google canonicals, with
last crawl October 13. That cached result does not establish that Google has
already reprocessed the restored sitemap index.

The connector reports only sitemap error/warning counts, not their detailed
reasons. Its pre-repair counters are retained in private evidence; no claim is
made that Google has cleared them. The connection is read-only, so no sitemap
submission, removal or account-permission change was attempted. Next owner
action: inspect the existing submissions in Search Console's Sitemaps report,
review the warning details and request reprocessing of the repaired index once
using the normal authorized account, if needed. Future automated runs should
check download/status changes without repeatedly resubmitting unchanged files.

Phone field Core Web Vitals could not be retrieved because the connector has no
CrUX API key configured. This is unavailable field evidence, not a poor or good
performance result. Optional owner action: configure an authorized Google API
key with Chrome UX Report enabled in the existing GSC Wizard report. Static
performance checks continue independently; no new credentials or grants were made.

## Verification and remaining decisions

Passed locally: claim gate (Batch A), metadata/schema/sitemap/redirect gate
(Batch B4), four sitemap-date tests, structured navigation, accessibility,
performance, frontend controls, exact approved payer-logo checks, internal asset
freshness, repository integrity and whitespace checks. The normal release
workflow passed its complete build. No patient/staff data or private Search
Console payload is stored in this repository report.

The public-facts, approved terminology, payer-evidence and claim-release controls
remain authoritative. No additional location, skilled/therapy service,
credential, participation or review claim was approved by this task. The source
date registry already supports evidence-backed lastmod values and omits unknown
dates; its implemented control is reconciled in the plan. Recently revised public
copy remains stable pending comparable settled measurement.

The administrator/HHA backlog remains in the management checklists. Manual HHA
capture requires normal browser sign-in. External patient/staff access,
verified queue office/assignee identity and clinical acceptance remain separate
open dependencies. This SEO repair does not close them.
