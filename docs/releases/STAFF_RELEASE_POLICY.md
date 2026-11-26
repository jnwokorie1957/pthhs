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

## January 2027 incident reconciliation (proposed control rollout)

For the interval audited in [PR #71](https://github.com/jnwokorie1957/pthhs/pull/71),
the scheduled selector can recognize three exact mixed commits and their four
reviewed push runs, including the isolated runner restoration. It verifies
commit, first parent and tree, run/attempt/job identity, the scope step and
three skipped component jobs. It retains the independently delivered sources
from run 45066249129; no failed run is a delivery or a successful control proof.
Unrelated failed runs and mixed commits still stop selection.

The exception requires fresh Google API reads during the same verification.
The current and previous Hosting channel releases, their complete 292-file
manifests and their two distinct configuration hashes must match. The previous
Hosting release and all nine backend/two analytics function updates must fall
in the respective successful baseline job intervals. Function identities,
revisions, build IDs, timestamps, status and codebases are fingerprinted. A
changed inventory, missing page, unreachable region or denied read stops the
release. Never update the pinned values automatically or treat an audit as a
new delivered Git source.

**Operator sequence before launch**

1. Review this policy in a control-only PR; merge only within the publication
   hold. The resulting main **push** must complete the scope step with mode
   none and three skipped deploy jobs. A branch run or deferred schedule is
   insufficient. Reassess before merging if the date or main changes.
2. An IAM administrator must approve a dedicated Google reader for the GitHub
   verifier. Use direct Workload Identity Federation with the pinned Google auth
   action, no key and no deployer impersonation. Set Actions repository variable
   RELEASE_INVENTORY_WIF_PROVIDER to the approved provider resource name.
   Restrict provider trust to GitHub's issuer, repository ID 1296908157, owner
   ID 302289243, main ref, and only the following workflow_ref/event pairs:
   deploy-firebase.yml on schedule and rehearse-january-release.yml on
   workflow_dispatch (use full repository workflow refs ending @refs/heads/main).
   Scope access to read the Hosting live-channel releases, versions and files,
   and list deployed functions on primetimehomehealthservices. Do not grant
   Editor, deployment, IAM administration, secret access, or record access.
   This PR creates neither a provider nor a Google IAM binding.
3. Run **Rehearse scheduled scope (no deployment)** on main before January 1.
   It uses the same verifier, reads live inventories, and has no deploy jobs or
   deployment outputs. Record the checked SHA and successful workflow URL.
   A refusal is a launch blocker; repeat after a material change. A passing
   rehearsal is evidence for that SHA and time, never permission to publish early.
4. The normal release workflow still enforces January 1 midnight Central,
   runs fresh verification, and retains separate backend, Hosting and analytics
   checks. Do not dispatch the production Hosting workflow for rehearsal.

Rollback remains a reviewed forward revert, checked against current delivery
evidence. Selecting an older checkout or bypassing held changes is not recovery.
Local tests are not evidence that this policy or the drawer article is deployed.

Review compatibility with open portal sessions and existing records as part of each release. Manual releases remain Hosting-only and use the same publication date.

Production workflows run serially and use the exact selected source SHA. GitHub may delay scheduled runs under load. See [GitHub scheduling guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Newly loaded staff portal pages warn after 28 minutes without interaction and sign out after 30. Trusted keyboard, pointer, wheel or touch activity resets the timer. Background reads and token refreshes do not. Same-user tabs share activity through a same-origin channel without sending record information. Returning to a background tab checks expiry immediately. Sign-out uses the existing Firebase handler and clears private workspace content. Existing recent-login requirements and encrypted private document storage remain in force.

Reusable signature appearances do not authenticate a signer or reuse consent. Each signer reviews each document, applies their own appearance to the relevant fields, and confirms electronic signing. Signed documents remain locked; corrections create a new audited copy.
