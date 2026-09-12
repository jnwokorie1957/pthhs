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

- [x] **OPS-001 — Document the current daily EVV/visit-review workflow.**
- [x] **OPS-002 — List the most common EVV/visit exceptions and current resolution steps.**
- [ ] **OPS-003 — Define clock exception thresholds.** Exact late/missing clock timing still needs to be approved.
- [ ] **OPS-004 — Split alerts by audience.** Supervisor ownership is confirmed, but employee-visible vs manager-only vs billing/compliance-only rules are not fully defined yet.
- [ ] **OPS-005 — Define who may approve each visit/EVV correction type.** Office supervisors approve/decline routine cases, but second-review/clinical/compliance cases still need definition.

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

**Next owner priority:** complete OPS-003, OPS-004, and OPS-005 before the developer implements real exception thresholds or automated alerts.

---

# Roles and permissions

- [ ] List the real PTHHS roles: owner, administrator, supervisor, scheduler/coordinator, clinical reviewer, field staff, billing/collections, compliance/HR, etc.
- [ ] Define what each role may view.
- [x] Confirm the **supervisor role** is the first operational owner for EVV red-flag review and follow-up.
- [ ] Define who may view manager-only EVV discrepancies.
- [ ] Define who may approve visit/EVV corrections beyond routine supervisor approval.
- [ ] Define who may change schedules.
- [ ] Define who may view billing/AR data.
- [ ] Define who may view caregiver compliance data.
- [ ] Define who may view visit-location evidence.
- [ ] Identify actions that require owner approval.

**Deliverable:** role-permission matrix.

---

# Current HHAExchange workflows

For each workflow, identify **who**, **how often**, **what they check**, **what decision they make**, **what action follows**, and **what commonly goes wrong**.

- [x] daily visit review — current EVV review path documented.
- [x] clock-in / clock-out review — common missing/misaligned call scenarios documented.
- [x] EVV exception correction — current Link Visit / confirmation / reason-code / supervisor-decision flow documented.
- [ ] visit confirmation — partially covered; exact confirmation-state rules still need definition.
- [ ] visit documentation issues
- [ ] authorizations
- [ ] missed visits — red-flag concept documented, but formal workflow still needs definition.
- [ ] billing readiness
- [ ] collections / AR follow-up
- [x] caregiver availability — current handwritten/phone-call state documented.
- [x] open-shift staffing — current phone-tree replacement workflow documented at a high level.
- [ ] caregiver compliance

**Deliverable:** plain-language current-state workflow notes.

---

# Validate imported HHA data

**BLOCKED until developer read-only sync exists.** Review representative de-identified records and mark each as correct, incorrect, or needs HHA clarification.

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

- [ ] minutes after scheduled start before concern
- [ ] employee-contact timing
- [ ] management-alert timing
- [ ] service-specific differences
- [ ] repeat-occurrence handling
- [ ] resolution definition

## Missing clock-out

- [ ] threshold after expected end
- [ ] first audience
- [ ] escalation timing
- [ ] resolution definition

## Early clock-out / short visit

- [ ] acceptable variance
- [ ] service/authorization differences
- [ ] when documentation is required
- [ ] when correction is required

## Long visit / late clock-out

- [x] Confirm that long visits can require downward adjustment to scheduled hours after management review.
- [ ] define exact variance requiring review
- [ ] legitimate exceptions
- [ ] authorization-impact handling

## Repeated missing activity / red flags

- [x] Repeated missing activity beyond normal leniency is a management red flag requiring investigation.
- [x] Supervisor is the first operational owner of investigation.
- [ ] define exact automated trigger by count/time window
- [ ] define outreach SLA
- [ ] define required note fields
- [ ] define escalation if member/caregiver cannot be reached

## Documentation / POC

- [ ] required documentation/tasks by service type
- [ ] missing items that block billing
- [ ] items requiring clinical review
- [ ] items requiring management review
- [ ] who may resolve each type

## Corrections

- [x] Routine EVV corrections are reviewed by an office supervisor for approve/decline.
- [ ] second-review cases
- [ ] clinical-approval corrections
- [ ] corrections that must never be automated
- [ ] required reason/evidence rules

**Deliverable:** approved exception matrix.

---

# Messaging and escalation

- [x] Supervisor should receive visibility into abnormal/unresolved EVV events.
- [x] A morning supervisor summary of red flags is desired.
- [x] Investigation activity should be captured in formal notes/history rather than informal memory.
- [ ] employee receives message or not by exception type
- [ ] manager-only issues
- [ ] billing/compliance involvement
- [ ] first-message timing
- [ ] reminder cadence
- [ ] stop conditions
- [ ] acknowledgement requirement
- [ ] escalation timing
- [ ] escalation recipient
- [ ] approved wording or message intent

**Deliverable:** alert matrix with audience, timing, escalation, and message intent.

---

# HHA correction / write-back policy

Before developer enables writes:

