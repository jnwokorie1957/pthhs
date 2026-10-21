# PTHHS Management Layer — Developer Checklist

October 21 local SEO candidate: seven contextual service links on Southwest Houston
and Sugar Land retain existing wording and authorization qualifiers. Local
keyboard/mobile checks passed; review and publication pending. See [verification](../seo/2026-10-21-contextual-links.md).

October 20 local discovery-parser candidate: malformed or ambiguous visit-ID collections now fail instead of silently omitting empty or nested IDs, stray text or unknown collection syntax. Valid empty collections, comments, namespaces and CDATA/processing-instruction compatibility remain supported. Full-result XML validation and structural extraction reject malformed trailing syntax while preserving comment-split IDs and empty CDATA. The existing locked XML parser is now an explicit dependency. Standard XML decimal/hex character references decode once; literal CDATA and escaped references are preserved. Nil attributes use XML Schema whitespace normalization. Forward-only token spans and per-ID parsing avoid a whole-response object tree and reject malformed opener sequences promptly. All 484 backend tests pass locally; publication and authenticated acceptance are pending. No source writes or new retrieval calls.

October 20 visit discovery candidate: the dashboard retains received SearchVisitsV2 IDs beyond 200 and pages at most 10 details under the existing time and office checks. Vendor completeness and operational totals remain unknown. See [discovery acceptance](VISIT_DISCOVERY_ACCEPTANCE_2026-10-20.md).

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

- [x] October 20 source-status labels locally verified: access checking and
  terminal outcomes replace obsolete loading/success labels. All 238 frontend
  tests and the local release gate passed; request and permission behavior is
  unchanged. See [verification](SOURCE_STATUS_LABELS_ACCEPTANCE_2026-10-20.md).
- [ ] Authenticated production acceptance of these label transitions remains
  pending; broader source/role/operational gates are unchanged.

- [x] October 20 17:30 UTC research compared shared age controls and action
  feedback with current W3C pause/status guidance. Recorded proposed patient,
  therapist and office reading behavior and acceptance cases in
  [research](ROLE_WORKFLOW_RESEARCH.txt). Static semantics and dated keyboard
  evidence are not a full assistive-technology/conformance assessment. Runtime
  permissions and existing role/source prerequisites remain unchanged.

- [x] October 20 automatic fetch-age display control implemented and locally
  verified: shared session-only pause/resume, original receipts, independent
  timer lifetimes and immediate context clearing. All 233 frontend tests, the
  local release gate and synthetic keyboard/layout checks passed. Both normal
  jobs and 17:16 UTC heartbeat authenticated production pause/hold/resume/tick,
  current-visit, paging/chart and clear checks passed. See
  [verification](AUTOMATIC_AGE_CONTROL_ACCEPTANCE_2026-10-20.md).
- [ ] Broader representative source/operational/role acceptance remains separate
  from this administrator display-control verification. Normal HHA sign-in and
  existing source/identity/office/discipline/document prerequisites remain open.

- [x] P1-O completed for October 20 04:22 UTC heartbeat: explicit source-preview
  clearing in both live views, guarded pending/late responses, timer/cursor reset,
  corresponding Read source now focus and explicit no-page state. Stored imports
  remain separate. All 227 frontend tests, both normal jobs and production fresh
  first/next/chart, clear/pending/79-second-idle/reread checks passed. See
  [acceptance](SOURCE_PAGE_CLEAR_ACCEPTANCE_2026-10-20.md).
- [ ] Continue protected source/office/identity/unit/period/discipline/document
  validation and existing entitlement/P1-B/external-role prerequisites. Clearing
  a display does not establish broader operational or clinical acceptance.

- [x] October 20 02:49 UTC SEO/owner pass: public crawl/artifacts, static claim/
  metadata/navigation/accessibility/performance/payer/sitemap-date checks and private
  boundaries passed. Both Search Console sitemap rows remain successful; discovery
  is not indexing growth. See [SEO review](../seo/2026-10-20-seo-review.md).
- [x] P1-N completed: exact-patient care-plan/document discovery preparation from
  both live representations, with cleared fields/results and visible-input focus.
  All 221 frontend tests, both normal jobs and production selection/receipt checks
  passed. Existing owner gates remain; no plan/document read or file access was
  submitted. See [acceptance](PATIENT_DISCOVERY_LINKS_ACCEPTANCE_2026-10-20.md).
- [ ] Continue source/office/parent/action validation before richer patient result
  or byte links and external roles. Existing owner entitlement, P1-B and clinical
  form/version/reviewer/signature prerequisites remain open.

