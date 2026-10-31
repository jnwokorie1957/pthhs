# Per-visit source read receipts

October 31, 2026. Baseline: `23f1653f89d22f4186bed9e1c30ce8ca39fc0ee3`.

The page receipt comes from SearchVisitsV2. Each returned visit detail and its
patient-office proof are independent reads, so that search timestamp cannot
stand in for either receipt. The existing reader already generates a UTC
`OperationalRead.fetchedAt` when its response is projected.

The visit DTO now preserves GetVisitInfoV3's receipt as `detailFetchedAt` and the
successful GetPatientDemographics office proof's receipt as `officeCheckedAt`.
The latter is attached only after the exact patient/office checks and final
scope check succeed. Unavailable details expose neither receipt. The minute
cache carries the same existing page DTO without extra source operations.

Within each permitted visit's **Open records** disclosure, the browser shows
**Detail read** and **Office check**, explicitly labelled separate receipts.
Page metadata identifies its timestamp as **search fetched**. These are backend
read receipts, not source-record modification times, service times, last-success
history, a single atomic snapshot or a complete-office health matrix.

The browser validates present receipts as bounded explicit instants. Missing
legacy receipts remain unavailable; it never copies the search timestamp into
them. Unavailable details and Demo discard these source receipts. Existing
record/session/page/date/Demo/Clear fences apply. No new source call, grant,
clinical/financial interpretation, chart calculation or write is added.

## Verification

Both new browser cases fail before and pass after. Tests preserve distinct search,
detail and office timestamps, reject malformed or date-only receipts, disclose
missing metadata, strip unavailable details and clear Demo without another raw
read. The backend regression also withholds receipts after a failed day check
and proves the existing three-operation request count is unchanged. All 535
backend and 343 root frontend/tooling tests pass. Existing static budgets pass
without adjustment: 417205 bytes raw including the catalog, 100866 gzip.

Normal release/native acceptance are pending at this implementation checkpoint.
Malformed metadata, legacy-cache and invalidation transitions retain synthetic
coverage; no production failure is induced. H03 remains open for the complete
per-operation last-success/freshness/coverage matrix. B02, P03/E04 and external
patient/staff/clinician assignment/document/action contracts remain open.
