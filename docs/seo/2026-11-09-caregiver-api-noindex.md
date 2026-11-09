# Caregiver API indexing header

Observed November 9, 2026 UTC during the SEO and owner-task check. The existing
caregiver setup is now available. Its HTML at `/caregiver?intent=existing`
matches the reviewed Git bytes and already returns both robots meta noindex and
the `X-Robots-Tag` header with no-store. The successful same-origin
`/caregiver/workforce-api/configuration` response returns HTTP 200/no-store but
lacks that header. Its equivalent under `/primetime/workforce-api` already
receives the existing Primetime Hosting rule.

The fix adds the same `noindex, nofollow, noarchive` value to the narrow
`/caregiver/workforce-api/**` Hosting pattern. It leaves the caregiver HTML,
Primetime pattern, public Careers page, rewrites, CSP, caching, authorization,
account flags, and backend functions unchanged. The configuration response
contains release flags only; the anonymous application session continues to
return 401/no-store. This is an indexing directive, not an authentication
control or evidence that a URL was indexed.

Google Search Central's current
[robots header reference](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
supports a response header for non-HTML resources. Its
[HTTP status guidance](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)
also distinguishes successful responses from rejected 401 responses. The
production check will verify successful responses receive the header and that
rejected sessions still deny access, regardless of whether Hosting adds the
header to an error response. Firebase's
[Hosting configuration documentation](https://firebase.google.com/docs/hosting/full-config)
describes path-based response headers.

The latest available Search Console Sitemaps evidence remains the November 8
read-only review: all three rows succeeded, with 34, 34 and 33 discovered pages.
The overlapping counts are dated and not indexed-page totals. The delivered
36-URL sitemap excludes the private portals. No resubmission, public job claim,
payer, location, or owner decision changes are needed for this fix.

## Release and production acceptance

PR [#13](https://github.com/jnwokorie1957/pthhs/pull/13) passed both normal quality
jobs in [42549183680](https://github.com/jnwokorie1957/pthhs/actions/runs/42549183680).
The merged configuration is `a983fe5259561fa198ba08d6d82a1fdbd814b046`. The existing
explicit Hosting-only run
[42549337088](https://github.com/jnwokorie1957/pthhs/actions/runs/42549337088)
passed release_scope and build_and_deploy. Backend and analytics deployment jobs
were skipped. There was no new function, permission or release-control change.

November 9 at 02:10:40 UTC: ten production routes passed. Both workforce
configuration paths return HTTP 200/no-store and the expected robots header.
Caregiver setup readiness and Google sign-in remain available; applications and
uploads remain closed. Three anonymous session routes remain 401/no-store. The
workforce API's anonymous error responses need no indexing inference from a
header; their access-denied status is independently verified. This does not
claim Google crawled, indexed or removed any route.

Five static artifacts match exact Git bytes: Careers, caregiver setup, both
private Primetime shells and the sitemap. Careers remains indexable, private
shells retain meta/header noindex, and the 36-URL sitemap excludes them. The
prior Search Console observations remain dated; no resubmission was made.
Local validation passed 54 focused tests, eight SEO metadata tests, deterministic
asset checks, the repository audit and diff checks. The normal CI and Hosting
build ran their existing full checks. No individual account, source record,
owner decision or business claim was changed.
