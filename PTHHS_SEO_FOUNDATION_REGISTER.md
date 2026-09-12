# PTHHS SEO Foundation Register

**Reviewed:** September 10, 2026  
**Scope:** Plan items 53, 54, 56, 57, 60, 62, and 63

## Completed controls

- All 132 HTML files are checked for obsolete `meta keywords`; none remain.
- Every one of the 85 indexable routes has a nonempty, unique title and meta description.
- Every indexable route has one generated JSON-LD graph containing only `Organization`, `WebSite`, and `WebPage` nodes.
- Organization data comes from `PTHHS_PUBLIC_FACTS.json`: legal business name, canonical URL, phone, public email, and street address.
- Structured data is removed from all noindex fallback and quarantine pages.
- The sitemap is regenerated from the complete 85-route indexable inventory. It cannot include missing, noindex, redirected, or alternate-host URLs.
- All 118 permanent redirects are governed by `firebase.json`; eligible route redirects have explicit `.html` twins.
- All 4,009 HTML anchors use clean internal URLs without own-host absolute URLs, `.html` suffixes, dot-relative paths, alternate hosts, or redirect sources.

## Claim repair found during QA

The schema rebuild removed claims that lacked an approved source. The September 11, 2026 business-owner attestation now governs the restored history, payer, Region 5/6, testimonial, award, customer, satisfaction, and staffing claims. The public-facts and source registers are permanent release inputs.

The second regression round also found and repaired a broken `#protective_supervision` link, removed that unsupported service promotion, corrected repeated `City,.` punctuation, and normalized the sensitive-term register to deterministic LF line endings.

## Verification results

- Deployment-equivalent metadata/build pipeline: pass.
- Batch A, B1, B2, B3, and B4 gates: pass.
- Sensitive-term register: 772 classified occurrences; zero unresolved.
- Independent static crawl: 132 documents, 4,009 canonical anchors, and 132 fragments; zero failures.
- Generator idempotence and `git diff --check`: pass.

## Deliberate exclusions and blockers

- All 65 current location routes are linked from the Areas inventory and included when indexable; coverage is constrained by the approved eleven-county register and availability caveats.
- Service schema remains limited to visible approved non-medical service content. Review/aggregate-rating, payer/network, credential, award, and quantitative claims are not added to schema.
- Search Console submission and canonical-property configuration still require authorized account access.
- Production crawling remains a post-deployment task; no deployment occurred in this batch.
- Browser-width QA remains open because the pinned Chromium download returned truncated archives and an upstream 502; the existing Playwright harness is unchanged for a later retry.

## Repeatable commands

```sh
python3 scripts/seo_foundation.py
python3 scripts/verify_batch_b4.py
```
