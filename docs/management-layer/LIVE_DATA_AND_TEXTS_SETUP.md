# Enable live HHA data and caregiver texts

Prepared 2026-10-14 for the existing Primetime workspace. This is the owner/operator setup record; it is not evidence that live data or texting has been enabled. Keep completed forms, source samples, phone rosters and credentials in the protected agency system. The public repository contains only this empty checklist.

## What the owner needs to provide

1. **HHA office selection, if needed:** the operator will discover accessible offices through `GetOfficesV2`. If it returns multiple offices, choose the first office to enable and confirm that its timezone is `America/Chicago` or the correct alternative. An HHA integration contact is needed only if an office-specific read is denied or field semantics require vendor clarification. The existing HHA credentials do not need to be supplied again.
2. **A small source-review set:** agency-approved test cases covering a normal visit, an open visit, a missing punch, an early ending, an over-schedule visit, a token-device visit, an overnight visit and overlapping visits. An authorized HHA reviewer must compare what HHA shows with what the API actually returns. Supply the review reference privately; keep identifiable source exports out of Git.
3. **Business texting setup:** create or select an agency-owned Twilio account, complete billing/account verification, choose a dedicated SMS-capable business sender, and complete the registration for that sender route. The owner has said that business texting still needs to be set up. A personal contact phone number does not automatically become the business sender.
4. **Approved recipients:** a small pilot caregiver roster containing HHA caregiver IDs, reviewed mobile numbers, first names and consent references, plus the supervisors who should receive office alerts. Select which supervisor contacts belong to the office. Ordinary ten-digit US numbers are normalized to `+1`; do not duplicate the roster in the public repository.
5. **Office messaging decisions:** quiet hours in the office timezone, the office contact/help process, reviewed token-device submission instructions and their reference, and an owner responsible for responding to failed or uncertain deliveries. The early-ending threshold remains unset until the owner chooses one; this does not prevent the other rules from being piloted.
6. **Pilot scope and acceptance:** choose the initial office and consented pilot recipients, an office reviewer and the approved time to test delivery. Confirm the program/service rules and any permitted overlap arrangements. This is separate from authorizing an agency-wide release.

The owner does not need to rediscover the API URL, create another Firebase project or database, replace the existing administrator sign-in, repeat the Scheduler-role approval or resubmit the HHA credentials. The authenticated owner health check has already reached the HHA reference API and passed `GetCollectionStatus`; Firestore storage health is also working. Office discovery and scoped operational reads follow through the existing server connection. A successful reference read does not by itself validate visit fields, authorization units, location or current payer eligibility.

## Existing technical setup

| Item | Existing value or implementation |
| --- | --- |
| Firebase project | `primetimehomehealthservices` |
| Dashboard | `https://pthhs.net/primetime#revisions` |
| HHA SOAP endpoint | `https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx` |
| HHA credentials | Google Secret Manager `HHAEXCHANGE_CREDENTIALS`, JSON keys `appName`, `appSecret`, `appKey` |
| Verified HHA connection | Authenticated owner health check: reference API reachable; `GetCollectionStatus` passed |
| Firestore database | `(default)`, `STANDARD`, `FIRESTORE_NATIVE`, `us-central1`; created `2026-10-14T23:54:54.991783Z` |
| Firestore client rules | Deny every direct browser read/write; Firebase CLI `15.30.0` compiled and released the rules |
| Approved deployment identity | Existing Firebase deployment account; limited Scheduler get/create/update role already applied |
| Rules deployment recovery | `primetimeRulesValidator` created and bound to the existing CI account; adds only Rules validation; publication remains a separate operator action |
| Monitor | Deployed one-minute scheduled worker; operational release and office preferences still control its work |
| Source acceptance | Protected server-managed `revisionSourceAcceptance_office_<officeId>/owner` document; no dashboard write route |
| SMS credentials | Fixed Google Secret Manager secret `primetime-sms-credentials`; no secret submitted by the browser |
| SMS delivery receipt callback | `https://pthhs.net/primetime/api/revisions/sms/status` |

Source facts, source acceptance, office preferences and deployment release parameters are different controls. A browser preference cannot approve the source or enable an HHA mutation. Demo uses synthetic data and never silently substitutes those rows into Live.

