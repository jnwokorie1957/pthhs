# PTHHS Repository Review Log

This file is append-only. Each pass records its source revision, assumptions,
changes, verification evidence, and remaining opportunities.

## Review 1 — September 12, 2026

### Scope and assumptions

- Reviewed every file tracked at the starting `main` revision `d43e418`, plus
  the latest owner-interview documentation already present on the unmerged
  hygiene branch.
- Treated all existing files under `public/` as frozen visitor-facing data.
- Treated `public/primetime/` as a separately owned internal application, not a
  marketing template.
- Used `primetimehomehealthservices` as the confirmed live Firebase project.
- Preserved the canonical non-`www` host, current sitemap, redirect rules,
  visible claims, payer names, page copy, images, and metadata without edits.
- Did not merge or discard the unmerged owner-content restoration branch because
  it contains visitor-facing changes outside this review's boundary.

### Findings and changes

1. **Release blocker fixed:** the deployment pipeline processed the internal
   `/primetime` app as a marketing page. The accessibility generator then
   deleted its CSS and JavaScript, and the site-shell verifier failed. Shared
   Python and Node scope helpers now exclude internal apps from every broad
   marketing generator and verifier.
2. **Silent deployment drift blocked:** the consolidated release command now
   fails if generation changes tracked public output or the sensitive-term and
   Firebase configuration files. It also hashes `/primetime` before and after
   the build.
3. **Configuration mismatch fixed:** `.firebaserc` now matches the confirmed
   `primetimehomehealthservices` project already used by deployment.
4. **Reproducibility added:** root and Functions lockfiles pin the dependency
   trees; Firebase CLI is pinned in deployment; one command runs the complete
   build and verification sequence.
5. **Pull-request coverage added:** repository/site QA and Functions type checks
   now run before merge through `.github/workflows/quality.yml`.
6. **Repository organization improved:** one-time August SEO evidence,
   production snapshots, source ZIPs, and legacy import utilities were moved to
   labeled archive folders. The source-rewriting one-time polish patch was also
   removed from the release path and retained with the legacy utilities. No
   evidence was discarded.
7. **Documentation repaired:** the placeholder HHA reference README was replaced
   with provenance and safety guidance; documentation and script maps were
   added; owner/developer checklists and the root checkpoint were refreshed.
8. **Whole-repository audit added:** `repository_audit.py` reads every tracked
   file and checks UTF-8 text, JSON/XML/CSV/ZIP structure, binary signatures,
   Markdown links, local public references, forbidden generated/secret paths,
   likely committed secrets, workflow structure, duplicate content, and
   Firebase project consistency.

### Verification evidence

- All 132 marketing pages passed Batch A, B1, B2, B3, B4, structured-navigation,
  accessibility, performance, frontend-control, and site-output checks.
- The internal `/primetime` app remained byte-for-byte unchanged through the
  complete build.
- TypeScript strict type checking passed for `functions/`.
- Root tooling reported zero known npm vulnerabilities.
- Functions dependencies reported two moderate findings in an optional
  `@google-cloud/storage` → `gaxios` → `uuid@9` path. Current direct dependencies
  are already at their latest versions, and `npm audit fix --dry-run` offered no
  lockfile change; track upstream rather than forcing an incompatible override.
- Both archived ZIP packages and the HHA WSDL passed integrity/parse checks.
- No tracked file under `public/` changed in this review.

### Remaining opportunities

- Complete `DEV-005B` through `DEV-009` before activating credential- or
  PHI-bearing management endpoints.
- Add sanitized unit tests for the HHA SOAP envelope/parser as `DEV-008`
  progresses.
- Require the new quality workflow in `main` branch protection when repository
  administration access is available.
- Re-evaluate the moderate optional dependency advisory when Firebase Admin's
  storage dependency resolves to a patched UUID path.
- Keep the unmerged owner-content restoration branch until its visitor-facing
  changes receive a separate review; do not classify it as stale.

### Six-hour follow-up

The requested second pass should fetch the then-current `main`, rerun the same
full audit and release rehearsal, append a new dated section here, and update the
owner/developer checkpoint only when new evidence changes task status.
