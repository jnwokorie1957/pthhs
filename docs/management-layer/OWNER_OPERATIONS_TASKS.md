# PTHHS Management Layer — Owner / Operations Checklist

> **Primary owner:** PTHHS Owner / Operations Lead
>
> **Purpose:** Define how PTHHS actually operates so the developer can implement the correct management, EVV, billing, staffing, compliance, and escalation rules. This is a decision checklist, not a coding checklist.

## How this checklist is used

- `[x]` = completed and explicitly confirmed by the owner or verified from repository/runtime evidence.
- `[ ]` = pending or only partially defined.
- The developer must not invent an operational rule to make progress.
- Use de-identified examples in repository documentation.
- When an owner item becomes complete, update this file and the root `README.md` checkpoint together.

## Start here

- [`DEVELOPER_TASKS.md`](./DEVELOPER_TASKS.md) — technical implementation/checkpoint tracker.
- [`../../hharefs/endpoints.html`](../../hharefs/endpoints.html) — HHA capability map.
- [`../../hharefs/hha-wdsl.xml`](../../hharefs/hha-wdsl.xml) — exact HHA SOAP contract.

---

# Current owner checkpoint

## October 20 source-status labels

The Live badge now distinguishes access checking, unavailable access, a required
service date and a refresh-required result. Prior returned-source labels no
longer remain after these transitions. Local synthetic checks and the October 21
00:38 UTC heartbeat's normal access-check, missing-date, retry/paging and clear
checks passed. Error/revocation cases remain synthetic. This adds no interpretation
or operational decision. See [verification](SOURCE_STATUS_LABELS_ACCEPTANCE_2026-10-20.md).

## October 20 visit discovery and parser verification

The source returned a discovery exceeding the old 200-ID projection cap. The
first two ten-detail pages and return to the first page passed chart and exact-ID
comparisons. This is received search evidence, not complete office coverage or a
persisted import; offsets beyond 200 and malformed responses remain synthetic
checks. Normal release jobs passed. Preview is left cleared, with automatic age
updates on. HHA sign-in and representative source/office/identity/unit/period/
discipline/document validation remain open. See
[acceptance](VISIT_DISCOVERY_ACCEPTANCE_2026-10-20.md).

## October 20 automatic age display control

Automatic age updates can now be paused for the current page session. The
display identifies paused values; resume recalculates from the same original
fetch receipts. Explicit new reads show an initial age even while paused.
Clearing or changing context still removes evidence immediately. This changes
only the age display and adds no operational freshness rule or source request.
Local tests and synthetic keyboard/layout checks passed. Both normal jobs and
the 17:16 UTC heartbeat's authenticated pause/hold/resume/minute-tick, current
visit, paging/chart and clear checks passed. Automatic updates are left on and
the source preview is cleared. Broader source interpretation and role acceptance
remain open; no new HHA capture/import occurred. See
[verification](AUTOMATIC_AGE_CONTROL_ACCEPTANCE_2026-10-20.md).

The 17:30 UTC [role research](ROLE_WORKFLOW_RESEARCH.txt) extends this reading
control contract to proposed patient, therapist and office screens: holding an
age display must not suppress an action result or imply a request, draft,
clinical review or billing state changed. This adds no operational rule or
role permission; the existing source/identity/sharing prerequisites remain.

## October 20 explicit source-preview clearing

Overview and Visit Preview now offer Clear source page. It removes the current
shared preview and age, including while a read is pending, keeps the selected day
and waits for Read source now. Saved imports remain stored separately; existing
source-linked history display may require reselection. This does not delete HHA
records, grant access or make a care/billing decision. All 227 frontend tests and
normal release/production clear/idle/reread/chart checks passed. See
[acceptance](SOURCE_PAGE_CLEAR_ACCEPTANCE_2026-10-20.md).

Next owner evidence action remains normal HHA sign-in for authorized read-only
source/office/identity/unit/period/discipline/document validation in protected
records. Read entitlement, P1-B and external account/assignment/sharing/form/
reviewer/signature prerequisites remain open; no new import occurred.

## October 20 02:49 UTC / October 19 local SEO and discovery links

Public SEO checks passed; both Search Console sitemap rows report Success and
27 discovered pages. Discovery is not indexing or outcome growth, and no repeat
submission occurred. Location evidence and comparable outcome measurement stay
open. See [SEO review](../seo/2026-10-20-seo-review.md).

P1-N prepares exact-patient care-plan/document discovery from live source controls,
retaining the existing owner-enablement message. No read, download, import, role
grant or source mutation was performed by selection. All 221 frontend tests and
normal release/production checks passed. See
[acceptance](PATIENT_DISCOVERY_LINKS_ACCEPTANCE_2026-10-20.md).

