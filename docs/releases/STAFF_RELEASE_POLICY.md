# Staff portal releases and session security

The November 22, 2026 owner instruction supersedes the previous midnight maintenance rule. Commit and push completed work to Git as soon as it is ready. Git pushes and repository checks run throughout the day.

The staged website and staff portal changes can publish to production from January 1, 2027 Central time. The production workflow deploys a shared Hosting and Functions bundle, so its date check applies to push, scheduled, and manual releases. The existing public site continues serving its current version during staging.

Starting January 1, an eligible main push can deploy at any hour. The daily scheduled check can pick up staged changes once the publication date arrives. Existing scope, component-history, and exact-source checks still apply. Phase 1 staff access covers applicant review and job opportunities. Later modules require their own approval.

## Proposed local repair — November 19, 2026 (not released)

Under the owner's approved article-release isolation scope, scheduled selection
tracks the latest verified Hosting, Functions and analytics deliveries separately.
A Hosting-only success advances only Hosting evidence. An already delivered
article therefore does not queue another full release just because the last
backend release is older. No-change selection starts no deployment jobs.

Article-only selection admits the existing marketing/article paths and article
sitemap-date registry. Non-deployed Markdown/text documentation and explicit
reviewed release-control files do not alone require deployment. Each component
is compared with its own delivered inputs; unknown/shared paths cannot qualify
as article-only. A pending article combined with non-marketing changes is refused.
When there is no pending article change, non-article changes retain the existing
full-release selection and gates. This corrects the earlier local candidate's
overbroad backend-only hold; it does not grant new backend approval, clear any
existing owner hold, alter source gates or authorize an actual release. Existing
manual Hosting and reviewed non-control push behavior remain unchanged. The
control-only rollout is separate: exact reviewed control paths select no push
deployment. Mixing them with any other path requires separate commits and
review. Do not pair the rollout with an article or rely on timing or a
commit-message override as the deployment boundary. A later scheduled release
requires a separate successful release-scope check at a source with no deployment
jobs run before any article or other deployable change follows the controls.
A run that skips scope verification does not count. An isolated control push runs scope verification during staging and records the no-deploy proof.

Baseline discovery uses exact successful deployment jobs from main. It refuses
missing or ambiguous history, reruns, in-progress releases, partial/failed
deliveries, failed runs even when all deployment jobs were skipped, incomplete
job lists and missing/non-ancestor Git objects. First-parent main history rejects
mixed control/content even when the original push was deferred. History
is bounded to five 100-run pages; insufficient history requires reconciliation.
Receipt-triggered Hosting uses its validated pinned source, not the receipt head.
No token, credential, permission, source-read or record authority changes.

Rollback remains a reviewed forward revert, checked against current delivery
evidence. Selecting an older checkout or bypassing held changes is not recovery.
Local tests are not evidence that this policy or the drawer article is deployed.

Review compatibility with open portal sessions and existing records as part of each release. Manual releases remain Hosting-only and use the same publication date.

Production workflows run serially and use the exact selected source SHA. GitHub may delay scheduled runs under load. See [GitHub scheduling guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Newly loaded staff portal pages warn after 28 minutes without interaction and sign out after 30. Trusted keyboard, pointer, wheel or touch activity resets the timer. Background reads and token refreshes do not. Same-user tabs share activity through a same-origin channel without sending record information. Returning to a background tab checks expiry immediately. Sign-out uses the existing Firebase handler and clears private workspace content. Existing recent-login requirements and encrypted private document storage remain in force.

Reusable signature appearances do not authenticate a signer or reuse consent. Each signer reviews each document, applies their own appearance to the relevant fields, and confirms electronic signing. Signed documents remain locked; corrections create a new audited copy.
