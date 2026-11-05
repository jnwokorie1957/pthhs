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

Twelve new backend tests exercise source/office/release/receipt checks, duplicate
and concurrent saves, genuine-call selection, changed subjects, local completion,
history/response bounds and unavailable execution routes. Six browser-contract tests cover
83-visit visual paging, save/call/proposal/report/reload, stale blocking, session
clearing, late-response fencing and source backoff. Five read-budget tests cover
background headroom, shared accounting, vendor backoff, rollover and corrupt state.
Full baseline suites are also required.
Production acceptance is recorded below only after the normal release succeeds.

Measured current protected assets are 464775 bytes raw / 116907 default Node gzip
across 15 files. The reviewed bounded allowance is now
470000 / 118000 bytes. Separate 110000 per-file and 2 MB marketing limits remain.
The new standalone maintenance JS/CSS accounts for about 24.7 KB raw / 8.3 KB gzip;
the rest is navigation/markup. No new runtime library or minifier setting changed.

Initial production release `8a1d8667dd076dd5d4ca5da448587f50f94f00a9`, workflow
42083043809: all four jobs passed. All 15 public files matched production exactly;
750 backend and 542 frontend/tooling checks passed, including a concurrent upstream
non-activated report projection. Three anonymous maintenance routes returned 401.
The signed-in workspace loaded 638 source visits from the completed office-day
generation, saved an administrative acceptance case, retained a successful source
call receipt, displayed it in the report and downloaded a verified private text
report. The scoped HHA call read returned zero events; no populated-call or exact
visit-link production acceptance is claimed for that visit.

Production showed collector contention against the existing shared 60-call/minute
application guard. The follow-up preserves that total and vendor backoff, while
background API feeds stop at a shared count of 50, leaving ten existing slots for
operator reads. Writes and other interactive reads still share the same counter.
Background collection may progress more slowly; existing cache receipts, partial
coverage and staleness disclosures apply. The call button honors returned retry
seconds with a disabled countdown; local notes and reports remain usable. No new
HHA endpoint, grant or vendor quota increase is introduced.

Follow-up release `f66950b0182691d5fa8edb73b2ecc9cf4f8a0861`, workflow
42085067528: all four normal jobs passed. Current upstream plus this change passes
755 backend and 543 frontend/tooling tests; all site checks, source-time tests in
three timezones, asset regeneration and repository audit passed.

Signed-in production acceptance also verifies the saved case and its third
revision after full reload, local office-review completion, persisted call receipt,
report card and downloaded text content. Demo mode removes all source rows,
private case detail and report cards; Live restores source access. Wide (1425 CSS
pixels) and narrow (465 CSS pixels) layouts have no page overflow, using two queue
columns and one respectively. This is administrator/local-review acceptance.
Populated-call selection remains covered by synthetic contract tests; the checked
production visit returned no raw events. Authoritative links, HHA actions, named
staff access, complete retained attempt history and AI execution remain open.

Focused-layout release `27d1092f95b1a754e8f96d3c6f6f32335e63f0ac`, workflow
42086109652: all four jobs passed and all 15 production assets match exactly.
Preview's unrelated first-page controls and badge are hidden only while this
independent workspace is active; maintenance retains its own source receipts and
status. Production confirms these controls are hidden and there is no overflow.
A fresh call read after the headroom release succeeds and persists revision 4,
again with zero source events. No HHA change or staff access grant occurred.

Concurrent Preview explanation fix `4f23d864e4f80ec32d55dc94991aa6fcf4018aeb`
was preserved. It distinguishes deferred source-read rate limits from temporary
unavailability and adds two browser tests. Current frontend/tooling acceptance
passes 545 tests; the backend is unchanged at 755 passing checks. The measured
asset totals above include this concurrent change.
