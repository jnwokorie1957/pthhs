# Caregiver account access

Caregivers create an email/password account, verify their email, sign in, browse the private job board and start a general or position-specific application. The Careers page links to sign-in. The openings API requires a verified Firebase identity. Expressions of interest are validated against the current published, privacy-reviewed opening and recorded once per account and position.

## Where accounts are managed

Project: `primetimehomehealthservices`. Account administration is in [Firebase Authentication — Users](https://console.firebase.google.com/project/primetimehomehealthservices/authentication/users). Firebase Authentication manages passwords; application documents contain the Firebase UID, not passwords. Passwords are not readable by office staff or stored in Git. Browser sessions use Firebase SESSION persistence. Signing out clears rendered private application and board content.

The existing email/password provider and email enumeration protection were confirmed enabled through a read-only configuration check. No provider settings, users or production records were changed. Account creation remains closed by the existing application release parameters until launch approval.

## Email recovery and verification

Create account sends a Firebase verification email. Openings remain inaccessible until verification succeeds. Forgot password sends a reset email with a generic response that does not reveal whether an account exists. The caregiver portal includes a custom email-action screen for choosing a new password (`mode=resetPassword`) and confirming an email (`mode=verifyEmail`). It validates the action code with Firebase, removes it from the visible URL, and keeps the action isolated from openings and application content. After this branch is deployed, configure the Firebase email template action URL to `https://pthhs.net/caregiver`; until that launch step, production emails continue using the existing Firebase-hosted handler. Unsupported or expired actions show a safe unavailable-link screen. Signed-in applicants can also request a reset link from their workspace.

Before production launch, verify email delivery, sender/template branding, authorized production domains and the hosted reset/verification return path on actual devices. No real messages were sent during implementation.

## Owner preview

The local preview uses synthetic accounts and four explicitly labeled demonstration opportunities. Its mock email inbox and mock credentials are outside the repository and never provision Firebase users. This preview demonstrates account creation, verification, recovery, filtering, position details and the application handoff. It is not evidence of production email delivery. Production never receives the sample openings.

Validation: 843 backend tests and 588 site/tooling/analytics tests pass, including revoked/unverified identity handling, idempotent interest recording, stale-session clearing, mismatched passwords, private-board gating and generic recovery responses. Browser verification covered the signed-in board, position details, interest/application handoff and returning to openings without reopening a stale dialog.

## Dedicated portal and management support (November 6, 2026)

The caregiver portal uses its own brand header without marketing navigation. Create account, sign-in, email verification, reset-link request and new-password screens each show only their relevant controls. Reset views omit the office-help line, sign-in provider buttons, openings and application content. A signed-in applicant can return to the private portal. External-provider users receive provider recovery guidance instead of a local password reset.

From the operations dashboard, choose **Caregiver portal management**. The management portal provides caregiver-account lookup, sign-in method, email verification/account status, application state and a **Send password reset email** action. Only an active HR/owner grant with explicit `accounts.support` authority and the account's office can use support. Staff accounts and accounts outside the portal are excluded. The server rechecks scope and limits reset requests to three per hour per caregiver with a one-minute cooldown. It records a request audit; Firebase's browser SDK performs email delivery. A request audit does not prove inbox delivery, and an interrupted send can require retry after the cooldown. Reset links, passwords and tokens are never returned to staff.

Portal sign-in creates a minimal private account index (UID, office and creation date) so support works before an application is started. Application, document and onboarding review continue under their separate permissions. No permission grants were changed in production.

Google, Apple, Microsoft and Yahoo sign-in code is prepared. A read-only check found none configured in this project. Only provider IDs explicitly enabled through `WORKFORCE_SIGN_IN_PROVIDERS` appear on the live screen, and their Firebase/provider configuration must be completed first. Google requires its Firebase provider setup; Apple requires a Services ID, Team ID and signing key; Microsoft and Yahoo require their registered client credentials. Keep credentials in the provider consoles, outside Git. No automatic credential linking or provider access to application documents is added. The local buttons demonstrate synthetic sign-in and do not prove live OAuth acceptance.

Current validation: 849 backend and 597 site/tooling/analytics tests pass (1,446 total). New checks cover office/role boundaries, stale-session cleanup, provider-only recovery, request limits, isolated reset screens and the custom action handler. Synthetic browser checks exercised account creation, verification, sign-in, private openings, management lookup, mock reset email and the isolated new-password page. Production email delivery, provider OAuth configuration and device acceptance remain launch checks.
