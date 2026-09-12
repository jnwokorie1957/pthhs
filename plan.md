# PTHHS Website Improvement Plan

**Audit date:** September 9, 2026  
**Repository:** `jnwokorie1957/pthhs`  
**Production site reviewed:** `https://pthhs.net/`

## Goal

Unify the site, remove service-scope contradictions, verify payer/trust claims, repair technical SEO and forms, complete accessibility/performance work, and then scale local/content acquisition without recreating the current legacy-vs-modern split.

## Timing

- **P0 — Sep 9–11, 2026:** release blockers; fix before the next production release.
- **P1 — Sep 12–18, 2026:** first-week stabilization and legacy-page migration.
- **P2 — Sep 19–Oct 2, 2026:** technical quality, accessibility, local SEO, privacy/security, analytics.
- **P3 — Oct 3–23, 2026:** performance budgets, content refresh, search expansion.
- **Ongoing:** monthly/quarterly governance after the remediation launch.

## Confirmed audit findings

- The homepage uses the newer design and explicitly positions PTHHS as non-medical personal assistance services (PAS).
- Contact, Careers, Resources, Blog, Client Reviews, and at least some service pages still expose the legacy WordPress/Proweaver experience.
- The Contact page uses “premier home health agency,” mentions “specialized medical attention,” lists diagnoses, and displays “95K Happy Customers / 100% Satisfaction.”
- Medication Reminders contradicts itself by implying medication administration and later stating caregivers do not administer medications.
- Client Reviews uses an unrelated “Alzheimer’s Care in Houston, Texas” H1 and still exposes WordPress comments/replies.
- The live Areas page lists more communities than the checked-in sitemap.
- `public/home-care-services.html` contains malformed legacy canonical/Open Graph/schema markup and old WordPress/WP Rocket assets.
- `public/CRAWL-REPORT.md` documents 24 imported blog posts and WordPress comment-form migration TODOs.
- `PTHHS_SERVICE_SCOPE_AUDIT.md` flags “Home Health Agency” positioning as misleading for the intended non-medical PAS scope.
- `PTHHS_PAYER_PROGRAM_TRUTH_TABLE.md` says specific PTHHS payer contracts were not independently verified by that audit.
- Firebase Hosting deploys `public/`; internal crawl/audit artifacts should be excluded from the deploy rather than merely noindexed.

## 110-item backlog

### A. Accuracy, service scope, payer truth & trust

**Completed September 10, 2026; owner-attestation update September 11, 2026.** Public claims were reconciled to the non-medical PAS scope. Previously published history, payer, staff, service-area, testimonial, award, customer, and satisfaction claims approved by the business owner are restored with dated governance records. Imported clinical-scope articles remain quarantined. Automated verification is enforced in the Firebase deployment workflow.

