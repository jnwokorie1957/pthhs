# Sign-in provider setup and owner handoff

## Google: connected for a real account test

On November 6, 2026, a Firebase web app named **Primetime Caregiver Portal** was registered in the existing `primetimehomehealthservices` project and Google was enabled through Firebase Management provisioning. Read-back confirmed the enabled Google provider and client configuration. The OAuth-start check returned a Google Accounts URL. Chrome reached Google's real account chooser; the owner completes account selection and consent. Successful return and real-user session acceptance remain to be observed after that handoff.

The local real-auth preview is `http://localhost:4176/caregiver`. It loads Firebase's current compat SDK (13.2.0), uses the project's public SDK config and checks Firebase tokens on the server, including verified email, revocation/disabled-user checks and Google sign-in provenance. There are no demo-login shortcuts. The job board is explicitly synthetic. All application/document writes and management routes are closed in this test. Production application release parameters remain closed and no staff role was granted.

The earlier `4175` preview remains a separate synthetic application walkthrough. It does not authenticate provider buttons. Do not use it to assess live Google sign-in.

To reproduce the real-auth preview after compiling `functions`, run `node scripts/serve-workforce-auth-preview.mjs` with `PTHHS_AUTH_PREVIEW_CONFIG` pointing to the Firebase web SDK configuration JSON. Use operator Application Default Credentials, or the optional `PTHHS_AUTH_PREVIEW_CREDENTIAL_MODULE` adapter outside Git that exports `googleToken()`. The server binds only to loopback on port 4176, logs no identity tokens, and never returns operator credentials. Keep config/credential files outside the checkout.

## Shared application settings

- Display name: Primetime Home Health Services.
- Website: `https://pthhs.net`.
- Provider return URL: `https://primetimehomehealthservices.firebaseapp.com/__/auth/handler`.
- Identity only: request the provider's name/profile and email information needed for sign-in. Do not request mailbox, contacts, file or calendar access.
- Enable a provider in Firebase only after its registered client configuration is ready. The portal's `WORKFORCE_SIGN_IN_PROVIDERS` allowlist separately controls live button visibility; collection gates still govern applications.

## Apple: owner enrollment required

Start with [Apple Developer enrollment](https://developer.apple.com/help/account/membership/program-enrollment/). The standard Apple Developer Program is **US$99 per year**. Organization enrollment requires a legal entity and its D-U-N-S number, and someone authorized to bind that entity. The owner completes identity verification, agreement acceptance and membership payment.

After enrollment, create a primary App ID with Sign in with Apple enabled, then a web Services ID linked to it. Suggested identifiers are `net.pthhs.caregiver` and `net.pthhs.caregiver.web`, subject to availability. Register the Firebase auth domain and the exact return URL above. Create a Sign in with Apple key and configure the Services ID, Team ID, Key ID and private key directly in Firebase. Configure Apple's private email relay for Firebase's actual sender before sending mail to hidden-email accounts. See [Firebase's Apple setup](https://firebase.google.com/docs/auth/web/apple).

## Microsoft: owner account and tenant required

Start with [Microsoft Entra app registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app?tabs=client-secret). Sign in with the company's Microsoft administrator account. If no tenant exists, follow Microsoft's tenant/account enrollment; the owner completes any identity, agreement or billing steps requested by Microsoft.

Register **Primetime Caregiver Portal** as a Web application. Select organizational directories **and personal Microsoft accounts** so Outlook/Hotmail and work/school users can sign in. Add the shared return URL, create a client secret with an expiry recorded for renewal, and enter the Application (client) ID and secret **value** directly in Firebase's Microsoft provider settings. Do not grant application permissions to mail or files. See [Firebase's Microsoft integration](https://firebase.google.com/docs/auth/web/microsoft-oauth).

## Yahoo: owner Yahoo account required

Follow [Yahoo's OpenID Connect getting-started guide](https://developer.yahoo.com/oauth2/guide/openid_connect/getting_started.html). The owner creates or signs into a Yahoo account and completes verification and any developer agreement. Then register a web application in the Yahoo Developer Network, set the shared return URL, and select the OpenID Connect `profile` and `email` permissions. Put its Client ID and Client Secret directly in Firebase's Yahoo provider settings. See [Firebase's Yahoo integration](https://firebase.google.com/docs/auth/web/yahoo-oauth).

## What the owner and developer each complete

The owner retains ownership of all accounts and completes new passwords, identity checks, agreements and payments. After those accounts exist, the developer can prepare app registrations, connect the provider settings, test the callback and token checks, and enable the corresponding portal buttons. Do not send passwords, private keys or client secrets through chat or commit them to Git. Apple/Microsoft/Yahoo remain unconfigured until these owner steps are completed; no provider account or paid membership was created for the owner.
