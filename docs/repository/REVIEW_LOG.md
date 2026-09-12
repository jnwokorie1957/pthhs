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

## Review 2 — September 12, 2026

### Source and delta

- Fetched the current `main` at `88fdff441a9bc7884e9f8c1c2ada9dd36a2418af`.
  No commit had been added to `main` since Review 1 merged.
- Re-read, hashed, and format-checked the same 278 tracked paths. The exact path
  ledger in `FILE_INVENTORY.md` still matches `git ls-files`, so no inventory
  rewrite was required.
- Kept every tracked `public/` file frozen. The generators produced no tracked
  public diff, and the `/primetime` before/after hash comparison remained clean.
- Rechecked the owner and developer task lists. No evidence changed their
  status: `OPS-003` and `DEV-005B` remain the current actions.

### Verification evidence

- `npm ci` completed from both clean root and Functions dependency trees.
- `npm run check` passed all 132 marketing pages, 84 indexable schema pages,
  27 sitemap URLs, 118 permanent redirects, 3,702 canonical link checks,
  276 image checks, and 4,629 local public references.
- The repository audit passed for 278 tracked files totaling 5,700,212 bytes,
  including JSON/XML/CSV/ZIP parsing, image signatures, Markdown links,
  workflow checks, likely-secret scanning, and Firebase project consistency.
- `npm run check` in `functions/` passed strict TypeScript type checking.
- Root npm audit remained clear. Functions audit still reports two moderate
  findings in `firebase-admin@14.4.0` → `@google-cloud/storage@8.1.0` →
  `gaxios@6.7.1` → `uuid@9.0.1`. Direct packages remain current, and
  `npm audit fix --dry-run` proposed zero changes.
- The latest `main` Firebase deployment completed successfully. Live smoke
  checks returned HTTP 200 for `/`, both protected service routes, and
  `/primetime`.

### Findings and actions

1. **No new `main` defect found.** Review 1's release-boundary repair remains
   effective and the complete rehearsal is reproducible from a clean worktree.
2. **Active content branch remains isolated.** `codex/batch-c-g-qa` advanced to
   four commits ahead of `main` and has no pull request. It contains extensive
   visitor-facing changes and deletes parts of the Review 1 archive/inventory
   structure. It must be rebased and separately reviewed; merging it as-is
   would violate this pass's public-data freeze and undo retained evidence.
3. **Transitive dependency follow-up remains open.** Install notices also trace
   `glob@10.5.0` and `node-domexception@1.0.0` to Firebase Admin's dependency
   tree. Track upstream releases rather than adding untested overrides.
4. **Optional CI optimization identified.** A future reviewed change may limit
   Firebase deployments for documentation-only commits, but only after every
   generator and deployment input is explicitly enumerated. The current broad
   trigger is safer than an incomplete path filter.
5. **Documentation-only completion recorded.** This append and the `R10`
   checklist completion are the only Review 2 repository changes.

### Remaining blockers

- Complete `DEV-005B` through `DEV-009` before enabling credential- or
  PHI-bearing management endpoints.
- Complete owner decisions beginning with `OPS-003` before implementing real
  exception thresholds or automated operational rules.
- Require the `Repository quality` workflow through `main` branch protection
  when repository settings access is available.
- Resolve and re-review `codex/batch-c-g-qa` separately before any visitor-facing
  content is proposed for `main`.