- [x] **1. [P0] Rewrite the legacy Contact page** to remove “premier home health agency,” “specialized medical attention,” and other language implying skilled/clinical care. **When:** Sep 9–11. **Done when:** Contact describes only verified non-medical services.
- [x] **2. [P0] Resolve the Medication Reminders contradiction** between language implying medication administration and language saying caregivers do not administer medication. **When:** Sep 9–11. **Done when:** every sentence matches the authorized non-medical scope.
- [x] **3. [P0] Review medication-support claims** about pill organizers, dosage tracking, side-effect monitoring, refill assistance, and reporting to providers; remove anything operations/compliance cannot verify as allowed. **When:** Sep 9–11.
- [x] **4. [P0] Rewrite `home-health-agency-in-houston-texas`** title, H1, metadata, and body to accurate home-care/PAS terminology unless skilled-home-health status is documented. **When:** Sep 9–11.
- [x] **5. [P0] Remove or substantiate “95K Happy Customers,” “100% Satisfaction,” and awards claims.** Every quantified proof point needs a documented source and date. **When:** Sep 9–11. **Completed Sep 11:** restored the original proof points using the business owner's dated publication attestation and recorded them in the public-facts register with a quarterly recheck cadence.
- [x] **6. [P0] Remove or rewrite the Contact-page “Common Diagnosis” section** so the site does not imply PTHHS diagnoses or treats conditions. **When:** Sep 9–11.
- [x] **7. [P0] Audit clinical-looking imagery and captions** such as heartbeat checks and medication administration; replace visuals that imply services PTHHS does not provide. **When:** Sep 9–11.
- [x] **8. [P0] Rewrite Careers terminology** that calls applicants home-health professionals/home-health aides unless those are verified job classifications. **When:** Sep 9–11.
- [x] **9. [P0] Audit every blog post for clinical-scope drift** including skilled nursing, wound care, therapy, medication administration, Medicare, diagnoses, and treatment claims; rewrite, disclaim, redirect, or retire each item. **When:** Sep 9–11 for triage, with rewrites completed in P1/P3.
- [x] **10. [P0] Create an internal payer evidence register** for every Medicaid/MCO logo or participation claim, recording source, effective date, owner, and re-check date. **When:** Sep 9–11.
- [x] **11. [P0] Remove, qualify, or suppress unverified payer/network claims** until current PTHHS contract/network evidence exists. Preserve the useful “confirm current participation” caveat. **When:** Sep 9–11.
- [x] **12. [P0] Publish an approved terminology guide** for “non-medical PAS,” attendant care, home care, authorization, eligibility, and prohibited/unapproved clinical wording. **When:** Sep 9–11.
- [x] **13. [P0] Run a sitewide sensitive-term review** for “home health,” “nursing,” “administer,” “medical,” “therapy,” “diagnosis,” “treatment,” “Medicare,” and related terms. Classify every occurrence as allowed, educational-with-context, or remove/rewrite. **When:** Sep 9–11.
- [x] **14. [P0] Standardize public NAP/contact data**—business name, phone, fax, after-hours number, email, and Burdine Street address—from one verified source of truth. **When:** Sep 9–11.
- [x] **15. [P0] Fix malformed address punctuation** visible in legacy footers (`Suite A\", Houston`). **When:** Sep 9–11.
- [x] **16. [P0] Verify “since 1999 / 25+ years”** with internal evidence and use wording that remains accurate as years change. **When:** Sep 9–11.
- [x] **17. [P0] Review testimonials for permission, attribution, authenticity, and sensitive information.** Do not automatically treat raw WordPress comments as approved testimonials. **When:** Sep 9–11.
- [x] **18. [P0] Add a temporary claim-verification release gate** blocking new unverified clinical, payer, credential, award, or quantitative marketing claims. **When:** immediately and keep until migration/governance is complete.

### B. Architecture, migration, UX & visual consistency