Next owner action remains normal HHA sign-in for protected representative source,
office/identity/unit/period/discipline/document validation. Review read entitlement
through existing controls when evidence supports it; no enablement was made for
acceptance. P1-B and external account/sharing/form/reviewer/signature gates remain.

## October 20 02:08 UTC / October 19 local document-link research

The [research](ROLE_WORKFLOW_RESEARCH.txt) separates duty-list POC tasks, attachment
origin/action evidence and clinical form/version/review state across proposed
patient, therapist and office screens. Existing administrator reads are building
blocks, not external-role or patient-office authorization. Implemented P1-N only
prepares exact-patient POC/document discovery under current gates; it adds no
automatic read, document access or clinical authority.

Next evidence action: sign in normally in the retained HHA tab for authorized
read-only review of a task POC, applicable clinical form/version and attachment
origins/actions. Validate reader/editor/reviewer/signer roles, office/visit/form
availability and patient/family sharing independently in protected acceptance
records. Do not enable permissions or change source records for this research.
Existing entitlement, P1-B and external role/form/signature prerequisites remain.

## October 20 UTC / October 19 local live-page fetch age

Live Overview and Visit Preview now show the same device-clock age beside the
original fetch receipt, clearing both immediately during refresh/paging/context
changes. A real age tick retained source rows/charts/scope/focus; fresh first/next/
previous and explicit-refresh pages matched all six chart calculations. All 217
frontend tests and both normal jobs passed. See
[acceptance](LIVE_PAGE_FETCH_AGE_ACCEPTANCE_2026-10-20.md).

Next evidence action remains normal HHA sign-in for protected representative
source/configuration validation. No new UI capture/import or expanded role/access
was introduced. Existing entitlement, P1-B and external account/form/reviewer/
signature prerequisites remain open; approximate age defines no care/billing rule.

## October 19 heartbeat / October 20 UTC current-visit fetch age

Current-visit evidence now shows approximate time since its explicit source read,
using this device clock. Production observed a real minute tick with all raw
fields, original fetch context, saved evidence and focus retained. Refresh/page/
month changes reset or clear it; separate saved charts remain 41/36. Fresh live
paging and all six field-presence charts matched source fields. This adds no
source polling, import, permission or operational freshness rule. See
[acceptance](CURRENT_FETCH_AGE_ACCEPTANCE_2026-10-19.md).

Next owner evidence action remains normal sign-in in the retained HHA tab for
further authorized read-only captures and representative field/unit/period/
identity/office/discipline/document validation. Existing entitlement, P1-B and
external account/form/reviewer/signature gates remain open. P1-M live-page age
display is accepted above; it does not determine care or billing status.

## October 19 SEO reprocessing accepted by Google

The previously pending sitemap error review and one-time reprocessing action are
complete. Normal Search Console showed the historical 404/HTML errors; after one
refresh of the already repaired XML, Google now reports Sitemap index / Success
with today's read date. This establishes sitemap processing, not indexing or
traffic growth. Public route, metadata, claim, accessibility/performance and
private-boundary checks passed. See [review](../seo/2026-10-19-seo-review.md).

No immediate repeat submission is needed. Next owner content action remains
current location availability and useful-content validation before promotion.
Comparable outcomes remain open; Core Web Vitals lacks enough field usage data.
Automated reporting access is unavailable, while normal browser access works;
no account/subscription change was made. Existing HHA/role prerequisites remain.

## October 19 20:40 UTC role and source-state research

The [research](ROLE_WORKFLOW_RESEARCH.txt) adds six primary references and proposed
patient/staff/office screens that keep recurrence, actual visits, placeholder
staffing, missing confirmation, missed/deleted evidence, order versions and
aggregation stages separate. Product documentation does not establish this
tenant's settings, approval rules or permissions. No role or source action changed.

Next evidence action: sign in normally in the retained HHA tab for authorized
read-only review. Keep representative recurrence/generated-visit, real/placeholder
assignment, confirmation/missed/deleted, order/certification/version and relevant
contract/aggregation mappings in protected acceptance records. Unknown mappings
remain open. Do not change HHA, enable rights or make clinical/financial decisions
to satisfy the research. P1-B and external account/form/reviewer/signature gates
remain; P1-L and P1-M fetch-age displays are accepted above.

## October 19 current-source disclosure and live verification

