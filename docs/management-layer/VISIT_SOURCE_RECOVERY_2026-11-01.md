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

Normal GitHub/Firebase release and native production acceptance remain pending.
No native transport outage is induced; network variant acceptance is synthetic.
Source E04 retained-call history/linkage and broader H03 coverage remain open.
