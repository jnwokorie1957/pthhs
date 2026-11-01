# Visit source recovery — November 1, 2026

A transient HHA transport/gateway failure previously became generic HTTP502 in
`operationalRead`. The visit page preserved a failed row but offered no deferred
retry cursor; navigation could advance beyond the unavailable details. This is a
verified recovery defect, not proof that any current source-empty punch exists.

The existing SearchVisitsV2, GetVisitInfoV3 and GetPatientDemographics reads now
classify known network/timeout transport-kind/http0 and protocol-kind/http408,500,502,503,504 as
`hha_source_temporarily_unavailable`/HTTP503. Existing Preview handling keeps the
already office-proved prefix, fences the cursor to actor/office/day/discovery and
stops later details until the explicit retry. The existing local60second recovery
delay is not a fabricated vendor Retry-After. Positive vendor backoff is retained.
No SOAP loop or automatic additional dispatch is introduced; each query still
requests exactly one attempt.

Response-size limits, failed backoff persistence and unclassified transport
failures remain outside this recovery class. Only a bounded internal marker is
added; source messages are never copied. Application failures, SOAP faults,
HTTP401/403, malformed successful responses
and other operations retain existing errors. Office-proof failure removes all
unproved detail values and receipts. An empty successful field is never treated
as a transient error; a recovered detail can still have absent original punches.
Clock/hour mapping, units and clinical/financial interpretation remain unchanged.
The original October24 screenshot example remains resolved as recorded earlier.

Two new regressions failed against the prior implementation and pass after it.
Further cases check failed office proof/discovery outage and actual SOAP client
network/size/unclassified failures. Coverage includes
resume offset, retained prefix, delayed remaining details, caller mismatch,
private upstream text suppression, genuine empty fields, three read operations,
transport/gateway classes, faults/access/malformed success, authoritative vendor
backoff and an unrelated billing operation. All539backend and347frontend/tooling
tests pass; generated assets remain11files/374355bytes.

## Bounded production acceptance

Normal workflow41352331116 passed all three jobs: Hosting21:30:52UTC,
backend21:32:20UTC and website analytics21:32:43UTC, November1. At21:33:06UTC,
12 exact app artifacts and8anonymous JSON401/no-store boundaries passed.

After release, the authorized native session returned10readable current-day
visits. The October24 page retained8readable details with2unavailable rows and
an actual retry delay. Changing toOctober23 cleared prior rows and old deferred
controls; reads stayed disabled during the observed13second remaining delay.
After expiry, one explicit read returned10readable October23 details. The precise
cause of that native partial response was not captured; do not label it a newly
reproduced network failure or a specific quota. Known network/gateway recovery
variants remain synthetic regressions; no outage or artificial quota was induced.

Current-day source field counts10/10/7/2/7/2 matched the six plotted availability
counts on the same ten-row page. Source search receipts advanced automatically
from21:35:03.377Z to21:36:03.275Z; live feed remained active. These are field
presence counts, not completed/verified/worked/payable/billable classifications.
No new original EVV punch was recovered. Existing E04 retained-history/linkage,
source-empty hour fields, full-office coverage and broader H03 remain open.
The original October24 screenshot example remains resolved by prior evidence.