All returned raw current fields now open in a native keyboard disclosure with
their returned-field count. Source groups and the caregiver control remain easy
to reach. Production verified Enter/Space/Tab, exact field retention and refresh/
version clearing, preserving the separate 41/36-tile saved charts. Fresh live
first/next/previous pages and all six chart calculations matched source fields;
these remain partial on-demand reads, not a durable import or office census. See
[acceptance](CURRENT_SOURCE_DISCLOSURE_ACCEPTANCE_2026-10-19.md).

Next owner evidence action: sign in normally in the retained HHA login tab for
further authorized read-only UI observation. No new capture/import was possible
while signed out. Keep representative field/unit/period/identity/office/discipline/
document/form/reviewer mappings protected. Existing entitlement, P1-B migration
and external account/signature dependencies remain open. Accepted P1-L only adds
transparent fetch-age display; it will not define an operational freshness rule.

## October 19 current source-field groups

Current visit Schedule, Actual and EVV pairs are now readable groups, with the
source timezone and complete raw fields retained. Production compared all six
values with two current raw lists, verified explicit unknowns and narrow layout,
and retained separate saved chart/provenance evidence. No time conversion,
completion/eligibility/billing decision, permission or source mutation occurred.
See [acceptance](CURRENT_VISIT_SOURCE_GROUPS_ACCEPTANCE_2026-10-19.md).

Normal HHA sign-in and protected representative field/unit/period, identity,
office/discipline/document and clinical form/reviewer validation remain owner
evidence actions. Existing entitlement and P1-B/external-role prerequisites remain
open. P1-K's native raw-field disclosure is accepted above as an independent
reading improvement; it does not enable a source operation or interpret unknown values.

## October 19 current-visit caregiver handoff

The current-visit panel now opens the existing caregiver read using the exact
returned ID. Production verified Enter/Space, focus, same-visit refresh, filter/
version clearing and unchanged 41/36-tile saved charts. The normal explicit
caregiver fetch correctly returned its existing owner entitlement denial. No
operation was enabled, source record/import changed or staff role granted. See
[acceptance](CURRENT_VISIT_CAREGIVER_ACCEPTANCE_2026-10-19.md).

If caregiver details are needed, review entitlement in normal owner controls and
enable only when approved. For further tenant UI evidence, reopen HHA and sign
in normally; keep representative identity/office/discipline/document and unit/
period mappings protected. P1-B migration and external account/form/reviewer/
signature prerequisites remain open. P1-J source-field grouping is accepted
above as a presentation improvement, with no operational rule changes.

## October 19 01:20 UTC role research (October 18 local)

The [role research](ROLE_WORKFLOW_RESEARCH.txt) now separates primary/secondary
caregiver offices, historical patient association, visit-specific discipline and
document-action authority. Six new primary references support proposed screens
and P1-I acceptance; none establishes this tenant's activation or a new role.
Current caregiver office IDs do not identify the primary office. Administrator
caregiver selection will not establish therapist access or scheduling eligibility.

Next evidence action: complete normal HHA sign-in for authorized read-only
calendar/record review. Keep representative current/former assignments, source
caregiver IDs, visit discipline/service and primary/secondary/document authority
in protected acceptance records. Unavailable mappings remain open. No new office,
role permission or source change is requested. Existing detail/unit/period,
P1-B migration and external account/form/reviewer/signature dependencies remain.

## October 18 local / October 19 UTC saved-chart controls

Saved day charts now select or clear the existing date filter while retaining
other filters, full-capture counts, authorization rows and provenance. Production
verified Enter/Space, exact saved/current identities and 41/36-tile monthly
evidence. Fresh live paging/chart comparisons passed separately and retain
partial/on-demand/unvalidated labels. No source record, import, permission or
operational rule changed. See
[acceptance](SAVED_CHART_DAY_FILTER_ACCEPTANCE_2026-10-18.md).

The HHA browser still needs normal sign-in for additional UI captures. Protected
representative field/unit/period validation, approved detail entitlement, P1-B
scope/supervisor mapping and external identity/form/signature requirements remain
open. P1-I proposes exact caregiver-read selection within existing administrator
gates; it does not establish therapist/staff external access.

## October 18 public guide and search evidence

Resources now links to a visitor guide to existing approved information; that
guide connects the non-medical care explainer, services, eligibility, checklist
and contact pages. Both core pages are homepage-reachable. All 132 public routes
and production/browser checks passed. No new service, location, payer or clinical
claim was approved. Current exact-window Search Console/query-page evidence is
private; the comparison has no observations, so no growth is claimed. See
[SEO acceptance](../seo/2026-10-18-seo-review.md).

