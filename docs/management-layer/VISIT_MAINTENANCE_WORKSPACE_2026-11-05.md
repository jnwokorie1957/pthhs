# Visit maintenance: administrator review workspace

The owner requested working visit-maintenance software. `/primetime#maintenance`
now provides a selected-office/day source queue, original schedule/actual/EVV
times, durable office cases, scoped caregiver call evidence, proposed next steps,
follow-up queues, case histories and downloadable private staff reports.

## Working boundary

This first delivery is for existing administrators. Office staff, supervisor and
manager are queue labels; they grant no account access. A completed office review
is explicitly a local review. All cases retain `hhaSubmission: not_submitted`.
The service has no HHA write adapter or confirmation/clock-creation endpoint.
Supported confirmation/reason/action/readback contracts, named staff access,
pilot selection and correction rules remain open M01-M06 dependencies.

The queue uses the existing protected full returned-ID office-day API cache,
including partial/stale/read-failure and source-fetch receipts. It does not scrape
or import browser pages. Source missing fields remain missing; scheduled times
never become actual punches. Queue filtering covers all loaded source rows;
40-row visual increments do not restrict the source collection.

The operator saves a review note before retaining call evidence. Call retrieval
reuses the approved patient/caregiver/day `GetCallDashBoardData` reader, including
fresh visit, patient, office and caregiver proof and the existing read budget.
Returned types/statuses are raw codes. Exact event-to-visit links and complete
attempt history are unproved. Date-only/missing-time events cannot be selected.
No arbitrary call ID or proposed clock value is accepted by the service.

## Persistence and permissions

Cases live in server-only Firestore collections partitioned by office and date.
The record ID hashes office/date/visit, preventing duplicate case creation.
The existing authenticated administrator API, live-mode guard, operational-data
release and owner-enabled source reads apply. Every read/save rechecks settings.
Saves require the source receipt the operator inspected and reject a refreshed,
stale, unavailable or foreign source context. CAS revisions protect concurrent
staff work and uncertain retries. First source receipts remain immutable; later
notes, actor/time, queue/state/proposal and source fingerprints are retained.

Call refresh clears an earlier proposal for review. Changed source subjects clear
retained call evidence on save. Records are bounded to 150 history events and
128000 serialized bytes (also bounding 100-case responses). Existing audit transactions are reused. No new Firebase
database, client SDK, security rule, role claim, HHA grant or dependency is added.

The browser clears private source, notes, reports and pending responses on
sign-out, mode/date changes, leaving the view or hiding the tab. Its own selected
date and source context are independent of Preview page refreshes. Refresh reads
the protected cache; call retrieval is explicit and does not fan out across visits.
Refresh/navigation replaces an unsaved draft; notes are retained only by Save.

## Reports

Reports show loaded office cases, follow-up queue/date, latest explanation,
proposed action, selected real call IDs and source receipt times. Additional
100-case pages are explicitly disclosed; exports identify partial coverage.
Reports never claim HHA resolution or AI action. Download is an explicit private
user action and uses a temporary browser Blob revoked on context changes.

## Validation and release

Eleven new backend tests exercise source/office/release/receipt checks, duplicate
and concurrent saves, genuine-call selection, changed subjects, local completion,
history bounds and unavailable execution routes. Five browser-contract tests cover
83-visit visual paging, save/call/proposal/report/reload, stale blocking, session
clearing and late-response fencing. Full baseline suites are also required.
Production acceptance is recorded below only after the normal release succeeds.

Measured protected assets before the final release are approximately 464 KB raw /
117 KB default Node gzip across 15 files. The reviewed bounded allowance is now
470000 / 118000 bytes. Separate 110000 per-file and 2 MB marketing limits remain.
The new standalone maintenance JS/CSS accounts for about 24.7 KB raw / 8.3 KB gzip;
the rest is navigation/markup. No new runtime library or minifier setting changed.

Production acceptance: pending release and signed-in save/read/reload verification.
