# PTHHS

## 🚨 START HERE — MANAGEMENT LAYER BUILD

The HHAeXchange / internal-management work is tracked as two live checklists. **Read this checkpoint first, then open the checklist for the person currently working.**

### 👨‍💻 Developer checklist

➡️ **[`docs/management-layer/DEVELOPER_TASKS.md`](docs/management-layer/DEVELOPER_TASKS.md)**

Technical work: `/primetime` backend, HHA SOAP integration, normalized data, sync, EVV engine, messaging, billing/authorization intelligence, staffing logic, deployment, and security.

### 🏥 Owner / Operations checklist

➡️ **[`docs/management-layer/OWNER_OPERATIONS_TASKS.md`](docs/management-layer/OWNER_OPERATIONS_TASKS.md)**

Operational/management decisions: EVV rules, visibility/escalation, correction approval, billing readiness, authorization logic, staffing constraints, compliance, and acceptance testing.

---

# 🚦 CURRENT MANAGEMENT-LAYER CHECKPOINT

**October 18 role research, 22:07 UTC:** added proposed document-origin/action
permissions, therapist template-versus-encounter states, native visit allocation
and separate timesheet approval/hold evidence, overnight visit context and
conditional family invoice access. Five new primary references and a rechecked
Forms guide support screen contracts and acceptance cases. Tenant activation
and field mappings remain unverified; HHA requires normal sign-in. P1-G loaded
saved-row pagination remains next. See
[research](docs/management-layer/ROLE_WORKFLOW_RESEARCH.txt).

**October 18 loaded-calendar filtering, 21:55 UTC:** P1-F adds date/exact-ID and
case-insensitive source-text filters with matched/loaded counts and reset.
Full-capture charts and provenance stay unchanged; filter changes fence current
evidence and detached controls. All 170 frontend tests, normal release and
production checks passed, including 41/36 saved totals, expected/empty matches,
reset and an exact filtered current read. No new imports or grants were added.
P1-G local loaded-row pagination is proposed next; operational dependencies
remain open. See [acceptance](docs/management-layer/SAVED_CALENDAR_FILTERS_ACCEPTANCE_2026-10-18.md).

**October 18 saved/current visit acceptance (October 16 heartbeat):** saved
calendar visits now open explicit current HHA evidence with current visit,
patient and office verification through existing gates. The immutable captures
and 41/36 chart totals are retained. All 163 frontend and 471 backend tests pass;
both release jobs, fresh production lookups, source paging and all six chart
comparisons passed. P1-E is complete in the administrator read-only scope.
P1-F loaded saved-calendar filtering is implemented above; operational interpretation,
membership/clinical and normal HHA sign-in dependencies remain open. See
[acceptance](docs/management-layer/SAVED_VISIT_LINKS_ACCEPTANCE_2026-10-18.md).

**October 16 role research (October 15 queued trigger):** separated family
view/manage permissions and request receipts from source application, native
clinical completion/review/signing states, and configurable billing hold stages.
New cross-role acceptance criteria are documented with current primary sources;
these are proposals, not new permissions or clinical/billing decisions. P1-E
saved-calendar links are implemented in the acceptance above. See
[role research](docs/management-layer/ROLE_WORKFLOW_RESEARCH.txt).

**October 15 connected authorization evidence, 19:16 UTC:** live Overview and
Visit Preview now select patient authorization discovery through a protected
current-office/patient check. Discovery retains exact IDs, dates, fetched time
and truncation; detail selection preserves the existing owner gate. All 157
frontend and 464 backend tests pass. Production returned 12 discovery rows,
verified exact detail selection and the disabled detail gate. Live source
paging and all six field-presence charts passed fresh row/count comparisons.
Raw detail/contract-change edge cases remain synthetic until approved detail
access. No unit conversion, utilization or eligibility decision was added. See
[authorization acceptance](docs/management-layer/PATIENT_AUTHORIZATION_LINKS_ACCEPTANCE_2026-10-15.md).
P1-E saved-calendar visit links are implemented above with current
patient/office verification and preserved manual provenance.

