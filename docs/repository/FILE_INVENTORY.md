# Reviewed File Inventory

**Review date:** September 12, 2026

**Starting revision:** `d43e418`

**Method:** every tracked file was opened and hashed; format-aware validation
was then applied to text, JSON, XML, CSV, ZIP, image, HTML, CSS, JavaScript,
Python, shell, TypeScript, workflow, and reference files.

## Coverage by repository area

| Area | Review treatment |
| --- | --- |
| Root configuration and active `PTHHS_*` registers | Parsed, cross-referenced, and retained only when active |
| `.github/workflows/` | Syntax/read-path review plus local command rehearsal |
| `public/` marketing site | Every HTML and asset reference validated; content frozen |
| `public/primetime/` | Every file validated and protected from marketing generators |
| `scripts/` | Syntax checked, execution paths traced, active/legacy tools separated |
| `functions/` | Every source/config file reviewed; strict TypeScript check and npm audit run |
| `hharefs/` | HTML/XML read; WSDL parsed; provenance and safety guidance added |
| `templates/` and `source-assets/` | Read, signature checked, and generator references verified |
| `docs/` | Links checked; current, strategic, and historical material separated |
| ZIP/source captures | Every archive member integrity-tested; packages retained as historical evidence |

The deterministic file count, byte count, type distribution, link count, and
public-reference count are printed by `python3 scripts/repository_audit.py` on
each run. That live output is authoritative if the repository changes after
this dated inventory.

## Tracked path ledger

The following 278 paths were included in Review 1:

