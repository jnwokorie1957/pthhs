# Primetime Admin Dashboard Revision Specification

Primetime Home Health Services Inc

October 10, 2026 | Version 1.0 | For the owner, office supervisors and implementation team

### Purpose

We want visit verification to take fewer steps. The dashboard should show the evidence needed to understand a visit, diagnose what is wrong, explain how to resolve it, and automatically send the appropriate caregiver reminder. This specification defines the interview decisions, proposed implementation, source dependencies and acceptance criteria.

The first release centers on visit review and text reminders. A future Primetime caregiver platform will provide the interactive confirmation before an early clock-out. Automated HHA corrections and verification remain dependent on validated vendor contracts and approved write access.

### Confirmed operating decisions

| Area | Decision |
| --- | --- |
| Visit review | Show scheduled times and hours, recorded clock-in and clock-out, and location evidence together. |
| Status | Green means verified correctly. Red means a diagnosed issue that needs attention. |
| Missing punches | No clock-in and no clock-out, or no clocking attempt, blocks verification. |
| Late clock-out | Flag a visit fifteen minutes after its scheduled end when it still appears open. |
| Office alerts | Notify office supervisors about over-hours and overlap issues within twenty-four hours. |
| Early ending | Allow early clock-out. Create an automatic note and retain an applicable reason code. |
| Early ending alerts | Send the reminder only to the caregiver; do not alert the office solely for short hours. |
| Caregiver channel | Use automatic, friendly text messages now. Add an interactive caregiver platform later. |
| Token follow-up | Identify missing token-entry days and remind the caregiver to submit the device codes. |

The exact early clock-out threshold remains open by choice. Five to ten minutes early was described as acceptable; more than roughly thirty minutes was described as needing a prompt. These examples are not a finalized executable rule.

## 1 Dashboard layout and visit review

The primary view should be a visit-verification work queue. Keep the agency branding and simplify the HHA visit-information workflow so the office can review one visit without moving between several screens. The arrangement below is proposed; the interview established the information and actions rather than exact typography or dimensions.

### Work queue

- Place the selected office, local service date, Demo or Live mode, source freshness and refresh action above the queue.

- Provide filters for unresolved issues, verified visits, missing punches, extended visits, overlap review, authorization, eligibility and location evidence. Search by permitted member, caregiver or visit reference.

- Each row shows member and caregiver, scheduled start and end, expected duration, recorded start and end, duration variance, issue summary and verification state. Show unknown fields as unavailable, with their cause.

- Use status text and an icon alongside color. Green belongs to a validated verified state. Red belongs to an unresolved issue. Use a neutral or amber treatment for pending review and unavailable or unvalidated evidence.

- Keep the selected visit and filters stable while reviewing. Display several simultaneous issues rather than hiding all but the first.

### Visit detail panel

| Panel area | Required contents |
| --- | --- |
| Identity and scope | Visit ID, member, caregiver, office, service date, program and payer when available. |
| Schedule and times | Schedule type, expected start/end/duration; separate recorded actual, EVV and bill-time fields. |
| Location | Member address, available delivery-location evidence, and the source of that evidence. GPS remains unavailable until a valid read source exists. |
| Diagnosis | Plain-language cause, facts supporting it, missing evidence, confidence or unknown state, and the specific next action. |
| Resolution | Applicable reason-code options, suggested note, call-matching evidence, responsible person and follow-up history. |
| Provenance | Source operation or adapter, fetched time, source revision, completeness and validation state. |

### Review sequence

Select a visit, examine the diagnosis and original evidence, choose the permitted resolution, review the proposed note and reason code, and submit only through an enabled, validated workflow. Show the submission result and readback separately. Resolving a local investigation or sending a reminder does not establish that HHA verified the visit.

## 2 Diagnosis and resolution rules

Use explicit rules over validated evidence. An explanatory assistant may summarize the findings, but it must not invent timestamps, location evidence, eligibility, reason codes or completed source-system actions. Evaluate every relevant rule and attach its evidence to the visit.

