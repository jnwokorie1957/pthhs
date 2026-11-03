# Staff and billing read-status messages

November 3, 07:41 UTC trigger. This extends the accepted R75 patient/call status
pattern to the existing caregiver-profile and visit-billing source panels.

## Change and limits

Two stable sibling paragraphs carry `role="status"` and `aria-live="polite"`.
The complete caregiver and billing result tables are ordinary containers.
Existing loading, source-empty, identity refusal and cooldown messages use the
brief status node; a verified returned record announces "Source record returned."
The result table retains its fields, unknown/empty/zero distinctions, source
method and timestamps, office/subject receipts, freshness and record controls.

No focus move, extra request, read grant, source mapping, source write, clinical
or financial decision is introduced. A returned caregiver record does not prove
qualification or availability. A returned billing record does not establish cash,
approved charges or a complete ledger. Existing cautions remain in the result.

The design follows [role research](ROLE_WORKFLOW_RESEARCH.txt) and W3C's
[ARIA22 technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22), retrieved
November 3. A status region may announce its whole contents, which is why it now
contains a brief message separately from source fields. This is not a demonstrated
privacy defect or an actual screen-reader/full WCAG conformance result.

## Meaningful regression and asset checks

The new success-status test fails before the change and passes afterward.
Three new behavioral tests cover both source kinds: loading/success with retained
tables, receipts and controls; no source fields in the announcement; unchanged
initiating focus and request count; replacing old facts after successful empty,
identity refusal or quota; cooldown without another request; and ten late-response
cases after Clear, date, Demo, office or session changes. Office fixtures establish
a valid initial revision before changing scope. Existing source fences are reused.

All 390 frontend/tooling tests and 25 site-generation/release checks pass. Marketing
generation preserves all twelve private application files byte for byte.
Readable/generated HTML have identical parsed token sequences and 1,724 attribute
values after normalizing only the intended version hashes.

Generated provenance comments retain each source path while omitting redundant
comment whitespace. Seven other JavaScript bodies compare byte-identically after
removing that provenance prefix. The minifier's function/class names, public
properties and regular-expression contracts remain covered by existing tests.
No new compression option, dependency or asset-budget increase is introduced.
The app totals 417061 raw / 101987 default-gzip bytes, within the existing 420000/102000
totals and 110000 per-file limits.

Runtime: d411b277d8f8d6002412540bf8b1ea464b49e80d.
Normal workflow: [41600294604](https://github.com/jnwokorie1957/pthhs/actions/runs/41600294604).
All three normal release jobs succeeded: Hosting 08:02:42 UTC,
backend 08:02:57 UTC and website analytics 08:04:31 UTC. All twelve deployed app
assets match the tested bytes; eleven anonymous protected boundaries retain
HTTP401 JSON/no-store and private noindex protections.

## Bounded signed-in production acceptance

At 08:08-08:10 UTC the existing authorized Chrome session was reloaded after all
release jobs succeeded. Both new status paragraphs have the explicit status/
polite attributes; neither full result container is a live region.

One ordinary caregiver-profile action showed the loading message, then exactly
"Source record returned." The ordinary table retained eight field rows, source
method/fetch/office-check receipts and seven record controls. Initiating button
focus stayed unchanged through loading and success. No source field or identity
is included in the concise success announcement.

One ordinary billing action showed loading, then a successful source-empty
message with its explicit caution that this does not establish zero charges,
payment or an AR balance. No billing table was fabricated and initiating focus
stayed unchanged. This accepts empty-result presentation only, not usable or
populated billing facts, a complete ledger or financial interpretation.

Switching to Demo cleared both related tables and their status messages. Live
was restored with Overview, Following office today November 3 America/Chicago,
the connected automatic feed running and checked source tables cleared.
No source write, import, new grant or other goal's pending decision was touched.

Deidentified output evidence: primetime-staff-billing-status-native-2026-11-03-0741.json,
primetime-staff-billing-status-public-release-2026-11-03-0741.json and
primetime-staff-billing-status-structure-2026-11-03-0741.json. One status-only
screenshot attempt timed out; no image was captured or exported. Acceptance
uses DOM/accessibility state and existing behavior tests, not image/AT proof.

Actual assistive-technology/mobile combinations and native populated billing,
quota, office-revocation and late-response variants remain separate acceptance.
No missing EVV/actual-hour value, billing fact, staff availability or external-role
permission is recovered or accepted by this presentation change.
