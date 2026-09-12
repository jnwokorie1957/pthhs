# PTHHS Documentation Map

Use this page to find the current source of truth before editing the site or the
internal management layer.

## Current work

- [Management layer](management-layer/) — separate owner/operations and
  developer checklists for `/primetime` and HHAeXchange integration.
- [Repository review log](repository/REVIEW_LOG.md) — append-only engineering
  reviews, decisions, verification results, and follow-up opportunities.
- [SEO strategy](seo/) — still-useful keyword and competitor planning material.
- [`plan.md`](../plan.md) — numbered website remediation checklist and current
  maintenance addendum.

## Active root governance

The `PTHHS_*` files that remain at the repository root are intentionally active.
They are inputs to release checks, current policy, or generated registers. Do
not move or delete them without updating their consuming scripts in the same
change.

- Public facts, terminology, payer evidence, and claim-release controls
- Blog/image/resource scope registers
- Site-shell, route, SEO, navigation, dependency, security, and sensitive-term
  release evidence

## Historical evidence

[`archive/`](archive/) contains source packages and selected production
snapshots retained for traceability. Superseded text reports remain available
through Git history instead of occupying the current documentation tree.

## Repository boundaries

- `public/` is the Firebase Hosting output.
- `public/primetime/` is an internal application with its own UI and runtime
  contract. Marketing-site generators must leave it unchanged.
- `functions/` is backend-only and must not expose credentials or PHI.
- `scripts/legacy-import/` is historical recovery tooling and is not part of
  the current build.
