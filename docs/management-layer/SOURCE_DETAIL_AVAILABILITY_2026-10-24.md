# Source detail availability — October 24, 2026

The EVV and Staffing tables reused the selected live visit page, but labelled
null clock and assignment fields as “Not supplied by HHA” even when the detail
read failed. The normalizer correctly clears all unverified detail fields;
rendering those cleared values as a successful empty response was misleading.

Both tables now show “Detail unavailable” for fields of an unavailable detail,
with its existing bounded failure reason in the row. EVV also shows whether the
detail returned. Successfully returned details retain source values and use
“Not supplied by HHA” for absent fields. Returned source evidence remains
unvalidated and does not establish visit status, eligibility or full office
coverage.

The change adds no requests: both tables use the existing selected visit page.
It changes no source records, read permissions, scheduling, imports, feed
settings or backend behavior.

## Verification

- A mixed-page synthetic regression reproduced the incorrect label before the
  fix and passed afterward. It covers a returned detail with absent fields,
  a failed detail with a read-limit reason, and removal of unverified fields
  even when the failed input contains values. Both tables share one visit read.
- All 292 frontend/tooling tests passed, including 164 data-mode tests.
- Generated public assets were rebuilt from the reviewed source. Normal
  release jobs and exact production artifact/authentication checks are recorded
  in the dated handoff after publication.

No production source failure was deliberately induced. Failure presentation is
verified synthetically; this change does not close the native EVV/Staffing or
whole-dashboard acceptance checklist owned by the ongoing live-data task.
