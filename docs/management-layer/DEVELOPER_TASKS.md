# PTHHS Management Layer — Developer Checklist

> **Primary owner:** Developer
>
> **Boundary:** Own architecture, code, integrations, security, deployment, testing, data models, and observability. Do **not** invent medical, EVV, billing, compliance, staffing, or management rules; those come from the Owner / Operations checklist.

## Checklist rules

- `[x]` = completed and verified by repo evidence or explicit user confirmation.
- `[ ]` = pending.
- Do not skip a blocked item.
- When a task is completed, update this file **and** the root `README.md` checkpoint.
- After marking a task complete, immediately prompt the responsible person with the next unblocked task.

## References

- [`OWNER_OPERATIONS_TASKS.md`](./OWNER_OPERATIONS_TASKS.md)
- [`../../hharefs/endpoints.html`](../../hharefs/endpoints.html) — capability map / what operations exist.
- [`../../hharefs/hha-wdsl.xml`](../../hharefs/hha-wdsl.xml) — exact SOAP contract / how operations work.

---

# Current checkpoint

- [x] **DEV-001 — Management namespace fixed at `/primetime`.** Admin UI remains under `/primetime/*`; management API is intended under `/primetime/api/*`.
- [x] **DEV-002 — Server-side backend/HHA module scaffolded.** Firebase Functions code is under `functions/`; HHA adapter is isolated under `functions/src/integrations/hhaexchange/`.
- [x] **DEV-003 — Runtime HHA config contract created.** Runtime secret: `HHAEXCHANGE_CREDENTIALS`; non-secret endpoint config: `HHAEXCHANGE_BASE_URL`.
- [x] **DEV-004 — Initial vendor-neutral domain schema created.** See `functions/src/domain/models.ts`.
- [x] **DEV-005A — Live Firebase project confirmed.** Developer explicitly confirmed the live project is `primetimehomehealthservices`.
- [x] **DEV-R01 — Repository release boundary repaired.** Marketing generators/verifiers exclude `public/primetime/`, and the consolidated build proves the internal app is unchanged.
- [x] **DEV-R02 — Deployment configuration aligned.** `.firebaserc` and the deployment workflow both target `primetimehomehealthservices`.
- [x] **DEV-R03 — Reproducible verification added.** Lockfiles, pull-request QA, whole-repository auditing, and one deterministic release command are present.
- [x] **DEV-005B — HHA runtime secret created.** Developer explicitly confirmed `HHAEXCHANGE_CREDENTIALS` is set in project `primetimehomehealthservices`.
- [ ] **DEV-006 — Activate `/primetime` authentication and authorization. CURRENT DEVELOPER ACTION.** Client sign-in and server-side token/claim enforcement are implemented. Enable Email/Password Auth, identify the approved admin by UID and email, and grant its `admin` claim from a privileged environment. CI cannot choose an administrator automatically.
- [ ] **DEV-007 — Verify backend routing/deployment.** Functions source, `/primetime/api/**` Hosting rewrite, and backend-first deployment are configured. The deployment verifier rejects invalid tokens and reports authenticated/HHA checks pending until DEV-006; verify the routes with the approved admin afterward.
- [x] **DEV-008 — HHA SOAP parser/error/retry layer complete and CI-verified.** Parser, application/SOAP/transport normalization, bounded retries, correlation IDs, metadata-only telemetry, and sanitized tests compile and pass in GitHub Actions. Real HHA response validation moves to DEV-009.
- [ ] **DEV-009 — First harmless read-only authenticated HHA call. BLOCKED by DEV-007 + DEV-006 runtime verification.** Protected `GetCollectionStatus` health call and automated post-deploy verifier are implemented; real HHA execution waits on successful Functions deployment and a visible authorized admin.

**Next milestone:** DEV-009 succeeds from the `/primetime` backend without exposing HHA credentials or PHI.

**Code-ahead progress:** Firestore persistence, sync checkpoints/dead letters, `GetVisitChangesV5`, targeted `GetScheduleInfo`, schedule-vs-actual comparison, configurable EVV evaluation, internal notification planning, and audit generation are implemented and backend CI has passed these layers. Runtime use remains gated by Firebase IAM/Auth visibility, Firestore provisioning, and live-record validation.

---

# DEV-005B — Secret setup

Run against the confirmed live project:

```bash
firebase functions:secrets:set HHAEXCHANGE_CREDENTIALS --project primetimehomehealthservices
```

Expected JSON value:

