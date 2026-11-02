# Source-read admission and retry evidence — November 2, 2026 UTC

Status: implemented and tested locally; normal release and postrelease normal-read
verification pending. No quota fault was deliberately induced in production.

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

After normal deployment, verify one ordinary single-attempt patient read and
the existing V3 inspector with matching current source context. Keep synthetic
quota/write tests distinct from native source acceptance. Do not generate traffic
to force a vendor limit; a naturally occurring later429 may provide additional
production failure-path evidence.
