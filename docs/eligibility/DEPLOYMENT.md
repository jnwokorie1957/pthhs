# Eligibility deployment and acceptance checklist

Status: **development branch only — do not merge or deploy without the owner's approval**. The owner's authorization for development does not authorize reading or modifying live clients, submitting production inquiries or executing vendor agreements.

## Required external actions

- [ ] Designate PTHHS enrollment, privacy/security and operational owners. Confirm enrolled provider/NPI/contract and authorized program scope. Current submitter status is unknown; use the new-enrollment checklist in RESEARCH.html unless TMHP confirms an existing approved account.
- [ ] Complete applicable TMHP application, agreements and any provider-specific linking paperwork. Have an authorized signer execute them. Obtain test Submitter ID, credentials, transport choice, permitted rate, testing instructions and approved synthetic fixtures through secure channels.
- [ ] Resolve test CORE ReceiverID versus X12 ISA08 values and ISA15 rules directly with TMHP. Confirm whether new enrollment should use CORE 2.2 or 4.0, and any certificate, network, batching and operational constraints.
- [ ] Obtain the appropriate X12 TR3 license and reviewed codec implementation; account for the planned reusable/commercial platform. Complete TMHP acceptance tests and obtain explicit production approval for the selected method and transaction.
- [ ] Confirm HHA Texas tenant entitlement to profile/identifier/authorization/schedule/visit reads, correct endpoint/version, permitted synchronization, quotas and data freshness. Written authorization for a fresh eligibility API is required before describing one as available.
- [ ] Confirm relevant BAAs, subcontractor agreements and permitted use/retention terms. Verify Google Cloud agreement and service-by-service scope, including auth product and the Hosting path that currently proxies authenticated PHI. If unsupported, approve an appropriate covered backend route and update the client integration before PHI use.

## Engineering remaining before a live pilot

- [ ] Implement and certify the licensed EdiCodec. Validate envelopes, identifiers, counts, delimiters, repeating loops, errors/acknowledgments, correlation, membership/program/date/service scope, MCO dates and ambiguous responses against approved fixtures. Unit evidence normalization is not an X12 parser certification.
- [ ] Bind the approved TMHP connector to versioned Secret Manager credentials in the runtime worker. Add rotation and environment separation. The present worker deliberately binds `pendingConnector`; no TMHP secret exists in this change. CORE 4.0 requires another transport implementation if selected.
- [ ] Reconcile the complete HHA active roster, source admission lifecycle and missing/deactivated records. Detect duplicate identifiers across distinct HHA links without raw identifier indexes or fuzzy merges. Confirm payer-specific PAS authorization semantics.
- [ ] Connect real admissions and configurable pre-service events to `enqueueLifecycle`. Implement the scheduled/actual-visit join and code/unit/payer discrepancy rules. Current code displays date/unknown-data warnings only.
- [ ] Complete department notification acknowledgment/escalation. Named assignee selection is implemented; confirm routing ownership for initially unassigned members. External email/SMS/Teams notification adapters are not supplied; no messages were sent during development.
- [ ] Implement approved retention/deletion jobs with legal holds, audit retention and vendor deletion coordination. No TTL or destructive deletion was introduced for eligibility. Approve durations before implementation; do not assume one universal HIPAA retention period.
- [ ] Complete emulator/integration tests, real transaction contention and index tests, 600- and 2,000-client performance tests, shutdown/restart/replay tests, HTTP authentication denial tests, redaction checks and session-expiry behavior. Validate trusted callback/event authorization before future-platform use.
- [ ] Review IAM/service-account scope for eligibility functions, KMS and secrets. Existing service identities and shared KMS helper are reused; dedicated identities/key isolation need a deployment decision. Review Firestore backup/restore, PITR, delete protection and tamper-resistant audit sinks.
- [ ] Approve staff role grants, MFA/session requirements, idle-lock policy, authorized ID reveal and staff training. New eligibility permissions are not automatically granted to any user.
- [ ] Assess availability, credential expiration, queue depth, oldest job, failed roster refresh, missing batch completions, exception age and daily failure-rate alerts. Prove operational monitoring and on-call response without PHI in telemetry.
- [ ] Implement native batch submission/response correlation if TMHP requires or approves it for roster sweeps. Present monthly work is a durable fanout of individual inquiries, not an SFTP EDI batch sender.

