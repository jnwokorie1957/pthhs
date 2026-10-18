# PTHHS measured keyword review
**Reviewed:** October 18, 2026
**Status:** Replaces the August 19 template's assumed positions, difficulty scores,
conversion weights and improvement forecasts.

## Evidence and method

Read-only Search Console access works. The owner's private baseline contains the
returned query table with pagination exhausted. A fresh October 16 extract also
exhausted page-report pagination; the original first-30-row file stays unchanged.
Keep raw queries and account evidence outside this repository. An exhausted
response is not a census: Google's [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
can omit rows, and date reports omit days with no returned data.

The October 16 refresh is settled through October 13. The equally sized preceding
window returned no observations; this does not establish zero prior traffic or
growth. See the [current review](2026-10-16-seo-review.md).

1. Save property, exact dates, search type, dimensions, country/device filters,
   data source, freshness and pagination with each private extract. Compare
   equally sized settled windows with matching definitions.
2. Separate branded searches from relevant non-medical PAS, attendant care,
   personal care, respite and ADL searches. Review automated classifications.
   Clinical/therapist queries do not authorize new marketed services.
3. Treat returned average positions 4–30 as an exploratory shortlist alongside
   impressions, clicks and user need. Position is an average, not a fixed rank.
   GSC does not supply keyword difficulty or qualified-lead/conversion scores.
4. Retrieve query-plus-page evidence for shortlisted queries using the same
   filters; page totals cannot assign a query to a URL. Finish pagination before
   calling the returned table complete.
5. Inspect the canonical page and user task. Prefer a specific verified answer or
   useful link over a duplicate page for a synonym. Apply the business registers
   listed in the [page review](PTHHS_MONEY_PAGES_STRENGTHENING.md).
6. Record the hypothesis, exact proposed change, evidence source, acceptance
   check and release. Preserve recent copy while measurement is insufficient;
   correct demonstrated technical faults independently.
7. Compare later settled observations. Combined CTR is clicks / impressions;
   combine average positions with impression weights. Report coverage limits
   and avoid causal or lead claims without supporting measurement.

For each private candidate retain query, canonical page, window/filters,
clicks, impressions, CTR, average position, pagination, user intent, approved
business evidence, proposed change, release and later observations. Leave unknown
fields unknown. Do not populate example rows with estimated ranks or promise
top-three results.

## Current implementation rules

- Explain the page naturally with clear titles, headings and links; do not use an
  exact-match repetition quota.
- FAQ rich results ended May 7, 2026; Google removed their documentation in June.
  Visible questions can help readers, but FAQ markup is not a rich-result
  opportunity. [Google updates](https://developers.google.com/search/updates)
- Business-controlled Organization/LocalBusiness reviews, including third-party
  widgets, are ineligible for Google's review stars. Do not invent ratings or
  add aggregate ratings as a ranking fix.
  [Review guidance](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- Do not change dates to imply freshness or expand to a word-count quota.
  Additional locality pages need useful verified content.
  [People-first guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

October 18: an explicit September 19–October 16 private refresh exhausted the
returned page/query reports and both query-plus-page pages. A first PAS-themed
candidate review is retained privately; it does not validate new services,
locations or fixed ranks. An equally sized prior window returned no rows. The
guide/navigation change addresses a separately demonstrated crawl gap, not an
assumed query ranking gain. See [review](2026-10-18-seo-review.md).

Next: continue candidate intent review and compare later settled outcomes. Preserve
the 27 reviewed sitemap URLs and eight promoted locations. The other 57 location
files require availability and useful-content review before further promotion.
Outcome validation remains open pending comparable evidence.
