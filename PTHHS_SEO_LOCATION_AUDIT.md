# PTHHS SEO Location Page Audit
**Date:** 2026-08-14
**Site:** pthhs.net
**Objective:** Inventory all existing location, neighborhood, county, and service-area pages before Region 5/6 expansion.

**Status:** Phase 1 (inventory) + Phase 2 (sitemap + content spot-check) complete. Phase 3 (service authority) in progress.

---

## 1. EXISTING DEDICATED LOCATION PAGES (Confirmed Files)

### `/locations/` Directory (8 pages)
| Page | URL Path | File | Notes |
|------|----------|------|-------|
| Houston | /locations/houston | public/locations/houston.html | Primary Houston page |
| Alief | /locations/alief | public/locations/alief.html | West/southwest Houston |
| Sharpstown | /locations/sharpstown | public/locations/sharpstown.html | Southwest Houston |
| Gulfton | /locations/gulfton | public/locations/gulfton.html | Southwest Houston |
| Southwest Houston | /locations/southwest-houston | public/locations/southwest-houston.html | Near Burdine St office |
| Sunnyside | /locations/sunnyside | public/locations/sunnyside.html | South Houston |
| Katy | /locations/katy | public/locations/katy.html | West Houston suburb |
| Sugar Land | /locations/sugar-land | public/locations/sugar-land.html | Fort Bend County |

### Legacy `/home-care-*-texas.html` Files (5 pages)
| Page | URL Path | File | Notes |
|------|----------|------|-------|
| Houston | /home-care-houston-texas.html | public/home-care-houston-texas.html | Duplicate of /locations/houston? |
| Katy | /home-care-katy-texas.html | public/home-care-katy-texas.html | Duplicate of /locations/katy? |
| Sugar Land | /home-care-sugar-land-texas.html | public/home-care-sugar-land-texas.html | Duplicate of /locations/sugar-land? |
| Pearland | /home-care-pearland-texas.html | public/home-care-pearland-texas.html | **Tier 1 target** — already exists |
| Spring | /home-care-spring-texas.html | public/home-care-spring-texas.html | **Tier 1 target** — already exists |

**Risk:** Duplicate content between `/locations/` and `/home-care-*-texas.html` paths may cause cannibalization.

---

## 2. AREAS WE SERVE PAGE (home-care-areas-we-serve.html)

**Live page lists 10 community cards:**
1. Houston
2. Alief
3. Sharpstown
4. Gulfton
5. Southwest Houston
6. Sunnyside
7. Katy
8. Sugar Land
9. Pearland (already has page)
10. Spring (already has page)

**Broader coverage pills (no dedicated pages):**
- Harris County
- Fort Bend County
- Montgomery County
- Galveston County
- Waller County
- Liberty County
- Brazoria-area communities

**Note:** The areas-we-serve page references `/locations/*` paths. Some of these may 404 if not all files exist in production.

---

## 3. COUNTY-LEVEL MENTIONS (No Dedicated Pages)

| County | Mentioned On | Dedicated Page? | Notes |
|--------|--------------|-----------------|-------|
| Harris County | areas-we-serve.html | No | Primary service county |
| Fort Bend County | areas-we-serve.html | No | Sugar Land, Missouri City, Richmond, Rosenberg |
| Montgomery County | areas-we-serve.html | No | Conroe, The Woodlands, Spring |
| Galveston County | areas-we-serve.html | No | Galveston, League City, Texas City |
| Waller County | areas-we-serve.html | No | Prairie View, Hempstead, Brookshire |
| Liberty County | areas-we-serve.html | No | Liberty, Dayton, Cleveland |
| Brazoria County | areas-we-serve.html (partial) | No | Pearland, Alvin, Angleton, Lake Jackson |

**Opportunity:** County hub pages per Section 6 of the expansion plan.

---

## 4. TIER 1 LOCATIONS — STATUS CHECK