- [x] **19. [P1] Adopt one shared site shell** for header, nav, typography, buttons, footer, and mobile navigation across every public route. **When:** Sep 12–18. **Completed Sep 10:** normalized all 132 HTML files to one generated header, navigation, skip-link/main contract, footer, component layer, and mobile action bar.
- [x] **20. [P1] Migrate Contact to the modern shell** and delete the duplicated legacy-homepage content currently embedded above/beside the contact experience. **When:** Sep 12–18. **Completed Sep 10:** the canonical contact/Get Started page uses the modern shell and contains only focused service, eligibility, privacy, and contact guidance.
- [x] **21. [P1] Migrate Careers to the modern shell** with accurate role terminology. **When:** Sep 12–18. **Completed Sep 10:** the modern Careers route uses attendant and administrative terminology, avoids unsupported opening claims, and routes applicants to the verified office process.
- [x] **22. [P1] Migrate Meet Our Staff and staff profiles** to the modern shell and verify every bio/credential. **When:** Sep 12–18. **Completed Sep 11:** migrated the staff index and profile route; restored the owner-approved biographies, credentials, education, roles, and staffing snapshot of more than 500 PAS attendants and 10 office supervisors.
- [x] **23. [P1] Migrate Resources to the modern shell** and replace the bare legacy link-list presentation. **When:** Sep 12–18. **Completed Sep 10:** replaced the legacy list with an annotated official-source resource hub, clear independence/eligibility caveats, and standardized next-step actions.
- [x] **24. [P1] Migrate the Blog index, pagination, retained author/archive routes, and retained posts** to the modern shell. **When:** Sep 12–18. **Completed Sep 10:** migrated the information hub, retained zero unreviewed posts, permanently redirected 24 imported articles and four pagination routes, and replaced their legacy payloads with lightweight noindex fallbacks; no author/archive route was retained.
- [x] **25. [P1] Migrate Client Reviews** to the modern shell and remove WordPress comment/reply UI. **When:** Sep 12–18. **Completed Sep 10:** the modern Client Feedback page contains no comment/reply workflow and publishes no testimonial without the existing permission and privacy gate.
- [x] **26. [P1] Migrate remaining legacy service pages** including Medication Reminders onto one modern service template with scope language and CTA standards. **When:** Sep 12–18. **Completed Sep 10:** the service index and five canonical details use the modern service structure, canonical Get Started route, and non-medical scope controls.
- [x] **27. [P1] Merge Set an Appointment/Get Started into one canonical lead flow** instead of parallel legacy implementations. **When:** Sep 12–18. **Completed Sep 10:** `/home-care-set-an-appointment` permanently redirects to `/home-care-contact-us`; its static fallback is noindex and contains no legacy form/runtime.
- [x] **28. [P1] Remove old WordPress/Proweaver theme CSS/JS dependencies** from each migrated page. **When:** as each page migrates, complete by Sep 18. **Completed Sep 10:** no checked-in HTML file loads a legacy theme, plugin, cache, or WordPress runtime stylesheet/script.
- [x] **29. [P1] Remove obsolete IE conditional markup and WP Rocket lazy-script bootstrap** from the modern static site. **When:** Sep 12–18. **Completed Sep 10:** eliminated the last legacy payloads; the sitewide gate now rejects IE conditionals, WP Rocket loaders, and WordPress runtime dependencies.
- [x] **30. [P1] Define one information architecture:** About, Services, Areas, Insurance/Eligibility, Resources, Careers, Contact/Get Started. **When:** Sep 12–18. **Completed Sep 10:** all page headers use this exact ordered navigation and set the appropriate current section.
- [x] **31. [P1] Standardize CTA language and hierarchy** so each page has one primary action and one consistent call option. **When:** Sep 12–18. **Completed Sep 10:** primary content actions now resolve to “Get Started” at the canonical contact route; phone buttons use one number and label.
- [x] **32. [P1] Create reusable design tokens/components** for type, spacing, buttons, cards, forms, radii, content widths, and states instead of duplicating styles per HTML file. **When:** Sep 12–18. **Completed Sep 10:** added a shared component/token stylesheet for spacing, content widths, controls, forms, cards, focus, disabled, success, error, and reduced-motion states, backed by reusable shell markup.
- [ ] **33. [P1] Run responsive QA at 320, 375, 768, 1024, and 1440+ widths** for nav, forms, cards, plan logos, tables, and footer. **When:** Sep 12–18.
- [x] **34. [P1] Add a mobile call/get-started affordance** if it can be implemented without covering content or accessibility controls. **When:** Sep 12–18. **Completed Sep 10:** every route includes the shared labeled call/Get Started bar, safe-area padding, footer clearance, and desktop suppression.
- [x] **35. [P1] Choose one canonical host (`pthhs.net` or `www.pthhs.net`)** and enforce it in redirects, templates, metadata, sitemap, analytics, and Search Console. Current production behavior favors non-`www`. **When:** Sep 12–18. **Completed Sep 11:** standardized templates, canonicals, Open Graph URLs, schema, robots, sitemap and configured host behavior on `https://pthhs.net`; no analytics runtime is installed, and authenticated Search Console verification/submission remains tracked separately in item 68.

### C. Forms, lead handling & conversion

