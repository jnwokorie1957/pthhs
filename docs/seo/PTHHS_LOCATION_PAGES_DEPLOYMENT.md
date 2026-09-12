# PTHHS Location Pages Deployment Report
**Date:** 2026-08-19  
**Status:** Validation of existing location pages + recommendations for 8 primary locations

---

## 8 PRIMARY LOCATION PAGES — VALIDATION STATUS

### Existing Location Pages (8 Core Locations)

| Location | File Path | HTTP Status | Indexable | Canonical | Unique Title/H1 | Internal Links | Service Links | Local Info | Schema | Mobile | Status |
|----------|-----------|-------------|-----------|-----------|-----------------|----------------|---------------|------------|--------|--------|--------|
| Houston | `/locations/houston.html` | 200 | Yes | `/locations/houston` | Yes | Yes (services, areas) | Yes (attendant, ADL, personal care, respite, medication) | Yes (Burdine St office, 25+ years) | None detected | Yes (modern.css) | ✅ **VALID** |
| Alief | `/locations/alief.html` | 200 | Yes | `/locations/alief` | Yes | Yes | Yes | Yes | None | Yes | ✅ **VALID** |
| Sharpstown | `/locations/sharpstown.html` | 200 | Yes | `/locations/sharpstown` | Yes | Yes | Yes | Yes | None | Yes | ✅ **VALID** |
| Gulfton | `/locations/gulfton.html` | 200 | Yes | `/locations/gulfton` | Yes | Yes | Yes | Yes | None | Yes | ✅ **VALID** |
| Southwest Houston | `/locations/southwest-houston.html` | 200 | Yes | `/locations/southwest-houston` | Yes | Yes | Yes | Yes (near Burdine St) | None | Yes | ✅ **VALID** |
| Sunnyside | `/locations/sunnyside.html` | 200 | Yes | `/locations/sunnyside` | Yes | Yes | Yes | Yes | None | Yes | ✅ **VALID** |
| Katy | `/locations/katy.html` | 200 | Yes | `/locations/katy` | Yes | Yes | Yes | Yes (ZIP check note) | None | Yes | ✅ **VALID** |
| Sugar Land | `/locations/sugar-land.html` | 200 | Yes | `/locations/sugar-land` | Yes | Yes | Yes | Yes | None | Yes | ✅ **VALID** |

**All 8 core location pages are valid and ready for promotion.** No thin replacements needed.

---

## DUPLICATE CONTENT RISK — LEGACY PATHS

### Legacy Location Pages (Need Redirect or Consolidation)

| Legacy Path | Modern Equivalent | Risk | Recommended Action |
|-------------|-------------------|------|--------------------|
| `/home-care-houston-texas.html` | `/locations/houston` | High | 301 redirect to `/locations/houston` |
| `/home-care-katy-texas.html` | `/locations/katy` | High | 301 redirect to `/locations/katy` |
| `/home-care-sugar-land-texas.html` | `/locations/sugar-land` | High | 301 redirect to `/locations/sugar-land` |
| `/home-care-pearland-texas.html` | `/locations/pearland` (exists) | High | 301 redirect to `/locations/pearland` |
| `/home-care-spring-texas.html` | `/locations/spring` (exists) | High | 301 redirect to `/locations/spring` |

**Action Required:** Before sitemap submission, implement 301 redirects from legacy paths to canonical `/locations/{slug}` paths. This resolves duplicate content risk and consolidates ranking signals.

---

## TIER 1 LOCATIONS — DEPLOYMENT STATUS

### Tier 1 Locations (10 Priority Markets)

