# First administrator handoff

## Password-free sign-in — October 10, 2026

The owner explicitly approved `jeremynwokorie@gmail.com` for Primetime administration and selected email-link sign-in. The server-approved email list is in `functions/src/auth/admin.ts`. That exact mailbox receives the application `admin` role only after a Firebase ID token proves email verification and the current enabled Firebase account still has the same verified email. Token revocation checks remain required. Existing administrator custom claims continue to work; no extra collection or scheduling reviewer roles are granted.

The `/primetime` login screen sends a sign-in link with an HTTPS return to `https://pthhs.net/primetime`. Open the link, confirm the same email, and select **Finish sign in**. The server must accept `/primetime/api/session` before the workspace appears. There is no password field. The email is never taken from URL parameters.

Firebase Authentication must have the Email/Password provider and its **Email link (passwordless sign-in)** option enabled, with `pthhs.net` as an authorized domain. Firebase's email-link flow verifies mailbox ownership and can create the sign-in account; no custom token or sole-user bootstrap is needed for the specifically approved mailbox.

Firebase console configuration verified October 10: Email link is enabled and `pthhs.net` is listed as a custom authorized domain. The owner's completed mailbox sign-in remains pending.

Deployment artifact cleanup was configured and saved through the owner's Google Cloud session on October 10: repository `gcf-artifacts` in `us-central1` has policy `firebase-functions-cleanup`, deleting build images older than seven days. These retained build images are separate from deployed function runtime copies. CI uses normal Functions deployment and the existing policy; it does not force policy writes or require broader repository administration permissions for the deployment service account.

Publication and provider setup do not establish the owner's completed sign-in or HHA acceptance. DEV-006/007/009 remain pending until normal-session checks succeed. Firestore/privacy readiness and operational/write approvals remain separate.

## Historical claim-based handoff

Intended business identity: `jnwokorie@pthhs.net`. This document does not grant access, create an account or request a password.

Before any persistent change, use an existing authorized Firebase administrator session for project `primetimehomehealthservices` to inspect the existing user read-only: exact UID, matching email, email verification, disabled status, sign-in provider and current custom claims. Inspect whether an administrator already exists. Do not infer identity from the email string alone or choose another user automatically. If mailbox verification or privileged access is missing, report that specific prerequisite.

Minimum proposed application grant, after reporting the inspected identity and claims for approval: merge `admin: true` into that exact user's existing custom claims, preserving every unrelated claim. `functions/src/auth/admin.ts` recognizes that claim; no GCP IAM role is proposed. Do not overwrite an existing role just to set `role: "admin"`.

The existing `bootstrap-sole-admin.mjs` is a mutating tool, not an inspection command. It checks UID/email, enabled status, password provider and absence of another boolean admin, but does not check `emailVerified`; it also adds a role when absent. Do not run it as a substitute for the read-only review or the minimal approved grant. Admin recognition also accepts an admin role string or roles array, so inspect those claims when assessing existing administrators.

After an approved grant, the owner signs in or refreshes the session normally. Verify `/primetime/api/session` and then the harmless protected HHA health check. Never log passwords, tokens, secret values, patient records or full SOAP payloads. Do not create new credentials to bypass unavailable office access.

Deployment and authenticated acceptance are separate outcomes. After either attempted deployment outcome, the deployment workflow runs `functions/scripts/report-acceptance-pending.mjs` to keep the owner's normal-session acceptance visibly **PENDING** in the job summary. This informational report exits 0 without inspecting identities, using credentials or calling protected endpoints; it does not change a failed deployment into success. A green deployment establishes only its deployment and anonymous-boundary checks. It does not establish the owner's completed sign-in, administrator authorization, HHA connectivity or operational data acceptance.

The actual unattended acceptance attempt, `functions/scripts/verify-live-deployment.mjs`, remains unchanged: it reports **BLOCKED** and exits 2 without discovering administrators, creating tokens or calling protected endpoints. Its failure must not be suppressed or renamed a pass. The approved owner must complete normal email-link sign-in, verify `/primetime/api/session`, then verify the harmless `/primetime/api/hha/health` reference check. Record sanitized evidence before marking these acceptance gates complete; operational data and all deployment write approvals remain separate.

Office checkpoint: no live UID or claims were inspected; no grant was performed. Chrome/Edge processes were present, but the supported browser-control runtime was not exposed. No GCP CLI or Firebase login configuration was found in the standard locations checked. Firestore, PHI readiness, BAA coverage and all 24 operational/write approvals remain separate gates.
