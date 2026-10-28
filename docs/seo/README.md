# SEO Strategy Reference

These files remain useful for planning, but they do not override current public
facts, payer evidence, or claim-release controls.

- [October 28 public SEO and task review](2026-10-28-seo-review.md) — fresh
  production checks, normal Chrome Search Console access, dated sitemap/field
  evidence and correction of the current planning inventory to 29 URLs.

October 28 priority-location metadata correction: Houston, southwest Houston,
Alief and Sugar Land landing pages now use Open Graph `website` rather than
`article`. Commit 571e8a7610463737871cece539bab5a75b3f8881 changes only those
four metadata values, their generator rule and regression coverage. Conroe,
other locations, article credit/prose, claims, logos and private portal are unchanged.
All four regression subcases failed before the correction; 14 article/metadata
tests, independent review and the exact-commit aggregate gate passed afterward.
[Release 40609698428](https://github.com/jnwokorie1957/pthhs/actions/runs/40609698428)
completed Hosting at 00:35:44 UTC and backend at 00:36:09 UTC. Nine ordinary public
pages matched commit bytes at 00:36:15 UTC with expected canonicals, one H1 and
no page-level noindex; the four corrected types were `website`, the published
article remained `article`. This is social-preview semantics, not measured ranking
or indexing harm/improvement. No fresh GSC/Maps/conversion evidence was available;
the unchanged paid-reporting blocker was not retried. Native/AT acceptance was
not performed in this pass. Rollback: scoped revert of 571e8a7 through normal release.
Current references: [Open Graph types](https://ogp.me/#types),
[Google links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
and [Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article).

- [October 27 Articles browser review](2026-10-27-articles-browser-review.md) —
  bounded desktop/mobile keyboard acceptance, publisher punctuation correction,
  current public crawl and explicit assistive-technology/outcome limits.

- [October 23 SEO and developer-task review](2026-10-23-seo-review.md) — fresh
  delivery/sitemap evidence, unavailable field samples and closure of the
  historical dependency-advisory recheck; runtime and business claims unchanged.

- [October 22 SEO and owner-task review](2026-10-22-seo-review.md) - fresh
  public and Search Console checks, unavailable field samples and reconciliation
  of the completed sitemap action; public/runtime assets unchanged.

- [October 21 contextual service-link acceptance](2026-10-21-contextual-links.md)
  — seven deployed links, independent wording/destination review, bounded
  production keyboard checks and fresh public/sitemap evidence; no outcome claim.

- [October 20 SEO and owner-task review](2026-10-20-seo-review.md) — healthy fresh
  public checks, successful normal sitemap reads, retained outcome/owner limits
  and bounded P1-N administrator discovery navigation acceptance.

- [October 19 sitemap reprocessing and SEO review](2026-10-19-seo-review.md) —
  diagnosed legacy 404/HTML errors, one successful Google reprocessing request,
  fresh public checks, actual browser reporting limits and unavailable field data.

- [October 18 guide and SEO review](2026-10-18-seo-review.md) — visitor guide,
  contextual navigation, verified core-page reachability, explicit-window private
  Search Console/query-page evidence and remaining location/reprocessing actions.

- [October 15 technical review](2026-10-15-sitemap-review.md) — restored legacy
  sitemap index, live verification, available read-only Search Console evidence
  and remaining reprocessing/field-performance dependencies.

- [October 16 navigation and strategy review](2026-10-16-seo-review.md) —
  full public-route HTTP/metadata inventory, shared policy-footer repair,
  current Google guidance and measurement limits.

- `PTHHS_COMPETITOR_REVERSE_ENGINEERING.md` — historical competitor hypotheses.
- `PTHHS_KEYWORD_TO_PAGE_MAP.md` — historical proposed ownership map.
- `PTHHS_LOCATION_PAGES_DEPLOYMENT.md` — historical location inventory.
- `PTHHS_MONEY_PAGES_STRENGTHENING.md` — current evidence and page decisions.
- `PTHHS_STRIKING_DISTANCE_KEYWORDS.md` — measured private GSC review method;
  baseline access works, while outcome and query-to-page validation remain open.
- `county-hubs.csv`, `county-hubs.json`, and `county-hubs.md` — the same county
  planning dataset in tabular, machine-readable, and narrative formats.

Do not infer current Search Console performance, payer participation, or service
authority from these planning documents.
