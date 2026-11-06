# Existing HHA caregiver access

November 6, 2026 — implemented on the workforce review branch; not launched.

## Caregiver pathway

1. Choose **Already a Primetime caregiver? Set up portal access** or open `/caregiver?intent=existing`.
2. Enter the email recorded in the HHA caregiver profile. The public response is the same for known, missing, ambiguous, disabled and delivery-failure cases.
3. A unique source match can receive a Firebase email to set the **Primetime portal password**. HHA passwords are never requested, imported or changed. Portal credentials are managed by Firebase Authentication.
4. Sign in and complete Firebase email verification if still required. A password reset is not assumed to establish emailVerified.
5. Exact source ID, unique normalized email, current office and verified mailbox ownership establish a one-to-one private account link. Contact/employment information and permitted HHA files appear in **My HHA profile & files**. An absent portal application is explicitly **Application not on file**.

New applicants continue creating a normal portal account. Name similarity never links accounts or documents. Missing/shared HHA emails require correction/review in the source before automatic enrollment. HHA's NotificationPreferences/Email field is used; it is not assumed to be the HHA login identifier.

## Management and source boundaries

Owner **Sync HHA roster** discovers IDs and processes three source profiles per resumable batch using the shared background request budget. A progress count reports records checked, not guaranteed imports. Truncation, source failures, office mismatches and unavailable file operations remain explicit. The current implementation operates in the configured owner office; it does not aggregate every agency office.

Staff source selection shows contact/employment details. accounts.support with office scope is required; documents.review independently permits birth date and original files, with permission rechecks after source reads. **Send portal access link** requests the same email pathway. It does not return reset tokens or expose passwords. Source files retain original bytes, filename and categories where available. No source employment application is fabricated and no HHA records are written.

Private Firestore collections workforceHhaProfiles, workforceHhaImports, workforceHhaLinks, workforceHhaAssignments and workforceHhaAccessLimits are server-only under the existing default-deny rules. Email matching keys and public quota keys are SHA-256 hashes; audit payloads contain IDs/actions, not source contact data, passwords or document bytes. Public requests are limited per email and network. Profiles/files use authenticated no-store responses, no browser persistence, and are cleared on sign-out. Changing the source email, revoking verification, disabling the account or breaking the reverse ownership link denies subsequent reads.

Contact fields include source email, address and phones. Permitted employment fields include source employee ID/type, dates, discipline, office organizational labels, languages and professional license/NPI where supplied. This is not a blanket copy of every HHA field: attendance PIN, full SSN, payroll/banking/clinical data and internal notes are excluded.

## Live prerequisites and acceptance

- Deploy reviewed code only after the existing workforce application/operational-data launch prerequisites are satisfied. WORKFORCE_HHA_PORTAL_APPROVED defaults false and must remain closed until acceptance.
- Configure the correct owner office, operational-data approval, workforce grants and approved HHA secret binding. SearchCaregivers and GetCaregiverDemographics must be selected; SearchCaregiverDocument and DownloadCaregiverDocument must additionally be authorized/selected for files. The latter two were disabled at read-only inspection and remain unchanged.
- Verify tenant acceptance of the bounded empty-filter roster discovery, complete result coverage, actual office IDs, source email uniqueness, source list/download schemas and originals. More than 5,000 roster IDs or truncated discovery cannot be silently imported.
- Set WORKFORCE_PORTAL_ORIGIN to the canonical HTTPS origin. The server reads the project's public Firebase web configuration and uses Firebase Authentication sendOobCode for password-reset email. Verify API-key server restrictions, authorized continue origin, branded sender/template, delivery/spam handling, expiry, verification and real recovery completion with an owner-controlled test account.
- Verify staff and caregiver access using a nonproduction authorized source fixture, source-email changes, grant revocation, quota/backoff and original-file delivery. Then synchronize the selected roster. Synchronization prepares private source profiles; it creates no bulk credentials and sends no mass email.

No live roster sync, real account provisioning, file import or real email delivery occurred in this change. The localhost demonstration uses example.invalid accounts and sample ID/social PDFs only. Synthetic verification passed 874 backend and 636 site/tooling tests (1,510 total), including concurrent list-coverage work. All local site release checks passed. Browser verification demonstrated the email-only access request, generic response and separate source profile/files/application status using fictional fixtures. Shared workforce allowance is 168 KB raw / 53 KB gzip; independent management, marketing and operations allowances are unchanged.

Source contracts: [HHA caregiver demographics](https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx?op=GetCaregiverDemographics), [HHA caregiver documents](https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx?op=SearchCaregiverDocument), [Firebase password reset and user management](https://firebase.google.com/docs/auth/web/manage-users).
