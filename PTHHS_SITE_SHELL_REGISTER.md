# PTHHS Site Shell Register

**Updated:** September 10, 2026  
**Canonical host in code:** `https://pthhs.net`

## Implemented controls

- All 132 checked-in HTML files use the shared `modern-page template-refresh` body contract.
- Every page has one shared header, primary navigation, skip link, named `main`, footer, and mobile call/Get Started bar.
- Primary navigation uses one information architecture: About, Services, Areas, Insurance & Eligibility, Resources, Careers, Get Started.
- Every primary content action uses the canonical `/home-care-contact-us` destination and “Get Started” label. Phone buttons use `713-977-7721`.
- Shared tokens and form/control states live in `/assets/components.css`; shared shell markup lives in `scripts/pthhs_shell.py`.
- No HTML file loads legacy WordPress/Proweaver theme CSS/JS, WordPress plugins, WP Rocket delayed scripts, or IE conditional markup.
- Former Friendswood and duplicate Katy URLs are now permanent redirects with lightweight noindex fallbacks. Friendswood redirects to the service-area directory instead of asserting unverified current coverage.

## Open verification work

- Browser-based responsive QA at 320, 375, 768, 1024, and 1440 pixels remains open. The Playwright test harness is checked in, but Chromium installation timed out during this run.
- Canonical metadata, sitemap, robots, and templates use `pthhs.net`; Search Console property selection still requires authorized account access.
- Legacy assets remain on disk because current photography and brand images still use that directory. Asset migration and safe pruning remain separate from removing runtime dependencies.
