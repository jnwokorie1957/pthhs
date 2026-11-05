# PTHHS caregiver workforce plan

Authoritative architecture, implementation backlog and acceptance record. Version 2, November 5, 2026. Initial audit baseline: `93707e3` on `main`; integrated current `main` through `8a1d866` before this packet handoff, preserving concurrent source-access documentation and the maintenance-report evidence projection. This file owns workforce delivery status; existing management and release documentation continues to own its established workflows.

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

The current production applicant entry remains closed by server release controls. The real packet now drives a nine-step caregiver application, same-project verified account session, persisted versioned drafts, reference-release signature evidence, submission tracking, a private photo folder and a scoped HR review queue. These components are implemented and tested with synthetic data, not production-accepted. Interest submission and hiring/activation remain separate pending workflows.

### Staff authorization

`workforceStaff/{firebaseUid}` stores exactly `{ active, role, offices, permissions }`. Roles: `owner`, `hr`, `office`, `supervisor`. Explicit permissions currently implemented: `opportunities.read`, `.edit`, `.review`, `.publish`, `staff.manage`, `applications.review`, `documents.review`. Personnel permissions are restricted to HR/owner roles in addition to explicit grants and office scope. A role name alone grants nothing. Offices are explicit IDs; no wildcard office grants. Service-area scoping must map to reviewed office IDs for this slice; separate per-service-area rules remain pending.

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

All responses are `no-store`. Staff opportunity POST requires JSON and a maximum 12 KB raw body. Application saves allow 64 KB JSON; image uploads allow at most 8 MB decoded, with the corresponding bounded base64 envelope. Unknown payload keys (including a supplied owner UID or office on applicant routes) are rejected. Errors use a stable `{error: code}` without request bodies, identities, patient details or vendor payloads in logs. Missing/unverified identity: 401; missing permission/scope: 403; stale revision or invalid lifecycle: 409; closed release/storage failure: 503. Pagination beyond 100 records remains pending; no unlimited public or staff dump is implemented.

An opportunity separates private `office`, `internalReference`, `internalNotes` from the public object. Public fields are general `location`, optional approved `recruitingZip`, approximate `weeklyHours`, enumerated general `schedule`, broad `assistance`, `type`. The public response adds only ID, available status and update timestamp. Unknown fields, malformed ZIPs, precise schedules and unapproved assistance values are rejected. No imported patient record can become an opportunity automatically.

Lifecycle: draft → review → approved → published → closed → archived. A separate reviewer must attest to the **complete combination** of public fields, recruiting geography and reidentification risk. The content author cannot approve their own content even if another person submits it. Review attaches to a revision; stale approvals cannot publish. Every edit returns the listing to draft, removes it from public results and invalidates review. Closing removes availability immediately. Record + append-only version + audit event are written in one transaction. No delete route exists. This is application-level append-only history, not a claim of tamper-proof storage against privileged cloud administrators.

Manual privacy approval is necessary; field validation cannot establish de-identification. Staff must use broader location and an empty ZIP when the combination is unsafe. Initial independent-review policy is deliberately stricter than a single-person workflow and requires owner acceptance.

Release parameters default to false: `WORKFORCE_STAFF_APPROVED`, `WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED`, `WORKFORCE_APPLICANT_COLLECTION_APPROVED`, `WORKFORCE_PACKET_REVIEW_APPROVED`, `WORKFORCE_ID_DOCUMENTS_APPROVED`, `WORKFORCE_ID_RETENTION_APPROVED`. Collection requires staff release, collection and packet-review approval plus a nonempty server-configured `WORKFORCE_INTAKE_OFFICE`. Documents additionally require document and retention approvals. No parameter enables HHA or ADP writes. Production activation and integration with the repository's reviewed release-parameter preparation remain a separately reviewed step. Keep existing 29 HHA/operational approval declarations and their release configuration intact.

### Application, employment and document architecture

The supplied scan has 27 pages and SHA-256 `f002450817bd2816b3a239794ac49b3c79354a4fde5f51855cc0e3d2487e139d`. All pages were rendered and visually inventoried. [The versioned packet definition](../../functions/src/workforce/packet.ts) maps every page and records source pages for each applicant question. Pages 3–5 provide the native intake fields: personal/contact information, emergency contact, availability, work eligibility, conviction question/details, three education rows, two employment records and past-employment reference details. Repeated name/SSN questions reuse the same answer; the page-3 position selector is supervisor-only and page-5 reference ratings belong to the past employer, not the applicant. Minimum submission validation is an implementation proposal; HR must approve the complete required/conditional-field policy before the packet gate opens.

