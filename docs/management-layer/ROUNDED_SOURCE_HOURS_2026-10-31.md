# Independently supplied rounded actual hours

October 31, 2026. Baseline: `32f7dc92f3bf1de6fc2493f3e8e27f02cbd6d047`.

An approved exact historical GetVisitInfoV3 read supplied ActualHoursRounded,
but the visit-preview DTO and Review browser projection omitted it. The existing
operational read already projected this field. This is a verified mapping/display
gap, distinct from genuinely absent original EVV punches or failed details.

The captured WSDL's `GetVisitInfoDetailsV3/ActualHoursRounded` is an optional
string. Its exact source result path is `VisitInfo/ActualHoursRounded`; the
operational record key is `ActualHoursRounded`. Preview now carries it as
`actualHoursRounded`, including through the existing live-feed page. Review keeps
it in rawDurations. Both show a separate **Rounded actual hours** field.

Supplied decimal hours are displayed without conversion or local rounding;
other source strings stay verbatim. Empty, absent, zero and unread detail states
remain distinct. Rounded hours never fill ActualHours, scheduled/recorded/EVV
clocks, calculated spans, chart counts, diagnoses or financial classifications.
No new endpoint, read grant, source write or event-to-visit assignment is added.
The existing interpretation and clinical/financial/sending controls remain.

The V3 contract was checked against the captured WSDL and read projection. The
public operation-page fetch returned HTTP403 in the research tool; that is not
an authenticated HHA API diagnosis or proof of missing entitlement. Actual source
field availability was independently verified through the approved native read.

## Validation

Three browser regressions failed before the correction. Backend, normalization,
display, empty/zero/absent/unread and no-substitution checks now pass. All 534
backend and 333 root frontend/tooling tests pass. Existing performance limits
remain 420 KB raw, 100 KB gzip and 110 KB per file. Concise source-status wording
preserves scope, retry, provenance and no-substitution guidance within that cap.
Normal release and native verification are recorded separately in the handoff;
production acceptance remains pending at this implementation checkpoint.

October 23 and 24 first-page reads each returned ten readable details, with nine
and ten recorded start/end pairs and seven original EVV pairs respectively.
Today's first ten returned two of each pair. These are independent bounded
receipts, not a complete office census or a completed-care determination.
The original October 24 screenshot omission was already resolved by the earlier
October 31 independent read and is not reopened here. Remaining P03/E04 source
omissions and raw-call retention/linkage evidence stay open.
