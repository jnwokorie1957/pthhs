# October 12, 2026 eligibility guidance and contextual links

## Audit findings

Starting commit: 0ea70ffae745a97797f6bb4e05af7361c5dc41e6 (verified deployed).

- The resources page already had a five-item checklist at `#before-you-call`. The premise that the checklist was absent did not match the repository; this batch strengthens the existing section rather than duplicating it.
- The insurance page already had four benefits/authorization/provider steps and a privacy warning. These remain in place.
- No broken internal main-content routes or fragment targets were found in the marketing HTML audit. Live insurance, resources, Alief, Katy, attendant care, respite and ADL pages returned 200 with self-referencing canonicals and no noindex meta/header. No indexability repair was warranted.
- The insurance page linked to PHC/CAS and STAR+PLUS sources without explaining their different routes. The resources page used an HCBS-specific service source to introduce PAS generally. The new source explains both state-plan PAS and HCBS.
- Alief and Katy named existing services but lacked links from those list items to the matching detailed pages. The attendant page called the insurance guide a referral checklist, even though that guide permits an initial inquiry without a referral.

## Exact batch

1. `/home-care-resources`: strengthen the existing checklist with task frequency, plan/program if known, coordinator/caseworker contact, assessment and authorization status, approved tasks/hours, end/review dates, remaining steps, ZIP-specific agency acceptance and secure record transfer. Add a clearly labeled HHSC/ADRC navigation route for people without a known plan. Link to the insurance page's new `#program-options` section. Preserve `#before-you-call`, privacy limits and all six existing official-resource cards.
2. `/home-care-insurance`: expand the existing program paragraph into concise distinctions for STAR+PLUS state-plan PAS versus HCBS, PHC, CAS and Family Care. Explicitly separate public-program information from agency participation; retain member-specific authorization, ZIP-code and non-medical scope checks. Do not add financial thresholds, eligibility scores, guaranteed hours or start dates.
3. `/home-care-services/attendant-care-services`: change only the insurance link label to “eligibility and authorization checklist” and target the existing `#care-planning` anchor.
4. `/locations/alief`: link the existing bathing/grooming/dressing/toileting list item to personal care and the existing respite item to respite care.
5. `/locations/katy`: link the existing ADL and personal-care list items to their detailed service pages.

No new routes, titles, service claims or payer relationships. Homepage, personal-care and Southwest Houston content remain unchanged. Workflow, permissions, backend, credentials and infrastructure configuration remain unchanged. Reviewed sitemap dates apply only to the five edited pages. The sensitive-term register is regenerated.

## Independently verified official sources

Read October 12, 2026. These are administrative program distinctions, not an individual eligibility determination or evidence of additional Primetime participation.

- [HHSC STAR+PLUS LTSS, section 4200](https://fhb.hhs.texas.gov/handbooks/starplus-program-support-unit-operational-procedures-handbook/4200-starplus-long-term-services-supports): distinguishes state-plan PAS and expanded HCBS requirements; source revision effective February 20, 2026. The site does not impose HCBS eligibility on all PAS applicants.
- [HHSC MCO service coordination, section 1200](https://fhb.hhs.texas.gov/handbooks/starplus-handbook/1200-mco-service-coordination): plan service coordination includes the member's service plan and LTSS authorization.
- [HHSC PHC/CAS, section 4600](https://fhb.hhs.texas.gov/handbooks/community-care-services-eligibility-handbook/4600-primary-home-care-community-attendant-services): section 4632 requires full Medicaid for PHC and describes MEPD financial eligibility for CAS; other eligibility requirements apply.
- [HHSC CAS, section A-4100](https://fhb.hhs.texas.gov/handbooks/medicaid-elderly-people-disabilities-handbook/a-4100-community-attendant-services): the attendant benefit does not confer regular Medicaid benefits.
- [HHSC Family Care, section 4400](https://fhb.hhs.texas.gov/handbooks/community-care-services-eligibility-handbook/4400-family-care-services): Title XX program; sections 4430–4431 address interest-list intake and PHC/CAS screening.
- [HHSC services directory](https://resources.hhs.texas.gov/directories): lists ADRC navigation contacts, including 855-937-2372 for Harris County and Texas Gulf Coast entries. Navigation is not benefit approval.

Only the two replacement/retained STAR+PLUS links in the checklist source paragraph get an October 12 source-review statement, because both were read. The September 10 review statement for the six original resource cards is unchanged; this batch does not claim a fresh review of that entire set.

## Measurement and release

No new Search Console figures were collected for this batch, and no missing query is treated as zero demand. Keep the baseline and limits in `2026-10-12-content-review.md`. Keep the newly deployed homepage/personal-care content stable. After publication, monitor exact-page impressions, clicks, CTR and average position using consistent filters and comparable observed windows; record the batch date so any later changes are not attributed solely to the previous release. No growth or ranking improvement is claimed.

Use the already approved manual Hosting-only dispatch after reviewed content is committed with `[skip ci]`. Require the full build, responsive/accessibility checks, internal links/fragments, unchanged payer assets, exact deployed commit and skipped backend job before reporting completion.

## Pre-release verification

- Full deterministic release gate: `PTHHS_BUILD_AND_VERIFICATION: PASS`, including source syntax, regression tests, accessibility, metadata, sitemap, payer-logo hashes, repository audit and preservation of internal-app bytes.
- All 15 local browser checks passed across the five edited pages at 320, 375 and 1440 pixels: HTTP 200, one H1, correct canonical, no horizontal overflow, no broken completed images or browser errors; desktop insurance and mobile resources screenshots were visually reviewed.
- 878 marketing main-content internal routes and fragment targets passed. The sensitive-term register has 783 classified occurrences and zero review-required entries.
- Git comparison confirms the homepage, personal-care and Southwest Houston pages, scripts, deployment workflows, backend, Firebase configuration and project mapping are unchanged. No titles changed.