October 19 follow-up completed the detailed sitemap error review and one-time
refresh; Google's new successful read is recorded above. The 37 remaining HTML
graph findings are locations;
confirm current availability and useful unique content before further promotion.
Optional field-performance setup and comparable outcome evidence remain open.
HHA sign-in/source interpretation and private-role acceptance remain separate.

## October 18 loaded-calendar pagination

Saved calendars now page only loaded matches, ten at a time, with separate
visible-range, matched and loaded counts. Full saved charts, authorizations and
provenance remain intact. Production traversed October's 41 and September's 36
tiles, verified filter/reset/version behavior and an exact current read from the
last page; page changes clear current evidence. No operational rule, source
record, permission or import changed. See
[pagination acceptance](SAVED_CALENDAR_PAGES_ACCEPTANCE_2026-10-18.md).

Normal HHA sign-in and protected representative-field validation remain the next
owner evidence actions. P1-H chart-day filtering is accepted above;
external account/discipline/form/reviewer and P1-B scope prerequisites remain open.

## October 18 document and visit-state research

The latest [role research](ROLE_WORKFLOW_RESEARCH.txt) separates document origin
and action permissions, form publication from encounter review/signing, visit
authorization allocation from discovery, and timesheet upload from approval and
hold clearance. Overnight context retains one source visit identity. Family
invoice viewing requires its own approved scope. These are proposed requirements,
not newly enabled tenant capabilities or operational decisions.

Next evidence action: sign into HHA normally for further authorized UI review.
Use protected representative records to identify document origins and action
rights, applicable form/office/visit configuration and reviewer authority,
allocation mode/contract labels and timesheet approval/hold fields under existing
approved rules. Keep private mappings out of repository research. Existing detail
entitlement and unit/period validation remain open; P1-G local pagination is
implemented in the acceptance above.

## October 18 loaded-calendar filtering

Saved calendar filters now narrow only the selected loaded capture and report
matched/loaded counts. Full-capture charts and provenance stay unchanged;
explicit current reads retain existing office/patient checks. Production
verified expected matches, no matches, reset and version changes. These controls
do not validate source interpretation or change an operational rule or record.
Existing representative-field and HHA sign-in dependencies remain open. See
[filter acceptance](SAVED_CALENDAR_FILTERS_ACCEPTANCE_2026-10-18.md).

## October 18 saved/current visit evidence

Existing saved-calendar rows now open current visit evidence only after current
visit/patient and patient/office checks. Normal-session acceptance matched exact
selected identities, retained saved capture facts and 41/36 chart totals, and
showed current fetch/office-check times separately. This does not validate source
time, EVV, payroll, billing or authorization interpretation. No operational rule,
record, permission or import changed. Continue representative-field validation
under the existing approved rules; normal HHA sign-in is required for additional
browser capture. See [acceptance](SAVED_VISIT_LINKS_ACCEPTANCE_2026-10-18.md).

## October 16 workflow-state evidence

Research distinguishes family schedule viewing from per-member/per-patient
request capabilities, clinical required-field completion from review/signing,
and prebilling from later export/print review holds. When external roles are
prepared, identify those capability scopes, the applicable document module/form
and clinician reviewer, and the contract validation stage from existing approved
records. Keep tenant-specific mappings protected; no access, hold, schedule or
contract setting was changed. Authorization-detail entitlement and representative
field validation remain open. These evidence dependencies do not block P1-E.
See the October 16 pass in [role research](ROLE_WORKFLOW_RESEARCH.txt).

## October 15 connected authorization evidence

Live visit rows now select patient authorization discovery. Normal-session
production returned 12 rows after current patient-office verification, and a row
selected exact detail identifiers. The detail read remained disabled and its
explicit request was correctly blocked; no permission changed. Review
`GetPatientAuthorizationInfo` entitlement and enable it in normal owner controls
only if approved, then compare representative detail fields with source period,
unit and contract allocation labels under existing approved rules. Keep private
acceptance mappings protected. This navigation does not validate remaining
hours, utilization, eligibility or billing. See
[authorization acceptance](PATIENT_AUTHORIZATION_LINKS_ACCEPTANCE_2026-10-15.md).

## October 15 connected patient history

Selected live patients now open their protected saved-calendar history from
Overview or Visit Preview. Normal-session acceptance verified exact targeting,
an empty history, source-refresh clearing and the two existing saved months:
chart totals matched 41 October and 36 September visit tiles, with three
authorization rows each. Manual-source labels and capture/import times remain
visible. This navigation acceptance does not close source interpretation or
external-role prerequisites. The next owner action remains representative-field
validation using the existing approved rules; further browser capture requires
normal HHA sign-in. See
[history acceptance](PATIENT_HISTORY_LINKS_ACCEPTANCE_2026-10-15.md).

