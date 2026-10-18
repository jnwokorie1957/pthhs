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

- [x] P1-F loaded saved-calendar filters implemented with exact date/ID and
  case-insensitive source text, matched/loaded counts and reset. Full capture
  charts/provenance and guarded current reads are preserved. All 170 frontend
  tests, normal release and production acceptance passed. See
  [filter acceptance](SAVED_CALENDAR_FILTERS_ACCEPTANCE_2026-10-18.md).
- [ ] P1-G proposed independent improvement: paginate loaded matching calendar
  rows with visible-range/matched/loaded counts and reset/fenced controls;
  preserve full-capture chart, provenance and existing current-read gates.

- [x] P1-E connects saved-calendar visits to explicit current evidence through
  current visit/patient/office verification and existing read gates. All 163
  frontend and 471 backend tests pass. Fresh October 18 production reads matched
  selected identities, retained saved 41/36 chart totals and passed source
  paging/chart comparisons. See [acceptance](SAVED_VISIT_LINKS_ACCEPTANCE_2026-10-18.md).
- [x] P1-F: filter loaded saved-calendar rows
  by date/visit ID/source text with truthful matched/loaded counts and reset;
  preserve immutable capture facts, full chart and existing source read gates.

- [x] October 16 SEO/public navigation pass verified all 132 marketing routes,
  deployed shared-footer links to the existing privacy/terms pages and corrected
  obsolete planning guidance. Both normal workflow jobs and production
  acceptance passed; private noindex/anonymous-API protections remain intact.
  Returned GSC page pagination is exhausted in private evidence. This does not
  close growth, location promotion or operational acceptance. See
  [SEO evidence](../seo/2026-10-16-seo-review.md).
- [x] P1-E administrator implementation completed with current-office/patient
  checks and immutable saved-source evidence; see current acceptance above.

- [x] October 16 role research (queued October 15, 20:37 UTC) clarified
  per-patient family view/manage capabilities, request receipts versus source
  application, native clinical document states and distinct billing hold stages.
  Current clinical-profile/attachment code does not establish therapist forms
  or signing. Cross-role acceptance criteria and five current primary sources
  are recorded in [role research](ROLE_WORKFLOW_RESEARCH.txt).
- [ ] For external-role work, preserve native document/request/EVV/billing
  state dimensions and verify account-patient/staff capabilities server-side.
  P1-E is implemented above; these remain P2 design gates.

- [x] October 15 17:29 UTC role research compared authorization projections
  with current primary documentation and added family multi-patient selection,
  staff network/document-state contracts and explicit shared-record permissions.
  This is research acceptance, not external-role or calculation release. See
  [research delta](ROLE_WORKFLOW_RESEARCH.txt).
- [x] P1-D bounded patient authorization discovery/detail selection now uses
  current-office/patient checks, existing read gates, exact IDs and guarded
  source context. All 157 frontend and 464 backend tests pass. Production
  discovery returned 12 rows; detail selection matched exact IDs and its
  disabled owner gate remained closed. See
  [authorization acceptance](PATIENT_AUTHORIZATION_LINKS_ACCEPTANCE_2026-10-15.md).
- [ ] Verify representative detail fields/contract mapping in production after
  owner-approved detail entitlement; unit/period/usage interpretation remains
  unvalidated. Synthetic detail tests do not close that acceptance.
- [x] P1-E: connect saved-calendar visit IDs
  to current visit evidence, verifying current patient/office identity on the
  server and preserving dated manual provenance and existing read gates.

- [x] October 15 SEO repair: generated and verified the historical sitemap index
  after its submitted URL returned 404. Production now serves canonical XML;
  the existing sitemap publication set, public copy and private admin protections
  are preserved. Search Console baseline access and implemented lastmod controls
  are reconciled in the plan. See
  [SEO evidence](../seo/2026-10-15-sitemap-review.md).
- [ ] Recheck sitemap download/status after Google reprocesses the repaired
  index; do not interpret the deprecated indexed counter as an indexing result.
  Detailed warnings and optional CrUX-key setup require the owner's normal account.

- [x] October 15 research reconciled the existing investigation implementation
  with current primary documentation and normal UI form controls. Patient
  schedules/document sharing, therapist caseload/documentation and office review
  acceptance criteria are in [role research](ROLE_WORKFLOW_RESEARCH.txt), under
  the dated 14:34 UTC research pass. No additional tenant HHA records were read.
- [x] Connect live visit windows and Visit Preview to existing patient, caregiver
  and visit reads with exact source IDs, current-office checks, stale-context
  fencing and cleared prior query fields/results. All 136 frontend tests pass.
  Production patient and visit reads returned matching records; the caregiver
  owner gate stayed closed. See
  [record-link acceptance](SOURCE_RECORD_LINKS_ACCEPTANCE_2026-10-15.md).
