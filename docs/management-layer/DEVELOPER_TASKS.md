# PTHHS Management Layer — Developer Checklist

> **Primary owner:** Developer
>
> **Role boundary:** Own architecture, implementation, security controls, integrations, testing, deployment, and observability. Do **not** invent medical, EVV, billing, compliance, staffing, or management rules; those come from the Owner / Operations checklist.

## How this checklist is used

- `[x]` = completed and verified by repo evidence or explicit user confirmation.
- `[ ]` = pending.
- A pending item marked **BLOCKED** must not be skipped; complete the named dependency first.
- When an item is completed, mark it `[x]`, update the root `README.md` checkpoint, and prompt the responsible person with the next actionable item.
- Do not reopen a completed item unless new evidence shows it is wrong.

## Start here

- [`OWNER_OPERATIONS_TASKS.md`](./OWNER_OPERATIONS_TASKS.md) — operational/medical/management decisions.
- [`../../hharefs/endpoints.html`](../../hharefs/endpoints.html) — HHA ENT v1.8 capability map: use it to discover **what operations exist**.
- [`../../hharefs/hha-wdsl.xml`](../../hharefs/hha-wdsl.xml) — HHA ENT v1.8 WSDL: use it to determine **exact request/response schemas and SOAP behavior**.

> `endpoints.html` tells us what exists. `hha-wdsl.xml` tells us exactly how to implement it.

---

# Current checkpoint — Foundation

- [x] **DEV-001 — Management route fixed at `/primetime`.** User confirmed the admin panel lives at `/primetime` on the root domain. All new management UI/API work must remain in this namespace.
- [x] **DEV-002 — Server-side HHA module scaffolded.** Firebase Functions source now lives under `functions/`, with HHA-specific code isolated under `functions/src/integrations/hhaexchange/`.
- [x] **DEV-003 — Runtime configuration contract created.** HHA credentials are defined as the runtime-only `HHAEXCHANGE_CREDENTIALS` JSON secret; HHA endpoint is `HHAEXCHANGE_BASE_URL` with the ENT v1.8 production URL as default.
- [x] **DEV-004 — Initial vendor-neutral domain schema created.** See `functions/src/domain/models.ts` for employees, patients, schedules, visits, clock events, authorizations, availability, billing/collections, audit, sync, notification, and exception models.
- [ ] **DEV-005 — Confirm the live Firebase project and create runtime secret.** **CURRENT DEVELOPER ACTION.** The deploy workflow targets `primetimehomehealthservices`, while `.firebaserc` currently says `pthhs-net`. Confirm which project owns the live `/primetime` panel, then create `HHAEXCHANGE_CREDENTIALS` in that project's Google Cloud Secret Manager / Firebase Functions secrets.
- [ ] **DEV-006 — Verify existing `/primetime` authentication mechanism.** **BLOCKED by DEV-005 / admin source visibility.** Identify how the current admin panel authenticates users so `/primetime/api/*` can enforce the same or stronger server-side authorization. Route placement alone is not an authentication boundary.
- [ ] **DEV-007 — Activate the Firebase backend route.** **BLOCKED by DEV-005 and DEV-006.** Configure Functions in `firebase.json`, route `/primetime/api/**` to `primetimeApi`, and update deployment so Functions are deployed without destabilizing the existing Hosting pipeline.
- [ ] **DEV-008 — Finish SOAP response parsing/error normalization.** Parse HHA `Result`, `ErrorInfo`, `ErrorID`, `ErrorMessage`, `RetryAfter`, SOAP faults, and operation results into typed internal responses. Add redaction, correlation IDs, bounded retry/backoff, and safe telemetry.
- [ ] **DEV-009 — Make the first harmless read-only HHA call.** **BLOCKED by DEV-005 through DEV-008.** Verify authentication and parse a real response; do not write to HHA.

**Next milestone:** DEV-009 succeeds from the `/primetime` backend without exposing HHA credentials or PHI.

---

# Security / architecture rules

- [x] HHA credentials are backend-only; never expose `AppName`, `AppSecret`, or `AppKey` to browser code.
- [x] HHAExchange is modeled as an external adapter, not as the internal domain schema.
- [ ] Verify `.gitignore` covers local secret/emulator files before any credential setup.
- [ ] Add centralized log redaction before logging any real HHA request/response metadata.
- [ ] Define admin authorization middleware before adding credential-bearing API routes.
- [ ] Keep ordinary logs free of full SOAP bodies, PHI, patient records, and location evidence.
- [ ] Define immutable audit identifiers and retention policy with owner input.
- [ ] Every important future HHA write must follow **write → re-read → reconcile**.
- [ ] Every automated management decision must identify its rule/version and produce an audit event.

