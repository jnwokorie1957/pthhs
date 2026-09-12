# PTHHS Management Layer — Developer Task Track

> **Primary owner:** Developer
>
> **Role boundary:** Own the technical architecture, implementation, security controls, integrations, testing infrastructure, deployment, and observability. Do **not** invent medical, operational, billing, EVV, compliance, or staffing rules. Those must be supplied or approved by the Owner/Operations track.

## Start here

Read these before implementation:

- [`OWNER_OPERATIONS_TASKS.md`](./OWNER_OPERATIONS_TASKS.md) — operational decisions and rules the system needs from the owner.
- [`../../hharefs/README.md`](../../hharefs/README.md) — HHAeXchange reference material and integration notes.
- [`../../hharefs/endpoints.html`](../../hharefs/endpoints.html) — saved ENT v1.8 operation index.
- [`../../hharefs/hha-wdsl.xml`](../../hharefs/hha-wdsl.xml) — saved ENT v1.8 WSDL.

## Non-negotiable technical rules

- HHAeXchange credentials are backend-only. Never expose `AppName`, `AppSecret`, or `AppKey` to the browser.
- Never commit live HHA credentials, PHI, patient records, production SOAP payloads, or employee location data to Git.
- Treat HHAeXchange as an external adapter, not the internal domain model.
- Start read-only. Add write-back only after the corresponding workflow has owner approval and audit requirements are defined.
- Every important write must follow **write → re-read → reconcile**.
- Every automated decision must be traceable to a named/configured rule and produce an audit event.
- Build the internal product so HHAeXchange can eventually be replaced without rewriting the management UI.

---

# Phase 0 — Repo and security foundation

## Developer tasks

- [ ] Inspect the existing backend/runtime and choose the server-side home for the HHA integration.
- [ ] Create an isolated HHA integration module, e.g. `integrations/hhaexchange/`.
- [ ] Add server-side configuration for:
  - `HHA_APP_NAME`
  - `HHA_APP_SECRET`
  - `HHA_APP_KEY`
  - `HHA_BASE_URL`
- [ ] Verify `.gitignore` and deployment tooling prevent secret files from being committed.
- [ ] Decide how production secrets will be stored on the VPS/deployment target.
- [ ] Add a redaction utility so PHI/secrets do not appear in ordinary logs.
- [ ] Define audit-log retention and immutable identifiers at the application level.

## Needs from Owner before phase completion

- [ ] Confirmation of who is allowed to see management-only information.
- [ ] Confirmation of who may eventually approve/write EVV corrections.
- [ ] Confirmation of what roles exist operationally (owner, administrator, scheduler, nurse, caregiver, billing, etc.).

## Definition of done

The application has a safe place to store HHA credentials, a clear integration boundary, and a role model that can be mapped to application permissions.

---

# Phase 1 — HHAeXchange SOAP adapter

## Developer tasks

- [ ] Build a reusable SOAP client against ENT v1.8.
- [ ] Implement `AppParams` authentication using `AppName`, `AppSecret`, and `AppKey`.
- [ ] Centralize SOAP envelope construction/parsing.
- [ ] Normalize HHA response status/error structures into internal error types.
- [ ] Handle `RetryAfter` and transient failures with bounded retries/backoff.
- [ ] Add request correlation IDs.
- [ ] Add per-operation timing/success/failure telemetry.
- [ ] Do not log full SOAP bodies by default.
- [ ] Create sanitized response fixtures for unit tests.
- [ ] Add a backend health check that can distinguish:
  - HHA reachable
  - authentication failed
  - HHA operation failed
  - sync stale
- [ ] Test one harmless/read-only operation before expanding coverage.

## Initial adapter modules

Prioritize wrappers for:

- visits / visit changes
- schedules
- caregivers
- patients
- authorizations
- caregiver availability
- billing/service codes

Do not expose raw SOAP types to frontend code.

## Definition of done

A single internal client can make authenticated HHA calls, parse results, normalize errors, and produce safe telemetry without leaking credentials or PHI.

---

# Phase 2 — Canonical PTHHS data model and sync framework

## Developer tasks

Design normalized internal entities at minimum for:

- [ ] `Employee`
- [ ] `Patient`
- [ ] `Schedule`
- [ ] `Visit`
- [ ] `ClockEvent`
- [ ] `VisitConfirmation`
- [ ] `VisitException`
- [ ] `Authorization`
- [ ] `CaregiverAvailability`
- [ ] `ServiceCode`
- [ ] `BillingRecord`
- [ ] `CollectionRecord`
- [ ] `Notification`
- [ ] `AuditEvent`
- [ ] `ExternalReference`
- [ ] `IntegrationSync`

Each HHA-derived record should retain enough external metadata to reconcile later, such as:

- source system
- HHA external ID
- source update timestamp, if available
- last successful sync timestamp
- payload/version hash where useful

## Sync framework

