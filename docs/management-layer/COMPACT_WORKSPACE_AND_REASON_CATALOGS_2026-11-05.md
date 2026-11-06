# Compact workspace and HHA reason references

The owner requested less information on screen at once and continued investigation
of the reason codes needed for HHA-style maintenance and confirmation.

## Source investigation

Using the existing provider credentials in memory, a known protected office case,
fresh visit/patient/office proof and the existing shared vendor-call budget:

- A fresh `GetVisitEditReasonActionTaken` request succeeded at
  2026-11-05T21:40:11.533Z. Inspection of the actual SOAP structure found the result
  and an explicitly empty `VisitEditReasonActionTaken` container, with no
  `VisitEditReasonInfo` elements. Both legacy and typed projections returned zero.
  This establishes an empty source response for this request, not a UI/parser loss.
- Owner-directed reference investigation found 28 `GetScheduleBillInfoEditReasons`,
  22 `GetMissedVisitReasons` and 17 `GetMissedVisitActionTaken` records. All three
  reads succeeded without truncation. They are agency reference lists, not proof
  that their IDs are applicable to a selected EVV visit or confirmation action.
- No patient/staff identifiers, raw SOAP, credentials or catalog values were saved
  in repository evidence. No HHA mutation or vendor communication was made.

The published ENT WSDL defines separate visit-specific, schedule/billing and
missed-visit interfaces. It exposes confirmation request fields but does not
establish preservation/omission semantics, authoritative existing-event linkage,
tenant write entitlement or independent confirmation readback. Existing source
write gates remain unchanged. Original HHA UI comparison is waiting for a connected
signed-in maintenance page; an HHA sign-in tab was opened for the owner.

## Implementation

- Maintenance starts with service dates and one search-method choice: all visits,
  patient/member or caregiver. Only that person's fields appear. Changing methods
  clears the previous identity and names; hidden fields never constrain a request.
  Patient/caregiver modes require a resolved office-checked source identity.
- Payer filtering, loaded-record filters and reason references are closed sections.
  Known-source person shortcuts select and reveal the matching search method.
- Selected visits initially show time evidence. Call history and the office review
  form open separately, and the opened section survives a source read/save.
- Secondary Overview cards and operational-tool menus are collapsible. Advanced
  tool forms open individually; programmatic workflow navigation reveals its
  section before focusing the existing control. Form upload is also optional.
- The protected administrator reference endpoint reads one selected catalog on
  demand, checks deployment and owner-read permissions, validates source identity
  and IDs and rejects office/settings changes. It preserves descriptions, raw
  statuses and note constraints without interpreting them as an approval policy.
  Reference codes cannot be submitted as a visit-specific pair through this path.

No account role, clinical rule, HHA confirmation dispatch or AI execution is added.

## Validation and release

Initial checks: 776 backend and 558 frontend/tooling tests pass. Added coverage
checks hidden identity leakage, required identity selection, reference-only output,
clearing, release/owner gates, concurrent context changes and malformed IDs.
A focused native-style iterable regression preserves an opened review across
source refreshes without relying on Array methods on browser NodeLists.

The reviewed private-asset allowance is 500000 raw / 128000 gzip bytes for the new
disclosure module and reference reader. Per-file 110000-byte and separate marketing
limits are unchanged. No runtime dependency was added.

November 6 00:31 UTC research checkpoint confirmed the initial four-job release
and left native UI acceptance to the owning workstream. The bounded native
checks below supply that follow-up. Comprehensive keyboard and assistive-technology
acceptance remains open; independent billing checks do not close it.

## Production acceptance (November 5, America/Chicago)

