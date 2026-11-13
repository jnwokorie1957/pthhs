# Primetime Home Health Services (PTHHS)

The public website and agency-owned software for Primetime Home Health Services:
service information, a protected operations workspace, caregiver onboarding, and
office staff tools connected to HHAeXchange.

Built through an ongoing collaboration with the agency owner. The repository now
contains the website, application interfaces, integration services, document
workflows, release tooling, and the evidence used to distinguish implementation
from accepted production behavior.

**Status reviewed November 13, 2026** against commit
[`3834444`](https://github.com/jnwokorie1957/pthhs/commit/3834444a8a763bce661b056a7893dedb6113027e).
This README is the current entry point. Detailed acceptance records own their
individual workflow status; dated observations are not a guarantee of a current
session, complete vendor coverage, or a new release approval.

| Experience | Entry | What it covers |
| --- | --- | --- |
| Public website | [pthhs.net](https://pthhs.net) | Services, local-area information, payer/referral context, family resources, and the Caregiver Portal entry |
| Primetime operations | [/primetime](https://pthhs.net/primetime) | Approved HHA reads, office-day overview, visit maintenance, investigations, reports, forms, and website analytics |
| Caregiver portal | [/caregiver](https://pthhs.net/caregiver) | Account access, existing-caregiver setup, applications, signatures, forms, private documents, and scoped HHA work-record views |
| Staff workspace | [/workforce](https://pthhs.net/workforce) | Caregiver support, applications and hiring, personnel documents, authorizations, expiration tracking, field visits, and team access |

Protected routes require their own server-verified identity, permissions, and
office scope. A workforce role does not grant access to the separate Primetime
clinical/admin API. The legacy staff entry under `/primetime/workforce` redirects
to `/workforce`.

## What has been built

### Public website and search foundation

- Migrated and modernized the former WordPress/Proweaver website on Firebase
  Hosting, with shared navigation, repaired assets, and legacy-route handling.
- Added service and attendant-care information, local pages, payer/referral
  context, original family articles, and practical checklists.
- Established canonical URLs, structured metadata/navigation, structured data,
  sitemap and sitemap-index validation, and evidence-based `lastmod` controls.
- Retired the former Careers routes with permanent redirects to Caregiver Portal.
- Added approved terminology, public-fact and payer-evidence registers, claim
  release checks, image checks, accessibility checks, and explicit asset budgets.

The November 13 release record verifies **35 canonical sitemap pages and 30 key
assets** against Git. Search delivery, discovery, indexing, ranking, traffic, and
qualified inquiries remain separate measurements. See the
[current SEO evidence](docs/seo/README.md) and
[November 13 delivery record](docs/seo/2026-11-13-source-reconciliation-delivery.md).

### Live operations and visit maintenance

- Approved office-scoped HHA reads power an office-day overview, visit lists and
  charts, patient/caregiver search, source detail views, and read receipts.
- A persistent, resumable office-day collector reads returned visit IDs in
  bounded batches and retains the last completed result while a later scan runs.
- Visit Maintenance combines original source fields, scoped caregiver call
  events, reference catalogs, local cases, proposals, notes, history, follow-up
  queues, and protected text reports.
- Range search supports inclusive dates, patient and caregiver names/codes, and
  payer filters. A selected cached visit can request fresh patient/day evidence.
- Saved calendar snapshots, patient workbench/history links, investigations, and
  forms-library tools preserve the distinction between dated imports, live
  reads, and local office records.

The November 5 office/day acceptance returned **639 unique visit IDs**, all with
readable details and receipts; overview charts and totals reconciled for that
scan. It took about 36 minutes under the observed source limits. This is a dated,
returned-ID coverage result, not a current agency census or a promise of instant
refresh. See [office-day acceptance](docs/management-layer/OFFICE_DAY_SERVER_CACHE_2026-11-05.md).

**Local review is separate from HHA confirmation or correction.** Scheduled,
recorded visit, EVV, rounded-hours, billing, and payroll evidence are not
interchangeable. An absent source field is different from an unavailable read.
HHA support confirmed that its API does not link existing caregiver calls to
visits. Source submission remains disabled; unresolved confirmation, reason-code,
time-preservation, and independent-readback requirements remain in the
[maintenance resource pack](docs/management-layer/evv-maintenance-resources/README.md).

### Caregiver accounts, applications, and forms

- Dedicated signup, verification, password/email-link access and recovery flows;
  provider choices are exposed only when configured.
- Versioned, resumable applications with contact/emergency information,
  education/work history, availability, policy acknowledgments, signatures, and
  linked required-field guidance.
- File upload and camera flows, private document folders, security-review states,
  official-form editors, individual PDFs, and complete printable packets.
- W-4, I-9, Texas New Hire, and criminal-history materials with employee versus
  employer field boundaries. Preparing a form does not establish government or
  payroll filing, legal acceptance, or employment eligibility.
- Existing-caregiver access based on a unique verified mailbox and fresh,
  office-scoped HHA identity. Existing caregivers keep their separate source
  profile and office-held physical identity records; they are not silently
  converted into new applicants.
- Resumable roster synchronization and name-first lookup with stale-selection
  clearing, source labels, shared request budgets, and explicit unavailable states.
- Five newly connected HHA work-record views: weekly availability, special
  availability, in-service training, work languages, and self-only pay rates.
  Staff can access the first four through their caregiver workspace; account
  support does not imply staff payroll access.

The new work-record views require existing source-method enablement and fresh
identity/office checks; authenticated production acceptance remains open. See the
[222-method portal inventory](docs/workforce/HHA_PORTAL_CONNECTIONS.md),
[account access](docs/workforce/ACCOUNT_ACCESS.md), and
[caregiver profiles](docs/workforce/CAREGIVER_PROFILES.md).

### Staff, hiring, authorizations, and field work

The staff workspace includes explicit office-scoped roles and permissions,
caregiver account support, application and document review, hiring views, team
access, and opportunity workflows. Recent additions include:

- Reviewed authorization documents, service/payer/date context, renewal states,
  follow-up dates, replacement-document history, and expiration summaries.
- Hiring projections that distinguish HHA Applicants, employees, and records
  needing source verification without exposing a complete personnel folder.
- HR expiration tools, field-visit workflows, and caregiver synchronization.
- Responsive section navigation, focused forms, training controls, session-expiry
  guidance, and recovery from interrupted uploads or source reads.

Implementation and deployment evidence do not complete every role, device, or
multi-user acceptance case. The workforce [plan](docs/workforce/PLAN.md) contains
historical milestones; newer focused records and current code supersede older
closed-gate or unimplemented statements where specifically documented.

### Secure document lifecycle

Caregiver uploads are encrypted in server memory with a per-file AES-GCM key;
Cloud KMS wraps the key before private Cloud Storage receives ciphertext. Owner,
document ID, object generation, and digest bind access and verification. The
server handles plaintext during validation and authorized delivery.

Private downloads and printing recheck the current verified account, recent
authentication, office and explicit permission. A mailbox code yields a
short-lived, single-use proof bound to the exact file or packet route. Reusable
browser signatures are encrypted within the reviewed workflow.

A private scheduled ClamAV scanner decrypts the exact PDF generation in memory,
checks its digest and records a bound verdict. Errors and unaccepted PDFs remain
quarantined. Application and follow-up mail workers use immutable snapshots,
bounded attachment parts, leases and persisted progress; uncertain delivery is
held for review. Provider acceptance is distinct from recipient inbox delivery.

See [encryption and access](docs/workforce/DOCUMENT_ENCRYPTION.md) and
[office-test evidence](docs/workforce/OFFICE_TEST_LAUNCH.md). These controls do not
by themselves certify regulatory compliance or approve a retention schedule.

### Website analytics

An independently deployed analytics service supplies the authenticated PTHHS and
Ride Primetime dashboard: complete-day comparisons, views/sessions, leading pages
and channels, contact clicks, and live visitor context. Reports have explicit
property, stream, hostname, date-range and freshness context. Documented
comparisons with signed-in Google Analytics validate a bounded reporting period.

Public collection excludes private routes and sensitive form content and strips
query strings/fragments from page locations. Contact clicks measure intent,
not completed calls, bookings or qualified leads. See
[analytics setup](docs/analytics-setup-2026-10-31.md) and
[independent comparison](docs/management-layer/ANALYTICS_INDEPENDENT_COMPARISON_2026-11-03.md).

## Current release boundaries

| Area | Current evidence and remaining work |
| --- | --- |
| Public site | Delivered; November 13 source reconciliation and bounded production-byte checks are recorded. Rankings, conversion gains and field performance need their own evidence. |
| Primetime reads and local review | Approved live reads and specific office/day, maintenance and saved-record cases have production acceptance. Current authenticated access and broader source/role acceptance are separate. |
| Caregiver launch | A time-limited office application/upload test is recorded. General access is scheduled to reopen **January 1, 2027, 12:00 a.m. America/Chicago**; the API enforces the window. Final applicable forms, retention and normal-user acceptance remain launch work. |
| Staff and new HHA record views | Current source includes these workflows. Each role, office, source-method approval and production acceptance must be checked independently. |
| HHA applicant transfer | A dedicated, gated worker is implemented for eligible post-opening signed submissions. It creates **Applicant**, verifies profile and exact PDF readback, and retains uncertain attempts for reconciliation. No real production transfer acceptance is claimed; office staff promote to Employee manually. |
| HHA operations writes, automated EVV correction and SMS | Separate default-closed release gates, vendor contracts, source evidence and owner approvals still apply. Caregiver onboarding does not open these capabilities. |
| Family/therapist access, wider scheduling/payroll replacement and AI-assisted review | Future or independently gated work; not a completed replacement of every vendor workflow. |

The 222-method inventory is a capability map, not 222 accepted live workflows.
The general Operations `CreateCaregiver` workflow remains separate from the
narrowly scoped workforce applicant-transfer implementation. Consult
[application transfer](docs/workforce/HHA_APPLICATION_SYNC.md) for that worker's
January opening, duplicate checks, signed-snapshot, source-contract and readback
requirements. See [office test and launch](docs/workforce/OFFICE_TEST_LAUNCH.md)
for the caregiver window, scanning, packet delivery and remaining launch review.

## Architecture and repository map

```text
Public browser ── Firebase Hosting ── public pages and public-only analytics
Approved admin ─ /primetime ──────── primetimeApi ── HHA adapter / Firestore
Caregiver/staff ─ dedicated portals ─ workforceApi ─ office-scoped records
                                            └── encrypted Cloud Storage / KMS
Private workers ─ roster, PDF scan, packet mail, gated applicant reconciliation
Analytics view ─ independent website-analytics service ─ read-only GA4 reports
```

| Path | Purpose |
| --- | --- |
| [`public/`](https://github.com/jnwokorie1957/pthhs/tree/main/public) | Firebase Hosting output, public pages, caregiver entry, and protected application shells |
| [`source/primetime/`](source/primetime/) | Authoritative operations UI source; generated assets are checked for drift |
| [`functions/src/`](https://github.com/jnwokorie1957/pthhs/tree/main/functions/src) | TypeScript APIs, authentication, source views, workflows and workforce services |
| [`functions/src/integrations/hhaexchange/`](https://github.com/jnwokorie1957/pthhs/tree/main/functions/src/integrations/hhaexchange) | SOAP transport, parsing, configuration and vendor-contract gates |
| [`functions/src/workforce/`](https://github.com/jnwokorie1957/pthhs/tree/main/functions/src/workforce) | Accounts, office/role rules, applications, forms, encryption, source projections and staff tools |
| [`functions/scanner/`](https://github.com/jnwokorie1957/pthhs/tree/main/functions/scanner) | Private document scanning deployment and worker |
| [`analytics-functions/`](https://github.com/jnwokorie1957/pthhs/tree/main/analytics-functions) | Independent website reporting codebase and contract tests |
| [`content/articles/`](https://github.com/jnwokorie1957/pthhs/tree/main/content/articles) | Source articles and manifest |
| [`scripts/`](scripts/) | Deterministic generators, runtime-asset inventories, tests and release verifiers |
| [`hharefs/`](hharefs/) | Captured vendor operation index and WSDL; current vendor-guide conflicts remain explicit |
| [`docs/`](docs/README.md) | Acceptance, setup, research, release, SEO and historical records |
| Root `PTHHS_*` registers | Approved public facts, terminology, payer/route/navigation/security evidence and release inputs |

The live Firebase project is `primetimehomehealthservices`. Runtime HHA
credentials belong in Secret Manager/Firebase Functions secrets under
`HHAEXCHANGE_CREDENTIALS`; deployment credentials stay in the reviewed CI/runtime
environment. Never commit credentials, real personnel/identity files, patient
records, production SOAP payloads, reset links or tokens.

## Development and verification

Use the committed lockfiles. The root tooling requires Node 20 or newer; the
backend and independent analytics CI use Node 22. The complete website wrapper
requires Bash and Python 3; Linux GitHub Actions is the release reference.

```bash
# Website tooling and full static/repository release gate
npm ci
npm run check

# Operations/workforce backend
npm ci --prefix functions
npm run check --prefix functions
npm test --prefix functions

# Independent website analytics contracts
pnpm --dir analytics-functions install --frozen-lockfile --ignore-scripts
pnpm --dir analytics-functions test
```

The root check covers generated assets, frontend/backend-boundary contracts,
metadata, sitemaps, accessibility, size allowances and repository integrity. It
must preserve protected application files and leave tracked generated output
unchanged. The November 13 reconciliation records 961 backend and 683
site/tooling/analytics checks at that checkpoint; test counts evolve and are not
equivalent to live workflow acceptance.

Pull-request quality verifies static/repository checks and backend types/tests
with fresh dependencies. **A normal main push can deploy Hosting, Functions and
analytics.** Documentation commits should use `[skip ci]` when no runtime release
is intended. The existing explicit manual workflow offers Hosting-only release;
do not redeploy Functions merely to publish public content or reconcile static
source. Preserve reviewed non-secret workforce parameters and the independent
source-action approvals. See [Hosting release procedure](docs/releases/HOSTING_RELEASE.md),
[recovery boundaries](docs/management-layer/RELEASE_RECOVERY.md), and
[source reconciliation](docs/workforce/SOURCE_RECONCILIATION_2026-11-13.md).

## Where to continue

- [Documentation map](docs/README.md): current guides versus historical evidence.
- [Developer checklist](docs/management-layer/DEVELOPER_TASKS.md) and
  [owner/operations checklist](docs/management-layer/OWNER_OPERATIONS_TASKS.md):
  retain completed decisions; do not restart them without contrary evidence.
- [Live-data and activation checklist](docs/management-layer/PRIMETIME_LIVE_DATA_CHECKLIST.txt):
  source, identity, provider and acceptance prerequisites.
- [Maintenance resources](docs/management-layer/evv-maintenance-resources/README.md):
  current product priority, supported source actions and unresolved vendor questions.
- [Workforce plan](docs/workforce/PLAN.md), [launch review](docs/workforce/OFFICE_TEST_LAUNCH.md),
  and [HHA portal inventory](docs/workforce/HHA_PORTAL_CONNECTIONS.md):
  implementation, newer overrides and remaining role/source acceptance.
- [SEO evidence index](docs/seo/README.md): current public delivery and search work.
- [Archived README checkpoint](docs/repository/README_CHECKPOINT_2026-11-13.md):
  the complete prior chronological README, preserved with its original decisions
  and dated status. It is historical evidence, not the current starting state.

When continuing work, read the relevant current record, preserve existing
`/primetime` APIs and independent workforce permissions, identify the next task
whose dependencies are complete, and update its acceptance evidence with the
change. A deployment or passing fixture must not be recorded as real source,
role, form, or device acceptance. Keep vendor-neutral agency workflows behind the
adapter, and retain unknown outcomes until they can be reconciled.
