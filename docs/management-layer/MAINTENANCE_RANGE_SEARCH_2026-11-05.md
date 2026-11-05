# Maintenance range search, profiles and reason staging

The owner requested inclusive date ranges, HHA-style patient/member and caregiver
name fields, payer filtering, usable visit actions and source reason/action choices.

## Implementation

- From/To dates support 1–366 inclusive days, using native `SearchVisitsV2`
  `StartDate`/`EndDate` filters. There is no five-day UI limit. The existing single-day
  full-office cache remains available through Refresh workspace. Native source
  limits, truncation, partial reads, retry delays and checked-ID progress remain
  explicit; a source page is not a complete office census.
- Patient/member and caregiver have separate first/last-name inputs plus admission
  ID or caregiver code. Native name lookups return bounded, office-checked choices;
  select the correct identity before searching its visits. A known source visit
  also offers Use this patient/caregiver in range search without a new lookup.
- Payer/contract choices come from the office's active `GetContracts` catalog.
  Filtering checks `GetScheduleInfo` primary/secondary bill-to contract IDs on
  each source visit. It never substitutes the patient's current profile payer.
  An empty schedule read falls back to approved V2/legacy visit-billing reads.
  Generic schedule reads stay closed; this lookup first proves the visit/office.
  Empty billing evidence and source truncation are disclosed, not counted as a
  proved nonmatch or complete filtered census.
- Range rows include source-derived names and actual service dates. They retain
  server-only evidence receipts in `maintenanceSearchEvidence`, bound to current
  office/settings and limited to 15 minutes for a new review save. Existing
  single-day source receipts remain supported. A row is saved under its actual
  service date, not the range's first day. No browser-scraped import is used.
- Clicking a source row opens its office case and explicit Back to visit queue
  action. Metric cards now apply their corresponding queue filter. Loaded rows
  remain selectable during a slow read. Private requests have deadlines; stalled
  requests cannot leave all controls locked indefinitely. A per-visit case read
  uses POST, with private IDs outside URL parameters.
- Read caregiver calls can start the local office review directly. An unassigned
  caregiver does not prevent an administrative follow-up note; actual call reads
  still require an identified source caregiver. All cases remain `not_submitted`.

## Reason/action read review and controls

`GetVisitEditReasonActionTaken` remains guide-absent and blocked for generic calls.
The published ENT WSDL establishes its read request, exact VisitId field and SOAP
action. A narrow internal `visit_reason_review` context permits this read only
after the dedicated service proves the visit, current patient/office membership,
date and caregiver context, and after the owner enables the specific read.
Settings offer that scoped candidate; they do not enable it automatically.

The existing typed `visitEditReasons` projection is reused, preserving each
reason's associated actions, descriptions and raw statuses. No split of flattened
labels, guessed active status, invented code or schedule/billing-code substitution
is used. Selections must come from the retained, fresh visit-scoped catalog and
match each other. The selected IDs and note can be staged in a local office
review and its history. A source-empty catalog remains empty.

`ConfirmVisits`, `ConfirmVisitsV2`, `ConfirmVisitsEVV` and `VisitCallInOut` retain
their original contract gates, including when passed the read-review context.
Submit to HHA is explicitly unavailable. The current API guide/WSDL do not prove
the existing-event linkage, preservation/omission semantics, write entitlement,
conflict behavior or independent confirmation readback. No clinical source write,
manual clock creation or AI execution is implemented or claimed by this delivery.

Native SearchPatients/SearchCaregivers are restricted to the internal
`maintenance_people_search` flow. IDs from the unscoped vendor search are resolved
to profiles and office-checked before returning a choice. Generic workbench calls
cannot use the newly enabled method to expose unchecked cross-office results.

Five read permissions need the owner's concrete action-time decision after
deployment: SearchPatients, SearchCaregivers, GetContracts, GetScheduleInfo and the scoped
GetVisitEditReasonActionTaken staging read. Existing selected reads are preserved.
No permission was enabled by the source changes. Activating reads changes settings
revision and invalidates prior cache/evidence context; use the native range search
for fresh, usable source rows while the office-day collector rebuilds its cache.

## Source references

- [Official visit-maintenance workflow](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Visit/Visit-N-Visit-Maintenance-S.htm)
- [Official manual confirmation workflows](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/Visit/Visit-N-Manually-Confirm-Visits-S.htm)
- [Published ENT service metadata](https://implementation.hhaexchange.com/Integration/ENT/V1.8/ws.asmx)
- [Current public Texas integration specification](https://knowledge.hhaexchange.com/edi/Content/Documentation/EDI/API-Texas-EVV-Data-Aggregator-Specs-P.htm)

Read November 5, 2026. UI workflow documentation does not establish a supported
Enterprise confirmation API contract. The retained resource packet and prepared
vendor questions remain relevant; no communication was sent.

## Validation and release

Synthetic tests cover range endpoints beyond five days, XML escaping and name/code
fields, office/context proof, private evidence freshness, exact payer matching,
partial source progress/cursor binding, case opening without creation, source
reason/action selection and stale/foreign-code rejection. Browser tests cover
clickable rows during stalled reads, timeouts, historical service-date saves,
typed reason/action staging, lookup identity choices, deferred continuation and
private-result fencing. No test makes an HHA clinical/financial change.

Protected assets measure approximately 488 KB raw / 124 KB Node gzip across 16
files. The reviewed allowance is 490000 / 125000 bytes; 110000 per-file and the
separate marketing limits are unchanged. No runtime dependency was added.

Production acceptance and permission decision: pending normal release.
