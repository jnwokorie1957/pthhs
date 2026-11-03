# Patient care-plan read readiness — November 2, 2026

## Status

Implementation, synthetic checks, normal release and bounded production readiness
pass. The two additional owner read grants and actual source retrieval are pending. No HHA care-plan method has
been queried or enabled by this change. T04, F03 and the wider source goal remain
open. Existing eleven read grants and all source-write controls are preserved.

## Exact source and scope

The [captured WSDL](../../hharefs/hha-wdsl.xml) defines `SearchPatientPOC` with
one PatientID and returned `PatientPOC/POC` IDs, dates and plan numbers.
`GetPatientPOCInfo` accepts one POCID and returns `POCInfo/Patient/ID`, plan fields
and optional `Tasks/Task` definitions. No visit, authorization, clinical encounter,
form instance, signature, completed-duty or sharing relationship is supplied by
these shapes. Do not infer those relationships from dates or task codes.

The existing administrator-only POST `/workspace/read` boundary intercepts both
operations. It requires the configured office and one patient, approved data
release, the requested method grant and GetPatientDemographics. Fresh unique,
untruncated demographics must match patient and office before and after source
retrieval. Settings/release changes discard the response. Detail also requires
exact returned patient and plan IDs. Internal workflow query contracts remain
separate; no patient/staff/therapist-role entitlement is added.

## Projection and screen behavior

Direct paths prevent Category/Name from becoming Task/Name and prevent nested or
duplicate patient IDs from proving ownership. Malformed, nested/ambiguous roots,
duplicate discovery IDs and malformed task collections fail closed. Names from
Category, patient names, Notes and Instruction remain excluded.

Missing/nil fields stay null; explicit blank and zero strings are preserved.
Missing/nil Tasks is unknown, while explicit empty Tasks projects an empty list.
At most 200 source task definitions are projected, with partial/truncation evidence
when more are returned. The reader displays a labelled plan header and separate
task-definition cards linked by the accepted POCID; raw weekday and weekly fields
remain uninterpreted. Independent membership/source reads are not an atomic or
clinically accepted snapshot.

The existing metadata-driven screen exposes patient/office for discovery and
patient/office/plan ID for detail. Selecting a returned plan preserves subject and
office. Input changes, Demo and sign-out invalidate late results. The partial-result caption now covers row and task limits accurately. No new
library, security rule, index, IAM grant or deployment bypass is used.

## Verification

Six parser regression tests failed before the fix, including the reproduced
Category/Name error. All fourteen new backend tests pass, including ownership,
scope/release races, transfer detection, empty/nil/truncated tasks, malformed source
shapes, exact direct fields and literal CDATA markup. Two browser tests verify
metadata inputs, exact detail selection and late-result clearing.

Full local checks: 597 backend, 378 browser/tooling plus 3 public analytics guard
checks, and 46 analytics-backend tests pass. Generated assets remain current:
11 generated files / 373868 bytes; catalog unchanged. Total418817raw/101980gzip
remains within original420000raw/102000gzip/per-file110KB limits.
Repository audit passes with existing duplicate/suffix warnings. Normal CI still
runs the full generator/release checks before deployment. Native production
retrieval must not be claimed until actual successful source reads after approval.

## Released readiness evidence

Follow-up source-contract correction: the shared strict resource parser now handles
the captured BaseResponse Result/Status attribute. Four full SOAP tests reproduce
the omitted-Result failure (including both care-plan methods); all621backend tests
pass after the correction. Runtime8851ae0 passes all3normaljobs and actual document
metadata retrieval; care-plan retrieval remains untested. Care-plan grants remain OFF
and no care-plan query has been made. The two separately approved patient-document
methods bring the existing read set to13; no additional care-plan access is implied.

Runtime d944e6e first passed all three normal jobs (workflow41531207860). Caption
follow-up7d7d81d also passed all three (workflow41531680491): backend21:49:18,
Hosting21:49:20, analytics21:51:11UTC. Public21:50:06.574UTC verification matches
12exact assets;9existing anonymous boundaries plus generic source-read POST and
read-health GET each return401 with no-store/noindex.

Native signed-in metadata exposes patient/office for discovery and patient/office/
plan for detail. Both owner grants are unchecked; all eleven approved reads remain.
An explicit pre-enablement discovery attempt returns `Enable this read in owner
controls after entitlement review.` with zero cards, before HHA dispatch. Patient
input was then cleared. No new grant, HHA care-plan query or clinical action occurred.
Owner controls show the two precise unchecked choices; a specific action-time
decision has been requested. No actual care-plan source retrieval is accepted.

## Next acceptance

1. DONE: normal GitHub/Firebase release and production metadata/disabled grants
   verified without an HHA care-plan dispatch.
2. Obtain the specific action-time decision for SearchPatientPOC and
   GetPatientPOCInfo for existing Primetime administrators only. Browser policy
   requires confirmation before expanding access to private care-plan data.
3. Preserve the eleven existing grants and other preferences. Fetch one authorized
   patient discovery; if records exist, fetch one exact returned plan. Compare
   identity, task names and source-state disclosures without logging private values.
4. Test context clearing and restore the live office-today feed. Record actual
   source-empty, access or shape failures precisely; do not check T04 complete.

## Separate patient-document audit (F03; not implemented here)

Follow-up: [patient-document readiness](PATIENT_DOCUMENT_READINESS_2026-11-02.md)
implements the boundary and optional-size fix described below. Its release,
additional grants and actual retrieval remain pending; this care-plan audit was
the earlier finding, not current evidence that the fix is still unimplemented.

SearchPatientDocument rows carry PatientID; DownloadPatientDocument returns only
PatientDocID and optional FileSize. A safe future public path needs fresh
patient-office proof, exact patient-document metadata membership before download,
strict direct identities and bounded canonical attachment validation. The generic
projection currently turns missing optional FileSize into null, which the current
attachment validator rejects. Fix and test that distinction before exposing the
reader; do not treat missing size as zero. These methods remain disabled. Stored
bytes alone establish no clinical form, version, signature, review or sharing
contract. No document content was read or persisted during this audit.
