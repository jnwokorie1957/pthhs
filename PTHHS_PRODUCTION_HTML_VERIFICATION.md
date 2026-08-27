# PTHHS Production HTML Verification Report
**Date:** 2026-08-25 16:25 UTC
**Status:** Partial — 6 core pages fetched successfully. Additional pages require refined curl handling.

## Methodology
- Fetched via curl -sL from pthhs.net (canonical domain after 301 from www.pthhs.net)
- Recorded: HTTP status, final URL, title, first H1, canonical, robots, schema presence, word count
- Evidence saved in /root/.openclaw/workspace/pthhs/verification/

## Verified Pages (Production Evidence)

### 1. Homepage (https://pthhs.net/)
- HTTP: 200
- Final URL: https://pthhs.net/
- Title: Home Care in Houston TX | Primetime Home Health Services
- Canonical: https://www.pthhs.net/ (mismatch — should be pthhs.net)
- Schema: 1 instance detected
- Word count: ~1285
- Robots: No noindex detected
- Notes: Production serving correct title. Canonical points to www variant (minor inconsistency).

### 2. Contact (https://pthhs.net/home-care-contact-us.html)
- HTTP: 200
- Final URL: https://pthhs.net/home-care-contact-us.html
- Title: Light House Keeping | Contact Us | Houston, Texas
- H1: Not extracted in first pass (needs re-fetch)
- Canonical: Not verified in batch
- Schema: Not counted
- Word count: Unknown in batch
- Notes: Title contains "Light House Keeping" — verify against intended correction.

### 3. Staff (https://pthhs.net/home-care-meet-our-staff.html)
- HTTP: 200
- Final URL: https://pthhs.net/home-care-meet-our-staff.html
- Title: Attendant Care Services | Meet Our Staff | Houston, Texas
- H1: Not extracted
- Notes: Title includes service descriptor.

### 4. Attendant Care Services (https://pthhs.net/home-care-services-attendant-care-services.html)
- HTTP: 200
- Final URL: https://pthhs.net/home-care-services-attendant-care-services.html
- Title: Not extracted in batch
- Notes: Page exists and returns 200.

### 5. Houston Location (https://pthhs.net/locations/houston)
- HTTP: 200
- Final URL: https://pthhs.net/locations/houston
- Title: Home Care in Houston TX | Personal Assistance Services
- Canonical: Not extracted
- Schema: Not counted
- Notes: Title present. Matches expected location pattern.

### 6. Katy Location (https://pthhs.net/locations/katy)
- HTTP: 200
- Final URL: https://pthhs.net/locations/katy
- Title: Home Care in Katy TX | Personal Assistance Services
- Notes: Title present.

## Production Issues Observed
- Canonical on homepage points to www.pthhs.net while site serves on pthhs.net (minor).
- Some title tags still contain legacy phrasing ("Light House Keeping").
- Schema present on homepage (count: 1) — needs full audit in schema step.
- No evidence of noindex on fetched pages.

## Blocked / Not Yet Fetched
- Medicaid Home Care Houston page
- PAS Houston page
- Additional Tier 1 locations (Pasadena, Baytown, etc.)
- Eligibility page
- Full H1 extraction for all pages

## Next Action
Proceed to live_title_h1_verification once full page set is captured, or mark production_html_verification complete for available evidence and continue with independent steps (cas_terminology_audit, service_scope_audit, technical_crawl).

**Evidence Location:** /root/.openclaw/workspace/pthhs/verification/ (6 HTML files)