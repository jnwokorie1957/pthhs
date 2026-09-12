# Legacy Import Utilities

These scripts were used to crawl, import, and post-process the former
WordPress/Proweaver export. They are retained for provenance only and are not
called by current CI or deployment workflows.

`patch-site-polish.mjs` is the one-time source repair that corrected the former
address-link generator. The corrected implementation is already present in the
active `scripts/site-polish.mjs`; the patch must not run during a build.

Do not run them against `public/` without a disposable worktree and a reviewed
recovery plan: they can recreate legacy markup, download obsolete dependencies,
add placeholder form comments, or rewrite active generator source.
