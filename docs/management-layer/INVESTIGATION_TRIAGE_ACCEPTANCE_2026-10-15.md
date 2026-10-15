# Investigation triage acceptance — October 15

The existing administrator investigation list now filters loaded records by
status, assignment presence and follow-up. Active, overdue and active-unassigned
counts retain the complete loaded-record denominator before filters. The display
includes read/comparison timestamps and the 100-record page disclosure; counts
do not imply an office-wide or fully loaded queue.

Missing, malformed or impossible follow-up dates remain unknown. Valid timestamps
retain the entered timezone; comparisons use their exact instants. Resolved
records never count as overdue. No escalation, compensation decision, HHA write,
identity grant or outbound message follows from a filter or count.

Older-page loading remains available even when the current filters match no
loaded records. Overlapping pages deduplicate by ID and retain the newer
revision. Refresh clears old rows/cursors. Session, mode, office/policy and
release-access changes clear the list and fence pending responses and detached
update controls. Existing save revisions and append-only history are preserved.

All 145 frontend tests pass. Nine new regression cases exercise composed
filters, timezone boundaries, resolved/unknown follow-up, pagination and
deduplication, revision-preserving selection, refresh races, detached controls,
sign-out, Demo, office/policy changes, release withdrawal, failed refresh and
workflow focus on the review filters.
Tests use synthetic records. Asset freshness, whitespace and repository checks
pass. Backend contracts and permissions are unchanged.

Release: `2598b5d849dde58e04af67e43439def5954d051c`.
Both jobs passed in
[workflow 38772234605](https://github.com/jnwokorie1957/pthhs/actions/runs/38772234605).
The served workspace hash matched the tested artifact. Anonymous session and
investigation requests returned 401; the administrator namespace retained its
noindex response header.

The normal administrator session loaded the protected queue and selected active,
unassigned and overdue filters. It returned zero records and displayed matching
zero counts with read/comparison timestamps. No production fixture records were
created. Populated-record filtering, overlap and race acceptance are synthetic;
first legitimate populated-queue acceptance remains an operations follow-up.

The same session refreshed a real on-demand HHA page, loaded a distinct second
page of ten readable visits and returned to the same first ten source rows.
All six field-presence chart values/denominators and the assignment chart matched
the visible source table on page two. Source freshness, incomplete search scope
and the distinction from persisted manual imports remained explicit. Source IDs
were compared only in session memory and are absent from this report.

Follow-up release `a0559156d4db067891189a7e716260cb70a5feec` focuses review filters
when opening the investigation workflow. Both jobs passed in
[workflow 38772958621](https://github.com/jnwokorie1957/pthhs/actions/runs/38772958621).
Its served workspace hash matched the tested artifact. Normal-session navigation
from EVV Exceptions to Open investigation queue selected Advanced tools, focused
the status filter and scrolled the review controls into view. The three composed
filters retained the correct zero-record summary. Local output
`primetime-investigation-triage.png` records this empty-queue acceptance.

The existing Investigation model remains an administrator collection without a
verified office or patient join. Assignee text is a label. This change does not
complete the P1-B identity/scope migration or enable external patient/staff roles.
No synthetic acceptance records are written against real patients.