The applicant has nine short steps with server autosave, explicit save, resume, review and typed electronic signing of the supplied page-5 release. The release wording is retained, not turned into a new background-screening authorization. Signature evidence binds verified UID, typed name, affirmative electronic consent, document/revision, source hash, answer hash and server timestamp. Legal review of the electronic-signature presentation is still required. Other onboarding legal documents are not silently replaced by summaries or generic consent checkboxes. The source PDF stays outside Git and Hosting; only blank field definitions/provenance are tracked. The repository is public.

`workforceApplications/{uid}` stores the owned draft/submission; its versions subcollection retains previous answers and signatures. `workforceAccounts/{uid}` preserves the same account identity and status. Existing active/inactive/former employment accounts are routed to HR instead of being overwritten with a new application. Missing HHA/ADP linkage is not guessed, and no external employee creation occurs. Every private read/save/submission is audited without names, SSNs, dates of birth, answers or document bytes in audit payloads. Personnel reads use both office scope and explicit HR/owner authority. Activation and hiring decisions are not implemented by this intake change.

The private folder supports optional/HR-requested photo ID, Social Security card and other acceptable employment-authorization images. ID plus Social Security card are not blanket I-9 prerequisites. Phone capture uses a user-controlled file input with `capture=environment`; it does not enable site-wide camera access. JPEG/PNG images are limited to 8 MB and 24 megapixels, decoded, orientation-corrected, resized and re-encoded to JPEG. Original filenames, EXIF/GPS and original bytes are not retained. SVG, PDFs, malformed images, undersized images and unsupported encodings are rejected. Raster sanitization is not a claim of universal malware detection. HEIC/PDF support is intentionally not enabled in this photo workflow.

`workforcePrivateDocuments/{randomId}` stores ownership/category/status/hash/immutable Storage generation/retention class. Objects live at `workforce-private/{uid}/{randomId}.jpg` in the existing private bucket, with create-only generation preconditions and private/no-store metadata. Direct client Storage/Firestore access remains denied. No public URLs, download tokens or signed bearer URLs are generated: downloads pass through a recently authenticated server endpoint, recheck ownership or current HR office/permission, verify stored byte count/hash and log access. Recent login means 15 minutes. Upload attempts are bounded at 20 per UID/hour and folders at 100 records; failed records count until reviewed. Every new image has its own ID; no prior document is overwritten.

Upload state is pending until both Storage and metadata finalize. Storage/metadata failure returns an unconfirmed result and prevents download; orphan recovery is an operator task, not blind re-upload or automatic deletion. Uploaded images say pending HR review, never eligible/verified automatically. Retention class and legal-hold placeholders are stored, but class-specific schedules, legal-hold operations, deletion, backup handling and live IAM acceptance must be approved/configured before collection. No automatic deletion or general compliance-document folder is claimed complete.

Additional API contract:

| Endpoint | Purpose / authority |
| --- | --- |
| `GET /caregiver/workforce-api/application/packet` | Blank schema and page inventory only; no original PDF or answers |
| `GET /caregiver/workforce-api/application/session` | Verified same-project caregiver identity, gated by collection approval |
| `GET/POST /caregiver/workforce-api/application` | Own application; revision-controlled saves, recent verified login; UID/office never accepted from request body |
| `POST /caregiver/workforce-api/application/submit` | Current revision plus release/signature evidence; does not hire/activate |
| `GET/POST /caregiver/workforce-api/application/documents` | Own private folder / sanitized image upload, additional document/retention gate |
| `GET /caregiver/workforce-api/application/documents/{id}` | Own, finalized generation-bound image, authenticated download |
| `GET /primetime/workforce-api/staff/applications` | HR/owner with applications.review, explicit office scope, up to 50 per office |
| `GET /primetime/workforce-api/staff/applications/{uid}` | Current HR grant/scope, recent login and access audit |
| `GET /primetime/workforce-api/staff/applications/{uid}/documents[/{id}]` | Additional documents.review, recent login, current scope and ownership verification |

