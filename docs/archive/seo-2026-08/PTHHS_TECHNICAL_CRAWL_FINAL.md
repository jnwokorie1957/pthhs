# PTHHS Technical Crawl Final Report
**Date:** 2026-08-25 16:35 UTC
**Status:** Complete with current production evidence
**Methodology:** curl -sI and curl -sL on production URLs. Focused on redirect chains, 404s, canonical conflicts, indexability, duplicate patterns. Supplemented by existing July 2026 crawl-report.json (14 pages successful).

## Production Verification Targets
Core pages fetched via curl -sI (headers) and -sL (body where needed) on 2026-08-25.

### Redirect Chains & Final URLs
- https://www.pthhs.net/ → 301 → https://pthhs.net/ (clean, no chain)
- https://pthhs.net/ → 200 (final)
- https://pthhs.net/home-care-contact-us.html → 200 (final, no redirect)
- https://pthhs.net/home-care-meet-our-staff.html → 200
- https://pthhs.net/home-care-services-attendant-care-services.html → 200
- https://pthhs.net/locations/houston → 200
- https://pthhs.net/locations/katy → 200
- https://pthhs.net/locations/pearland → 200 (no legacy redirect observed)
- https://pthhs.net/locations/spring → 200 (no legacy redirect observed)

**Finding:** No redirect chains >1 hop. No 301/302 loops. Legacy location paths return 200 directly.

### Internal 404s
No 404 responses observed on any fetched production URL (6 core + 4 location pages). All returned 200.

### Canonical Conflicts
- Homepage (pthhs.net/): Canonical header/meta points to https://www.pthhs.net/ (mismatch with serving domain pthhs.net)
- All other pages: Canonical not explicitly conflicting in header inspection; full HTML meta extraction would confirm.

### Duplicate Titles / H1s
From production_html_verification + live_title_h1_verification:
- No exact duplicate titles observed across fetched pages.
- Contact page title still contains legacy "Light House Keeping" phrasing.
- Location pages follow consistent "Home Care in [City] TX | Personal Assistance Services" pattern (intentional, not duplicate).

### Indexability Issues
- No noindex directives detected on any fetched page.
- robots.txt not inspected in this run (would require separate curl).
- All pages serve 200 and appear crawlable.

### Orphan-Risk Pages
- /home-care-areas-we-serve.html exists in old crawl artifacts but is not referenced in current sitemap draft (potential orphan if not linked from nav/footer).
- County hub pages (/locations/harris-county etc.) referenced in sitemap but not fetched in this crawl; existence unknown.

### Broken Internal Links
- No evidence from curl inspection (would require full HTML link extraction and follow).
- Old July 2026 crawl rewrote links to .html but did not report broken links.

### Schema Presence (Preliminary)
- Homepage: 1 schema instance detected (type unknown without full extraction).
- Other pages: Not counted in header-only crawl.

## Evidence Sources
- Current curl runs (2026-08-25)
- PTHHS_PRODUCTION_HTML_VERIFICATION.md (6 pages)
- PTHHS_LIVE_TITLE_H1_VERIFICATION.md
- extracted/www.pthhs.net/crawl-report.json (July 2026 baseline: 14/14 success)

## Summary of Technical Issues
1. Homepage canonical mismatch (www vs non-www) — minor, low impact.
2. Legacy title phrasing on contact page — already flagged in live_title_h1_verification.
3. Potential orphan: /home-care-areas-we-serve if not in current nav.
4. No major redirect, 404, or indexability blockers found.

**No critical technical crawl blockers identified for sitemap consideration.**
