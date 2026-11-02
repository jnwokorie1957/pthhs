# Authorization detail read readiness — November 2 UTC

This is technical readiness for T03, not authorization to expand access or proof
of a working detail response. GetPatientAuthorizationInfo remains disabled.
The existing eight selected reads and all source-write controls are unchanged.

## Current source and exact method

The normal protected administrator session successfully read the already enabled
SearchPatientAuthorizations for a patient independently verified by GetVisitInfoV3.
Four discovery rows had exact authorization/contract ID pairs and four detail
selection controls. A source fetch receipt was present. No source identifiers,
names, authorization numbers, dates, limits or balances are stored in this record.

The current owner-control screen shows Authorization units unchecked; its exact
operation value is GetPatientAuthorizationInfo. The other eight approved reads
remain selected. The existing detail screen and backend route are implemented.
Enabling this ninth read would let existing Primetime administrators retrieve
private authorization references, service dates, contract/service-code IDs and
raw limit/remaining-unit fields. It does not add users, public access or writes.

The captured WSDL request is AuthorizationInfo/PatientID plus AuthorizationID.
Its response is AuthorizationInfo with AuthorizationID, Patient/ID, Contract/ID,
ServiceCode/ID, service dates, MaxUnits, RemainingUnits, BankedHours and period
limit fields. Existing projection excludes notes/diagnosis payloads. No duration,
eligibility, approved billing, utilization or remaining-hour conversion is derived.
Units, periods and operational meaning remain separately unvalidated.

## Identity audit and correction

The protected patient-authorizations route already verifies current patient/office,
release/read controls, one untruncated detail record, matching authorization/patient,
optional selected contract and unchanged settings before returning data. Source
discovery chooses detail by IDs, not labels, and old selections are fenced.

The generic projection previously allowed descendant/first-match identity fields.
Discovery ID/ContractID now require unique direct scalar children. Detail
AuthorizationID, Patient/ID, Contract/ID and ServiceCode/ID require unique direct
paths and scalar IDs. Duplicate/nested identities become unavailable. The existing
route withholds records whose required identity is unavailable; it never substitutes
an input ID or human label. An optional service-code ID remains absent when unproved.

The shared direct-path helper also rejects explicitly nil parent elements, including
whitespace around true/1. A nil Patient cannot confer identity through contradictory
child IDs. Explicit false remains usable. This applies to existing direct-path
visit/billing/call identity checks as well, preserving absence rather than borrowing
an ID from a nil object. No raw source values, new diagnostics or extra queries added.

Four new regressions fail before/pass after: discovery paths, detail ambiguity,
nil parents and real XML flowing through the protected authorization route.
They cover duplicate scalars/parents, nested IDs, absent required proof, nil true/1/
whitespace, explicit false and unchanged request order. TypeScript compilation,
all549backend tests and14focused authorization/projection tests pass. Generated
browser assets remain current and unchanged; the existing419644raw/101729gzip
output remains under420000/102000 limits.

Runtime4a8cae1b454f5e266db99f22c1561f7863f4e1c1 passed all three normal jobs in
[workflow41383781589](https://github.com/jnwokorie1957/pthhs/actions/runs/41383781589):
Hosting03:34:37, backend03:36:02, analytics03:36:02UTC. At03:40:46.045UTC,
12exactassets and9existing anonymous401/private/noindex checks passed. The
patient-authorizations POST separately returned401 with no-store/noindex.

The normal authenticated session then reread discovery through the deployed
projection: four exact pairs and four selection controls with a source receipt.
An exact detail selection displayed the owner-enablement requirement. Requesting
that disabled read returned no fields and the message Enable this read in owner
controls after entitlement review. The unchecked control and unchanged eight
selected reads were confirmed. This verifies the closed gate, not detail API
entitlement, populated source acceptance or operational meaning.

## Remaining activation and acceptance

Obtain action-time approval for this specific read before changing its checkbox.
Use the latest owner preferences and add only GetPatientAuthorizationInfo; retain
all existing reads, office, timezone, privacy and write settings. Do not reuse a
stale settings form if another change lands. No new Google/GA4 grant is needed.

After approval, select an exact current discovery result, read details, verify
patient/authorization/contract and source receipt, then confirm Clear/context
changes remove stale facts. An enabled flag is not API entitlement or successful
source acceptance. A source refusal/empty/ambiguous response stays explicit; no
calculation or alternate identity bypass is permitted. T03 stays open until actual
authorized source acceptance; other live-source checklist items remain independent.
