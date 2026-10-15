# Connected patient authorization evidence acceptance

The October 15, 2026, 19:16 UTC dashboard pass implemented researched P1-D.
Release `e4dc5aedeb12ccd40684a3cb4e3475538669ebfd` passed both jobs in normal
GitHub/Firebase workflow `38793693059`. This report contains no private source
identifiers, labels or payloads.

## Implemented behavior

Readable live Overview and Visit Preview rows offer **Open patient
authorizations** for an exact numeric patient ID. Selection clears previous
query fields/results and opens the existing discovery operation. The user
explicitly chooses **Read source records**; selection does not fetch or enable
permissions.

The UI sends discovery/detail requests through the protected administrator
`/workspace/patient-authorizations` POST read route. It accepts only those two
operations and explicit identifiers. It checks release approval, selected office
and the existing demographic/target-read permissions before source dispatch,
re-reads current patient/office membership, and checks settings between reads and
before returning. Detail responses must uniquely match authorization/patient
IDs; a selected discovery contract must still match. Existing source-query
transport limits, vendor gates and read audit behavior remain in place.

Discovery retains exact IDs, dates, fetched time and truncation. Duplicate
authorization IDs or invalid authorization/contract IDs do not offer selection.
Same-name records remain distinct by ID. Detail selection carries patient,
authorization and contract context, clears the discovery view and preserves the
existing detail-read gate. Editing query inputs clears prior evidence and fences
pending responses/errors and detached detail controls.

Raw detail values remain source strings: blank, unavailable, zero and negative
values are not normalized into balances. The UI explicitly leaves unit
conversion, balance period, usage basis and limits unvalidated. There is no
remaining-hours chart, eligibility verdict, utilization calculation, billing
decision, HHA mutation or durable source import in this change. External roles
and supervisor/office investigation isolation are not released by these links.

## Validation and limits

- All 157 frontend and 464 backend tests passed. Six new frontend and eight new
  backend tests cover discovery/detail targeting, duplicate names/IDs, unknown
  values, truncation, cross-patient races, access gates, current-office/source
  identity checks, policy changes and route method/input restrictions.
- TypeScript compilation, generated-asset freshness, whitespace and repository
  audit checks passed. The normal release workflow also ran its full checks.
- Production restored the ordinary approved session after reload with Demo off.
  Overview and Visit Preview selected the same exact patient. The server-checked
  discovery read returned 12 authorization rows and 12 detail selectors, with
  source freshness and unvalidated-basis disclosure. No independent assertion of
  complete authorization/business coverage is made.
- A real row selected the exact authorization and patient. The detail permission
  was disabled; its explicit read remained blocked with the owner-enablement
  message and no detail records. No permission was changed. Raw-detail and
  contract-change acceptance is synthetic until approved detail access exists.
- Independently rechecked live source pages: first ten readable visits, then ten
  different readable visits, then the identical first page on Previous. All six
  field-presence chart values and denominators matched the visible source rows
  on the first two pages. Return-page chart values matched again. Source IDs
  were compared in memory only. The pages retained partial, on-demand and
  source-unvalidated labels and did not advance an import history.
- Served dashboard/workspace JavaScript matched tested artifacts. Anonymous
  session/new-route requests returned 401; private admin noindex headers stayed
  present. No new calendar capture was possible: HHA browser remained on normal
  login. No new import or source write occurred.

Query identifiers/results were cleared after acceptance. A fresh screenshot of
the cleared query form is kept only in the task outputs. The first capture
lagged a UI frame; the saved deliverable was replaced and visually verified.

## Next actions

Owner: review `GetPatientAuthorizationInfo` entitlement and enable it in normal
owner controls only if approved. Then validate representative returned fields
against source labels, period and contract allocation settings using existing
approved rules; keep private mappings in protected acceptance evidence. This
does not reopen already completed policy decisions or authorize calculations
without evidence. Normal HHA sign-in is needed for further browser capture.

Next independent developer work, P1-E: link a saved calendar's exact visit ID to
current visit evidence with server-verified patient/office identity, preserving
the snapshot and its dated provenance. Do not infer current membership from a
historical tile alone. P1-B legacy investigation scope/identity migration and
external patient/family/clinician prerequisites remain separate.
