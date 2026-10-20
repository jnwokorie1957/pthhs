# Source status labels

October 20, 2026: the shared Live badge and environment description now follow
source-access checking and terminal outcomes. Previously an invalid date or a
409/423 response could leave loading labels, and a failed or blocked access check
could retain labels from a previously returned page after its rows were cleared.

Access checking now has its own pending labels. Failed or blocked access reports
unavailable; a missing date requests a service date; a 409 requests a refresh.
Cleared access and signed-out states also replace former source-success labels.
Successful retry retains the existing returned-source labels. The change only
assigns display text in existing branches; requests, permissions, source values,
partial/on-demand scope, paging, context guards and age behavior are unchanged.

## Verification

- Before the fix, four new synthetic regression groups failed on retained
  loading/success labels. The Demo isolation group already passed.
- After the fix, all 238 frontend tests and the full local release gate passed.
  Five new groups cover successful reads followed by failed/malformed/blocked
  access checks, invalid dates, 409/423 outcomes, retry success, pending access,
  stale failure and late responses after switching to Demo. Assertions also
  verify cleared receipts and no visit request for blocked access/invalid dates.
- Generated artifacts match their readable source. Backend and permission code
  are unchanged. No real source failure or access restriction was induced.

Authenticated production acceptance is pending for this change. Synthetic tests
and successful deployment do not establish real-session acceptance or broader
source interpretation. Existing source, membership, role and operational gates
remain open. Rollback is a reviewed revert through the normal release checks;
there is no data migration or source-record change.
