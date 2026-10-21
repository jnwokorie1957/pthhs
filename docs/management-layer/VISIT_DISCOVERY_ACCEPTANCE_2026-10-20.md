# Visit discovery: local acceptance, October 20

The dashboard's internal SearchVisitsV2 discovery projection retains all identifiers received within the existing bounded SOAP response. Other operational previews keep their existing 200-record projection. Detail pages still request at most 10 visits with the existing 25-second budget and patient-office checks.

Discovery reports totalReceived before deduplication, selectedCount after deduplication, truncation and discoveryCompleteness unknown. Source discovery completeness remains false; counts are not operational totals. A response exceeding the existing 5 MiB ceiling fails instead of returning a silently shortened list. This does not prove the vendor returned every matching visit.

Cursors retain actor, office, date, policy and stable discovery fingerprints. Offsets may exceed 200 but must be positive safe integers within the current discovery. Changed discovery requires restart. Failed details remain visible and the same page can be retried. Search is still repeated per user-requested page; no automatic full scan, new storage or source writes are introduced.

Synthetic coverage includes 200, 201, 1500 and 1601 IDs, duplicates, final pages, invalid offsets and identifiers, source changes, failed-page retry, office isolation and SOAP byte bounds. Dashboard tests render a 1601-ID discovery count while preserving page-only diagnostics and unknown office coverage.

Local validation: 476 backend tests passed; 238 frontend tests and the full build-and-verify release gate passed. The local runtime was Node 24; the existing CI runtime remains a separate verification. Deployment and authenticated acceptance are separate: no real patient source retrieval is part of these tests. Other capped workflows are not expanded by this change.

Rollback: revert the scoped commit and run the existing release workflow. No data migration or persistent discovery state is introduced.

## Parser hardening and normal release

`57104745913c55c373b7c11764862259c7b12827` adds full-result XML validation and
direct scalar-ID extraction. Empty/nested/nil/ambiguous IDs, unknown collection
syntax, DTD/custom declarations and malformed trailing text fail instead of silently
shortening discovery. Compatible empty collections, namespaces, comments,
CDATA/processing instructions and standard character references remain covered.
References decode once; literal CDATA and escaped references stay literal. Nil
attributes use XML Schema whitespace normalization. Forward token spans and
per-ID parsing avoid a complete result-object tree. The previously locked XML
parser is now an explicit dependency.

The final local backend total is 484 tests; the 238 frontend tests and full local
release gate also passed. Both normal jobs passed first attempt in latest
[workflow 39513566659](https://github.com/jnwokorie1957/pthhs/actions/runs/39513566659).
Earlier discovery and status-label workflows also succeeded. These gates are
separate from the production observations below.

## Bounded production acceptance — October 21 00:38 UTC heartbeat

At 00:40:59 UTC, production HTML and all four referenced assets matched tested
bytes. Private noindex/nofollow/noarchive and anonymous session/current-visit 401
boundaries remained intact. The normal administrator session accepted a real
source discovery exceeding 200 distinct IDs through the hardened parser. The
copy no longer describes a 200-ID projection limit and still states unknown
office totals/coverage, partial page scope and explicit on-demand reads.

First, restored-date, next and previous pages each had ten readable visits and
all six field-presence charts matched their displayed source fields. Next IDs
were disjoint; Previous and a safe date-reset retry restored the first IDs.
Only source positions 1–20 were opened. Retained search IDs do not establish
vendor completeness, a full office census, a persisted import or clinical status.

The safe missing-date and pending-access/clear states passed the bounded
[label checks](SOURCE_STATUS_LABELS_ACCEPTANCE_2026-10-20.md). Final preview and
entry/results fields are cleared, selected service day retained and automatic
age updates on. HHA still requires normal sign-in for further tenant evidence.

Offsets above 200, malformed/ambiguous XML/IDs, byte ceilings, lexical variants,
source changes, failure/revocation and scope attacks remain synthetic coverage;
none was induced on real source records. No raw XML/IDs were saved in research
or public artifacts, and no complete source scan, import, permission/source write
or clinical/financial decision occurred. Aggregate artifacts and the generic
proof image are referenced in the label report. Broader source/role/operational
acceptance remains open.
