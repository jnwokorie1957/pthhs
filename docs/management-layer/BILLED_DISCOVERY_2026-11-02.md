# Patient-scoped billed-visit discovery — November 2, 2026 UTC

Status: normally deployed, explicitly enabled by the owner, and accepted for one
successful patient-scoped empty production result. Returned-row and usable billing
fact acceptance remain unverified. This does not complete B02 or establish a
usable billed record.

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

## Normal release and protected input acceptance

Runtime `5642efcb02fba0c99d560636fda79e19fb10fb98`, tree
`1453cb2b7e3f47ae100c0e408be839181cca5edd`, passed all three normal jobs in
[workflow41511520697](https://github.com/jnwokorie1957/pthhs/actions/runs/41511520697):
Hosting19:37:12, backend19:38:24 and analytics19:39:09UTC. Twelve exact assets and
nine anonymous401/private/noindex boundaries passed at19:39:01.560UTC. No asset
or read/write setting was changed by this backend release.

The retained Chrome tab was refreshed and its existing sign-in restored normally.
Selecting SearchBilledVisits now visibly exposes office, date and patient inputs,
with the unrelated record-ID input hidden. Fresh owner controls retain exactly
the original ten enabled reads, including the approved legacy billing method;
SearchBilledVisits remains unchecked. No search request has been submitted.
The automatic feed remains connected with a current-day receipt19:39:01.320UTC.
The owner-control screenshot contains no source patient/staff values.

A separate specific confirmation was requested to enable this additional
read-only patient/office/day discovery for existing administrators. The browser
confirmation policy requires action-time approval for expanded sensitive-data
access; this is not a repeat of the already applied legacy billing grant. Keep
that question pending and do not enable or query this source before the answer.
No usable billed record, financial meaning, full-office completeness or recovered
EVV time is claimed. P12's separate accepted display work is preserved.

## Approved activation and actual empty source result

The user answered Enable patient-scoped billed search. Freshly reloaded controls
had ten reads and SearchBilledVisits unchecked. Only that checkbox was changed;
the staged and saved/reloaded list has eleven reads and retains all original ten.
Office, timezone, policy reference and both thresholds are unchanged. The fresh
UI still reports zero specific source-write workflows approved. The earlier
pending question is answered and must not be repeated.

An ordinary Advanced tools request used the already-verified affected patient,
configured office and October24 service-day selector. The deployed reader first
required fresh patient-office proof and then completed SearchBilledVisits. The
visible result says Read completed: 0 record(s), with a browser-local fetched
label November2 at13:49:16. The source explicitly reports no records returned,
not a zero census or balance. No candidate was available to pass to a scoped
billing reader, so no additional detailed billing request was issued.

This accepts the bounded live connection and its honest empty-result path, not
returned-row identities, source-date semantics, full-office coverage, a finalized
billed status, financial facts or a missing EVV event. Positive/foreign/malformed/
truncated row cases remain synthetic. B02 still needs an actual supported billed
record and account/office/date/filter coverage evidence. No arbitrary date grid,
website import, source write, clinical/financial decision or communication occurred.
