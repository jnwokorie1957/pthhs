# Primetime revision backend and rollout

This implementation follows the completed dashboard interview in `PRIMETIME_ADMIN_DASHBOARD_REVISION_SPEC.md`. The default screen is the operations overview. **Visit review** brings original times, worked duration, diagnosis, next action, local office follow-up, required visits and reminder delivery together. Demo mode uses one synthetic dataset and makes no operational requests or writes. Switching modes, changing the service date and signing out clear old data and cancel pending UI requests.

## Implemented behavior

- Deterministic visit diagnosis uses accepted, fresh source evidence with explicit timestamp offsets. Raw unaccepted source data is labeled unknown; an unavailable read never becomes a missing punch. Future and ongoing visits are distinguished from completed missing evidence.
- A fixed or accepted variable visit that remains open fifteen minutes past its scheduled end can produce a caregiver reminder and supervisor follow-up. Recorded service exceeding scheduled duration produces a review item. Observed overlapping intervals produce review rather than an automatic compliance finding. Incomplete discovery never proves that no overlapping visits exist.
- Early ending remains allowed. The system retains a factual note and offers a reason-code candidate for review. It produces no supervisor alert solely because a visit ended early. The caregiver reminder threshold defaults to `null`; the interview did not finalize it.
- Exception acknowledgement, assignment, review, resolution and reopening are local, audited decisions. Resolving an office task does not assert HHA verification or change source visit times.
- Call candidates come from fresh office/day discovery and matched patient/caregiver identities. The caller supplies an explicit vendor call-dashboard boundary. Matching rechecks source hashes and identities. Match, rejection and undo remain local, audited associations; HHA call connection writes are disabled.
- Supervisory visits and initial/recurring orientation have explicit subject, program, service, supervisor, rule reference, effective dates and due-date anchor. Calendar-month recurrence preserves month ends. Evidence is pending until reviewed, final completion decisions are immutable, and due dates advance only after acceptance. Six months is supported when the applicable rule explicitly supplies that cadence; it is not a universal default.
- Reviewed contacts normalize ordinary ten-digit US numbers to `+1`. SMS requires current contact review, permission and no opt-out. Caregiver recipients must be assigned to the source visit; supervisors must be explicitly selected for the configured office.
- A durable notification outbox provides idempotent queueing, atomic worker claims, provider receipts, authenticated delivery callbacks, suppression and separate office acknowledgement. Unknown sends are reconciled and are never blindly retried. Texts use friendly language and readable office-local times. Current early-ending SMS is a follow-up after a recorded event; it cannot intercept or approve HHA clock-out.
- Token reminders group distinct accepted missing service dates by caregiver. A stored window holds at most ten visit IDs; every included visit is rediscovered and reread before delivery. Coverage is explicitly partial. A stable first-missing-date occurrence prevents duplicate messages as punches change. A repeat-message cadence has not been supplied.
- The scheduled worker runs every minute with one instance, an office lease, source-call budget, shared HHA quota, rotating token/contact windows and rotating outbox pages. Three runs out of four inspect today; the fourth advances an independent cursor through the previous six days. Each visit page contains at most ten visits, and discovery caps at 200 visits per date. A stable 200-visit current-day window needs 26 planned runs, before latency, quota deferrals or changed-source restarts. The 15-minute condition threshold is separate from delivery latency; this build does not promise detection within 15 minutes. Provider configuration alone does not start monitoring.

Release note: Cloud Scheduler API has been enabled for the existing Firebase project. Normal pushes discover and deploy both the API and the gated monitor. The explicit manual Hosting-only release still skips the backend. The API-only discovery switch remains available for an intentionally filtered recovery deployment; it is not used in the normal release workflow.

