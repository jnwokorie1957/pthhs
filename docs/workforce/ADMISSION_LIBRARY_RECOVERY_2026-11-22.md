# Admission library read and single-template refresh recovery

Implementation: [PR49](https://github.com/jnwokorie1957/pthhs/pull/49),
runtime `c6c4e5f35cef9be210ad4b54318c3ca42a85e503`.
This extends the office document-library recovery covered by
[PR47 acceptance](ADMISSION_PACK_RECOVERY_2026-11-19.md) and the
[cumulative role research](../management-layer/ROLE_WORKFLOW_RESEARCH.txt).

## Problem and resulting behavior

The single-template save awaited the library loader but ignored its false
result. After a successful upload followed by a failed list refresh, its saved
message replaced the refresh error. A failed initial library read also had no
local retry. These are observed controller defects, independently reproduced
with fictional forms and simulated requests.

The library now shows **Refresh library** after a read failure. A successful
single-template save keeps its saved result separate from list freshness:
the failure remains visible, and refresh retries only the existing list read.
Repeated failures keep the action available. The successful refresh restores
the client-copy instruction and hides retry. The new action stays disabled
while a template is being prepared or saved. A superseded read or a late
failure after the current session ends cannot restore an old error or retry.

Permissions and shared links remain unchanged. Existing permitted office
readers can retry their existing list request; reusable-template upload still
requires the existing role, documents.review and server office checks. View
form and Use this form still address the same local template and client-copy
workflow. No patient/representative/PT portal or clinical source join is added.

## Compatibility and validation

Only the library controller, its versioned workforce-page reference and the
existing regression test change. API paths and payloads, record formats,
office/role grants, signatures, configuration and all HHA/time mappings retain
their previous bytes. Old open pages continue their current requests; no
reload is forced. The reviewed compatible marker follows the existing serial
release policy.

Four new regressions failed before the correction. All thirteen focused tests
and 700 frontend/tooling tests across 45 root test files pass, including
repeated refresh failure without another upload, an active-save interlock,
superseded reads, late sign-out failure and the previous pack recovery cases.
The extractor boundary and API are simulated; the remaining controller runs
unchanged. Workforce asset references, JavaScript syntax, repository audit
and diff checks pass. Existing binary/vendor-file audit warnings remain.

Six production baseline artifacts matched main at November 22 01:47:46 UTC.
Private page/header noindex and no-cache plus anonymous session
401/no-store/noindex pass. This receipt is distinct from delivery of PR49.

Both [quality jobs](https://github.com/jnwokorie1957/pthhs/actions/runs/44973171842)
and all four jobs in the
[normal compatible full release](https://github.com/jnwokorie1957/pthhs/actions/runs/44973251782)
passed. At **November 22 01:53:49 UTC**, all six production artifacts matched
the exact runtime: workforce entry, library and unchanged pack/Field Visits
controllers, caregiver entry and Primetime entry. The workforce page references
library `6cce01206c6e`; pack remains `59ffd32dcadc`. Workforce/Primetime
page and header noindex/cache controls and anonymous session 401/no-store/
noindex pass. All thirteen focused tests also pass against the actual served
controllers with simulated APIs and a stubbed extractor boundary. These checks
verify delivery and controller behavior, not an authenticated production upload.

## Remaining acceptance and owner actions

This is office-library recovery, not patient admission or clinical packet
completion. No real template, client copy, signature, HHA record or message was
created. Authenticated real-office UI acceptance was not performed in this
pass; the November19 sign-in observation retains its date.

The next owner action remains selecting the independently approved blank form
and business version, intended per-field identifier/time sources, required
signers/reviewer and permitted recipient roles before clinical automation or
sharing. Ordinary office acceptance must use that approved form and normal
authorized session/workflow. Existing typed PatientID/office versus mutable
AdmissionID, Medicaid/contract mapping, effective patient/PT assignments and
clinical document-instance/version contracts remain open.

No historical/current-day HHA comparison or recovered time is claimed.
Original October24 remains resolved by the October31 independent reread.
Other original-event/history/duration-unit/readback, paid-hours interpretation,
CSM/private-channel and held-visit prerequisites remain separate. No new
grant, clinical/financial decision or communication is requested.

Local nonsensitive evidence uses admission-library-*-20261122 output names.
The cumulative plain-text output mirrors the canonical Git blob bytes.
Rollback is a scoped PR49 revert through the normal release workflow.
