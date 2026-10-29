# Visit Preview unavailable-detail wording

When a visit detail read failed or was deferred, the Preview row correctly
identified an unavailable detail but its schedule, recorded-time, EVV and hour
cells said “Not supplied by HHA.” An unread detail cannot establish that those
fields were absent from the source.

The five detail-dependent cells now say “Detail unavailable.” The row keeps its
specific failure/defer reason and has no source-record shortcuts. Readable records
retain supplied values, genuine missing-field labels, source zero/empty hours and
labelled clock spans. Chart denominators continue to exclude unavailable details.
No source request, backend, read permission, data mapping or clinical/financial
rule changes.

The expanded Preview/EVV/Staffing regression failed against the old bundle and
passes after regeneration. It checks all five unavailable cells, strips unverified
values and preserves zero hours plus genuinely absent clock fields in a returned
record. All 315 frontend/tooling tests pass. The generated assets are deterministic;
normal release and production evidence are recorded separately in the handoff.
The forced unavailable-detail case is synthetic unless a normal live page also
returns it; successful native readable-row checks do not establish that case.

This is a display correction. It does not recover failed details, populate empty
billing reads, validate clinical interpretation or complete source/role acceptance.
B02 protected same-record billing diagnostics and existing source/P1-B/P2 contracts
remain open. Rollback is a scoped revert through the existing tested pipeline.