Deployment prerequisite: the existing CI identity `firebase-adminsdk-fbsvc@primetimehomehealthservices.iam.gserviceaccount.com` needs `cloudscheduler.jobs.get`, `cloudscheduler.jobs.create` and `cloudscheduler.jobs.update` in `primetimehomehealthservices`. The proposed project custom role is defined in [primetime-scheduler-deployer-role.json](primetime-scheduler-deployer-role.json); it excludes run, delete, pause and enable permissions. The grant applies across this project's Scheduler jobs. Scheduler does not support job-specific IAM policies or a resource-name condition to restrict this role to one job. Creating the role definition does not assign access; an authorized operator must approve and assign it before retrying the backend deployment. See [Google Scheduler access control](https://docs.cloud.google.com/scheduler/docs/access-control) and [supported resource attributes](https://docs.cloud.google.com/iam/docs/conditions-resource-attributes).

## API contract

All dashboard endpoints require the existing verified administrator session, live mode and office scope. Operational records also require the operational-data release. GET responses use `Cache-Control: no-store`. Records use optimistic revisions and transactional audit entries.

| Method | Endpoint under `/primetime/api` | Purpose |
| --- | --- | --- |
| GET | `/data/status` | Safe live-source readiness metadata |
| GET | `/views/visits?date=YYYY-MM-DD&limit=10&cursor=...` | Bounded raw, explicitly unvalidated HHA preview |
| GET | `/revisions/status` | Revision capabilities and configured policy |
| GET | `/revisions/visits?date=YYYY-MM-DD&offset=0` | Bounded source evidence, diagnosis and missing-token summary |
| GET, POST | `/revisions/policy` | Read/save explicit office reminder preferences; cannot approve source data |
| GET, POST | `/revisions/contacts` | List/save reviewed caregiver or supervisor contacts |
| GET | `/revisions/requirements` | Required visits/orientation with office-local due status |
| POST | `/revisions/requirements/save` | Create or revise a scoped requirement |
| POST | `/revisions/requirements/complete` | Record supporting completion evidence |
| POST | `/revisions/requirements/review` | Accept or reject pending evidence |
| GET | `/revisions/exceptions` | Local office follow-up records |
| POST | `/revisions/exceptions/review` | Acknowledge, start review, resolve or reopen with a note |
| GET | `/revisions/call-matches` | Audited local call associations |
| POST | `/revisions/call-matches/prepare` | Discover candidates using visit/date and explicit `lastId` |
| POST | `/revisions/call-matches/decide` | Recheck and match/reject/undo locally |
| GET | `/revisions/notifications` | Outbox state, receipt and supervisor deadline |
| POST | `/revisions/notifications/acknowledge` | Record office acknowledgement independently of delivery |
| POST | `/revisions/sms/status` | Provider-only form callback, authenticated by fixed-URL/account/HMAC validation |

Visit paging returns `nextOffset` and a `discovery` fingerprint; the next request must include both. A changed discovery or policy requires restarting. Record lists return `nextCursor`. No dashboard endpoint accepts a browser-authored diagnosis, source acceptance assertion, notification body, recipient phone for dispatch, source-write permission or provider receipt.

## Protected persistence

Collections are partitioned by configured numeric office ID. They include `revisionPolicies`, `revisionRequirements`, `revisionCallMatches`, `revisionExceptions`, `revisionDiagnoses`, `revisionContacts`, `revisionNotificationFacts`, `revisionTokenRoster`, `revisionMonitor` and the notification outbox. Call-match evidence and its source scope commit as one record. Changes and `workspaceAudit` entries commit together through the existing repository transaction. Firestore clients must have no direct operational collection access; the authenticated backend owns all operations. No credentials belong in Firestore contact/policy documents or public files.

## Activation prerequisites

The deployed build supplies **29 closed approval parameters**, including the five new parameters below. No patient/caregiver operational facts or real SMS are enabled by this commit.