**October 15 connected patient history, 19:01 UTC:** live Overview and Visit
Preview rows now open the exact patient's protected saved-calendar history.
Source-context changes clear prior history; late responses and detached controls
cannot repaint another patient. All 151 frontend tests pass. Production verified
both entry points and retained saved versions, with October/September chart
totals matching 41/36 source visit tiles. Manual labels and capture/import
timestamps remain separate from live reads. See
[history acceptance](docs/management-layer/PATIENT_HISTORY_LINKS_ACCEPTANCE_2026-10-15.md).
The subsequent authorization-navigation implementation is recorded above;
unit/period/usage interpretation and approved detail-source acceptance remain open.

**October 15 role research, 17:29 UTC:** added concrete authorization-source
limits, family multi-patient selection and staff network/document-state
acceptance contracts. Current source joins already leave authorization limits
unvalidated; discovery IDs and raw units cannot support a remaining-hours chart
without verified period, unit and usage semantics. P1-C saved-history navigation
and P1-D authorization navigation are implemented above. Unit/period/usage
interpretation, external roles and clinical workflows remain open. See the dated
[research delta](docs/management-layer/ROLE_WORKFLOW_RESEARCH.txt).

**October 16 SEO review:** crawled all 132 public marketing routes and repaired
the missing shared-footer links to the existing privacy/terms pages. Metadata,
canonical, claim, accessibility and asset checks passed; both normal release
jobs and production acceptance passed. Updated the SEO playbooks using current
Google guidance and actual GSC coverage, retaining incomplete outcome/location
tasks. Returned page-report pagination is now exhausted in private evidence;
outcome validation remains open. See [review](docs/seo/2026-10-16-seo-review.md).

**October 15 SEO follow-up:** restored the submitted legacy sitemap index from
404 to valid XML pointing at the existing 27-URL canonical sitemap. Production
and release checks passed; public page artifacts and private Primetime
noindex/authentication protection remain intact. Read-only Search Console
baseline access and evidence-backed lastmod controls are reconciled in the plan.
Google reprocessing, warning-detail review and optional CrUX setup remain separate
from the deployed repair. See
[SEO evidence](docs/seo/2026-10-15-sitemap-review.md).

**October 15 investigation triage:** loaded-record status, assignment and
follow-up filters now retain truthful active/overdue/unassigned counts,
pagination, source read timestamps and stale-response protection. The workflow
opens at the review filters. All 145 frontend tests pass; production verified the
empty protected queue and normal navigation. Populated-record cases are tested
with synthetic fixtures; legitimate-record operations acceptance remains open.
Live chart values matched source rows, and Next/Previous returned the expected
bounded pages. See
[triage acceptance](docs/management-layer/INVESTIGATION_TRIAGE_ACCEPTANCE_2026-10-15.md).
The subsequent patient-history implementation is recorded above; manual
snapshots remain distinct from current source reads.

**October 15 role research refresh:** the current investigation queue already
has assignment text, follow-up timestamps, status and append-only history.
The resulting loaded-record triage improvement is implemented above.
Verified supervisor membership and office-isolated queue exposure require a
separate scope/identity migration; existing unscoped records must not be silently
assigned to the selected office. Patient document sharing and therapist caseload,
forms and signature acceptance criteria are now explicit in the cumulative
[role research](docs/management-layer/ROLE_WORKFLOW_RESEARCH.txt).

**October 15 connected source records:** live visit windows and Visit Preview
rows now select existing patient, caregiver and visit reads using explicit source
IDs and the current office. Prior query fields/results are cleared; selection
does not fetch data or enable permissions. All 136 frontend tests pass. Production
acceptance verified matching patient and visit reads and the retained caregiver
owner gate. See
[record-link acceptance](docs/management-layer/SOURCE_RECORD_LINKS_ACCEPTANCE_2026-10-15.md).
Loaded-record triage uses the existing queue fields; verified office/assignee and
external-role prerequisites remain open.

**October 15 source-page navigation:** Overview and Visit Preview now support
previous-page navigation through the same bounded HHA source pages. Navigation
history is cleared on date, office/policy, mode and session changes and on failed
requests. Charts continue to describe one source page, without implying an office
total or a persisted import. All 132 frontend tests pass. Normal-session
production acceptance verified source rows 1–10, then 11–20, then the identical
first ten rows after navigating back. See
[paging acceptance](docs/management-layer/SOURCE_PAGING_ACCEPTANCE_2026-10-15.md).