| Condition | Expected behavior |
| --- | --- |
| No punches or attempt | Block verification as requested. Identify both missing events, check source freshness, and offer token follow-up or evidence-based manual review. |
| One punch missing | Show which event is missing and request supporting evidence. The exact blocking rule needs confirmation; do not synthesize the other timestamp. |
| Still open after end | At the confirmed fifteen-minute threshold, flag the missing clock-out after checking for delayed source data. Send the caregiver reminder and create the office follow-up. |
| Recorded extended visit | Compare recorded duration and schedule using the validated time model. Show excess minutes and any conflict; preserve actual work times. |
| Early end | Permit the actual early ending. Record a note and applicable reason-code proposal. Send a caregiver-only text when the eventual threshold applies. |
| Variable schedule | Recognize a valid shifted start/end separately from a shorter or longer duration. Require the source schedule type and applicable program rules. |
| Potential overlap | Show both visits, interval intersection, member/caregiver relationships and authorizations. Distinguish allowed overlaps from conflicts requiring review. |
| Authorization or eligibility | Show the applicable service dates and source state. Missing, expired and unavailable evidence are different diagnoses; blocking policy remains to be approved. |
| Location issue | Show the observed delivery location against the expected location when evidence exists. Missing GPS is unavailable evidence, not proof of being away from the home. |
| Repeated missing days | List the affected service dates, missing event types and distinct day count. Use the caregiver clocking method to select the appropriate reminder. |

Suggested next actions should name a task, such as submit device codes, review a conflicting visit, correct an authorization, or select a reason code. Any correction proposal must preserve the original source facts and identify the authority for the change.

## 3 Hours calculations and time boundaries

The dashboard needs a validated time model before it calculates differences or schedules reminders. Current visit-preview fields are raw source values and are not yet accepted as a basis for operational decisions. Missing, malformed or truncated evidence must produce an unknown result.

| Value | Definition and control |
| --- | --- |
| Scheduled duration | Scheduled end minus scheduled start under the validated office timezone and overnight-shift convention. |
| Actual duration | Recorded service end minus recorded service start. Keep actual and EVV fields separate until their vendor meanings are accepted. |
| Variance | Actual duration minus scheduled duration. Positive indicates longer duration; negative indicates shorter duration. |
| Early minutes | Scheduled end minus actual end, when positive. Keep this distinct from duration variance when the caregiver began at a different time. |
| Open visit overrun | Current time minus scheduled end, only when a fresh source establishes that the visit remains open. |
| Overlap duration | The intersection of two validated service intervals. A shared boundary alone is not an overlap. |
| Missing token days | Count distinct scheduled service dates with the required token entries missing, not the number of missing punches. |
| Bill hours | Use the source billing value or the verified program calculation. Do not replace it with scheduled hours or round each punch independently. |

### Required boundary handling

- Store original source values and normalized instants together, including timezone and offset assumptions. Use the office local date for service-day filters.

- Test overnight visits and daylight-saving transitions explicitly. Do not infer the next day from a time-only string without the vendor schedule convention.

- Evaluate the late threshold when the elapsed overrun is at least fifteen minutes. Test immediately before, exactly at and immediately after that boundary.

- Measure office notification performance against the twenty-four-hour target. Proposed timing starts at reliable issue detection; the owner must confirm whether the desired deadline instead starts at the source event.

- A suggested downward adjustment concerns bill hours and an approved maintenance workflow. It must never erase or replace the actual recorded service time.

Texas HHSC describes visit-duration rounding and distinguishes actual hours from bill hours. Apply the applicable program and payer requirements rather than treating all extra time as a state-law violation. See the policy references in Section 13.

## 4 Text reminders and supervisor alerts

Automatic text messages are the chosen current caregiver channel. Delivery needs a validated messaging adapter, an approved phone source and a server process that detects issues independently of whether an administrator has the dashboard open. The existing notification planner records planned messages; it does not send them.

### Current early clock-out text

With the captured HHA contract, Primetime can react after a recorded clock-out becomes available. A text can ask whether the early ending was intentional and show the remaining scheduled time. A reply confirms intent for review; it cannot prevent, approve or undo an HHA clock-out. Do not tell the caregiver that a source-system change occurred unless readback proves it.

