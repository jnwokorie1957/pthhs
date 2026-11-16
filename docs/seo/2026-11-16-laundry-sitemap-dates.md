# Laundry guide publication dates and SEO delivery

Checked November 16 UTC (November 15 America/Chicago), based on
afc1bfcbcc5d17d34814a02c6476ffdb03f0923d. The reviewed November 15 article
and its two listing updates were published in
[bc5e8ca](https://github.com/jnwokorie1957/pthhs/commit/bc5e8caf73419443c7a86f4b8c600482e5e39d06).
Concurrent portal and role-research changes are preserved.

## Bounded sitemap change

The article's sitemap entry omitted optional `lastmod`. The updated `/articles`
and `/home-care-blog` entries still recorded November 2. The reviewed date
registry now records **November 15, 2026** for these three routes, matching
the actual publication and listing-link change. No other date or URL changes.
The inventory remains **36 canonical URLs**, with eight promoted locations and
57 other location files still subject to owner availability/useful-content review.
Retired Careers and private portal entries remain excluded.

Omitting `lastmod` is valid; this supplies supported content-change information.
It does not manufacture a new publication date, article `dateModified`, crawler
receipt, indexing status or traffic gain. The
[Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
says to use accurate significant-change dates. The content registry continues
to validate reviewed routes, dates and evidence instead of using build time.

## Baseline and validation

At 01:35:35 UTC, seven public artifacts return direct 200/exact Git: homepage,
both listings, the new article, robots, sitemap and historical sitemap index.
The article has one H1, a title/description, matching HTTPS apex canonical,
Open Graph article type and no noindex. Its Article graph has November 15
publication, no invented modification date and resolved Organization author
and publisher. Both listings link directly to it; the homepage links to Articles.
This initial-HTML graph is not a new assistive-technology or rendered reading test.

Four date-validation tests, all 28 article tests and Batch B4 pass. The latter
checks 93 unique metadata/schema pages, 36 sitemap URLs, 122 permanent redirects
and 4,498 canonical anchors. Targeted sitemap generation is idempotent; all
33 unrelated entries and the publication set stay unchanged. Both normal PR
quality jobs passed (43787583496), followed by both required Hosting-only scope
and build/deploy jobs (43787784914). Backend and analytics jobs were skipped.

## Search Console and owner limits

The authorized domain-property Sitemaps report shows the canonical sitemap as
Success, **last read November 14**, with **35 discovered pages**. That read
precedes the new article. It is not the current 36-URL source inventory or an
indexing count. No sitemap, indexing, validation, removal or account-setting
request was submitted. The optional paid connector was not retried; the normal
browser supplied this bounded read. Earlier Page indexing and performance
observations retain their dates and scopes; neither was refreshed here.

Current [Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article)
was checked for author/type/date accuracy, and
[robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
for private page/header protections. The preceding 01:14:45 UTC release's
private noindex/cache/anonymous-denial receipt remains dated. At 01:44:04 UTC,
this release independently verifies private header/meta noindex and no-cache,
plus anonymous session 401/no-store/noindex.

Approved public facts, nonmedical PAS scope, payer display evidence and the
claim-release gate were reviewed. This metadata change adds no service, duty,
credential, payer coverage, location or outcome claim. The family laundry guide
does not establish laundry as an individual agency caregiver's assigned duty.
No owner decision or checkbox is completed. Additional location content and
authorized directory/citation corrections retain their existing human inputs.

Local nonsensitive baseline: `primetime-seo-laundry-baseline-20261116.json`.
At 01:44:04 UTC, all seven public artifacts match release
f376ca48256ba24801461f1646d751ceb5b0b9b3. The delivered XML has November 15
for all three entries and retains the 36-URL inventory. Article metadata,
Organization credit, source/navigation bytes and private boundaries pass.
No article HTML, private entry, backend or configuration changed in this release.

[PR41](https://github.com/jnwokorie1957/pthhs/pull/41),
[quality](https://github.com/jnwokorie1957/pthhs/actions/runs/43787583496) and
[Hosting-only release](https://github.com/jnwokorie1957/pthhs/actions/runs/43787784914).
Production receipt: `primetime-seo-laundry-production-20261116.json`.
Native release proof: `primetime-seo-release-20261116.png`.
Normal PR/deployment controls were used; this subsequent evidence-only update
does not need another runtime deployment.
