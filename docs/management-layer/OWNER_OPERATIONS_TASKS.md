# PTHHS Management Layer — Owner / Operations Task Track

> **Primary owner:** PTHHS Owner / Operations Lead
>
> **Purpose:** Define how PTHHS actually operates so the developer can implement the correct rules. This file is for operational, clinical/management, billing, staffing, compliance, escalation, and approval decisions — not code.

## Start here

Read these alongside this task list:

- [`DEVELOPER_TASKS.md`](./DEVELOPER_TASKS.md) — what the developer is responsible for implementing.
- [`../../hharefs/endpoints.html`](../../hharefs/endpoints.html) — **HHA capability map**. This is the fast reference for what ENT v1.8 exposes: visits/EVV, schedules, authorizations, caregiver availability, billing/payroll visit data, collections, compliance, documents, POC-related operations, and more.
- [`../../hharefs/hha-wdsl.xml`](../../hharefs/hha-wdsl.xml) — **exact HHA SOAP contract**. The developer uses this to inspect exact request/response fields, authentication structures, errors, and operation signatures before implementing a workflow.

**Rule of thumb:** `endpoints.html` tells us *what HHA can do*; `hha-wdsl.xml` tells the developer *exactly how HHA expects it to be done*.

The developer should not invent business rules. Your job is to define each rule clearly enough that it can be implemented and tested.

For operational decisions, try to specify:

- trigger
- threshold or timing
- exceptions
- who can see it
- who can act on it
- what happens next
- escalation path
- what counts as resolved
- whether automation is ever allowed

Use de-identified examples in repository documentation.

---

# 1. Define roles and permissions

- [ ] List the real roles used at PTHHS: owner, administrator, scheduler/coordinator, clinical reviewer, field staff, billing/collections, compliance/HR, etc.
- [ ] Define what each role may view.
- [ ] Define who may view management-only EVV discrepancies.
- [ ] Define who may approve visit/EVV corrections.
- [ ] Define who may change schedules.
- [ ] Define who may view billing/AR information.
- [ ] Define who may view caregiver compliance information.
- [ ] Define who may view visit-location evidence.
- [ ] Identify actions that require owner approval.

**Deliverable:** a simple role-permission matrix.

---

# 2. Document the current HHAeXchange workflow

Explain what staff actually do today for:

- [ ] daily visit review
- [ ] clock-in/clock-out review
- [ ] EVV exception correction
- [ ] visit confirmation
- [ ] visit documentation issues
- [ ] authorizations
- [ ] missed visits
- [ ] billing readiness
- [ ] collections/AR follow-up
- [ ] caregiver availability
- [ ] open-shift staffing
- [ ] caregiver compliance

For each workflow answer:

1. Who performs it?
2. How often?
3. What information do they check?
4. What decision do they make?
5. What action follows?
6. What problems or delays happen most often?

**Deliverable:** plain-language current-state workflow notes.

---

# 3. Validate imported HHA data

Once the developer has read-only HHA synchronization, review representative de-identified records and confirm:

- [ ] patient matching is correct
- [ ] employee/caregiver matching is correct
- [ ] scheduled start/end is correct
- [ ] actual visit start/end is correct
- [ ] clock-in/out interpretation is correct
- [ ] visit confirmation state is correct
- [ ] service/discipline interpretation is correct
- [ ] authorization interpretation is correct
- [ ] edit/deletion/correction fields make operational sense
- [ ] billing-related visit fields are interpreted correctly

Mark each reviewed item as **correct**, **incorrect**, or **needs HHA clarification**.

**Important:** do not approve automated exception logic until the underlying HHA data interpretation is trusted.

---

# 4. Define EVV and visit exception rules

This is one of the highest-priority owner tasks.

## Missing clock-in

- [ ] How many minutes after scheduled start before it becomes a concern?
- [ ] When should the employee be contacted?
- [ ] When should management be alerted?
- [ ] Are there service types where the rule differs?
- [ ] What counts as resolved?

## Missing clock-out

- [ ] How long after expected end before a reminder/alert?
- [ ] Who sees it first?
- [ ] When does it escalate?

## Late clock-in

- [ ] What lateness threshold matters?
- [ ] Is there a grace period?
- [ ] Are repeated occurrences treated differently?

## Early clock-out / short visit

- [ ] What variance is acceptable?
- [ ] Does it depend on service type or authorization?
- [ ] When is documentation or correction required?