- [ ] Create incremental sync jobs with explicit cursors/checkpoints.
- [ ] Ensure checkpoints advance only after a successful transaction/batch.
- [ ] Make imports idempotent.
- [ ] Add a manual resync/reconciliation mechanism.
- [ ] Add a dead-letter/error state for records that cannot be normalized.
- [ ] Add integration status visible to administrators.
- [ ] Add periodic full/targeted reconciliation separate from incremental sync.

## Needs from Owner

- [ ] Which HHA records are operationally authoritative when internal data conflicts.
- [ ] Which identifiers staff actually use to recognize patients/employees/visits.
- [ ] Which data fields management needs visible versus hidden.

## Definition of done

PTHHS can mirror HHA data into a vendor-neutral operational database without tying the application schema directly to SOAP structures.

---

# Phase 3 — Read-only operations mirror / EVV foundation

## Developer tasks

Implement read-only synchronization in this order unless the real WSDL/account behavior forces a change:

1. [ ] Visit changes / visit info
2. [ ] Schedule info
3. [ ] Caregiver info
4. [ ] Patient info
5. [ ] Authorizations
6. [ ] Availability
7. [ ] Service/billing reference data

For visits:

- [ ] Prefer the newest compatible `GetVisitChanges*` operation available to the account.
- [ ] Store clock-in/clock-out evidence separately from the high-level visit record where the payload supports it.
- [ ] Store edit/deletion/confirmation state required for audit and exception review.
- [ ] Capture billing/payroll-related visit fields only as needed and with restricted access.

For schedules:

- [ ] Preserve scheduled start/end, assigned employee, patient, service, and linkage needed to compare expected vs actual.

## Owner validation checkpoint

Before exceptions are generated, give the owner a read-only UI/export showing representative synced schedules and visits. The owner must confirm the system is interpreting the data correctly.

## Definition of done

For a selected day, the system can reliably answer:

- who was scheduled
- who actually visited
- clock-in/out information available from HHA
- whether a visit is confirmed
- which authorization/service context applies

without writing anything back to HHA.

---

# Phase 4 — Configurable EVV/visit exception engine

## Developer tasks

Create a rule engine; do not hard-code business decisions into UI components.

Initial rule identifiers may include:

- `EVV_NO_CLOCK_IN`
- `EVV_NO_CLOCK_OUT`
- `EVV_LATE_CLOCK_IN`
- `EVV_EARLY_CLOCK_OUT`
- `EVV_SHORT_VISIT`
- `EVV_LONG_VISIT`
- `VISIT_UNCONFIRMED`
- `VISIT_EDIT_REQUIRED`
- `AUTHORIZATION_MISSING`
- `AUTHORIZATION_AT_RISK`
- `DOCUMENTATION_MISSING`
- `POC_TASK_MISSING`
- `INTEGRATION_ERROR`

Each rule should support configuration such as:

- enabled/disabled
- severity
- threshold/grace period
- employee-visible vs manager-only
- notification behavior
- escalation timing
- requires human review
- eligible for future automation

## Critical boundary

The **Owner** defines what constitutes a real exception, threshold, severity, appropriate message, escalation, and resolution workflow. The **Developer** implements that approved logic safely and configurably.

## Definition of done

The system can generate reproducible exceptions from synchronized facts, explain why each exception exists, and show which rule/version created it.

---

# Phase 5 — Operations dashboard and messaging infrastructure

## Developer tasks

Build an operations dashboard around events and exceptions rather than duplicating HHA menus.

Suggested initial views:

- [ ] active visits
- [ ] upcoming visits
- [ ] missing/late clock-ins
- [ ] missing clock-outs
- [ ] unconfirmed visits
- [ ] authorization warnings
- [ ] integration health

Messaging architecture:

- [ ] Create notification events independent of delivery channel.
- [ ] Support audience scopes such as employee, manager-only, billing-only, admin-only.
- [ ] Add deduplication/suppression so the same issue does not spam staff.
- [ ] Add acknowledgement state where operationally required.
- [ ] Add escalation timers.
- [ ] Keep message templates configurable.
- [ ] Log delivery result and the rule/event that triggered each message.

## Needs from Owner

- [ ] Message wording.
- [ ] Which alerts employees may see.
- [ ] Which alerts are manager-only.
- [ ] Grace periods and escalation paths.
- [ ] When not to message an employee.
- [ ] Which alerts require acknowledgement.

## Definition of done

Managers can understand today's operational status quickly, and alerts can be generated from approved rules without exposing manager-only information to employees.

---

# Phase 6 — Assisted HHA write-back

## Developer tasks

Do not implement this until owner-approved workflows exist.

- [ ] Map allowed HHA confirmation/correction operations and required edit reasons.
- [ ] Add explicit authorization checks around every write operation.
- [ ] Require a reason/comment where operational policy requires one.
- [ ] Store before/after state and approving user.
- [ ] Submit the write to HHA.
- [ ] Re-read the record from HHA.
- [ ] Reconcile expected vs actual state.
- [ ] Surface failure clearly; never silently assume success.
- [ ] Add replay protection/idempotency for repeated user clicks or retries.

