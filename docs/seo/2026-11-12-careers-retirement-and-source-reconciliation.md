# Careers retirement, search evidence and release source

Checked November 12, 2026. The owner approved removing Careers in the
caregiver navigation review on November 11. The separate caregiver release
implements that decision. Do not restore Careers to explain a lower sitemap
count or deploy an older source tree over that release.

## Production delivery

At 17:52 UTC the canonical sitemap contains 35 unique URLs and matches
caregiver source commit `ed534254647fca1da3ecca042a281c4af82cbcc4`.
The sole difference from main's 36-URL inventory is the retired
`/home-care-careers` entry. All 35 URLs return 200 directly, match that source
commit, have one self-canonical and one H1, and lack meta/header noindex.
All three old Careers paths (extensionless, `.html`, and trailing slash)
return 301 to `/caregiver`.

Primetime's HTML still matches main, retains meta/header noindex and
no-cache, and its anonymous session endpoint returns 401/no-store/noindex.
This check makes no claim about authenticated records, caregiver collection
settings, source-time recovery or the acceptance of the application's forms.

Read-only Search Console shows canonical sitemap Success, last read
November 12, 35 discovered. The legacy www index shows Success, last read
November 7, 35; the older www sitemap shows Success, November 5, 33.
These inventories overlap. The current 35-page canonical count matches the
approved live inventory. The earlier 36-page observations remain historical
evidence, rather than a current target. No sitemap was resubmitted.
[Google defines discovered pages as parsed unique page URLs, without an indexing guarantee.](https://support.google.com/webmasters/answer/7451001?hl=en)

## Settled performance comparison

The native domain-property report displayed Search type **Web (text)**,
with no added page, query, country or device filter. Property metric cards
showed the following custom Monday-Sunday comparison:

| Metric | November 2-8, 2026 | October 26-November 1, 2026 |
| --- | ---: | ---: |
| Clicks | 29 | 22 |
| Impressions | 4,452 | 4,268 |
| CTR, as displayed | 0.7% | 0.5% |
| Average position, as displayed | 21.6 | 22.7 |

These are property totals, not summed query-table rows or all search types.
The seven extra clicks are a small descriptive weekly change, not evidence
of a lasting trend, a specific release's effect, leads or conversions.
The selected dates exclude the newest preliminary days. Table totals can
differ because of aggregation and privacy limitations.
[Google Performance report interpretation](https://support.google.com/webmasters/answer/7576553?hl=en).
No metadata rewrite or new business claim is justified by these totals alone.

## Required source reconciliation before another release

Refreshed main is `631e20d2a40b9a04c16d186b886a5cc9890f408c`.
Its public navigation, sitemap and Hosting redirects predate the approved
Careers removal. The separate local caregiver branch is
`feature/caregiver-navigation-preview` at `ed534254647fca1da3ecca042a281c4af82cbcc4`;
that branch name was not available from origin on this check. Its existing
release receipt identifies Hosting release `1794426295104000`, verified
November 11 at 19:45 UTC. Production bytes independently match its current
35-URL public inventory. Main's normal PR26 release jobs succeeded, but that
does not make main a complete source for this subsequent caregiver release.

Developer action: preserve and publish the reviewed caregiver source history
to a review branch, reconcile it with current main through the existing
GitHub workflow, and inventory the actual current Hosting configuration and
backend separately before deployment. Include Careers redirects, sitemap,
public links, caregiver assets, generators and their regressions. Preserve
the current Primetime assets, source-write locks, noindex/cache/auth rules,
and the separately approved caregiver settings. Do not infer or change any
clinical, financial, access, sending or intake policy during reconciliation.

Acceptance: main represents the approved live public inventory; its build
does not regenerate Careers or stale portal links; relevant tests, asset
checks, diff review and required release jobs pass; production checks verify
both preserved experiences after deployment. No runtime change or deployment
was made in this SEO pass. The existing owner-confirmed location/content,
retention and final-form prerequisites remain separate.

Local nonsensitive receipts: `primetime-seo-canonical-check-20261112.json`
and `primetime-seo-search-evidence-20261112.json`. The initial main comparison
is retained as `primetime-seo-main-comparison-20261112.json`; its byte mismatch
identified source drift and was not a failure of the approved live inventory.
Private indexing guidance remains applicable:
[robots meta and X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