If the caregiver reports that care is still in progress after the clock-out, give the approved vendor recovery instructions and open a review case. Preserve the original punch. Do not silently reopen the visit or extend a timestamp to fill the scheduled hours.

### Future interactive caregiver platform

When Primetime controls an approved caregiver clocking interface, display the prompt before an early clock-out completes: ask whether the caregiver wants to end now and show the time remaining. Confirming proceeds with the real end event. Declining keeps the active visit visible with its scheduled end. Authorized care completion or a member-requested early departure remains allowed.

### Trigger and recipient matrix

| Event | Caregiver action | Office action |
| --- | --- | --- |
| Open visit at fifteen-minute threshold | Send a friendly missing clock-out text after the freshness check. | Notify office supervisors within twenty-four hours. |
| Early recorded clock-out | Send caregiver-only confirmation or follow-up if the eventual threshold applies. | Create the automatic note and reason-code review; no alert solely for short hours. |
| Missing token entries | State the missing day count and ask for submission using the approved device-code workflow. | Display unresolved dates in the review queue; escalation timing remains open. |
| Potential overlap or extended visit | Give factual guidance when applicable. | Show the reason and affected intervals; notify within twenty-four hours. |

### Delivery controls

- Recheck the visit before sending; suppress reminders for resolved issues.

- Deduplicate by visit, rule, recipient and occurrence. Keep delivery and acknowledgement separate.

- Validate contacts and messaging permission. Normalize U.S. numbers to +1; honor source API formats.

- Configure office-local times, repeat cadence, quiet hours, opt-out and escalation before delivery.

## 5 Proposed message copy and audit evidence

These are proposed templates for the confirmed friendly, non-pushy tone. Bind only validated values. Keep member names, diagnoses and detailed visit information out of ordinary text messages; link to an authenticated screen when details are needed.

### Missing clock-out

Hi {firstName}, this is Primetime. Your visit was scheduled to end at {scheduledEnd}, and we have not received a clock-out. If you have finished, please use your approved clock-out method. If care is still in progress or you need help recording the end, please contact the office. Thank you.

### Early clock-out recorded

Hi {firstName}, we received your clock-out at {actualEnd}. Your scheduled end was {scheduledEnd}, with {remainingMinutes} minutes remaining. Was ending early intentional? If care was complete or the member asked you to leave, that is okay. Please confirm through {approvedReplyMethod}, or contact the office if the record needs review.

The approved reply method may be a supported inbound text response or an authenticated link. Two-way text handling is not currently established. Until that capability is validated, the message should ask the caregiver to contact the office rather than promise that a reply will update HHA.

### Missing token entries

Hi {firstName}, this is a friendly Primetime reminder. We are missing token-device entries for {missingDayCount} visit days. Please submit your recorded device codes using {verifiedVendorInstructions}. If the device did not work or you no longer have the codes, please contact the office so we can review the visits. Thank you.

### Possible extended shift or overlap

Hi {firstName}, your recorded visit appears to extend beyond its scheduled time. Please check your clock-out record. If the extra time was needed for care or approved by the office, contact us so we can review it. Please record the time you actually worked.

### Supervisor alert

Visit review needed: {issueSummary}. Scheduled: {scheduledInterval}. Recorded: {recordedInterval}. Difference: {varianceMinutes} minutes. Related visit: {relatedVisitReference}, when applicable. Evidence checked at {checkedAt}. Suggested next step: {resolutionAction}. Open the secure visit review for details.

### Notification audit record

Persist the visit and office references, rule and version, supporting source revision, detected time, planned send time, notification deadline, recipient reference, template version, delivery state, attempt count and provider receipt. Store acknowledgement and suppression separately. Protect contact details and message history with office-scoped permissions.

Show supervisor delivery failures as actionable dashboard issues. A provider accepting a message is not proof that the caregiver or supervisor received or read it. No actual messages are sent as part of creating this specification.

## 6 Reason codes and Texas policy

