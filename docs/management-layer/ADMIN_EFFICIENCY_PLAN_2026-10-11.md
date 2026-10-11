# Administrative efficiency and live-data delivery plan
Updated 2026-10-11. Status: researched implementation specification; not proof of implemented automation or measured savings.

## Release priority: trustworthy Demo / Live mode
The immediate release priority is a working source boundary for the administrator dashboard.
- Demo uses only labeled synthetic fixtures. Live uses authenticated, authorized server responses.
- Switching to Live immediately clears all demo numbers, charts, cached cards and details. Never retain samples while loading.
- Model disconnected, unauthorized, source-contract-blocked, loading, partial, stale, empty and successful responses separately. Unknown must never become zero.
- Show source, office, retrieval time, completeness and reporting period beside each live metric.
- Abort and fence in-flight responses on mode, office, account or session changes. A late Demo response cannot populate Live, and a late prior-office response cannot populate another office.
- Persisting a mode preference must not persist PHI or confer permission. Default live access remains server-verified.
- Financial data with no reconciled source remains unavailable; do not replace demo profit with billed amounts.
- Recover and review the existing local visit-preview work before creating duplicate implementations.
- Release acceptance: normal mailbox sign-in, protected session, office routing, harmless HHA reference request, accepted operational-source contract and approved storage. Never mint privileged credentials or bypass gates to make Live appear connected.
- Tests: Demo->Live->Demo, repeated toggles, failed login, expired session, offline/timeout/403, empty/partial results, out-of-order responses, wrong office, restart and stale cache. Live displays no synthetic values in any case.

## Repository evidence
Read-only audit of main at e3ff0bbb5ca43c12baea6c3aebc16fd815a95e66 found protected sessions, typed SOAP reads, source-contract gates, quota controls, sync foundations, an EVV rules function and a notification planner. These are not complete live operational automation.
The main branch does not contain the local preview's dashboard.js, demo-data.js, data-source.js or functions/src/views/visits.ts, nor /data/status and /views/visits routes.
The current staffing evidence method takes 1-3 entered caregiver IDs and reports eligibility not determined, no ranking and no assignment change.
The latest administrator handoff supersedes older setup blockers: email-link/domain and artifact-cleanup setup are recorded complete. Protected owner-session and HHA acceptance remain distinct.
See [revision specification](PRIMETIME_ADMIN_DASHBOARD_REVISION_SPEC.md), [handoff](FIRST_ADMIN_HANDOFF.md), [capability matrix](HHA_CAPABILITY_MATRIX.md).

## Measurement before staffing conclusions
Objective: release administrative capacity without degrading care, payroll accuracy, billing compliance or service coverage. No headcount reduction or savings is established by this plan.
Baseline ten business days spanning payroll/billing cutoffs; record volume, hands-on minutes, waiting, repeat touches, reopens and outcome by task.
- Weekly effort = task volume * mean handling minutes / 60.
- Net capacity released = volume-normalized baseline effort minus pilot effort, extra review, maintenance and rework.
- Report hours per 1,000 visits and per filled shift; caregiver count alone does not measure complexity.
- Pilot one payer/coordinator cohort in shadow mode using approved de-identified or synthetic inputs.
- Proposed pilot target: 30% lower selected-workflow handling time, with no deterioration in missed visits, critical errors, payroll timeliness, filing deadlines or collection outcomes. This is a target, not a forecast.
- Validate over multiple payroll/billing cycles before changing capacity assumptions. Do not rank people for termination.

