# PTHHS caregiver workforce plan

Authoritative architecture, implementation backlog and acceptance record. Version 1, November 5, 2026. Initial audit baseline: `93707e3` on `main`; integrated current `main` at `e43613d` before handoff, preserving concurrent source-access documentation and the maintenance-report evidence projection. This file owns workforce delivery status; existing management and release documentation continues to own its established workflows.

## Scope and release state

This change begins Phases 1–2 in the existing PTHHS repository. It is a review branch, not a production launch. No real staff accounts, role grants, patient openings, applicant records, SMS messages, employment decisions or vendor writes were created. Synthetic records exist only in tests. No production patient data was queried.

**Implemented** means code exists. **Tested** identifies synthetic automated verification. **Pending** identifies work still to implement. **Blocked** identifies a specific external input or acceptance requirement. Neither a passing test nor a deployment establishes regulatory compliance.

## Repository audit

| Area | Existing implementation and reuse | Gap / decision |
| --- | --- | --- |
| Public site | Static Firebase Hosting site, canonical `/home-care-careers`, shared branding, responsive navigation, SEO generators and release checks | Add opportunities to the current Careers page, preserve metadata and existing employment information; add homepage Caregiver Sign In |
| Management | Source-authoritative `source/primetime`, generated `public/primetime`, operational views, staffing evidence, forms library, visit review, office-day cache and live feed | Retain legacy tools; add linked `/primetime/workforce` with a narrower staff boundary |
| Identity | Firebase Authentication email-link and phone sign-in, verified owner identity allowlist, administrator custom claims, revoked-token verification in `functions/src/auth/admin.ts` | Reuse the same project/UID. Legacy administrator access is not workforce owner authority. A new staff grant never implies clinical/admin API access |
| API | Firebase Functions v2, TypeScript strict mode, `/primetime/api/**` authenticated by `requirePrimetimeAdmin` | Add a separate `workforceApi` function and Hosting rewrites for workforce requests; leave legacy authorization unchanged |
| Persistence | Firebase Admin Firestore repository and server-owned records; Firestore and Storage deny all direct browser access | Reuse Admin SDK and existing `(default)` database. Add server-owned workforce collections. Live edition, IAM, region, backup, encryption and retention configuration were not inspected; deployment acceptance must verify the existing instance, without provisioning another database |
| Documents | Existing private forms library, controlled downloads, version/evidence patterns, blanket Storage deny | Reuse patterns, not library-wide permissions. Employee/applicant ownership, category ACLs, malware scanning, legal holds and retention are still to build |
| HHAeXchange | SOAP client, capability matrix, entitlement restrictions, shared read budgets, source acceptance, 29 release gates and reviewed write/reconciliation patterns | `CreateCaregiver` is listed as **not implemented**. Documentation presence does not establish entitlement. All current gates remain unchanged |
| ADP | No ADP adapter found in Functions source | Needs Workforce Now entitlements, approved test environment, mappings, deduplication and reconciliation |
| Release | Main can trigger a full production release; API-only discovery intentionally excludes the scheduler | Keep development on a branch. New workforce handler is also excluded from API-only discovery. Do not merge as a substitute for explicit release acceptance |
| Tests | Backend, authorization, source contracts, UI regression, build, SEO, audit and release tests | Extend them with workforce domain, transaction-contract, closed-route and browser contract tests |

## Architecture

Public Careers → public approved-opportunity projection → same-project Firebase identity → workforce API → Firestore. Staff use `/primetime/workforce`; caregivers use `/caregiver`. Future React Native clients should consume the same authenticated API and UID, without direct database access or duplicating employee identities.

The current applicant entry is intentionally closed. The caregiver email-link/selected-opportunity client scaffold is present, but applicant registration, self-service session APIs, persistent applications and interest submission are **not released or end-to-end implemented**. Changing a browser flag cannot enable collection: configuration returns `accountsEnabled: false` and `applicationsEnabled: false`, and no application write route exists.

### Staff authorization