**October 14 patient source workbench:** a protected calendar-snapshot import and
patient workbench preserve dated HHA UI evidence, authorization rows and visit
tiles, with patient-office verification, immutable versions and content-based
deduplication. The workbench links to existing live patient and authorization
reads; manual snapshots remain separate from live overview charts. October 15
production acceptance verified 77 readable visit tiles across two monthly
snapshots, persistence after reload and duplicate protection. The live
authorization workflow also returned source records. See
[import acceptance](docs/management-layer/MANUAL_SOURCE_IMPORT_ACCEPTANCE_2026-10-15.md)
and [role/workflow research](docs/management-layer/ROLE_WORKFLOW_RESEARCH.txt).

**October 14 live read-only overview:** DEV-006/007/009 passed in the normal approved session. The owner requested actual HHA visit data; this release enables operational reads only and connects scoped source pages to overview charts. All HHA mutation, monitoring-source and SMS approvals remain closed. See [live HHA acceptance](docs/management-layer/LIVE_HHA_ACCEPTANCE_2026-10-14.md).

**October 14 sign-in extension:** phone-code sign-in for the owner-authorized US
number `+18324030094` accompanies the existing email link. Firebase must verify the
phone and the server rechecks the current enabled account. Existing sessions move
to browser-local persistence without token revocation; temporary API failures
offer a connection retry instead of automatic sign-out. See
[sign-in setup and acceptance](docs/management-layer/FIRST_ADMIN_HANDOFF.md).
Phone-code acceptance requires the owner's normal SMS verification after release.

**October 14 live-mode incident resolved:** the four startup 503s shared a missing
Firestore dependency. The default Native database now exists in `us-central1`
(created `2026-10-14T23:54:54.991783Z`). The existing approved administrator session
now loads owner controls and import history and reports **Reference API reachable**
with demo mode off. Backend deployment now checks the database prerequisite and
retains operator-published server-only rules. Operational reads were subsequently enabled by the read-only release; source acceptance and the other 28 gates remain closed. See
[Firestore setup and acceptance](docs/management-layer/FIRESTORE_SETUP.md).

**October 10 sign-in update:** the owner approved `jeremynwokorie@gmail.com` for administration and selected password-free email links. The server checks verified mailbox ownership and the current enabled account alongside existing admin claims. See [sign-in setup and acceptance](docs/management-layer/FIRST_ADMIN_HANDOFF.md). Normal email-link sign-in, protected backend/storage and the reference HHA call passed acceptance on October 14; SMS-code sign-in and operational source validation remain separate checks.

**Last updated:** 2026-10-15

See the [September 30 implementation review](docs/management-layer/IMPLEMENTATION_REVIEW_2026-09-30.md) and [222-operation API coverage matrix](docs/management-layer/HHA_CAPABILITY_MATRIX.md). Local code adds 144 protected workspace reads (141 release-eligible, three vendor-blocked), 23 typed/prepared mutation workflows (22 default-disabled gated dispatch paths plus one independently blocked partial linked-schedule workflow), persistent owner preferences/investigations/change-review/audit workflows, truthful integration health and replay/evidence protections. The default capability values remain fail-closed, while the reviewed release enables operational reads only. Full 222-operation execution is not complete.

## Developer status