## October 15 authorization and role evidence follow-up

The 17:29 UTC research pass found that authorization discovery supplies IDs and
dates, while detail fields do not establish unit conversion or balance-period
meaning. During the existing representative-record validation, compare source
labels, applicable period and contract allocation settings with SOAP fields;
retain the mapping and exceptions in protected acceptance evidence. Do not
derive remaining hours or utilization from the bounded visit preview.
Family accounts may need multiple independently scoped patient memberships;
confirm the intended document-sharing scope per patient. Staff network status,
submission, review and signing must remain separate states, using the existing
approved form, identity and retention authority. These checks do not reopen
completed policy decisions or block P1-C history navigation. See the dated
[research delta](ROLE_WORKFLOW_RESEARCH.txt).

## October 15 SEO follow-up

The legacy submitted sitemap index serves valid XML. The originally pending
warning review and one-time reprocessing completed October 19; normal Search
Console again showed both rows as Success with 27 discovered pages on October 20
13:25 UTC. Do not repeat submission of these unchanged successful files.
Discovery does not establish indexing or outcome growth. Comparable settled
search outcomes and sufficient field Core Web Vitals evidence remain open;
optional CrUX/reporting setup stays separate, with no key, subscription or
permission change made automatically. See the
[current review](../seo/2026-10-20-seo-review.md).
Existing public service, payer, credential and location evidence remains the
release authority. See [SEO evidence](../seo/2026-10-15-sitemap-review.md).

## October 15 source evidence available for owner validation

The protected patient workbench now retains two dated HHA calendar snapshots,
including readable visit tiles and authorization rows. Persistence and duplicate
handling passed normal-session acceptance. Current patient authorization reads
also returned HHA records. These checks establish access and preservation, not
approved field interpretation. The matching, clock, authorization and billing
validation items below remain open for the owner's representative-record review.
See [manual source acceptance](MANUAL_SOURCE_IMPORT_ACCEPTANCE_2026-10-15.md).

Live visit pages now carry exact patient, caregiver and visit IDs into the
existing source read tools. Production verified patient and visit reads while
retaining the caregiver owner-enablement gate. The next owner action remains
representative-record validation of identity, source fields and interpretation;
navigation acceptance does not close those items. Additional manual calendar
captures require normal sign-in to the expired HHA browser tab. See
[record-link acceptance](SOURCE_RECORD_LINKS_ACCEPTANCE_2026-10-15.md).

October 15 role research: the investigation form already accepts a staff
identifier, follow-up timestamp and history; the assignee field does not verify
supervisor membership or deliver a notification. Before role-specific assignment
or office-isolated exposure, identify the authoritative staff/account-to-office
mapping. Before external patient/family or therapist release, supply the intended
document-sharing scope and agency-approved therapist form, clinician reviewer
and signature/retention authority. These dependencies do not block the next
loaded-record triage improvements. See the dated research pass and P1-A/P1-B
criteria in [role research](ROLE_WORKFLOW_RESEARCH.txt). Existing runtime field
validation items remain open.

Loaded-record investigation triage is deployed. Production currently returned
an empty queue; filters and navigation passed acceptance without creating test
records. When an actual operational investigation exists, verify assignment,
follow-up display, notes/history and revision-safe updates in the protected UI.
This remains separate from source-field validation and the verified office/staff
mapping prerequisites. See
[triage acceptance](INVESTIGATION_TRIAGE_ACCEPTANCE_2026-10-15.md).

## Confirmed in the owner interview

> **Completion attestation — 2026-09-22:** the developer explicitly confirmed that the Owner / Operations Lead completed all owner policy and decision items in this checklist. Items that require live imported HHA records or finished-feature acceptance remain runtime validation gates rather than policy decisions. Where an exact approved value is not written in this repository, implementation must use the owner-approved source record and must not infer or invent it.


- [x] **OPS-001 — Document the current daily EVV/visit-review workflow.**
- [x] **OPS-002 — List the most common EVV/visit exceptions and current resolution steps.**
- [x] **OPS-003 — Define clock exception thresholds.** Owner decision completed; use the owner-approved values when runtime rule configuration is populated.
- [x] **OPS-004 — Split alerts by audience.** Owner audience/visibility decision completed.
- [x] **OPS-005 — Define who may approve each visit/EVV correction type.** Owner correction-approval decision completed.

### Confirmed EVV operating facts

- Routine exception types include:
  - clock-in missing / clock-out present,
  - clock-out missing / clock-in present,
  - both clock-in and clock-out missing,
  - actual clock times differing from the scheduled visit.
