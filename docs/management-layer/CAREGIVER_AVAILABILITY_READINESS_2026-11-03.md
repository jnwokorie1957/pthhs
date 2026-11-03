# Caregiver availability read readiness — November 3, 2026

The existing weekly and special availability screens now have a protected
caregiver/office read boundary and strict source projection. This prepares the
remaining S02 connection; neither method is enabled or accepted against actual
HHA records yet. Current thirteen read grants and all source-write gates remain
unchanged. Specific owner approval and production source retrieval are pending.

## Exact source contract

The captured `hharefs/hha-wdsl.xml` defines both requests with Authentication
followed by CaregiverID. No office filter is invented in the SOAP request.

- `GetCaregiverPermanentWeekAvailability` returns PermanentWeekAvailability /
  PermanentWeekAvailabilityInfo, including PermanentWeekID, CaregiverID, OfficeID
  and each day's AvailabilityType, From, To and LiveIn strings.
- `GetCaregiverSpecialAvailability` returns SpecialAvailability /
  SpecialAvailabilityInfo, including SpecialAvailabilityID, CaregiverID, OfficeID,
  FromDate, ToDate and the same weekday strings.

Captured schema hash remains
`b57c250a0741f9f965311cc241f5035fb7f91cb7a6bd6dd17b3982836b44f9bd`.
Current public operation-page checks were unavailable; captured schema is not
proof of current endpoint entitlement or actual response behavior.

## Read boundary and screen

`POST /primetime/api/workspace/read` intercepts only these two availability
operations. It requires the exact targeted caregiver ID and configured office.
Operational data release, the requested method and GetCaregiverDemographics must
all be enabled before any source request. Fresh unique caregiver demographics
must prove current office membership before and after availability retrieval.
Every returned availability row must match both the requested caregiver and the
configured office. Foreign-office rows cause refusal; they are not silently
filtered into a successful empty result.

Release/preferences are checked around every source read and before response.
A thirty-second elapsed guard leaves a full transport attempt and response
headroom. Shared source quota/backoff remains in place; no automatic retry,
fallback, matching, ranking, assignment or write is introduced. Independent
membership reads do not establish atomic source immutability.

The existing workflow selector receives backend input metadata for caregiver
record ID and office. Its existing explicit Read source records action performs
retrieval; selecting a method does not query HHA. The generic office label now
says Office ID because it also scopes these, patient-plan and document reads.
Existing input/session/Demo clearing is retained. No new client library or
automatic availability feed is added; this is an on-demand source reader.

## Source meaning and completeness

Projection uses direct collection/row/field paths. Required record, caregiver and
office IDs must be unique/direct/canonical; all rows are checked before the
200-row preview cap. Duplicate/non-scalar fields and ambiguous collections are
refused. Standard BaseResponse Result metadata is validated and omitted.
Agency IDs, notes and unknown extra fields are not exposed by this projection.

Missing/nil, explicit empty and zero strings remain distinct. Raw clocks, period
strings, availability types and live-in values are not converted into interpreted
availability, elapsed hours, EVV punches, worked/payable time or staff eligibility.
Special-over-weekly precedence, overlap semantics and cross-midnight rules remain
unvalidated. A readable availability record does not establish complete schedules,
credentials, authorization, visit assignment or an eligible-staff match.
Source truncation remains explicit; no full-caseload or office census is claimed.

## Validation and next acceptance

Five source/input regressions fail against the prior committed adapter and pass
after correction. A full-SOAP case also checks standard Result metadata through
the actual parser. Eleven public-boundary checks cover membership, foreign rows,
office transfer, release/settings races, scoped inputs, unknown/empty values,
closed projection, preview bounds and elapsed budget. All seventeen new checks,
641 backend checks and 383 browser/tooling/public-analytics guards pass.
Generated assets, site output, performance and captured-schema preservation pass.
Original asset limits are unchanged: 418867 raw / 101997 default-gzip bytes,
below 420000 / 102000 and the 110000 per-file cap. Analytics backend remains
unchanged; normal CI still runs all required release checks.

Normal release and native readiness verification are pending. After release,
verify actual input metadata and the intentional pre-enablement refusal. Then
request only these two additional read grants for existing administrators;
GetPatientDocumentType and both pending care-plan methods remain disabled.
Only after approval, retrieve one exact source-identified caregiver's weekly and
special records through the new boundary. Inspect real shape, office identity,
empty/unknown states, fetch/membership receipts and clearing. Save only
deidentified evidence. If HHA returns foreign offices, unsupported shapes, denied
entitlement or unknown values, retain that precise limitation. Do not open source
writes or staff matching to remove the warning. S02 and the full goal stay open.
