# Live HHA caregiver connection — November 6, 2026

The owner authorized live caregiver names, emails and files, a password-recovery test to their own mailbox, and a daily midnight refresh before launch. This supersedes the earlier review-only source-connection restriction for these specific reads and access preparation. Application collection, new identity uploads, public job publication, hiring decisions and all HHA mutations remain closed.

## Confirmed live

- Existing project/secret and configured office 503324 successfully returned 1,843 source caregiver IDs. Source profile contact/employment reads succeed; private profiles are being prepared in workforceHhaProfiles. The first import is rate-limited and resumable; 1,843 discovered IDs is not a claim that all profiles are already imported or all belong to this office.
- Owner settings revision 12 adds only SearchCaregiverDocument and DownloadCaregiverDocument, preserving existing reads. Source file listing succeeds. Multiple sampled document records have no attached binary; HHA explicitly returned error -310, No document is attached. Document-only entries are labeled and have no View file action. Attached-file delivery remains conditional on an actual source attachment; no missing ID/social scan is fabricated. Do not claim every original file has been downloaded or verified.
- workforceApi is deployed separately in us-central1 with existing HHA operational-data approval and WORKFORCE_STAFF_APPROVED / WORKFORCE_HHA_PORTAL_APPROVED true. Application, packet, ID-upload/retention and public-opportunity flags remain false. Existing-source account access no longer requires enabling applicant collection.
- The owner's exact enabled, verified Firebase identity was checked before an audited, office-scoped workforce owner bootstrap. Its explicit permissions are accounts.support, documents.review and staff.manage only. No caregiver was activated and no second staff member or clinical/legacy grant was added.
- Firebase accepted the owner's PASSWORD_RESET request. The connected owner mailbox received the email, and its actual link opened a valid isolated reset screen. New-password entry/submission belongs to the owner and was not performed by the agent; changed-password sign-in is not yet acceptance-tested. Owner management email-link sign-in also reached the real protected workspace.

## Hosted test portal

https://primetimehomehealthservices--caregiver-hha-fksg7ga4.web.app/primetime/workforce

This seven-day Firebase Hosting preview channel uses the deployed real backend; localhost 4175 remains synthetic. The main public site was not promoted to this channel. Firebase's existing hosted email action handler remains in place until the final portal domain is released and accepted. WORKFORCE_PORTAL_ORIGIN points to this test channel during acceptance so password setup returns to a working portal; the main site's caregiver path is not yet published. Switch to the canonical HTTPS origin only when that page is released. No reset token, personal contact record or source file is committed to Git.

## Import and daily refresh

functions/scripts/sync-hha-caregivers.mjs is the privileged, read-only import command. It requires --apply, HHA_SYNC_ACTOR and approved operator ADC. An optional local HHA_SYNC_TOKEN_MODULE supplies an in-memory Google token function; that module and its credentials stay outside Git. The script uses the established source secret and shared background budget/backoff. A private office lease prevents duplicate runs, checkpoints permit resuming, current source office membership is checked per profile, and no bulk Firebase accounts, email blasts or HHA writes occur. --files refreshes file metadata as well; original files stay in HHA and are fetched only through authenticated ownership/permission checks.

Private state is in workforceHhaSyncRuns and workforceHhaRosterReady. New email-based provisioning/linking waits for a completed initial office roster cycle so a partially loaded email index cannot appear uniquely matched. Missing/shared emails remain review conditions. This does not import HHA passwords, attendance PINs or full SSNs, or create an application for an existing caregiver.

The Codex automation **Refresh HHA caregiver roster** is active daily at 12:00 a.m. local America/Chicago time. Its approved local runtime command is work/refresh-hha-caregivers.ps1 from this workspace; it reports an existing running import rather than starting a duplicate, otherwise refreshes source profiles, names and emails. The local Codex connection/operator credentials must remain available. Source failures are reported and never treated as a successful empty roster.

When HHA is busy, staff name lookup may fall back to synchronized names fetched within 36 hours, with an explicit notice. Only source ID/name/status/office data is projected, current role/office and source-settings revision are rechecked, and cached names authorize neither account linking nor file access. New verified portal applicants remain separately labeled in the same name search.

Validation: 881 backend and 639 site/tooling/analytics tests passed (1,520 total). TypeScript and local release checks pass. The small shared HHA browser asset is minified to preserve the existing 168 KB / 53 KB shared-workforce allowance.

## Owner clarification: physical identity records

Existing HHA-roster caregivers already have physical ID and Social Security card records held by the office. They are not asked to upload those again or enter the new-applicant application. The private source link blocks new-intake saves, and the existing-caregiver dashboard hides that pathway. No digital scans, document verification or printable identity images are fabricated. Digital ID/social upload requirements remain unchanged for new portal applicants. The daily refresh prepares source names/contact information; it does not bulk import old identity-file metadata. HHA source document records can still be read on demand where needed.