## Rollout order

1. manager-reviewed suggestions
2. manager-approved write-back
3. limited automation for low-risk, owner-approved cases only

## Definition of done

A permitted manager can resolve a supported exception from PTHHS with a complete audit trail and verified HHA state afterward.

---

# Phase 7 — Authorization and billing intelligence

## Developer tasks

- [ ] Sync authorization state and changes.
- [ ] Compute used vs scheduled vs remaining units/hours using owner-approved rules.
- [ ] Flag projected overages/shortfalls.
- [ ] Sync visit bill information and billing service codes.
- [ ] Model the pipeline from scheduled → completed → compliant → billable → billed → outstanding → collected as available.
- [ ] Add AR/collection fields only from verified source data.
- [ ] Build forecasts with transparent formulas and source labels.
- [ ] Never present an estimate as a posted/paid financial fact.

## Needs from Owner

- [ ] How service units convert to billable units/hours.
- [ ] Which rates are authoritative.
- [ ] What makes a visit billable/non-billable operationally.
- [ ] Which statuses correspond to actual billing/AR stages in current workflow.
- [ ] Which projections management actually wants.

## Definition of done

Management can distinguish completed work, billable work, blocked work, billed work, outstanding AR, and projections without confusing estimates with accounting truth.

---

# Phase 8 — Staffing recommendation engine

## Developer tasks

Start with recommendations, not automatic assignment.

Candidate ranking inputs may include:

- availability
- discipline/role eligibility
- compliance eligibility
- existing schedule conflicts
- projected overtime/workload
- geography/travel time if approved
- patient restrictions/preferences supplied by operations
- continuity/history

- [ ] Make the scoring components visible/explainable to management.
- [ ] Allow owner-adjustable weights/constraints where appropriate.
- [ ] Never let the model override a hard operational/clinical/compliance restriction.
- [ ] Add manual confirmation before assignment initially.

## Needs from Owner

- [ ] Hard eligibility rules.
- [ ] Soft preference rules.
- [ ] What availability means in practice.
- [ ] Overtime/workload limits.
- [ ] Patient-specific restrictions/preferences that are appropriate to encode.
- [ ] Which rules are mandatory vs ranking preferences.

## Definition of done

An uncovered visit produces a ranked, explainable list of eligible staff that management can accept or reject.

---

# Phase 9 — VPS / production hardening

This work starts lightly during Phase 0 but becomes a formal production gate here.

## Developer tasks

- [ ] Separate application, worker, and database concerns appropriately.
- [ ] Encrypt network traffic in transit.
- [ ] Encrypt sensitive data at rest where supported/required.
- [ ] Implement backups and test restore procedures.
- [ ] Add monitoring/alerting for app, database, worker, and HHA sync failures.
- [ ] Add deployment automation with rollback.
- [ ] Apply least-privilege service accounts.
- [ ] Restrict production access.
- [ ] Add environment separation (development/staging/production).
- [ ] Add log retention/redaction policy.
- [ ] Document disaster recovery steps.
- [ ] Review hosting/BAA/compliance requirements with the owner before PHI is placed on any new provider.

## Definition of done

The production environment is repeatable, backed up, monitored, restricted, recoverable, and approved for the data the system will store.

---

# Handoff checklist: Developer → Owner

For every feature presented for owner validation, provide:

- [ ] Plain-language description of what the system currently does.
- [ ] Screenshots/demo using de-identified or synthetic data where possible.
- [ ] Exact rule/threshold currently configured.
- [ ] Data source for each displayed fact.
- [ ] Known edge cases.
- [ ] What action, if any, the system will take automatically.
- [ ] What will be written back to HHA, if anything.
- [ ] Explicit questions requiring an operational/medical/management decision.

# Handoff checklist: Owner → Developer

Do not code a business rule from a vague answer. Ask the owner to provide or approve:

- trigger
- threshold
- exceptions to the rule
- who can see it
- who can act on it
- message wording if applicable
- escalation path
- definition of resolved
- whether automation is ever allowed

# First implementation sprint

The recommended immediate technical sprint is:

- [ ] Inspect current backend/deployment stack.
- [ ] Create HHA integration module and secure config.
- [ ] Build reusable SOAP client/auth/error normalization.
- [ ] Prove one read-only authenticated call.
- [ ] Create initial normalized schema for schedules, visits, clock events, employees, patients, authorizations, and external references.
- [ ] Implement visit-change sync.
- [ ] Implement schedule sync.
- [ ] Produce a read-only internal comparison of schedule vs actual visit.
- [ ] Give the owner representative records to validate before any exception thresholds are coded.

**Stop condition for Sprint 1:** do not implement automated EVV corrections or employee messaging until the owner completes the corresponding decisions in `OWNER_OPERATIONS_TASKS.md`.