- [x] October 20 02:08 UTC role research compared current source links and read
  projections with task-plan, attachment-origin and clinical-form references.
  Recorded role screens, exact joins, action/office/account boundaries and tests
  in [research](ROLE_WORKFLOW_RESEARCH.txt). No runtime or permission changed.
- [x] P1-N implemented above: prepare SearchPatientPOC / SearchPatientDocument from exact
  current readable source-patient identity, with visible-input focus, cleared
  unrelated filters/results and existing entitlement gates. Selection adds no
  request/download/import. Fence detached actions across source/context/session
  changes; do not preselect a plan/document or claim patient-office isolation.
  Richer result/byte access and external roles require the separately scoped
  parent/membership/action checks documented in research.

- [x] P1-M completed October 20 01:52 UTC heartbeat (October 19 local): shared
  fetch-age semantics for live Overview/Visit Preview; one guarded page timer,
  unchanged receipts/scope and immediate pending/context cleanup. All 217 frontend
  tests, both normal jobs and production minute-tick/paging/refresh/chart checks
  passed. See [acceptance](LIVE_PAGE_FETCH_AGE_ACCEPTANCE_2026-10-20.md).
- [ ] Continue representative source/configuration validation and scoped external
  role prerequisites below. P1-M does not establish operational policy or complete
  office totals. Normal HHA sign-in remains the next owner evidence action.

- [x] P1-L completed for the October 19 23:17 UTC heartbeat, production accepted
  October 20 UTC: approximate device-clock current-visit fetch age, unchanged raw
  receipt/source context and guarded local-timer cleanup. All 209 frontend tests,
  both normal jobs and production minute-tick/focus/retention/refresh/reset checks
  passed. Fresh live paging and all six chart calculations matched source fields.
  See [acceptance](CURRENT_FETCH_AGE_ACCEPTANCE_2026-10-19.md).
- [x] P1-M implemented above: extend the same transparent age treatment to live Overview/
  Visit Preview. Keep explicit reads, partial page/chart scope, original receipts
  and current/saved separation; cancel across request/page/date/office/policy/mode/
  session changes. Add no polling, stored preference, threshold or classification.

- [x] October 19 SEO follow-up diagnosed the legacy sitemap's historical 404/
  HTML errors in normal Search Console. One refresh of the verified repaired
  index now reports October 19 read / Sitemap index / Success. All 132 public
  routes, static SEO/accessibility/performance/claim checks and live artifact/
  private boundaries passed. No public app code changed. See
  [SEO evidence](../seo/2026-10-19-seo-review.md).
- [ ] Continue later settled outcome measurement and owner-approved location
  review. Automated reporting access is unavailable; browser access works.
  Observe normal sitemap updates without repeated unchanged submissions. Core
  Web Vitals currently lacks sufficient field data; static checks are separate.

- [x] October 19 20:40 UTC role research compared current projections/UI and six
  new primary references for recurrence/generated visits, temporary staffing,
  confirmation/missed/deleted states, order/certification versions and aggregation
  history. Added proposed screens, explicit source joins, role/action boundaries
  and unknown/revoked/version acceptance in [research](ROLE_WORKFLOW_RESEARCH.txt).
  No application asset, source operation or role permission changed.
- [ ] Before implementing these role/status views, validate effective source/
  configuration mappings and current enabled reads; add server account/assignment/
  office/action scopes before wiring bounded results. Do not use missing time,
  positive caregiver ID, tile color, task POC or billed flag as another state's
  authority. Keep P1-B and external clinical/account prerequisites open. P1-L is
  accepted above; P1-M is also accepted above. Role/source prerequisites remain.

- [x] P1-K completed for October 19 20:24 UTC: native closed raw-field disclosure,
  exact returned-field count and caregiver navigation before it. All 203 frontend
  tests, both normal jobs and production keyboard/value/context acceptance passed.
  Fresh live first/next/previous pages and all six source-chart comparisons passed;
  bounded/on-demand/source-unvalidated labels remain. See
  [acceptance](CURRENT_SOURCE_DISCLOSURE_ACCEPTANCE_2026-10-19.md).
- [x] P1-L implemented above: show elapsed current-visit fetch age beside its
  raw ISO timestamp, with transparent display-clock and unknown/future handling.
  Test accessible updates and timer cleanup; add no thresholds, source polling,
  persisted data, permission or operational classification.