| Location | County | Existing Page? | File | Medicaid Authority Verified? | Status | Notes |
|----------|--------|----------------|------|------------------------------|--------|-------|
| Pasadena | Harris | ✅ Yes | `/locations/pasadena.html` | **Unverified** | Ready for review | Page exists; verify PTHHS Medicaid PAS authority in Harris County |
| Baytown | Harris | ✅ Yes | `/locations/baytown.html` | **Unverified** | Ready for review | Page exists; verify authority |
| Pearland | Brazoria/Fort Bend | ✅ Yes | `/locations/pearland.html` + legacy | **Unverified** | Ready for review | Page exists; verify authority; redirect legacy |
| Missouri City | Fort Bend | ✅ Yes | `/locations/missouri-city.html` | **Unverified** | Ready for review | Page exists; verify authority |
| Richmond | Fort Bend | ✅ Yes | `/locations/richmond.html` | **Unverified** | Ready for review | Page exists; verify authority |
| Rosenberg | Fort Bend | ✅ Yes | `/locations/rosenberg.html` | **Unverified** | Ready for review | Page exists; verify authority |
| Cypress | Harris | ✅ Yes | `/locations/cypress.html` | **Unverified** | Ready for review | Page exists; verify authority |
| Spring | Montgomery | ✅ Yes | `/locations/spring.html` + legacy | **Unverified** | Ready for review | Page exists; verify authority; redirect legacy |
| Humble | Harris | ✅ Yes | `/locations/humble.html` | **Unverified** | Ready for review | Page exists; verify authority |
| Conroe | Montgomery | ✅ Yes | `/locations/conroe.html` | **Unverified** | Ready for review | Page exists; verify authority |

**Critical Finding:** All 10 Tier 1 location pages **already exist** in `/locations/`. The expansion plan referenced "8 of 10 need creation" but this appears to be outdated — the pages are already built.

**Action Required:** 
1. Verify PTHHS is legally/contractually authorized to provide Medicaid PAS in each county before promoting these pages
2. Implement 301 redirects from legacy paths
3. Add location-specific internal links from service pages (PAS, CAS, Medicaid)
4. Validate each page for unique title/H1/content depth (spot-check passed for Houston/Katy samples)

---

## COUNTY HUB PAGES — STATUS

### County-Level Pages (Exist but Not Yet Promoted)

| County | File | Status | Notes |
|--------|------|--------|-------|
| Harris County | `/locations/harris-county.html` | Exists | Primary service county; link from all Harris location pages |
| Fort Bend County | `/locations/fort-bend-county.html` | Exists | Sugar Land, Missouri City, Richmond, Rosenberg |
| Montgomery County | `/locations/montgomery-county.html` | Exists | Conroe, The Woodlands, Spring |
| Galveston County | `/locations/galveston-county.html` | Exists | Galveston, League City, Texas City |
| Waller County | `/locations/waller-county.html` | Exists | Prairie View, Hempstead, Brookshire |
| Liberty County | `/locations/liberty-county.html` | Exists | Liberty, Dayton, Cleveland |
| Brazoria County | `/locations/brazoria-county.html` | Exists | Pearland, Alvin, Angleton, Lake Jackson |
| Jefferson County | `/locations/jefferson-county.html` | Exists | Beaumont area (verify service authority) |
| Chambers County | `/locations/chambers-county.html` | Exists | Verify service authority |
| Walker County | `/locations/walker-county.html` | Exists | Verify service authority |
| Wharton County | `/locations/wharton-county.html` | Exists | Verify service authority |

**Recommendation:** Create county hub pages as supporting content, not primary targets. Link from city-level pages. Add Medicaid/STAR+PLUS context to county pages for eligibility queries.

---

## LOCATION PAGE QUALITY CHECKLIST (Per Directive)

### Validation Criteria Applied:

| Criterion | Houston Sample | Katy Sample | All 8 Core Locations |
|-----------|----------------|-------------|---------------------|
| HTTP 200 | ✅ | ✅ | ✅ |
| Indexable (no noindex) | ✅ | ✅ | ✅ |
| Canonical tag present | ✅ | ✅ | ✅ |
| Unique title | ✅ "Home Care in Houston TX \| Personal Assistance Services" | ✅ "Home Care in Katy TX \| Personal Assistance Services" | ✅ |
| Unique H1 | ✅ "Home Care and Personal Assistance Services in Houston" | ✅ "Home Care and Personal Assistance Services in Katy" | ✅ |
| Content depth (300+ words) | ✅ ~600 words | ✅ ~500 words | ✅ |
| Internal links to services | ✅ Attendant care, ADL, personal care, respite, medication | ✅ Attendant care, ADL, personal care, respite, medication | ✅ |
| Relevant service links | ✅ Links to `/home-care-services/attendant-care-services` | ✅ Links to service pages | ✅ |
| Local information | ✅ Burdine St office, 25+ years, Houston-specific | ✅ ZIP check note, Katy-specific | ✅ |
| Schema (JSON-LD) | ❌ None detected | ❌ None detected | ❌ **Missing on all** |
| Mobile rendering | ✅ modern.css responsive | ✅ modern.css responsive | ✅ |
| FAQ accordion | ✅ 3 questions | ✅ 3 questions | ✅ |
| CTA to contact/eligibility | ✅ "Check Eligibility" + "Call Our Houston Office" | ✅ "Check Katy Availability" + "Call Primetime" | ✅ |

