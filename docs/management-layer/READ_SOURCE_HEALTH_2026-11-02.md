# Protected API read receipts — November 2, 2026 UTC

Status: normally deployed and accepted for the bounded saved-receipt view and
pipeline. H03's full source/coverage acceptance remains open. This adds no HHA
operation, permission or query and recovers no missing source time or billing fact.

## Source and meaning

The HHA Integration tab lacked per-read outcomes. Its global connection wording
also referred to the separate GetCollectionStatus reference check, which can be
unchecked even while the visit feed succeeds. That badge now explicitly says
HHA reference; it does not represent every endpoint's entitlement or field state.

New GET /workspace/read-health uses the existing authenticated administrator and
operational-data release boundaries. It reads saved metadata from protected
Primetime sourceReadHealth documents, not HHA. The table lists current enabled
methods, their latest outcome/time, last successful source receipt and that
successful response's row count/truncation flag. Empty success, read failure,
local admission wait, vendor wait, invalid request, scope refusal, changed
preferences, unobserved and malformed metadata remain distinct. A missing current
receipt is not labelled a failed connection. Unselected methods remain controlled
through owner preferences and the existing capability inventory.

Receipts describe one response, not complete office coverage, validated field
meaning, atomic reads, source last-modified time, an import or a financial/clinical
result. A successful empty billed search is not a zero balance. A count never
fills an absent EVV field. Historical successful reads are not backfilled into
this new collection or relabelled as fresh observations.

## Storage and scope

OperationsWorkspace records outcomes after its ordinary reads, without repeating
the source request. The closed record shape contains only known operation,
configuration revision/office, server receipt time, fixed outcome, count and
truncation, plus a same-scope last success. No patient/caregiver/visit IDs, patient/
day selectors, source fields/XML, actor IDs, credentials or arbitrary error strings are
stored in these receipts or their warning logs. Metadata-storage failure does
not replace or retry a source result; its log contains the method name only.

An atomic metadata transaction rechecks current owner office/revision and ignores
old-scope or out-of-order events. A later failure preserves the same-scope last
success. Changed preferences cannot inherit an old success. The API validates
stored metadata, filters to the current enabled methods and rechecks settings
after storage reads. It returns a closed typed summary and four plain-text display
cells per method; source fields cannot become display cells. Existing Firestore
rules deny all direct client access; no database provisioning, index, rule or IAM
change occurs.

The browser validates office/revision, exact enabled-method membership/uniqueness
and bounded four-string rows. It uses textContent, clears old results before
loading, and fences late responses after settings/session/Demo changes. A failed
refresh has a retry action and cannot retain old rows. Refreshing this list does
not issue a SOAP request or change any source/write/read permission.

## Validation and release prerequisites

Eight backend tests cover empty and successful receipts, failure preservation,
fixed error categories, private-field stripping, malformed metadata, metadata
storage failure, release/scope fences, atomic persistence and out-of-order events.
Three browser regressions fail against the pre-feature bundle and pass after:
honest empty/unobserved rows without source fields/extra queries; malformed/foreign
or duplicate rows; late Demo/sign-out responses. All583backend,379browser/tooling
and46analytics tests pass after preserving concurrent authorization-return work.
The new browser checks are included in the normal release script.

Equivalent shorter help text funds the new panel without removing controls,
required review/proof conditions or source/financial/clinical boundaries. The
incoming compact generated source-path headers and option markup are preserved;
unrelated script bodies remain unchanged. JavaScript compression/property
renaming and all original budgets remain unchanged. Generated assets are current:
373874bytes plus44949byte catalog; raw418823/420000, Node gzip101982/102000.

After normal release, verify anonymous refusal, new protected receipt loading,
actual saved source outcomes/times/counts and reload persistence. Distinguish
normal source successes, one empty result and genuinely unobserved methods;
do not induce source errors, quota exhaustion or permission revocation merely
for a screenshot. Check Demo clearing, restore the current-day automatic feed
and update the checklist only to the scope that production evidence supports.

## Production acceptance

Runtime `87ea6347000711f6dad1cd22a154613bb60b1b09`, tree
`fc9b381b32ee5eae3475a18fd758306fdb7ba6ed`, passed all normal jobs in
[workflow41521239658](https://github.com/jnwokorie1957/pthhs/actions/runs/41521239658):
Hosting20:40:37, backend20:43:06 and analytics20:42:03UTC. Twelve exact assets and
nine existing anonymous private/noindex boundaries passed20:44:02.935UTC. The
new read-health route separately returned anonymous401 with no-store and
noindex/nofollow/noarchive at20:44:03.529UTC.

The refreshed signed-in Chrome page rendered eleven enabled methods. Ordinary
automatic feed reads created actual stored discovery, visit-detail and patient-
demographic receipts. Seven other methods correctly showed No current receipt;
previous successful reads were not backfilled. A single ordinary approved billed
search for the already-verified patient/office/October24 date completed with zero
records, and the table showed Successful empty response with zero rows and exact
source receipt20:46:30.979UTC. No candidate billing fact or balance was inferred.

That exact billed receipt survived a full page reload and a new protected storage
read. Demo removed all receipt rows; returning Live and loading restored eleven
rows and the same exact billed receipt. Each row has four bounded plain-text
cells. Desktop page width equals viewport1280px; no page overflow was observed.
The settled receipt-table screenshot contains no patient/staff source values.
Late/failure/foreign/revocation/quota and malformed cases remain synthetic; they
were not forced in production. No new permission, HHA source edit or message.

The user tab was restored to Overview, following office today November2, with an
active API feed receipt20:55:03.059UTC and ten rendered visit rows (plus one table
header). The first-page coverage limit remains explicit. No viewport override or
extra browser tab was used. H05's bounded pipeline/view is accepted; unobserved
methods, complete-office/field coverage and P03/E04/B02/T04/role evidence remain
open. No missing time, hour or usable detailed billing value was recovered.