- `.editorconfig`
- `.firebaserc`
- `.gitattributes`
- `.github/workflows/deploy-firebase.yml`
- `.github/workflows/quality.yml`
- `.github/workflows/repair-image-assets.yml`
- `.gitignore`
- `PTHHS_APPROVED_TERMINOLOGY.md`
- `PTHHS_BLOG_SCOPE_TRIAGE.md`
- `PTHHS_CLAIM_RELEASE_GATE.md`
- `PTHHS_FRONTEND_DEPENDENCY_REGISTER.md`
- `PTHHS_IMAGE_SCOPE_AUDIT.md`
- `PTHHS_LEGAL_POLICY_BENCHMARK.md`
- `PTHHS_PAYER_EVIDENCE_REGISTER.md`
- `PTHHS_PAYER_PROGRAM_TRUTH_TABLE.md`
- `PTHHS_PUBLIC_FACTS.json`
- `PTHHS_RESOURCE_LINK_REGISTER.md`
- `PTHHS_ROUTE_MIGRATION_REGISTER.md`
- `PTHHS_SECURITY_CACHE_REGISTER.md`
- `PTHHS_SENSITIVE_TERM_REGISTER.csv`
- `PTHHS_SEO_FOUNDATION_REGISTER.md`
- `PTHHS_SITE_SHELL_REGISTER.md`
- `PTHHS_STRUCTURED_NAVIGATION_REGISTER.md`
- `README.md`
- `docs/README.md`
- `docs/archive/README.md`
- `docs/archive/production-snapshots-2026-08/README.md`
- `docs/archive/production-snapshots-2026-08/pthhs.net_.html`
- `docs/archive/production-snapshots-2026-08/pthhs.net_home-care-contact-us.html.html`
- `docs/archive/production-snapshots-2026-08/pthhs.net_home-care-meet-our-staff.html.html`
- `docs/archive/production-snapshots-2026-08/pthhs.net_home-care-services-attendant-care-services.html.html`
- `docs/archive/production-snapshots-2026-08/pthhs.net_locations_houston.html`
- `docs/archive/production-snapshots-2026-08/pthhs.net_locations_katy.html`
- `docs/archive/seo-2026-08/PRE_SITEMAP_AUTONOMY_STATE.json`
- `docs/archive/seo-2026-08/PTHHS_CAS_TERMINOLOGY_AUDIT.md`
- `docs/archive/seo-2026-08/PTHHS_FINAL_PRE_SITEMAP_GO_NO_GO.md`
- `docs/archive/seo-2026-08/PTHHS_LEGACY_REDIRECT_MAP.md`
- `docs/archive/seo-2026-08/PTHHS_LIVE_TITLE_H1_VERIFICATION.md`
- `docs/archive/seo-2026-08/PTHHS_PRODUCTION_HTML_VERIFICATION.md`
- `docs/archive/seo-2026-08/PTHHS_SCHEMA_AUDIT.md`
- `docs/archive/seo-2026-08/PTHHS_SEO_BASELINE.md`
- `docs/archive/seo-2026-08/PTHHS_SEO_LOCATION_AUDIT.md`
- `docs/archive/seo-2026-08/PTHHS_SERVICE_SCOPE_AUDIT.md`
- `docs/archive/seo-2026-08/PTHHS_SITEMAP_URL_LIST.md`
- `docs/archive/seo-2026-08/PTHHS_TECHNICAL_CRAWL_FINAL.md`
- `docs/archive/seo-2026-08/README.md`
- `docs/archive/seo-2026-08/SEO-AUDIT-2026-08-19.md`
- `docs/archive/seo-2026-08/SITEMAP_APPROVAL_LOG.md`
- `docs/archive/source-packages/README.md`
- `docs/archive/source-packages/SEO-PTHHS.zip`
- `docs/archive/source-packages/www.pthhs.net.zip`
- `docs/management-layer/DEVELOPER_TASKS.md`
- `docs/management-layer/OWNER_OPERATIONS_TASKS.md`
- `docs/management-layer/README.md`
- `docs/repository/FILE_INVENTORY.md`
- `docs/repository/README.md`
- `docs/repository/REVIEW_LOG.md`
- `docs/seo/PTHHS_COMPETITOR_REVERSE_ENGINEERING.md`
- `docs/seo/PTHHS_KEYWORD_TO_PAGE_MAP.md`
- `docs/seo/PTHHS_LOCATION_PAGES_DEPLOYMENT.md`
- `docs/seo/PTHHS_MONEY_PAGES_STRENGTHENING.md`
- `docs/seo/PTHHS_STRIKING_DISTANCE_KEYWORDS.md`
- `docs/seo/README.md`
- `docs/seo/county-hubs.csv`
- `docs/seo/county-hubs.json`
- `docs/seo/county-hubs.md`
- `firebase.json`
- `functions/README.md`
- `functions/package-lock.json`
- `functions/package.json`
- `functions/src/domain/models.ts`
- `functions/src/index.ts`
- `functions/src/integrations/hhaexchange/client.ts`
- `functions/src/integrations/hhaexchange/config.ts`
- `functions/tsconfig.json`
- `hharefs/README.md`
- `hharefs/endpoints.html`
- `hharefs/hha-wdsl.xml`
- `package-lock.json`
- `package.json`
- `plan.md`
- `public/404.html`
- `public/a-home-care-plan-thats-all-about-you.html`
- `public/assets/components.css`
- `public/assets/home.css`
- `public/assets/media/side-img1-320.avif`
- `public/assets/media/side-img1-320.webp`
- `public/assets/media/side-img1-586.avif`
- `public/assets/media/side-img1-586.webp`
- `public/assets/media/side-img2-320.avif`
- `public/assets/media/side-img2-320.webp`
- `public/assets/media/side-img2-535.avif`
- `public/assets/media/side-img2-535.webp`
- `public/assets/modern.css`
- `public/assets/polish.css`
- `public/assets/section-pages.css`
- `public/assets/site-enhancements.js`
- `public/boosting-senior-safety-with-light-housekeeping.html`
- `public/elderly-comfort-optimizing-home-environments.html`
- `public/empathy-in-aging-nurturing-elderly-mental-health.html`
- `public/enhancing-quality-of-life-with-personal-home-care.html`
- `public/enhancing-senior-living-with-personal-assistance.html`
- `public/ensuring-home-care-safety-essential-tips.html`
- `public/ensuring-medication-adherence-for-better-health.html`
- `public/home-care-about-us.html`
- `public/home-care-areas-we-serve.html`
- `public/home-care-baytown-texas.html`
- `public/home-care-blog-page-2.html`
- `public/home-care-blog-page-3.html`
- `public/home-care-blog-page-4.html`
- `public/home-care-blog-page-5.html`
- `public/home-care-blog.html`
- `public/home-care-careers.html`
- `public/home-care-client-reviews.html`
- `public/home-care-conroe-texas.html`
- `public/home-care-contact-us.html`
- `public/home-care-cypress-texas.html`
- `public/home-care-friendswood-texas.html`
- `public/home-care-houston-texas.html`
- `public/home-care-insurance.html`
- `public/home-care-katy-texas.html`
- `public/home-care-league-city-texas.html`
- `public/home-care-meet-our-staff.html`
- `public/home-care-meet-our-staff/johnson-nwokorie.html`
- `public/home-care-missouri-city-texas.html`
- `public/home-care-pasadena-texas.html`
- `public/home-care-pearland-texas.html`
- `public/home-care-resources.html`
- `public/home-care-services-activities-of-daily-living-adl.html`
- `public/home-care-services-attendant-care-services.html`
- `public/home-care-services-medication-reminders.html`
- `public/home-care-services-personal-care.html`
- `public/home-care-services-respite-care.html`
- `public/home-care-services.html`
- `public/home-care-services/activities-of-daily-living-adl.html`
- `public/home-care-services/attendant-care-services/index.html`
- `public/home-care-services/medication-reminders.html`
- `public/home-care-services/personal-care.html`
- `public/home-care-services/respite-care/index.html`
- `public/home-care-set-an-appointment.html`
- `public/home-care-spring-texas.html`
- `public/home-care-sugar-land-texas.html`
- `public/home-care-your-partner-in-aging-at-home.html`
- `public/home-health-agency-in-houston-texas.html`
- `public/home-nursing-care-key-services-you-need.html`
- `public/how-geriatric-care-improves-life-quality.html`
- `public/index.html`
- `public/locations/alief.html`
- `public/locations/alvin.html`
- `public/locations/angleton.html`
- `public/locations/baytown.html`
- `public/locations/brazoria-county.html`
- `public/locations/brookshire.html`
- `public/locations/chambers-county.html`
- `public/locations/channelview.html`
- `public/locations/clear-lake.html`
- `public/locations/cleveland.html`
- `public/locations/clute.html`
- `public/locations/conroe.html`
- `public/locations/cypress.html`
- `public/locations/dayton.html`
- `public/locations/deer-park.html`
- `public/locations/dickinson.html`
- `public/locations/fort-bend-county.html`
- `public/locations/freeport.html`
- `public/locations/fresno.html`
- `public/locations/fulshear.html`
- `public/locations/galveston-county.html`
- `public/locations/galveston.html`
- `public/locations/gulfton.html`
- `public/locations/harris-county.html`
- `public/locations/hempstead.html`
- `public/locations/hitchcock.html`
- `public/locations/houston.html`
- `public/locations/humble.html`
- `public/locations/jefferson-county.html`
- `public/locations/katy.html`
- `public/locations/la-marque.html`
- `public/locations/la-porte.html`
- `public/locations/lake-jackson.html`
- `public/locations/league-city.html`
- `public/locations/liberty.html`
- `public/locations/magnolia.html`
- `public/locations/manvel.html`
- `public/locations/missouri-city.html`
- `public/locations/montgomery-county.html`
- `public/locations/montgomery.html`
- `public/locations/needville.html`
- `public/locations/new-caney.html`
- `public/locations/pasadena.html`
- `public/locations/pearland.html`
- `public/locations/porter.html`
- `public/locations/prairie-view.html`
- `public/locations/richmond.html`
- `public/locations/rosenberg.html`
- `public/locations/santa-fe.html`
- `public/locations/sharpstown.html`
- `public/locations/shenandoah.html`
- `public/locations/southwest-houston.html`
- `public/locations/spring.html`
- `public/locations/stafford.html`
- `public/locations/sugar-land.html`
- `public/locations/sunnyside.html`
- `public/locations/texas-city.html`
- `public/locations/the-woodlands.html`
- `public/locations/tomball.html`
- `public/locations/walker-county.html`
- `public/locations/waller-county.html`
- `public/locations/webster.html`
- `public/locations/west-columbia.html`
- `public/locations/wharton-county.html`
- `public/locations/willis.html`
- `public/managing-medications-for-elderly-care.html`
- `public/medication-management-tips-for-home-health-aides.html`
- `public/nutrition-essentials-for-elderly-care.html`
- `public/preventing-falls-safe-homes-for-seniors.html`
- `public/primetime/index.html`
- `public/primetime/primetime.css`
- `public/primetime/primetime.js`
- `public/privacy-policy.html`
- `public/promoting-wellness-in-senior-homes.html`
- `public/robots.txt`
- `public/senior-wellness-holistic-home-care-tips.html`
- `public/sitemap.xml`
- `public/terms-of-use.html`
- `public/the-benefits-personal-assistance-services.html`
- `public/the-holistic-approach-of-modern-home-care-agencies.html`
- `public/the-positive-impact-of-companionship-on-senior-health.html`
- `public/tips-for-choosing-the-right-home-care-provider.html`
- `public/understanding-medicaid-for-home-care-services.html`
- `public/unveiling-nursing-care-plans-a-comprehensive-guide.html`
- `public/why-home-care-is-essential-for-veterans-health.html`
- `public/wp-content/themes/primetimehomeie989/images/footer-logo.png`
- `public/wp-content/themes/primetimehomeie989/images/main-logo.png`
- `public/wp-content/themes/primetimehomeie989/images/mid-img1.webp`
- `public/wp-content/themes/primetimehomeie989/images/mid-img2.webp`
- `public/wp-content/themes/primetimehomeie989/images/mid-img3.webp`
- `public/wp-content/themes/primetimehomeie989/images/mid-img4.webp`
- `scripts/README.md`
- `scripts/accessibility_foundation.py`
- `scripts/batch_a_config.py`
- `scripts/batch_a_remediation.py`
- `scripts/batch_b1_migration.py`
- `scripts/batch_b2_route_migration.py`
- `scripts/batch_b3_sitewide_shell.py`
- `scripts/build-and-verify.sh`
- `scripts/cleanup_stale_image_refs.py`
- `scripts/frontend_controls.mjs`
- `scripts/generate_sensitive_term_register.py`
- `scripts/legacy-import/README.md`
- `scripts/legacy-import/crawl-pthhs.sh`
- `scripts/legacy-import/fix-asset-paths.sh`
- `scripts/legacy-import/fix-links.sh`
- `scripts/legacy-import/patch-site-polish.mjs`
- `scripts/legacy-import/post-process.sh`
- `scripts/performance_foundation.mjs`
- `scripts/pthhs_shell.py`
- `scripts/repair_image_assets.py`
- `scripts/repository_audit.py`
- `scripts/seo_foundation.py`
- `scripts/site-polish-finalize.mjs`
- `scripts/site-polish.mjs`
- `scripts/site-scope.mjs`
- `scripts/site_scope.py`
- `scripts/verify-site-output.mjs`
- `scripts/verify_accessibility_foundation.py`
- `scripts/verify_batch_a.py`
- `scripts/verify_batch_b1.py`
- `scripts/verify_batch_b2.py`
- `scripts/verify_batch_b3.py`
- `scripts/verify_batch_b4.py`
- `scripts/verify_frontend_controls.mjs`
- `scripts/verify_performance_foundation.mjs`
- `scripts/verify_responsive_shell.mjs`
- `scripts/verify_structured_navigation.py`
- `source-assets/performance/side-img1.webp`
- `source-assets/performance/side-img2.webp`
- `templates/base.html`