Provide the current Texas reason codes alongside the diagnosed issue and a suggested note. A suggested code must be justified by evidence and the applicable service workflow. Do not apply one code to all short, late or overlapping visits.

| Candidate | Relevant handbook description | Use in this revision |
| --- | --- | --- |
| 110 A | Service delivery differs from schedule. | Candidate for a valid schedule difference when a schedule exists; validate the exact visit circumstances. |
| 110 B | Downward adjustment of Bill Hours. | Candidate when billing for less than actual time worked; preserve the recorded actual time. |
| 110 D | Allowable overlapping visits. | Candidate when the program permits the overlap; confirm service, authorization and location. |
| 210 I or 600 | Emergency or Other. | The handbook requires free text. Require the applicable explanation and avoid using Other as a universal shortcut. |

The table follows HHSC Policy Handbook Section 10000. Confirm the current full code set, HHA identifiers and tenant permissions before enabling code submission. The proposed automatic note should contain observed facts; a caregiver explanation or exception reason must not be invented. [S1]

### Allowed overlaps require review of the actual program

HHSC Section 7070 describes allowable overlaps, including certain two-caregiver services and one caregiver serving members who share a home. Some overlaps auto-verify; others require maintenance. Flag a potential conflict, check the applicable authorization and program, and explain the result. Do not send a blanket claim that Texas prohibits every overlap. [S2]

### Actual hours and bill hours

HHSC Section 8000 distinguishes recorded service time from bill hours and describes duration rounding and permitted downward adjustments. A reminder must not encourage recording unworked hours. Any bill-hour adjustment needs its approved reason and preserved source evidence. [S3]

### Token-device timing

HHSC Section 7040 says codes from state-vendor alternative devices expire seven days after the visit and must be entered before expiry using the vendor toll-free number or mobile application. Validate the actual HHA device and instructions before using this deadline in reminders. Do not reuse a generic phone number or promise that Primetime can accept device codes itself. [S2]

### Policy text in caregiver messages

Use a short explanation of the applicable schedule or authorization requirement. Include a verified policy reference only when it applies to the member program, service and event. The interview did not establish a tax-code prohibition on longer shifts. Treat program restrictions, company scheduling expectations and billing rules as separate sources of authority.

## 7 Supervisory visits and orientations

Add a separate tracking view for required supervisory visits and orientations. The interview identified a six-month cadence for required visits. Program-specific obligations, whether orientation repeats, and the correct due-date anchor remain to be confirmed; do not impose a universal six-month legal requirement.

### Required tracking record

| Field | Purpose |
| --- | --- |
| Requirement type | Separate supervisory visit, initial orientation and any recurring orientation. |
| Subject and scope | Member or caregiver reference, office, program, service and assigned supervisor. |
| Policy and cadence | Source of the obligation, effective dates, recurrence period and due-date anchor. |
| Completion evidence | Actual completion date, performer, document reference and review state. |
| Next due date | Calculated from the applicable rule; support documented overrides with a reason. |
| Status | Not configured, upcoming, due, overdue, completed or evidence under review. |
| Follow-up history | Reminder, owner, acknowledgement, reschedule reason and completion audit. |

### Proposed tracking workflow

Configure the requirement for the applicable subject and program. Import source completion evidence when a validated contract supports it, or let an authorized supervisor record completion with its document reference. Calculate and display the next due date, assign the follow-up, and retain the history. Reconcile imported corrections without deleting prior evidence.

The dashboard should show upcoming and overdue obligations by office and assignee. Reminder lead times and escalation recipients remain open. A missing source due date must appear as not configured or unavailable, rather than as compliant.

Existing clinical due settings, training metadata and evaluation catalogs are source candidates, not proof that a supervisory visit or orientation was completed. Build an explicit completion ledger. If six-month recurrence applies, define calendar-month and month-end handling rather than substituting one hundred eighty days.

### Authorization and eligibility beside each visit

Evaluate service-specific authorization and eligibility for the actual service date, including effective and end dates, service code and authorized units when available. Do not substitute generic patient active status or caregiver availability for eligibility. Show missing, expired and source-unavailable evidence separately.

