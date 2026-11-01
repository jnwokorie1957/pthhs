# Call-review context — November 1, 2026

The call-review result identified its source/day but omitted the selected visit
and subject/office filters. Its browser projection also discarded the already
validated patient-office check receipt. That made independently queried source
attempts harder to trace while reviewing multiple visits on the same day.

The existing administrator EVV call reader now displays the selected visit
context and exact patient/caregiver/office/service-day query filters separately
from the returned raw event identifiers. Its unchanged server scope validation
binds the response to that selection; it does not establish that an event belongs
to that visit. The no-supplied-visit-ID and incomplete-history labels remain.
Even numerically equal visit/event IDs cannot establish a relationship.

Existing GetCallDashBoardData `fetchedAt` and patient-office proof
`membershipCheckedAt` now display as Call read and Office check. These separate
fetch receipts do not claim source modification, service time or an atomic
snapshot. Both use the existing valid-calendar/explicit-timezone receipt helper;
previous Date.parse checks could accept a bare date or floating wall time.
Missing/invalid receipts reject the result, and replacement/Clear/date/Demo/
session changes retain their existing cleanup and late-response fences.

Three regressions fail against the old module and pass after: strict receipt
retention/ambiguous timestamps; empty result context/filters/receipts and Clear;
and two same-subject/day selections with equal event/visit IDs plus a late prior
response. All351frontend/tooling checks pass, including asset budgets; generated
output is11files/374805bytes. Backend/source/permissions are unchanged, so the
unchanged backend suite was not repeated locally. The normal release still runs
its backend controls. No extra API calls, source writes or new role grants.

Normal release and native production acceptance are pending. Malformed/late/
multiple-selection cases remain synthetic unless separately exercised. The
patient/staff/PT/office research connection is bounded to the administrator UI;
P1-B/P2 external role contracts and E04 source retention/visit linkage remain open.