- [x] P1-J implemented and accepted October 19, 20:09 UTC: named current
  Schedule/Actual/EVV groups retain exact raw values, source timezone, complete
  returned fields and unknown/empty/zero distinctions. All 199 frontend tests,
  both normal jobs and production source/identity/reset/1280/615px checks passed.
  See [acceptance](CURRENT_VISIT_SOURCE_GROUPS_ACCEPTANCE_2026-10-19.md).
- [x] P1-K implemented above: native raw-field disclosure with returned-field count and
  source navigation beside the grouped evidence. Preserve every value and
  current-request/context lifetime, native keyboard behavior and owner gates;
  no new fetch, storage preference or operational interpretation.

- [x] P1-I implemented and accepted October 19, 13:07 UTC: exact current
  caregiver read selection, native keyboard/focus behavior and successful-read
  sequencing plus saved-context guards. All 193 frontend tests, both normal jobs
  and production identity/refresh/reset checks passed; the existing owner gate
  correctly denied an explicit caregiver fetch. See
  [acceptance](CURRENT_VISIT_CAREGIVER_ACCEPTANCE_2026-10-19.md).
- [x] P1-J implemented: group current visit Schedule/Actual/EVV fields for reading,
  preserving raw values, null/empty/zero distinctions, independent timestamps and
  existing stale-context/read gates. No conversions, derived units, completion
  status or operational interpretation; test partial/unknown evidence explicitly.

- [x] October 19 01:20 UTC role research (October 18 local) checked current
  code/UI and six new primary references for primary/secondary office, action
  permissions, mixed disciplines, work history, calendar visibility and staff
  documents. Recorded precise P1-I implementation/acceptance in
  [role research](ROLE_WORKFLOW_RESEARCH.txt); no application or role release.
- [x] Implemented P1-I only from the separately verified current-visit panel.
  Prepare the existing caregiver read from exact bounded `Caregiver/ID`, with
  explicit fetch intent and existing gates. Fence the successful read request
  itself, including two successive reads of the same visit, plus row/filter/page,
  patient/version, office/policy and mode/session changes. No history/name match,
  automatic fetch, new permission or inferred therapist/primary-office authority.
- [ ] External roles still require per-patient/action grants, staff-account and
  effective-assignment mapping, authoritative primary-office context and approved
  encounter/form/reviewer/signature contracts. P1-B migration remains open.

- [x] P1-H saved chart-day filtering completed for the October 19 00:30 UTC
  heartbeat (October 18 local). Native keyboard/pressed-state controls compose
  with existing filters, reset paging and retain the full chart/provenance.
  All 185 frontend tests, both normal jobs and production acceptance passed;
  fresh live paging and all six source-chart comparisons also passed. See
  [acceptance](SAVED_CHART_DAY_FILTER_ACCEPTANCE_2026-10-18.md).
- [x] P1-I implemented: select the existing caregiver read from verified current
  visit evidence using exact `Caregiver/ID`, explicit intent, existing gates and
  stale-context guards. Missing/invalid identity remains unresolved; no tile-name
  matching, automatic fetch, therapist-role inference or access grant.

- [x] October 18 SEO/navigation pass replaced public archive-review notices
  with a guide to existing approved pages and added contextual Resources access.
  Both core-page graph gaps are fixed. Local gates, both normal jobs, production
  132-route/byte checks and browser acceptance passed. Updated exact-window
  private Search Console/query-page evidence; no ranking/growth claim. See
  [SEO review](../seo/2026-10-18-seo-review.md).
- [ ] Continue location availability/useful-content review and later comparable
  outcome measurement. The legacy index's error inspection and Google reprocessing
  are now completed in the October 19 evidence above.

- [x] P1-G loaded saved-calendar pagination implemented with ten-row local
  pages, visible-range/matched/loaded counts, filter/version resets, focused
  status and guarded detached page/current-read controls. All 178 frontend
  tests, both normal release jobs and production acceptance passed. Full chart,
  source order, authorization rows and provenance are retained. See
  [pagination acceptance](SAVED_CALENDAR_PAGES_ACCEPTANCE_2026-10-18.md).
- [x] P1-H implemented independent follow-up: select a full saved-chart day through
  an accessible control into the existing date filter, with selected-date
  feedback, reset and stale-control guards. Preserve full-capture counts/chart
  and current-read fences; add no source query or interpretation.

- [x] October 18 role research, 22:07 UTC, compared current administrator
  projections with primary documentation. Added proposed document-origin/action
  grants, therapist template/encounter states, allocation versus discovery,
  timesheet upload/approval/hold separation and overnight identity checks.
  Conditional family invoice scope remains a separate permission. Five new
  sources and the rechecked Forms guide support acceptance criteria in
  [role research](ROLE_WORKFLOW_RESEARCH.txt); no external-role release is claimed.
