# Billing-record clock fields — November 5, 2026 trigger

The approved `GetVisitBillInfo` and `GetVisitBillInfoV2` readers omitted two
documented fields: `VisitBillInfo/VisitStartTime` and
`VisitBillInfo/VisitEndTime`. Both now appear as independent raw billing-record
evidence in Advanced tools, under the operation's own source receipt.

This closes a projection omission. It does not recover missing V3 clocks,
original EVV punches or HHA actual hours. The historical comparison below used
clocks that were already supplied by V3. P03/E04 remain open, and the original
October 24 screenshot remains resolved by its October 31 independent re-read.

## Contract and bounded implementation

The [captured ENT WSDL](../../hharefs/hha-wdsl.xml) declares the response record
`VisitBillInfo`, with schema types `VisitBillInfoDetails` and
`VisitBillInfoDetailsV2`. Both clock fields are optional `s:string` elements
(`minOccurs=0`, `maxOccurs=1`), not typed timestamps or durations. The November 5
public metadata acquisition is documented in the
[maintenance resource register](evv-maintenance-resources/SOURCE_INDEX.txt).
The two individual anonymous method-reference pages could not be opened by the
research browser; no fresh retrieval of those pages is claimed.

Both projection lists now retain the two keys and use the existing strict
direct-scalar clock parser. Explicit empty strings, zero and literal whitespace
remain source values. Absent, nil, duplicate, nested-only or non-scalar fields
remain unknown. Exact direct visit/patient/caregiver/date identities and the
operation, source and fetch provenance remain intact. Generic Advanced tools
already renders the returned fields; no frontend change was needed.

`GetScheduleInfo` supplies scheduled clocks and separate bill-to duration data.
Neither those fields nor billed/payroll/suggested time or a calculated span may
fill actual clocks, original EVV fields or `ActualHours`/`ActualHoursRounded`.
The billing schema does not establish an original-event or actual-hour mapping.
No clock conversion, units assumption, rounding or interpretation was added.

Runtime `baa3bc35ad6b36a2178aff4b18203dfb92beb4ca` changes exactly
[operations/reads.ts](../../functions/src/operations/reads.ts) and
[billingRecordedTimes.test.ts](../../functions/src/operations/billingRecordedTimes.test.ts).
V3 previews/feed totals, EVV/hour mappings, read grants, identity/office guards,
quotas, source-write gates and clinical/financial controls are unchanged by this
fix. Concurrent workspace/reference catalogs, the public inquiry-recovery
article and the subsequent folded-tools navigation correction were preserved.

## Tests and normal release

- Four regressions fail against the original projections and pass with the fix,
  covering both operations, literal/empty/unknown distinctions, exact identities,
  nested/duplicate/nil ambiguity and prevention of schedule/billing substitution.
  Existing raw billing fields are preserved; no EVV/hour field is invented.
- TypeScript and all 780 backend tests pass after the concurrent workspace change.
  All 25 ordered site/release checks and the generated-asset check pass. Local
  generation preserved all 17 protected frontend files byte for byte.
- The reviewed 500000 raw / 128000 Node-gzip aggregate and 110000 per-file limits
  were retained. No asset or dependency allowance changed in this fix.
- Parent release 42119344430 succeeded before this child was published.
  [Normal release 42119883741](https://github.com/jnwokorie1957/pthhs/actions/runs/42119883741)
  completed all four jobs successfully: release scope, Hosting, backend and
  website analytics. No release control was bypassed.
- Post-release public verification at November 6 00:13:40 UTC found all 17
  protected assets exactly equal to the reviewed runtime, with noindex headers.
  Eleven anonymous API boundaries, including `/workspace/read`, return 401 JSON
  with no-store/noindex protections. This is dated runtime verification; later
  independent frontend releases have their own acceptance.

## Signed-in source comparison

Native checks occurred on **November 6 UTC**, while the office-local day was
still November 5 in America/Chicago. The filename follows the November 5
22:02 UTC heartbeat, not the later native receipt date.

After every release job succeeded, an isolated authorized Primetime tab selected
October 24. The first preview returned ten IDs, nine readable details and one
unavailable detail; it remained partial and no retained-page retry was made.
One readable row with a supplied recorded pair was opened through its own source
shortcut. A single approved `GetVisitBillInfoV2` read returned one 16-field
billing record. Visit, patient, caregiver and date matched exactly; the preview's
existing patient-office proof established the office scope. Both newly exposed
clock fields were supplied and exactly matched the V3 preview without conversion.
Preview search/office receipts: `2026-11-06T00:14:12.843Z` and
`2026-11-06T00:14:13.263Z`; billing receipt:
`2026-11-06T00:16:35.128Z`. No source identifiers or time/hour values are retained
in this evidence.

A bounded current-office-day preview returned ten readable details and zero
unavailable. One row with a supplied recorded start and missing end was selected
through its own source shortcut. A single approved V2 billing read succeeded but
returned **zero billing records**, at `2026-11-06T00:19:08.177Z`; preview receipts
were `2026-11-06T00:18:06.638Z` and `2026-11-06T00:18:07.012Z`. This proves an empty
bounded billing result, not empty billing clock fields, a failure, pending status
or missing-time recovery. No unchanged retry followed. Empty-field behavior and
the legacy billing variant have synthetic regression coverage; neither has
native acceptance in this pass.

Read-only owner controls showed 21 selected reads, including both billing
variants; `GetVisitInfoV2` remained off. This later observation supersedes older
dated counts only for this session. No permission was saved or broadened by this
task. Office today, Overview and the Live feed were restored; the isolated tab
was closed and private comparison buffers cleared. User tabs, cases and source
records were untouched. No import, source write, communication or operational,
clinical or financial decision occurred.

## Remaining source action

Use the existing protected HHA/vendor review for an affected historical visit
with a recorded end but empty original EVV end/actual-hour fields. Keep exact
identity/office/date and independent receipts private, and establish the
supported retained original-event-to-visit linkage, endpoint/filter/retention
semantics and documented hour units. The current-day zero-record billing result
also needs vendor semantics before interpreting availability. Do not infer
completion, work, payable/billable or verified status from clock presence.
The [prepared technical questions](evv-maintenance-resources/HHA_SUPPORT_QUESTIONS.txt)
remain unsent; no duplicate owner permission request is needed for these already
approved billing reads. Original-event, source-action and readback gates remain.
