# Primetime visit review: staff quick start

Open [the Primetime workspace](https://pthhs.net/primetime) and sign in using the email link sent to your approved administrator email address. Select **Visit review** in the navigation.

## Review a visit in three steps

1. Choose the service date, then select a visit. Search by the displayed member, caregiver or visit reference; use the issue filter to focus the list.
2. Compare the scheduled time with the recorded clock-in, clock-out and worked time. Read **What needs attention** and the suggested next action. Expand source details only when you need the original evidence.
3. Add a factual note and save the appropriate office follow-up. Acknowledge an item, start its review, resolve it after checking the evidence, or reopen it when further work is needed.

On a phone, selecting **Review details** takes you directly to the chosen visit. Use **Back to visits** to return to the list.

## Understand the visit status

- A missing clock-in and clock-out, or no accepted attempt, blocks verification and needs evidence review.
- An open visit fifteen minutes beyond its scheduled end can need a caregiver reminder and office follow-up. Recorded excess time and observed overlap also need review.
- Early ending is allowed. Keep a factual note and review the applicable reason code; shorter time alone does not notify the supervisor.
- An unavailable source or an unaccepted field means **unknown**. Check the source before treating it as a missing punch or a compliance finding.

The status text and next action explain the issue alongside its color. Resolving an office follow-up records the office's decision; source verification and source corrections require their own approved workflow.

The collapsed **HHA verification receipt** shows the source reviewer and date when available. A receipt can be recorded while other checks remain unresolved; it does not make every part of the visit approved.

When approved source context is enabled, **Authorization and coverage dates** shows the matching service and date periods. Recorded coverage dates still need payer confirmation; matching dates do not approve authorization limits. **Related-visit coverage** shows how much of the surrounding three-day window has been checked, including visits on other pages and across midnight. Partial coverage does not establish that no other overlaps exist.

## Use Demo and Live

**Demo** provides clearly labeled sample visits for learning the workflow. It cannot change operational records or send reminders. **Live** clears the sample data and uses approved office-scoped source reads. If a source is unavailable or still awaiting approval, the screen explains that condition and leaves the real-data panel empty.

Changing mode or date clears the previous results. Lists are bounded; load the next page to inspect more records. A page is not a complete agency report.

If a source page takes too long, wait about a minute and select **Retry visits**. This retries the same page. Deferred visits are kept for another read.

## Keep required visits and reminders organized

Open **Supervisory visits & caregiver orientation** in **Visit review**. For continuing care with the same caregiver, create a supervisory requirement. New supervisory requirements start at six calendar months from accepted completion. Pick a different cadence or the original due-date schedule if the program rule requires it. Use **Assign or update follow-up** to bring a visit forward for service resumption or a performance concern. The planned appointment date and the deadline are recorded separately.

Create a one-time caregiver orientation when services begin or the caregiver changes. From a supervisory record, **Plan new caregiver orientation** carries over the member’s existing program, ZIP code and office assignment. Confirm the new caregiver and due date before saving.

Enter the assigned office staff member, member ZIP code, planned date and next action. The workspace groups the queue by ZIP code and approximate direction from the Houston office. Filter by assignee, planned date or due status. Submit signed paperwork as a PDF, JPG, PNG or WebP. The original and the reviewer’s copy are encrypted and linked to the requirement. A reviewer can preview the scan while it is pending and accept or reject it. Accepted evidence advances the next due date using the configured recurrence.

For the field director’s route, select visits for the day and open **Plan the field director’s Google Maps route**. The planner groups the selected visits into up to nine ZIP stops and uses Google Routes traffic estimates when available. It prioritizes driving time and uses distance to break ties. Directions start and end at the Houston office. Open the provided Google Maps links in order if the route spans several parts. The planner sends the office’s public address and ZIP codes to Google. Use the member’s address and appointment time inside the agency workflow when confirming each local stop.

Choose **Try a sample field route** to see the office and two Houston libraries on a Google road map. On a generated route, use the up and down arrows to move any visit, including an admission or another visit in the same ZIP. The office remains the departure and return point. The preview and navigation links immediately follow the edited order. **Undo changes** returns to the last saved order. **Save revised route** records the order and recalculates its driving and internal fuel estimates when Google traffic data is available.

For an admission, enter its ZIP and choose **Find optional supervisory visits**. Suggestions cover overdue supervisory visits and those due within 30 days of the selected date. The same ZIP appears first, followed by ZIP centers within five miles. Check available visits to include them. The admission is the first ZIP stop. Select the planned date before searching to exclude appointments already planned for another date.

The office route record retains the route, mileage, AAA price and date, and the estimated fuel cost at 28 MPG when those values are available. Staff see the stop order, driving time and mileage.

The reminder list distinguishes queued, provider-accepted, delivered, unknown and failed messages. Office acknowledgement is a separate action. Unknown delivery is investigated before another message is attempted.

**Office review needed** explains failed or uncertain delivery and a missed supervisor delivery target. Read the next action, check the existing attempt and record the office follow-up. Acknowledgement records your response; it does not turn an unconfirmed message into a delivered one.

## What must be configured before automation starts

Automatic monitoring and SMS stay disabled until the source evidence, office preferences, reviewed contacts and delivery provider are approved. The early-ending reminder threshold is still unset. Token reminders require reviewed submission instructions and accepted device evidence. Scheduling a worker alone does not activate reminders.

Current texts are follow-ups to recorded events. Interactive confirmation before clock-out belongs to the future caregiver platform. Location, eligibility, authorization and source verification remain unknown where an accepted data adapter is not available.

For the detailed endpoints, storage contracts and activation checklist, see [Revision backend and rollout](REVISION_BACKEND_IMPLEMENTATION.md). The interview decisions are preserved in [the dashboard revision specification](PRIMETIME_ADMIN_DASHBOARD_REVISION_SPEC.md).

The exact business-texting and live-data setup requirements are in [Live data and texts setup](LIVE_DATA_AND_TEXTS_SETUP.md).
