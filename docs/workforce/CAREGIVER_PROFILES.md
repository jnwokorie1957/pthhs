# Caregiver profiles and printing

Open Workforce management → Caregiver accounts. Enter a first or last name, then select the matching caregiver. Prefix matching ignores case and accents. Profiles become searchable after the application supplies a name; saved contact information automatically populates the staff view. Matching names remain separate accounts. Searches return at most 25 accessible matches and indicate when to narrow the name.

The profile shows the account email and reset-email action, application contact information, emergency contact, availability, application responses, official form states and the private document folder. Account email can differ from the applicant's contact email. Passwords and password-reset tokens are never exposed to staff. External-provider passwords are recovered with that provider.

## Printing

- **Print complete packet** produces one private PDF: contents list, formal application, saved I-9/W-4/Texas forms, and uploaded identity documents. The contents list identifies drafts, missing records and files unavailable pending security checks. It does not represent employer verification, completed screening, hiring or tax filing.
- **View / print application** creates the clean formal application, based on the owner's supplied layout and current portal fields. The SSN remains masked. Dates, answers, acknowledgments and signatures reflect the saved record; unsigned drafts stay unsigned.
- Each form and available document also has its own **View / print** button. Photo documents are embedded at their stored resolution with their original proportions. No additional JPEG compression is applied during PDF generation. Uploaded PDF files remain unavailable until the existing security-review workflow permits retrieval.

Use the PDF viewer's print control. The combined print copy is static to preserve filled form appearances; the separate source PDFs remain editable. A 20 MB / 24-part / 119-page bound limits combined-export memory. Larger folders can be printed with the individual buttons. A failed file integrity check aborts the export rather than silently omitting an available document.

## Storage and access

Firebase Authentication manages credentials. `workforceApplications` remains the source for application answers; `workforceFormDrafts` holds form revisions; `workforcePrivateDocuments` and the private Storage folder retain controlled file metadata and bytes. The new `workforceCaregiverDirectory` contains only UID, office, first/last name, normalized name prefixes, state and update time. It is updated in the same transaction as each application save/submission. It contains no SSN, date of birth, email, phone or file bytes.

Name lookup and account metadata require `accounts.support`, an active HR/owner grant and office scope. Contact/application views require `applications.review`; forms, identity documents and PDF exports also require `documents.review`. Grants are re-read server-side. Reads and file downloads use the existing personnel audit trail; private endpoints remain `no-store`. The completed packet rechecks application scope/revision before delivery. Client Firestore and Storage access remain denied. Sign-out clears profile data, revokes local PDF URLs and closes tracked print previews.

## Launch preparation

The existing `(default)` Firestore instance is Standard edition. Deploy the directory's office/name-prefix composite index from `firestore.indexes.json` with the reviewed release. For historical applications, compile functions and run `node scripts/backfill-caregiver-directory.mjs` from `functions/` with the deployment environment's existing credentials. Default output is a count-only dry run. After reviewing the count, add `--write`. It targets `primetimehomehealthservices` and re-reads applications transactionally to avoid overwriting a concurrent name change. It does not create account membership or permissions.

The current local preview uses labeled synthetic accounts, forms and placeholder identity documents. No real personnel records, directory backfill, grants or live collection gates were changed by this work.
