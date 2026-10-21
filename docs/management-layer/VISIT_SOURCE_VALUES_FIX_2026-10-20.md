# Visit source-value display correction

Requested October 20, 2026, America/Chicago; implemented October 21 UTC.

## Cause and correction

Visit Review rendered normalized diagnosis times and duration metrics. When
source interpretation was unaccepted, the normalizer deliberately retained raw
HHA fields but returned no normalized times; diagnosis metrics correctly stayed
unknown. The UI then hid available source values behind that separate gate.

The V3 read projection also omitted the documented
`ScheduleDuration/ScheduleDurationHours` and `ScheduleDuration/ScheduleDurationMinutes`
fields. Visit Preview discarded the returned `ActualHours` field and offered no
source-hours columns.

The read now retains those schedule-duration components. Visit Review falls back
to the original HHA schedule/actual/EVV fields when normalized instants are absent,
and displays HHA schedule duration and `ActualHours` independently of diagnosis.
Visit Preview retains the same three duration fields and has explicit expected/
actual hours columns. Values are rendered as text and labelled HHA. A supplied
zero remains zero; empty values and missing components remain explicit. Accepted
calculated duration is a labelled fallback when no source duration was supplied.
When neither source duration nor an accepted metric is available, a complete
written start/end pair can supply a separately labelled source clock span. This
is calendar/clock arithmetic, not elapsed, payable or billable time. Invalid or
reversed dates, mixed offsets, missing ends and spans over 48 hours are withheld;
an overnight end date or DST offset is never invented. Payroll/billing values and
EVV differences never substitute for HHA
`ActualHours`.

This fixes a read/projection/display path, not a durable import or source write.
It adds no clinical/financial decision, source acceptance contract, verification,
entitlement, notification or role grant. The existing patient-office checks,
source/date/identity fences, partial paging, pending cleanup and access controls
remain. Unknown diagnosis, variance and clinical/billing decisions remain separate
from showing the received source values. Original raw values remain available in
the source disclosure without timezone inference or rewriting source timestamps.

## Verification scope

All 485 backend tests and 256 frontend/tooling tests passed. New regressions cover
the V3 XML-to-preview duration projection, unaccepted review values, true missing
end times, zero/empty/missing source hours, withholding unavailable detail fields,
labelled clock spans, invalid/overnight/DST cases, and avoiding payroll/EVV
substitution. Existing evidence normalization continues
to leave unaccepted diagnosis times/metrics unknown; that gate was not relaxed.
Site/asset/repository checks are run through the existing release controls. Normal
GitHub/Firebase jobs and dated authenticated production observations are recorded
in the protected local handoff and aggregate acceptance files, separately from
this implementation/synthetic-test description.

Before the change, authenticated production reproduced ten review cards with
hidden times despite readable original source fields. A separate exact visit
read returned schedule/actual timestamps and decimal `ActualHours`. These private
values were kept out of source, tests, screenshots and public evidence. Synthetic
test dates/identifiers above have no relationship to those records.

The browser inventory exposed IAB and MCP Apps, with no Chrome connector surface.
The normal signed-in new HHA portal and original tenant sign-in are separate
observations; an empty filtered vendor UI is not evidence that the source API
returned no visits. No private source record was modified to satisfy acceptance.

Contract reference: repository `hharefs/hha-wdsl.xml`, `GetVisitInfoDetailsV3` and
`ScheduleDurations`. The duration fields are source strings/components; this
change does not establish clinical, payroll, rounding or billing semantics.
