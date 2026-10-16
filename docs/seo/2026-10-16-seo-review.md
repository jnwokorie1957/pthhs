# October 16 public navigation and SEO review

## Observed defect and bounded change

A read-only production crawl requested all 132 marketing HTML source routes and
their same-host HTML navigation targets. All reached HTTP 200 after no more than
one redirect, resolving to 86 distinct HTML pages. The 84 indexable final pages
had unique, present titles/descriptions, one H1 and matching apex canonicals.
This inventory is not a Google indexing count.

The initial HTML anchor graph did not reach 41 indexable pages from the homepage,
including the already-published Privacy Policy and Terms of Use. Inspection of
the shared footer and enhancement script confirmed neither policy link was
provided there. The shared footer template and all 132 marketing artifacts now
include a named Legal navigation with direct canonical links to both policies.
Only that footer fragment changed in the HTML; policy text, public claims,
metadata, approved payer images and sitemap content were retained. The private
Primetime application was excluded from this change.

The graph is an initial-HTML check, not a rendered-JavaScript crawl. It does not
establish that every other unreachable route should be promoted. Blog/about-style
landing purposes and additional location availability/unique content still need
review. The existing eight promoted locations and 27 sitemap entries remain the
publication set. Plan item 64 remains partial until those decisions and any
necessary navigation changes are verified.

## Corrected implementation guidance

The two active keyword/priority-page playbooks now replace assumed rankings,
difficulty/conversion weights and promised traffic gains with a measured private
query-to-page review. Read-only GSC baseline access is established. A fresh
single-request October 16 extract returned all 40 available page rows for
September 15–October 12 with pagination exhausted. The original partial extract
is retained; this improves returned-report coverage, not search/indexing census
coverage. The payload remains in private owner outputs.
The older competitor, mapping and location reports
are marked historical hypotheses so future work does not treat their suggested
program, payer or county language as current business evidence.

Current primary guidance checked October 16:

- Google ended FAQ rich results on May 7, 2026 and removed their documentation in
  June. Visible questions can remain useful; adding FAQ markup is not a current
  rich-result tactic. [Documentation updates](https://developers.google.com/search/updates)
- Organization/LocalBusiness pages with business-controlled reviews, including
  widgets, do not qualify for review stars. No ratings were added.
  [Review guidance](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- Content needs a useful purpose rather than a word-count quota or cosmetic
  date change. [People-first guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- Search Analytics can omit rows; date reports omit days without returned data.
  Exhausting connector pagination does not establish a complete search census.
  [API reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

The public-facts, terminology, payer-evidence and claim-release registers remain
authoritative. No new network, program, location, clinical-service, credential or
review claim was approved. Existing owner-approved payer displays were retained.

## Measurement and owner dependencies

Private extracts record the exact property, returned dates, API source, settled
cutoff and pagination. The current 28-day daily window is September 16–October
13, with only October 4–13 observed. The explicit August 19–September 15
comparison returned no rows. No growth, fixed query rank, conversion or release
impact is established. Raw search payloads remain outside the repository.

Sitemap download timestamps/counters are unchanged from the previous check:
there is no evidence Google has reprocessed the restored legacy index. The
deprecated sitemap API indexed field is not a page count. The connector remains
read-only. Existing owner action: inspect detailed warning reasons in normal
Search Console and request reprocessing of the repaired index once if needed.
Do not repeatedly resubmit unchanged files. CrUX field evidence remains
unavailable pending optional authorized configuration; static performance checks
do not establish field Core Web Vitals.

## Verification

Local claim, route-migration, shared-shell, metadata/schema/sitemap, structured
navigation, accessibility, performance, frontend-control, exact payer-image and
private-asset checks passed; all four sitemap-date tests passed. The navigation
gate now requires both canonical policy links in every marketing footer.
Repository and whitespace checks passed. Release
`cf053b5a7d690bd58c4642c0eff6081798d1f41f` passed both normal jobs in
[workflow 38911117420](https://github.com/jnwokorie1957/pthhs/actions/runs/38911117420).

The post-release 132-route crawl again passed HTTP/metadata/canonical checks.
Every distinct final page links both policies, and both are reachable from the
homepage. Other initial-HTML reachability findings remain (39 pages). Served
homepage, policies, services and contact bytes match the tested artifacts; the
27-URL sitemap, legacy index and robots bytes match unchanged local files.
Browser clicks opened both correct policy headings and canonical URLs, and the
footer layout was visually checked. Primetime still returns
noindex/nofollow/noarchive; anonymous session API access still returns 401 with
the same protection. No HHA or patient/staff data was used by this SEO change.