`workforceStaff/{firebaseUid}` stores exactly `{ active, role, offices, permissions }`. Roles: `owner`, `hr`, `office`, `supervisor`. Explicit permissions currently implemented: `opportunities.read`, `.edit`, `.review`, `.publish`, `staff.manage`. A role name alone grants nothing. Offices are explicit IDs; no wildcard office grants. Service-area scoping must map to reviewed office IDs for this slice; separate per-service-area rules remain pending.

Every staff request verifies the Firebase token with revocation checks and rechecks the enabled, verified email identity. Every write reads the current grant inside its Firestore transaction. Scope is checked on both old and new offices when moving a listing. Owner privileges require an explicit workforce owner grant; the existing email/phone allowlist and `admin` claim do not automatically acquire it.

The owner-only staff access form can create/update/revoke non-owner grants for an existing verified Firebase UID within the owner's offices, with an audit entry. The API refuses self-modification and owner creation/modification. HR and supervisors can receive separate explicit opportunity permissions; personnel and hiring permissions are not implemented in this slice.

Initial owner bootstrap requires a privileged administrator to verify the exact current Firebase UID, enabled status, verified identity, approved office IDs and intended permission set, then create the server-owned owner grant with an independently retained approval/audit record. Do not derive the UID from a typed email or silently link phone and email accounts. This change provides no automatic bootstrap and makes no live identity changes. Validate at least two distinct staff identities for independent privacy review before launch.

### Opportunities and API contract (v1 foundation)

| Endpoint | Purpose / authority |
| --- | --- |
| `GET /caregiver/workforce-api/configuration` | Closed applicant collection status; no user or patient records |
| `GET /caregiver/workforce-api/opportunities` | Public allowlisted projection; empty with `release: pending` until both release gates are true |
| `GET /primetime/workforce-api/configuration` | Staff release availability |
| `GET /primetime/workforce-api/session` | Current server-owned actor/grant; verified email required |
| `GET /primetime/workforce-api/staff/opportunities` | Explicit read permission; per-office retrieval, maximum 100 records per office |
| `POST /primetime/workforce-api/staff/opportunities` | Save `{id?, revision, data}` or transition `{id, revision, action, privacyConfirmed?}` |
| `POST /primetime/workforce-api/staff/grant` | `{uid, grant}`; workforce owner with explicit `staff.manage`, scoped and audited |

All responses are `no-store`. POST requires JSON and a maximum 12 KB raw body. Errors use a stable `{error: code}` without request bodies, identities, patient details or vendor payloads in logs. Missing/unverified identity: 401; missing permission/scope: 403; stale revision or invalid lifecycle: 409; closed release/storage failure: 503. Pagination beyond 100 records remains pending; no unlimited public or staff dump is implemented.

An opportunity separates private `office`, `internalReference`, `internalNotes` from the public object. Public fields are general `location`, optional approved `recruitingZip`, approximate `weeklyHours`, enumerated general `schedule`, broad `assistance`, `type`. The public response adds only ID, available status and update timestamp. Unknown fields, malformed ZIPs, precise schedules and unapproved assistance values are rejected. No imported patient record can become an opportunity automatically.

Lifecycle: draft → review → approved → published → closed → archived. A separate reviewer must attest to the **complete combination** of public fields, recruiting geography and reidentification risk. The content author cannot approve their own content even if another person submits it. Review attaches to a revision; stale approvals cannot publish. Every edit returns the listing to draft, removes it from public results and invalidates review. Closing removes availability immediately. Record + append-only version + audit event are written in one transaction. No delete route exists. This is application-level append-only history, not a claim of tamper-proof storage against privileged cloud administrators.

Manual privacy approval is necessary; field validation cannot establish de-identification. Staff must use broader location and an empty ZIP when the combination is unsafe. Initial independent-review policy is deliberately stricter than a single-person workflow and requires owner acceptance.

