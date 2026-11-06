# Public delivery and SEO review — November 6, 2026

Read the handoff and developer/owner checklists first; refreshed unchanged
`f28a378` and preserved concurrent article, marketing-capacity, maintenance and
draft caregiver work. This pass changes documentation only.

## Current public delivery

Direct public HTTP checks at 16:25 UTC cover all 141 marketing source routes.
All end at HTTP200 without multi-hop redirects, yielding 95 distinct HTML pages
and 93 indexable pages. Indexable titles/descriptions are present and unique,
canonicals match, each page has one H1, and HTML/WebPage metadata agrees. Parsed
JSON-LD, viewport and image-alt presence checks pass. These are technical checks,
not full accessibility, field-performance or Google indexing acceptance.

All 20 sampled artifacts match current Git bytes, including all eight articles,
both listings, core business pages, robots and both sitemap files. The inquiry-
form guide and family-disagreement guide are delivered. Each article's headline
matches its visible H1/manifest; publication and supplied modification dates
agree. Organization author references resolve through the JSON-LD graph to the
approved business name. Absent optional modification dates are not invented.
Google's [Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article)
describes content metadata, without guaranteeing search appearance or rankings.

The delivered canonical sitemap has 36 URLs and excludes `/primetime`. Private
entry meta/header noindex remains intact; anonymous session access returns
HTTP401 JSON with no-store/noindex. The entry also matches Git bytes. Google's
[noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
is distinct from the separately checked authentication boundary.

## Available Search Console evidence

The normal authenticated Sitemaps report remains accessible. Its rows are
unchanged from the prior dated evidence:

| Submitted URL | Last read | Status | Discovered pages |
|---|---|---|---:|
| `https://pthhs.net/sitemap.xml` | November 5, 2026 | Success | 34 |
| `https://www.pthhs.net/sitemap_index.xml` | October 29, 2026 | Success | 34 |
| `https://www.pthhs.net/sitemap.xml` | November 5, 2026 | Success | 33 |

The current 36-URL public file and Google's older 34-URL canonical row are
different observations. Do not sum overlapping inventories or call either an
indexed-page count. Google's [Sitemaps report guidance](https://support.google.com/webmasters/answer/7451001?hl=en)
allows regular recrawling after successful processing; no critical sitemap error
or immediate resubmission need was established. No submission was made.

The optional GSC Wizard connection retains its known subscription refusal. It
was not repeatedly retried or used to invent metrics. No fresh performance,
query-level, conversion, ranking or field-vitals result is accepted here. The
earlier explicit performance comparison remains dated. The isolated Google tab
was closed and report buffers cleared; user tabs were not navigated or reloaded.

## Existing decisions and next actions

The initial-HTML graph still leaves 37 indexable location pages outside the
home-reachable set. This is the existing reviewed promotion backlog. Actual
availability and useful verified local information remain required before new
location promotion; healthy delivery does not close that owner decision.
Approved PAS scope, six payer displays and individual eligibility qualifiers
remain governed by the public-facts and payer registers. No new service,
credential, payer or location assertion was added or independently certified.

No demonstrated runtime defect justified a code change or repeated deployment.
No private record, HHA request/write, account/grant, communication, payment or
business decision was made. Documentation/link audit and diff checks cover this
update. Public and Search Console state is healthy/non-actionable; no new owner
question or notification is needed.

Local evidence: `outputs/primetime-public-seo-crawl-2026-11-06-1619.json`,
`outputs/primetime-seo-article-proof-2026-11-06-1619.json` and
`outputs/primetime-seo-review-2026-11-06-1619.json`. No private query/traffic values
or patient/staff identifiers are retained in repository evidence.
