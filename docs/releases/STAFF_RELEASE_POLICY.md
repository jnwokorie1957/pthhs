# Staff portal releases and session security

Owner instruction, November 15, 2026: protect active work; use midnight Central for releases that cannot safely run while the portal is in use.

Ordinary pushes to main queue for the midnight America/Chicago window. Two UTC cron entries cover Central standard and daylight time; the local-hour guard permits only midnight.

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
A window-deferred check does not count. If no immediate guarded scope check runs,
let the next midnight check record the control-only no-deploy proof first.

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

A reviewed, backward-compatible release may run during office hours when its merge/commit message contains `[compatible]`. Put this marker in the PR title only after verifying compatibility with already-open portal pages and previous record formats. The current presentation update preserves existing API fields, handles old and new PDF page layouts and does not force reloads. Breaking API, schema, session or document changes must not use this marker. Existing explicit manual releases remain Hosting-only; they cannot deploy backend services.

Production workflows run serially and do not cancel a deployment midway. All deployment jobs use the exact selected source SHA. Midnight is a scheduled start window, not a guarantee of a zero-delay completion: GitHub can delay scheduled jobs during heavy load. See [GitHub scheduling guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Newly loaded staff portal pages warn after 28 minutes without interaction and sign out after 30. Trusted keyboard, pointer, wheel or touch activity resets the timer. Background reads and token refreshes do not. Same-user tabs share activity through a same-origin channel without sending record information. Returning to a background tab checks expiry immediately. Sign-out uses the existing Firebase handler and clears private workspace content. Existing recent-login requirements and encrypted private document storage remain in force.

Reusable signature appearances do not authenticate a signer or reuse consent. Each signer reviews each document, applies their own appearance to the relevant fields, and confirms electronic signing. Signed documents remain locked; corrections create a new audited copy.