- [x] P1-A loaded-record investigation triage implemented: status, assignment
  and follow-up filters/counts retain truthful denominators, pagination, source
  read time, existing revisions/history and stale-context guards. All 145
  frontend tests pass. Normal-session production verified empty-queue reads,
  composed filters and navigation focus. See
  [triage acceptance](INVESTIGATION_TRIAGE_ACCEPTANCE_2026-10-15.md).
- [ ] Verify the first legitimate populated investigation workflow when
  operations has a real case; populated/race acceptance currently uses synthetic
  fixtures. Do not create production test records against real patients.
- [x] P1-C connects selected live patients to protected saved-calendar history
  from Overview and Visit Preview, with exact IDs, current-office verification
  and stale-context guards. All 151 frontend tests pass. Production verified
  both links, empty history, source-refresh clearing and both retained monthly
  versions with chart/table count agreement. Manual/live provenance stays
  separate. See [history acceptance](PATIENT_HISTORY_LINKS_ACCEPTANCE_2026-10-15.md).
- [ ] P1-B prerequisite: verify office and supervisor membership in a versioned
  queue model before office-isolated or external-role exposure. Legacy
  investigations have no officeId; assignee text is not verified membership.

- [x] Previous-page controls implemented for Overview and Visit Preview. The
  source cursor trail is shared across views and cleared for date/mode/session
  changes or failed reads; regression tests cover pending and late responses.
- [x] Normal-session production source paging verified: rows 1–10, then 11–20,
  then the identical first ten rows on return. Each page had ten readable details.
  See [paging acceptance](SOURCE_PAGING_ACCEPTANCE_2026-10-15.md). HHA browser
  calendar capture separately awaits the owner's normal HHAeXchange sign-in.

- [x] Protected patient calendar-snapshot storage and workbench implemented with
  server-side patient/office checks, immutable content-addressed versions,
  duplicate handling, safe source rendering and capture/import timestamps.
  Backend tests include foreign-office denial, invalid dates and policy changes.
- [x] First manual calendar imports verified in production October 15: two monthly
  snapshots retain 77 readable visit tiles and three authorization rows per
  capture. Reopened after reload; identical source replay produced no duplicate.
  See [source import acceptance](MANUAL_SOURCE_IMPORT_ACCEPTANCE_2026-10-15.md).
- [ ] Extend patient/family and therapist roles using the separate identity and
  clinical-review prerequisites in [role research](ROLE_WORKFLOW_RESEARCH.txt).

- [x] Phone/email sign-in code and persistent-session migration implemented with
  synthetic regression tests. Authorized phone: `+18324030094`; existing mailbox
  and claimed administrators remain supported. No tokens are revoked.
- [ ] Verify the owner's normal SMS-code sign-in after deployment; provider is
  already enabled. Browser restart, email-link fallback and existing-session
  preservation remain live acceptance checks. See [sign-in handoff](FIRST_ADMIN_HANDOFF.md).

**October 14 live-mode incident resolved:** the missing default Native Firestore
database is now provisioned in `us-central1`. With demo mode off, the existing
approved administrator's normal browser session loads owner controls and import
history and reports **Reference API reachable**, with no captured console errors.
Database preflight and server-only rules prevent backend releases from overlooking
this prerequisite. The subsequent read-only release enables operational reads only; the other 28 capability gates remain closed. See [Firestore setup](FIRESTORE_SETUP.md).

- [x] **DEV-001 — Management namespace fixed at `/primetime`.** Admin UI remains under `/primetime/*`; management API is intended under `/primetime/api/*`.
- [x] **DEV-002 — Server-side backend/HHA module scaffolded.** Firebase Functions code is under `functions/`; HHA adapter is isolated under `functions/src/integrations/hhaexchange/`.
- [x] **DEV-003 — Runtime HHA config contract created.** Runtime secret: `HHAEXCHANGE_CREDENTIALS`; non-secret endpoint config: `HHAEXCHANGE_BASE_URL`.
- [x] **DEV-004 — Initial vendor-neutral domain schema created.** See `functions/src/domain/models.ts`.
- [x] **DEV-005A — Live Firebase project confirmed.** Developer explicitly confirmed the live project is `primetimehomehealthservices`.
- [x] **DEV-R01 — Repository release boundary repaired.** Marketing generators/verifiers exclude `public/primetime/`, and the consolidated build proves the internal app is unchanged.
- [x] **DEV-R02 — Deployment configuration aligned.** `.firebaserc` and the deployment workflow both target `primetimehomehealthservices`.
- [x] **DEV-R03 — Reproducible verification added.** Lockfiles, pull-request QA, whole-repository auditing, and one deterministic release command are present.
- [x] **DEV-005B — HHA runtime secret created.** Developer explicitly confirmed `HHAEXCHANGE_CREDENTIALS` is set in project `primetimehomehealthservices`.
- [x] **DEV-006 — Authentication and authorization verified October 14.** The approved owner completed normal email-link sign-in and the protected server session opened the workspace. No test administrator token was minted.
- [x] **DEV-007 — Protected backend routing and storage verified October 14.** The normal administrator session loaded owner controls and integration health, saved and reloaded a preference, and exercised the persistent HHA request budget.
- [x] **DEV-008 — HHA SOAP parser/error/retry layer complete and CI-verified.** Parser, application/SOAP/transport normalization, bounded retries, correlation IDs, metadata-only telemetry, and sanitized tests compile and pass in GitHub Actions. Real HHA response validation moves to DEV-009.
- [x] **DEV-009 — First harmless authenticated HHA call verified October 14.** Protected GetCollectionStatus returned the expected successful operation and hhaConnection reachable. The production UI reported Reference API reachable. Visit-read entitlement is verified separately.

