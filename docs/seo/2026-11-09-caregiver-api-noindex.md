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

Release through the existing Hosting-only workflow after both normal PR quality
jobs pass. Deployment and actual response-header acceptance are pending at this
checkpoint.