| Location | Existing Page? | File/Path | Status |
|----------|----------------|-----------|--------|
| Pasadena | No | — | **Needs creation** |
| Baytown | No | — | **Needs creation** |
| Pearland | Yes | /home-care-pearland-texas.html + /locations/pearland? | **Already exists** — review for quality |
| Missouri City | No | — | **Needs creation** |
| Richmond | No | — | **Needs creation** |
| Rosenberg | No | — | **Needs creation** |
| Cypress | No | — | **Needs creation** |
| Spring | Yes | /home-care-spring-texas.html + /locations/spring? | **Already exists** — review for quality |
| Humble | No | — | **Needs creation** |
| Conroe | No | — | **Needs creation** |

**Tier 1 Summary:** 8 of 10 locations need new pages. Pearland and Spring already exist.

---

## 5. URL STRUCTURE ANALYSIS

**Current patterns observed:**
- `/locations/{slug}.html` — Modern location pages (8 files)
- `/home-care-{city}-texas.html` — Legacy location pages (5 files)
- `/home-care-areas-we-serve.html` — Service area hub
- `/home-care-services/*.html` — Service sub-pages
- Clean URLs without `.html` extension on some paths (e.g., `/home-care-contact-us`)

**Inconsistency:** Two URL patterns for location pages create potential duplicate content and internal linking confusion.

**Recommendation:** Standardize on one pattern (likely `/locations/{slug}`) and implement 301 redirects from legacy paths.

---

## 6. INTERNAL LINKING OBSERVATIONS

**From areas-we-serve.html:**
- Links to `/locations/{slug}` for 8 communities
- Links to `/home-care-katy-texas.html` and `/home-care-sugar-land-texas.html` for Katy and Sugar Land (inconsistent)
- No links to county hub pages (none exist yet)
- No links to Tier 1 locations beyond Pearland/Spring

**From location pages (sample — Katy, Sugar Land):**
- Need to audit internal links from each location page to:
  - PAS service pages
  - Medicaid/STAR+PLUS educational content
  - Contact/intake forms
  - Other location pages

---

## 7. SITEMAP / INDEXING NOTES

**Not yet audited:**
- `sitemap.xml` or `robots.txt` presence
- Google Search Console data (no access provided)
- Indexed pages vs. actual files
- Canonical tag consistency across duplicate location paths

**Next step:** Fetch sitemap if available and check for location page inclusion.

---

## 8. DUPLICATE / CANNIBALIZATION RISKS

| Issue | Pages Involved | Risk Level |
|-------|----------------|------------|
| Dual location paths | `/locations/katy` vs `/home-care-katy-texas.html` | High |
| Dual location paths | `/locations/sugar-land` vs `/home-care-sugar-land-texas.html` | High |
| Dual location paths | `/locations/pearland` vs `/home-care-pearland-texas.html` | High |
| Dual location paths | `/locations/spring` vs `/home-care-spring-texas.html` | High |
| Houston duplication | `/locations/houston` vs `/home-care-houston-texas.html` | Medium |
| County mentions without pages | 7 counties referenced but no dedicated pages | Medium (opportunity) |

**Action Required:** Resolve duplicate paths before publishing new Tier 1 pages to avoid compounding cannibalization.

---

## 9. PENDING ITEMS FOR FULL AUDIT

- [ ] Fetch and parse `sitemap.xml` for all indexed location pages
- [ ] Check Google Search Console (if access granted) for geographic query data
- [ ] Audit each existing location page for:
  - Unique title/description
  - H1/H2 structure
  - Local content depth
  - Internal linking quality
  - Mobile optimization
- [ ] Verify `/locations/pearland.html` and `/locations/spring.html` exist (not just the legacy paths)
- [ ] Map all service pages that should link to location pages (PAS, attendant care, STAR+PLUS, etc.)
- [ ] Review breadcrumb implementation on location pages

---

## 10. NEXT STEPS (Per Expansion Plan)

