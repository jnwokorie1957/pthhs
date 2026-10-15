# Live HHA read-only release — October 14, 2026

The owner requested actual HHA visit records and a live overview at
`https://pthhs.net/primetime`, including DEV-006, DEV-007 and DEV-009.

## Authenticated production evidence

- **DEV-006:** the owner completed normal email-link sign-in. The workspace
  appeared only after the protected server session check accepted the account.
- **DEV-007:** protected owner controls and integration health loaded from the
  default Firestore database. A read preference was saved and reloaded through
  the authenticated API. The HHA reference request also exercised the shared
  persistent request budget.
- **DEV-009:** the protected backend `GetCollectionStatus` request returned the
  expected successful operation and `hhaConnection: reachable`. The live UI
  reported **Reference API reachable**. This establishes acceptance of this
  reference read; visit-read entitlement is checked separately.

No administrator credentials were minted for testing. HHA credentials remain in
the backend secret binding. Evidence records contain no bearer tokens, SOAP
payloads, patient names or patient-level records.

## Overview behavior

Live mode is the default; Demo requires an explicit selection. The overview and
Visit Preview share office, service date, source page, refresh and pagination.
Every chart uses only the returned source records. It shows visit identifiers
returned by search, readable details, separate scheduled/actual/EVV source time
windows, field availability, caregiver assignment fields and evidence gaps.
Unavailable detail rows are excluded from field counts. Loading, scope changes,
sign-out and errors clear previous source values.

The vendor search has no documented pagination or coverage marker. Search results
are bounded at 200 identifiers; detail pages are bounded at 10. Displayed counts
describe that search or page, with truncation and unavailable details disclosed.
They do not assert office-wide totals, payroll/billing readiness, verified EVV
exceptions, staffing eligibility or message delivery.

Timelines accept the documented `YYYY-MM-DD HH:MM` source format and ISO-shaped
values, retain the original strings, and do not convert timezones. Cross-day,
reversed or mixed-offset intervals remain text rather than misleading bars. SVG
geometry respects the deployed `style-src 'self'` security policy.

## Verification

Local verification before combining the concurrent release: 369 backend tests,
105 frontend tests, generated-asset consistency, and browser rendering under the
production CSP. Desktop and mobile layouts showed no horizontal overflow or
console errors. Synthetic browser fixtures exercised populated, empty and failed
responses, including removal of previous chart bars after a source failure.

Production visit-read acceptance and the final release/CI references are recorded
after deployment; synthetic fixtures are not production visit evidence.