## Parameters and deployment boundaries

All new release parameters default closed:

| Parameter | Default | Meaning |
|---|---|---|
| ELIGIBILITY_DATA_APPROVED | false | Approved storage/display of eligibility data in this environment |
| ELIGIBILITY_CONNECTIVITY_APPROVED | false | Recorded approval of the selected connection |
| ELIGIBILITY_SCHEDULES_APPROVED | false | Monthly roster checks enabled only after acceptance |
| ELIGIBILITY_HHA_SYNC_APPROVED | false | Approved source reads and private eligibility snapshots |
| ELIGIBILITY_PRE_SERVICE_APPROVED | false | Pre-service event hook allowed |
| ELIGIBILITY_APPROVED_REQUESTS_PER_MINUTE | 0 | Written vendor allowance, bounded by application ceiling |
| ELIGIBILITY_APPROVED_OFFICES | empty | Explicit office allowlist |

`CERTIFIED_CODEC_AVAILABLE` remains false in source. Do not flip it to bypass missing work. After certification, replace the runtime connector binding and test the full path before considering a release. Existing HHA data/portal/staff gates and per-operation approvals also apply. The existing KMS helper requires its reviewed `WORKFORCE_DOCUMENT_KMS_KEY` configuration.

The branch adds three scheduled exports: `workforceEligibilityMonthly`, `workforceEligibilityWorker`, and `workforceEligibilityRoster`. Discovery tests were updated; API-only deployments omit these. The scheduled functions exit with gates closed. They must still not be deployed by this task. Existing main-branch workflow can deploy automatically, so merging is itself a release-sensitive action.

## Release sequence after approval

1. Review PR code, research and outstanding items; obtain passing repository CI. Create a separate approved nonproduction project/environment with synthetic fixtures and no production secret access. Resolve the existing KMS helper's project pin through an explicitly reviewed environment configuration if needed.
2. Validate denied direct Firestore access, HTTP token/revocation/office checks, separately restricted identifiers and approved service/BAA boundaries. Deploy indexes and least-privilege IAM through the established authorized workflow; no rule broadening is required.
3. Complete TMHP UAT using the enrolled test submitter and approved data, retaining required acceptance evidence privately. Record transport, guide versions, permitted rates and unresolved vendor findings.
4. Obtain TMHP production confirmation, HHA synchronization approval, security acceptance, operational sign-off, and the owner's separate approval of the concrete production deployment and pilot record set.
5. Enable an authorized small pilot, verify returned coverage and separate MCO/authorization evidence against an approved reference, and inspect private audit/exception handling. Do not label the connection live until that succeeds.
6. Increase to the approved roster, verify scheduled completion and per-department review, then approve the 2,000-client capacity target based on measured results. Date-based fanout tests alone do not certify throughput.

Rollback: disable connectivity, scheduling, pre-service and HHA synchronization gates; pause scheduler jobs through the approved operational process. Preserve submitted-job/result history and investigate unknown delivery before retry. Restrict data access if a security incident requires it. Do not cancel care or delete evidence as rollback behavior. Restore prior application artifacts only through the established reviewed release process.

## Acceptance evidence register

| Evidence | Current state |
|---|---|
| Source code, unit/contract tests and synthetic browser QA | Implemented and locally validated; see README |
| Licensed X12 implementation and TMHP test acceptance | Missing |
| Authorized TMHP production credentials and successful inquiry | Missing/unknown; no request made |
| HHA tenant entitlements and live roster reconciliation | Not validated |
| Privacy/security agreements and service coverage | Not validated |
| Firestore emulator, IAM and production-like performance evidence | Not run |
| Linux full repository CI | Obtain final draft-PR result |
| Owner merge/deployment/live-record authorization | Not requested or granted for this release |

This checklist remains open until evidence is recorded. A passing test suite is not regulatory approval or proof of production connectivity.