## First two product slices
### 1. EVV exception desk
One office-scoped row per visit/problem with separate scheduled, actual, EVV and billable facts; evidence freshness; cause; assignee; next action; due time; notes and resolution history.
Bulk actions initially assign, tag and prepare evidence packets. They do not certify care or rewrite captured time.
Prioritize missing punches, source gaps, unbalanced visits, overlapping evidence, expiring maintenance windows and prebilling holds.
Use accepted complete windows for monitoring. Partial or stale reads produce unknown rather than invented absence.
A 15-minute confirmed-open-after-scheduled-end rule exists in the newer specification; leave unresolved early-departure thresholds unconfigured.
SMS requires approved provider, verified recipient and routing, consent/permissions, quiet hours, suppression, idempotent outbox, callbacks and audit. A planned notification is not a sent message.
Tests: 14:59/15:00/15:01, later clock-out cancellation, duplicate workers, overnight/DST, corrected/split/deleted visits, source completeness and office-policy fences.
Files: operations/workspace.ts, operations/reads.ts, operations/routes.ts, rules/evv.ts, scheduleComparison.ts, notifications/planner.ts, sync/*, persistence/firestore.ts, domain/models.ts and public/primetime UI.

### 2. Availability pool and coverage shortlist
Search confirmed availability, desired hours, work area, qualifications, existing assignments and contact recency. An empty calendar is not consent or proof of availability.
Show patient preferences/declines and continuity, schedule conflicts, weekly/pay-period hours and travel feasibility. No protected-characteristic ranking.
Every recommendation explains source and reason; unknown qualification, eligibility or incomplete schedule data needs review.
Human confirmation precedes assignment. Do not send offers or write schedules merely because someone appeared in a shortlist.
Test a synthetic 600+ caregiver roster with pagination, absences, special availability, overnight shifts, stale data, conflicts and concurrent edits.
Extend staffing/workspace reads with complete source scope and independent agency-owned availability records clearly labeled as such.

## Subsequent workflow modules
### Authorizations and eligibility
Validate authoritative payer evidence against member, payer/contract, dates, service/modifiers, unit type, limits and scheduled consumption.
Do not equate service name and ID without a validated catalog. Do not convert units/hours with a universal formula.
Route duplicate or overlapping authorizations for review rather than rejecting automatically.
Store eligibility source, applicable service date and response timestamp separately from authorization. Active today does not establish earlier-date coverage.
FFS imports, MCO manual entry and payer-controlled linked authorizations differ; verify each actual contract before writeback.

### Visit-to-cash and management reports
Keep distinct states: delivered -> documented -> aggregator accepted -> submitted -> matched -> adjudicated -> paid/reconciled.
Build reports for exception aging, unstaffed visits, unused/expiring authorizations, eligibility evidence gaps, billing holds, denials, underpayments, receivables aging and payroll reconciliation.
Actual cash requires remittance/payment evidence, not collection-status catalogs. Profit needs rates, payroll burden, expenses and reconciled revenue recognition.
Separate estimates from posted amounts and provide drill-through plus exported reconciliation totals.
Use 835/remittance and payment sources only after authorized onboarding; EVV matching never guarantees payment.

### Caregiver/client lifecycle
Use reversible effective-dated statuses: draft, active, suspended, ended/terminated as applicable. Preserve historical visits, payroll, claims, authorizations and audit history.
Before ending a record, review future shifts, open visits, unpaid payroll/claims, linked authorizations, access and reassignment needs.
No automatic employment decision, patient discharge or irreversible deletion based on a heuristic.
Retention and legal holds are program-specific; website artifact cleanup is not a clinical/payroll-record retention policy.

## Engineering issues to resolve before scale
Read-only findings, not reproduced runtime failures:
1. Workspace query and SOAP beforeRequest appear to reserve the same read quota twice. Verify with dispatch-count tests and charge one actual dispatch once, including retry behavior.
2. Visit evidence checks returned VisitID without a complete patient/office join. Staffing also requires returned-subject authorization. Add cross-office and late-policy-response negative tests.
3. Existing adapter prefers EVV timestamps into actualStart/End. Preserve distinct meanings before using it for the combined visit view.
4. GetVisitChangesV5 and several verification/mutation routes remain contract-blocked. Preview V2/V3/V4 responses do not prove completeness or checkpoint advancement.
Never remove these gates just to make dashboard cards populate.

## Payment and compliance rule design
No universal 80/20 or 90/10 gross-agency-revenue split should be hard-coded.
- Texas Rider 23 ended the former enhancement program effective September 2025. The replacement 0.90 measure uses relevant direct-care expenses and payments attributable to specified direct-care compensation components; it is not a universal 10% profit/admin cap. Agency applicability and cost-center mapping require its qualified preparer.
- Federal Access Rule 80% payment adequacy generally begins July 9, 2030, with managed-care rating-period rules. It covers specified HCBS services/authorities and defined compensation and excluded costs, not all agency revenue.
- CMS October 9, 2026 guidance says the first 2028 compensation reporting period uses calendar-year 2027. Prepare classified source data from January 2027 where applicable; keep Texas reporting periods distinct.
- Version rules by program, payer, authority, effective date and reporting period. Never relabel unrelated administrative work as direct care.
Sources: [Texas budget Rider 23, Article II-57](https://www.lbb.texas.gov/Documents/Appropriations_Bills/89/Final/General_Appropriations_Act_2026_2027.pdf), [HHSC/TMHP change notice](https://www.tmhp.com/news/2025-11-10-il-2025-25-now-published-regarding-hhsc-rider-23-2026-2027-general-appropriations), [42 CFR 441.302](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-C/part-441/subpart-G/section-441.302), [CMS October guidance](https://www.medicaid.gov/Federal-Policy-Guidance/Downloads/SMD26005.pdf), [CMS technical specifications](https://www.medicaid.gov/medicaid/access-care/downloads/tech-specs-hcbs-08102026.pdf).

### EVV and retention controls
Preserve original actual service date, clock-in/out, actual hours and GPS during maintenance. Corrections require reasons/evidence and audit.
The usual maintenance window is 95 calendar days; payer-approved late unlock does not extend claims filing. Post-billing corrections require claim reconciliation.
Keep worked time, payroll and billable rounded units separate.
Applicable community-services retention under 26 TAC 52.113 can run until the latest of seven years after claim, seven years after issues mitigated, or age 21. Other licensing/contract/legal-hold rules also apply; select the longest applicable retention, not blanket five years.
Sources: [HHSC maintenance](https://fhb.hhs.texas.gov/handbooks/electronic-visit-verification-policy-handbook/9000-visit-maintenance), [bill-hours rules](https://fhb.hhs.texas.gov/handbooks/electronic-visit-verification-policy-handbook/8000-calculation-bill-hours), [May 2026 retention bulletin](https://content.govdelivery.com/accounts/TXHHSC/bulletins/4126193).

## Future owned platform and skilled services
Own the original application code and data model; track dependency licenses and contractual IP ownership. Do not copy proprietary HHA software.
Separate adapters, immutable source facts, normalized records, deterministic rules, queues and audited commands. AI may draft summaries and extract proposed fields with source citations; uncertain values require review. No autonomous clinical decisions, certification of care or invented source facts.
PAS expansion into skilled home health requires appropriate HCSSA categories and clinical oversight. Medicare certification is an additional pathway. Clinical modules need qualified nurse oversight, orders, assessments, care plans, credentials and authorization/recertification workflows appropriate to the program.
An owned scheduler is not automatically an approved Texas EVV system. PSO v3.1 is current; v4.0 is effective April 1, 2027.
Sources: [HHSC licensing](https://hhs.texas.gov/node/2724), [TMHP nursing handbook](https://www.tmhp.com/sites/default/files/microsites/provider-manuals/tmppm/html/TMPPM/2_10_HH_Nursing_and_PDN_Srvs/2_10_HH_Nursing_and_PDN_Srvs.htm), [PSO rules](https://www.tmhp.com/topics/evv/evv-proprietary-systems/rules).

## Capability and onboarding evidence
Public documentation describes capabilities, not this tenant's entitlement or a successful connection.
- [HHA Texas integration overview](https://www.hhaexchange.com/info-hub/texas)
- [Texas API guide](https://hhaxsupport.s3.amazonaws.com/SupportDocs/EDI%20Guides/ProviderIntegration/HHAeXchange%20Web%20Service%20API%20-%20TX.pdf)
- [Native exception reports](https://knowledge.hhaexchange.com/texas/Content/Documentation/Reports/RP-N-Exception-Reports-Definitions-P.htm)
- [Caregiver search](https://knowledge.hhaexchange.com/texas/Content/Documentation/Visit/Visit-N-Caregiver-Search-S.htm)
- [TMHP EVV exports](https://www.tmhp.com/topics/evv/evv-aggregator-and-evv-portal)
- [TMHP eligibility](https://www.tmhp.com/sites/default/files/microsites/provider-manuals/tmppm/html/TMPPM/1_04_Client_Eligibility/1_04_Client_Eligibility.htm)
- [EDI onboarding](https://www.tmhp.com/topics/edi)

## Release checklist
- [x] Read-only repository gap audit and official-source research
- [x] Prioritized specification prepared
- [ ] Recover existing local preview and inspect current working tree
- [ ] Fix source scope/quota/time-projection foundations with tests
- [ ] Implement and test Demo/Live boundary without synthetic fallback
- [ ] Complete normal authenticated session and harmless HHA acceptance
- [ ] Validate approved operational sources/storage and read-only visit projection
- [ ] Run UI, backend, concurrency, isolation, accessibility and aggregate checks
- [ ] Push tested code to main and verify exact-commit deployment
- [ ] Run reversible pilot and report actual measured effort/outcomes

This document is a specification, not a completed implementation, legal determination, savings claim or production acceptance record.
