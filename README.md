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

**Last updated:** 2026-09-12

## Developer status

- [x] `DEV-001` — `/primetime` is the required management/admin namespace.
- [x] `DEV-002` — Firebase Functions backend/HHA adapter scaffold created under `functions/`.
- [x] `DEV-003` — runtime HHA configuration contract created: `HHAEXCHANGE_CREDENTIALS` secret + `HHAEXCHANGE_BASE_URL` config.
- [x] `DEV-004` — initial vendor-neutral management schema created in `functions/src/domain/models.ts`.
- [x] `DEV-005A` — live Firebase project confirmed as **`primetimehomehealthservices`**.
- [x] `/primetime` admin shell has been merged to `main`; it is still a scaffold until auth + live backend data are connected.
- [x] Repository-wide maintenance pass completed without changing tracked files under `public/`.
- [x] Marketing generators and verifiers now preserve the separate `/primetime` application byte-for-byte.
- [x] Deterministic root/Functions dependencies, pull-request QA, and whole-repository integrity checks are in place.
- [ ] **`DEV-005B` — CURRENT DEVELOPER ACTION:** create `HHAEXCHANGE_CREDENTIALS` in Google Cloud Secret Manager / Firebase Functions secrets for project `primetimehomehealthservices`.
- [ ] `DEV-006` — identify/verify the existing `/primetime` authentication mechanism and define the server-side admin authorization gate.
- [ ] `DEV-007` — activate Functions deployment + Firebase Hosting rewrite so `/primetime/api/**` reaches `primetimeApi`.
- [ ] `DEV-008` — finish SOAP response parsing, HHA error normalization, retries, redaction, and telemetry.
- [ ] `DEV-009` — first harmless read-only authenticated HHA call.

### Firebase project status

The live management/site Firebase project is confirmed as **`primetimehomehealthservices`**. The deployment workflow and `.firebaserc` now both target this project.

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

The first owner interview is complete enough to close the first two discovery tasks.

- [x] `OPS-001` — current daily EVV/visit-review workflow documented.
- [x] `OPS-002` — common EVV exceptions and current resolution flow documented.
- [ ] **`OPS-003` — CURRENT OWNER ACTION:** define exact late/missing/short/long visit thresholds and grace periods.
- [ ] `OPS-004` — finish employee-visible vs manager-only vs billing/compliance-only alert rules.
- [ ] `OPS-005` — finish correction-approval matrix beyond routine supervisor approve/decline decisions.

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
