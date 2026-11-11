# Primetime entry revalidation — November 11, 2026

The November 10 Chrome acceptance initially reused a previous Primetime
HTML entry after a successful Hosting release. A normal reload obtained the
current fingerprint. The entry returned a one-hour browser cache lifetime.
PR24 adds an exact /primetime Cache-Control: no-cache response rule.

The canonical entry is the terminal HTML response. /primetime/,
/primetime/index and /primetime/index.html each redirect to /primetime.
Fingerprint-based JavaScript and CSS caching keeps its existing policy.
Private indexing protections and protected API responses retain their
independent controls. No source records, marketing claims or access changed.

[PR24](https://github.com/jnwokorie1957/pthhs/pull/24) merged as
24047bd9c07ce910c0861bf3de8baf18a243a7db after both repository quality jobs
passed. The normal [Hosting-only release](https://github.com/jnwokorie1957/pthhs/actions/runs/42950175223)
passed release_scope and build_and_deploy. Backend and analytics deployment
were skipped by the existing workflow. Local scope/auth regressions passed
85 tests, deterministic asset checks passed, and the repository audit,
141-page performance check and diff review passed.

Production HTTP checks at 03:05 UTC verified the following:

- /primetime returns 200, no-cache, header/meta noindex and exact Git HTML.
- A conditional If-None-Match request returns 200 with the same current
  HTML and no-cache. Validation can return a full representation; this
  observation does not claim a 304 bandwidth saving.
- All three HTML aliases return 301 to the canonical entry with noindex.
- Dashboard and maintenance script bytes match Git and retain immutable
  caching. No new script fingerprint was required for this header change.
- Anonymous /primetime/api/session returns 401 with no-store and noindex.
  The caregiver public configuration API returns 200 with both policies.
- Careers and the sitemap match Git. The sitemap lists 36 URLs and excludes
  private portals. These checks did not read patient/staff or HHA records.

The existing Chrome profile then revisited /primetime, used normal reload,
navigated to Careers and returned through browser history. Each Primetime
observation retained dashboard c32c3381c519 and meta noindex. The checks
inspect the HTML version only; history return is not a fresh source read.

A response with no-cache requires validation before cache reuse.
The new response policy does not retroactively evict an already fresh
cached response, replace an open document or force history restoration to
request the network. The next runtime release should include a previously
cached entry crossing that release boundary. API receipts, source limits,
assignments and document release/version acceptance remain independent.

Primary references checked November 11:
[Firebase Hosting cache behavior](https://firebase.google.com/docs/hosting/manage-cache),
[RFC 9111 no-cache](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.4)
and [Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
The [November 10 Search Console evidence](2026-11-10-canonical-sitemap-discovery.md)
still dates the 36-page discovery count. This release establishes neither
new indexing results nor ranking, lead or field-performance outcomes.
Owner-confirmed location facts and existing business/claim blockers remain.