1. Retain the existing verified admin, HHA secret and approved operational-data setup. Configure the owner workspace office ID, IANA timezone and reviewed reads (`SearchVisitsV2`, `GetVisitInfoV3`, `GetPatientDemographics`, and `GetCallDashBoardData` only when call review is needed). The patient-demographics join independently checks that visit details belong to the configured office. A changed office or release setting invalidates pending reads before their result can be displayed or used.
2. Independently accept the source's field completeness, timezone/offsets, clock evidence semantics, service-time basis, schedule types and freshness. Provision a protected `revisionSourceAcceptance_office_<officeId>/owner` document from a trusted server operator. This document has no dashboard write route. It must include a version, review reference, expiry and the `SourceContract` shape from `functions/src/revisions/policy.ts`. Set `PRIMETIME_REVISION_SOURCE_APPROVED` only after the evidence supports those assertions. GPS/location observation, payer eligibility and HHA verification are still unknown unless a separate accepted evidence adapter supplies them. An address/reference catalog does not prove those facts. Token clocking method must be established by accepted source semantics; it is not guessed from an absent timestamp.
3. Save explicit office monitoring preferences: supervisor recipient references, reviewed token-device submission instructions where applicable, and an SMS policy reference with quiet hours. Leave `earlyReminderMinutes` null until explicitly selected. Review contacts and recipient assignments. The supervisor target is currently measured from first detection, with a 24-hour deadline; the interview did not finalize an alternate anchor.
4. Provision the fixed Google Secret Manager secret `primetime-sms-credentials` in `primetimehomehealthservices`. Its JSON contains `accountSid`, `authToken` and exactly one of `from` or `messagingServiceSid`. Grant the existing runtime service identity access to that specific secret after reviewing the account/provider setup. The backend obtains the secret through its server identity only after all SMS gates agree; a missing SMS secret does not block the default deployment.
5. Review the provider sender, delivery callbacks, consent/opt-out behavior and office policy before setting `PRIMETIME_SMS_CAPABILITY_APPROVED`, `PRIMETIME_SMS_CONFIGURATION_APPROVED` and `PRIMETIME_SMS_SEND_APPROVED`. The callback URL is fixed to `https://pthhs.net/primetime/api/revisions/sms/status`; office/outbox/attempt query parameters are generated by the backend and signed by the provider. Configure the selected sender/service's opt-out handling and keep reviewed contact records synchronized with opt-out events before activation.
6. Set `PRIMETIME_REVISION_MONITOR_APPROVED` and the office `monitoringEnabled` preference only after testing accepted source samples and recipient delivery. Validate detection/receipt latency and coverage against actual office volume. Bounded processing is not evidence that an agency-wide 24-hour delivery target has been met.

The prepare-deploy script deliberately writes all 29 gates false in a fresh CI checkout. An activation release needs a reviewed deployment-parameter change; saving browser preferences does not open the deployment gates. Repeated token-reminder cadence, inbound conversational replies, pre-clock-out confirmation in the future caregiver platform, automatic HHA visit correction and source call-connection writes remain separate vendor/policy-dependent work.

## Verification

Backend tests use fake sources, repositories and delivery adapters. They exercise evidence normalization, unknown states, policy and office changes, future/open visit rules, recurrence, immutable completion review, source-rechecked calls, contact consent, duplicate claims, uncertain delivery, callback signatures, rotating worker windows and grouped-token evidence. Frontend tests cover mode/session/date fencing, zero operational calls in Demo, stale response clearing, paging and noted review actions. Browser verification uses isolated synthetic data. Deployment status and source acceptance are separate outcomes.

The backend release also runs `functions/scripts/verify-revision-monitor-deployment.mjs` using its existing deployment identity. It checks the Scheduler job and deployed function independently: expected minute schedule and office timezone, enabled job, active function, exact invocation target and appropriate OIDC authentication. A missing job fails release verification even if Firebase reports an unchanged function or a successful deployment. The monitor carries the `primetime-component=visit-review-monitor` label so operators can identify it. These infrastructure checks do not approve source evidence or activate caregiver messages.
