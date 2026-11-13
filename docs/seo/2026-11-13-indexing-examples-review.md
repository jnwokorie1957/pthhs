# Canonical sitemap indexing examples and current delivery

Checked November 13, 2026; public delivery checked at 22:05 UTC against
24a8917, whose runtime source is PR37/1d06a7b. This is a bounded review
of Search Console's dated report and its five examples.

## Search Console scope

The normal authorized browser shows the canonical sitemap as **Success**,
last read November 12, with **35 discovered pages**. The older www sitemap
rows remain successful with their own earlier read dates and overlapping
inventories. Nothing was resubmitted.

The Page indexing report, filtered to https://pthhs.net/sitemap.xml,
shows **29 indexed** and **5 not indexed**, with last update **November 8**.
Its only non-indexed reason is **Discovered - currently not indexed**.
The examples table shows 1-5 of 5; every last-crawled entry is N/A, and the
reason was first detected November 6.

These dated 34 report URLs are not a current census of the 35-URL sitemap.
No change, gain, loss or causal effect is inferred from those different
report dates and scopes. The unfiltered property totals include other URLs
and are not used as canonical-sitemap counts. No validation, indexing request,
removal, share or account-setting action was taken.

## Five examples checked against production

| Public route | Direct response / source | Initial-HTML homepage navigation |
| --- | --- | --- |
| /home-care-about-us | 200 / exact Git | Direct link |
| /home-care-services/medication-reminders | 200 / exact Git | Direct link |
| /locations/alief | 200 / exact Git | Direct link |
| /locations/southwest-houston | 200 / exact Git | Direct link |
| /terms-of-use | 200 / exact Git | Direct link |

All five have one matching HTTPS apex canonical, one H1, a description,
a title, parsed JSON-LD and no page/header noindex. Navigation above is the
local source's initial-HTML anchor graph, not a new rendered-browser or
assistive-technology acceptance. The homepage, robots.txt, sitemap and
sitemap index also return direct 200/exact Git: **nine delivery artifacts**.
The sitemap has 35 unique public URLs and omits retired Careers and private
portal routes. No current delivery, canonical or discovery-link defect was
demonstrated by these examples.

Google explains that this report label means a discovered URL has not yet
been crawled in that report. Its
[Page indexing guidance](https://support.google.com/webmasters/answer/7440203)
distinguishes report-level examples from URL Inspection. The next bounded
diagnostic is to inspect an important example's current indexed result when
the report refreshes, and compare its crawl/receipt dates before proposing
a fix. No blanket redirect, resubmission or speculative metadata rewrite is
justified by this dated label.

## Release, claims and remaining actions

The preceding 21:41 UTC acceptance records all four PR37 release jobs and
33 delivery artifacts, unchanged caregiver configuration and private
noindex/cache/anonymous-denial controls. It is preserved as a dated receipt;
this review did not rerun those checks or deploy another release.
The November 12 settled performance comparison remains the latest verified
comparison; no new traffic, qualified-lead, conversion or field-vitals result
is claimed. The optional paid connector was not retried; normal browser
Search Console access supplied the report above.

Current primary guidance was checked for
[robots headers/meta](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag),
[sitemap content dates](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
and [structured-data accuracy](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
Private noindex protections and actual significant-change dates remain.
Business facts, approved PAS terminology, six approved payer displays and
claim-release controls were reviewed unchanged. No service, credential,
payer/member coverage, location or business-history claim was added.

The measured-keyword plan's former instruction to preserve a current
32-URL sitemap now points to the approved 35-URL inventory. Its older
observations remain dated. Owner confirmation of additional locations/useful
content and authorized directory corrections remains pending. No owner
decision or checkbox is completed here.

Local nonsensitive receipt:
primetime-seo-indexing-examples-20261113-2156.json.
Current runtime acceptance:
[staff follow-up](../workforce/MEDIUM_FOLLOW_UP_2026-11-13.md) and
[current role evidence](../management-layer/ROLE_WORKFLOW_RESEARCH.txt).
This documentation update requires audit/link/diff checks and no runtime release.
