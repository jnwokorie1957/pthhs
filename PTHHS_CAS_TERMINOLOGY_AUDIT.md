# PTHHS CAS Terminology Audit
**Date:** 2026-08-25 16:35 UTC
**Status:** Complete for available evidence

## Definition
CAS = Community Attendant Services (Texas HHSC Medicaid program). Not to be conflated with generic "attendant care services" phrasing.

## Audit Findings from Project Files

### Correct Usage Observed
- PTHHS_KEYWORD_TO_PAGE_MAP.md correctly distinguishes:
  - `/home-care-services-attendant-care-services.html` as CAS-focused page
  - Explicit mentions of "Community Attendant Services Houston", "cas houston", "houston cas provider"
  - Clear separation from PAS (Personal Assistance Services)
  - References to HHSC program context (PHC/FC/CAS)

### Risk Areas Identified
- Some keyword targeting uses "Attendant Care Services Houston" as primary without always qualifying as CAS-specific.
- Opportunity to strengthen exact "Community Attendant Services" phrasing in H1/title where appropriate.
- No evidence of incorrect acronym expansion (e.g., mislabeling generic attendant care as CAS).

### Production Evidence (from HTML snapshots)
- Staff page title: "Attendant Care Services | Meet Our Staff | Houston, Texas" — generic phrasing present.
- Attendant care services page exists and returns 200.

## Recommendations (Repo-Level Only)
1. Ensure attendant care services page H1/title explicitly includes "Community Attendant Services (CAS)" on first reference.
2. Add clear section: "What is CAS?" with HHSC program eligibility.
3. Distinguish CAS from PAS and STAR+PLUS in content.
4. No changes to generic "attendant care" references on non-CAS pages.

## Verification Status
- No fabricated contract claims.
- All findings based on keyword maps and production HTML evidence.
- No over-labeling of generic attendant care as CAS acronym.

**Evidence Location:** PTHHS_KEYWORD_TO_PAGE_MAP.md, PTHHS_PRODUCTION_HTML_VERIFICATION.md, verification/*.html
