# Visit review source-detail availability

October 31, 2026 UTC / October 30 America/Chicago.

When a bounded Visit review item had no returned source record, its schedule and
recorded-time pairs said “Unavailable → Unavailable,” while hour fields said
“Not supplied by HHA.” Its detail panel also offered an empty “Original source
values” disclosure. Those labels could imply that HHA returned a record with
missing fields even when that record could not be read.

The normalized client model now retains whether the response contained a source
record, separately from the evidence interpretation state. Without that record,
the card badge and schedule, actual, EVV and duration facts say “Source detail
unavailable.” The detail panel explains that the fields could not be read and
retains the existing failure reasons and source references. It omits the empty
original-value disclosure. Selecting a returned record replaces that explanation
with its own facts and guidance.

A returned raw record remains visible even when its normalization fails or its
interpretation is pending, stale or incomplete. Existing missing-field, empty,
zero-hour and source-clock-span behavior stays intact. This display correction
adds no source request, import, write, role grant or operational decision.

## Verification

- A new synthetic regression reproduced the prior labels before the correction.
  It covers no-record unavailable, failed and incomplete results, then selection
  of a returned record with genuine absent actual hours.
- Separate cases retain raw clocks and zero hours for returned records in failed,
  incomplete, stale and unaccepted interpretation states. No write is submitted.
- All 36 Visit review and 317 frontend/tooling tests pass. Generated asset checks
  and repository audit are recorded with the release evidence.
- Native normal-flow production checks are recorded separately in the handoff.
  An exact unavailable-detail source failure is not forced or claimed from a
  readable page; its deterministic coverage remains synthetic.

The existing source interpretation, full-office coverage, B02 usable billing
facts/diagnostics, authorization/POC/document mappings and P1-B/P2 role/action
contracts remain open. This does not establish clinical, financial or external-role
acceptance.
