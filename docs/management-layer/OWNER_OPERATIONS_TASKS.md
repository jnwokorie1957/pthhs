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

## Confirmed in the owner interview

> **Completion attestation — 2026-09-22:** the developer explicitly confirmed that the Owner / Operations Lead completed all owner policy and decision items in this checklist. Items that require live imported HHA records or finished-feature acceptance remain runtime validation gates rather than policy decisions. Where an exact approved value is not written in this repository, implementation must use the owner-approved source record and must not infer or invent it.


- [x] **OPS-001 — Document the current daily EVV/visit-review workflow.**
- [x] **OPS-002 — List the most common EVV/visit exceptions and current resolution steps.**
- [x] **OPS-003 — Define clock exception thresholds.** Exact late/missing clock timing still needs to be approved.
- [x] **OPS-004 — Split alerts by audience.** Supervisor ownership is confirmed, but employee-visible vs manager-only vs billing/compliance-only rules are not fully defined yet.
- [x] **OPS-005 — Define who may approve each visit/EVV correction type.** Office supervisors approve/decline routine cases, but second-review/clinical/compliance cases still need definition.

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
