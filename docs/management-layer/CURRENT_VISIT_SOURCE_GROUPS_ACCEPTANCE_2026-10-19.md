# Current visit source groups

The October 19, 2026, 20:09 UTC implementation heartbeat completed P1-J in
frontend release `41f602a146368cd9baba4d0abb541057244dd582`. Both normal jobs
passed [workflow 39317411686](https://github.com/jnwokorie1957/pthhs/actions/runs/39317411686).
This report contains no private record identities, times or captured source text.

## Implemented behavior

The separately verified current-visit panel now has three named sections:

- Schedule: `ScheduleStartTime` and `ScheduleEndTime`.
- Actual: `VisitStartTime` and `VisitEndTime`.
- EVV: `EVVStartTime` and `EVVEndTime`.

Each shows Start and End directly from those returned fields. Null or absent
values display Not supplied / unknown; an empty string displays Empty source
value. Numeric and string zero remain visible as zero. Whitespace is retained.
No time parsing/conversion, duration, unit calculation or completion/clinical/
EVV/billing classification is added.

Source timezone is displayed as supplied, with an explicit no-conversion label.
All returned fields remain in a separately titled raw-field list, including
non-time fields and unrecognized returned keys. The visible empty-value label
also applies there; no source object is modified. Text uses safe text nodes.
Native headings and labelled sections expose the groups to assistive technology.
The adaptive grid wraps to the available width.

Existing request/identity/office checks, pending/error clearing, stale-context
guards and the caregiver shortcut remain. Saved source cells, full chart,
authorization rows and capture/import provenance are separate and unchanged.
No backend code, permission, query, write, import, preference or communication
was added.

## Verification

- All 199 frontend tests passed, including six new regressions for exact pair
  mapping, accessible sections, complete raw-field retention, null/absent/empty/
  whitespace/zero distinctions, markup-like and unparseable values, overnight
  offset strings, pending/failed refresh, nine context changes and late responses.
  Generated assets, repository and whitespace checks passed. Backend unchanged;
  both normal workflow jobs passed.
- Production HTML/workspace/dashboard/CSS matched tested bytes. Private noindex/
  nofollow/noarchive and anonymous session/current-visit 401 remain.
- Normal administrator session, production source reads: two selected saved
  visits matched their current patient/visit identities. All six grouped values
  matched the corresponding raw fields for each read; both raw lists retained
  23 returned fields. Source timezone and interpretation/fetch labels remained.
- The first read retained the same visible saved cells, authorization rows,
  full October chart of 41 tiles and capture/import provenance. The second read
  supplied unknown Actual/EVV pairs, shown explicitly rather than as completed
  visits or zero time. No tenant HHA UI interpretation was validated.
- Cards fit both 1280px and 615px. The temporary viewport override was reset and
  the default 1280px width confirmed. Group section names were programmatically
  linked to their headings.
- Local page navigation cleared current groups. A same-visit refresh cleared
  groups/raw fields while pending, then restored values matching the raw list.
  September version selection cleared current evidence and retained its 36-tile
  chart. The caregiver shortcut still selected the exact returned ID and focused
  the read form with existing owner entitlement feedback; no read was enabled.
- Real reassignment, revocation and races were not induced. Synthetic fixtures
  cover those paths and distinctions not present in the production examples.
  This pass did not revalidate live office-page chart calculations.
- The cropped Actual/EVV screenshot shows only generic unknown values and was
  visually checked without patient/staff/account identifiers or private times.
  Reload confirmed empty patient/capture/detail/read-ID fields; signed-in
  Primetime tab retained. No new HHA UI capture/import occurred.

## Remaining work

P1-J is accepted only as protected administrator presentation of source evidence.
Source interpretation, caregiver/detail entitlement, P1-B office/supervisor
migration and external identity/discipline/form/reviewer/signature gates remain.
Normal HHA sign-in and protected representative field/unit/period validation are
still owner evidence actions; no new rule or role was established.

Proposed P1-K: place the complete raw current-field list in a native keyboard
disclosure with its returned-field count, and keep source navigation near the
grouped evidence. Preserve every field/value, current request lifetime, unknown
states, explicit fetch intent and owner gates; add no persistence or source call.
