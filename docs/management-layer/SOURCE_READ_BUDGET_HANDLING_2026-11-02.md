# Source-read admission and retry evidence — November 2, 2026 UTC

Status: deployed; ordinary live-read verification accepted. Quota/write refusal
branches remain synthetic tests; no quota fault was deliberately induced in production.

During EVV field acceptance the inspector reported a backoff. The existing
Firestore (default) Standard database integration-limit document was inspected
read-only. Its saved boundary16:21:00.333UTC was honored; a later retry returned
the expected live source fields. The original cause of that saved hold is not
proved by its timestamp. No stored hold or count was edited.

## Two admission-path corrections

The workspace previously persisted every read error carrying a retry interval
as nextAllowedAt. That included a local read-budget refusal, which already has
its own minute boundary. Later requests could therefore report vendor backoff
for a local quota. The workspace now skips that extra persistence only for
read_budget_exhausted_retry_next_minute. The existing shared sixty-read limit,
minute reset and all actual vendor delays remain enforced. Existing holds are
not shortened or cleared; other retry delays remain conservatively persisted.

The transport deliberately marks a denied non-retry-safe dispatch as
HhaNotSubmittedError. Some approved read-only methods also use that single-attempt
transport path. Losing the trusted admission cause turned their429/retry cursor
into an unclear failure, including during patient-office proof in visit paging.
The wrapper now retains its cause. Only the audited operational-read path can
recover an actual WorkflowError with status429 and one of the two known budget
codes. It rethrows that same cursor. Unknown/plain-object/non-budget causes stay
wrapped; write requests remain not submitted. No retry-safe method list, retry
count, source permissions, office proof or dispatch admission gate changes.

The Advanced tools and inline authorization error status now shows a positive
safe-integer server retry interval only for HTTP429. It clears prior facts and
does not automatically retry. Shorter equivalent failure descriptions fund this
message within the original app budgets; no warning or release control is removed.

## Validation

Two new backend regressions fail before implementation and pass afterward:
preserving known cursors through safe/single-attempt reads, and avoiding a false
vendor hold for local refusal. Additional tests retain write nondispatch and
unknown-cause privacy. A real-transport/synthetic-response preview test stops
before a denied patient-office dispatch, leaves both records unavailable, keeps
the original page cursor and20-second retry, and sends exactly two SOAP requests.
It does not skip the first unverified visit or manufacture source facts.

The existing real-transport admission test still proves one reservation per actual
dispatch and no network send after refusal; its old local-as-vendor persistence
assertion is corrected. All570backend tests pass. A browser regression fails
before and passes after: only valid429 intervals display, old facts clear and one
human action makes one request. All371browser/tooling checks and unchanged asset/
performance budgets pass. No new HHA method or owner decision is required.

## Release and native verification

Runtime `bcbecfb7d00cde126a4ef75f9476b5452dacc4f9` passed all three normal jobs in
[workflow41487089158](https://github.com/jnwokorie1957/pthhs/actions/runs/41487089158):
Hosting17:01:54, backend17:03:25 and analytics17:03:31UTC. Twelve exact deployed
assets and nine anonymous401/private/no-store/noindex boundaries passed at
17:08:56.763UTC. App/catalog419947raw and101945gzip bytes remain within the
unchanged420000/102000budgets. The concurrent d11c23c research update was retained;
its developer-checklist insertion was merged with this evidence, never forced over.

Chrome and Codex-browser user tabs were refreshed to workspace99c3e9997320 with
dashboard77a1e2f112c2. One ordinary single-attempt GetPatientDemographics read
returned one record/thirteen fields matching the selected patient and currently
configured office. A subsequent GetVisitInfoV3 read returned one record/twenty-nine
fields matching visit/patient/caregiver/date. Its type/clock/hour field states
agreed with the already-inspected affected case: in-type and EVV start supplied,
out-type/end and both actual-hour fields explicitly empty, recorded pair supplied.
No HHA source record changed and no absent field was substituted.

Both user-facing tabs were restored to current-day Overview with the automatic
API feed. Chrome showed ten of ten readable details and receipt18:59:03.178UTC;
Codex browser then showed connected receipt19:00:03.831UTC, first source page only.
The separate postgrant automatic advancement16:07:07.853 to16:12:09.588UTC remains
accepted without a manual source read between those observations.

Quota/write refusal and invalid-delay variants were not induced natively. Their
regressions remain explicitly synthetic. No new permission, dispatch retry,
limit increase, hold clearing, source edit or communication occurred. P11 is
accepted for the bounded handling correction; B02/P03/E04/T04/full-office and
broader source/role acceptance remain open.