### Unresolved policy decisions

Confirm which programs require supervisory visits, which subjects need orientation, whether recurrence uses the last completed date or a fixed calendar schedule, how rescheduling affects deadlines, and what evidence proves completion. These are configuration and acceptance requirements, not assumptions to hard-code.

## 8 Source integration and API requirements

The source is the HHA Enterprise SOAP service captured in the repository WSDL. Its documented address is https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx. Operations use SOAP actions; they are not individual public REST URLs. Use the backend adapter, server-held credentials and approved operation controls. [R1]

### Current visit preview is a bounded source preview

The local implementation provides GET /primetime/api/data/status and GET /primetime/api/views/visits with a selected office-local date and a maximum of ten details per page. Discovery is capped at two hundred records; completeness is false and totals are null. Values are explicitly unvalidated and unconverted. Deployment and source acceptance are separate milestones.

This preview cannot prove that an agency has no missed punches, overlaps or overdue visits. It lacks per-detail freshness, validated time semantics and several status fields. Do not turn a null field or failed detail request into a missing-punch diagnosis. Build monitoring from accepted source records and complete discovery windows.

| Spec area | Documented source candidates | Required work |
| --- | --- | --- |
| Visit and schedule | SearchVisitsV2; GetVisitInfoV3; GetScheduleInfo; GetLinkedScheduleInfo. | Validate schedule type, source timezone, actual versus EVV semantics, verification state and split/overnight behavior. |
| Recorded calls | GetCallDashBoardData; SearchPhoneNumber. | Project member/caregiver identity, validate call states and preserve ambiguity. A phone match does not prove a visit match. |
| Authorization | SearchPatientAuthorizations; GetPatientAuthorizationInfo. | Join the correct service and period; add omitted limits and validate units. Partial coverage is not an approval. |
| Member eligibility | GetPatientDemographics; GetPatientChangesV2. | Add the relevant Medicaid and managed-care dates. Recorded dates do not establish current payer-verified eligibility. |
| Location | GetPatientAddress; GetLocations. | Postal addresses and label catalogs are available; no captured coordinate-bearing read establishes actual GPS. |
| Change detection | GetVisitChangesV2, V3 or V4. | Validate cursor/checkpoint and completeness. No captured webhook or guaranteed event latency is established. |
| Caregiver messaging | CreateCaregiverNote notification fields; notification-method catalog. | Verify channel values, entitlement, delivery and reply semantics. No production send adapter is established. |

### Call matching

Offer candidate, ambiguous, unmatched, matched and rejected states. Show each candidate call with its recorded time, type, state and identities beside the visit evidence. Preserve the human match decision and an undo history. The call response does not provide a VisitID or actual caller number; backend visit-confirmation writes must not be treated as a documented call-match API.

### HHA writes remain controlled

ConfirmVisits variants and VisitCallInOut do not establish mobile interception. They remain blocked for missing contract guidance in the reviewed code. Reason-code application, call corrections and verification require an approved typed workflow, explicit review where required, and reconciliation after unknown results. [R2]

## 9 Proposed service design and data mode

Separate read ingestion, rule evaluation, notification delivery and source mutation. A saved diagnosis should record the source facts, normalized values, rule version and explanation so a supervisor can reproduce the decision.

### Background monitoring

- Discover all in-scope visits for the relevant service windows, including adjacent dates for overnight and overlapping intervals. Complete and checkpoint accepted pages; retain the last accepted state.

- Normalize time and identity evidence, validate office membership, and apply the reviewed policy version. Recheck current settings before publishing facts or dispatching a message.

- Evaluate rules in a server worker. Create or update a durable exception with detected time, resolution state, assigned office supervisor and supporting evidence.

- Queue eligible reminders with an idempotency key. Revalidate the triggering condition before dispatch, persist delivery receipts, and expose failures and overdue follow-ups.

- Honor the existing shared budget of sixty actual SOAP dispatches per minute. Use accepted change windows and bounded backfill; browser refresh must not be the agency monitoring mechanism.

### Proposed API additions