- [ ] **36. [P1] Test every live contact/appointment/career form end-to-end** with controlled production submissions. **When:** Sep 12–18.
- [ ] **37. [P1] Define one lead-routing destination and escalation path** so every inquiry has timestamp, source, owner, and follow-up status. **When:** Sep 12–18.
- [ ] **38. [P1] Add server-side validation** in addition to browser validation. **When:** Sep 12–18.
- [ ] **39. [P1] Implement accessible spam/bot protection** using honeypot/rate limiting and/or a privacy-conscious challenge. **When:** Sep 12–18.
- [ ] **40. [P1] Minimize lead-form fields** and avoid requesting health details that are not needed for initial routing. **When:** Sep 12–18.
- [ ] **41. [P1] Add proper labels, examples, required states, and autocomplete tokens** to all form controls. **When:** Sep 12–18.
- [ ] **42. [P1] Add inline validation plus a form-level error summary** and preserve user-entered values on error. **When:** Sep 12–18.
- [ ] **43. [P1] Build a clear success state** explaining what happens next without promising an unsupported response time. **When:** Sep 12–18.
- [ ] **44. [P1] Build a failure/retry state** with phone/email fallback so outages do not silently lose leads. **When:** Sep 12–18.
- [ ] **45. [P1] Review consent/privacy wording against the actual data flow** and place a working privacy link next to submit. **When:** Sep 12–18.
- [ ] **46. [P2] Add ZIP, payer/plan, and service-interest fields only if operations will use them and privacy review approves.** **When:** Sep 19–Oct 2.
- [ ] **47. [P2] Instrument conversion events** for click-to-call, email, form start, form success, appointment start, and career application. **When:** Sep 19–Oct 2.
- [x] **48. [P2] Add the homepage’s “How care starts” process to Contact/Get Started** so eligibility, authorization, onboarding, and scheduling are explained consistently. **When:** Sep 19–Oct 2. **Completed Sep 11:** Contact now repeats the three-step eligibility, authorization, agency onboarding, availability and scheduling journey.
- [x] **49. [P2] Publish verified office hours and after-hours expectations** near contact methods. **When:** Sep 19–Oct 2. **Completed Sep 11:** published weekday office hours and the approved after-hours number with clear current-client and routine-inquiry expectations.
- [x] **50. [P2] Add a concise emergency notice where appropriate** stating the website is not an emergency service and users should call 911 for emergencies. **When:** Sep 19–Oct 2. **Completed Sep 11:** added a prominent 911 notice that distinguishes the website, office line and after-hours line from emergency services.

### D. Technical SEO, indexing & structured data

