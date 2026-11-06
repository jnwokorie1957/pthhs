# Caregiver account access

Caregivers create an email/password account, verify their email, sign in, browse the private job board and start a general or position-specific application. The Careers page links to sign-in. The openings API requires a verified Firebase identity. Expressions of interest are validated against the current published, privacy-reviewed opening and recorded once per account and position.

## Where accounts are managed

Project: `primetimehomehealthservices`. Account administration is in [Firebase Authentication — Users](https://console.firebase.google.com/project/primetimehomehealthservices/authentication/users). Firebase Authentication manages passwords; application documents contain the Firebase UID, not passwords. Passwords are not readable by office staff or stored in Git. Browser sessions use Firebase SESSION persistence. Signing out clears rendered private application and board content.

The existing email/password provider and email enumeration protection were confirmed enabled through a read-only configuration check. No provider settings, users or production records were changed. Account creation remains closed by the existing application release parameters until launch approval.

## Email recovery and verification

Create account sends a Firebase verification email. Openings remain inaccessible until verification succeeds. Forgot password sends a reset email with a generic response that does not reveal whether an account exists. The secure Firebase-hosted action page lets the applicant choose a new password and return to `/caregiver`. Signed-in applicants can also request a reset link from their workspace.

Before production launch, verify email delivery, sender/template branding, authorized production domains and the hosted reset/verification return path on actual devices. No real messages were sent during implementation.

## Owner preview

The local preview uses synthetic accounts and four explicitly labeled demonstration opportunities. Its mock email inbox and mock credentials are outside the repository and never provision Firebase users. This preview demonstrates account creation, verification, recovery, filtering, position details and the application handoff. It is not evidence of production email delivery. Production never receives the sample openings.

Validation: 843 backend tests and 588 site/tooling/analytics tests pass, including revoked/unverified identity handling, idempotent interest recording, stale-session clearing, mismatched passwords, private-board gating and generic recovery responses. Browser verification covered the signed-in board, position details, interest/application handoff and returning to openings without reopening a stale dialog.
