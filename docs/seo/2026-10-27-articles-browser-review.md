# Articles browser review — October 27, 2026

Reviewed from the 20:14 UTC scheduled follow-up, starting at
`92afd9382c0c06c0222f69a55159b7e6a612f72b`.

## Bounded browser acceptance

In a separate Chrome tab, the public homepage's Resources → Articles keyboard
transition and Enter navigation reached the published collection. Enter on the
article title reached its canonical article, with one H1 and the retained
company attribution, AI assistance disclosure and citations.

At 390 × 844, Enter opened the mobile navigation, Escape closed it and returned
focus to the menu button. Articles was hidden while closed, available while
expanded, and Enter reached the collection. Its article card and Home Care Guide
link worked. The guide retained its article link and practical service content.
The article, index and guide had no observed horizontal overflow; the article
also fit the default 1280-pixel viewport. Collection Open Graph type is `website`;
the individual article retains `article`.

This closes these bounded native browser/keyboard checks. Screen-reader,
broader assistive-technology and full accessibility conformance acceptance
remain unverified. No private dashboard tab or source record was used.

## Formatting correction and validation

The browser exposed a duplicated period after the publisher's legal name.
The renderer now emits one sentence-ending period. The generated article and
sensitive-term register differ only by that punctuation; approved article
body, citations, metadata dates, claims, sitemap and private app bytes are
unchanged. No new test was added for this formatting-only change.

All 13 existing article tests and 24 normal generator/validator steps passed.
The first test attempt used raw renderer output before SEO postprocessing and
therefore lacked the expected schema graph; running the normal generation order
resolved that intermediate-output failure. Generator-only newline changes were
removed only after exact normalized-byte comparison with the committed files.

A fresh public crawl reached all 134 source routes at final HTTP 200, with
88 distinct final HTML pages and 86 indexable finals. Metadata, canonical, H1
and policy-link checks passed. Nineteen public artifacts and both XML sitemap
redirects/private boundaries passed. The current approved sitemap has 29 URLs,
including the article and collection; an older local checker count was updated
after the served sitemap already matched Git bytes. This was a checker
assumption, not a site delivery failure.

Google's [Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article)
and [link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
were rechecked. Accurate attribution/dates and descriptive crawlable links are
retained; no indexing, ranking, rich-result or lead improvement is claimed.

## Remaining evidence

The 37 unlinked location findings still require actual availability and useful
content before promotion. Search Console's last browser observations remain
dated: both sitemap rows were successful with 27 discovered pages before these
new pages were published; field samples were insufficient. No fresh report,
resubmission, account or paid reporting change was made here. Current native
Search Console access needs an available signed-in tab.

Exact release/artifact and post-release formatting proof are recorded in the
dated handoff. The scoped rollback is a revert through the normal workflow.