**September 30 code-ahead review:** [Implementation, validation and remaining full-coverage work](IMPLEMENTATION_REVIEW_2026-09-30.md); [all 222 contract operations](HHA_CAPABILITY_MATRIX.md). Import safety fixes with durable single-flight fencing, 144 protected workspace reads (141 release-eligible), 23 typed/prepared mutation workflows (22 default-disabled dispatch paths and one independently blocked partial workflow), audited crash/unknown-outcome recovery, saved owner preferences, persistent investigations, independent change-request review and audit views are implemented with synthetic tests. Data-bearing routes default to locked; automated EVV decisions and HHA writes remain disabled. The inventory is not full execution coverage. DEV-006/007/009 passed normal-session acceptance on October 14; operational source validation remains separate.

**Next milestone:** validate bounded visit source records against agency-approved evidence in the protected system. DEV-006/007/009 are complete; reference connectivity does not establish source acceptance, office-wide totals or a persisted import.

**Code-ahead progress:** Firestore persistence, sync checkpoints/dead letters, `GetVisitChangesV5`, targeted `GetScheduleInfo`, caregiver/patient change wrappers, authorization/availability/service-code reads, schedule-vs-actual comparison, configurable EVV evaluation, internal notification planning, and audit generation are implemented. Backend CI has passed the persistence/sync/rules stack **and the full read-only wrapper surface**. The earlier Firebase Functions IAM/deployment blocker is historical: [release 38659517419](https://github.com/jnwokorie1957/pthhs/actions/runs/38659517419) completed on October 15. The default Firestore database exists and normal administrator/reference checks passed. Live-record validation remains separate from these completed prerequisites.

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

- [ ] visit changes / visit info — `GetVisitChangesV5` is implemented; targeted visit-info enrichment remains.
- [x] schedule info — targeted `GetScheduleInfo` wrapper implemented.
- [x] caregivers — paged `GetCaregiverChangesV4` wrapper implemented.
- [x] patients — paged `GetPatientChangesV4` wrapper implemented.
- [x] patient authorizations — changes + targeted authorization-info wrappers implemented.
- [x] caregiver availability — permanent-week + special-availability read wrappers implemented.
- [x] billing/service-code references — `GetBillingServiceCodes` read wrapper implemented.

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

- [x] Firestore selected as the initial management persistence target; the default Native database was provisioned in `us-central1` on October 14. See [verified storage setup](FIRESTORE_SETUP.md).
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
- [x] Authorized metadata-only integration-health API and dashboard view implemented with synthetic checks; production verification remains DEV-007. Connection reachability is separate from successful import age, partial/replay state and unknown freshness.
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
- [x] Deployment rollback plan documented in [RELEASE_RECOVERY.md](RELEASE_RECOVERY.md); operational restore drills and retention decisions remain pending.
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
- [ ] **NOW: enable Firebase email-link sign-in and verify the owner's approved `jeremynwokorie@gmail.com` normal sign-in.**
- [x] Wire the `/primetime` login UI to the protected session endpoint.
- [ ] Verify Functions + Hosting rewrite/deployment with the approved administrator.
- [x] Verify SOAP parser/error handling in CI.
- [ ] First read-only authenticated HHA call.
- [ ] Visit-change sync.
- [ ] Schedule sync.
- [ ] Owner validates schedule-vs-actual records.

**Sprint stop condition:** no employee messaging or automated HHA/EVV corrections until the corresponding owner checklist decisions are complete.


September 30 continuation: limited CreateLinkedSchedule workflow now has independent scheduling review, explicit field scope, office serialization and partial source reconciliation. Persisted ScheduleType is absent from readback; keep the lock: applied recovery and production dispatch are server-blocked until a supported independent persisted-type evidence verifier exists. An attestation, case reference or checkbox cannot unlock it. Gate stays false. Remaining ordinary implementations are listed in HHA_REMAINING_CATEGORIES.md; this checkpoint does not close them or production DEV006/007/009 gates.

October 1 usability review: owner read preferences now support text filtering, selected-only display and selection counts without changing hidden selections or release gates. Remaining automated queues, financial calculations, retention/archival and role expansion still require validated source mappings or owner policy; the exact operation prerequisites remain in HHA_REMAINING_CATEGORIES.md.
