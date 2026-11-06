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

From the operations dashboard, choose **Caregiver portal management**. The management portal provides first/last-name search, selectable caregiver profiles, account/contact information, application state and a **Send password reset email** action. Authorized reviewers can view and print the application, official forms and private documents individually or as one complete packet. See [CAREGIVER_PROFILES.md](CAREGIVER_PROFILES.md). Only an active HR/owner grant with explicit `accounts.support` authority and the account's office can use support. Staff accounts and accounts outside the portal are excluded. The server rechecks scope and limits reset requests to three per hour per caregiver with a one-minute cooldown. It records a request audit; Firebase's browser SDK performs email delivery. A request audit does not prove inbox delivery, and an interrupted send can require retry after the cooldown. Reset links, passwords and tokens are never returned to staff.

Portal sign-in creates a minimal private account index (UID, office and creation date) to establish portal membership. Name search becomes available after the application supplies the caregiver’s name; a separate minimal name directory is updated automatically as the application is saved. Application, document and onboarding review continue under their separate permissions. No permission grants were changed in production.

Google, Apple, Microsoft and Yahoo sign-in code is prepared. The initial check found none configured; Google was subsequently enabled for the real-account test described in PROVIDER_SETUP.md. Apple, Microsoft and Yahoo still require owner developer accounts and client configuration. Only provider IDs explicitly enabled through `WORKFORCE_SIGN_IN_PROVIDERS` appear on the live screen, and their Firebase/provider configuration must be completed first. Google requires its Firebase provider setup; Apple requires a Services ID, Team ID and signing key; Microsoft and Yahoo require their registered client credentials. Keep credentials in the provider consoles, outside Git. No automatic credential linking or provider access to application documents is added. The local buttons demonstrate synthetic sign-in and do not prove live OAuth acceptance.

Current validation: 859 backend and 617 site/tooling/analytics tests pass (1,476 total). New checks cover office/role boundaries, stale-session cleanup, provider-only recovery, request limits, isolated reset screens and the custom action handler. Synthetic browser checks exercised account creation, verification, sign-in, private openings, management lookup, mock reset email and the isolated new-password page. Production email delivery, remaining provider configuration and device acceptance remain launch checks. Google has reached the real Chrome account chooser; user completion remains the acceptance handoff.

## Provider button presentation

Provider choices use logo-only buttons with accessible names, hover titles and keyboard focus rings. The Google image comes from the official [pre-approved sign-in assets](https://developers.google.com/identity/branding-guidelines). Apple artwork comes from [Simple Icons](https://github.com/simple-icons/simple-icons), Yahoo artwork from [Font Awesome](https://github.com/FortAwesome/Font-Awesome/blob/master/svgs/brands/yahoo.svg) (CC BY 4.0), and Microsoft uses its four-color symbol. Artwork is embedded locally; showing the buttons makes no requests to third-party image servers.

The loopback preview no longer automatically signs a sample user in when a provider is clicked. It explicitly explains that provider sign-in is unconnected and leaves the account unauthenticated. Production uses Firebase signInWithPopup and the verified-identity backend checks. A provider may reuse an existing provider session; an extra password or code is controlled by that provider, rather than forced by this portal.

Google sign-in explicitly requests the provider account chooser. The caregiver CSP permits only the project-specific Firebase auth helper frame; frame ancestors remain denied, and other routes retain their frame restrictions.

## Real Google account test

Google is enabled in the existing Firebase project. Use `http://localhost:4176/caregiver` for real Google authentication; `4175` remains the synthetic walkthrough. The current caregiver SDK is Firebase compat 13.2.0, and its CSP allows the Google API helper plus same-origin/project auth frames. The test server validates real Firebase identities while rejecting all applicant/document writes. See [provider setup](PROVIDER_SETUP.md) for the owner handoff and other provider registrations. No operator credentials or provider secrets are stored in Git.