- [x] **51. [P0] Fix malformed canonical markup** in legacy/static HTML, including the broken quote observed in `home-care-services.html`. **When:** Sep 9–11.
- [x] **52. [P0] Fix malformed `og:url`, schema URLs/IDs, and inherited quote/URL errors** so all metadata uses valid absolute canonical URLs. **When:** Sep 9–11.
- [x] **53. [P1] Remove obsolete `meta keywords` and keyword-stuffed legacy metadata.** **When:** Sep 12–18. **Completed Sep 10:** confirmed zero `meta keywords` tags across all 132 HTML files and added a permanent release-gate check.
- [x] **54. [P1] Write a unique, accurate title and meta description for every indexable page.** **When:** Sep 12–18. **Completed Sep 10:** verified 84 indexable routes have nonempty, unique titles and descriptions aligned with the canonical route and non-medical scope.
- [x] **55. [P0] Fix the Client Reviews H1/title mismatch** so the reviews page is not presented as “Alzheimer’s Care in Houston, Texas.” **When:** Sep 9–11.
- [x] **56. [P1] Rebuild JSON-LD from verified data** instead of retaining stale Yoast exports and relative/malformed IDs. **When:** Sep 12–18. **Completed Sep 10:** replaced every indexable page's legacy/stale schema with one deterministic Organization, WebSite, and WebPage graph and removed structured data from noindex fallbacks.
- [x] **57. [P1] Use Organization/LocalBusiness schema only with verified visible facts** such as name, URL, phone, address, and service area. **When:** Sep 12–18. **Completed Sep 10:** Organization schema is generated only from the approved public-facts register and omits service-area, payer, review, award, credential, history, and quantitative fields.
- [x] **58. [P2] Add Service schema selectively** for core PAS/attendant/respite/personal-care pages where supported by visible verified content. **When:** Sep 19–Oct 2. **Completed Sep 11:** added a minimal verified Service node to exactly five core non-medical service routes; omitted payer, area-served, offer, clinical, credential, review, and quantitative claims.
- [x] **59. [P2] Add consistent visible breadcrumbs plus BreadcrumbList schema** to deep service/location/blog pages. **When:** Sep 19–Oct 2. **Completed Sep 11:** generated matching semantic breadcrumb navigation and BreadcrumbList schema for five service details, 65 location routes, and the retained information index.
- [x] **60. [P1] Generate `sitemap.xml` from the canonical route set** rather than hand-maintaining it. The current sitemap lags the live Areas inventory. **When:** Sep 12–18. **Completed Sep 10; expanded Sep 11:** the deterministic generator now publishes all 85 indexable canonical routes—including the restored leadership profile and owner-approved location inventory—and blocks noindex, redirected, missing, or alternate-host entries.
- [x] **61. [P2] Add accurate sitemap `<lastmod>` values** only when reliable modification dates exist. **When:** Sep 19–Oct 2. **Completed Sep 11:** every sitemap row receives a source-controlled Git modification date, using the current PTHHS content review date only for an uncommitted page under active revision.
- [x] **62. [P1] Implement the already-mapped legacy 301 redirects** and expand coverage for old `.html`, WordPress, pagination, and renamed routes. **When:** Sep 12–18. **Completed Sep 10:** retained all migration redirects, added six documented historical location patterns, and generated explicit `.html` twins for every eligible permanent redirect.
- [x] **63. [P1] Normalize internal links to canonical clean URLs** and eliminate mixed `.html`, relative, `www`, and non-`www` patterns. **When:** Sep 12–18. **Completed Sep 10:** verified 3,634 anchors contain no own-host absolute, `.html`, relative-dot, alternate-host, or redirect-chain targets and added CI enforcement.
- [ ] **64. [P1] Run a full production crawl after migration** and fix redirect chains, 4xx/5xx pages, orphan pages, duplicate canonicals, and missing metadata. **When:** Sep 12–18, rerun after every migration batch.
- [x] **65. [P1] Exclude internal audit artifacts/logs/legacy snapshots from the deployed `public/` output** instead of relying only on `noindex`. **When:** Sep 12–18.
- [x] **66. [P2] Create a modern custom 404 page** with real HTTP 404 status, useful navigation, and a contact CTA. **When:** Sep 19–Oct 2. **Completed Sep 11:** verified the modern noindex `public/404.html` contract, useful Home/Services/Areas/Contact paths, and Firebase's documented unmatched-route 404 behavior without a catch-all rewrite.
- [x] **67. [P2] Align `robots.txt` with the chosen canonical host** and keep one correct sitemap directive. **When:** Sep 19–Oct 2. **Completed Sep 11:** the SEO generator now writes one root-level UTF-8 robots policy that allows crawling and advertises exactly `https://pthhs.net/sitemap.xml`; the release gate rejects alternate hosts or duplicate sitemap directives.
- [ ] **68. [P2] Verify Google Search Console for the canonical property** and submit the corrected sitemap after P0/P1 SEO fixes. **When:** Sep 19–Oct 2.
- [ ] **69. [P3] Add Bing Webmaster Tools/IndexNow only if useful** after Google crawl/index fundamentals are stable. **When:** Oct 3–23.

### E. Accessibility