| Route or resource | Purpose |
| --- | --- |
| Exception list and detail | Read validated diagnoses, evidence, freshness and lifecycle state for the authorized office. |
| Call-match review | Persist candidate decisions, rejection, human confirmation and undo without implying an HHA mutation. |
| Notification history and acknowledgement | Expose planned, dispatched, delivered, failed and acknowledged messages with role-scoped detail. |
| SMS delivery and reply receiver | Accept authenticated provider callbacks; correlate replies without exposing another caregiver or member. |
| Compliance requirements and completions | Track configured recurrence, source evidence, due dates and audited completion. |

These are proposed resources, not existing callable endpoints. Final route names and request schemas belong in the implementation contract. Include explicit complete, partial, stale, failed and unavailable states in every aggregate response.

### Demo and Live behavior

Demo uses coherent synthetic fixtures and sends no source mutations or real messages. Live removes all sample facts immediately, reads only approved sources and shows unavailable states when access or validation is missing. Changing mode, office, account or policy must cancel pending requests and fence stale responses. Returning to Demo must never make a real delivery appear synthetic or reuse live member data.

### Permissions and records

Define office-supervisor, caregiver and notification-management permissions explicitly. Existing collection and scheduling reviewer permissions do not establish the new roles. Store rule exceptions, contact routing, delivery history, reason-code proposals and compliance evidence in protected server records; keep PHI out of public assets and routine logs.

## 10 Delivery plan and release criteria

The phases below are proposed implementation work. They preserve the user instruction to work directly on main without creating branches. Publish changes only after the relevant tests pass and verify Hosting and Functions deployments together.

### Phase one Establish the source and review screen

Finish asset versioning and deployment verification for the shared Demo/Live view. Add the simplified visit queue and detail panel. Validate office scope, timestamp semantics, verification state, source freshness, call identities and complete visit discovery. Confirm the accepted schedule, authorization and location contracts. Keep missing evidence visibly unavailable.

Exit criterion: a representative accepted source set renders correctly, no sample facts remain in Live, a wrong office or stale policy cannot leak records, and all time boundaries are reproducible. GPS diagnosis remains disabled until its source is accepted.

### Phase two Add diagnosis and audit records

Implement the deterministic rules, explain each result, and persist the exception lifecycle. Add call-match candidates with human decisions and undo. Add reviewed reason-code suggestions and automatic factual notes. Implement the server evaluation worker, quota controls and reconciliation checkpoints.

Exit criterion: accepted examples of missing punches, schedule variance, allowed and conflicting overlaps produce the correct evidence and action. Unknown data produces an unknown result. No unapproved HHA writes occur.

### Phase three Enable automatic text follow-up

Validate the delivery provider or HHA notification route, caregiver contacts and permissible message content. Configure templates, retries, deduplication, suppression and office routing. Enable the confirmed fifteen-minute late threshold and twenty-four-hour office delivery objective. Leave the unresolved early threshold unconfigured until an owner decision is recorded.

Exit criterion: a controlled recipient test demonstrates delivery and failure handling, corrected visits suppress queued reminders, Demo sends zero real messages, and supervisor alert timing is measured. A text acknowledgement does not change HHA punches.

### Phase four Add recurring tracking and caregiver interaction

Implement supervisory and orientation requirements after the program rules and completion evidence are accepted. Build the future caregiver clocking screen only with an approved EVV approach. Add the interactive early-end confirmation, remaining-time display and allowed early-departure flow. Enable HHA correction and verification workflows only after their contract guidance, review policy and readback are complete.

Exit criterion: recurrence tests include month ends and leap years, caregiver identity and office boundaries hold, actual times remain intact, and every submitted source change has a verified or explicitly unknown reconciliation state.

### Proposed implementation owners

The owner resolves business thresholds and routing. Office supervisors validate example visits and completion evidence. The backend implementer owns ingestion, rules, quota, messages and audit. The frontend implementer owns the queue and accessible status display. A designated compliance reviewer confirms program-specific rules and wording; this role has not yet been assigned.

## 11 Acceptance criteria