## Long visit / late clock-out

- [ ] What variance requires review?
- [ ] What are legitimate exceptions?
- [ ] When does authorization become a concern?

## Unconfirmed visit

- [ ] When should a completed visit be confirmed?
- [ ] Who owns confirmation?
- [ ] What makes an unconfirmed visit urgent?

## Documentation / POC issues

- [ ] Which documentation/tasks are required for the services PTHHS provides?
- [ ] Which missing items block billing?
- [ ] Which require clinical or management review?
- [ ] Who may resolve them?

## Visit corrections

- [ ] Which corrections are routine?
- [ ] Which require management approval?
- [ ] Which require clinical approval?
- [ ] Which should never be automated?
- [ ] What reason/explanation is required for each type?

For every approved exception rule, provide:

| Field | Decision |
|---|---|
| Rule name | ___ |
| Trigger | ___ |
| Grace period / threshold | ___ |
| Employee sees it? | Yes / No |
| Manager sees it? | Yes / No |
| Escalation | ___ |
| Resolution | ___ |
| May system automate it? | Never / Later / Approved conditions |

---

# 5. Define messaging and escalation

For each operational exception decide:

- [ ] whether the employee receives a message
- [ ] whether it is management-only
- [ ] whether billing/compliance is involved
- [ ] when the first message is sent
- [ ] whether reminders repeat
- [ ] when reminders stop
- [ ] whether acknowledgement is required
- [ ] when the issue escalates
- [ ] who receives the escalation
- [ ] approved wording or message intent

Prioritize rules for:

- missing clock-in
- missing clock-out
- late arrival
- schedule change/cancellation
- open-shift offer
- incomplete visit documentation
- authorization warning
- HHA/integration outage affecting workflow

Explicitly list issues that should remain **manager-only** until reviewed.

**Deliverable:** alert matrix with audience, timing, escalation, and message intent.

---

# 6. Define HHA correction/write-back policy

Before the developer enables HHA writes:

- [ ] List the visit/EVV corrections managers currently perform in HHA.
- [ ] Identify what information is needed before each correction is approved.
- [ ] Identify the usual HHA edit reason/category.
- [ ] Identify who may approve each correction.
- [ ] Identify whether a second reviewer is ever required.
- [ ] Define cases that should still be handled directly in HHA.
- [ ] Define what information management wants retained in the audit history.

Classify every correction as one of:

- manual in HHA only
- PTHHS may suggest but not submit
- PTHHS may submit after manager approval
- potentially automatable later under approved conditions

**Deliverable:** correction approval matrix.

---

# 7. Define authorization rules

Document how PTHHS currently thinks about:

- [ ] authorized units/hours
- [ ] used units/hours
- [ ] scheduled future units/hours
- [ ] remaining units/hours
- [ ] effective and expiration dates
- [ ] overlapping/replacement authorizations
- [ ] service-specific limits
- [ ] situations where scheduled work may exceed authorization

Define warning conditions such as:

- authorization expires within ___ days
- remaining units below ___
- future schedule will exceed remaining authorization by ___
- missing authorization before scheduled service

**Deliverable:** approved authorization calculations and warning thresholds.

---

# 8. Define billing, billable-hours, and AR logic

Describe the actual billing pipeline in plain language:

1. When is a visit considered completed?
2. When is it considered EVV-ready/compliant?
3. What prevents it from being billable?
4. When is it actually billed/submitted?
5. Which statuses mean held, rejected, pending, outstanding, or paid?
6. How are collections followed up?

Then define:

- [ ] service codes PTHHS bills
- [ ] unit/hour conversion rules
- [ ] authoritative rate sources
- [ ] visit conditions that block billing
- [ ] what counts as AR
- [ ] collection statuses management cares about
- [ ] desired AR aging buckets
- [ ] desired weekly/monthly billable-hour projections
- [ ] desired revenue projections
- [ ] whether forecasts use scheduled, authorized, historical, or mixed assumptions

**Deliverable:** approved billing-state flow and formulas.

Example starting point:

`Scheduled → Completed → EVV Reviewed → Billing Ready → Submitted → Outstanding → Paid`

Adjust this to match the real PTHHS process.

---

# 9. Define staffing rules

Split staffing logic into **hard restrictions** and **preferences**.

## Hard restrictions

Decide which are absolute:

- required discipline/role
- required training/competency
- missing/expired compliance item
- unavailable at visit time
- conflicting assignment
- patient restriction
- employee restriction
- service-specific eligibility
- maximum-hours/overtime rule, if absolute