- [x] **70. [P1] Add a visible-on-focus skip link to `main`** on every template. **When:** Sep 12–18. **Completed Sep 11:** all 132 templates use one visible-on-focus skip link and one deterministic `main-content` target.
- [x] **71. [P1] Use semantic `header`, `nav`, `main`, `footer`, lists, buttons, and links** rather than generic click targets. **When:** Sep 12–18. **Completed Sep 11:** audited all templates, moved every page hero/H1 into `main`, promoted 67 generic breadcrumb containers to named navigation landmarks, and found zero scripted fake controls.
- [x] **72. [P1] Audit heading structure** for one purposeful H1 and logical H2/H3 hierarchy per page. **When:** Sep 12–18. **Completed Sep 11:** validated one named H1 inside `main` and a no-skip heading sequence on every page; corrected the 404 card-heading jump.
- [x] **73. [P1] Make desktop/mobile navigation fully keyboard operable** including submenus, Escape behavior, and sensible focus return. **When:** Sep 12–18. **Completed Sep 11:** the flat navigation uses native links and a named native menu button with programmatic expanded state, Escape close, and focus return; no submenu interaction is present.
- [x] **74. [P1] Define visible focus styles** for links, buttons, forms, cards, and menu triggers. **When:** Sep 12–18. **Completed Sep 11:** added persistent high-contrast focus-visible rules, card focus-within treatment, and context-aware focus colors across light, dark, and orange surfaces.
- [x] **75. [P1] Audit text, icon, border, placeholder, and focus contrast** against WCAG 2.2 AA targets. **When:** Sep 12–18. **Completed Sep 11:** added a release-gated palette audit for 16 foreground/background pairs and strengthened form borders, placeholder text, and translucent focus indicators.
- [x] **76. [P1] Increase touch target size/spacing** to roughly 44 CSS px where practical. **When:** Sep 12–18. **Completed Sep 11:** set a 44px minimum for primary navigation, mobile actions, footer links, card links, breadcrumbs, summaries, buttons, and shared controls.
- [x] **77. [P1] Audit meaningful image alt text and use empty alt for decorative imagery.** Remove generic “image” alt text and duplicate announcements. **When:** Sep 12–18. **Completed Sep 11:** validated all public image alternatives and link names, rejecting missing and generic image alternatives.
- [x] **78. [P1] Make form errors, success states, dialogs, menus, and async status updates screen-reader discoverable.** **When:** Sep 12–18. **Completed Sep 11 for the current static surface:** the only dynamic control is the named mobile menu with programmatic state, Escape handling and focus return; CI confirms there are no live forms, dialogs or async status regions. Reopen this requirement before introducing any such component.
- [ ] **79. [P2] Verify 200%/400% zoom and reflow** without lost content or functionality. **When:** Sep 19–Oct 2.
- [x] **80. [P2] Honor `prefers-reduced-motion`** for animation, smooth scrolling, carousels, and attention effects. **When:** Sep 19–Oct 2. **Completed Sep 11:** reduced-motion mode now disables smooth scrolling and collapses animation/transition duration sitewide; interactive scripts also bypass motion.
- [x] **81. [P2] Give icon-only phone/social/menu controls accessible names** and remove duplicate focus stops. **When:** Sep 19–Oct 2. **Completed Sep 11:** validated names for all links and controls; the generated hamburger exposes open/close labels and social controls retain visible focus without duplicate targets.
- [x] **82. [P2] Validate page language, page titles, and named landmarks** across every template. **When:** Sep 19–Oct 2. **Completed Sep 11:** validated English language, nonempty titles, singular header/main/footer landmarks, and names for every navigation landmark on all 132 pages.
- [x] **83. [P2] Make the underlying site accessible natively instead of relying on the UserWay overlay.** Decide separately whether the widget remains. **When:** Sep 19–Oct 2. **Completed Sep 11:** the shared shell now carries native navigation, landmark, focus, motion, naming, and target controls; public pages load no accessibility overlay.
- [ ] **84. [P2] Run automated plus manual accessibility tests** on Home, Services, Service Detail, Areas, Location, Insurance, Contact, Careers, Reviews, Resources, and Blog templates. **When:** Sep 19–Oct 2.

### F. Performance, frontend hygiene & security