- [x] `DEV-001` — `/primetime` is the required management/admin namespace.
- [x] `DEV-002` — Firebase Functions backend/HHA adapter scaffold created under `functions/`.
- [x] `DEV-003` — runtime HHA configuration contract created: `HHAEXCHANGE_CREDENTIALS` secret + `HHAEXCHANGE_BASE_URL` config.
- [x] `DEV-004` — initial vendor-neutral management schema created in `functions/src/domain/models.ts`.
- [x] `DEV-005A` — live Firebase project confirmed as **`primetimehomehealthservices`**.
- [x] `/primetime` admin shell is on `main` with accepted administrator authentication, backend storage and bounded live source views. Source validation remains pending.
- [x] Repository-wide maintenance pass completed without changing tracked files under `public/`.
- [x] Marketing generators and verifiers now preserve the separate `/primetime` application byte-for-byte.
- [x] Deterministic root/Functions dependencies, pull-request QA, and whole-repository integrity checks are in place.
- [x] `DEV-005B` — developer confirmed `HHAEXCHANGE_CREDENTIALS` is set in Secret Manager for `primetimehomehealthservices`.
- [x] **`DEV-006` — Accepted October 14:** the approved owner completed normal email-link sign-in and the protected server session opened the workspace. SMS-code acceptance is tracked separately.
- [x] `DEV-007` — Accepted October 14: the normal administrator session loaded protected owner controls and integration health, saved/reloaded a preference, and exercised persistent request budgeting.
- [x] `DEV-008` — SOAP parsing/error normalization, retries, correlation IDs, metadata-only telemetry, and sanitized tests are implemented and pass CI.
- [x] `DEV-009` — Accepted October 14: protected `GetCollectionStatus` succeeded and the UI reported Reference API reachable. This does not establish visit-source acceptance.

The September 23 review removed automatic first-user admin promotion. Deployment verifies invalid tokens are rejected; if no approved admin exists, the authenticated and HHA checks report **PENDING**, not complete. Live mode now displays bounded on-demand source pages; Demo remains an explicit synthetic option. Source-page reads do not persist a visit import, advance import history or establish office totals.

### Firebase project status

The live management/site Firebase project is confirmed as **`primetimehomehealthservices`**. The deployment workflow and `.firebaserc` both target this project.

