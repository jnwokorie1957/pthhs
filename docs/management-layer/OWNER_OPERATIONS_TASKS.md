# PTHHS Management Layer — Owner / Operations Checklist

> **Primary owner:** PTHHS Owner / Operations Lead
>
> **Purpose:** Define how PTHHS actually operates so the developer can implement the correct management, EVV, clinical-review, billing, staffing, compliance, and escalation rules. This is a decision checklist, not a coding checklist.

## How this checklist is used

- `[x]` = completed and explicitly confirmed.
- `[ ]` = pending.
- The developer must not invent an operational/medical rule to make progress.
- When an owner item is completed, mark it `[x]`, update the root `README.md` checkpoint when it changes a development dependency, and prompt with the next owner decision needed.
- Use de-identified examples in repository documentation.

## Start here

- [`DEVELOPER_TASKS.md`](./DEVELOPER_TASKS.md) — technical implementation/checkpoint tracker.
- [`../../hharefs/endpoints.html`](../../hharefs/endpoints.html) — HHA capability map; use it to see **what HHA exposes**.
- [`../../hharefs/hha-wdsl.xml`](../../hharefs/hha-wdsl.xml) — exact HHA SOAP contract; the developer uses it to determine **how each operation actually works**.

> `endpoints.html` tells us what exists. `hha-wdsl.xml` tells the developer exactly how to implement it.

---

# Current owner checkpoint

No owner decisions are blocking the developer's initial SOAP/config/schema setup yet. The highest-value owner work can happen in parallel now.

- [ ] **OPS-001 — Document the current daily EVV/visit-review workflow.** Who reviews visits, what they inspect, when they do it, and what they do when something is wrong.
- [ ] **OPS-002 — List the most common EVV/visit exceptions.** For each one, explain how management resolves it today in HHAExchange.
- [ ] **OPS-003 — Define clock exception thresholds.** Missing/late clock-in, missing clock-out, early clock-out/short visit, long visit/late clock-out.
- [ ] **OPS-004 — Split alerts by audience.** Which issues employees may see vs manager-only vs billing/compliance-only.
- [ ] **OPS-005 — Define who may approve visit/EVV corrections.** Include any second-review or clinical-review cases.

**Owner handoff target:** complete OPS-001 through OPS-005 by the time the developer has real read-only schedule + visit data ready for validation.

---

# Roles and permissions

- [ ] List the real PTHHS roles: owner, administrator, scheduler/coordinator, clinical reviewer, field staff, billing/collections, compliance/HR, etc.
- [ ] Define what each role may view.
- [ ] Define who may view manager-only EVV discrepancies.
- [ ] Define who may approve visit/EVV corrections.
- [ ] Define who may change schedules.
- [ ] Define who may view billing/AR data.
- [ ] Define who may view caregiver compliance data.
- [ ] Define who may view visit-location evidence.
- [ ] Identify actions that require owner approval.

**Deliverable:** role-permission matrix.

---

# Current HHAExchange workflows

For each workflow, identify **who**, **how often**, **what they check**, **what decision they make**, **what action follows**, and **what commonly goes wrong**.

- [ ] daily visit review
- [ ] clock-in / clock-out review
- [ ] EVV exception correction
- [ ] visit confirmation
- [ ] visit documentation issues
- [ ] authorizations
- [ ] missed visits
- [ ] billing readiness
- [ ] collections / AR follow-up
- [ ] caregiver availability
- [ ] open-shift staffing
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

For every rule, define:

- trigger
- grace period / threshold
- legitimate exceptions
- employee visibility
- manager visibility
- escalation
- who may resolve it
- what counts as resolved
- whether automation is never allowed, possibly allowed later, or approved under explicit conditions

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

- [ ] variance requiring review
- [ ] legitimate exceptions
- [ ] authorization-impact handling

## Unconfirmed visits

- [ ] expected confirmation timing
- [ ] confirmation owner
- [ ] urgency conditions

## Documentation / POC

- [ ] required documentation/tasks by service type
- [ ] missing items that block billing
- [ ] items requiring clinical review
- [ ] items requiring management review
- [ ] who may resolve each type

## Corrections

- [ ] routine corrections
- [ ] manager-approval corrections
- [ ] clinical-approval corrections
- [ ] corrections that must never be automated
- [ ] reason/explanation requirements

**Deliverable:** approved exception matrix.

---

# Messaging and escalation

For each exception:

- [ ] employee receives message or not
- [ ] management-only or not
- [ ] billing/compliance involvement
- [ ] first-message timing
- [ ] reminder cadence
- [ ] stop conditions
- [ ] acknowledgement requirement
- [ ] escalation timing
- [ ] escalation recipient
- [ ] approved wording or message intent

Prioritize:

- [ ] missing clock-in
- [ ] missing clock-out
- [ ] late arrival
- [ ] schedule change/cancellation
- [ ] open-shift offer
- [ ] incomplete documentation
- [ ] authorization warning
- [ ] HHA/integration outage

**Deliverable:** alert matrix with audience, timing, escalation, and message intent.

---

# HHA correction / write-back policy

Before developer enables writes:

- [ ] list correction types currently performed in HHA
- [ ] define evidence/information required before approval
- [ ] map usual HHA edit reason/category
- [ ] define approver by correction type
- [ ] define second-review cases
- [ ] define cases that remain HHA-only
- [ ] define required audit-history details

Classify every correction:

- [ ] manual in HHA only
- [ ] PTHHS may suggest only
- [ ] PTHHS may submit after manager approval
- [ ] potentially automatable later under explicit conditions

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

Answer the actual workflow:

- [ ] when a visit is considered completed
- [ ] when it is considered EVV-ready/compliant
- [ ] what prevents billing
- [ ] when it is actually billed/submitted
- [ ] statuses meaning held/rejected/pending/outstanding/paid
- [ ] how collections are followed up

Define:

- [ ] service codes billed by PTHHS
- [ ] unit/hour conversion rules
- [ ] authoritative rate sources
- [ ] visit conditions blocking billing
- [ ] what management considers AR
- [ ] collection statuses that matter
- [ ] AR aging buckets
- [ ] weekly/monthly billable-hour projections
- [ ] desired revenue projections
- [ ] forecast assumptions: scheduled / authorized / historical / mixed

**Deliverable:** approved billing-state flow and formulas.

---

# Staffing rules

## Hard restrictions

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
- [ ] travel distance
- [ ] continuity of care
- [ ] preferred work area
- [ ] workload balancing
- [ ] overtime avoidance
- [ ] patient preference
- [ ] relevant language/skill preference

For every factor:

- [ ] hard exclusion vs ranking preference
- [ ] relative importance
- [ ] who may override
- [ ] whether override needs a reason

Open-shift workflow:

- [ ] who sees it first
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
- [ ] missing clock-ins
- [ ] missing clock-outs
- [ ] late arrivals
- [ ] unconfirmed visits
- [ ] documentation/POC issues
- [ ] open shifts
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

Developer owns infrastructure; owner defines fallback operations.

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

- [ ] **NOW:** document daily EVV/visit review.
- [ ] list common EVV exceptions + current resolution steps.
- [ ] define clock thresholds.
- [ ] define employee-visible vs manager-only alerts.
- [ ] define correction approvers.
- [ ] explain authorization checks used before scheduling/billing.
- [ ] explain exactly what makes a completed visit billing-ready.
- [ ] list hard staffing eligibility rules.
- [ ] list compliance items that block scheduling.
- [ ] rank first dashboard metrics.

**Immediate handoff target:** OPS-001 through OPS-005 should be complete before the developer starts implementing the first exception rules.
