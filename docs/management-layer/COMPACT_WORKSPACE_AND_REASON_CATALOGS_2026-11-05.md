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

November 6 00:31 UTC research reconciliation: runtime
`386708a9081b08c340d415bb38af97c94699103e` completed
[normal release 42119344430](https://github.com/jnwokorie1957/pthhs/actions/runs/42119344430)
with all four jobs successful. This supersedes the earlier pending-release
checkpoint. Signed-in compact-control/reference and keyboard/assistive-technology
acceptance remain open; later independent billing-source acceptance does not
close those UI checks. No repeated deployment or source trial was performed by
this reconciliation.

## Primary references

- [ENT service and WSDL](https://implementation.hhaexchange.com/Integration/ENT/V1.8/ws.asmx)
- [HHA provider reference and schedule/visit interface](https://knowledge.hhaexchange.com/edi/Content/Documentation/EDI/API-Texas-EVV-Data-Aggregator-Specs-P.htm)
- [HHA Visit Maintenance](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Visit/Visit-N-Visit-Maintenance-S.htm)

Reviewed November 5, 2026. Current source action questions remain in the prepared,
unsent [vendor question packet](evv-maintenance-resources/HHA_SUPPORT_QUESTIONS.txt).