After the Firestore rules release, an anonymous document GET and collection LIST each returned HTTP 403. These checks confirm the tested unauthenticated paths are denied; they are not a formal penetration test. The server uses the Admin SDK through IAM, while browser access continues through the authenticated Primetime API. Database provisioning does not enable HHA source acceptance or caregiver texts.

An earlier CI rules step reached Firestore metadata but failed its Rules compilation request with HTTP 403. IAM readback confirms that the CI account already has the Firebase Admin SDK service role with the needed current-release and ruleset read/write operations. Owner-authenticated Cloud Shell successfully created and bound the project-scoped `primetimeRulesValidator` role, adding only `firebaserules.rulesets.test`; its definition is saved in [primetime-rules-validator-role.json](primetime-rules-validator-role.json). It adds validation alone, with no new publication, release creation, deletion, document, IAM or secret-access permission. The default Rules release already exists; an unexpected absent release must fail instead of causing an automatic broader grant. The missing compile operation matches the pinned [Firebase CLI 15.30.0 deploy path](https://raw.githubusercontent.com/firebase/firebase-tools/v15.30.0/src/rulesDeploy.ts), and Google marks it as [supported in custom roles](https://docs.cloud.google.com/iam/docs/custom-roles-permissions-support). Creation and binding success fix the identified missing capability; they do not by themselves prove an execution using that account.

Current `main` keeps Rules compilation/publication in a separate operator process. The standard Functions/Hosting workflow does not publish Rules, so its successful rerun must not be described as validation of Rules publication. The owner-deployed deny-all policy and its anonymous HTTP 403 checks are the separate evidence recorded above. For later Rules changes, follow [Firestore setup](FIRESTORE_SETUP.md) and verify the operator deployment directly.

## Start business texting from zero

The existing delivery adapter supports Twilio Programmable Messaging. A different provider needs another adapter and acceptance tests.

1. Open the agency's [Twilio Console](https://console.twilio.com/). Create or select an account controlled by the agency. An authorized account owner completes account verification, billing and spending controls. Production is not based on trial entitlements; see Twilio's [account upgrade instructions](https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account) and [current trial limitations](https://www.twilio.com/docs/usage/trials).
2. Choose an SMS-capable dedicated business number and associate it with a Messaging Service. Purchasing a sender, opening billing or submitting registration has not been performed by this repository change. The owner selects and authorizes those paid/account actions in Twilio.
3. For a US local ten-digit sender, register the business/brand and the appropriate A2P 10DLC campaign, then associate the sender with that campaign. This is Twilio/carrier sender onboarding, not a Texas EVV statute. Use the [official A2P overview](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc) and [business-information checklist](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info).
4. If choosing a toll-free sender instead, complete the separate verification process and wait for approval. Pending or unverified toll-free senders cannot be used for production US/Canada delivery. See [toll-free console onboarding](https://www.twilio.com/docs/messaging/compliance/toll-free/console-onboarding) and [Twilio's verification restrictions](https://help.twilio.com/hc/en-us/articles/20212966914075-Toll-Free-Verification-and-Developers-Navigating-the-New-Restrictions).
5. Prepare the business's legal name, business/tax registration details as applicable, address, website, authorized business contact, messaging purpose, expected volume, sample messages and evidence of how recipients opt in. Submit sensitive business identifiers directly to the provider. For new toll-free submissions, Twilio's requirements effective September 15, 2026 include separate Privacy Policy and Terms URL fields; see its [current required-information guide](https://help.twilio.com/hc/en-us/articles/13264118705051-Required-Information-for-Toll-Free-Verification).
6. Approve the opt-in description, sender identity, STOP/HELP handling, support contact and record-retention process. Twilio requires consent evidence, sender identification and an accessible opt-out. These are provider requirements; this document does not infer that employment alone supplies consent. See [Twilio Messaging Policy](https://www.twilio.com/en-us/legal/messaging-policy).
7. Give the trusted project operator the non-secret sender selection and registration status. Store provider credentials directly in the fixed Google secret using the schema below. Do not paste the Auth Token into chat, a GitHub issue, a committed `.env` file or the contact form.

The operator must review the Messaging Service configuration before enabling Advanced Opt-Out. Twilio forwards `OptOutType` on the configured inbound message webhook, and has already sent the keyword reply when that field is present. Delivery status callbacks are a separate flow. Primetime must synchronize opt-outs before broad sending; setting a status callback alone does not do that. Configure only a supported, deployed and signature-validated inbound endpoint; do not point an inbound webhook at the receipt endpoint. See [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out) and [incoming webhook behavior](https://www.twilio.com/docs/messaging/guides/webhook-request).

## Protected operator configuration

### Workspace and source review

Save `workspaceSettings/owner` through the existing authenticated owner settings workflow with:

| Field | Required agency input |
| --- | --- |
| `officeId` | Approved numeric HHA Office ID |
| `officeTimezone` | Reviewed IANA timezone, normally `America/Chicago` for this office |
| `enabledReads` | Explicitly reviewed operations for the selected workflow; diagnosis starts with `SearchVisitsV2`, `GetVisitInfoV3`, `GetPatientDemographics` |
| `policyReference` | Private review/change reference authorizing these scoped reads |

Add `GetCallDashBoardData` only for call review and supply the vendor-supported explicit call-dashboard boundary. Accepted member-context review adds `GetScheduleInfo`, `GetPatientContracts`, `SearchPatientAuthorizations` and `GetPatientAuthorizationInfo`; `GetPatientDemographics` is already required for the office join. No wildcard or unrestricted HHA access is needed.

Provision the protected source-acceptance document using the current `SourceContract` interface in `functions/src/revisions/policy.ts`. The operator records the version, office, review reference, expiry and freshness bound. The agency reviewer must establish timestamp offsets, complete field semantics, actual-versus-EVV duration basis, what missing EVV means, open-visit interpretation, attempt evidence, fixed/variable visit type values and any genuinely supported token-method mapping. Do not turn every boolean on to make the screen green. Missing, ambiguous, stale or unaccepted evidence stays unknown.

Optional HHA verification receipt acceptance is bound to the parent contract's version and a separate review reference. An accepted receipt does not establish authorization, payer eligibility, location compliance or permitted overlap. Reference addresses and eligibility recorded in HHA must not be presented as live GPS evidence or current payer confirmation.

The optional protected `memberContext` acceptance profile has these fields:

```text
accepted
version
sourceVersion                 (must equal the parent SourceContract version)
reviewReference
scheduleOperation             = GetScheduleInfo
billTo                        = primary | secondary
calendarDateEncoding          = iso_date_or_midnight
dateBounds                    = inclusive
authorizationListComplete
contractListComplete
```

An authorized reviewer must confirm that the standard schedule read is keyed to the visit, which bill-to leg applies, and that the returned member/office/service/contract identifiers and date fields mean what the adapter expects. Only accept list completeness when supported by vendor evidence. Null date bounds stay unknown. With the member-context profile configured and its optional reads enabled, a page selects at most two visits. Each visit gets at most seven additional SOAP reads, including no more than three authorization details, within the remaining dispatch-start budget. Truncation or deferred details cannot establish a missing authorization. Matched service periods leave units/limits unvalidated and do not make overall authorization approved. HHA-recorded coverage dates remain distinct from payer-confirmed eligibility. An absent profile or disabled optional reads preserves the basic visit view without the additional member-context calls.

Complete overlap coverage needs a separate reviewed source-duration/date profile and complete fresh discovery/details for the prior, selected and next service dates. The reviewer must establish that the service date means the office-local interval start date and that the accepted maximum visit duration is covered by those dates. Truncation, budget deferral or missing/stale/unaccepted detail leaves the coverage unknown. Observed overlaps can still be reviewed without complete coverage; a missing observed overlap is not proof of no conflict. Permitted overlapping services need their own exact-pair/program/authorization policy evidence. Do not mark a generic overlap as unlawful or automatically allowed from a schedule match.

The optional protected `overlapCoverage` profile contains `officeId`, `timezone`, `sourceAcceptanceVersion` equal to the parent version, `reference`, `validUntil`, `maxVisitDurationMinutes` from 1 through 1440, `serviceDateSemantics: "service_interval_start_office_date"` and `adjacentDatesCoverMaximumDuration: true`. The shared three-date scan runs only with a valid, unexpired profile matching the current office, timezone and parent source version. Without it, current-page positive observations remain available while overall coverage stays unknown; no extra three-date scan is started. A profile cannot establish that an unseen source interval respects its promised maximum; the agency must supply the supporting vendor review and revalidate it when source behavior changes.

Each bounded overlap pass permits at most three discovery reads and two detail reads, progressing through a shared cache for the prior, selected and next dates. At most 20 peer candidates are evaluated for one visit; more than 20 candidates prevents a complete-coverage conclusion. The cache holds at most 600 compact observations with a 750,000-byte JSON guard. The synthetic maximum-size fixture measured 422,849 JSON bytes; that measurement does not prove coverage or performance for a real office. Stale, changed, truncated or incomplete source windows remain visibly incomplete.

Optional `overlapAllowances` records are exact reviewed pair decisions with `officeId`, `visitId`, `visitDate`, `sourceRevision`, `relatedVisitId`, `relatedDate`, `relatedSourceRevision`, `decision: "allowed" | "conflict"`, `reference`, `reviewedBy`, `reviewedAt` and `validUntil`. Both current source hashes and pair dates must match. A changed source or expired decision returns allowance to unknown. There is no generic rule that every two-caregiver visit is prohibited or permitted.

### Reviewed contacts and office preferences

Save each caregiver through `/primetime/api/revisions/contacts` with its HHA identity in `id: caregiver_<HhaCaregiverId>`. Required fields are `revision`, `kind`, `phone`, `firstName`, `smsAllowed`, `optedOut` and `reviewReference`. A supervisor uses a stable scoped recipient reference and `kind: supervisor`. Contact review is time limited; the default delivery check rejects a contact whose review is older than 30 days. Review permissions and reassignment again when a number or caregiver assignment changes.

Save these policy fields through `/primetime/api/revisions/policy`:

| Field | Initial value or decision |
| --- | --- |
| `monitoringEnabled` | `false` until the scoped source review and pilot plan are ready |
| `earlyReminderMinutes` | `null`; no exact early-ending threshold was approved in the interview |
| `quietHours` | Reviewed `{startHour,endHour}`, integers 0–23 with different values, in office timezone |
| `smsPolicyReference` | Private approved messaging-policy reference |
| `supervisorRecipientRefs` | Exact reviewed supervisor contacts for this office |
| `tokenInstructions` | At most 250 characters of actual supported submission instructions, or `null` |
| `tokenInstructionsReference` | Vendor/agency review reference whenever token instructions are present |

No device call-in number or token process is invented. The office must provide the actual approved procedure. Early-ending texts, if later enabled, follow a recorded HHA event; SMS cannot intercept an HHA clock-out or require the worker to remain on shift.

### Provider secret

Store one JSON object as a version of `projects/primetimehomehealthservices/secrets/primetime-sms-credentials`:

```json
{
  "accountSid": "AC<provider-account-id>",
  "authToken": "<provider-auth-token>",
  "messagingServiceSid": "MG<approved-messaging-service-id>"
}
```

The adapter also permits `from: "+1<approved-business-sender>"` instead of `messagingServiceSid`; exactly one is allowed. The account Auth Token is used for the implemented REST authentication and webhook signature checks. An API key is not a drop-in replacement for this schema. Grant the deployed runtime identity access to this specific secret only through an authorized operator change; the prior Scheduler approval does not grant secret access. The default deployment does not read this SMS secret or send a test message.

Delivery callback URLs include backend-generated office/outbox/attempt query values. The adapter supplies them per message. Validate their fixed external URL, account and signature; do not replace them with an arbitrary host or treat an unsigned provider-like body as a receipt. Provider acceptance, confirmed delivery and office acknowledgement remain separate states. See [Twilio outbound delivery tracking](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status).

## Release sequence and stop controls

There are 29 deployment approval parameters with closed defaults. Only the following six are relevant to this read-and-reminder rollout; the other 23 mutation parameters remain `false`.

| Parameter | Earliest reviewed stage |
| --- | --- |
| `PRIMETIME_OPERATIONAL_DATA_APPROVED` | Scoped operational read-only pilot |
| `PRIMETIME_REVISION_SOURCE_APPROVED` | Accepted, current source evidence may support diagnosis |
| `PRIMETIME_REVISION_MONITOR_APPROVED` | Accepted source monitoring, separately from real text delivery |
| `PRIMETIME_SMS_CAPABILITY_APPROVED` | Messaging implementation and recipient controls accepted |
| `PRIMETIME_SMS_CONFIGURATION_APPROVED` | Provider sender, secret access, callbacks, opt-outs and policy reviewed |
| `PRIMETIME_SMS_SEND_APPROVED` | Explicitly authorized real-message pilot/release |

The checked-in `functions/deployment-approvals.json` is the reviewed release configuration. Its strict version-1 schema contains exactly `version`, `reviewReference` and `approvals`; `approvals` contains exactly the six boolean parameters above. This integration release keeps every value `false` and `reviewReference` empty. A separately reviewed owner read-only activation may enable only `PRIMETIME_OPERATIONAL_DATA_APPROVED` while leaving source acceptance, monitoring and all SMS gates closed. Any enabled value requires a bounded nonempty review reference. The preparer preserves the checked-in approved stage instead of silently resetting it; inspect the current file and deployment status when assessing a later release.

`functions/scripts/prepare-deploy-env.mjs` reads that file explicitly and creates the deployment environment file only when it does not already exist. It validates the fixed HHA endpoint and all 29 closed parameter defaults. Operational data is required by every later stage; accepted source is required by monitor and SMS capability/configuration/send; SMS configuration requires capability; SMS send requires all five other relevant flags. Unknown keys, missing keys, string `"true"` values, inconsistent dependencies and unreviewed enabled stages fail preparation. The other 23 HHA mutation parameters are always emitted `false`. The script prints counts without printing credentials or the review reference. Editing the deployed console once, changing a browser preference or setting the Demo/Live switch cannot substitute for the reviewed release file.

1. **Read-only pilot:** retain the working HHA connection and Firestore database. Discover offices with `GetOfficesV2`; ask the owner to select an office only if needed. Configure its timezone and narrow read allowlist, then approve operational reads through a reviewed release. Keep source acceptance, monitor and every SMS gate closed. Compare scoped source records to the HHA screen and confirm that unknown facts remain visibly unknown.
2. **Accepted diagnosis:** record protected source acceptance and any separately reviewed adapter profiles. Test the normal, missing/open, token, early-ending, overage and overnight cases. Compare bounded overlap coverage and allowed-overlap policy with known office examples. Source acceptance does not authorize HHA correction writes.
3. **Monitor without SMS:** enable only the approved monitor stage and office preference. Check checkpoint progress, quota deferrals, selected office/date coverage and the actual time from source event to detection. A one-minute Scheduler invocation does not promise detection of every agency visit within one minute.
4. **Text pilot:** finish provider onboarding, consented contact mapping, opt-out synchronization and failure handling. Restrict the reviewed recipient roster to the selected pilot. Authorize the real test messages and final SMS send gate in a specific release; check provider receipts, STOP behavior, quiet hours, duplicates and uncertain outcomes. The current worker does not supply a separate arbitrary phone-number test-send endpoint.
5. **Expand deliberately:** document observed office volume, overnight/cross-page coverage and delivery latency before expanding the contact roster. Supervisor delivery is currently targeted within 24 hours of first detection; acceptance must measure detection delay too. Do not claim a whole-agency deadline from one successful test.

To stop outgoing texts, close `PRIMETIME_SMS_SEND_APPROVED` in the reviewed deployment configuration. `monitoringEnabled: false` stops office monitoring/dispatch through the existing office preference. Opting a contact out suppresses that contact, and provider STOP controls also apply. These controls do not erase historical receipts or prove the outcome of an uncertain attempt. Reconcile existing attempts before any resend.

## Empty owner handoff

Share ordinary setup answers in chat if convenient; keep source samples, recipient rosters and sensitive business identifiers in the agency's protected system. The existing HHA credentials are already connected. New Twilio credentials go directly into the fixed Google secret.

```text
Initial HHA office selection (only if discovery returns several):
Office timezone:
HHA integration contact (only if office access or field clarification is needed):
Source-review location/reference and agency reviewer:
Programs/services and known allowed-overlap policy reference:

Twilio agency account created: yes/no
Dedicated sender route: US local 10DLC / toll-free
Provider registration: not started / pending / approved
Business site, Privacy Policy and Terms ready: yes/no
Provider credentials stored in fixed Google secret: yes/no

Pilot caregiver roster reference:
Pilot supervisor contact references:
Consent evidence reference:
Office quiet hours and help process:
Actual token-device submission instructions reference:
Pilot reviewer and proposed test window:
```

Purchasing a phone number, opening billing, submitting business registration and granting secret access are concrete account actions for an authorized owner/operator. The real-message pilot gets a specific reviewed release. Supported integration development continues on `main` while those external inputs are being prepared.