**Schema Gap:** All location pages would benefit from LocalBusiness + ServiceArea + BreadcrumbList schema. This is a quick win for local pack visibility.

---

## RECOMMENDATIONS (Before Sitemap Submission)

### Immediate Actions (Low-Risk):

1. **Add JSON-LD schema to all location pages** (LocalBusiness, ServiceArea, BreadcrumbList)
   - Include business name, address, phone, service area (city + county)
   - Add review aggregate rating if available

2. **Implement 301 redirects from legacy paths**
   - `/home-care-houston-texas.html` → `/locations/houston`
   - `/home-care-katy-texas.html` → `/locations/katy`
   - `/home-care-sugar-land-texas.html` → `/locations/sugar-land`
   - `/home-care-pearland-texas.html` → `/locations/pearland`
   - `/home-care-spring-texas.html` → `/locations/spring`

3. **Add internal links from service pages to location pages**
   - From `/home-care-services-attendant-care-services.html`: "Serving Houston, Katy, Sugar Land, Pasadena..."
   - From new Medicaid/Eligibility pages: Location-specific eligibility context

4. **Verify Medicaid PAS authority for all Tier 1 counties**
   - Harris County (Pasadena, Baytown, Humble, Cypress)
   - Fort Bend County (Missouri City, Richmond, Rosenberg, Sugar Land)
   - Montgomery County (Conroe, Spring)
   - Brazoria County (Pearland)
   - **Do not promote location pages for counties where PTHHS is not authorized**

5. **Add location-specific content to money pages**
   - Medicaid Home Care page: "Serving all of Harris County including Houston, Pasadena, Baytown..."
   - PAS page: "Available in Fort Bend County communities: Sugar Land, Missouri City, Richmond, Rosenberg"

### Deferred Actions (Higher Risk — Pause and Ask):

- Creating new location pages (all 10 Tier 1 already exist)
- Changing established URLs (legacy paths should redirect, not be deleted)
- Large-scale content changes to location pages without GSC data

---

## SITEMAP PREPARATION STATUS

**Per Directive Step 8:** Sitemap preparation should occur ONLY after:
- [x] Title/H1 repairs (SEO audit fixes applied)
- [x] Keyword mapping (PTHHS_KEYWORD_TO_PAGE_MAP.md complete)
- [x] Location deployment (8 core locations validated; Tier 1 pages exist)
- [ ] Technical fixes (schema addition pending)
- [ ] Canonical validation (301 redirects pending)

**Current sitemap status:** 
- `sitemap.xml` exists and includes `/locations/` paths
- Legacy paths appear absent from sitemap (good — lower priority)
- **Do not submit sitemap until 301 redirects and schema are implemented**

---

## NEXT STEPS

1. **Verify Medicaid authority** for all Tier 1 counties (Jeremy/PTHHS confirmation required)
2. **Implement 301 redirects** from legacy location paths
3. **Add JSON-LD schema** to all location pages
4. **Add internal links** from service pages to location pages
5. **Spot-check 5-10 Tier 1 location pages** for title/H1/content quality (Houston/Katy samples passed)
6. **Prepare final URL list** for sitemap review (Step 8)

---

**Document Status:** Step 6 complete. All 8 core location pages validated. All 10 Tier 1 location pages exist (contrary to earlier audit assumptions). Pending: Medicaid authority verification, 301 redirects, schema addition.
