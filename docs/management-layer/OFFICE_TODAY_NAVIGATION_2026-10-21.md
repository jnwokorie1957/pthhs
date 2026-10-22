# Office today navigation

October 21, 2026, America/Chicago. Implements the bounded administrator P1-P
proposal in the cumulative role research.

The feed controls now explain whether the displayed date follows office today
or is an explicitly selected date that stays fixed. The office timezone is
shown. A native **Return to office today** button resets both date controls to
that office day, restores automatic day following and reads the existing
protected current-day feed cache. Users can leave a historical or paused page
without reloading the application.

The action clears prior source rows, charts, receipts, ages and cursors before
the new result, preserves unrelated panels and keeps focus on the activated
button. A failed cache check clears source evidence and retains unrelated
panels while scheduling the existing retry. Returning today adds no source
operation, polling interval, import, permission, HHA write or clinical/financial
decision. The feed remains a bounded first-page cache; charts are not office
totals. Existing saved captures and protected records remain separate.

The control requires signed-in Live mode, approved source access, an available
visit panel, a valid office ID and a configured usable timezone. It does not
guess the device timezone or enable owner-disabled reads. Server authorization,
office/policy/day and receipt checks remain authoritative on every cache read.
The date description uses aria-live off and is linked to the native button;
it does not repeatedly announce minute ticks or move focus on a timer.

Returning while another page or feed request is pending invalidates the old
context and aborts its client request. Each feed request now owns its completion
cleanup, so a late aborted success/error cannot release a newer request or
reschedule over its timer. Client abort does not promise cancellation of server
work already dispatched. Unknown or unavailable source evidence is never
replaced by a successful old page or demo data.

## Verification scope

All 282 frontend/tooling tests passed, including 163 data-mode cases and seven
new navigation regressions. They cover historical/current selection, paused
return, office rather than device date, daylight/standard midnight, pending
historical/feed reads, stale success/error ownership, denied/unknown office or
timezone, Demo/sign-out, scope changes, clearing and failed/expired cache reads.
Unrelated panels are retained on success and failure. Backend code is unchanged;
its suite is not repeated locally for this frontend change.

Windows site checks, generated assets, repository integrity and diff checks
passed. Concurrent private Forms work through `efe0f4e` was preserved; assets
were rebuilt from the combined source and all 282 frontend/tooling tests rerun.
Backend changes belong to that separately accepted Forms release.

## Authenticated production acceptance

Feature `aa53a37d0a7afca10e0ef4135a27c692ef175886` passed both normal jobs in
[workflow 39699004309](https://github.com/jnwokorie1957/pthhs/actions/runs/39699004309)
on the first attempt (Hosting 00:20:10 UTC; backend 00:20:25 UTC, October 22 /
October 21 America/Chicago). At 00:20:50 UTC, HTML and all eight referenced app
assets matched tested bytes. Private noindex/nofollow/noarchive and anonymous
session/feed 401 boundaries remained intact.

The normal signed-in UI showed Following office today and the configured
timezone. Native date entry selected the previous day; both controls changed
and the description said the selected date stays fixed. Native Enter on Return
to office today restored both controls to the office day, cleared the prior
receipt/cursors while pending, kept focus on the activated button and loaded
the scheduled cache. Ten readable details and all six chart values, native
progress attributes, denominators and accessible labels matched source fields.
Unrelated panel and Forms content stayed unchanged. A separate explicit pause
followed by Return restored the enabled feed and office-day following.

No private form was uploaded, downloaded or modified during this verification.
Raw source fields and IDs were compared only in protected UI/transient memory;
saved artifacts contain aggregate checks and a generic control/date proof crop.
Current-day evidence is bounded to the displayed source page. Synthetic clock,
failure, revocation and race checks remain distinct; no real midnight, complete
office census, clinical workflow or external-role acceptance is inferred.
