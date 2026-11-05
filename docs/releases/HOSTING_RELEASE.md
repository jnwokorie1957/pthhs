# Scoped Hosting releases

Ordinary main pushes containing only the explicit article/marketing allowlist
select Hosting-only. Other ordinary pushes preserve the existing full release
behavior. Missing comparisons, forced pushes, invalid receipt pushes or scope
verification failures start no deployment jobs. Manual dispatch still requires
main and deployment_target=hosting. No credential, permission or IAM change.

Hosting-only runs the complete npm release gate and the existing Hosting guard
before deploying to the existing live site. Both backend jobs depend on verified
scope and require full mode. They cannot run for a valid Hosting-only receipt.

## Recovering an already-pushed, tested article

1. Independently review the exact workflow/tooling bootstrap diff and tests.
   Publish that bootstrap with [skip ci], never as an ordinary full-release push.
2. Confirm main still equals that exact reviewed bootstrap SHA. The article
   source/base comparison must contain only allowed marketing paths. Pin the
   independently verified deployed baseline; its comparison to the source may
   differ only in marketing and non-deployed documentation. Pin current main as
   target_base_sha before applying the reviewed bootstrap. Only the six named
   trigger/test/doc files may differ between target_base_sha and target_sha.
   Concurrent portal/backend changes stay on main but are NOT released by this
   receipt: Hosting explicitly checks out source_sha, never the receipt's tree.
3. Add or replace only docs/releases/hosting-release.json in a single-parent
   commit directly following the reviewed bootstrap. Do not use [skip ci] on
   this receipt commit. Schema (all hashes are full lowercase 40-digit Git IDs):

```json
{
  "version": 2,
  "deployed_sha": "<independently verified currently deployed commit>",
  "base_sha": "<reviewed article base commit>",
  "source_sha": "<tested article source commit>",
  "target_base_sha": "<main before reviewed bootstrap>",
  "target_sha": "<reviewed bootstrap commit / receipt parent>",
  "public_tree_sha": "<git rev-parse source_sha:public>"
}
```

The receipt is not an editorial approval or proof of tests by itself. The owner
must review those exact commits before constructing it. The verifier checks
ancestry, direct parent, exact fields, changed paths, ordinary file modes and
the tested source public-tree identity. It rejects extra receipt files,
excluded deployment-source/bootstrap changes, stale targets and missing Git
objects. Git alone cannot prove what is currently deployed: the owner must
independently verify that baseline and stop if production has changed. The scope
job tests the reviewed trigger; the Hosting job runs the complete source commit's
build and its existing Hosting guard. Existing manual behavior remains unchanged.

4. Verify the exact receipt commit's scope output is hosting, both backend jobs
   are skipped, Hosting succeeds, and ordinary public responses match the tested
   article. Native visual/keyboard acceptance is separate from HTTP and CI.

For rollback, review a scoped revert of the article and release it through the
same guarded Hosting-only path. Never use an empty or generic documentation
commit as a substitute, since ordinary non-marketing pushes retain full behavior.
