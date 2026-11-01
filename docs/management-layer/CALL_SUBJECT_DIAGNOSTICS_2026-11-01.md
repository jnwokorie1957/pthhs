# Rejected-call identity diagnosis — November 1

## Observed source gap

The first current source-page call control again returned the existing patient/
caregiver mismatch refusal. Request filter names and order match the captured
`GetCallDashBoardData` WSDL. The captured `CallInfo` contract permits absent
Patient/Caregiver objects; a present subject's ID is typed as an integer. A generic
mismatch cannot establish whether proof is unavailable, invalid, noncanonical
or genuinely different. No rejected values were inspected through a less scoped
reader, and no source record or missing clock was substituted.

## Bounded diagnostic

On that existing refusal only, recheck current office/data/read settings, then
emit `HHA call subject proof rejected` with just `patientIdentity` and
`caregiverIdentity`. Both are fixed enums: match, unavailable, invalid,
noncanonical_match or different. The first rejected row is classified, then the
same403 `call_subject_mismatch` is returned without any source rows or receipts.

Unavailable means a null/empty projected identity. This may arise from missing,
nil, empty or ambiguous direct-child source evidence; it does not identify the
raw XML cause. Invalid means it fails the positive32bit identity contract.
Noncanonical_match is bounded integer lexical similarity (for example whitespace,
a plus sign or leading zeros) to the requested ID; it never relaxes validation
or makes those records visible. Different means a canonical valid ID differs.

No source/request ID, name, actor, office, day, timestamp, clock, raw body, status,
credential or private value enters this log. No extra HHA read, retry, grant,
provider request, source write or clinical/financial decision is added. Scope
revocation prevents the diagnostic. Logger failure still returns the original
access refusal. Successful and empty source reads emit no new warning.

## Validation and acceptance

TypeScript and all541backend tests pass. Two new tests cover each fixed category,
private-value exclusion, unchanged three-source-read count, revoked settings,
accepted/empty results and diagnostic failure. The classification regression fails
against the old compiled module; its byte-identical replacement was restored
after the check. No browser/asset contract changes; existing generated assets
remain current and no performance budget changes.

## First diagnostic production acceptance

Runtime9b61103836db094f71524e847487f76bf4595f4e passed all three jobs in
[workflow41356250354](https://github.com/jnwokorie1957/pthhs/actions/runs/41356250354):
Hosting22:16:33, backend22:17:54, analytics22:18:11UTC. At22:18:36UTC,12exactassets
and9anonymous401/private/noindex boundaries passed. The existing retained source
page's first call control was explicitly rechecked once after release; it still
returned the same subject refusal and no record/context/receipt.

The safe log immediately following that check, November1,16:18:29.253CST, shows
patientIdentity invalid and caregiverIdentity match. Invalid establishes nonempty
unusable projected patient proof, not a missing or ambiguous null projection. No
source identity value, clock or raw response was inspected. The available browser
inventory contains no HHA application tab; this is availability only, not evidence
of failed source authentication. Repeating the same unchanged query is not useful.

## Additional independent AdmissionID comparison

The captured WSDL supplies `CallInfo/Patient/AdmissionID`, and the already approved
GetPatientDemographics supplies the verified patient's AdmissionID. The diagnostic
now compares these exact opaque strings without case folding, trimming or numeric
coercion. Both projections require unique direct scalar fields; missing, nested,
duplicate or nil fields stay unavailable. It adds only an `admissionIdentity`
category: expected_unavailable, unavailable, invalid, match or different. Controls
and overlong values are invalid; no reference value is logged.

This never replaces primary Patient/ID proof. Even an exact AdmissionID match
retains the original403, because its namespace uniqueness and any event-to-visit
association are not established by lexical equality. No extra API request, read
method, permission or source change is added. Existing rejected rows stay hidden.

Two additional regressions fail against9b61103 and pass after the extension.
All543backend tests pass. Runtimea81fdc89ccbdf6a5cbe6680588459d9f3a7b86f7 passed
all three jobs in [workflow41357272462](https://github.com/jnwokorie1957/pthhs/actions/runs/41357272462):
Hosting22:28:40, backend22:30:28, analytics22:30:15UTC. At22:31:14UTC12exactassets
and9anonymous401/private/noindex boundaries passed. Browser assets are unchanged.

The next explicit scoped read stayed refused and displayed no records/context/
receipts. Safe log November1,16:31:06.885CST shows patientIdentity invalid,
caregiverIdentity match and admissionIdentity unavailable. The expected patient
reference was usable; the first rejected call record did not provide a unique
usable AdmissionID. No source value was inspected/exported. This establishes only
the first rejected row, not every row in the response or absence of an original
clock-out. No identity fallback, automatic association or source edit occurred.

Primary guidance rechecked November1: the [system ID guide](https://knowledge.hhaexchange.com/enterprise/Content/Documentation/System-Intro/Sys-B-System-ID-Numbers-P.htm)
describes Admission IDs as generated unique references that authorized agencies
can change. The [EDI export contract](https://knowledge.hhaexchange.com/edi/Content/Documentation/EDI/EDI-Export-Interface-P.htm)
distinguishes the numeric electronic-exchange Patient ID from Admission ID and
the UI's MR-number label. Inference: preserve these namespaces; these general
references do not establish a SOAP-call-specific fallback or event-to-visit join.

Next independent API work is a bounded, values-free count of rows passing all
subject/day checks versus rejected rows. If verified target rows coexist with
rejected rows, audit a clearly partial display that retains every per-row check,
source truncation, policy/freshness and ambiguity guard; withhold all unproved
records and disclose rejected coverage. Do not turn filtering into apparent
completeness. If no row can be proved, retain the refusal and request protected
original HHA/vendor identity/filter/linkage evidence. No new method or grant is
needed for the count diagnosis. E04 remains open; keep actual examples protected.

## Whole-response count implementation

On the same existing subject refusal, the diagnostic also includes a fixed
`rowCounts` object and boolean `sourceTruncated`. It inspects the already returned
maximum200rows, without another source request, and preserves the same refusal.
No row or value is returned, admitted, replaced or linked to a visit.

Each row enters exactly one bucket in this order: invalid/duplicate CallDashboardID;
unproved exact patient/caregiver; failed existing day check; target without a time;
target with only the source service date; target with a clock value passing the
existing day check. All duplicate identities are counted as unproved, including
earlier copies. Counts sum to returned rows. They are not complete retained history.
Target buckets are per-row candidates only; any callIdentityUnproved count remains
a whole-request ambiguity concern. A zero is a predicate count in this bounded
response, never zero worked hours or proof that no original punch exists.

Only fixed categories, bounded counts and the truncation boolean enter the log.
Original identity/day/office/data/read-policy checks, scope revocation and logger
failure handling remain in force. Successful/empty reads emit no new diagnostic;
responses over200rows are rejected before count analysis. No source/filter or
permission changes occur. Two count regressions fail against the previous module
and pass after; all545backend tests pass. Cases include mixed subjects, duplicate
and invalid IDs, wrong dates, date-only/missing times, truncation, maximum size,
privacy and refusal preservation. Temporary compiled module restored byte-identically.
Normal release/native whole-response count acceptance remains pending.