- Staff typically start from the caregiver/member calendar or HHAExchange Visit Maintenance.
- The current workflow includes opening the visit, reviewing Visit Info, using Link Visit, selecting the available call(s), confirming with the member or caregiver, connecting the call, and selecting a Texas reason code.
- Reason-code selection is generally based on management best judgment for the facts of the case.
- When actual hours exceed the scheduled hours, management may downward-adjust the EVV/visit time to match the scheduled hours when appropriate.
- A supervisor in the office approves or declines the corrected visit.
- If a visit is declined, that day may not be paid.
- PTHHS currently uses limited leniency for complete missing-clock activity: roughly two days in a pay period may be manually handled, while repeated missing activity beyond that becomes a management red flag requiring investigation.
- Pay periods are the **1st–15th** and **16th–end of month**.
- Repeated missing visit activity can indicate a larger operational issue (caregiver stopped working, member hospitalized, member deceased, or another disruption) and should trigger supervisor outreach/investigation.
- Current outreach/investigation tracking is informal and needs a formal note/history workflow.
- Desired future behavior: supervisor-facing notes plus a morning summary of abnormal/unresolved events.

### Confirmed staffing operating facts

- Staffing disruptions commonly start when:
  - a member/patient requests a different caregiver,
  - a caregiver wants a different assignment,
  - a caregiver stops working or no longer wants the case.
- Current replacement process is mainly a **phone tree**.
- Caregivers regularly call looking for work, but there is no reliable searchable availability pool today.
- Availability/job-seeker information is often kept in **handwritten notes**.
- Greater Houston geography materially affects staffing.
- Transportation matters: some caregivers drive; others depend on bus routes.
- A case can be impractical if travel distance/time is too high for the available hours/pay.
- **Patient choice is the first ranking factor.**
- **Hours are the second ranking factor**, including both caregiver-desired hours and avoiding overtime/schedule conflicts.
- Geography, transportation, and other eligibility constraints also matter.

**Owner policy checkpoint:** OPS-001 through OPS-005 are complete. The next owner involvement is runtime validation of imported HHA records and acceptance testing as developer milestones become available.

## Repository review handoff — September 12, 2026

- [x] **OPS-R01 — Visitor-facing data freeze honored.** The repository cleanup did not change any tracked file under `public/`, including visible claims, payer names, copy, images, metadata, sitemap, and redirects.
- [x] **OPS-R02 — Historical evidence preserved.** Superseded reports and source captures were archived and labeled rather than discarded.
- [x] **OPS-R03 — No operational rules inferred.** Repository engineering changes did not invent EVV, billing, staffing, compliance, or approval logic.
- [x] **OPS-003/004/005 owner policy decisions completed.** Runtime validation remains tied to developer implementation.

---

# Roles and permissions

- [x] List the real PTHHS roles: owner, administrator, supervisor, scheduler/coordinator, clinical reviewer, field staff, billing/collections, compliance/HR, etc.
- [x] Define what each role may view.
- [x] Confirm the **supervisor role** is the first operational owner for EVV red-flag review and follow-up.
- [x] Define who may view manager-only EVV discrepancies.
- [x] Define who may approve visit/EVV corrections beyond routine supervisor approval.
- [x] Define who may change schedules.
- [x] Define who may view billing/AR data.
- [x] Define who may view caregiver compliance data.
- [x] Define who may view visit-location evidence.
- [x] Identify actions that require owner approval.

**Deliverable:** role-permission matrix.

---

# Current HHAExchange workflows

For each workflow, identify **who**, **how often**, **what they check**, **what decision they make**, **what action follows**, and **what commonly goes wrong**.

- [x] daily visit review — current EVV review path documented.
- [x] clock-in / clock-out review — common missing/misaligned call scenarios documented.
- [x] EVV exception correction — current Link Visit / confirmation / reason-code / supervisor-decision flow documented.
- [x] visit confirmation — partially covered; exact confirmation-state rules still need definition.
- [x] visit documentation issues
- [x] authorizations
- [x] missed visits — red-flag concept documented, but formal workflow still needs definition.
- [x] billing readiness
- [x] collections / AR follow-up
- [x] caregiver availability — current handwritten/phone-call state documented.
- [x] open-shift staffing — current phone-tree replacement workflow documented at a high level.
- [x] caregiver compliance

**Deliverable:** plain-language current-state workflow notes.

---

# Validate imported HHA data

**RUNTIME VALIDATION GATE — still blocked until developer read-only sync exists.** Owner policy work is complete, but representative imported records cannot be truthfully validated before the sync exists. Review de-identified records and mark each correct, incorrect, or needs HHA clarification when available.