- [x] Current routine correction flow includes call verification, reason-code selection, and supervisor approve/decline.
- [ ] list all correction types currently performed in HHA
- [ ] define evidence/information required before approval by type
- [ ] map usual HHA edit reason/category by type
- [ ] define approver by correction type
- [ ] define second-review cases
- [ ] define cases that remain HHA-only
- [ ] define required audit-history details

Classify every correction as manual-only, suggest-only, submit-after-manager-approval, or potentially automatable later.

**Deliverable:** correction approval matrix.

---

# Authorization rules

- [ ] define authorized units/hours
- [ ] define used units/hours
- [ ] define scheduled future units/hours
- [ ] define remaining units/hours
- [ ] define effective/expiration-date behavior
- [ ] define overlapping/replacement authorization behavior
- [ ] define service-specific limits
- [ ] define cases where schedule may exceed authorization
- [ ] define expiration warning window
- [ ] define low-remaining warning threshold
- [ ] define projected-overage warning threshold
- [ ] define missing-authorization behavior

**Deliverable:** approved authorization calculations and warnings.

---

# Billing, billable hours, projections, and AR

- [ ] when a visit is considered completed
- [ ] when it is considered EVV-ready/compliant
- [ ] what prevents billing
- [ ] when it is actually billed/submitted
- [ ] statuses meaning held/rejected/pending/outstanding/paid
- [ ] how collections are followed up
- [ ] service codes billed by PTHHS
- [ ] unit/hour conversion rules
- [ ] authoritative rate sources
- [ ] what management considers AR
- [ ] AR aging buckets
- [ ] weekly/monthly billable-hour projections
- [ ] desired revenue projections
- [ ] forecast assumptions

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

- [ ] discipline/role
- [ ] training/competency
- [ ] compliance/credential status
- [ ] availability
- [ ] schedule conflicts
- [ ] patient restrictions
- [ ] employee restrictions
- [ ] service eligibility
- [ ] hard maximum-hours/overtime rules

## Ranking preferences

- [ ] existing patient relationship
- [x] travel distance / geographic practicality
- [ ] continuity of care
- [x] preferred work area / transportation practicality
- [ ] workload balancing
- [x] overtime avoidance / hours fit
- [x] patient preference
- [ ] relevant language/skill preference

For every factor still define hard exclusion vs ranking preference, relative importance, override authority, and override-reason requirements.

## Open-shift workflow

- [x] Current state is primarily a phone tree.
- [ ] who sees an open shift first in the future system
- [ ] one employee vs multiple offers
- [ ] offer expiration
- [ ] no-acceptance fallback
- [ ] final assignment authority

**Deliverable:** staffing eligibility matrix + ranking preferences.

---

# Caregiver compliance

- [ ] list tracked compliance/credential items
- [ ] identify items that block scheduling
- [ ] identify warning-only items
- [ ] define expiration warning windows
- [ ] define alert recipients
- [ ] define override authority
- [ ] define what resolves an issue

**Deliverable:** compliance matrix.

---

# Visit-location evidence

Keep this focused on visit verification, not continuous employee tracking.

- [ ] workflows that need location evidence
- [ ] how location discrepancies are handled today
- [ ] whether distance from expected visit location matters
- [ ] approved distance/tolerance rules
- [ ] legitimate alternate-location scenarios
- [ ] who may view location evidence
- [ ] whether employee sees discrepancy before management review

**Deliverable:** location-evidence policy.

---

# Management dashboard priority

Rank each **P0 / P1 / P2** and identify owner/action/response time for every P0 item.

- [ ] active visits now
- [ ] starting soon
- [x] missing clock-ins — confirmed core operational exception
- [x] missing clock-outs — confirmed core operational exception
- [ ] late arrivals — confirmed relevant, exact threshold pending
- [ ] unconfirmed visits
- [ ] documentation/POC issues
- [x] open shifts / caregiver replacement — confirmed major operational pain point
- [ ] caregiver compliance issues
- [ ] authorization at-risk count
- [ ] projected authorization overage
- [ ] billable hours this week
- [ ] billing blocked by exceptions
- [ ] outstanding AR
- [ ] HHA integration health

**Deliverable:** prioritized dashboard requirements.

---

# Production and outage workflow

- [ ] who should have production admin access
- [ ] acceptable management-layer downtime
- [ ] fallback when PTHHS management layer is down but HHA works
- [ ] fallback when HHAExchange is down
- [ ] essential functions during outage
- [ ] organizational hosting/security requirements before production PHI use

**Deliverable:** production approval + outage fallback checklist.

---

# Owner acceptance checklist for every feature

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
- [ ] **OPS-003 — NEXT:** define exact clock thresholds and grace periods.
- [ ] **OPS-004:** define employee-visible vs manager-only vs billing/compliance-only alerts.
- [ ] **OPS-005:** finish correction approver matrix beyond routine supervisor decisions.
- [ ] explain authorization checks used before scheduling/billing.
- [ ] explain exactly what makes a completed visit billing-ready.
- [ ] list hard staffing eligibility rules.
- [ ] list compliance items that block scheduling.
- [ ] rank first dashboard metrics.

**Immediate handoff target:** OPS-003 through OPS-005 should be completed before the developer implements production exception rules or automated messaging.
