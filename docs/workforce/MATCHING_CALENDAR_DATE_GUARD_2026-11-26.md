# Matching calendar-date validation

JavaScript accepts some impossible dates by moving them into the next month.
For example, February 30 became March 2. Staff matching previously accepted that
normalization for timestamps with explicit offsets. A malformed HHA schedule
could move outside the requested week and disappear from the clipped commitments.
This was reproduced with synthetic data; no affected production record is claimed.

The shared matching date validator now verifies the calendar date before any
timestamp conversion. Invalid entered windows retain `matching_time_invalid`;
invalid source dates retain `matching_hours_unverified`. Local Central times
also use the calendar check. Valid leap days, fractional seconds, explicit DST
offsets and already-supported end-of-day notation retain their behavior. An
ambiguous Central time without an offset still requires review.

The affected source consumer is `workforce_matching_hours`, using the existing
`GetVisitInfoV3Result/VisitInfo` schedule/recorded start and end fields. The raw
operational projection is unchanged. No EVV punch, duration unit, absence/status
history, complete availability or paid-hour interpretation is added. In
particular, this guard does not complete the November 26 absence/status research
tasks or recover any unavailable HHA time. The original October 24 observation
remains resolved by the independent October 31 reread.

Validation before publication:

- Three new regressions fail before the fix: entered calendar rollover, source
  rollover and a malformed source schedule disappearing outside the selected week.
- All 18 matching/source tests and all 1,063 backend tests pass after the fix.
- The focused tests also pass with process timezones UTC and Pacific/Auckland;
  calendar validity does not depend on the machine timezone.
- Four existing matching frontend tests pass. Primetime assets, workforce runtime
  and workforce asset references are current; no generated asset changes or size
  budget increases are needed. TypeScript and diff checks pass.
- Refresh the generated sensitive-term register to match the preserved public
  article text: four context cells change, with all 871 row identities,
  classifications and rationales unchanged. No article or classification rule
  is edited. This repairs the generated-file consistency check for that text.
- Only fictional records and mocked HHA reads are used. No source record, grant,
  assignment, clinical/financial state or communication is changed.

Release scope and remaining acceptance:

The base is `a493298b09c4ef74f542c3361a16dc2677347060`. Before any application
edit, its isolated control push [45759719211](https://github.com/jnwokorie1957/pthhs/actions/runs/45759719211)
was verified: the scope step succeeds with mode `none`; all three deployment
jobs skip. That proves control rollout isolation, not inventory-reader setup,
January rehearsal, application delivery or HHA acceptance. This change edits no
release controls and follows the normal PR checks and release workflow.

Concurrent article edits and PR73's short-lived inventory-token correction were
then preserved on base `d12de2709f22a6f77d3fa2bd16ce82e98d8a4622`. Before the
application commit, the latest isolated control push
[45764520685](https://github.com/jnwokorie1957/pthhs/actions/runs/45764520685)
also passes its scope step with mode `none` and all three deployment jobs skipped.
No backend or matching source changed between the two bases; the tested Functions
content is identical. The new controls are separate from this application diff.

The January 1, 2027 Central shared publication hold remains. Matching setup,
source reads, paid-hour interpretation and later module approvals remain
independent. After authorized publication, verify the deployed source and use
approved synthetic/test cases to confirm invalid calendar dates hold, valid
offset/precision behavior is preserved and existing denial/pending outcomes
remain. Do not create or edit an HHA record to test malformed source data.
Production and authenticated acceptance remain pending until that evidence exists.
