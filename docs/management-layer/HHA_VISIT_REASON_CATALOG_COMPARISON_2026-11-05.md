# HHA visit reason/action catalog comparison

Observed November 5, 2026, America/Chicago. The exact-visit API receipt is
2026-11-06T05:36:07.058Z (November 5, 11:36 PM CST). This is source investigation,
not production acceptance of HHA confirmation.

## Signed-in workflow

The connected HHA Visit Maintenance page is authenticated. Its hidden Advanced
Filters > Coordinator selection was DEFAULT, which returned no visits for both
the current day and October 24. Removing that query filter returned visits.
The selected October 24 visit's View/Edit Visit Details window embeds the legacy
application. After the owner completed its separate login, reopening the same
window displayed the actual Non-Skilled Visit form. The sign-in dependency from
the earlier compact-workspace report is resolved for this session.

No visit was saved or reprocessed. Two reason selections were used only to inspect
dependent choices, then restored to Select and the window closed without Save.
No clock, reason, action, note, reference-table value or verification was changed.

## Catalogs observed

| Source surface | Observed result | Comparison |
|---|---|---|
| Selected visit > Visit Info > EVV Reason Code Number / Reason Code | 28 choices, excluding Select | Every label matches the generic schedule/billing API list; zero internal IDs match |
| Selected visit > Action Taken | Five choices after selecting a reason | The same five IDs/labels appeared for the two inspected reasons; applicability for all other reasons was not tested |
| Admin > Reference Table Management > Visit Edit Reason | 79 results; first page of 50 inspected | All 28 visit labels occur on this page, but none of their displayed reference IDs matches the visit form's IDs |
| Admin > Reference Table Management > Visit Edit Action Taken | Seven active results | All five visit action labels occur here, but none of their internal record IDs matches the visit form's IDs |
| Admin > Reference Table Management > Schedule/Bill Info Edit Reason | 31 results, 28 active | All 28 live GetScheduleBillInfoEditReasons IDs match this table |

The selected visit's reason-option metadata marks two reasons as requiring a
note. All 28 options carry a minimum-character value of zero. This records DOM
metadata only; save-time validations, program rules and free-text policy were
not tested or inferred. The inspected agency reason editor exposes label,
description, note requirement, minimum count and status; it does not expose an
external/export code field. No editor values were changed.

These observations establish separate catalog IDs despite identical labels.
They do not establish a safe transformation between IDs. Payer/program scoping
is a possible explanation, not a proven diagnosis of the empty SOAP result.
HHA documents payer-specific note requirements and provider/payer distinctions
for some visit fields in [Enter Schedule/Billing Visit Notes](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Patient/Pat-N-Enter-Schedule-Billing-P.htm).

## Exact-visit API check

Using the existing provider credentials in memory and shared read limiter:

1. Proved the UI's exact visit and patient through GetVisitInfoV3 and
   GetPatientDemographics, including selected office membership and service date.
2. Read the approved GetVisitEditReasonActionTaken method for that same visit:
   HTTP 200, application Success, zero typed reasons, no truncation.
3. Independently read GetScheduleBillInfoEditReasons: 28 records, all 28 labels
   match the visit form, and zero IDs match the visit form.
4. Rechecked workspace context after the reads. No source identifiers, catalog
   IDs/values, credentials or raw SOAP were added to repository evidence.

The visit-read correlation is ff6771bd-87db-4f8b-8905-6a02f37e7c3e. It can be used
with the receipt time for private vendor investigation; affected record identifiers
must be provided separately through an approved support channel.

Two supplemental missed-visit V2 candidates stopped at the existing local
vendor-contract gate before any vendor request. They were not tested vendor
responses and no production permission or gate was changed. The transient private
comparison input was consumed and deleted before the diagnostic source calls.

## What remains required

- Obtain the supported lookup for active, applicable Visit Edit Reason and
  Action Taken choices for this exact tenant/visit/program, including note rules.
- Have HHA explain whether GetVisitEditReasonActionTaken returns available
  choices, already-applied evidence, or an unsupported result for this interface.
- Establish which values its supported confirmation method expects. Do not
  substitute schedule/billing or missed-visit IDs, infer eligibility from label
  equality, or hardcode web-form IDs into the live feed.
- Establish the supported genuine-event linkage, preservation/omission,
  entitlement, idempotency and independent confirmation readback contract before
  implementing or enabling source submissions.

The [vendor question packet](evv-maintenance-resources/HHA_SUPPORT_QUESTIONS.txt)
contains the narrowed issue and remains unsent. The owner does not need another
sign-in request while this authenticated session remains usable.

No runtime change or deployment was justified by these source results. Existing
Primetime private office reviews remain available. Actual HHA verification and
confirmation remain disabled and unverified; M02 stays open.

## Primary references

- [Visit Maintenance workflow](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Visit/Visit-N-Visit-Maintenance-S.htm)
- [Manual confirmation workflow](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Visit/Visit-N-Manually-Confirm-Visits-S.htm)
- [Published ENT method shapes](https://implementation.hhaexchange.com/Integration/ENT/V1.8/ws.asmx)

The first two references describe UI workflows. Method shapes alone do not prove
that the current credentials support the intended source action.
