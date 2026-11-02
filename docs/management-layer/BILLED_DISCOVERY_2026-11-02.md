# Patient-scoped billed-visit discovery — November 2, 2026 UTC

Status: implemented and locally tested; normal release and protected production
acceptance are pending. SearchBilledVisits remains owner-disabled. This does not
complete B02 or establish a usable billed record.

## Problem and exact source

Both approved billing readers actually succeeded but returned no record for the
inspected historical visit. Original Billing Info rate/unit inputs are not proof
of finalized billing. The next supported source candidate is SearchBilledVisits,
whose captured WSDL request includes StartDate, EndDate, OfficeID and PatientID;
its response contains VisitID, PatientID, ContractID and OtherChargeID only.
There is no captured response paging cursor, per-row office/date, amount or EVV
clock. Search-date semantics and source completeness remain unvalidated.

The existing request builder always sent a nil patient filter and ignored a
supplied selector. It now requires a valid positive patient ID, configured office
and one valid calendar date and transmits all three. The existing Advanced tools
form receives the new patient field through its server-provided input metadata;
no frontend asset, new endpoint or capability catalog change is needed.

Before search dispatch, OperationsWorkspace requires both owner-enabled search
and GetPatientDemographics reads, the existing operational-data release, and an
exact configured office. A fresh patient read must return exactly one untruncated
record with matching patient and office. Settings are checked again before the
search and after its response. A missing/foreign patient, disabled prerequisite,
changed policy or data-release gate cannot produce a billed-visit result.

The reader validates the XML fragment, one direct optional collection and direct
record children. Nested/multiple/malformed/nil-with-content collections fail
explicitly. Only unique direct scalar paths supply the four raw fields; absent,
nil, duplicate or nested fields remain unknown, with explicit empty and zero
strings retained separately. Every returned PatientID must match the requested
patient, including rows beyond the two-hundred-row preview cap. A foreign or
unproved subject rejects the response before disclosure. Valid absent/empty
collections remain an honest empty result; truncation remains explicit.

The existing collection-note evidence lookup now passes its already selected
patient ID too. No write gate or collection/clinical/financial decision changes.
OtherChargeID is raw source evidence, without new zero/null-to-visit inference.
Source IDs and discovery labels alone do not establish cash, AR, payment, a
missing punch or authorization to edit any source record.

## Validation and remaining acceptance

Four behavioral regressions fail before the fix and pass after it: exact request
filters/input metadata; strict subject/field projection including a foreign row
beyond the cap; empty versus malformed collections; fresh patient-office and
permission/policy fences. Additional cases cover nil records, raw zero/empty and
ambiguous visit/contract fields. All575backend and373browser/tooling tests pass.
Generated assets remain current; performance checks pass within existing budgets.
All source examples in tests are synthetic; no private values are persisted.

After normal release, verify fresh signed-in input metadata and unchanged source
read settings. Only after a concrete owner decision enables this additional read,
query an exact previously verified patient/office/day. Compare returned candidate
identities against fresh approved visit/date/subject and patient-office reads
before trying either scoped billing reader. Keep actual-method receipts, no-record
outcomes and source coverage limits. Do not replace the already-approved legacy
grant with a duplicate request, scrape/import website values, or label this
discovery complete before production evidence exists.