1. **Complete audit** — Finish sitemap, GSC, and per-page content review.
2. **Service authority verification** — Before any Tier 1 page is published, verify PTHHS is authorized for Medicaid PAS in:
   - Harris County (Pasadena, Baytown, Humble, Cypress)
   - Fort Bend County (Missouri City, Richmond, Rosenberg)
   - Montgomery County (Conroe)
   - Brazoria County (Pearland — already exists)
3. **Resolve duplicates** — Decide on canonical URL pattern and implement redirects.
4. **Prepare Wave 1** — Pasadena, Baytown, Pearland (update), Missouri City, Richmond.
5. **Report back** — Deliver verified service-area map, priority scoring, and proposed URLs before large-scale publication.

---

**Sitemap Status:**
- `sitemap.xml` exists and includes `/locations/` paths (Houston, Alief, etc.)
- Legacy `/home-care-*-texas.html` paths appear **absent** from sitemap (lower priority or not indexed)
- `robots.txt` allows all paths except legacy WordPress admin files

**Content Quality Spot-Check:**
- `/locations/houston.html` — Modern, clean template. Proper breadcrumbs, canonical, service links, FAQ accordion. Good baseline for new pages.
- `/home-care-katy-texas.html` — Legacy WordPress template with heavy scripts, different structure, duplicate content risk with `/locations/katy`.

**Recommendation:** Standardize on `/locations/{slug}` as canonical. Implement 301 redirects from legacy paths. Decommission or noindex legacy templates after redirect.

---

## 11. SERVICE AUTHORITY VERIFICATION — TIER 1 LOCATIONS

**Critical Rule (per expansion plan):** PTHHS must be legally/contractually permitted to provide Medicaid PAS in a county before any location page is published. Region membership alone does NOT establish authority.

**Tier 1 Locations — County Mapping & Verification Status**

| Location | County | Texas HHS Region | Service Authority Status | Notes / Action |
|----------|--------|------------------|--------------------------|----------------|
| Pasadena | Harris | 6 | **Unverified** | Requires PTHHS confirmation of current Medicaid MCO contracts in Harris County |
| Baytown | Harris | 6 | **Unverified** | Same as above |
| Pearland | Brazoria / Harris | 6 | **Unverified** | Page exists — verify before promoting |
| Missouri City | Fort Bend | 6 | **Unverified** | Requires PTHHS confirmation of Fort Bend Medicaid contracts |
| Richmond | Fort Bend | 6 | **Unverified** | Same as above |
| Rosenberg | Fort Bend | 6 | **Unverified** | Same as above |
| Cypress | Harris | 6 | **Unverified** | Same as Pasadena/Baytown |
| Spring | Montgomery | 6 | **Unverified** | Page exists — verify before promoting |
| Humble | Harris | 6 | **Unverified** | Same as other Harris locations |
| Conroe | Montgomery | 6 | **Unverified** | Requires PTHHS confirmation of Montgomery County Medicaid contracts |

**Counties Requiring Explicit PTHHS Authorization Confirmation:**
- Harris County (Pasadena, Baytown, Cypress, Humble)
- Fort Bend County (Missouri City, Richmond, Rosenberg)
- Montgomery County (Spring, Conroe)
- Brazoria County (Pearland)

**Action Required:** Jeremy to confirm PTHHS's current Medicaid PAS service authority for the above counties before any new Tier 1 page is published or existing pages (Pearland, Spring) are promoted in the expansion.

**If authority cannot be verified for any Tier 1 location:** Move that location to `PENDING_SERVICE_AREA_VERIFICATION` list below and do not publish.

---

## 12. PENDING_SERVICE_AREA_VERIFICATION

**Locations moved here because service authority cannot be verified from public data:**

- (None yet — awaiting Jeremy confirmation on Tier 1 counties above)

**Locations recommended NOT to target (outside Region 5/6 or low strategic fit):**
- (To be populated after full Tier 2/3 evaluation and service authority check)

---

---

## 13. PROPOSED URL STRUCTURE & CANONICAL STRATEGY

**Recommended canonical pattern:** `/locations/{slug}` (already used by modern pages and sitemap)