Initial [386708a](https://github.com/jnwokorie1957/pthhs/commit/386708a9081b08c340d415bb38af97c94699103e)
passed all four jobs in [42119344430](https://github.com/jnwokorie1957/pthhs/actions/runs/42119344430).
Seventeen production assets matched local bytes; the reference endpoint rejects
anonymous reads with 401 JSON, no-store and noindex. Existing administrator source
preferences now contain 21 reads: the previous 18 plus the three generic agency
reference methods. Save/reload confirmed them; no patient-record method, account
role or source-write release flag was added by this activation.

Production catalog reads returned all 28 schedule/billing edit reasons, 22 missed
reasons and 17 missed actions, without truncation. The visible receipts identify
their method and fetch time and state that applicability to a selected visit is
not verified. Each code's details open separately. Changing catalog or leaving the
workspace clears the prior list. These are live API reads, not a scraped import.

Desktop and narrow (1425px/465px) checks show one selected person form, clear
previous identity on method change, no horizontal overflow, and closed payer,
loaded-filter and reference sections in the default view. The Overview patient
shortcut selects and reveals patient search in Maintenance. Thirty-four optional
sections are folded across the dashboard. Selected visits begin with call/review
sections closed; opening the review reveals its fields. No test saved a clinical
determination or submitted an HHA action.

Production testing found the shared read form was being redocked outside its new
folded body. Follow-up [41706cb](https://github.com/jnwokorie1957/pthhs/commit/41706cb7774affc4e928fe67aefbcf0df3c50e3a)
fixes that lifecycle and adds a visible reference-read progress message. All four
normal jobs in [42136241135](https://github.com/jnwokorie1957/pthhs/actions/runs/42136241135)
passed. The three changed assets match production exactly. A regression and 272
connected/docking tests pass. Native testing confirms one tool open: the shared
source form is hidden inside its closed section while the selected creation form
is visible. Concurrent billing-read and article releases were preserved.

Private assets after the docking release: 17 files, 496170 raw / 125778 gzip bytes. Default Maintenance
and clear private filters were restored; the observed office-day queue returned
639 loaded source visits. This does not establish clinical verification or vendor
census completeness beyond the source's returned IDs.

## Fresh review from an older office-day cache

[86b6902](https://github.com/jnwokorie1957/pthhs/commit/86b69022fccd15b6697f163a2102e3571b571698)
adds a selected-visit action, “Read fresh HHA visits for this patient/day.” All four
normal jobs in [42139256792](https://github.com/jnwokorie1957/pthhs/actions/runs/42139256792)
passed. It uses the existing protected patient/day search, exact office membership
checks and trusted review receipts. Cached office-day records retain their original
timestamps; stale-cache guards are unchanged. A backend regression verifies fresh
direct-source evidence permits a local review while an unproved stale cache does
not. The focused service, maintenance and search checks pass (38 tests).

Native production testing started with an older office-day cache, selected an
existing saved case and read one of one returned patient/day visit IDs. The source
row opened, and a neutral connectivity note saved with source receipt/audit history.
The existing local status, queue and proposed action were preserved. The UI reported
that no HHA confirmation or clock change was submitted. This tests a private local
review only, not a clinical determination or source action.

Testing found an active saved-case filter could hide a fresh result. Follow-up
[7d59869](https://github.com/jnwokorie1957/pthhs/commit/7d59869857170008156c7814d7bea4c60d1753c4)
clears loaded-visit and free-text filters alongside unrelated payer/caregiver
filters for this shortcut. The 10-test search regression passes. Final private
assets are 17 files, 497177 raw / 126066 gzip bytes, within unchanged reviewed limits.
All four normal jobs in [42140143518](https://github.com/jnwokorie1957/pthhs/actions/runs/42140143518)
passed. Three changed production assets match local bytes exactly. A native rerun
from the active saved-case filter confirms the shortcut selects patient mode, uses
one service day, clears payer/free-text/loaded filters and displays the one fresh
matching row without another filter action. The row opens with call/review sections
closed and the previously saved neutral note remains in its private history after
reload. The generic reason catalogs and source confirmation boundary are unchanged.

## Remaining confirmation dependency

Three further source-identified, office/date-checked November 5 visits were read
at 22:14:39.886Z, 22:14:43.073Z and 22:14:47.074Z. Each visit-specific reason read
succeeded with zero reasons and no truncation. Together with the raw historical
response, this rules out an isolated UI-empty list for those tested requests; it
does not prove why the agency/program source returns no choices.

The owner's connected private companion guide (two pages) and API specification
(244 pages) were inspected in memory. Neither documents the named confirmation
operations. An exact-method mail search found no further matching instructions.
Public method help supplies SOAP placeholders only. No credentials, private guide
bytes or email contents were copied into this repository or research evidence.

HHA must establish whether the visit-specific interface returns applicable choices
or applied evidence, which reference IDs map to confirmation ReasonCode/ActionCode,
and the supported preservation, entitlement, genuine-event linkage and independent
readback contract. A signed-in original HHA maintenance screen is still needed for
comparison: the retained tab remains at Log In. It is open for the owner's direct
sign-in. The prepared technical question packet is updated but unsent.

Actual HHA verification/confirmation remains unimplemented and unaccepted. M02
stays open; live reference-code availability is not clinical submission approval.

## Primary references

- [ENT service and WSDL](https://implementation.hhaexchange.com/Integration/ENT/V1.8/ws.asmx)
- [HHA provider reference and schedule/visit interface](https://knowledge.hhaexchange.com/edi/Content/Documentation/EDI/API-Texas-EVV-Data-Aggregator-Specs-P.htm)
- [HHA Visit Maintenance](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Visit/Visit-N-Visit-Maintenance-S.htm)

Reviewed November 5, 2026. Current source action questions remain in the prepared,
unsent [vendor question packet](evv-maintenance-resources/HHA_SUPPORT_QUESTIONS.txt).
