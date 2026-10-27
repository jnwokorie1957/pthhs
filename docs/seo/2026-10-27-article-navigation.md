# October 27 Articles index and navigation — released

Requested scope: one `/articles` index, a top-level Articles link in the shared
desktop/mobile navigation, and automatic discovery of all published registry
entries. Existing Home Care Guide, service links and legacy quarantine remain.
Private portal files, permissions, source reads and article prose are unchanged.

The registry requires explicit `published`, `draft` or `quarantined` state.
Draft/quarantined entries are not read or rendered. Unknown states fail closed.
The index, guide cards and sitemap derive published article routes from the
registry. Stale public article outputs outside that set fail the build for
explicit review; the generator does not silently delete files.

Thirteen article regressions cover multiple published records, excluded drafts,
unknown state, stale generated files, shared navigation idempotence, index
canonical/breadcrumb metadata and preservation of the original approved body.
Static mobile coverage verifies the existing controller uses the same shared
navigation. Real browser/assistive-technology acceptance is still unverified.

Release: c4345b3871102ea3331fc4bb32f54d1c395e492f passed independent review,
13 article tests and the committed aggregate gate (including 287 JavaScript
tests and four sitemap-date tests). Separate publication approval was received
before the normal main push, which triggers Hosting and Functions. No workflow
or access settings were changed.

[Release 40549793411](https://github.com/jnwokorie1957/pthhs/actions/runs/40549793411)
completed Hosting successfully October 27 at 17:22:03 UTC and backend verification
at 17:22:28 UTC. Ordinary query-free homepage, `/articles`, article, guide and
sitemap responses returned 200 and matched exact commit bytes at 17:22:31–33 UTC.
The shared Articles link was present on all checked marketing pages; canonical,
approved article text/citations and disclosure were retained. Portal asset hashes
were unchanged. Public HTTP delivery does not establish native responsive or
assistive-technology acceptance, which remains unverified.

Rollback: revert c4345b3 through the same authorized release pipeline, preserving
later unrelated work. No manual source-record or infrastructure rollback is needed.

Metadata follow-up: c485efd8532d32e5cb3579e3f95a8b33e78eacbd corrects only
the collection's Open Graph type to `website`; individual articles retain `article`.
The paired regression failed before the fix and passed afterward. Independent
review, all 13 article tests and the exact-commit aggregate gate passed.
[Release 40562981364](https://github.com/jnwokorie1957/pthhs/actions/runs/40562981364)
completed Hosting at 18:46:31 UTC and backend at 18:47:01 UTC on October 27.
Ordinary public index and article responses returned 200 and matched commit
bytes at 18:47:13 UTC, with exactly one correct Open Graph type on each.
Article prose, private portal and other marketing output were unchanged.
This corrects social-preview semantics; no ranking or indexing outcome is claimed.
Native browser/AT acceptance remains unverified. Scoped rollback: revert c485efd
through the normal authorized pipeline, preserving unrelated work.

Later bounded browser acceptance: desktop keyboard and 390-pixel mobile menu,
Escape/focus and article/index/guide paths passed in Chrome. See the
[Articles browser review](2026-10-27-articles-browser-review.md). This closes those
browser checks; screen-reader and broader AT acceptance remain unverified.