---

# HHA SOAP adapter

- [x] Create base HHA config module.
- [x] Create reusable SOAP envelope/transport scaffold.
- [x] Implement `AppParams` fields: `AppName`, `AppSecret`, `AppKey`.
- [ ] Add XML response parser.
- [ ] Add typed operation result parser.
- [ ] Normalize HHA application errors.
- [ ] Normalize SOAP/HTTP transport errors.
- [ ] Respect HHA/HTTP retry guidance including `RetryAfter` where supplied.
- [ ] Add bounded exponential backoff for retryable failures.
- [ ] Add request correlation IDs.
- [ ] Add per-operation timing/success/failure telemetry.
- [ ] Add sanitized fixtures for automated tests.
- [ ] Add authenticated HHA health status that distinguishes reachable/auth failure/operation failure/stale sync.

Initial endpoint wrappers, in priority order:

- [ ] visit changes / visit info
- [ ] schedule info
- [ ] caregivers
- [ ] patients
- [ ] patient authorizations
- [ ] caregiver availability
- [ ] billing/service-code reference data

---

# Canonical PTHHS data model

Initial interface layer:

- [x] `Employee`
- [x] `Patient`
- [x] `Schedule`
- [x] `Visit`
- [x] `ClockEvent`
- [x] `VisitConfirmation`
- [x] `VisitException`
- [x] `Authorization`
- [x] `CaregiverAvailability`
- [x] `ServiceCode`
- [x] `BillingRecord`
- [x] `CollectionRecord`
- [x] `Notification`
- [x] `AuditEvent`
- [x] `ExternalReference`
- [x] `IntegrationSync`

Persistence work still pending:

- [ ] Choose/confirm persistent database for management data.
- [ ] Turn domain interfaces into persistence schema/migrations/collections.
- [ ] Preserve HHA external IDs without using them as PTHHS primary IDs.
- [ ] Preserve source update timestamp where available.
- [ ] Preserve last successful sync timestamp.
- [ ] Add payload/version hash where useful for reconciliation.
- [ ] Add indexes for date-based visit/schedule operations and external-ID lookups.

---

# Sync framework

- [ ] Create explicit incremental sync cursors/checkpoints.
- [ ] Advance checkpoints only after successful batches.
- [ ] Make imports idempotent.
- [ ] Add manual resync/reconciliation.
- [ ] Add dead-letter/error state for records that fail normalization.
- [ ] Expose integration status to authorized admins under `/primetime`.
- [ ] Add periodic targeted/full reconciliation separate from incremental sync.

Read-only import order:

1. [ ] visit changes / visit info
2. [ ] schedule info
3. [ ] caregiver info
4. [ ] patient info
5. [ ] authorizations
6. [ ] caregiver availability
7. [ ] billing/service reference data

**Owner validation gate:** before implementing EVV rules, show representative synchronized schedule/visit records to the owner and get confirmation that the fields are interpreted correctly.

---

# EVV operations center

- [ ] Build schedule-vs-actual visit comparison.
- [ ] Expose clock evidence separately from high-level visit state where HHA supports it.
- [ ] Preserve confirmation/edit/deletion state needed for audit/review.
- [ ] Create configurable exception engine rather than UI-only conditionals.
- [ ] Store rule version with every generated exception.
- [ ] Support enabled/disabled, severity, threshold, audience, escalation, human-review requirement, and future automation eligibility.

Candidate rule IDs, subject to owner approval:

- [ ] `EVV_NO_CLOCK_IN`
- [ ] `EVV_NO_CLOCK_OUT`
- [ ] `EVV_LATE_CLOCK_IN`
- [ ] `EVV_EARLY_CLOCK_OUT`
- [ ] `EVV_SHORT_VISIT`
- [ ] `EVV_LONG_VISIT`
- [ ] `VISIT_UNCONFIRMED`
- [ ] `VISIT_EDIT_REQUIRED`
- [ ] `AUTHORIZATION_MISSING`
- [ ] `AUTHORIZATION_AT_RISK`
- [ ] `DOCUMENTATION_MISSING`
- [ ] `POC_TASK_MISSING`
- [ ] `INTEGRATION_ERROR`

**Do not choose thresholds yourself.** Implement the owner's approved rules from `OWNER_OPERATIONS_TASKS.md`.

---

