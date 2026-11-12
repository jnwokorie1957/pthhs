# HHA application transfer

New, verified portal applicants submit a signed application snapshot. The transfer worker creates an HHA service-provider profile with EmployeeType **Applicant**, discipline **PCA**, and office **503324**. Office staff manually move the profile to Employee in HHA; the integration never performs that promotion or assigns payroll, hire dates or worker credentials.

## Release boundaries

- The configured opening is January 1, 2027 at midnight America/Chicago (`2027-01-01T06:00:00.000Z`). The worker also enforces that minimum date in code.
- Only new schema-1 jobs from submissions on or after that opening are eligible. Older practice submissions are never automatically imported. No backfill runs over existing applicants or the HHA employee roster.
- All existing collection, encryption, retention, HHA source and staff-review approvals must remain enabled. Missing configuration stops dispatch.
- The separate EVV/ADP mutation gates remain closed. Existing HHA caregivers retain their office-held identity records.

## Verified source contract

HHA case 00579829 confirmed CreateCaregiver and AddCaregiverDocument were already available on November 11, 2026. The existing captured ENT v1.8 WSDL determines request element order and nullable elements. Read-only reference checks on November 12 confirmed:

- Endpoint: `https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx`.
- PCA is the Non Skilled discipline.
- Gender: Male, Female, Other. Gender and Ethnicity are required applicant answers; values are never inferred.
- Emergency Relationship is a required select using HHA's exact relationship names and IDs. Its live reference list is checked again before dispatch.
- Active Application document type: **132116**. The type lookup requires a known CaregiverDocID; verified lookup record **36828448** supplies that required reference input. No old identity attachment is downloaded by this lookup.

Gender, ethnicity and relationship references are revalidated before writing. A changed reference blocks transfer for office review.

## Transfer and reconciliation

1. The worker claims a transaction lease on the onboarding job and rechecks the verified, enabled Firebase identity, email, office, immutable submitted application revision and signature hash.
2. It renders the signed formal application, fixes PDF timestamps to the submitted snapshot, encrypts it with AES-GCM and the existing Cloud KMS key before writing private Cloud Storage. No plaintext PDF, key or answers are stored in the queue or logs.
3. A stable portal marker is searched in HHA AlternateCaregiverCode. A separate SSN duplicate check prevents creating another profile for an existing person. Possible matches require office review; they are never silently overwritten or linked.
4. The worker journals the create attempt, explicitly submits EmployeeType Applicant, and reads the returned profile back. Applicant type, exact office, portal markers, names, birth date, gender, ethnicity and verified email must match before attachment.
5. It journals the attachment attempt, adds the signed PDF under the Application category, lists the exact document under that caregiver ID, downloads it and compares its SHA-256 to the original PDF bytes. Only then is the job marked verified.
6. Unknown outcomes retain the attempted stage. A later run performs read-only reconciliation. It never blindly repeats an uncertain CreateCaregiver or AddCaregiverDocument call.

Only a source-budget denial that proves no request was dispatched can clear an attempt marker. The existing shared HHA backoff and request budget cover the new worker too. It runs every five minutes with one instance and no automatic platform retries.

Staff open **Applications → applicant → HHA application transfer** to see status and verified applicant/document IDs. Recheck requires fresh authentication plus current applications.review and documents.review grants for the exact office. Recheck preserves uncertain-write evidence. The existing email-code document access controls still protect staff downloads and printing.

Encrypted transfer artifacts are stored at `workforce-transfers/<uid>/application-r<revision>.pdf.enc` in the existing private forms bucket. Only backend service access can read them; client Storage rules remain deny-all. They remain subject to the application's existing retention process; this change does not introduce a purge or a new retention duration. Uploaded identity documents retain their existing encryption and scan workflow. No identity images are copied to HHA by this worker.

## Validation and operational evidence

- Backend suite: 960 tests passed; a subsequent deployment-policy test separately checks launch, office and document prerequisites.
- Targeted portal suite: 43 tests passed. Application assets pass hash validation and performance checks. The inherited performance baselines were measured at ed53425; this transfer UI adds 2,897 raw / 908 gzip bytes and no browser dependency.
- Captured-WSDL tests verify required nullable elements, order, explicit Applicant/PCA values and XML escaping.
- Mocked end-to-end tests cover exact PDF readback, concurrent claims, duplicate identity checks, tampered snapshots/ciphertext, incorrect office/type/document, disabled identities and interrupted-write reconciliation.
- Browser preview verifies the HHA Relationship dropdown and required Gender/Ethnicity controls with red missing-field highlights.

These checks do not constitute a real HHA write acceptance test. No synthetic applicant has been created in production. The separately authorized sandbox test remains gated by the exact sandbox endpoint, sandbox-only credentials, test office, accepted discipline and active application document type. Follow HHA_APPLICANT_UPLOAD_TEST.md and the fixed PTHHS-TEST-A100 receipt check when those inputs are verified. A statement that sandbox mirrors production does not establish those inputs.
