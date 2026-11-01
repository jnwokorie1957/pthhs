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

Normal release and native diagnostic acceptance are pending. E04 remains open
for actual rejected-subject evidence, retained call coverage and exact source
event-to-visit linkage. The diagnostic is not a recovered EVV end or permission
to expose unproved events. Keep actual subject examples in the protected review.