Release parameters default to false: `WORKFORCE_STAFF_APPROVED`, `WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED`. They do not enable applicant collection, HHA writes or ADP writes. Production activation and integration with the repository's reviewed release-parameter preparation remain a separately reviewed step. Keep existing 29 HHA/operational approval declarations and their release configuration intact.

### Application, employment and document architecture

The pure configurable application framework supports approved packet versions, allowed fields, required-field validation, immutable draft transitions, resume revisions, ownership and submission tracking. The only sample packet is synthetic test data. No actual application questions, legal text, signature consents or renewal documents were invented. Persisted drafts, HR review screens, file uploads and signatures remain pending.

Future `workforceAccounts/{uid}` should reference the existing internal employee ID and external IDs; change employment status on the same account. Do not copy the HHA employee into a duplicate workforce employee table. Separate employment status from permissions and assignment eligibility. Applicant/employee APIs must derive ownership from authenticated UID, never accept another UID to select private records, and return allowlisted fields. HR activation must be a guarded transition requiring the approved, versioned eligibility checklist and supporting verification.

Future secure employee folders should retain application/document versions, category ACLs, hash, MIME/size, malware-scan state, uploaded/verified actors and timestamps, retention class, legal hold, and immutable access events. Signed downloads must be short-lived and re-authorized. Do not open direct Storage rules. Establish class-specific retention/deletion and backup handling before sensitive collection; no automatic deletion is implemented now.

Reactivation is a proposed internal six-calendar-month policy, **not an HHSC mandate**. Determine inactivity from approved employment/assignment/service evidence, never login time. Implement configurable policy version, source event, unknown-data state and threshold calculation; HR-approved partial renewal checklist must preserve history and identity. The document list and exact inactivity clock require owner/HR decisions. Less-than-six-month review, six-month reactivation, and HR eligibility restoration are pending.

Assignments must follow office qualification/authorization/availability and client preference review. Interest is a request, never an assignment or employee activation. Active caregivers bypass general reapplication; applicants must finish the approved application. Former employees follow HR review/reactivation while retaining the same account. Employee hours must separate scheduled, recorded EVV, office-reviewed and confirmed hours with source and freshness. Correction requests cannot rewrite punches or payroll.

### Integration architecture

No ADP or new HHA writes exist in this change. Future onboarding is an approved, idempotent coordinated job with separate HHA and ADP attempt/result/verification records, external IDs, retry keys and reconciliation. A successful call in one system cannot mark the other succeeded. Unknown outcomes require lookup/reconciliation before retry; never blindly recreate an employee. Expose pending, processing, succeeded, failed and needs-review states independently.

Reuse the HHA capability matrix, client, release gates, read quotas and evidence patterns. Verify provider-specific entitlements and test environment before writing an adapter. Obtain ADP documentation/entitlements and supported mappings separately. Route direct-deposit changes through approved ADP employee self-service; do not collect bank details in PTHHS or email. Payroll access URLs must be approved, not guessed.

## Authoritative backlog