- [x] **85. [P1] Remove WP Rocket delayed-script code and unused WordPress plugin/theme JS** from migrated pages. **When:** Sep 12–18. **Completed Sep 10:** the sitewide shell gate confirms zero WP Rocket, WordPress plugin, or legacy theme JavaScript references across all HTML files.
- [x] **86. [P1] Remove unused legacy CSS, Font Awesome, carousel, and theme assets** as templates migrate. **When:** Sep 12–18. **Completed Sep 11:** removed 26 unreferenced WordPress, plugin, Font Awesome, carousel, and theme CSS/JS files (523 KB); the gate now permits only the six shared modern runtime assets.
- [x] **87. [P2] Convert oversized photography to responsive WebP/AVIF variants** with appropriate fallbacks. **When:** Sep 19–Oct 2. **Completed Sep 11:** the two shared photographs now use generated 320px/full-width AVIF and WebP candidates with a WebP fallback; high-resolution build sources live outside the deploy output.
- [x] **88. [P2] Add intrinsic image/embed dimensions or `aspect-ratio`** to control layout shift. **When:** Sep 19–Oct 2. **Completed Sep 11:** corrected inaccurate logo and photography dimensions and release-gated every one of the 276 rendered image instances against decoded file dimensions; no embeds are present.
- [x] **89. [P2] Lazy-load below-the-fold images/iframes but never lazy-load the LCP/hero image.** **When:** Sep 19–Oct 2. **Completed Sep 11:** all 141 below-the-fold/footer instances load lazily; the three hero LCP images and header logos load eagerly, and no iframe is present.
- [x] **90. [P2] Preload only the actual LCP image/font needed in the first viewport** and remove speculative preloads. **When:** Sep 19–Oct 2. **Completed Sep 11:** Home, Services, and About each preload exactly one responsive AVIF hero candidate; all other pages and fonts have no preload.
- [x] **91. [P2] Reduce webfont families/weights, subset or self-host where practical, and use `font-display: swap`.** **When:** Sep 19–Oct 2. **Completed Sep 11:** removed the Google Fonts import and both remote families in favor of one system-font stack, eliminating font downloads and making `font-display` unnecessary.
- [x] **92. [P2] Fingerprint/version CSS and JS when using long cache lifetimes** and align Firebase caching rules with the deployment strategy. **When:** Sep 19–Oct 2. **Completed Sep 11:** every public CSS and JavaScript reference now receives a deterministic 12-character content-hash version; Firebase serves those versioned assets with a one-year immutable policy while HTML and metadata remain revalidated.
- [x] **93. [P2] Audit response headers and add CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and clickjacking protection where compatible.** **When:** Sep 19–Oct 2. **Completed Sep 11:** added a sitewide CSP, MIME-sniffing protection, strict referrer policy, restrictive permissions policy, and both CSP/X-Frame-Options framing protection; compatibility and configuration are enforced by the release gate.
- [ ] **94. [P2] Verify HTTP→HTTPS, alternate-host redirects, and HSTS behavior** so all requests reach one canonical HTTPS URL without chains. **When:** Sep 19–Oct 2.
- [x] **95. [P2] Inventory every third-party script, iframe, form endpoint, font, analytics tag, and external asset** and remove/document dependencies. **When:** Sep 19–Oct 2. **Completed Sep 11:** documented zero passive third-party runtimes, removed the external font request and unreachable PHP endpoint, classified all 138 external navigation links, and added an allowlist-based dependency gate.
- [ ] **96. [P3] Set measurable performance budgets** for LCP, CLS, INP, total JS, and image weight and flag regressions on representative mobile pages. **When:** Oct 3–23.

### G. Local SEO, content, analytics & operations

