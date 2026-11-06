# Maintenance cards open the visits counted

The Open office cases card counted unresolved reviews but selected all saved
cases when clicked, including completed office reviews. A retained text search
could also hide visits included in any card's count. Saved cases without a
currently loaded source visit inflated case-card counts beyond the available
visit queue.

Runtime `7b04ff0ec4833fc413ebef272e2c8d43fb499b9a` adds an explicit Open office
reviews filter. It excludes `office_review_complete`; Saved office cases still
includes every saved status with a matching loaded visit. Both the open and
awaiting-action cards count cases joined to the loaded source visits and label
that denominator. Clicking any metric clears the free-text filter and resets
visual paging to 40 before opening its subset.

These are local office review counts over loaded evidence. A completed office
review is not HHA confirmation, and an awaiting-action case does not establish
an approved or submitted source action. Existing reports retain their separate
all-loaded-case scope and pagination disclosure. No source request, case save or
role grant is triggered by selecting a card or filter.

The change touches only source/generated `maintenance.js`, source/generated
`index.html` and the maintenance browser regression suite. Backend routes,
authentication, membership, source-read grants, clocks/hours, clinical/financial
controls and HHA write gates are unchanged. Concurrent compact workspace, fresh
patient/day review, reference catalogs and billing-clock fixes are preserved.

## Verification

Two new behavioral regressions fail against the previous code and pass after
the change. Synthetic mixed cases exercise three unresolved statuses, a completed
review, an uncased source visit and saved reviews with no loaded source row.
They verify the card's count, selected subset and pressed state; all-saved cases
still contains the completed review. Awaiting-action counts use the same loaded
visit boundary. Text clearing, 40-row paging reset and an empty open-review
queue are also covered. All these local filter actions make zero API requests.

All 23 focused maintenance/search checks and all 563 frontend/tooling checks
pass. Eight source-time checks pass in each of three time zones. All 25 ordered
site/release checks pass, preserving all 17 protected assets through generation.
Final assets total 497365 raw / 126113 Node-gzip bytes, maximum file 103864,
within the existing 500000 / 128000 aggregate and 110000 per-file allowances.
No allowance or dependency changed.

## Release and native acceptance

[Normal release 42167961782](https://github.com/jnwokorie1957/pthhs/actions/runs/42167961782)
completed all four jobs successfully: release scope, Hosting, backend and website
analytics. Post-release checks found all 17 protected assets exactly equal to
the reviewed runtime, with noindex headers. Eleven anonymous API boundaries
return 401 JSON with no-store/noindex protections.

An isolated signed-in production tab verified the November 5 service day at
approximately November 6 05:34 UTC. The background cache contained 639 loaded
visits, 407 with missing EVV fields, and one saved completed office review. The
cache explicitly remained stale, with generation starting
`2026-11-06T03:12:13.393Z` and completing `2026-11-06T04:48:19.682Z`. This is
verification of local navigation over that dated cache, not a fresh source scan,
complete agency census or newly recovered EVV evidence. Existing stale-save
guards were retained and no save was attempted.

The open-review card selected `open_cases`, showed zero rows and reported its
pressed state. Saved office cases still showed the one completed review. After
a local text search hid that row, keyboard Enter on Source visits cleared the
text and returned all 639 matches, with 40 visible. Loading the next visual page
showed 80 rows; Enter on Missing EVV fields reset the view to 40 of 407 matches.
Awaiting HHA action selected its own zero-row subset and pressed state. These
checks establish real completed-review exclusion and empty open/awaiting
subsets; populated open/awaiting and off-list case variants remain synthetic.

The isolated Chrome tab initially paused while hidden. The browser window was
inspected, and checks proceeded only after the tab's visibility resumed. Other
user tabs were not navigated or reloaded. Default filters, Overview, the November 5 office
day and the Live feed display were restored, then the isolated tab was closed.
Private page/window buffers were cleared. No case note/status/queue, HHA record,
read grant or account was changed; no fresh source shortcut, call read, import,
clinical/financial decision or communication occurred.

This completes the bounded administrator card/filter correction. M03 scoped
accounts, patient/family and PT authority, M02 original-event/source-action
contracts and broader keyboard/assistive-technology acceptance remain open.
