# Original and split visit source references — November 2, 2026

The captured [V3 contract](../../hharefs/hha-wdsl.xml) and the official
[Texas API guide, pages 65–69](https://hhaxsupport.s3.amazonaws.com/SupportDocs/EDI%20Guides/ProviderIntegration/HHAeXchange%20Web%20Service%20API%20-%20TX.pdf)
include VisitInfo/OriginalVisitID and VisitInfo/SplitVisitID. The contract uses
long integers; these references were omitted from Primetime's V3 projection.
This omission prevented inspecting these fields through the existing approved
source reader. It does not prove that any affected record is split or that a
linked record contains a missing original punch.

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
empty and namespaced variants. All 551 backend checks pass on the combined authorization-identity tree. Frontend source and
generated assets are unchanged; no byte-budget or release setting changed.
Normal release and authenticated source-field acceptance remain pending.

P03/E04 remain open. Current source evidence still establishes no newly recovered
original clock-out or complete retained event history. The original October 24
screenshot case remains resolved. Existing P07 source-hour display acceptance
remains complete.