Use synthetic fixtures for automated tests and an accepted, controlled source set for integration validation. The scenarios below are observable release checks; they do not depend on a reviewer reading the code.

### Visit review and data integrity

1. A supervisor can see schedule, expected duration, recorded punches, diagnosis and evidence in one visit review. Color always has an accompanying readable status.

2. Green appears only for an accepted verified state. Local investigation completion, message delivery or a successful read does not turn a visit green.

3. A visit with no recorded clock-in and no clock-out or attempt is blocked. A failed or incomplete read displays unavailable rather than a missed-punch diagnosis.

4. Actual, EVV, scheduled and bill-time values remain separate. Malformed or ambiguous time evidence cannot produce a duration, alert or source correction.

5. A variable schedule that shifts its hours is distinguished from a shorter duration; overnight and daylight-saving examples retain the correct service scope.

6. Both overlapping intervals are visible. A program-authorized overlap is treated differently from a conflict; an adjacent endpoint alone is not an overlap.

7. Authorization and eligibility are evaluated for the correct member, service and date. Missing or stale evidence is not displayed as approved.

8. Absent GPS remains unavailable. A postal address or a coordinate input field on a write operation cannot be presented as recorded visit location.

### Caregiver reminders and office delivery

9. At the configured fifteen-minute late boundary, a fresh open-visit example produces one eligible caregiver reminder and a tracked office follow-up. A new clock-out suppresses a queued reminder.

10. Office supervisors receive the extended-visit or overlap alert within the agreed twenty-four-hour measurement window. Delivery failures are visible and retried under the approved policy.

11. An early-ending visit creates its factual note and reason-code proposal without an office alert solely for shorter hours. The exact caregiver prompt threshold stays visibly unconfigured until decided.

12. A current SMS explains the recorded early ending and asks for confirmation of intent. It never claims to prevent, approve or undo the completed HHA clock-out.

13. Missing token reminders count distinct service dates, use the verified device method and instructions, and avoid duplicate messages for two missing events on one day.

14. Notification status distinguishes provider acceptance, delivery, failure and acknowledgement. An inbound reply cannot alter source punches automatically.

15. Future early-end confirmation permits a legitimate early ending. Declining shows the remaining schedule; confirming records the actual end under the approved clocking method.

### Permissions and release behavior

16. Demo produces no real source actions or messages. Switching to Live synchronously removes every example; stale responses cannot repaint another mode, office or account.

17. A wrong-office identity, changed owner policy or incomplete source window cannot publish a diagnosis or dispatch a message using the old scope.

18. Repeat processing of the same accepted event produces no duplicate notification. The evaluation worker respects the shared SOAP quota and survives partial failure.

19. A source correction retains the original evidence, approved reason and reviewer where required. An unknown submit result enters reconciliation rather than blind resubmission.

20. A recurring obligation shows its configured policy, due-date anchor and completion evidence. Month-end, leap-year and reschedule examples follow the accepted recurrence rule.

21. The production release passes relevant frontend and backend checks, deploys successfully from main, and preserves the administrator sign-in boundary.

## 12 Decisions still open

The interview is complete. These items remain implementation inputs; the user explicitly chose not to finalize the exact early clock-out grace period. Keep them in the decision register rather than silently filling in rules.

| Decision | What remains open |
| --- | --- |
| Early threshold | Exact threshold, equality boundary and handling between roughly ten and thirty minutes early. |
| Alert clock | Whether the office twenty-four-hour deadline starts at the source event or reliable detection; delivery versus acknowledgement target. |
| Repeated reminders | Token-day trigger age, resend interval, maximum attempts, quiet hours, opt-out and escalation. |
| Office routing | Specific supervisor assignments and channels, cover for absence, acknowledgement and failure escalation. |
| Clocking recovery | Approved instructions for missing entries, device failure, delayed upload and continued care after an early recorded clock-out. |
| Reason-code actions | Current code identifiers, when a suggestion may be applied automatically, authorized reviewer and note requirements. |
| Other blockers | Single missing punch, missing authorization, expired eligibility, missing schedule and unresolved location evidence. |
| Overlap rules | Applicable programs and authorizations, acceptable simultaneous care, interval tolerance and reviewer evidence. |
| SMS integration | Delivery provider, approved contact source, inbound replies, sender identity and channel behavior. |
| Supervision and orientation | Programs, subjects, six-month applicability, recurrence anchor, reminder lead times and completion proof. |
| Presentation and metrics | Final navigation, typography, card order, agency totals and other dashboard metrics were not specified in this interview. |