| ID | Phase | Status | Deliverable / acceptance or dependency |
| --- | --- | --- | --- |
| WF-001 | 1 | Implemented / tested | Repository audit, architecture, single versioned plan |
| WF-002 | 1 | Implemented / tested | Same-project verified identity, explicit workforce grants, scoped opportunity authorization, no legacy admin widening |
| WF-003 | 1 | Implemented / tested | Transactional draft/review/approve/publish/close/archive, stale-edit checks, privacy projection, version/audit writes |
| WF-004 | 1 | Implemented / partially tested | Individual staff email-link UI, owner non-owner grant UI, staff editor and review controls; domain/transaction tests pass, real multi-user Firebase acceptance pending |
| WF-005 | 1 | Blocked: deployment acceptance | Confirm exact owner/staff UIDs and scopes, bootstrap owner with audit, verify database edition/IAM/region/BAA/security, emulator/rules/concurrency tests, revoked-session/IDOR tests against deployed API, audit monitoring, quotas/rate limits, independent staff visual acceptance |
| WF-006 | 2 | Implemented / tested foundation | Careers board, five filters, clickable interest link, canonical preservation, homepage sign-in link, zero synthetic production listings, narrow-screen empty state |
| WF-007 | 2 | Implemented prototype / tested contract | Same-origin email-link client scaffold and exact selected-ID return; active caregiver/applicant server session and full cross-device callback acceptance pending |
| WF-008 | 2 | Implemented / tested domain only | Configurable approved packet, versioned save/resume and submit transitions; no production persistence/collection |
| WF-009 | 2 | Blocked: paper packet + compliance approval | Reproduce actual approved questions/documents/signature consents; finalize retention/privacy/access rules; then persistent drafts, secure uploads, HR queue and application tracking |
| WF-010 | 2 | Pending | Owned applicant/employee profiles, recovery flows, interest requests with deduplication and exact opportunity return, former-employee routing; no automatic assignment |
| WF-011 | 2 | Blocked: production authorization | Verify WF-005, independent publishing/privacy controls and operational monitoring; approve deployment/gates, then publish only actual approved openings |
| WF-012 | 3 | Blocked: HR document requirements | Employee folder, screening evidence, role-scoped HR review, retention and legal holds, approved activation checklist |
| WF-013 | 3 | Blocked: reactivation policy/forms | Configurable employment/assignment inactivity, partial renewal checklist, HR restoration, retained UID/history |
| WF-014 | 3 | Pending | Contact/address approval, preferred areas/availability, approved ADP self-service, notifications and account settings |
| WF-015 | 4 | Pending | Reviewed interest-to-match workflow, availability, scoped patient access only after authorized assignment |
| WF-016 | 4 | Pending | Sourced hours with verification states and discrepancy requests; approved office corrections only |
| WF-017 | 5 | Blocked: vendor entitlement + test access | HHA/ADP mapping, test adapters, duplicate prevention, independent results and failure reconciliation |
| WF-018 | 5 | Blocked: vendor + production authorization | Approved onboarding/synchronization writes; no automatic live creation authorized |
| WF-019 | 6 | Pending after core web acceptance | React Native uses same accounts/APIs/permissions; privacy-safe notifications and mobile acceptance |

## Compliance research and decisions (checked November 5, 2026)

These primary sources guide the acceptance work; they are not an agency-specific legal determination or a fabricated mandatory checklist.

