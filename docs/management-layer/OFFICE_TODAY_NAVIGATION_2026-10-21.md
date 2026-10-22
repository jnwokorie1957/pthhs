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
passed. The normal GitHub/Firebase workflow and subsequent
authenticated production acceptance remain pending at this implementation
checkpoint. Synthetic clock, failure, revocation and race checks are distinct
from any later production observation. No real midnight or clinical workflow
acceptance is inferred.
