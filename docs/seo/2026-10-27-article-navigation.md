# October 27 Articles index and navigation — local candidate

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

Publication boundary: `.github/workflows/deploy-firebase.yml` runs on main push
and deploys Hosting and Functions. The current instruction excludes deployment,
so this candidate must remain local until separate approval covers that effect.
No workflow changes, skip marker or alternate push route is authorized to bypass
that boundary. Independent review passed; all 13 article tests plus second-article and stale-output
checks passed. Static accessibility, navigation, metadata, sitemap and performance
validators passed. The final committed reproducibility gate is checked before
any publication; this document does not claim a public release.