# Dashboard and messaging

Dashboard:

- [ ] active visits
- [ ] upcoming visits
- [ ] missing/late clock-ins
- [ ] missing clock-outs
- [ ] unconfirmed visits
- [ ] authorization warnings
- [ ] HHA integration health

Messaging infrastructure:

- [ ] event-driven notification model independent of delivery channel
- [ ] employee / manager / billing / admin audiences
- [ ] deduplication and suppression
- [ ] acknowledgement state
- [ ] escalation timers
- [ ] configurable message templates
- [ ] delivery result audit trail
- [ ] manager-only data protected from employee-facing channels

---

# HHA write-back — later gate

**Do not start until owner workflows and approval policy are complete.**

- [ ] Map allowed HHA confirmation/correction operations.
- [ ] Map required edit reasons/action-taken fields.
- [ ] Add server-side authorization to every write.
- [ ] Capture before state, proposed state, approving user, reason, and timestamp.
- [ ] Submit to HHA.
- [ ] Re-read HHA state.
- [ ] Reconcile expected vs actual result.
- [ ] Add replay/idempotency protection.
- [ ] Start manager-assisted; automate only explicitly approved low-risk cases later.

---

# Authorization / billing / AR

- [ ] Sync authorization state and changes.
- [ ] Calculate used/scheduled/remaining units from owner-approved rules.
- [ ] Forecast authorization overages/shortfalls.
- [ ] Sync visit bill information/service codes.
- [ ] Model scheduled → completed → compliant → billable → billed → outstanding → collected where source data supports it.
- [ ] Sync collection/claim state only from verified HHA fields.
- [ ] Keep estimates visually and structurally separate from posted/paid facts.
- [ ] Add transparent formulas/source labels to forecasts.

---

# Staffing recommendations

Start with ranked recommendations, not autonomous assignment.

- [ ] Ingest availability.
- [ ] Enforce owner-defined hard eligibility rules.
- [ ] Apply schedule-conflict checks.
- [ ] Apply compliance eligibility.
- [ ] Include workload/overtime rules.
- [ ] Add geography/travel-time ranking only after location policy is approved.
- [ ] Add continuity/preferences only when owner-approved.
- [ ] Make ranking explainable.
- [ ] Require manual assignment confirmation initially.

---

# Production / VPS hardening

- [ ] Resolve Firebase project mismatch (`primetimehomehealthservices` vs `pthhs-net`).
- [ ] Separate dev/staging/production.
- [ ] Use least-privilege runtime identities.
- [ ] Use runtime secret management, not repo-stored secrets.
- [ ] Restrict production administrative access.
- [ ] Add backups and test restores once persistent storage exists.
- [ ] Add monitoring for API, sync workers, database, and HHA failures.
- [ ] Add deployment rollback plan.
- [ ] Define log retention/redaction.
- [ ] Document disaster recovery.
- [ ] Confirm hosting/security/BAA requirements with owner before placing PHI on a new platform.

---

# Developer → Owner handoff checklist

For each feature presented for operational validation:

- [ ] explain what the system does in plain language
- [ ] use synthetic/de-identified demo data where possible
- [ ] identify each data source
- [ ] show configured thresholds/rules
- [ ] list known edge cases
- [ ] state every automatic action
- [ ] state every HHA write, if any
- [ ] ask explicit operational questions rather than guessing

# Owner → Developer required rule format

Before implementing a business rule, obtain:

- [ ] trigger
- [ ] threshold/timing
- [ ] exceptions
- [ ] who sees it
- [ ] who may act
- [ ] message intent/wording where applicable
- [ ] escalation path
- [ ] definition of resolved
- [ ] whether automation is permitted

---

# Immediate developer sequence

- [x] Confirm `/primetime` as the management namespace.
- [x] Scaffold backend Functions/HHA adapter.
- [x] Define runtime secret/config contract.
- [x] Define initial internal schema.
- [ ] **NOW:** confirm live Firebase project and create `HHAEXCHANGE_CREDENTIALS` there.
- [ ] identify and wire existing admin authentication to `/primetime/api/*`.
- [ ] activate Functions + Hosting rewrite/deployment.
- [ ] finish SOAP parser/error handling.
- [ ] make first read-only authenticated HHA call.
- [ ] implement visit-change sync.
- [ ] implement schedule sync.
- [ ] show schedule-vs-actual records to owner for validation.

**Sprint stop condition:** do not implement employee messaging or automated HHA/EVV corrections until the owner has completed and approved the relevant operational checklist items.
