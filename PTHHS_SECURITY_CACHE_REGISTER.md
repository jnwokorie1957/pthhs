# PTHHS Security and Cache Register

**Reviewed:** September 11, 2026  
**Scope:** Firebase Hosting response policy and plan items 92–93

Configuration was checked against Firebase's current Hosting header and cache documentation. Firebase includes the query string in its cache key, so content-hash query versions safely separate asset releases.

## Cache strategy

Every public CSS and JavaScript URL carries a deterministic 12-character SHA-256 content version. The build updates the version whenever file bytes change and rejects missing, stale, or non-content-derived versions.

- Versioned CSS and JavaScript: `public,max-age=31536000,immutable`
- Stable-name images and icons: `public,max-age=86400,stale-while-revalidate=604800`
- HTML, XML, JSON, and web manifests: `public,max-age=0,must-revalidate`

HTML remains revalidated so a release can immediately advertise new asset versions. Images keep a shorter stale-while-revalidate policy because their filenames are stable and therefore must not be cached immutably. High-resolution image build sources remain outside the deployed `public/` directory.

## Security response policy

Firebase applies these headers to every response:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera, microphone, geolocation, payment, USB, and browsing-topics access
- `X-Frame-Options: DENY`

The CSP restricts resources, connections, forms, framing, and base URLs to the first-party origin. Objects and frames are disabled, mixed HTTP subresources are upgraded, and framing is denied by both modern CSP and the legacy-compatible header.

## Compatibility findings

The public site contains no form, iframe, object, embed, passive third-party runtime, external font, remote image, inline style, or inline event-handler dependency. First-party JavaScript remains allowed. Inline scripts remain temporarily permitted only for non-executable JSON-LD; the gate rejects any inline script that is not valid `application/ld+json`.

Any future form, analytics, embed, font, remote media, executable inline script, or third-party connection requires a privacy/security review and a deliberate CSP change. HSTS and redirect behavior remain a separate production-verification item and are not claimed complete here.

## Release gate

The frontend-controls gate recomputes every asset version, validates Firebase cache/header policy, parses all JSON-LD, rejects inline executable scripts and event handlers, audits CSP compatibility, and confirms that only items genuinely completed are checked in `plan.md`.
