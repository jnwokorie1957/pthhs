# Repository Maintenance

- [`REVIEW_LOG.md`](REVIEW_LOG.md) is the append-only record of repository-wide
  reviews and follow-up findings.
- [`FILE_INVENTORY.md`](FILE_INVENTORY.md) records the file scope covered by the
  latest completed review.

Run `npm run check` from the repository root for the same deterministic site and
repository checks used by CI. Run `npm ci && npm run check` when dependencies are
not installed.
