# Existing-page SEO and referral clarity

Changes deepen the existing services, attendant care and insurance pages with practical phone-first planning and authorization steps. Eight locations already included in the reviewed sitemap, plus the areas hub, now link contextually to service scope and eligibility information. No new locations, offices, payer participation, clinical services or ranking claims were introduced. Existing logos and public business claims remain intact.

## Sources checked October 1, 2026

- [Texas HHSC STAR+PLUS services, section 6118](https://fhb.hhs.texas.gov/handbooks/starplus-handbook/6100-home-community-based-services): PAS supports assessed daily activities; distinct service categories do not establish agency participation.
- [Texas HHSC MCO service coordination](https://fhb.hhs.texas.gov/handbooks/starplus-handbook/1200-mco-service-coordination): STAR+PLUS LTSS service planning and authorization coordination. This scope is stated explicitly rather than generalized to every payer.
- [Texas HHSC PHC and CAS eligibility](https://fhb.hhs.texas.gov/handbooks/community-care-services-eligibility-handbook/4600-primary-home-care-community-attendant-services): separate program-specific requirements. The public page links to the official rules without inventing eligibility thresholds or asserting agency enrollment.

## Location inventory

Run `python scripts/location_inventory.py` to reproduce `location-inventory.csv`. It lists every existing location route, title, H1, canonical, explicit robots directive, sitemap membership, main-content word count and contextual links. There are 65 location pages and 27 total sitemap URLs, of which eight are locations. The remaining 57 location pages have not been newly promoted, removed or set to noindex. Sitemap omission alone does not prevent indexing.

The CSV is an inventory, not proof of local service availability, Google indexing or ranking. Before expanding sitemap promotion, review each community's verified availability, useful unique content and Search Console evidence. Do not multiply near-identical location pages to chase keywords.

## Measuring the top-three objective

No Search Console baseline has been supplied. Top-three rankings are an objective, not a promised result. Establish query/page baselines separately for Houston home care, attendant care, personal assistance and Sugar Land searches; confirm these targets against actual query impressions before treating them as the final keyword list. Compare impressions, clicks, CTR and position over comparable periods, accounting for location and device. Track inquiry quality separately without adding patient information to analytics.

Further priorities: verify the business profile and public contact consistency; assess competing pages against actual queries; improve unique service information where evidence supports it. No tracking, access changes or recurring competitor-monitoring automation is introduced by this patch.

## Release boundaries

This patch changes public content and adds a read-only inventory tool. It does not alter backend configuration, the 24 operational-data/write approval flags, privacy gates or permissions. Thirty-day build-image retention has owner approval, but this desktop has no installed GCP/Firebase CLI or standard authenticated session store; repository/policy inspection and application need an existing authorized deployment context. No credentials or retention policy were changed here.

## Validation

Full `scripts/build-and-verify.sh` passed, including 14 existing browser/auth/asset tests, claims classification (772 entries, zero requiring review), logo hashes, structured navigation, accessibility, performance and repository checks. Local Chrome QA passed all 12 changed pages at 390px and 1440px (24 page/viewport checks), checking headings, contextual link destinations, horizontal overflow and six retained insurance logos. Screenshots and results are in task-local `qa-evidence/seo`; the QA driver is `tooling/qa/check-seo.mjs`. Independent review passed the 15:34:03 UTC snapshot: HHSC sources, preserved public content, native links and the reproduced inventory were checked. Backend tests were not rerun for this static-content-only patch.
