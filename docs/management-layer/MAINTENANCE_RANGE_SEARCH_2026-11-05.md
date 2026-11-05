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

Five read permissions received the owner's explicit decision after
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

## November 5 production acceptance

Initial runtime [1083e6f](https://github.com/jnwokorie1957/pthhs/commit/1083e6f9077a398b3849d22aa080d9f529bcbe02)
passed all four jobs in [42108212755](https://github.com/jnwokorie1957/pthhs/actions/runs/42108212755).
All 16 deployed assets matched local bytes. Six new API paths reject anonymous
requests with 401 JSON, no-store and noindex protections. Local suites passed
771 backend and 555 frontend/tooling tests before the initial release.

Signed-in acceptance read October 23 through November 5 for one source-selected
patient: all 14 returned IDs checked, 14 readable matching visits, no unavailable
details or truncated discovery. This is one tested query, not the entire office
history. October 23 and October 24 are visibly present. Native source read limits
paused partial prefixes; continuation preserved rows and reached completion.
Opening a historical row, returning to the queue and desktop/narrow layouts
(1425px and 465px, no horizontal overflow) worked. A neutral, explicitly labelled
connectivity office case was retained under its historical date; no clinical
determination, call/time change or HHA confirmation was made.

The owner approved all five scoped reads. Normal owner-form save and reload
confirmed 18 selected reads, preserving the previous 13. Patient first/last name
plus admission lookup and caregiver first/last name plus code lookup each returned
one office-checked source profile. GetContracts returned 48 office contracts.
No write workflow gained release approval.

An independent approved V2 billing read proved the exact selected visit, patient,
date and primary contract. Its unused secondary contract was literally zero.
The initial payer filter rejected that non-reference. The follow-up ignores only
zero/empty references, keeps positive primary/secondary IDs, discloses absent
usable evidence and preserves all subject/office/date checks. Matching and
zero-only fixtures cover this repair. Production payer retest passes below.

The scoped reason read succeeded at 21:16:26.248Z with no typed reason/action
choices. No choice or meaning was invented. Follow-up UI explicitly explains this
empty catalog, and parsing rejects an unrecognized wrapper containing legacy
reason records instead of silently treating it as empty. Synthetic nonempty
catalog staging is tested; a real nonempty catalog and real-code staging are not
accepted. Source/vendor follow-up must establish the applicable reason/action
catalog for the exact payer/visit and the supported confirmation/link/readback
contract. Prepared vendor questions remain unsent. HHA source submission stays
disabled; this delivery does not complete M02 or restricted staff-account access.

Follow-up runtime [d2d4043](https://github.com/jnwokorie1957/pthhs/commit/d2d4043426d1fe907cb3cfa117b6652bfa1b7307)
passed all four normal jobs in [42112469469](https://github.com/jnwokorie1957/pthhs/actions/runs/42112469469).
Both changed assets match production exactly. The exact independently read source
contract now yields one matching visit, with 1/1 IDs checked, complete/no unavailable
details. A different catalog contract (ruled out by the independent primary/zero
secondary record) yields zero matches, again complete 1/1/no unavailable details.
The fresh guarded reason read at 21:29:49.890Z succeeds with zero choices and the
explicit no-code-can-be-staged message. Actual HHA submission remains disabled.
Final backend suite: 773 pass. Frontend regression, asset/budget and normal build
checks pass; the preceding full frontend/tooling suite had 556 pass. Assets are
488956 raw / 123752 gzip bytes across 16 files, within reviewed limits.
The current-day office queue was restored with private filters cleared; its new
settings-bound collection is still partial while the background collector rebuilds.
No complete office-day census is claimed for that restored display.