- [ ] patient matching
- [ ] caregiver/employee matching
- [ ] scheduled start/end
- [ ] actual visit start/end
- [ ] clock-in/out interpretation
- [ ] visit confirmation state
- [ ] service/discipline interpretation
- [ ] authorization interpretation
- [ ] edit/deletion/correction interpretation
- [ ] billing-related visit fields

Do not approve automated exception logic until the underlying data interpretation is trusted.

---

# EVV and visit exception rules

For every rule, define trigger, grace period, legitimate exceptions, employee visibility, manager visibility, escalation, resolver, resolution condition, and automation policy.

## Missing / late clock-in

- [x] minutes after scheduled start before concern
- [x] employee-contact timing
- [x] management-alert timing
- [x] service-specific differences
- [x] repeat-occurrence handling
- [x] resolution definition

## Missing clock-out

- [x] threshold after expected end
- [x] first audience
- [x] escalation timing
- [x] resolution definition

## Early clock-out / short visit

- [x] acceptable variance
- [x] service/authorization differences
- [x] when documentation is required
- [x] when correction is required

## Long visit / late clock-out

- [x] Confirm that long visits can require downward adjustment to scheduled hours after management review.
- [x] define exact variance requiring review
- [x] legitimate exceptions
- [x] authorization-impact handling

## Repeated missing activity / red flags

- [x] Repeated missing activity beyond normal leniency is a management red flag requiring investigation.
- [x] Supervisor is the first operational owner of investigation.
- [x] define exact automated trigger by count/time window
- [x] define outreach SLA
- [x] define required note fields
- [x] define escalation if member/caregiver cannot be reached

## Documentation / POC

- [x] required documentation/tasks by service type
- [x] missing items that block billing
- [x] items requiring clinical review
- [x] items requiring management review
- [x] who may resolve each type

## Corrections

- [x] Routine EVV corrections are reviewed by an office supervisor for approve/decline.
- [x] second-review cases
- [x] clinical-approval corrections
- [x] corrections that must never be automated
- [x] required reason/evidence rules

**Deliverable:** approved exception matrix.

---

# Messaging and escalation

- [x] Supervisor should receive visibility into abnormal/unresolved EVV events.
- [x] A morning supervisor summary of red flags is desired.
- [x] Investigation activity should be captured in formal notes/history rather than informal memory.
- [x] employee receives message or not by exception type
- [x] manager-only issues
- [x] billing/compliance involvement
- [x] first-message timing
- [x] reminder cadence
- [x] stop conditions
- [x] acknowledgement requirement
- [x] escalation timing
- [x] escalation recipient
- [x] approved wording or message intent

**Deliverable:** alert matrix with audience, timing, escalation, and message intent.

---

# HHA correction / write-back policy

Before developer enables writes:

- [x] Current routine correction flow includes call verification, reason-code selection, and supervisor approve/decline.
- [x] list all correction types currently performed in HHA
- [x] define evidence/information required before approval by type
- [x] map usual HHA edit reason/category by type
- [x] define approver by correction type
- [x] define second-review cases
- [x] define cases that remain HHA-only
- [x] define required audit-history details

Classify every correction as manual-only, suggest-only, submit-after-manager-approval, or potentially automatable later.

**Deliverable:** correction approval matrix.

---

# Authorization rules

- [x] define authorized units/hours
- [x] define used units/hours
- [x] define scheduled future units/hours
- [x] define remaining units/hours
- [x] define effective/expiration-date behavior
- [x] define overlapping/replacement authorization behavior
- [x] define service-specific limits
- [x] define cases where schedule may exceed authorization
- [x] define expiration warning window
- [x] define low-remaining warning threshold
- [x] define projected-overage warning threshold
- [x] define missing-authorization behavior

**Deliverable:** approved authorization calculations and warnings.

---

# Billing, billable hours, projections, and AR

- [x] when a visit is considered completed
- [x] when it is considered EVV-ready/compliant
- [x] what prevents billing
- [x] when it is actually billed/submitted
- [x] statuses meaning held/rejected/pending/outstanding/paid
- [x] how collections are followed up
- [x] service codes billed by PTHHS
- [x] unit/hour conversion rules
- [x] authoritative rate sources
- [x] what management considers AR
- [x] AR aging buckets
- [x] weekly/monthly billable-hour projections
- [x] desired revenue projections
- [x] forecast assumptions

**Deliverable:** approved billing-state flow and formulas.

---

# Staffing rules

## Current-state facts confirmed

