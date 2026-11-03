# Patient and call source-read status

November 3, 2026. This bounded implementation follows the R75 status-message
research in [role workflow research](ROLE_WORKFLOW_RESEARCH.txt). It separates
brief asynchronous read messages from patient profile and raw-call result tables.
It recovers no missing recorded clock, original EVV punch or duration field.

## Behavior and scope

Stable sibling paragraphs carry `role="status"` and `aria-live="polite"`.
Loading, refusal and failure messages use those nodes; successful patient reads
announce "Profile returned." Successful raw-call reads announce the response's
record count, including zero. Profile fields, raw call identifiers/types/statuses,
receipts, freshness and existing record controls remain in ordinary containers.
Zero calls still do not prove absence of a visit or original punch. This is an
announcement-content change, not a source-status or event-interpretation mapping.

Existing request fences clear status and result together on context changes.
No focus move, extra source request, permission, persistence, clock/hour fallback,
source write, clinical/financial decision or communication is introduced.

## Verification before release

Three new behavioral tests fail before the change and pass afterward. Synthetic
cases cover patient loading/success and preserved table content; raw-call
populated/empty/refusal states; unchanged focus and one request per action; and
late patient/call responses after clearing, Demo changes and sign-out. All 387
frontend/tooling tests and 25 site-generation/release checks pass. Marketing
generation preserves all twelve private application files byte for byte.

To retain the existing asset limits, the private HTML generator removes optional
quotes only from a closed set of safe single-token attributes. Readable source
keeps quotes. Free-form values, URL/pattern attributes and script/style/pre/
textarea blocks remain intact. Regression fixtures cover quoted greater-than
characters and literal embedded markup, protected blocks and idempotence.
Parsing authoring/generated HTML yields identical token sequences and all 1,722
attribute values after normalizing only intentional version hashes. Generated
inventory checks accept quoted and legal unquoted attributes. JavaScript public
properties, DOM IDs, accessible names and controls retain their contracts.

After preserving concurrent caregiver-read changes from 9138161, application
assets total 416,962 raw / 101,992 default-gzip bytes. Limits remain 420,000 /
102,000 total and 110,000 per file. No budget or release gate was increased.

Runtime commit: 84c26e5d33e364fd3f79b39ab3d0c10965c567a7.
Normal workflow: [41572326447](https://github.com/jnwokorie1957/pthhs/actions/runs/41572326447).
All three jobs pass: Hosting 03:28:14, backend 03:28:24 and website analytics
03:30:06 UTC. Twelve production assets match the published bytes; eleven anonymous
private routes return 401 JSON with no-store. Private noindex protection remains.

## Signed-in production acceptance

Chrome's existing authorized Primetime tab loaded the new status nodes and ordinary
result containers after the normal release. One current patient action showed
the brief loading message, then exactly "Profile returned." The result retained
its ten-row source table, GetPatientDemographics timestamp and visit/patient/office
receipt, and seven existing record controls. Focus stayed on View current profile
through loading and completion. No private fields appeared in the status node.

Demo cleared the patient result/status; the call area contained only paused-source
guidance and no call table. Restoring Live also retained no old profile/call table.
The existing automatic feed was restored to office today, with a connected source
receipt at 03:32:19.972 UTC. No unchanged refused call context was retried. Native
populated/empty/refused call variants and cancellation races are not newly claimed;
those paths have synthetic regression coverage. A clipped, cleared-panel screenshot
attempt timed out at Page.captureScreenshot; no screenshot or private image was
saved. Native acceptance here is based on DOM and accessibility-state checks.

## Remaining acceptance

Actual screen-reader/browser combinations, mobile assistive technology and the
full O02 failure/retry matrix remain open. Synthetic tests do not establish full
WCAG conformance, patient/therapist role acceptance or clinical validity. Existing
unresolved HHA time-source, call-retention/linkage and document-download evidence
gaps keep their separate checklist entries and owner/vendor dependencies.
