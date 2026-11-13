# Approved caregiver source reconciliation

Prepared November 13, 2026 UTC from main
`3afd2a2f13ed07011aecc1d4087410629b65205c` and the independently approved
caregiver source `ed534254647fca1da3ecca042a281c4af82cbcc4`, then the
concurrent committed source `1fe5efb316dda14be1ae18b30a49ee1d4ccfe6ae`.
Released as PR27 / `e3869fb1cc8ebdaa36868dcd83ee8f382429cd6d` through the
normal GitHub quality and manual Hosting-only workflows. Production delivery
was verified November 13 at 02:33 UTC. Protected role acceptance remains separate.

The caregiver source preserves the already approved navigation, form flow,
signatures, age validation, staff training and timed intake implementation.
This reconciliation introduces no new operational policy or release grant.
The original source history remains in its owning checkout; this integration
records its exact source commit and preserves current main's later Primetime
changes. Neither owning checkout was switched or overwritten.

A 01:53 UTC pre-release check detected four newer live caregiver files.
All four independently match `1fe5efb`: the two portal entries, personnel
controller and session controller. Their source includes the previously
published HHA application-transfer implementation `4d94b04617d1be6ba5157c608132f1d57ad4c5be`
and the name-first caregiver search correction. Those committed changes are
preserved. Uncommitted authorization/applicant work in the owning staff
checkout is excluded and untouched. This is source reconciliation, not
acceptance or dispatch of an HHA transfer.

## Build corrections

- Keep the retired Careers fallback outside marketing generators, with its
  noindex and three permanent redirects to `/caregiver`. The reviewed sitemap
  contains 35 URLs. Public navigation uses Caregiver Portal.
- Retain main's quarantined article and legacy redirect fallbacks. Some
  caregiver-source fallbacks had been replaced with copies of their redirect
  destinations. Preserve their existing noindex, canonical and quarantine
  contracts while applying the approved recruiting-link change.
- Keep `workforce-document-access.js` and `workforce-training.js` in the
  explicit runtime asset inventory. The marketing pruner previously deleted
  them, causing a subsequent asset check to fail.
- Do not generate a `/.html` child for a trailing-slash redirect. Preserve
  extensionless, `.html` and trailing-slash Careers aliases independently.
- Include the application-flow and retirement regressions in the release
  suite. Snapshot caregiver HTML and the retired fallback alongside Primetime
  before marketing generation; fail if the build changes those files.

## Reviewed asset allowances

Existing approved features exceed the earlier build allowances. The limits
remain explicit and bounded, with small headroom around the measured payload:

| Build group | Measured raw / gzip bytes | Raw / gzip allowance |
| --- | ---: | ---: |
| Staff management and training controller | 63,704 / 16,139 | 65,000 / 17,000 |
| Caregiver application and shared controllers | 227,001 / 71,500 | 230,000 / 73,000 |
| Blank forms, schema and licensed signature font | 1,735,615 | 1,750,000 |

The full Allura font is retained for connected cursive glyphs. Its source
license wording is preserved; trailing whitespace is normalized. The existing
marketing, operations, PDF-viewer and training-video limits remain in force.
These are static build allowances, not Firebase quotas, financial decisions,
field performance measurements or evidence of completed form acceptance.

## Validation before publication

- 961 backend tests and TypeScript compilation pass after the committed
  concurrent source integration.
- All 683 site/tooling/analytics tests pass, including retirement and the
  name-first account-search regression. Empty account searches make no source
  request; a typed name uses the scoped account lookup without loading other
  staff lists. Both normal GitHub quality jobs also pass with fresh installs
  and dependency audits.
- Two retirement/sitemap guards and the trailing-slash expansion regression
  reproduce the integration failures before correction and pass afterward.
- Ten metadata tests, four sitemap-date tests and 26 article tests pass.
- The generator and static validation sequence passes with no unstaged output;
  all protected build snapshots remain unchanged. Windows validation uses
  UTF-8 mode; Linux CI remains authoritative for its shell and fresh installs.
- Accessibility, performance, frontend controls, insurance image integrity,
  repository audit and whitespace checks pass. The training video was inspected
  as a visibly marked demonstration with sample records.
- All 34 legacy Primetime source/public files outside the separate workforce
  entry remain byte-equivalent to current main. Operations and maintenance
  backend time mappings are preserved. The concurrent source adds two scoped
  caregiver projection fields and an optional SOAP redirect policy; existing
  defaults and source permissions remain. Caregiver HTML matches the current
  committed live source.

## Release boundary

Both quality jobs and both required Hosting-only release jobs passed.
Functions and website-analytics deployments were skipped. Do not redeploy
Functions, alter source approvals, intake or mail settings, or run a real
application merely to reconcile website source.
Compare current live assets and public configuration before release to detect
any newer concurrent caregiver work. Verify the combined public/private static
files, retired aliases, noindex/cache policies and anonymous API denials after
release, plus unchanged caregiver configuration.

Administrator sign-in remains necessary for protected Primetime acceptance.
Family/PT assignments, form versions/sharing, final applicable 2027 forms and
production retention decisions remain separate. This work does not establish
HHA call-link support, missing-time recovery, clinical/financial decisions,
multi-user acceptance or any new authority to send communications.

## Production acceptance

The final pre-release comparison checked 30 existing public/private static
assets against current committed sources. All matched, and the tested merge
tree matched the reviewed PR tree. After both release jobs succeeded, all 35
canonical sitemap URLs returned direct 200 with exact Git bytes, one matching
canonical, one H1 and indexable delivery. All 30 key assets matched the release.
Three old Careers aliases returned 301 to Caregiver Portal. Its public
configuration remained unchanged, with no-store/noindex. Primetime retained
meta/header noindex and no-cache; its anonymous session returned JSON
401/no-store/noindex. Native Chrome showed the released public portal link.

These checks establish bounded delivery and preserved configuration. They do
not establish authenticated staff/family/PT workflow acceptance or new HHA
time/transfer evidence. No source record, application, communication or grant
was created by this pass. No unfinished staff-source files were imported.

- [Merged PR27](https://github.com/jnwokorie1957/pthhs/pull/27)
- [Both quality jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/43351077153)
- [Hosting-only release jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/43352460216)

Local nonsensitive receipts: `primetime-reconcile-production-baseline-20261113.json`,
`primetime-source-reconciliation-livecheck-20261113.json` and
`primetime-reconcile-production-20261113.jpg`.
