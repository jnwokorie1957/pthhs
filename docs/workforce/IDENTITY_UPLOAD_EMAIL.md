# Identity upload notices

When the portal confirms receipt of both the photo ID and Social Security card, it queues a staff email to irab@pthhs.net. A replacement upload of either document queues a fresh notice. Insurance card uploads do not trigger these notices. The upload ID keys the queue entry, which is created in the same transaction as the document receipt.

The message includes a link to the application in the staff portal. Staff must sign in and have current application and document review permissions for the applicant's office. Pending security review files remain unavailable for download. Emails contain no applicant name, Social Security number, document bytes, or sign-in token.

Before opening intake, configure a verified organization mail sender and a Firebase Trigger Email instance (or equivalent mail worker) to watch the server-only workforceIdentityMail collection. Verify Ira's staff account and office scope. Test the alert with synthetic records, confirm successful delivery and the authenticated application link, and monitor failed deliveries. The application can queue notices today. Live mail delivery requires the sender and worker configuration.
