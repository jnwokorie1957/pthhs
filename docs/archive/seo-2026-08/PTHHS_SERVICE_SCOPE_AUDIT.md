# PTHHS Service Scope Audit
**Date:** 2026-08-25
**Auditor:** Astro autonomous heartbeat
**Objective:** Identify references to skilled nursing, wound care, therapy, Medicare, medical treatment, clinical home health, doctor-developed treatment plans, or similar clinical/medical terminology. Classify each instance as VALID, EDUCATIONAL_NEEDS_DISCLAIMER, MISLEADING_FOR_PTHHS, or REMOVE_REWRITE.

## Summary of Findings
PTHHS is a non-medical personal assistance services (PAS) / attendant care provider focused on Medicaid and managed-care plans. The audit reviewed project source files and production HTML for clinical terminology that could misrepresent scope.

**Key observations:**
- Several legacy/extracted pages use "Home Health Agency" branding in titles and meta descriptions (e.g., home-health-agency-in-houston-texas.html). This creates potential for confusion with licensed home health agencies that provide skilled nursing.
- Modern production pages (home-care-services.html, home-care-insurance.html) correctly emphasize "senior home care", "personalized in-home care services", "non-medical personal assistance services", and list Medicaid/MCO plans without clinical claims.
- No direct references found to "skilled nursing", "wound care", "physical/occupational therapy", "Medicare", "doctor-developed treatment plans", or "clinical home health" in the inspected modern files.
- "Home Health Agency" title on one page is the primary risk area.

## Detailed Page Classifications

### home-health-agency-in-houston-texas.html (public/ and extracted/)
- **Title:** "Home Health Agency | Houston, Texas"
- **Description:** "exceptional home health agency in Houston, Texas"
- **Classification:** MISLEADING_FOR_PTHHS
- **Reason:** "Home Health Agency" is commonly understood to imply licensed skilled services (nursing, therapy, Medicare-certified). PTHHS provides non-medical PAS. Recommend rewrite to "Home Care Agency" or "Personal Assistance Services Provider".
- **Recommended action:** Replace title/description with accurate non-medical framing consistent with home-care-services.html.

### home-care-services.html (public/)
- **Title:** "Senior Home Care | Houston, Texas"
- **Description:** "personalized in-home care services that ensure comfort, dignity, and independence"
- **Classification:** VALID
- **Notes:** Correct non-medical framing. No clinical claims detected. Good alignment with PAS/attendant care positioning.

### home-care-insurance.html (public/)
- **Title:** "Insurance & Medicaid Plans | Primetime Home Health Services Houston"
- **Description:** "Medicaid and managed-care plans... non-medical personal assistance services"
- **Classification:** VALID
- **Notes:** Explicitly states "non-medical personal assistance services". Lists only Medicaid/MCO plans. No Medicare or skilled services references. Clean.

### Other inspected pages (home-care-about-us.html, home-care-blog.html, location pages, etc.)
- No instances of "skilled nursing", "wound care", "therapy services", "Medicare", "clinical treatment", or "doctor-developed plans".
- Minor legacy references to "home health" in older extracted content appear only in filenames/titles already flagged above.
- **Classification:** VALID (no problematic terminology found)

## Recommendations
1. Prioritize rewrite of home-health-agency-in-houston-texas.html title, meta description, and any H1 to remove "Home Health Agency" branding.
2. Ensure all future location and service pages maintain consistent non-medical PAS language.
3. No evidence of active misleading clinical claims on current production pages beyond the one identified title.
4. This audit can be marked complete once the flagged page title is corrected in source.

## Evidence Sources
- Direct file inspection of public/*.html and extracted/www.pthhs.net/*.html
- Cross-reference with PTHHS_PRODUCTION_HTML_VERIFICATION.md (already complete)
- No production curl verification of additional clinical pages required; current evidence sufficient for classification.

**Status:** Audit complete. One actionable correction identified. No external blockers.
