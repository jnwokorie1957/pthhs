# EVV type display — November 2, 2026

Status: implementation and local checks complete; normal release and native
acceptance pending. P10/P11 remain accepted within their existing source scopes.

The approved V3 inspector already supplies VisitInfo/ClockInEvvType and
VisitInfo/ClockOutEvvType. Preview and Review omitted them. The office-checked
visit DTO now carries them as evvInType/evvOutType, including through the existing
private live-feed cache. Old cache/payload shapes display unknown until refreshed.
Unavailable details clear both fields. No source query or permission is added.

Preview appends the raw in/out pair beneath EVV clocks in the same cell. Review
detail uses the same formatter from the existing data-source bundle. Review's
already returned raw record supplies only these two whitelisted optional strings.
Empty, zero-text, missing and supplied values remain distinct; strings are text,
not HTML. Oversized/malformed preview properties are refused; unproved Review
values remain unknown. Demo clears live values and shows no HHA type claim.

Type meanings/event status remain unknown. No raw type fills EVVEndTime, recorded
actual endpoints, ActualHours or rounded hours. No original event ID, direction,
visit linkage, history completeness, worked/verified/billable/payable status or
missing-time cause is inferred. Source time conversion and charts are unchanged.
Existing source/office/session/policy and diagnosis/financial/sending gates remain.

Three behavioral regressions fail before and pass after: office-checked preview
projection with unchanged request sequence; browser preview value/empty/zero/
unavailable/malformed/Demo behavior; Review raw-type display without event/hour
acceptance. All 373 frontend/tooling, 571 backend and 46 analytics tests pass.
All 24 generator/QA steps pass and preserve private app bytes. Python/JavaScript
syntax checks pass; Bash is unavailable locally and normal CI remains required.

The combined new article plus app exceeded existing budgets before integration.
Shared repeated DOM IDs and concise equivalent UI instructions fund this display.
No control or required release/approval condition was removed. Final private app
is 419148 raw / 101999 gzip bytes, within unchanged 420000/102000 budgets.
Generated app files total 374199 bytes; the capability catalog is unchanged.

The marketing generator now removes layout indentation and blank lines outside
pre/textarea/script/style blocks after LF normalization. It preserves newlines
between inline elements and matching protected blocks. LF/CRLF, inline separation,
protected content, mismatched closing-tag text and idempotence checks pass.
A token/content/link/attribute/protected-block comparison of 132 changed public
pages passes, aside from validated asset-hash suffixes. This funds the concurrent
article within the unchanged 2 MB marketing budget; article text/CTO attribution,
business claims, navigation and private noindex controls remain intact.

Preserved concurrent bcbecfb retry handling, f5ea88b article/attribution and
3b7502d source/retry acceptance. No private source IDs, values, raw responses or
credentials appear in Git, public assets or these verification artifacts.
An exact October 24 raw V3 baseline and page comparison remain only in protected
browser memory for postrelease comparison; no native acceptance is claimed yet.

After all normal release jobs pass, compare exact raw types and unchanged
clocks/hours in October 23/24 and current office-day Preview/Review. Check Demo
clearing and restore current-day live Overview. P03/E04/B02 and broader source/
role interpretation remain open if no missing endpoint/hour value is supplied.
