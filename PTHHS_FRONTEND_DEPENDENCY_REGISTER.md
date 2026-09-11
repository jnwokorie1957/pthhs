# PTHHS Frontend Dependency Register

**Reviewed:** September 11, 2026  
**Scope:** Public static output and plan items 87–91 and 95

## Runtime dependency result

The public site has no third-party scripts, iframes, forms, analytics tags, embedded media, external fonts, or remote image assets. Every page loads only the shared first-party CSS and `assets/site-enhancements.js`. Google Fonts was removed in favor of one system-font stack, eliminating the only passive third-party request.

The 138 external anchors are user-initiated navigation only:

- 132 Google Maps destination links for the verified office address
- 3 Texas HHS resource links
- 1 Your Texas Benefits link
- 1 Medicaid.gov link
- 1 211 Texas link

These links do not load third-party code or content into a PTHHS page. There are currently no public form endpoints. The unreachable legacy `jnhc0600.php` file was removed so Firebase cannot publish dormant server-side source as a static download.

## First-party runtime assets

- CSS: `modern.css`, `components.css`, `home.css`, `section-pages.css`, and `polish.css`
- JavaScript: `site-enhancements.js`, loaded deferred
- Shared branding: header/footer logos and four small service-card images
- Responsive photography: two source photographs produce 320px and full-width AVIF/WebP variants with WebP fallbacks

## Loading policy

- Home, Services, and About each preload exactly one responsive AVIF LCP candidate and mark that hero image eager/high priority.
- Header logos load eagerly without high priority.
- Every below-the-fold and footer image uses native lazy loading.
- Every image has accurate intrinsic dimensions and asynchronous decoding.
- No font preload or speculative image preload is present.

## Cleanup and controls

The generator removed 147 unreachable legacy files totaling 9,346,991 bytes, including the retired upload library, theme decoration, Font Awesome font, and PHP endpoint. The deploy file payload fell from 10,789,720 bytes to approximately 1.74 MB—an 83.8% reduction—while the two high-resolution source photographs remain outside `public/` for deterministic rebuilds.

The permanent gate validates image dimensions against decoded files, responsive candidates and fallbacks, loading priority, the external-runtime inventory, the six-file retained legacy image allowlist, the absence of public PHP, and a 2 MB public-output foundation budget.

Re-run this inventory whenever a script, embed, form, analytics tag, font, or externally hosted asset is proposed. Privacy and security review are required before adding passive third-party runtime code.
