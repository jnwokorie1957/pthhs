# Original and split visit source references — November 2, 2026

The captured [V3 contract](../../hharefs/hha-wdsl.xml) and the official
[Texas API guide, pages 65–69](https://hhaxsupport.s3.amazonaws.com/SupportDocs/EDI%20Guides/ProviderIntegration/HHAeXchange%20Web%20Service%20API%20-%20TX.pdf)
include VisitInfo/OriginalVisitID and VisitInfo/SplitVisitID. The contract uses
long integers; these references were omitted from Primetime's V3 projection.
This omission prevented inspecting these fields through the existing approved
source reader. It does not prove that any affected record is split or that a
linked record contains a missing original punch.

HHA's [May 2026 release notes](https://knowledge.hhaexchange.com/enterprise/Content/Release-Notes/New-UI/RN-N-Release-Notes-26.05.01.htm)
describe an overnight-shift splitting feature. This supports investigating raw
references; it does not establish that this agency enabled the feature, the
meaning of a zero/reference value, the SOAP fields' direction, or the cause of a
particular missing clock. No overnight feature was activated.

## Bounded connection

The existing GetVisitInfoV3 operational read now returns these two raw fields in
Advanced tools. Values remain strings, including zero, leading zeros and integers
beyond JavaScript's safe numeric range. Missing/nil, supplied-empty and zero
remain distinct. Only unique direct scalar fields are projected. Nested,
duplicate or non-scalar references are withheld as null.

References do not establish an accepted relationship, office membership or a
valid ID for another read. There is no automatic following, lookup, reassignment,
clock/hour fallback, new method, grant, import or write. Existing exact visit,
patient-office, session/read approval and scope-revocation checks remain in force.
Preview/Review field mappings, charts, stored evidence and financial/clinical
decisions are unchanged.

Before following a positive usable reference in a separate authorized read,
establish its documented relationship, exact same patient and caregiver,
appropriate service date, current office membership and source provenance.
Recheck both records independently. A record on another service date or source
namespace is not interchangeable, and long references are not silently narrowed
to the existing positive 32-bit GetVisitInfoV3 request ID. No source clock or
duration may be copied from a related record merely to remove a missing field.

## Validation

Two regressions fail before and pass after this mapping: lossless reference
projection with one source request and unchanged missing actual/EVV/hour fields;
and unique direct-scalar handling for absent, nested, duplicate, nil, zero,
empty and namespaced variants. All 551 backend checks pass on the combined
authorization-identity tree. Frontend source and generated assets are unchanged;
no byte-budget or release setting changed.
Runtime **f2166dfa5ea782c526519d10b0f3ebdd6198f1a9**, reviewed tree
**f359061ca0cc394b7c41a441573355c96542addd**, passed all three normal jobs in
[workflow 41384475329](https://github.com/jnwokorie1957/pthhs/actions/runs/41384475329):
Hosting 03:42:14 UTC, backend 03:43:43 UTC and analytics 03:43:51 UTC on November 2.
At 03:44:32 UTC, all 12 deployed app assets matched the unchanged frontend;
nine anonymous JSON 401/no-store boundaries and private noindex passed.

## Authenticated production acceptance

Before release, at 03:40:46 UTC, an exact affected October 24 visit's existing
approved V3 read matched its selected VisitID/patient/caregiver but omitted both
reference fields from the displayed projection. After release, at 03:44:40 UTC,
a fresh same-record V3 read exposed both fields. OriginalVisitID equalled the
selected visit; SplitVisitID was a raw zero string. All six recorded/EVV clock
and actual-hour displays were unchanged, including missing EVVEndTime and
ActualHours. No alternate record was supplied by these references in this example.

One affected October 23 record at 03:46:44 UTC and one current office-day
November 1 record at 03:47:44 UTC also matched exact selected visit/patient/
caregiver context. Both exposed the two raw references with the same self-
reference/zero pattern; their EVV end and actual hours remained missing.
These are three individual bounded reads, not a complete scan or proof of every
reference's meaning. Zero was not interpreted as a clinical status or universal
absence of split/history. No reference was followed and no original punch recovered.

The user tab was restored to Overview and the current office day with live feed
active (receipt 03:47:05.972 UTC). Private browser comparison buffers were cleared.
P08's bounded source-field connection is accepted. P03/E04 and source history/
linkage semantics remain open.

Next supported evidence is an affected record with a distinct usable reference,
or vendor documentation explaining retained linked/rejected call history and
these fields' direction/zero semantics. Obtain exact office/date/subject proof
before accepting any relationship; do not replay the self-reference as a new
record, query guessed IDs or broaden methods/grants to populate an empty clock.

P03/E04 remain open. Current source evidence still establishes no newly recovered
original clock-out or complete retained event history. The original October 24
screenshot case remains resolved. Existing P07 source-hour display acceptance
remains complete.