Packet exceptions requiring HR review: page 11 explicitly is not a consent/authorization form; page 18's old bank-document email instruction is not implemented (use approved ADP); pages 20–21 are incomplete rate-letter excerpts, not employee wage promises; page 22 ends mid-probation sentence; page 25 is only page 1 of an older I-9 edition and lacks acceptable-document lists/instructions. Staff, medical, payroll and performance-review forms stay in their proper later-stage workflows. Obtain the complete current official I-9 and approve the remaining legal/policy documents before presenting them for signing.

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
| WF-007 | 2 | Implemented / synthetic tests | Same-project caregiver session, email-link UI and exact selected-ID return; live/cross-device provider acceptance pending |
| WF-008 | 2 | Implemented / synthetic tests | Source-backed intake, persistent versioned draft/submission, electronic release evidence, HR queue; no production collection |
| WF-009 | 2 | Implemented intake/folder; blocked for release | Packet received and all pages mapped; upload/camera, owned private image folder and HR access implemented. HR must approve required-field/signature policies, complete missing/current forms and verify live IAM/retention before collection |
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

See the final verification results appended below. Tests use synthetic identities and data; transaction tests use an in-memory contract double, not a live database. Existing Firestore/Storage deny-all client rules are unchanged and tested by repository contract checks, not new emulator execution. Live Firebase email delivery, new staff identities, permissions against deployed IAM, vendor entitlements and HR/legal acceptance are unverified. Document routes now have domain, transaction-contract and synthetic-browser coverage. Live provider, IAM, Storage-rule/emulator and retention acceptance remain pending; no vendor integration endpoint was added.

## Next priority

Complete WF-005: validate the staff/owner identity bootstrap and office scopes in an approved Firebase test environment, add emulator/concurrent grant-revocation tests, and perform two-person publishing acceptance. Then complete live applicant/session and private-upload acceptance, approve the digitized field/signature policy and remaining legal/onboarding documents, and configure actual retention/backup controls before opening collection. Do not open public opportunities or applicant collection to demonstrate unfinished functions.

### Final local results

- Node 22.22.0: **791 backend tests passed**, including 41 workforce tests; **549 site/tooling/analytics tests passed**, including seven workforce/browser-contract tests. 1,340 Node tests total after integrating the concurrent visit-maintenance workspace; no failures or skipped tests. Prior foundation commits passed GitHub Repository quality, including its Linux release wrapper; this packet update requires a new CI run.
- TypeScript compilation passed. Generated Primetime assets and workforce asset hashes are current.
- Individual release generation/verification commands passed: HHA preservation evidence, article generation/tests, SEO metadata, sitemap dates, site output, insurance-logo integrity, Batch A/B1–B4, structured navigation, accessibility, performance, frontend controls and repository integrity audit.
- The Windows environment lacks Bash, so the Bash release wrapper itself and its shell-syntax sweep were not run. Its applicable generation/verification commands were executed individually with UTF-8 Python; generator stability was checked with `git diff --exit-code` for public/source/scripts/config. Existing CI retains the full Linux release wrapper.
- Marketing generators retained the private portal files and all seven workforce runtime assets. The workforce layer has a separate 75 KB raw / 22 KB gzip cap; existing operations limits remain in force.
- Narrow-screen local browser: Careers filters/entry points and closed registration/staff states were observed. Local synthetic Firebase stub plus the compiled opportunity domain verified draft save, review submission, independent reviewer approval, publication and edit-to-draft invalidation. No live Firebase authentication or Firestore persistence was tested by this browser exercise. Full responsive matrix, assistive-technology review and live identity acceptance remain open.
- Dependency audit: root tooling has zero vulnerabilities. Functions has zero high/critical findings and four moderate findings in the existing glob/minimatch/rimraf/google-gax chain. Non-breaking lockfile updates to body-parser 2.4.0 and qs 6.17.1 removed the high and one moderate advisory. Further dependency remediation is tracked under WF-005 before sensitive release.
- No production deployment, live grants, application collection, public opportunity publication, HHA writes or ADP writes occurred.

### Packet update verification

The 27-page scan was rendered locally; no source PDF, page render, ID image or completed applicant data is committed. Actual decoding/EXIF stripping, ownership, direct-object denial, active/former-account preservation, version/signature binding, office-scoped HR reads, grant revocation, upload/metadata failure, integrity checks, recent authentication and quota limits pass synthetic tests. Browser testing verified step navigation, server-backed resume after reload, review/signature submission, native file selection, local image preview and an uploaded/pending-HR receipt using an image explicitly marked SYNTHETIC / NOT AN ID DOCUMENT. Phone camera permission/capture and real Firebase/Storage behavior remain device/deployment acceptance, not claimed tested.
