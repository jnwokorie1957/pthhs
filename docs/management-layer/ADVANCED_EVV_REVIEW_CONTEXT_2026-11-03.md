# Advanced EVV review source context

Runtime: `9fb89f10046d684a7b6eba791cc0e5d62129cf29`.

The administrator's Advanced tools `SearchVisitsV2` result exposes an explicit
"Inspect next 10 visits for EVV evidence" action. Its nested `visit-review` reply
previously could prepend old results after the source date, office, patient or
operation changed. A late refusal could replace the new context's feedback, and
a retained old investigation control could retarget the unsaved draft. Three
synthetic regressions reproduce these failures before the correction.

The existing source-read sequence and access predicate now fence the action
before its request, after its reply, on errors and before selecting an
investigation draft. Current-context errors retain the real retry guidance;
failed attempts do not advance the batch offset. Existing button disabling,
source IDs, backend office/subject checks, raw fields, independent receipts and
attempted/deferred scope remain. Brief wording within this same review preserves
the unvalidated-source and no lateness/payroll/billing-policy cautions.

Local verification: all 396 frontend/tooling tests and 25 site checks pass.
Coverage includes seven selection changes (date, office, patient, operation,
new discovery, Demo and sign-out), current versus obsolete quota replies, original
batch retry/order, and obsolete draft selection without any record write. Three
tests fail before/pass after; the additional three-context regression passes
after. Marketing generation preserves all twelve private app files byte-for-byte.
Original limits remain 420000 raw / 102000 gzip / 110000 per file; actual output
is 417191 raw / 101999 default Node gzip / largest file 103122 bytes. No build,
minifier, dependency, backend or permission change is included.

Normal [workflow 41707155154](https://github.com/jnwokorie1957/pthhs/actions/runs/41707155154)
succeeded: Hosting 19:52:11 UTC, backend 19:52:35 UTC and analytics 19:53:43 UTC.
After all three jobs, twelve exact production assets/noindex headers and eleven
anonymous 401 JSON/no-store boundaries pass.

Signed-in Chrome 19:55-19:57 UTC loads workspace `591cc681cd92`. One approved
current-day discovery returns 200 distinct source IDs with the partial-result
caution. One explicit review returns ten cards matching the exact first ten IDs;
each retains seven raw field labels, an independent fetch receipt and an
investigation control. Source-unvalidated/no-policy cautions remain. The source
row state `reviewed` is not clinical or EVV verification. Changing the source
date clears the results and removes the old review action. No investigation is
created. Overview/Live/follow-office-today/feed is restored at 19:57:36 UTC;
selected source ID/results, related tables and private comparison buffers clear.

Native in-flight/obsolete-control/quota variants remain synthetic acceptance,
not claimed native race reproductions. Initiating button focus was not retained
in this native read; no focus, actual assistive-technology or full-WCAG acceptance
is claimed. One status-only screenshot timed out; no image was saved. The Demo
switch is a native unchecked checkbox, not an aria-checked attribute; restoration
uses its actual checked property. No private IDs, clock/hour values, source
responses or credentials are saved in source, assets, logs or this evidence.

Safe output receipts: `primetime-review-context-public-release-2026-11-03-1946.json`
and `primetime-review-context-native-2026-11-03-1946.json`; root/release checks are
recorded separately in the corresponding output logs.

This is a bounded administrator source-context correction. It does not recover
missing HHA times/hours, establish original device-event linkage, open patient/PT
roles, create an investigation, change an HHA record or make a clinical/financial
decision. P03/E04 and the broader O02/native/assistive-technology matrix remain
open. Other goal chats retain their pending source-file, care-plan and caregiver
availability decisions; no duplicate permission request is needed.
