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

**October 14 patient source workbench:** a protected calendar-snapshot import and
patient workbench preserve dated HHA UI evidence, authorization rows and visit
tiles, with patient-office verification, immutable versions and content-based
deduplication. The workbench links to existing live patient and authorization
reads; manual snapshots remain separate from live overview charts. Local backend
and frontend regression suites pass. Production import acceptance is recorded
separately. See [role/workflow research](docs/management-layer/ROLE_WORKFLOW_RESEARCH.txt).

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
