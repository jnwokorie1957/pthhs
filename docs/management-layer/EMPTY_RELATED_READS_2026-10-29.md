# Empty related-source reads — October 29

Baseline: `78209bdeeed5af19dfcdc251cc8da8d4dfc36a56`.

The inspected Billing panel returned a generic verification failure. A separate
explicit GetVisitBillInfoV2 read for the same selected visit completed with a
fetch receipt and zero projected records. That establishes an empty application
read result, not why the vendor omitted a record or whether another source has
billing facts. No private identity, amount or raw response is retained here.

The related-source backend now distinguishes zero records after checking the
expected operation, source and non-truncated result. It returns an explicit
empty-result error without facts. Wrong-operation, truncated and duplicate
results retain their existing rejection. Visit/patient/office, caregiver/date,
release and read-permission checks are preserved.

Billing and caregiver panels explain their respective empty outcomes instead
of showing the generic failure. Billing does not substitute zero charges,
payment or an AR balance; an empty caregiver read does not establish availability
or eligibility. Former facts, receipts and related-record controls remain
cleared. No fields are manufactured, source reads enabled or HHA records changed.

The frontend regression failed before the correction. Tests cover replacement
of prior facts by the explicit empty outcome in both panels, absence of former
receipts/actions/zero amounts, and backend rejection of truncated or wrong-source
operation results as empty. All 315 frontend/tooling and 525 backend tests pass;
generated assets, syntax and repository checks apply to the reviewed release.
The exact empty caregiver cases remain synthetic; production billing acceptance
and final delivery evidence are recorded separately in the handoff.

The same native review accepted the current office date, first/next/previous
identity scope and independently recomputed six page-field charts. Expected
hours were supplied on the inspected pages; absent actual-hour fields remained
absent. These are bounded reads, not a durable import or full-office census.
The automatic display was resumed, but a later bounded observation had the
same receipt; automatic receipt advancement was not established by that sample.

B02 stays open for usable same-record billing facts and protected diagnostics.
No cash, claim status, payable/billable hours, clinical or role decision follows
from an empty result. Source interpretation, authorization/document coverage,
staff availability and existing P1-B/P2 contracts remain separate. The next
owner evidence is still the intended HHA application/office/day comparison,
with representative identity/unit/period and role/form mappings kept protected.