## Preferences / ranking factors

Decide which should influence ranking:

- existing patient relationship
- travel distance
- continuity of care
- preferred work area
- workload balancing
- overtime avoidance
- patient preference
- relevant language/skill preference

For each factor define:

- [ ] hard exclusion or ranking preference?
- [ ] how important is it?
- [ ] who may override it?
- [ ] does an override require a reason?

Also define the open-shift process:

- [ ] who sees an open visit first
- [ ] whether one or multiple employees receive an offer
- [ ] how long an offer remains open
- [ ] what happens when nobody accepts
- [ ] who makes the final assignment

**Deliverable:** staffing eligibility matrix plus ranked preference list.

---

# 10. Define caregiver compliance behavior

- [ ] List compliance/credential items management actually tracks.
- [ ] Identify which items make a caregiver ineligible for scheduling when missing/expired.
- [ ] Identify which items should warn but not block scheduling.
- [ ] Define expiration-warning windows.
- [ ] Identify who receives compliance alerts.
- [ ] Define who, if anyone, may override a block.
- [ ] Define what clears/resolves a compliance issue.

**Deliverable:** compliance matrix with blocking/warning behavior.

---

# 11. Define visit-location evidence policy

Keep this focused on visit verification rather than unnecessary continuous tracking.

- [ ] Confirm which workflows need location evidence.
- [ ] Explain how location discrepancies are handled today.
- [ ] Define whether distance from the expected visit location matters and the appropriate tolerance.
- [ ] List legitimate alternate-location scenarios, if applicable.
- [ ] Define who may view location evidence.
- [ ] Define whether employees should see a discrepancy before management review.

**Deliverable:** location-evidence and visibility rules.

---

# 12. Rank the management dashboard

Rank these as **P0 / P1 / P2** based on what management actually needs to act on:

- active visits now
- starting soon
- missing clock-ins
- missing clock-outs
- late arrivals
- unconfirmed visits
- documentation/POC issues
- open shifts
- caregiver compliance issues
- authorization at-risk count
- projected authorization overage
- billable hours this week
- billing blocked by exceptions
- outstanding AR
- HHA integration health

For each P0 metric answer:

- Who owns the response?
- What action should they take?
- How quickly should they act?

**Deliverable:** prioritized dashboard requirements.

---

# 13. Production and outage workflow

The developer owns infrastructure implementation. You define the operational fallback.

- [ ] Define who should have production administrative access.
- [ ] Define acceptable downtime for the management layer.
- [ ] Define what staff should do if the PTHHS management layer is unavailable but HHAExchange is available.
- [ ] Define what staff should do if HHAExchange is unavailable.
- [ ] Identify which management functions are essential during an outage.
- [ ] Confirm organizational hosting/security requirements before production use.

**Deliverable:** production approval and outage fallback checklist.

---

# Owner acceptance checklist

Before calling a management feature operationally complete:

- [ ] Normal case behaves correctly.
- [ ] Missing/late-data case behaves correctly.
- [ ] Legitimate exceptions do not create harmful false alarms.
- [ ] Employee-facing information is appropriate.
- [ ] Manager-only information stays manager-only.
- [ ] Management can understand why the system raised an issue.
- [ ] Resolution matches real PTHHS workflow.
- [ ] Message wording is approved.
- [ ] Audit history contains what management needs.
- [ ] Any automatic action is explicitly approved.

---

# Highest-priority owner tasks right now

The developer can begin the SOAP/integration foundation immediately. In parallel, complete these first:

1. [ ] Document the current daily EVV/visit review workflow.
2. [ ] List the most common EVV exceptions and how managers currently resolve each one.
3. [ ] Define missing/late clock-in and missing clock-out thresholds.
4. [ ] Separate employee-visible alerts from manager-only alerts.
5. [ ] Define who may approve visit/EVV corrections.
6. [ ] Explain how management checks authorization before scheduling/billing.
7. [ ] Explain exactly what makes a completed visit billing-ready.
8. [ ] List the hard rules used to decide whether an employee can cover a visit.
9. [ ] Identify caregiver compliance items that should block scheduling.
10. [ ] Rank the first management dashboard metrics.

**Immediate handoff target:** by the time the developer has read-only schedule and visit synchronization working, items 1–5 above should be documented so the first exception engine can be implemented without guesswork.
