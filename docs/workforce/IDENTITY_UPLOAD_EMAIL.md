# Identity upload notices

When the portal confirms receipt of both the photo ID and Social Security card, it queues a staff email to irab@pthhs.net and copies jnwokorie@pthhs.net. A replacement upload of either document queues a fresh notice. Insurance card uploads do not trigger these notices. The upload ID keys the queue entry, which is created in the same transaction as the document receipt.

The message includes a link to the application in the staff portal. Staff must sign in and have current application and document review permissions for the applicant's office. Pending security review files remain unavailable for download. Emails contain no applicant name, Social Security number, document bytes, or sign-in token.

Before opening intake, configure a verified organization mail sender and a Firebase Trigger Email instance (or equivalent mail worker) to watch the server-only workforceIdentityMail collection. Verify Ira's staff account and office scope. Test the alert with synthetic records, confirm successful delivery and the authenticated application link, and monitor failed deliveries. The application can queue notices today. Live mail delivery requires the sender and worker configuration.

The PDF scanner runner is `functions/scripts/scan-workforce-pdf.mjs`. Run it in an isolated worker with an up-to-date ClamAV installation and private access to the selected Firebase project and storage bucket. Set `GOOGLE_CLOUD_PROJECT`, `WORKFORCE_SCAN_BUCKET`, and `WORKFORCE_CLAMSCAN` (an absolute executable path), then pass the quarantined document ID. The runner checks the stored generation, size and SHA-256 before scanning. Scanner failure leaves the file quarantined. A clean verdict permits normal authorized review, and a rejected verdict blocks downloads. Verify the worker and both verdicts with synthetic files before enabling document collection.

Any 24-hour acceptance test uses synthetic accounts and documents in an isolated environment with a server-enforced expiry. The public intake gates stay closed until the separately approved launch on January 1, 2027.