- [ ] **97. [P2] Give every legitimate location page substantial unique local content** with service-area context, nearby communities, eligibility/plan caveats, and a local CTA. Avoid city-name-swap doorway pages. **When:** Sep 19–Oct 2.
- [x] **98. [P2] Reconcile the Areas index, actual location inventory, sitemap, navigation, and internal links.** **When:** Sep 19–Oct 2. **Completed Sep 11:** the Areas index now links every one of the 65 published location routes, the sitemap includes the full indexable inventory, and each location retains links to Areas, services, Contact and phone support.
- [x] **99. [P2] Verify every county/Region 5/6/service-area claim** against real operational coverage and payer/network constraints. **When:** Sep 19–Oct 2. **Completed Sep 11:** the business owner attested to the published Region 5/6 and eleven-county service area; the public copy retains member, payer, authorization, requested-service and operational-availability caveats.
- [ ] **100. [P2] Audit Google Business Profile information** so name, address, phone, and service areas match the website source of truth. **When:** Sep 19–Oct 2.
- [x] **101. [P2] Create a dedicated Medicaid/eligibility explainer** clearly separating public program rules, payer eligibility/authorization, and PTHHS-specific current participation/onboarding. **When:** Sep 19–Oct 2. **Completed Sep 11:** rebuilt Insurance & Eligibility around separate public-program, plan-decision and Primetime-onboarding steps, linked to official Texas benefits resources and restored owner-approved plan names/logos with confirmation caveats.
- [x] **102. [P2] Upgrade Resources from a bare link list** to maintained, annotated resources prioritizing authoritative Texas HHSC/Medicaid sources and recording last-checked dates. **When:** Sep 19–Oct 2. **Completed Sep 10:** reduced the public set to six official/public-service sources and added a dated quarterly link register with access outcomes and review rules.
- [x] **103. [P2] Create an editorial policy for health-adjacent content** covering source requirements, reviewer role, prohibited claims, disclaimers, and review cadence. **When:** Sep 19–Oct 2. **Completed Sep 11:** added `PTHHS_EDITORIAL_POLICY.md` with authoritative-source, reviewer, non-medical-scope, disclaimer, retirement and quarterly-review requirements.
- [x] **104. [P3] Refresh or retire stale blog content.** The live blog’s newest listed post is February 11, 2025. **When:** Oct 3–23. **Completed Sep 11:** retained the authoritative Resources and service hubs while keeping all 28 stale imported articles noindex and permanently redirected to the reviewed information index.
- [x] **105. [P3] Build content clusters around actual services and user questions**—PAS, attendant care, respite, ADLs, caregiver support, Texas Medicaid navigation, and local service questions—rather than clinical nursing topics. **When:** Oct 3–23. **Completed Sep 11:** documented and linked five non-medical clusters across Services, caregiver support, Medicaid navigation, location questions, and organizational trust; no clinical nursing cluster was published.
- [x] **106. [P2] Curate Reviews into a purpose-built testimonials page** with permission/source records and no open WordPress comment form. **When:** Sep 19–Oct 2. **Completed Sep 11:** rebuilt Reviews with four short, attributed Google-review excerpts, a dated public-source/privacy register, direct Google profile link, and no comment or submission form.
- [x] **107. [P2] Replace the legacy Careers iframe/workflow** with a verified accessible application flow; publish only real openings or clearly label general-interest applications. **When:** Sep 19–Oct 2. **Completed Sep 11:** Careers uses a native, keyboard-accessible call-first process, labels general-interest inquiries, avoids unsupported openings and removes the iframe/form dependency.
- [ ] **108. [P2] Implement or verify GA4/the chosen analytics platform** with privacy-reviewed configuration and documented event definitions. **When:** Sep 19–Oct 2.
- [ ] **109. [P2] Create a compact acquisition/conversion dashboard** covering organic landing pages, call clicks, leads, conversion rate, location performance, and Search Console queries. **When:** Sep 19–Oct 2.
- [x] **110. [Ongoing] Assign page/content owners and recurring audits:** monthly broken-link/form-delivery/indexing checks; quarterly scope, payer, location, accessibility, performance, and content reviews. **When:** monthly/quarterly after launch. **Established Sep 11:** `PTHHS_GOVERNANCE_CADENCE.md` assigns accountable roles, check scope, escalation criteria and monthly/quarterly cadences; recurring execution remains ongoing.

## Release gates

Do not consider the remediation complete until all of the following are true:

- No indexable page implies skilled nursing/clinical/home-health services unless PTHHS can document that exact service and authorization.
- No payer/network claim is published without current evidence or a clear confirmation caveat.
- Every primary public route uses the same shell, verified contact details, and canonical host.
- Contact and career submissions pass controlled end-to-end production tests.
- A production crawl finds no unintended 4xx/5xx pages, redirect chains, broken canonicals, orphaned core pages, or misleading titles/H1s.
- Representative templates pass keyboard, screen-reader, zoom/reflow, contrast, and automated accessibility checks with no critical blockers.
- Internal crawl reports/logs/legacy snapshots are absent from the public deploy.
- Sitemap, robots, canonicals, Open Graph URLs, schema, analytics, and Search Console agree on the canonical host.
- Analytics measures the primary conversion journeys before major CRO testing.
- Named owners/review cadences exist for payer claims, service scope, service areas, reviews, careers, and health-adjacent content.

## Governance notes

Public Texas Medicaid/program facts are not evidence of a PTHHS-specific payer/network contract. Privacy, HIPAA applicability, employment wording, and regulated-service scope should be reviewed by the appropriate business/compliance/legal owner rather than inferred from marketing copy. If a P0 claim cannot be verified quickly, remove or soften it until evidence is available.
