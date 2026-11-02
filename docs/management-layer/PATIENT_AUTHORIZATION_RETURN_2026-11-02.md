# Return to fetched patient authorizations — November 2, 2026

Bounded follow-on to accepted T05: after selecting an exact authorization detail,
an administrator can return to the fetched patient/office discovery list. The
original receipt, source dates, exact authorization/contract selectors, truncation
and raw-unit cautions remain intact. The button restores DOM nodes retained only
in browser memory. It performs no HHA request, import, storage write or permission
change. Every explicit detail request still uses the existing independently
verified patient/office/authorization/contract reader.

Patient/input/operation/profile, office/policy revision, Demo, sign-out and access
changes invalidate the retained list and detached controls. Current failed or
malformed detail responses clear it; a late detail response after returning cannot
replace or clear the restored list. A new discovery invalidates old selectors.
Read sequence numbers stay monotonic. Date-only visit changes preserve this
independent patient/office authorization scope. The restored status explicitly says
previously fetched and directs the administrator to Read source records to refresh.
No remaining hours, eligibility, usage, billability or visit-to-authorization join
is inferred. Existing grants and source-write controls are unchanged.

Implementation and bounded signed-in production acceptance are complete.
Three behavioral regressions
failed before implementation and pass afterward, including nine invalidation
variants. All 376 frontend/tooling tests pass. Equivalent default input/option
markup and a shorter generated source-path comment fund the feature; one shared
live/read gate preserves existing conditions. Compliance wording retains the
90-day/six-month windows, completeness and chosen-item/filter caveats. The original
420000 raw/102000 gzip/per-file budgets remain unchanged: 418658 raw and
101947 gzip bytes. All 24 generator/QA steps pass and preserve the 12 private
artifacts byte-for-byte.

No backend change is included. Concurrent H03 per-read health work remains owned
by the other goal chat. B05 was already approved with a successful empty native
result; it is not pending permission. P03/E04/B02/T04/S02 and external family/staff
role and action contracts remain open. This feature does not recover missing visit
time or close those source-contract gaps.

## Production acceptance

Runtime [915a87f](https://github.com/jnwokorie1957/pthhs/commit/915a87f995191ba128fdaadacbf65d1f273a924e)
passed normal [release 41517857604](https://github.com/jnwokorie1957/pthhs/actions/runs/41517857604):
Hosting at 20:18:20, backend at 20:18:35 and analytics at 20:20:20 UTC.
All 12 public artifacts exactly match; 11 anonymous API routes return JSON401
with no-store. Private noindex remains. Exact markup-default equivalence was
checked; seven other JavaScript bodies remain identical below their shorter
source-path comment.

Signed-in Chrome acceptance at approximately 20:21–20:23 UTC:
13 discovery rows and exact selectors; Back before fetching detail restores the
exact list. An initial detail request was returned from while still pending;
it did not replace the restored list. A second selection completed with all 14
detail fields and exact patient/authorization/contract identity, its independent
receipt and discovery receipt. Back restores the original list text, original
receipt and unvalidated-unit/truncation cautions, explicitly labelled previously
fetched. Choosing another selector and changing the visit date to October 24
preserves this independent authorization scope and exact list.

Selecting a different actual patient clears results/return/patient input. A fresh
discovery can create a new return action; switching Demo on clears that retained
list. Live Overview was restored to the November 2 office day with feed running,
10 readable rows, a partial-source warning and receipt 20:23:03.057Z. Old source
results/Back stay cleared and there is no desktop horizontal overflow.

Zero source requests on Back is asserted by behavioral request-count tests;
native network counts were not measured. Production access errors, revocation,
sign-out, quota and mobile variants were not induced; synthetic fences cover
failed/malformed details and scope/session transitions. No patient/staff IDs,
field values, raw responses, screenshots or credentials were persisted for this
acceptance. Browser private comparison state is cleared after verification.
No missing visit clock/hour, billing fact, eligibility or external-role acceptance
is claimed. No owner action is required for this bounded navigation improvement.
