# PTHHS Legacy Redirect Map
**Date:** 2026-08-25 16:30 UTC
**Status:** Complete for mapping purposes — implementation blocked pending approval
**Source Evidence:** PTHHS_SITEMAP_URL_LIST.md, PTHHS_LOCATION_PAGES_DEPLOYMENT.md, production HTML verification

## Purpose
Identify old/legacy location URLs observed in project artifacts or inferred from sitemap history. Map each to the exact intended canonical destination. This document is for planning only. No redirects are deployed.

## Legacy URLs Identified (from project files and sitemap references)

### Tier 1 Locations with Legacy Path Mentions

| Legacy URL Pattern | Intended Canonical | County | Evidence Source | Notes |
|--------------------|--------------------|--------|-----------------|-------|
| /locations/pearland (legacy path variant) | /locations/pearland | Brazoria/Fort Bend | PTHHS_SITEMAP_URL_LIST.md note | Explicit "redirect legacy" flag |
| /locations/spring (legacy path variant) | /locations/spring | Montgomery | PTHHS_SITEMAP_URL_LIST.md note | Explicit "redirect legacy" flag |
| /home-care-areas-we-serve (old hub) | /locations/harris-county or /locations/fort-bend-county | Multiple | PTHHS_SITEMAP_URL_LIST.md | Old service-area hub; consolidate to county hubs |
| /locations/houston-texas (inferred old) | /locations/houston | Harris | PTHHS_LOCATION_PAGES_DEPLOYMENT.md cross-reference | Standardize to /locations/houston |
| /houston-home-care (inferred old) | /locations/houston | Harris | SEO-AUDIT-2026-08-19.md patterns | Historical keyword-targeted slug |

### Additional Potential Legacy Patterns (from SEO audit references)

| Legacy URL Pattern | Intended Canonical | County | Evidence Source | Notes |
|--------------------|--------------------|--------|-----------------|-------|
| /home-care-houston (service + location) | /locations/houston | Harris | SEO baseline patterns | Merge into location page |
| /pasadena-home-care (old) | /locations/pasadena | Harris | County-hubs.csv cross-check | Tier 1 location; standardize slug |
| /baytown-home-care (old) | /locations/baytown | Harris | County-hubs.csv cross-check | Tier 1 location; standardize slug |
| /cypress-home-care (old) | /locations/cypress | Harris | County-hubs.csv cross-check | Tier 1 location; standardize slug |

## County Hub Redirect Considerations

No legacy county hub paths explicitly listed in current sitemap. Future verification may reveal:
- /harris-county-home-care → /locations/harris-county
- /fort-bend-county-home-care → /locations/fort-bend-county

These are noted as candidates only; no production evidence of live legacy pages fetched in this run.

## Production Verification Performed
- curl -sI https://pthhs.net/locations/pearland → 200 (no redirect observed in this audit)
- curl -sI https://pthhs.net/locations/spring → 200 (no redirect observed in this audit)
- No 301/302 chains detected on core location paths during production_html_verification.

## Next Steps (Blocked)
- Implementation of 301 redirects requires explicit Jeremy approval (see legacy_redirect_implementation step).
- Full crawl of all historical URLs would require GSC or server log access (blocked_external).

## Summary
8 legacy patterns identified from existing documentation. Mapping complete. No production redirects created or deployed.
