# EVV type display — November 2, 2026

Status: deployed and accepted for this bounded administrator field display. P10/P11 remain accepted within their existing source scopes.

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
A token/content/link/attribute/protected-block comparison of all 51 changed
production marketing pages passes, aside from validated asset-hash suffixes. This funds the concurrent
article within the unchanged 2 MB marketing budget; article text/CTO attribution,
business claims, navigation and private noindex controls remain intact.

Preserved concurrent bcbecfb retry handling, f5ea88b article/attribution and
3b7502d source/retry acceptance. No private source IDs, values, raw responses or
credentials appear in Git, public assets or these verification artifacts.
A protected pre-release October 24 V3/page baseline was retained only in browser
memory for the following exact comparison.

## Production acceptance

Runtime 1b9aa83942d60bfb11e812a89b6623ee2b041425, tree
f7386f5a9712fb388c29f03ab2ce24c65c8a6496, passed all three normal jobs in
workflow 41507288295: Hosting 19:10:10, backend 19:11:21 and analytics
19:11:55 UTC on November 2. Public verification at 19:26:44 UTC matched all
twelve artifacts; eleven anonymous endpoints returned JSON401/no-store, and
private noindex was intact. This is a normal runtime release, not a skip-CI push.

Native checks at 19:28–19:35 UTC:
- October 24: ten exact visit/patient/caregiver references match the pre-release
  page. All displayed schedule/actual/EVV clocks and source-hour fields remain
  unchanged; all ten readable rows now include type labels. The first exact
  visit's type pair matches the independent protected V3 reader.
- Review: the same exact visit reference and all supplied raw clock/hour fields
  match. Its type pair matches V3. The existing unaccepted-evidence state still
  withholds normalized member/caregiver labels; this feature does not accept
  those clinical/role interpretations. A second exact visit has an explicitly
  empty out-type, an unavailable EVV end and empty source hours in both views.
  Record ordering differed, so the cross-view comparison used exact visit
  identity rather than row position. Review remains a bounded five-card page.
- October 23: ten readable rows include type labels. One independently read V3
  record has twenty-nine displayed source fields, exact selected visit identity
  and the same type pair as Preview.
- Current office day November 2: ten source-page rows include type labels. An
  independent exact V3 read matches the cached row's type pair. Current Review
  retains empty ActualHours and unknown verification beside the new type label.
- Visible chart counts [10,10,7,3,7,3] match the six source-clock field counts;
  type metadata is excluded from those clock calculations. Demo removes live
  type labels from Preview/Review and clears the raw reader. Live is restored.
- Final Overview: November 2, active live API feed, ten bounded rows/type labels,
  no horizontal desktop overflow. Source receipts advance automatically from
  19:33:03.061 to 19:34:08.435 UTC with no manual source read between.

Browser comparison memory was reset; the existing user tab remains open on live
Overview. No private values were saved. No native source error, foreign identity,
revocation or quota was induced; those cases remain synthetic or unexercised.
No screenshot or mobile acceptance is claimed.

P12 is complete within this scope. No missing endpoint/hour value was recovered.
P03/E04/B02, retained history, source interpretation and external-role contracts
remain open. Original screenshot acceptance and P10/P11 stay accepted. Subsequent
e481f56 billing-scope documentation is preserved; it does not change this runtime.

Concurrent 5642efc patient-scoped billed-discovery code/readiness is preserved.
Its pending read activation/native acceptance is separate from P12; this record
claims only the dated P12 runtime verification above.
