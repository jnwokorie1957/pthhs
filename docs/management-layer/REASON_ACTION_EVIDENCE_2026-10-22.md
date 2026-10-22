# Reason/action evidence candidate — October 22

Base: `ef798a7672630107b9a72fd6cde806d0a61fe744`.

The captured WSDL (`hharefs/hha-wdsl.xml`, EditReasonCodeInfo and
VisitEditActionTakenInfo) associates multiple actions with each reason and includes
an action description. The existing read projection flattened IDs, labels and
statuses into delimiter text and omitted descriptions.

The optional `visitEditReasons` response field preserves each retained reason's
id, label, description, status and ordered typed actions. It preserves repeated
IDs/associations, exact scalar descriptions, empty strings and null unknowns.
Duplicate/unreadable scalar fields remain null; unrelated nested actions are not
borrowed. Arrays represent returned evidence, not proof of complete coverage.
The existing 200-reason preview bound and truncation flag apply to both projections.
Legacy `records` and `Actions` strings are unchanged for existing consumers.
There is no frontend consumer or action workflow added in this patch.

The operation `GetVisitEditReasonActionTaken` remains vendor-contract blocked.
This is parser readiness from the captured schema, not entitlement, operational
mapping, HHSC code equivalence, a source call or a correction capability.

[HHSC section 10000](https://fhb.hhs.texas.gov/handbooks/electronic-visit-verification-policy-handbook/10000-reason-codes)
was read October 22. It distinguishes reason numbers/descriptions, permits
multiple reason associations and describes free-text requirements. It does not
establish how the HHA fields map to those requirements. No code meaning or
billable/payable/clinical consequence is inferred here.

Validation: five focused synthetic tests, TypeScript and all 507 backend tests
passed. The full release gate passed (263 tests in that gate). Independent review, publication and live acceptance are
pending. No patient data or raw production responses are included. The Library
backlog was not read because its prior materialization block remains unresolved;
selection is supported by the repository schema and parser evidence above.
