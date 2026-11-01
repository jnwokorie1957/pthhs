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
All543backend tests pass. Additional release/native comparison is pending. E04
remains open for actual source identity/linkage, retained call coverage and original
EVV history evidence. The diagnostic is not a recovered EVV end or permission to
expose unproved events. Keep actual examples in the protected review.
