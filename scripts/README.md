# Repository Scripts

## Current release path

Run the same deterministic build and verification used by CI:

```bash
npm ci
npm run check
```

`build-and-verify.sh` runs the generators and every release verifier, audits all
tracked files, protects the internal `/primetime` assets, and fails if release
generation leaves uncommitted public output.

`site_scope.py` and `site-scope.mjs` define the shared boundary between the 132
marketing pages and the internal `/primetime` application. Any new internal app
under `public/` must be added to both helpers with matching tests.

## Script groups

- `site-polish*`, `seo_foundation.py`, `accessibility_foundation.py`,
  `performance_foundation.mjs`, and `frontend_controls.mjs` are deterministic
  generators.
- `verify_*` and `verify-*.mjs` are read-only release gates.
- `repository_audit.py` reads and validates every tracked repository file.
- `batch_*_migration.py` and `batch_*_remediation.py` are retained remediation
  utilities; do not run them casually against a dirty worktree.
- `repair_image_assets.py` and `cleanup_stale_image_refs.py` support the
  separately scoped image-repair workflow.
- `legacy-import/` contains superseded WordPress/static-export recovery tools.
