# Patient document source readiness — November 2, 2026

## Status

The owner approved and activated SearchPatientDocument and DownloadPatientDocument:
exactly thirteen reads (prior eleven plus only these two), with other preferences
unchanged. GetPatientDocumentType and both care-plan reads remain disabled. The
first live metadata read was refused by a parser shape check. The BaseResponse
correction is now released, and six live patient scopes pass metadata retrieval:
four source-empty responses and two distinct returned document entries with exact
subject/selection checks. Both file reads failed upstream; no attachment was
released or saved. Protocol diagnostics are released and prove HTTP400/application
error-310 for an exact source document. A closed reason hint passes624backend tests
and awaits normal release/retry. T04/F03 and the wider source goal remain open. No source-write
control has been changed.

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

The Result correction8851ae0 passed all three normal jobs in workflow41538205284:
Hosting22:33:52/analytics22:35:32/backend22:35:50UTC. Public22:37:47.803UTC
verification matches12assets and11anonymous private boundaries (9plus2separate).
Native retries now prove bounded metadata retrieval for six authorized patient
contexts, including four empty responses and two distinct document entries.
Returned PatientID and selected document ID match the actual form/source record.
Both entries have empty filenames and omitted sizes; this does not prove that
they lack physical files. Both exact download attempts return hha_read_failed;
no Attachment ready or Save attachment control is rendered. No file is accepted.

The follow-up error path exposes only a closed protocol kind, bounded HTTP status
and a bounded numeric vendor error ID. It excludes vendor messages, XML, opaque
error codes/details, filenames, subject IDs and credentials. Retry-After controls
retain precedence; no retry, fallback or looser membership/byte validation is
added. Two additional tests cover privacy and backoff; full623backend checks pass.
Its normal release and an evidence-driven retry are pending. Existing383frontend
and46analytics-backend acceptance remain separate and unchanged.

Diagnosticfc9c218 passed workflow41551081518 all3jobs on November3UTC:
Hosting00:12:17/analytics00:13:43/backend00:13:48. Public00:16:04.007UTC checks
match12assets/11private anonymous boundaries. The exact second document now
returns `patient_document_download_failed_application_http_400_vendor_negative_310`.
This is a vendor application error, not EVV exception reason310. No file is returned.
The [current official operation page](https://app.hhaexchange.com/Integration/ENT/V1.8/ws.asmx?op=DownloadPatientDocument)
confirms the PatientDocID request and expected file fields. Public primary-source
search did not establish what-310 means; do not invent a permission/file diagnosis.

Runtime d4ae367 reduces the vendor message to a closed access/method/file/null-
reference/unclassified hint without emitting message text. One additional privacy
test and all624backend checks pass; normal release and the actual unclassified
hint are verified below.
All13approved reads, strict subject/metadata/byte checks and source-write gates are
preserved. No client asset or additional read grant is changed.

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

Acceptance update, November3 01:03UTC: runtime d4ae367fdf4379785f84aafc4a50a4c3dc3baea9
passed normal workflow41552527544 (Hosting00:24:19, backend00:25:39,
analytics00:26:10UTC). Public00:28:35.637UTC checks match twelve exact assets and
eleven anonymous private boundaries. The reason hint on a new distinct document
is `patient_document_download_failed_application_http_400_vendor_negative_310_reason_unclassified`.
This establishes the refusal category only; it does not establish why HHA refuses.
All624backend checks pass; client assets and their original budgets are unchanged.

The completed bounded sample is eleven patient contexts: eight successful empty
searches and three nonempty searches returning four metadata entries. Three
distinct, source-returned document IDs were selected for exact downloads; none
returned an accepted attachment. No file bytes were saved, rendered or copied to
Forms. Empty filenames and omitted sizes do not prove absent physical files.
Private lookup inputs/results are cleared and the office-today automatic API feed
is restored. Saved per-method receipts show metadata success and file-read failure
separately; missing current receipts on other methods are not new failures.

The owner confirms a working HHA file is open in Chrome. Fresh connector inventory,
all connected Chrome user tabs and the desktop window do not expose that HHA/PDF
tab. The retained Codex HHA page cannot currently be inspected through its browser
binding. This is a source-comparison access problem, separate from the functioning
Primetime API connection. Next owner action: bring the working file's Chrome tab
forward and enable the Codex connector in that same profile. Keep its private
contents out of chat, artifacts and Git. Then identify that exact patient's file
through fresh metadata/office checks and compare its API result. Do not substitute
a guessed ID, switch production credentials/endpoints blindly, retry unchanged
failures repeatedly or weaken membership/byte checks. If the exact known-working
file also fails, record the method, UTC time, HTTP400 and vendor-310 for the
authorized integration support workflow; no support communication is sent here.

1. Initial normal release, production assets/private boundaries, scoped input
   metadata and pre-enablement refusal are DONE. Release the BaseResponse fix
   normally and verify it before retrying the unchanged source context. DONE:
   Result correction released and metadata retrieval verified. Complete the
   bounded download-diagnostic release and inspect the actual refusal category.
   DONE: diagnostic and closed-reason releases pass; latest category is the
   upstream application HTTP400/vendor-310/unclassified refusal above.
2. DONE: specific action-time approval and exact thirteen-read activation for
   existing administrators. This adds only private patient metadata/content reads;
   it does not enable GetPatientDocumentType or either care-plan method.
3. DONE: authorized patient metadata retrieval through the deployed API. If a
   uniquely returned file exists, read that exact file through fresh membership
   checks. Inspect identity, source-empty/unknown states and attachment readiness
   without persisting private source values or file bytes in artifacts/logs/Git.
4. Verify context clearing and restore the office-today live feed. A successful
   source-empty response is not a failed connection or proof of zero documents.
   Record access, shape, size-format or coverage blockers precisely. T04/F03
   clinical-role, form/version/signature/sharing and full-coverage work stay open.


## November 5 Save-context guard release reconciliation

[384c2a72](https://github.com/jnwokorie1957/pthhs/commit/384c2a72e0c4a4067d239bfae88db86597f7d170)
passed [workflow 41975602344](https://github.com/jnwokorie1957/pthhs/actions/runs/41975602344).
All four jobs succeeded, independently rechecked November 5. The release record
reports 536 aggregate tests and 13 exact served files. These are dated results,
not newly rerun tests or fresh public-byte checks in this documentation pass.

The guard rejects stale patient, office, session, operation and read-input or
permission contexts before and after Save confirmation. Read invalidation revokes
tracked temporary object URLs. Synthetic retained-callback checks cover context
changes and replacement requests; they are not native or authenticated acceptance.
Source retrieval, permissions and explicit device-save confirmation are unchanged.

Upstream attachment retrieval and actual device saving remain OPEN. Native,
keyboard and assistive-technology acceptance remain OPEN. The earlier metadata
sample and upstream refusal evidence above are preserved; this client guard does
not resolve those source failures, accept V2 live behavior or complete O03.
