# Authorization detail source connection — November 2 UTC

This records T03 readiness, explicit owner approval and bounded live acceptance.
GetPatientAuthorizationInfo is now enabled for existing Primetime administrators.
The original eight selected reads and all source-write controls are unchanged.

## Pre-activation source and exact method

The normal protected administrator session successfully read the already enabled
SearchPatientAuthorizations for a patient independently verified by GetVisitInfoV3.
Four discovery rows had exact authorization/contract ID pairs and four detail
selection controls. A source fetch receipt was present. No source identifiers,
names, authorization numbers, dates, limits or balances are stored in this record.

Before approval, the owner-control screen showed Authorization units unchecked;
its exact operation value is GetPatientAuthorizationInfo. The other eight approved
reads were selected. The existing detail screen and backend route were implemented.
The approved ninth read lets existing Primetime administrators retrieve
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

## Approved activation and live acceptance

The user explicitly answered Enable authorization details to the specific
GetPatientAuthorizationInfo approval question. Owner controls were reloaded from
the latest preferences before the change. Every nonhidden owner-form control was
compared before/after selection: exactly one checkbox changed. Saved preferences
then reloaded with nine selected reads, retaining all original eight. Zero specific
write workflows remained approved; no user, office, timezone or other policy setting changed.
No Google/GA4 grant or source-write permission was requested or changed.

Fresh patient discovery again returned four exact selections. One fresh source
selection produced one detail record with 14 projected fields. AuthorizationID,
Patient/ID and Contract/ID match the selected source context; ServiceCode/ID is
supplied. MaxUnits and RemainingUnits are supplied, and a source fetch receipt
and the unvalidated-unit explanation are visible. No private values are recorded here.

Clearing the patient input immediately removed all detail fields and the source
receipt. Fresh discovery and the same exact authorization/contract selection
restored 14 fields with matching identities and a new receipt. Other mode/session/
late-response cases retain existing automated coverage; no real sign-out induced.
Authorization scope is patient/office, independent of the visit date picker.

After activation, the anonymous authorization POST was rechecked at
04:13:06.407UTC and still returned401 with no-store/noindex. The new read does
not expose records publicly. Only nonsensitive counts/booleans and the selected
read-control proof were saved; patient identifiers, authorization numbers,
service dates and unit values remain outside public artifacts and logs.

T03's bounded discovery/detail source connection is accepted. This is one checked
record, not a complete authorization census or acceptance of unit conversions,
period balances, utilization, scheduling eligibility or billing decisions. Remaining
source refusals/empty/ambiguous results must stay explicit. No input/label fallback
or clock/hour substitution is permitted. Other checklist items remain independent.