```json
{
  "appName": "...",
  "appSecret": "...",
  "appKey": "..."
}
```

- [x] Secret created in `primetimehomehealthservices` — explicit developer confirmation.
- [x] Secret value is not stored in Git, GitHub Actions YAML, browser code, or a committed `.env` file.
- [x] Developer confirmed completion.

---

# Security / architecture

- [x] HHA credentials are backend-only.
- [x] HHA is modeled as an external adapter, not the internal domain schema.
- [x] `.gitignore` protects common local secret/emulator/build artifacts.
- [x] Align `.firebaserc` default with the confirmed `primetimehomehealthservices` project.
- [x] Keep HHA request/response bodies and credentials out of normal logs; current HHA telemetry is metadata-only. A reusable redactor remains desirable before broader payload logging exists.
- [x] Add server-side Firebase ID-token verification + `admin` custom-claim authorization middleware before credential/PHI-bearing routes.
- [x] Keep full SOAP bodies, PHI, patient records, and location evidence out of ordinary logs in the current integration layer.
- [ ] Define immutable audit IDs and retention policy with owner input.
- [ ] Every important future HHA write follows **write → re-read → reconcile**.
- [ ] Every automated management decision records its rule/version and an audit event.

## Repository maintenance

- [x] Keep marketing-site and `/primetime` application build scopes separate.
- [x] Run the complete site release suite in pull requests and before Firebase deployment.
- [x] Pin root and Functions dependency trees with lockfiles.
- [x] Audit every tracked file, local public reference, archive, and structured-data file.
- [x] Preserve historical evidence in dated archives rather than deleting referenced reports.
- [ ] Require the `Repository quality` workflow in `main` branch protection when repository-administration access is available.
- [ ] Recheck the moderate optional `gaxios`/`uuid` advisory after the Firebase Admin dependency tree publishes a compatible fix; do not force a major transitive override without tests.

---

# HHA SOAP adapter

- [x] Base HHA config module.
- [x] Reusable SOAP envelope/transport scaffold.
- [x] `AppParams` support: `AppName`, `AppSecret`, `AppKey`.
- [x] XML response parser.
- [x] Typed operation-result parser for HHA result/error envelopes.
- [x] HHA application-error normalization (`Result`, `ErrorInfo`, `ErrorID`, `ErrorMessage`, `RetryAfter`).
- [x] SOAP/HTTP/transport error normalization.
- [x] Retry classification and bounded exponential backoff.
- [x] Request correlation IDs.
- [x] Per-operation timing/success/failure telemetry without SOAP bodies or credentials.
- [x] Sanitized fixtures/tests for success, application error, and SOAP fault.
- [ ] Authenticated HHA health state: reachable / auth failure / operation failure / stale sync.

Initial endpoint wrappers:

- [ ] visit changes / visit info
- [ ] schedule info
- [ ] caregivers
- [ ] patients
- [ ] patient authorizations
- [ ] caregiver availability
- [ ] billing/service-code references

---

# Canonical PTHHS data model

Initial interfaces are created:

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

Persistence work:

- [x] Firestore selected as the initial management persistence target; actual database provisioning is still a runtime/project setup gate.
- [x] Initial Firestore collection repository implemented for the vendor-neutral domain entities.
- [x] Preserve HHA IDs in a separate hashed external-reference registry rather than using them as PTHHS primary IDs.
- [x] Store source-update timestamps where available.
- [x] Store last-successful-sync timestamps in integration cursors.
- [x] Add source payload/version hashes where useful for reconciliation (visit-change adapter implemented).
- [ ] Finalize production query/date composite indexes after representative live query shapes are validated; external-ID lookup indexing is already implemented.

---

# Read-only sync framework

- [x] Incremental sync cursors/checkpoints.
- [x] Advance the durable cursor only after a successful run.
- [x] Idempotent imports through internal IDs + external-reference resolution.
- [x] Manual resync/reconciliation support through checkpoint overrides and replay-safe upserts.
- [x] Dead-letter/error state for normalization failures.
- [ ] Authorized integration-health view under `/primetime` beyond the HHA connectivity health endpoint.
- [ ] Periodic targeted/full reconciliation schedule.

Import order:

1. [x] visit changes — `GetVisitChangesV5` paging/checkpoint adapter is code-complete; live execution pending DEV-009 and Firestore provisioning. Visit-info enrichment remains later.
2. [ ] schedule info — targeted `GetScheduleInfo` wrapper is code-complete, but a safe source of schedule IDs/bulk discovery still needs live-contract validation.
3. [ ] caregiver info
4. [ ] patient info
5. [ ] authorizations
6. [ ] caregiver availability
7. [ ] billing/service reference data