- [ ] Before exposing these state dimensions, validate source coverage and
  tenant mappings, enforce role/action/record scopes server-side and test unknown,
  revoked, cross-patient/office, stale/version and overnight cases. P1-B migration
  and clinical form/signature prerequisites remain open. P1-G is accepted above.

- [x] P1-F loaded saved-calendar filters implemented with exact date/ID and
  case-insensitive source text, matched/loaded counts and reset. Full capture
  charts/provenance and guarded current reads are preserved. All 170 frontend
  tests, normal release and production acceptance passed. See
  [filter acceptance](SAVED_CALENDAR_FILTERS_ACCEPTANCE_2026-10-18.md).
- [x] P1-G implemented independent improvement: paginate loaded matching calendar
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
- [x] Recheck repaired sitemap download and Google processing: October 19
  reprocessing succeeded; October 20 13:25 UTC public XML/redirect checks and
  normal Search Console rows retain Success and 27 discovered pages. This is
  processing/discovery evidence, not indexing or growth. Do not resubmit unchanged
  successful files. See [current review](../seo/2026-10-20-seo-review.md).
- [ ] Obtain comparable settled search outcomes and sufficient field Core Web
  Vitals evidence. Optional CrUX-key/reporting setup remains separate; no key,
  subscription or permission change was made.

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
- [x] **DEV-008 — HHA SOAP parser/error/retry layer complete and CI-verified.** Parser, application/SOAP/transport normalization, bounded retries, correlation IDs, metadata-only telemetry, and sanitized tests compile and pass in GitHub Actions. DEV-009 reference-read acceptance completed October 14; representative operational-response validation remains separate.
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
- [x] Authorized metadata-only integration-health API and dashboard view implemented with synthetic checks; DEV-007 protected controls/storage verification completed October 14 (see [dated acceptance](LIVE_HHA_ACCEPTANCE_2026-10-14.md)). Connection reachability is separate from successful import age, partial/replay state and unknown freshness.
- [ ] Periodic targeted/full reconciliation schedule.

Import order:

1. [x] visit changes — `GetVisitChangesV5` paging/checkpoint adapter is code-complete; DEV-009 reference connectivity and [Firestore provisioning](FIRESTORE_SETUP.md) completed October 14. Live visit-change import execution/validation and visit-info enrichment remain pending; bounded source-page reads do not establish a persisted import.
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
- [x] Email-link sign-in and the approved owner's normal session accepted October 14 (DEV-006; [dated evidence](LIVE_HHA_ACCEPTANCE_2026-10-14.md)). SMS-code acceptance remains separate.
- [x] Wire the `/primetime` login UI to the protected session endpoint.
- [x] Protected routing/storage accepted October 14 (DEV-007); Functions + Hosting release reconciled October 15 in the [dated acceptance record](LIVE_HHA_ACCEPTANCE_2026-10-14.md#october-15-release-reconciliation).
- [x] Verify SOAP parser/error handling in CI.
- [x] First authenticated HHA reference call accepted October 14 (DEV-009, GetCollectionStatus; [dated evidence](LIVE_HHA_ACCEPTANCE_2026-10-14.md)). This does not establish visit-source interpretation or import acceptance.
- [ ] Visit-change sync.
- [ ] Schedule sync.
- [ ] Owner validates schedule-vs-actual records.

**Sprint stop condition:** no employee messaging or automated HHA/EVV corrections until the corresponding owner checklist decisions are complete.


September 30 continuation: limited CreateLinkedSchedule workflow now has independent scheduling review, explicit field scope, office serialization and partial source reconciliation. Persisted ScheduleType is absent from readback; keep the lock: applied recovery and production dispatch are server-blocked until a supported independent persisted-type evidence verifier exists. An attestation, case reference or checkbox cannot unlock it. Gate stays false. Remaining ordinary implementations are listed in HHA_REMAINING_CATEGORIES.md; the September 30 checkpoint did not close those categories or DEV-006/007/009. The latter prerequisites were subsequently accepted October 14 in the [dated evidence](LIVE_HHA_ACCEPTANCE_2026-10-14.md); remaining source/operational validation and linked-schedule gates stay open.

October 1 usability review: owner read preferences now support text filtering, selected-only display and selection counts without changing hidden selections or release gates. Remaining automated queues, financial calculations, retention/archival and role expansion still require validated source mappings or owner policy; the exact operation prerequisites remain in HHA_REMAINING_CATEGORIES.md.
