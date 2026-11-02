# Legacy billing compatibility read — November 2, 2026 UTC

Status: deployed and explicitly enabled by the owner. The production legacy
request succeeded but returned no record. Usable billing detail remains
unverified; B02 is not complete.

## New protected source evidence

The owner restored HHA website access in the Codex browser and completed its
authentication step directly. An exact patient search used a fresh approved API
patient/office match and admission reference. The resulting patient link matched
the API patient ID. The October Calendar contained the exact affected visit ID.
Its original Visit Info and Billing Info URLs matched both patient and visit.

Original Visit Info showed populated Bill Time In and Out, one rendered EVV
clock-in, and one retained call-history row labelled GPS In with status Success.
No EVV-out label/value was rendered in the checked form. That agrees with the
already-verified API state: recorded endpoints supplied, EVV start supplied, EVV
end explicitly empty, both actual-hour fields explicitly empty. This does not
prove complete retained history or justify manufacturing an end/hour value.

Original Billing Info had two populated visible Bill Rates inputs and a populated
Units input. Values and identities remain private. These inputs are not proof of
an invoice, payment, charge, balance or billing approval. Opening Verification
redirected HHA to its login page; that original page remains unverified. No source
control was saved and no authentication setting was read or changed by the agent.

One fresh scoped billing read for this same visit still returned no record.
The corresponding fixed diagnostic at15:34:31.033788UTC again showed explicit
success, expected/versioned record markup absent and encoded marker false.
The website/API difference requires a supported source path, not a time or amount
copied from the webpage.

## Bounded implementation

The captured public WSDL defines `GetVisitBillInfo` and `GetVisitBillInfoV2` with
the same VisitBillInfo/ID request and shared visit/patient/caregiver/date/billing
paths. V2 adds a missed-visit reason field to its detail type. The compatibility
reader exposes the same fourteen billing fields already used by the V2 screen;
it does not expose the extra source profile fields or invent aliases.

The existing billing action first requires the approved V2 read and fresh
GetVisitInfoV3 plus patient/office proof. Only a successful, untruncated, correctly
identified V2 response with zero projected records can reach the legacy branch.
That branch additionally requires the separately enabled GetVisitBillInfo read,
an unchanged office/release/read policy, one query and one uniquely returned
legacy record. The legacy visit/patient/caregiver/date must match the original
fresh visit evidence. A final policy check applies before returning any fields.
There is no fallback after transport/application errors, primary identity errors,
ambiguous records or truncation. Failure remains explicit and no repeated retry
is scheduled.

Both billing parsers now reject nested, duplicate, nil-with-content and unclosed
expected record roots, while preserving a genuinely empty optional record as no
record. Identity fields use unique direct paths in both versions. The response
identifies actual operation GetVisitBillInfo and fixed provenance
billingFallbackFrom=GetVisitBillInfoV2; the browser requires both and displays
the actual method after empty V2. Raw zero, empty and unknown projected strings
stay separate. Source clear/date/Demo/session changes fence old results. No
fields are repurposed as EVV evidence, cash, AR or an operational decision.

## Local validation and activation gate

Three new backend regressions failed before implementation, then passed. Four
new backend tests cover the successful compatibility path, permission/primary
refusals, exact identity paths and malformed/ambiguous roots. Source errors,
policy changes and withdrawn release cannot cause a legacy read or disclose
facts. Both new browser regressions failed before the change and now pass with
provenance, raw value states and source-context invalidation coverage.

TypeScript compilation and all563backend tests pass. All364browser/tooling tests,
generated assets, performance foundation and diff checks pass. App/catalog raw
size419844bytes remains below420000; gzip budget102000 is unchanged. Public catalog
is unchanged. Those local checks preceded the explicit activation below.

Runtime `3b560b6aa1493f3ab5774ab8de18d46d817826ac` passed all three normal jobs in
[workflow41475728338](https://github.com/jnwokorie1957/pthhs/actions/runs/41475728338):
Hosting15:52:22, backend15:53:49 and analytics15:53:49UTC. Twelve deployed assets
matched reviewed files and nine anonymous JSON requests retained401/private/
no-store/noindex boundaries at15:54:51.101UTC. A fresh signed-in Codex-browser load
uses dashboard150e822db84b and shows the working automatic current-day API feed
with receipt15:56:03.843UTC. Reloaded owner controls retain nine selected reads,
GetVisitBillInfo unchecked and zero write grants. No legacy request was made.
That was the pre-activation state, not a current outstanding permission request.

## Approved activation and actual production trial

The user answered the specific permission request: Enable the legacy billing
read. Refreshed owner controls had nine reads selected and legacy unchecked.
Exactly one checkbox was changed; the staged and saved/reloaded list has ten
reads, retains all original nine, and adds only GetVisitBillInfo. Zero source-write
workflows remain approved. Do not ask for this same permission again.

The user's Chrome tab was refreshed to dashboard150e822db84b before testing.
An ordinary October24 source read returned ten readable details. The exact
affected visit's Read billing facts action still returned the explicit no-record
state, with no facts table or financial receipt. The protected SOAP completion
at16:02:23.928922UTC confirms operation GetVisitBillInfo, httpStatus200 and ok=true.
Thus the approved legacy method actually ran after the empty V2 result and
also supplied no projected billing record. This proves execution, not usable
financial detail, the reason for omission, or a zero financial balance.

Returning to office today and Overview restored the automatic current-day API
feed. Its receipt advanced16:07:07.853 to16:12:09.588UTC without a manual source
read between observations. The first page remains bounded to ten details.

Next supported evidence: identify an actual billed visit through an authorized
source and confirm the vendor's account/office/record coverage for these methods.
SearchBilledVisits is not enabled; audit its exact request/office scope before
requesting any separate activation. Original Billing Info rate/unit inputs may
be configuration rather than finalized billed fields. Original Verification
navigation still requires HHA authentication. No source values were imported,
no clock-out/hour was invented, and no financial/clinical action was taken.
