# Patient document source readiness — November 2, 2026

## Status

The owner approved and activated SearchPatientDocument and DownloadPatientDocument:
exactly thirteen reads (prior eleven plus only these two), with other preferences
unchanged. GetPatientDocumentType and both care-plan reads remain disabled. The
first live metadata read was refused by a parser shape check; no file was returned.
A BaseResponse Result correction now passes full-envelope and regression tests;
its normal release and successful live retry are pending. T04/F03 and the wider
source goal remain open. No source-write control has been changed.

## Exact source contract

The [captured WSDL](../../hharefs/hha-wdsl.xml) defines SearchPatientDocument with
one PatientID and nullable document/type/date filters. Returned
PatientDocuments/PatientDocument includes PatientDocID, PatientID, type metadata,
filename, created timestamp and optional string FileSize. The public projection
excludes Description, CreatedBy and content. Existing internal metadata/recovery
workflows retain their separate Description projection, now using direct paths.

DownloadPatientDocument accepts only PatientDocID and returns PatientDocument
with that ID, optional FileName, ContentType, StreamData and FileSize. Its response
does not supply patient or office identity. A document ID alone cannot establish
patient membership. These are files; no clinical form instance, approved version,
autofill schema, visit/encounter link, reviewer/signature or sharing contract is
established. The accepted Firebase Forms library remains a separate storage source.

## Public administrator boundary

The existing protected POST /workspace/read intercepts both patient-document
operations. Discovery requires one patient and the configured office, approved
operational release, SearchPatientDocument and GetPatientDemographics grants.
Download additionally requires DownloadPatientDocument and an exact document ID.
All filters are validated before dispatch. There is no staff/patient/therapist-role
grant, source edit, automatic import or communication.

Fresh unique, untruncated patient-office proof is required before and after
retrieval. Download also obtains fresh exact patient/document metadata before and
after the blob read, rejects changed available metadata and compares known
filename/size with bounded bytes. Settings/release changes discard the result.
Every source dispatch retains shared quota and vendor backoff controls. A local
elapsed guard leaves the single-attempt transport timeout and response headroom;
it does not automatically retry or return unverified bytes.

Independent reads are not atomic. Equal projected metadata does not prove an
immutable document version or clinical approval. Date filters use the existing
vendor request shape; document date/time semantics and complete coverage remain
unvalidated. No inferred service-date or patient-form join is introduced.

## Parser, file validation and screen

All metadata rows, including those beyond the 200-row preview cap, must have a
direct matching PatientID, unique direct document ID and honor exact requested
document/type filters. Nested/duplicate roots, identities and malformed or
nil-with-content collections fail closed. Missing/nil remains null; explicit empty
and zero strings remain distinct. Metadata never includes source file bytes.

The optional FileSize bug is fixed: absent/nil/empty is unknown, not zero, and no
longer rejects otherwise valid bounded bytes. Nonempty declared sizes retain
strict numeric/matching validation; unsupported units or mismatches are refused,
not guessed. Duplicate/non-scalar declared sizes cannot become an unknown-size
bypass. Bytes must be canonical base64 and at most 2 MiB. Public attachment fields
are reconstructed after validation, unsafe filenames are sanitized, vendor MIME
is not trusted for rendering and content is served as application/octet-stream.

Patient metadata cards now select Read attachment, retaining exact patient/office
and document ID. Selection itself makes no source request. A separate explicit read
retrieves bytes; the existing Save attachment action requires its device-save
confirmation. Nothing automatically saves, renders, uploads or copies private
files into the Forms library. Input changes, Demo and sign-out discard late bytes.
The caregiver metadata/type action remains separate and unchanged.

## Verification and release boundary

Runtime bcae55a passed all three normal jobs in workflow41534493045: Hosting
22:08:12/backend22:09:52/analytics22:09:55UTC. Public22:12:38.649UTC checks match
12exact assets;9existing plus2additional anonymous private boundaries pass.
Native discovery and download inputs include patient/office, with exact ID for
download. Both pre-enablement attempts were refused; private inputs were cleared.

The subsequent specific owner approval was saved through the native Chrome UI.
All thirteen selected reads exactly match the prior eleven plus the two approved
methods. Office/timezone/policy/threshold values match before/after. The type lookup
and both care-plan grants remain unchecked. A real metadata attempt then returned
patient_document_response_shape_unverified, so retrieval was not accepted.

The captured WSDL BaseResponse defines a direct Result with a Status attribute.
The new strict plan/document parsers had incorrectly allowed a sibling Status but
omitted Result. Four real-SOAP-parser regressions reproduced the error. The fix
accepts only unique closed Result/ErrorInfo/Details metadata, excludes it from
records and still refuses duplicated metadata or records nested inside Result.
Six new tests cover all four resource methods and failed application results;
all621backend tests pass. No new grant, client asset or relaxed record-identity/
size/membership rule is introduced by this correction. Successful native retrieval
must still be established after its normal release.

Seven parser tests reproduced the prior failures before implementation. Eighteen
new backend tests now pass: strict source shape/identities/filters, optional size,
unknown/empty/zero, membership before bytes, transfers, metadata changes, closed
attachments, release/settings races, local elapsed budget and public-route scope.
Two browser tests verify exact file selection, no automatic source request/save,
the existing device-save cancellation and stale response clearing.

Full local checks pass: 615 backend and 383 browser/tooling/public-analytics guard
tests. Generated assets are current: 11 files / 373933 bytes plus unchanged catalog;
418882 total raw / 101999 gzip bytes within original 420000/102000/110000-per-file
budgets. Site/performance checks pass. Unchanged analytics-backend acceptance is
separate; normal CI still performs all release checks and deployments. No release
or actual source success is inferred from these synthetic checks.

## Required next acceptance

1. Initial normal release, production assets/private boundaries, scoped input
   metadata and pre-enablement refusal are DONE. Release the BaseResponse fix
   normally and verify it before retrying the unchanged source context.
2. DONE: specific action-time approval and exact thirteen-read activation for
   existing administrators. This adds only private patient metadata/content reads;
   it does not enable GetPatientDocumentType or either care-plan method.
3. Retrieve one authorized patient's metadata through the deployed API. If a
   uniquely returned file exists, read that exact file through fresh membership
   checks. Inspect identity, source-empty/unknown states and attachment readiness
   without persisting private source values or file bytes in artifacts/logs/Git.
4. Verify context clearing and restore the office-today live feed. A successful
   source-empty response is not a failed connection or proof of zero documents.
   Record access, shape, size-format or coverage blockers precisely. T04/F03
   clinical-role, form/version/signature/sharing and full-coverage work stay open.