**Owner validation gate:** before EVV rules are coded, show representative schedule/visit records to the owner and confirm field interpretation.

---

# EVV operations center

- [x] Vendor-neutral schedule-vs-actual comparison with variance calculations.
- [x] Separate EVV clock evidence from high-level visit state in the visit-change normalization layer.
- [ ] Preserve and validate confirmation/edit/deletion state from live HHA records before binding those semantics.
- [x] Configurable exception engine implemented with no production thresholds hardcoded.
- [x] Rule version stored with each generated exception and audit event.
- [x] Configurable severity, threshold, audience, human-review requirement, and automation eligibility; escalation timers remain messaging-layer work.

Candidate rule IDs — thresholds must come from owner:

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

- [x] event-driven internal notification planning model
- [x] employee / manager / billing / admin / clinical / compliance / owner audiences
- [x] deterministic notification IDs for deduplication; time/window suppression remains future delivery work
- [ ] acknowledgement state
- [ ] escalation timers
- [ ] configurable templates
- [ ] delivery audit trail
- [x] audience model preserves manager-only vs employee-visible decisions before any delivery channel is enabled

---

# HHA write-back — later gate

Do not begin until Owner / Operations has defined and approved correction workflows.

- [ ] Map allowed confirmation/correction operations.
- [ ] Map edit reasons/action-taken fields.
- [ ] Enforce server-side write authorization.
- [ ] Store before/proposed/approved state and approving user.
- [ ] Submit to HHA.
- [ ] Re-read HHA state.
- [ ] Reconcile expected vs actual.
- [ ] Add replay/idempotency protection.
- [ ] Begin manager-assisted; automate only explicitly approved cases later.

---

# Authorization / billing / AR

- [ ] Sync authorizations and changes.
- [ ] Calculate used/scheduled/remaining units from owner-approved rules.
- [ ] Forecast authorization risk.
- [ ] Sync visit-bill/service-code data.
- [ ] Model scheduled → completed → compliant → billable → billed → outstanding → collected where supported.
- [ ] Sync collection/claim state from verified fields.
- [ ] Keep projections separate from posted/paid facts.
- [ ] Show formulas and source labels.

---

# Staffing recommendations

- [ ] Ingest availability.
- [ ] Enforce owner-defined hard eligibility rules.
- [ ] Schedule-conflict checks.
- [ ] Compliance eligibility.
- [ ] Workload/overtime logic.
- [ ] Geography/travel ranking only after location policy approval.
- [ ] Owner-approved continuity/preferences.
- [ ] Explainable ranking.
- [ ] Manual assignment confirmation initially.

---

# Production / deployment

- [x] Live Firebase project identified as `primetimehomehealthservices`.
- [x] Align `.firebaserc` default with `primetimehomehealthservices`.
- [ ] Separate dev/staging/production as management layer matures.
- [ ] Least-privilege runtime identities.
- [x] Runtime secrets designated for Secret Manager, not repo storage.
- [ ] Restrict production administrative access.
- [ ] Backups/restores after persistence exists.
- [ ] Monitoring for API, sync, DB, and HHA failures.
- [ ] Deployment rollback plan.
- [ ] Log retention/redaction policy.
- [ ] Disaster recovery documentation.
- [ ] Owner confirmation of hosting/security/BAA requirements before placing PHI on any new platform.

---

# Immediate developer sequence

- [x] `/primetime` management namespace.
- [x] Backend/HHA scaffold.
- [x] Runtime secret/config contract.
- [x] Initial internal schema.
- [x] Confirm live Firebase project = `primetimehomehealthservices`.
- [x] `HHAEXCHANGE_CREDENTIALS` created in the live project.
- [ ] **NOW: enable Firebase Email/Password Auth, create the first trusted admin user, and grant the `admin` custom claim.**
- [x] Wire the `/primetime` login UI to the protected session endpoint.
- [ ] Verify Functions + Hosting rewrite/deployment with the approved administrator.
- [x] Verify SOAP parser/error handling in CI.
- [ ] First read-only authenticated HHA call.
- [ ] Visit-change sync.
- [ ] Schedule sync.
- [ ] Owner validates schedule-vs-actual records.

**Sprint stop condition:** no employee messaging or automated HHA/EVV corrections until the corresponding owner checklist decisions are complete.
