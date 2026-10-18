# October 18 home-care guide and SEO review

## Observed problem and bounded change

A fresh public crawl reached all 132 marketing routes at HTTP 200 after no more
than one redirect. The 84 distinct indexable final pages had present, unique
titles/descriptions, one H1 and matching canonicals. The initial HTML link graph
still left the existing information hub and non-medical care explainer outside
homepage reachability, alongside 37 location pages requiring separate review.
This graph is not a Google indexing count.

The information hub displayed internal archive-review notices instead of helping
a visitor choose a next step. It is now a guide to existing approved pages:
non-medical care distinctions, service options, eligibility/program information,
the before-you-call checklist and contact. Resources links to the guide in
context; the guide links to the existing care explainer. These are ordinary HTML
anchors with descriptive labels. The guide's title/description now describe its
purpose, and its Open Graph type identifies a website page rather than an
article. WebPage/BreadcrumbList metadata stays within existing contracts.

The zero-retained-article publication decision remains in an HTML comment and
the governance registers. All existing article payload noindex/redirect controls
and release checks are retained. No article, testimonial, clinical service,
location, program or payer claim was newly approved. Existing public facts,
approved terminology and owner-confirmed payer displays remain authoritative.
The sitemap still contains 27 reviewed URLs and eight promoted locations. Only
the guide/resources content dates change, supported by this actual content and
navigation edit. Primetime is outside the marketing build scope.

## Current primary guidance

Reviewed October 18, 2026:

- Google recommends crawlable HTML anchors, descriptive text and contextual
  internal links to useful pages. The guide addresses a demonstrated navigation
  gap; it is not an assumed ranking or traffic improvement.
  [Link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- Internal links should consistently use the preferred canonical URL. Existing
  clean apex routes, redirects and canonical declarations are retained.
  [Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- Search Analytics returns selected rows, has dimension/aggregation differences
  and paginates results. Exhausted returned pagination is not a search census.
  [API reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

## Measurement and remaining owner actions

Private evidence pins September 19–October 16 and the equally sized prior
August 22–September 18 window, with web search, source and maturity metadata.
The date report returns October 4–16 only; the prior window returns no rows.
No zero-traffic or growth claim follows from that absence. Returned page/query
tables and both query-plus-page pages are retained privately with exhausted
pagination. Query-plus-page mappings support intent review; they are not fixed
ranks, qualified leads or proof of any service authority. An unpinned trailing
summary returned different totals and is retained separately; use matching
explicit windows instead of merging those reports.

The homepage URL Inspection result reports submitted/indexed, successful mobile
crawl on October 13 and matching Google/user apex canonical. This is Google's
dated indexed-state evidence, not a live test or coverage for other routes.
Historical HTTP/www landing-page rows alone do not justify changing working
redirects or declaring a canonical defect.

Sitemap status still shows the legacy index's old August crawl and two errors;
the repaired HTTP response does not establish Google reprocessing. Owner action:
inspect detailed warning/error reasons in normal Search Console and, if still
needed, request reprocessing of the repaired index once. The connector remains
read-only. Do not repeatedly resubmit unchanged files. Additional location
promotion requires current availability and useful-content evidence. Optional
CrUX configuration and comparable conversion/outcome evidence remain open.

## Verification status

Local claim and route-migration gates passed, including the retained article
noindex/redirect and zero-retained-post decision checks. Shared-shell,
metadata/schema/sitemap, structured navigation, accessibility, performance,
frontend-control and exact payer-logo checks passed. All four sitemap-date tests
passed. No public/source Primetime artifact changed. Production acceptance
follows the existing GitHub/Firebase release workflow and remains pending here
until the deployed pages and link graph are checked.
