# Visit Preview source-delay messages — November 5, 2026

Visit Preview previously used the same "Source read delayed" text for deferred
HTTP 429 and HTTP 503 responses. This concealed the distinction during the
November 5 historical-page investigation.

The trusted deferred-response branch now displays "Read rate limited (HTTP 429)"
or "Source temporarily unavailable (HTTP 503)". It retains the selected
office/date/cursor, clears prior facts and preserves the existing validated retry
delay. It does not identify which system imposed a limit or why a source was
unavailable. Arbitrary vendor error messages are not displayed.

No source mapping, read limit, grant, background policy, clinical interpretation
or HHA action changes. Missing clocks and source durations retain their existing
explicit empty/unavailable treatment. Concurrent maintenance headroom and layout
changes were preserved before publication.

## Verification and release

- Runtime: `4f23d864e4f80ec32d55dc94991aa6fcf4018aeb`, exactly four files: source
  and generated dashboard, generated index and data-mode regressions.
- [Normal release 42086614560](https://github.com/jnwokorie1957/pthhs/actions/runs/42086614560):
  all four jobs succeeded before final production acceptance.
- Both new regressions fail against the original dashboard and pass with the fix.
  They cover both status categories, private-message exclusion, disabled controls
  during the delay, no duplicate read, exact retained request and normal recovery.
- 490 frontend/tooling and 55 analytics tests passed after the headroom update;
  the subsequent layout update also passed all 268 maintenance/data-mode tests.
  Three timezone source-time runs passed eight tests each. All 25 ordered site
  checks and preservation of 15 protected app files passed on the final version.
  Normal CI also passed its required backend and full release checks.
- All 15 production assets exactly match the reviewed commit with noindex
  headers. Ten anonymous API boundaries, including maintenance cases, return
  401 JSON with no-store/noindex protections.

## Signed-in production observation

An isolated Chrome tab loaded the new version and a normal current-day partial
preview. After all release jobs succeeded, one approved October 24 date selection
returned ten visit IDs: four readable details and six unavailable details. At
18:46:11 UTC, the four readable rows supplied scheduled starts/ends, recorded
starts/ends and EVV starts; three supplied EVV ends. Three supplied both raw HHA
actual-hour fields; one supplied an explicit empty pair. These are field-presence
counts, not clock values or completed/verified/worked/billable conclusions.

The historical result correctly remained partial and disclosed a retry delay.
No retained-page retry was performed. This successful partial response did not
exercise either top-level HTTP error message; both 429/503 branches remain
verified synthetically. The six individual detail failure causes were not
independently classified. Do not attribute source availability to this text-only
fix, or treat these rows as an exact re-read of the original screenshot visit.

Office today was restored and the isolated tab closed. Existing user tabs and
maintenance cases were untouched. No private values, source IDs or responses were
saved; no HHA write, import, grant, account/pilot or communication occurred.

O02 remains partial; P03/E04, retained event linkage and source-action gates stay
open. The original October 24 screenshot remains resolved by its October 31
independent re-read. Existing protected owner/vendor follow-up remains unchanged;
this display fix requires no new owner action.
