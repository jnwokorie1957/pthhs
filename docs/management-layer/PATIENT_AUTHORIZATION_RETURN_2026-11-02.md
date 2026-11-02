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

Implementation is ready for normal release and actual signed-in acceptance;
production acceptance is pending at this checkpoint. Three behavioral regressions
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
