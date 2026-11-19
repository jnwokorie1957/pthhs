# Laundry guide indexing and dated search evidence

Reviewed November 19, 2026 UTC using the authorized Search Console domain
property. This is stored Google index/report evidence, paired with a separate
current public-delivery check. No live URL test or indexing request was made.

## Guide and sitemap findings

The [laundry guide](https://pthhs.net/articles/helping-with-laundry-without-losing-track-of-clothes)
now has an independently observed **URL is on Google / Page is indexed** result.
Google reports a successful smartphone fetch, crawl/indexing allowed, the
guide's HTTPS apex URL as its declared canonical and **Inspected URL** as the
Google-selected canonical. HTTPS passes and one valid Breadcrumbs item is detected.
The last crawl is displayed as **Nov 18, 2026, 6:15:28 PM**. Google documents
this field as local time; no timezone is shown in this view and it has not been
converted to UTC. The exact UI observation time was not captured.

This is the first guide-specific indexed receipt recorded here. It is not proof
of when the URL first entered the index, search-result placement, traffic or a
causal effect of the article/date-registry changes. Google's
[URL Inspection guidance](https://support.google.com/webmasters/answer/9012289)
distinguishes stored index results from a live test and says index eligibility
does not guarantee an appearance in search results.

| Submitted sitemap | Last read | Status | Discovered |
| --- | --- | --- | --- |
| https://pthhs.net/sitemap.xml | November 17 | Success | 36 |
| https://www.pthhs.net/sitemap_index.xml | November 16 | Success | 36 |
| https://www.pthhs.net/sitemap.xml | November 13 | Success | 35 |

The canonical discovery count now matches the delivered 36-URL inventory.
The overlapping rows are not summed. Discovery is separate from indexing;
the single guide result does not establish that all 36 URLs are indexed.
The earlier November 14/35 receipt remains historical.

About has a separate fresh stored result: **URL is not on Google / Discovered -
currently not indexed**. Last crawl, fetch, permissions and both canonical
fields are N/A. This does not imply that current HTML lacks a canonical. The
other four November 8 examples and property-wide index totals were not refreshed.
The preceding [About delivery check](2026-11-13-indexing-examples-review.md)
retains its date; no new About delivery defect or automatic fix is established.

## Explicit weekly property comparison

The visible **Web (text)** metric cards were compared with custom dates, with
both period labels verified and no extra visible query/page/country/device/
appearance filter chips. Dates below are Search Console reporting dates.

| Displayed metric | November 9–15 | November 2–8 |
| --- | ---: | ---: |
| Clicks | 25 | 29 |
| Impressions | 5.38K | 4.45K |
| Average CTR | 0.5% | 0.7% |
| Average position | 23.9 | 21.6 |

The abbreviated/rounded card values are preserved; impressions are not exact
integer counts. These are property totals, not guide performance or qualified
leads/conversions. Four fewer clicks and the changed impression/position mix
alone do not establish an anomaly, cause or title-rewrite opportunity. Raw
queries and account identity were not saved. The comparison uses verified
card period labels, not the chart's unreliable date alternative. See Google's
[Performance report overview](https://support.google.com/webmasters/answer/7576553).

## Current delivery, claims and remaining work

At **01:47:47 UTC**, seven public artifacts match `c425cfe` Git bytes: homepage,
both article listings, the guide, robots.txt and both sitemap files. The guide
has one self canonical, title, nonempty description and H1, Article metadata,
resolved Organization author/publisher and the actual November 15 publication
date. No modification date is invented. Initial HTML connects homepage to
Articles and both listings to the guide. The three verified sitemap dates
remain November 15, consistent with
[Google's significant-change guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
Primetime page/header noindex/no-cache and anonymous session 401/no-store/noindex pass.

Approved PAS facts, payer-display evidence and claim-release controls were
reviewed unchanged. No service, credential, payer/member coverage, location or
business-history claim was added. Additional location/useful-content and
authorized directory-correction decisions remain with the owner; the old
directory observations were not reverified or submitted in this check.

The delivery comparison above predates concurrent PR48/`e8904ff`, which refreshes
the existing Houston first-call checklist and its listing/sitemap dates. Those
source changes are preserved. This receipt does not verify that later
publication's deployment; this evidence update does not deploy it.

No additional runtime change or deployment is justified by these observations.
Keep About's next diagnostic bounded to a newer crawl/report receipt;
retain existing private protections and actual content dates. This documentation
update needs repository/link/diff checks, not another runtime suite or release.
Local nonsensitive receipts: `primetime-seo-search-evidence-20261119.json` and
`primetime-seo-guide-delivery-20261119.json`.
