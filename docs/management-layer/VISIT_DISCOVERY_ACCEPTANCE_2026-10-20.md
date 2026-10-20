# Visit discovery: local acceptance, October 20

The dashboard's internal SearchVisitsV2 discovery projection retains all identifiers received within the existing bounded SOAP response. Other operational previews keep their existing 200-record projection. Detail pages still request at most 10 visits with the existing 25-second budget and patient-office checks.

Discovery reports totalReceived before deduplication, selectedCount after deduplication, truncation and discoveryCompleteness unknown. Source discovery completeness remains false; counts are not operational totals. A response exceeding the existing 5 MiB ceiling fails instead of returning a silently shortened list. This does not prove the vendor returned every matching visit.

Cursors retain actor, office, date, policy and stable discovery fingerprints. Offsets may exceed 200 but must be positive safe integers within the current discovery. Changed discovery requires restart. Failed details remain visible and the same page can be retried. Search is still repeated per user-requested page; no automatic full scan, new storage or source writes are introduced.

Synthetic coverage includes 200, 201, 1500 and 1601 IDs, duplicates, final pages, invalid offsets and identifiers, source changes, failed-page retry, office isolation and SOAP byte bounds. Dashboard tests render a 1601-ID discovery count while preserving page-only diagnostics and unknown office coverage.

Local validation: 476 backend tests passed; 238 frontend tests and the full build-and-verify release gate passed. The local runtime was Node 24; the existing CI runtime remains a separate verification. Deployment and authenticated acceptance are separate: no real patient source retrieval is part of these tests. Other capped workflows are not expanded by this change.

Rollback: revert the scoped commit and run the existing release workflow. No data migration or persistent discovery state is introduced.