- [HHS de-identification guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html): removing names does not establish de-identification. Safe Harbor has specific geography rules; publishing a full five-digit ZIP is not a Safe Harbor shortcut. Use approved recruiting areas and assess combinations rather than claiming listings are automatically HIPAA-de-identified.
- [HHSC employability search migration](https://www.hhs.texas.gov/provider-news/2025/09/12/employability-status-check-instructions-sept-12-2025) and [HHSC EMR FAQ](https://www.hhs.texas.gov/business/licensing-credentialing-regulation/long-term-care-credentialing/employee-misconduct-registry-emr/emr-faqs): use the current TULIP/search process and resolve ambiguous matches with HHSC. Do not persist a positive screening result without evidence.
- [SEMARC official FAQ](https://semarc.texas.gov/FAQ/): participating-agency reportable-conduct information can affect HCSSA employability. HR must verify current applicable searches and evidence, rather than substitute a generic checkbox for all screening duties.
- [TMHP Provider Enrollment manual](https://www.tmhp.com/sites/default/files/microsites/provider-manuals/tmppm/html/TMPPM/1_01_Provider_Enrollment/1_01_Provider_Enrollment.htm): exclusions affect Medicaid participation/payment. Confirm the exact payer/program-specific worker checks and intervals before enabling eligibility decisions.
- [FTC employer background-check guidance](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know): consumer-report permissions and adverse-action duties need the actual approved forms and process. A generic electronic signature does not supply them.
- [Texas Uniform Electronic Transactions Act](https://tcss.legis.texas.gov/resources/BC/htm/BC.322.htm): electronic record/signature workflows require review of agreement, attribution, retention and the particular document. No generic signature has been treated as approval of legal documents.
- [USCIS employer guide](https://www.uscis.gov/sites/default/files/document/guides/E3en.pdf) and [official remote examination procedures](https://everify.uscis.gov/ica-docs/cases/appendix/field-definitions/remote-examination-of-documents-procedures): Form I-9 retention generally follows three years after hire or one year after termination, whichever is later; remote document examination has specific eligibility/procedure conditions. Remote applications do not waive verification obligations.
- [DOL recordkeeping guidance](https://beta.dol.gov/policy-regulations/pay-benefits/wages-hours/wages-flsa/recordkeeping), [EEOC retention guidance](https://www.eeoc.gov/employers/recordkeeping-requirements), and [Texas Workforce Commission employer guide](https://efte.twc.texas.gov/efte.pdf): different personnel, wage and payroll records have different retention obligations. Texas payroll guidance also requires consideration. Approve a record-class retention matrix including disputes/legal holds; do not use one deletion timer for every folder.

HIPAA applicability, BAA/service eligibility, least-privilege IAM, storage encryption, session settings, upload controls, electronic notices and state/payer-specific retention remain acceptance work before real collection. Do not claim any of those were verified merely from repository settings.

## Verification record

See the final verification results appended below. Tests use synthetic identities and data; transaction tests use an in-memory contract double, not a live database. Existing Firestore/Storage deny-all client rules are unchanged and tested by repository contract checks, not new emulator execution. Live Firebase email delivery, new staff identities, permissions against deployed IAM, vendor entitlements and HR/legal acceptance are unverified. No new document or integration endpoint exists to test end-to-end yet.

## Next priority

Complete WF-005: validate the staff/owner identity bootstrap and office scopes in an approved Firebase test environment, add emulator/concurrent grant-revocation tests, and perform two-person publishing acceptance. Then implement owned applicant sessions and persistent applications after the packet and collection controls are approved. Do not open public opportunities or applicant collection to demonstrate unfinished functions.

### Final local results

- Node 22.22.0: **758 backend tests passed**, including 20 workforce tests; **543 site/tooling/analytics tests passed**, including six workforce/browser-contract tests. 1,301 Node tests total; no failures or skipped tests in either run. The initial 1,220-test branch also passed GitHub Repository quality, including its Linux release wrapper; the updated combined branch is subject to a new CI run.
- TypeScript compilation passed. Generated Primetime assets and workforce asset hashes are current.
- Individual release generation/verification commands passed: HHA preservation evidence, article generation/tests, SEO metadata, sitemap dates, site output, insurance-logo integrity, Batch A/B1–B4, structured navigation, accessibility, performance, frontend controls and repository integrity audit.
- The Windows environment lacks Bash, so the Bash release wrapper itself and its shell-syntax sweep were not run. Its applicable generation/verification commands were executed individually with UTF-8 Python; generator stability was checked with `git diff --exit-code` for public/source/scripts/config. Existing CI retains the full Linux release wrapper.
- Marketing generators retained the private portal files and all five new runtime assets. The workforce layer has a separate 40 KB raw / 12 KB gzip cap; existing operations limits remain in force.
- Narrow-screen local browser: Careers filters/entry points and closed registration/staff states were observed. Local synthetic Firebase stub plus the compiled opportunity domain verified draft save, review submission, independent reviewer approval, publication and edit-to-draft invalidation. No live Firebase authentication or Firestore persistence was tested by this browser exercise. Full responsive matrix, assistive-technology review and live identity acceptance remain open.
- Dependency audit: root tooling has zero vulnerabilities. Functions has zero high/critical findings and four moderate findings in the existing glob/minimatch/rimraf/google-gax chain. Non-breaking lockfile updates to body-parser 2.4.0 and qs 6.17.1 removed the high and one moderate advisory. Further dependency remediation is tracked under WF-005 before sensitive release.
- No production deployment, live grants, application collection, public opportunity publication, HHA writes or ADP writes occurred.