- [x] Patient choice is the top assignment-ranking factor.
- [x] Hours are the second ranking factor: fit the caregiver's desired hours and avoid overtime/schedule conflicts.
- [x] Geography/travel practicality matters.
- [x] Transportation mode matters, including bus-route dependence.
- [x] Current caregiver/job-seeker availability tracking is inadequate and should become searchable/persistent.

## Hard restrictions still to define

- [x] discipline/role
- [x] training/competency
- [x] compliance/credential status
- [x] availability
- [x] schedule conflicts
- [x] patient restrictions
- [x] employee restrictions
- [x] service eligibility
- [x] hard maximum-hours/overtime rules

## Ranking preferences

- [x] existing patient relationship
- [x] travel distance / geographic practicality
- [x] continuity of care
- [x] preferred work area / transportation practicality
- [x] workload balancing
- [x] overtime avoidance / hours fit
- [x] patient preference
- [x] relevant language/skill preference

For every factor still define hard exclusion vs ranking preference, relative importance, override authority, and override-reason requirements.

## Open-shift workflow

- [x] Current state is primarily a phone tree.
- [x] who sees an open shift first in the future system
- [x] one employee vs multiple offers
- [x] offer expiration
- [x] no-acceptance fallback
- [x] final assignment authority

**Deliverable:** staffing eligibility matrix + ranking preferences.

---

# Caregiver compliance

- [x] list tracked compliance/credential items
- [x] identify items that block scheduling
- [x] identify warning-only items
- [x] define expiration warning windows
- [x] define alert recipients
- [x] define override authority
- [x] define what resolves an issue

**Deliverable:** compliance matrix.

---

# Visit-location evidence

Keep this focused on visit verification, not continuous employee tracking.

- [x] workflows that need location evidence
- [x] how location discrepancies are handled today
- [x] whether distance from expected visit location matters
- [x] approved distance/tolerance rules
- [x] legitimate alternate-location scenarios
- [x] who may view location evidence
- [x] whether employee sees discrepancy before management review

**Deliverable:** location-evidence policy.

---

# Management dashboard priority

Rank each **P0 / P1 / P2** and identify owner/action/response time for every P0 item.

- [x] active visits now
- [x] starting soon
- [x] missing clock-ins — confirmed core operational exception
- [x] missing clock-outs — confirmed core operational exception
- [x] late arrivals — confirmed relevant, exact threshold pending
- [x] unconfirmed visits
- [x] documentation/POC issues
- [x] open shifts / caregiver replacement — confirmed major operational pain point
- [x] caregiver compliance issues
- [x] authorization at-risk count
- [x] projected authorization overage
- [x] billable hours this week
- [x] billing blocked by exceptions
- [x] outstanding AR
- [x] HHA integration health

**Deliverable:** prioritized dashboard requirements.

---

# Production and outage workflow

- [x] who should have production admin access
- [x] acceptable management-layer downtime
- [x] fallback when PTHHS management layer is down but HHA works
- [x] fallback when HHAExchange is down
- [x] essential functions during outage
- [x] organizational hosting/security requirements before production PHI use

**Deliverable:** production approval + outage fallback checklist.

---

# Owner acceptance checklist for every feature

**RUNTIME ACCEPTANCE GATE:** policy decisions are complete; these checks stay open until each implemented feature exists and can be exercised.

- [ ] normal case works
- [ ] missing/late-data case works
- [ ] legitimate exceptions do not cause harmful false alarms
- [ ] employee-facing information is appropriate
- [ ] manager-only information remains manager-only
- [ ] reason for each alert/decision is understandable
- [ ] resolution matches real workflow
- [ ] message wording is approved
- [ ] audit history is sufficient
- [ ] every automatic action is explicitly approved

---

# Immediate owner sequence

- [x] **OPS-001:** document daily EVV/visit review.
- [x] **OPS-002:** list common EVV exceptions + current resolution steps.
- [x] **OPS-003 — NEXT:** define exact clock thresholds and grace periods.
- [x] **OPS-004:** define employee-visible vs manager-only vs billing/compliance-only alerts.
- [x] **OPS-005:** finish correction approver matrix beyond routine supervisor decisions.
- [x] explain authorization checks used before scheduling/billing.
- [x] explain exactly what makes a completed visit billing-ready.
- [x] list hard staffing eligibility rules.
- [x] list compliance items that block scheduling.
- [x] rank first dashboard metrics.

**Immediate handoff target:** owner policy decisions are complete. Developer may build configurable rule/messaging infrastructure, but production values must come from the owner-approved record and live-data validation must occur before automation is enabled.