Current runtime status:
- GitHub CI service account: `firebase-adminsdk-fbsvc@primetimehomehealthservices.iam.gserviceaccount.com`.
- October 14 [workflow 38639779585](https://github.com/jnwokorie1957/pthhs/actions/runs/38639779585) completed Hosting and Functions deployment successfully; the September 30 Cloud Build blocker is historical.
- The approved administrator's normal signed-in browser session loads the live owner controls and HHA reference check.
- The default Native Firestore database is provisioned in `us-central1`. Operational reads are enabled by the reviewed release; each read still requires configured office scope and owner enablement. Live-record validation remains pending.

### Secret-storage decision

HHA runtime credentials do **not** belong in the repository and should not use GitHub Actions Secrets as their runtime source of truth. For the current Firebase/Google Cloud stack, store them in **Google Cloud Secret Manager / Firebase Functions secrets**. GitHub Actions secrets remain appropriate for CI/deployment credentials.

Expected runtime secret name:

`HHAEXCHANGE_CREDENTIALS`

Expected JSON shape:

```json
{
  "appName": "...",
  "appSecret": "...",
  "appKey": "..."
}
```

Create it with:

```bash
firebase functions:secrets:set HHAEXCHANGE_CREDENTIALS --project primetimehomehealthservices
```

Never commit the real value.

## Owner / Operations status

The developer explicitly confirmed on **2026-09-22** that the Owner / Operations Lead completed all owner policy and decision items in the owner checklist.

- [x] `OPS-001` — current daily EVV/visit-review workflow documented.
- [x] `OPS-002` — common EVV exceptions and current resolution flow documented.
- [x] `OPS-003` — clock exception thresholds and grace-period policy completed.
- [x] `OPS-004` — alert audience/visibility policy completed.
- [x] `OPS-005` — correction-approval policy completed.

Owner policy work is no longer the current blocker. Live imported-record validation and feature acceptance remain runtime gates because those require implemented developer artifacts.

### Owner interview findings now treated as confirmed

- Common EVV problems: missing clock-in, missing clock-out, both missing, and actual times differing from the schedule.
- Staff currently work from the calendar or HHAExchange Visit Maintenance, then review Visit Info / Link Visit, connect the available call, confirm with the member or caregiver, select a reason code, and route the case to a supervisor decision.
- Routine corrected visits are approved or declined by an office supervisor.
- Long visits may be downward-adjusted to scheduled hours after review when appropriate.
- Pay periods are **1st–15th** and **16th–end of month**.
- Repeated missing EVV activity beyond normal leniency is a supervisor red flag that can indicate hospitalization, death, caregiver abandonment/non-work, or another operational disruption.
- Investigation/outreach is currently informal and needs formal notes/history plus a supervisor morning summary of abnormal unresolved events.
- Staffing is currently driven mainly by a phone tree and handwritten notes.
- Patient choice is the top staffing ranking factor; hours/overtime fit is second; geography and transportation materially affect assignments.

The detailed record is in [`OWNER_OPERATIONS_TASKS.md`](docs/management-layer/OWNER_OPERATIONS_TASKS.md).

---

# 🧹 REPOSITORY STATUS

The September 12 repository-wide review is complete. Historical reports and
source captures are preserved under [`docs/archive/`](docs/archive/); current
strategy lives under [`docs/seo/`](docs/seo/); active release inputs remain at
the root. See the [documentation map](docs/README.md), [review log](docs/repository/REVIEW_LOG.md), and [file inventory](docs/repository/FILE_INVENTORY.md).

Run the complete local release gate with:

```bash
npm ci
npm run check
```

Run the backend type check separately with:

```bash
npm ci --prefix functions
npm run check --prefix functions
npm test --prefix functions
```

The build must leave tracked `public/` files unchanged. This prevents a
documentation-only commit from silently publishing different website data.

---

# 🤖 INSTRUCTIONS FOR ANY AI SCANNING THIS REPO

When continuing management-layer work:

1. **Read this checkpoint first.**
2. Read the relevant role checklist in `docs/management-layer/`.
3. Treat `[x]` items as completed. Do not re-ask for them or restart them unless repository evidence contradicts the status.
4. Find the first pending task whose dependencies are complete.
5. Prompt the responsible person with **specific next actions**, not a broad “what do you want to do next?” question.
6. If a task is blocked by the other role, identify the exact `DEV-*` or `OPS-*` dependency and prompt that role instead.
7. When a task is actually verified complete, mark it `[x]` in its checklist and update this checkpoint in the same change.
8. Never mark a task complete merely because it was discussed; require explicit user confirmation or repo/runtime evidence.
9. Preserve the `/primetime` namespace: management UI lives under `/primetime`; management API endpoints are intended under `/primetime/api/*`.
10. Route placement is **not** security. Do not expose credential-bearing or PHI-bearing API endpoints until server-side admin authentication/authorization is verified.
11. Start HHA integration read-only. Do not enable HHA write-back or automatic EVV corrections until the owner has approved the relevant operational rules.
12. Never commit HHA secrets, PHI, real production SOAP payloads, or employee location evidence.

### Automatic next-step behavior

After completing a checklist task, the scanning AI should immediately state:

- what was completed,
- what evidence confirms it,
- the next task ID,
- exactly what the responsible person needs to do next,
- any dependency that prevents proceeding.

---

## HHAeXchange source-of-truth references

The `hharefs/` folder contains captured HHAeXchange ENT v1.8 technical references.

### [`hharefs/endpoints.html`](hharefs/endpoints.html) — capability map

Saved ENT v1.8 operation index. Use it to answer **“does this API surface expose an operation for this capability?”**

It includes operations relevant to visits/EVV, visit confirmation, schedules, caregiver availability, patient authorizations, billing/payroll visit data, collections/AR, caregiver compliance, documents, POC-related functions, and other HHA workflows.

### [`hharefs/hha-wdsl.xml`](hharefs/hha-wdsl.xml) — exact SOAP contract

Saved ENT v1.8 WSDL. It is the implementation-level source for operation signatures, request/response structures, field types, authentication, and result/error structures.

Confirmed authentication uses `AppParams` with `AppName`, `AppSecret`, and `AppKey`.

> **Rule of thumb:** use `endpoints.html` to learn *what exists*; use `hha-wdsl.xml` to learn *exactly how it works*.

---

## Management-layer architecture rule

PTHHS owns the workflow, rules, audit trail, alerts, and management experience. HHAeXchange initially acts as an external data source/sink behind an adapter. The internal schema must remain vendor-neutral so HHA components can later be replaced without rebuilding the `/primetime` management product.

Owner read controls include search, selected-only filtering and selection counts; filtering never changes permissions. See [release recovery boundaries](docs/management-layer/RELEASE_RECOVERY.md) for rollback and verification guidance. Production activation and vendor-contract prerequisites remain separate from publication.
