# PTHHS SEO Foundation Register

**Reviewed:** September 10, 2026  
**Scope:** Plan items 53, 54, 56, 57, 60, 62, and 63

## Completed controls

**October 19 follow-up:** current public HTTP/XML/redirect/metadata and private
indexing boundaries passed. Normal Search Console browser access identified
the historical index's 404/HTML errors and accepted one refresh of the repaired
file. Google now reports Sitemap index / Success, last read October 19. This
resolves the earlier reprocessing dependency; discovery counts do not establish
indexing gains. Automated reporting access is unavailable; browser reads work.
Core Web Vitals currently has insufficient field usage data. See
[current evidence](docs/seo/2026-10-19-seo-review.md).

**October 15 follow-up:** the generator and Batch B4 verifier now preserve the
historical `sitemap_index.xml` submission as a valid index of the canonical
27-route sitemap. Live 200/XML and www redirect checks passed. Read-only Search
Console evidence is now available; Google reprocessing and optional CrUX setup
remain distinct pending actions. Current verifiers report five existing Service
nodes and 71 breadcrumb routes under the approved-facts controls; the inventory
below records the September 10 state. This repair adds no schema or business
claims. See [current evidence](docs/seo/2026-10-15-sitemap-review.md).

- All 132 HTML files are checked for obsolete `meta keywords`; none remain.
- Every one of the 84 indexable routes has a nonempty, unique title and meta description.
- Every indexable route has one generated JSON-LD graph containing only `Organization`, `WebSite`, and `WebPage` nodes.
- Organization data comes from `PTHHS_PUBLIC_FACTS.json`: legal business name, canonical URL, phone, public email, and street address.
- Structured data is removed from all noindex fallback and quarantine pages.
- The sitemap is regenerated from a reviewed 27-route publication set. It cannot include missing, noindex, redirected, or alternate-host URLs.
- All existing migration redirects remain intact. Six additional historical location patterns from `docs/archive/seo-2026-08/PTHHS_LEGACY_REDIRECT_MAP.md` are implemented, and eligible permanent redirects have explicit `.html` twins.
- All 3,634 HTML anchors use clean internal URLs without own-host absolute URLs, `.html` suffixes, dot-relative paths, alternate hosts, or redirect sources.

## Claim repair found during QA

The schema rebuild removed stale payer, FAQ, service-area, social-profile, and testimonial assertions that were not sourced from the approved public-facts register. The same pass replaced visible unsupported “long-standing,” multiple-plan, Region 5/6, and testimonial-promotion wording with neutral, verification-first language. These checks are permanent release gates.

The second regression round also found and repaired a broken `#protective_supervision` link, removed that unsupported service promotion, corrected repeated `City,.` punctuation, and normalized the sensitive-term register to deterministic LF line endings.

## Verification results

- Deployment-equivalent metadata/build pipeline: pass.
- Batch A, B1, B2, B3, and B4 gates: pass.
- Sensitive-term register: 766 classified occurrences; zero unresolved.
- Independent static crawl: 132 documents, 3,005 internal targets, and 132 fragments; zero failures.
- Generator idempotence and `git diff --check`: pass.

## Deliberate exclusions and blockers

- The sitemap does not promote additional location/county routes until current operational coverage is documented and approved. This does not change their current page status.
- Service schema, service-area schema, review/aggregate-rating schema, payer/network schema, credentials, awards, founding dates, and quantitative claims are not generated.
- Search Console submission and canonical-property configuration still require authorized account access.
- Production crawling remains a post-deployment task; no deployment occurred in this batch.
- Browser-width QA remains open because the pinned Chromium download returned truncated archives and an upstream 502; the existing Playwright harness is unchanged for a later retry.

## Repeatable commands

```sh
python3 scripts/seo_foundation.py
python3 scripts/verify_batch_b4.py
```
