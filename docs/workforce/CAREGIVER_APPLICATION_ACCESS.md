# Caregiver application access and additional positions

Prepared for review in the isolated caregiver preview. No production deployment or collection-gate change is included.

- Submitted applications display recorded answers, submission time and signature receipt as text. Old submitted packet versions can be read without migration or editing. SSN and date of birth retain the existing masked display.
- Signed employment forms stay immutable. Unfinished forms may still be completed after application submission, retaining the existing accepted-offer, electronic-consent and follow-up email checks.
- Caregivers cannot download personnel uploads, including by direct URL or document-verification challenge. HHA source uploads are also excluded from caregiver file access. Authorized staff access, encryption, generation pinning and auditing remain in place.
- Received upload kinds appear only as receipts after submission. A caregiver may send a missing category or replace a security-rejected file, but cannot replace a received file after submitting the application.
- The first application remains the primary personnel record. After submitting it, a caregiver can start separate applications for other published positions in the configured office. Drafts retain independent revisions and need fresh acknowledgments and a new signature. One application per position is resumed rather than duplicated. Existing employment/HHA-account guards remain enforced.
- Additional records live under workforceApplications/{uid}/positions/{opportunityId}, with immutable versions and office-scoped staff review/printing. No existing application or signed form is migrated or rewritten. No second HHA onboarding identity is created.
- Payroll jobs reference the exact position-application version, repeat the insurance election and position, and retain separate attachments and size-based email splitting.

Validation: 1,015 backend checks passed, followed by 41 focused checks including the additional-application cap. The relevant frontend suite passed 49 checks. Chrome preview verified a locked submitted application, access to an unfinished I-9, and separate Houston and Katy drafts alongside the original application.
