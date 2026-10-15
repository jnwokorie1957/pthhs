# Manual calendar source import acceptance

The normal approved administrator session verified the patient workbench in
production on October 15, 2026. No credentials or private record values are
included in this report.

- September snapshot: 36 readable visit tiles and three authorization source rows.
- October snapshot: 41 readable visit tiles and three authorization source rows.
- Nine empty September DOM placeholders were excluded before import.
- Both snapshots reopened from server storage after a full page reload.
- Replaying the identical October source facts returned the existing snapshot;
  no third import was created.
- The October source-count chart rendered 31 daily bars and its source tables
  rendered three authorization rows and 41 visit rows.
- Patient/office membership was checked by the protected backend through the
  owner-enabled patient-demographics read.
- The live authorization link was selected and its source read enabled in owner
  preferences; it returned ten current HHA authorization records. Those records
  remain separate from the three rows captured in each historical UI snapshot.
- Demo mode remained off. Anonymous session and manual-snapshot API requests
  returned HTTP 401.

Release: `aa834cc54370cf04c914a107e5401d606fb1169d`, deployed by
[workflow 38741325733](https://github.com/jnwokorie1957/pthhs/actions/runs/38741325733).
Hosting and backend jobs succeeded. Local validation passed 456 backend tests,
128 frontend tests, generated-asset checks, repository integrity and HHA schema
preservation checks. The new backend tests cover invalid calendar dates, duplicate
IDs, office mismatches, changed policy, immutable versions and content deduplication.

Each snapshot retains raw source text, source IDs, capture time, server import
time, actor and a content hash. Changed content creates a separate immutable
record; a repeated capture time alone does not create another import. The server
checks the patient's current office before saving or reading snapshots. Direct
client Firestore access remains denied.

This is an initial patient-source import, not an agency-wide migration. Manual
captures do not replace live HHA reads, establish complete office coverage,
advance normalized sync checkpoints, approve clinical facts, classify EVV
exceptions, calculate payable hours or prove payment. Owner field validation and
external patient/therapist account acceptance remain pending.
