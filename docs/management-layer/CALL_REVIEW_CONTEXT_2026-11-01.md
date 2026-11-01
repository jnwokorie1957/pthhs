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

## Bounded production acceptance

Normal workflow41353869240 passed all three jobs: Hosting21:48:50UTC,
backend21:49:14UTC and website analytics21:50:18UTC, November1. At21:50:11UTC,
12exact app artifacts and8anonymous JSON401/no-store boundaries passed. A normal
reload changed the existing tab's dashboard bundle from a9c81a12b0d2 to1e9b063c2f5b.

Two explicit current-day call queries were exercised. The first result was
refused with the existing patient/caregiver mismatch message; no event fields,
context or receipts were shown. This does not prove another patient's records
were returned: missing/unsupported subject evidence can also fail that check.
Request filter names/order still match the captured WSDL; no validation was
weakened and that context was not queried again.

The second authorized visit query succeeded with0events. In-page comparisons
verified selected visit, patient/caregiver/office/day filters and both valid,
distinct receipts against the visible selection. Call read21:52:24.949Z and
Office check21:52:24.642Z stayed separate. Age, no-source-visit-ID, bounded-history
and empty-result uncertainty labels remained. Desktop width1265px had no page
horizontal overflow. No private identifiers or event values were exported.

Source Clear removed the context and receipts. Resume restored current-day
Overview/live feed with10readable rows at21:53:43UTC. Same-subject/day concurrent
responses, equal cross-namespace IDs, malformed receipts and revocation variants
remain synthetic; mobile geometry was not exercised in this pass.

E04 remains open. The refused query selected the first visit on the current
office November1 first source page at approximately21:50-21:51UTC; the successful
query selected the next row. For the refused context, the next protected owner/vendor
review must compare requested patient/caregiver/office/day filters with returned
subject proof and supported Patient/ID and Caregiver/ID field paths, along with
retained date/status coverage and visit linkage. Preserve private examples in
the protected source workflow. Do not suppress mismatches, filter foreign rows
into apparent success, broaden access or infer that an empty response proves no
original punch. Existing external-role/clinical/document contracts remain open.