### Implementation priorities

Start with source acceptance and the one-screen visit review, then diagnosis and server monitoring, followed by automatic text delivery. Preserve the closed write controls until the correction and verification contracts are accepted. Add recurring tracking and the interactive caregiver platform in the later phase.

The earlier request for a Demo/Live switch remains part of the broader dashboard work. This interview refines visit verification, reminders and compliance tracking; it does not redefine every sample card or supply new targets for staffing, billing or agency-wide totals.

## 13 Sources and implementation references

Policy sources were checked on October 10, 2026. Review applicable program and payer requirements when configuring production rules. The references below support the distinctions used in this specification, rather than establishing that every candidate workflow is enabled for Primetime.

### Texas HHSC sources

[S1 HHSC EVV Policy Handbook Section 10000 Reason Codes](https://fhb.hhs.texas.gov/handbooks/electronic-visit-verification-policy-handbook/10000-reason-codes)

Supports the candidate reason-code descriptions, appropriate-code selection and free-text requirements.

[S2 HHSC EVV Policy Handbook Section 7000 Clock In and Clock Out Methods](https://fhb.hhs.texas.gov/handbooks/electronic-visit-verification-policy-handbook/7000-clock-clock-out-methods)

Section 7040 describes alternative-device code submission and expiry. Section 7070 describes overlapping visits and program-specific allowable cases.

[S3 HHSC EVV Policy Handbook Section 8000 Calculation of Bill Hours](https://fhb.hhs.texas.gov/handbooks/electronic-visit-verification-policy-handbook/8000-calculation-bill-hours)

Supports the distinction between actual and bill hours, duration rounding, bill-time maintenance and downward adjustment.

### Repository source contracts

[R1 PTHHS captured HHA Enterprise WSDL](https://github.com/jnwokorie1957/pthhs/blob/099666c967db0fc3ca3839fc95ae62dbccf92f4e/hharefs/hha-wdsl.xml)

Defines the shared SOAP address, visit and call operations, mutation inputs and caregiver-note notification fields. A schema does not establish entitlement, live semantics or near-real-time delivery.

[R2 PTHHS HHA contract gates](https://github.com/jnwokorie1957/pthhs/blob/099666c967db0fc3ca3839fc95ae62dbccf92f4e/functions/src/integrations/hhaexchange/contractGates.ts)

Records the blocks on visit confirmation, call writes and unsupported notification workflows requiring additional contract guidance.

[R3 PTHHS operational reads](https://github.com/jnwokorie1957/pthhs/blob/099666c967db0fc3ca3839fc95ae62dbccf92f4e/functions/src/operations/reads.ts)

Defines implemented read filters and projections, bounded discovery, and source-unvalidated results. Additional source fields require reviewed typed projections.

[R4 PTHHS operations workspace](https://github.com/jnwokorie1957/pthhs/blob/099666c967db0fc3ca3839fc95ae62dbccf92f4e/functions/src/operations/workspace.ts)

Provides review workflows and identifies incomplete staffing evidence. The revised local visit view is additional implementation work and is not presented here as a completed production release.

### Local implementation areas for the next work

Frontend: public/primetime/index.html, dashboard.js, demo-data.js, data-source.js, primetime.js and workspace.js. Backend: views/visits.ts, operations/reads.ts, operations/workspace.ts, rules/evv.ts, notifications/planner.ts and integrations/hhaexchange/contractGates.ts. Add a server worker and delivery adapter rather than relying on an open browser.

The implementation team should maintain a rule and decision register, source-acceptance examples, notification templates and reconciliation evidence with the revision. These support a reviewable release without exposing member details in repository fixtures.