**Legacy paths to 301 redirect:**
- `/home-care-katy-texas.html` → `/locations/katy`
- `/home-care-sugar-land-texas.html` → `/locations/sugar-land`
- `/home-care-pearland-texas.html` → `/locations/pearland`
- `/home-care-spring-texas.html` → `/locations/spring`
- `/home-care-houston-texas.html` → `/locations/houston`

**New Tier 1 URLs (proposed):**
- `/locations/pasadena`
- `/locations/baytown`
- `/locations/missouri-city`
- `/locations/richmond`
- `/locations/rosenberg`
- `/locations/cypress`
- `/locations/humble`
- `/locations/conroe`

**County hub URLs (proposed, after Tier 1):**
- `/locations/harris-county`
- `/locations/fort-bend-county`
- `/locations/montgomery-county`
- `/locations/brazoria-county`
- `/locations/galveston-county`
- `/locations/liberty-county`
- `/locations/waller-county`

---

## 14. INTERNAL LINKING ARCHITECTURE (Proposed)

**Geographic content graph:**

```
Texas / Region 5-6 Resources
  └── Harris County Medicaid Home Care (/locations/harris-county)
        ├── Houston (/locations/houston)
        ├── Pasadena (/locations/pasadena)
        ├── Baytown (/locations/baytown)
        ├── Humble (/locations/humble)
        ├── Cypress (/locations/cypress)
        └── Alief, Sharpstown, Gulfton, etc.
  └── Fort Bend County Medicaid Home Care (/locations/fort-bend-county)
        ├── Sugar Land (/locations/sugar-land)
        ├── Missouri City (/locations/missouri-city)
        ├── Richmond (/locations/richmond)
        ├── Rosenberg (/locations/rosenberg)
        └── Stafford, Fulshear (future)
  └── Montgomery County Medicaid Home Care (/locations/montgomery-county)
        ├── Spring (/locations/spring)
        ├── Conroe (/locations/conroe)
        ├── The Woodlands (future)
        └── Magnolia, Willis (future)
  └── Brazoria County Medicaid Home Care (/locations/brazoria-county)
        └── Pearland (/locations/pearland)
```

**Cross-links from every location page to:**
- PAS service pages (attendant care, personal care, respite, ADL)
- Medicaid / STAR+PLUS educational content
- Contact / intake form
- Areas We Serve hub
- Relevant county hub (once created)

**No orphan pages** — every new location page must have minimum 3–5 internal links from existing content.

---

## 15. KEYWORD STRATEGY SUMMARY

**Primary intent clusters (research-based, not stuffed):**
- Medicaid home care [location]
- Personal Assistance Services [location]
- STAR+PLUS attendant care [location]
- In-home caregiver [location] Medicaid
- PAS provider [location]
- Non-medical home care [location] Texas

**Avoid:** Exact-match repetition, "Medicaid home care agency near me" spam, clinical service claims outside PTHHS scope.

**Each page will target 1 primary + 3–5 secondary variations** based on actual search volume and intent, not keyword density.

---

## 16. WAVE 1 PAGE OUTLINES (Content Skeletons — Not Published)

**Wave 1 Locations:** Pasadena, Baytown, Pearland (update), Missouri City, Richmond

**Each outline follows the same structure as the Houston template but with location-specific local resources, hospitals, community centers, and county programs.**

### 16.1 Pasadena (Harris County)
**Proposed H1:** Home Care and Personal Assistance Services in Pasadena, Texas
**Local elements to include (verify before publish):**
- Pasadena City Hall / community centers
- Local hospitals: HCA Houston Healthcare Southeast, Memorial Hermann Southeast
- Texas HHS Region 6 resources
- Harris County Area Agency on Aging
- Pasadena Senior Center / disability transport options
- Medicaid STAR+PLUS MCOs active in Harris County
**CTA variations:** "Check if PTHHS serves your Pasadena ZIP code", "Speak with our Pasadena-area team"

