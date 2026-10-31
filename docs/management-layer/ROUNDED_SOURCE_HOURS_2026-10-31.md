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
backend and 333 root frontend/tooling tests pass. The feature passed the then-current limits of
420 KB raw, 100 KB gzip and 110 KB per file (414582 / 99990 raw/gzip bytes). Concise source-status wording
preserves scope, retry, provenance and no-substitution guidance within that cap.
Normal release and native verification are recorded below and in the handoff.

October 23 and 24 first-page reads each returned ten readable details, with nine
and ten recorded start/end pairs and seven original EVV pairs respectively.
Today's first ten returned two of each pair. These are independent bounded
receipts, not a complete office census or a completed-care determination.
The original October 24 screenshot omission was already resolved by the earlier
October 31 independent read and is not reopened here. Remaining P03/E04 source
omissions and raw-call retention/linkage evidence stay open.


## Production acceptance

Feature commit `8bc20ecfbe445bda0dcaf0754f68ce663cb88159` passed
[normal workflow 41237563885](https://github.com/jnwokorie1957/pthhs/actions/runs/41237563885):
Hosting at 20:10:04 UTC and backend at 20:11:11 UTC. At 20:11:55 UTC all twelve
app artifacts matched and eight anonymous API boundaries returned 401.

After both jobs, native Preview and Review on October 23 matched the same exact
visit's independent V3 rounded value. Supplied ActualHours and all four recorded/
EVV clocks stayed unchanged. The October 24 page had ten readable details and
seven supplied rounded-hour values; the current-day minute cache had ten readable
details and two supplied rounded values. Its receipt advanced automatically from
20:15:04.468 to 20:16:04.795 UTC without manual reads. All six field charts matched
counts [10, 10, 7, 2, 7, 2] over ten readable details. Missing original EVV fields
stayed missing. Per-cell labels and desktop page width passed without overflow.
The temporary tab was closed; original user-held historical pages were untouched.

A natural shared-read limit left two October 23 details unavailable. The real
cooldown disabled Retry until expiry; one subsequent request returned both exact
identities as readable, including one with recorded/EVV pairs. No throttling was
induced or response fabricated. This is native retry evidence in addition to the
prior synthetic coverage, not proof every failure/office/permission case passes.

Concurrent analytics commit `8a0eed047c96c49e984fdf383ccaa78e9ccdeccb` and its
Demo-switch follow-up `8c55dd7` were safely fast-forwarded after the feature
release; their code, documentation and separate acceptance remain preserved. No unrelated tests or deployment are attributed to
this feature. P03/E04 remain open for genuine source omissions and retained raw
call scope/visit linkage, with the precise next protected owner/vendor evidence
in the cumulative checklist.
