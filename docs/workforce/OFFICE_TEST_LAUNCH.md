# November 11 office testing and January launch

The owner authorized application submissions and encrypted uploads during the existing 12-hour window, with manual deletion for office testing. The homepage and Careers links now say **Caregiver Portal**.

The server closes caregiver access at `2026-11-12T04:16:08.574Z` (November 11, 10:16 p.m. America/Chicago). It reopens at `2027-01-01T06:00:00.000Z` (January 1, midnight Central). The existing deadline was not extended. Staff permissions and access remain unchanged. The window is enforced in the API and does not require a laptop or scheduled reminder to stay running.

## Application emails

The scheduled `workforceApplicationMail` worker runs every five minutes. It uses the existing Google-to-Microsoft workload identity, sends from `jnwokorie@pthhs.net`, and fixes the recipient to `irab@pthhs.net`. No client-supplied destination is accepted. These attachment emails have no CC and do not create a sender-side Sent Items copy.

At application submission, the immutable job includes the completed application, submitted official forms, and the latest upload in each category. Each attachment is named `Last, First - Document.pdf`. The body includes contact details and the recorded health-insurance Accept/Decline election; a decline does not establish other insurance coverage.

Packets are grouped into numbered emails within a 2,000,000-byte raw attachment limit per email. Oversized multi-page PDFs can be flattened and separated into numbered page PDFs. An individual page that still exceeds the limit is held for staff review; it is never silently omitted. Application-level upload limits, exact generation/digest checks, ownership and quarantine checks still apply.

Completing W-4, I-9, Texas New Hire or CCH forms after application submission creates a separate immutable follow-up job. Finalizing a later upload, including direct deposit, creates its own job too. These jobs contain only the new form or upload and repeat the recorded insurance election. They do not resend the application or earlier attachments. A late quarantined upload waits without repeating the initial submission-summary email.

Workers use a lease and persist accepted email-part progress. A dispatch with an uncertain outcome is not automatically retried because it might already have reached the recipient. Staff must review it. A persisted processing cursor prevents held jobs from blocking later submissions indefinitely. Staff can see initial submission delivery status in the document folder; follow-up and individual part details are recorded in the server-only mail collection.

The older identity-link notice queue is separate from the configured application attachment worker. Do not install an unreviewed generic Trigger Email extension on that queue; it also contains verification workflow records.

## PDF screening and storage

`functions/scanner/deployment.json` records the private Cloud Run job and pinned image. Its OAuth-authenticated Cloud Scheduler trigger runs every five minutes. The worker decrypts the exact stored generation in memory, verifies its digest, invokes ClamAV with official definitions, and records the existing clean/rejected verdict. Errors, encrypted PDFs and stale definitions remain quarantined. The definition cache contains antivirus data only. A per-document retry lease prevents overlapping scans.

Uploads retain AES-GCM envelope encryption with the existing KMS key, private storage, server-only database/storage rules, recent verified authentication, staff office scope and email verification for private downloads. No automated deletion or retention expiry was enabled. Administrative deletion during testing must account for related records, versions, encrypted objects, holds and recipient mailbox copies; deleting a portal record alone does not remove an emailed attachment.

## Verification and remaining launch review

The live office test used fictional Jordan Taylor data. It exercised encrypted storage, PDF quarantine/clearance, an initial packet spanning two emails, a separately completed Texas New Hire form, and a later direct-deposit upload through the authenticated live API. Microsoft acceptance is recorded per email; this proves accepted dispatch, not recipient inbox placement. Controlled test authentication does not replace normal signup and mailbox-verification testing by office testers.

The scheduled official-form edition check remains in place. Use final agency releases, not draft or relabeled forms. Review the production retention schedule and final applicable 2027 editions before the January launch; the owner's manual-deletion instruction was specifically for office testing.