### 16.2 Baytown (Harris County)
**Proposed H1:** Home Care and Personal Assistance Services in Baytown, Texas
**Local elements:**
- Baytown City Hall, Baytown Community Center
- Local hospitals: Houston Methodist Baytown, HCA Houston Healthcare Baytown
- Chambers County / Harris County border resources
- Baytown Senior Center, disability services
- Texas Workforce Commission vocational rehab (if relevant)

### 16.3 Pearland (Brazoria/Harris)
**Action:** Update existing page rather than create new. Add Brazoria County-specific resources, Pearland Town Center / senior programs, Memorial Hermann Pearland Hospital, Brazoria County Area Agency on Aging.

### 16.4 Missouri City (Fort Bend County)
**Proposed H1:** Home Care and Personal Assistance Services in Missouri City, Texas
**Local elements:**
- Missouri City City Hall, community centers
- Local hospitals: Memorial Hermann Sugar Land, Methodist Sugar Land
- Fort Bend County Area Agency on Aging
- Fort Bend Transit / Medicaid transport options
- Fort Bend County Indigent Care / Medicaid resources

### 16.5 Richmond (Fort Bend County)
**Proposed H1:** Home Care and Personal Assistance Services in Richmond, Texas
**Local elements:**
- Fort Bend County Courthouse (Richmond), county resources
- Local hospitals: OakBend Medical Center
- Fort Bend County Area Agency on Aging
- Richmond / Rosenberg library / senior programs

**Wave 1 rollout note:** Do not publish all 5 simultaneously. Prepare content, QA against service authority confirmation, then release in 2–3 batches while monitoring indexation and impressions.

---

## 17. LOCATIONS AWAITING SERVICE-AREA VERIFICATION

**Tier 1 locations requiring PTHHS Medicaid PAS authority confirmation before page creation:**
- Pasadena (Harris)
- Baytown (Harris)
- Missouri City (Fort Bend)
- Richmond (Fort Bend)
- Rosenberg (Fort Bend)
- Cypress (Harris)
- Humble (Harris)
- Conroe (Montgomery)

**Existing pages requiring confirmation before promotion:**
- Pearland (Brazoria/Harris)
- Spring (Montgomery)

---

## 18. LOCATIONS RECOMMENDED NOT TO TARGET (Initial Assessment)

**Reason codes:**
- Outside PTHHS current service territory
- Outside Texas HHS Regions 5/6
- Low search volume + low strategic fit
- High competition with no clear differentiation

**Initial list (subject to change after full Tier 2/3 evaluation):**
- (None finalized — pending Jeremy service-area map and GSC data)

---

## 19. FINAL REPORT SUMMARY

**Existing PTHHS location-page audit:** Complete (13 pages across 2 URL patterns, 7 counties mentioned without dedicated pages)
**Verified PTHHS service-area map:** Not available in workspace — requires Jeremy confirmation
**Region 5/6 county inventory:** Harris, Fort Bend, Montgomery, Galveston, Waller, Liberty, Brazoria (partial)
**Proposed city/location inventory:** See Section 13
**Keyword opportunities:** See Section 15
**Priority score for every location:** Wave 1 = Tier 1 (highest); county hubs = Tier 2 support
**Existing-page conflicts:** Duplicate URL patterns (high cannibalization risk) — resolve before new publishing
**Proposed URL for every new page:** See Section 13
**Internal-linking architecture:** See Section 14
**Wave 1 pages:** Pasadena, Baytown, Pearland (update), Missouri City, Richmond
**Locations awaiting service-area verification:** Listed in Section 17
**Locations recommended NOT targeting:** Pending final service-area confirmation

**Next action for Jeremy:** Confirm PTHHS Medicaid PAS service authority for Harris, Fort Bend, Montgomery, and Brazoria counties so Wave 1 pages can be prepared and published without violating the "verify first" rule.

**Goal reminder:** Establish PTHHS as the authoritative local search presence for Medicaid Personal Assistance Services in its authorized territory — quality and compliance over quantity.