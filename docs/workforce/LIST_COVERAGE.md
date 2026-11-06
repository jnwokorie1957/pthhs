# Management list coverage

The management overview previously counted a separate application read from the
inbox, and its counts hid the API limits. The overview and inbox now use the same
response. Counts describe loaded records, with the server's returned per-office
limit beside them. Reaching a limit means more records **may** exist; it does not
prove truncation or an office total.

The existing source contracts remain:

- `functions/src/workforce/intakeStore.ts`, `queue`: `/staff/applications`
  returns `items` and `limitPerOffice: 50` across the actor's permitted offices.
- `functions/src/workforce/store.ts`, `list`: `/staff/opportunities` returns
  `items` and `limitPerOffice: 100` across the actor's permitted offices.
- The separate verified caregiver opportunity list has a 100-record overall
  limit. Management's published count does not establish what that list contains.
  This change does not alter that endpoint or claim a complete caregiver board.

Submitted-application actions open the Submitted filter; the Applications nav
opens All statuses. Opportunity pipeline actions clear the area search and select
their matching state; its nav and View all reset to All statuses. Each list shows
the matching count within its loaded records. Filtering does not change the
overview's scope. Navigation does not make another application read.

Loading or failed reads display an unknown count and clear the preceding list.
Successful empty reads display zero. A refresh sequence and session generation
reject older responses. Application refresh/filter changes also invalidate pending
profile reads. Sign-out clears list data, coverage, filters and the office tooltip.
No backend query, permissions, release parameter, provider setup, send or source
write is changed.

November 6, 2026 verification:

- All 631 local site/tooling/analytics tests pass. Nine new integration/markup
  tests run the three real controllers together with synthetic records: 50/51
  application and 100/101 opportunity candidate sets, two offices, matching
  filters/counts, unknown versus zero, failure, overlapping refreshes, late profile
  responses and sign-out followed by a new session. The normal quality wrapper
  includes the new suite.
- Workforce/Primetime asset checks, unchanged performance budgets, JavaScript
  syntax and repository audit pass. The local dependency junction does not
  provide a full production/PDF build; the normal Linux PR workflow does that.
  The first site CI run caught the Careers page's stale shared-script hash. The
  workforce builder now covers that page as well as the two private entries,
  with a regression for an independently stale Careers reference.
- A separate loopback-only Chrome preview used synthetic records and blocked all
  network connections/API writes. Native observation verified overview limits,
  25-of-50 submitted and draft lists, All statuses returning 50-of-50, the
  50-of-100 review pipeline and sign-out clearing the workspace. The tab and
  preview server were closed. No responsive/assistive-technology matrix, real
  identity, live persistence or production acceptance is claimed.

This is bounded implementation in draft PR #11. Deployment, actual users,
provider-return acceptance, grant-revocation/emulator checks, clinical/M03 access
and the applicant/document collection gates remain under their existing review.
