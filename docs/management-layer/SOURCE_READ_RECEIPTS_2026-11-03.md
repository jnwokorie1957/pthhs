# Exact source-read receipts

November 3, 18:51 UTC live-data follow-up.

## Observed source availability

Before this receipt change, the current office-day first page supplied six
recorded starts, two recorded ends, six EVV starts and two EVV ends among ten
readable details. Two rows supplied both HHA hour fields; eight retained explicit
empty ActualHours and ActualHoursRounded. No detail failure or unknown-hour label
was observed. Preview and chart attributes matched the same page.

One newly populated visit was held for an independent approved GetVisitInfoV3
read. Exact visit/patient/caregiver/day linkage, all four clock fields and both
raw hour values matched its held Preview. This establishes current availability
for that record, not why or when HHA changed fields, continuity with older
unreconciled cohorts, a physical-device event join or completed/verified work.
Historical P03/E04 gaps and the already resolved original October24 screenshot
remain separate. No source record, grant, import or financial decision changed.

## Receipt correction

Advanced tools already displayed a fetch receipt, but `toLocaleString()` removed
the original offset/UTC marker and milliseconds. The result now retains the exact
validated `fetchedAt` string. A missing, malformed or timezone-ambiguous instant
says `Fetched Unavailable`; returned source fields and partial-result cautions
remain visible. The existing timestamp validator and request/context fences are
reused. No extra source request, clock/hour mapping, rounding or conversion is
introduced. A read receipt is not the source record's last-modified time or a
clinical event timestamp. It does not establish complete source coverage.

Two regressions fail before and pass after: repeated local times with distinct
offsets/milliseconds retain their exact receipts, and four unavailable-receipt
cases preserve fields and truncation warnings without showing Invalid Date.
All 392 frontend/tooling tests and 25 site checks pass. Marketing generation
preserves all 12 private app files. Only workspace.js and its generated version
reference change at runtime; budgets/build settings are unchanged. Total app plus
catalog: 417095 raw/101981 default-gzip bytes, largest file 103026 bytes, within the
existing 420000/102000 totals and 110000 per-file cap.

Runtime: acf7e6dc83a2049bf195db2ea605e2ae15b69ff8.
Normal workflow: [41700783544](https://github.com/jnwokorie1957/pthhs/actions/runs/41700783544).
All three normal jobs succeeded: Hosting 19:11:20 UTC, backend 19:11:46 UTC and
website analytics 19:13:03 UTC. Twelve deployed app assets match the tested bytes;
eleven anonymous protected boundaries retain HTTP401 JSON/no-store. Private
noindex protections remain intact.

After all jobs succeeded, the signed-in page was reloaded with generated
workspace hash 2182159e94c2. The same current-page visit was selected and read once
through the existing approved control. Its exact identities, four clocks and
both raw hour fields matched the current Preview again; its four clocks also
matched the pre-release comparison. The visible receipt is now the full
2026-11-03T19:15:11.855Z string, with the unconverted/unvalidated caution retained.
No hidden response or network credential was read for this acceptance.

Overview/Live/following office today and the automatic feed were restored at
19:16:21 UTC. Selected source ID/result and related tables were cleared; private
comparison buffers were cleared. No screenshot or assistive-technology result
is claimed; native DOM/accessibility inspection is the acceptance evidence.

Deidentified output evidence: primetime-populated-time-comparison-2026-11-03-1851.json,
primetime-raw-read-receipt-native-2026-11-03-1851.json and
primetime-raw-read-receipt-public-release-2026-11-03-1851.json.

Actual assistive technology, malformed/native response variants, whole-office
coverage and source/clinical/financial interpretation remain separate acceptance.
No patient/staff IDs, source clock/hour values, raw responses or credentials are
included here. The same-profile HHA source/history handoff and pending care-plan/
availability decisions retain their existing owners.
