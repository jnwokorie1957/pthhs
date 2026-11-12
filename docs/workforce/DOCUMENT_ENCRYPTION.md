# Caregiver document encryption

The owner authorized encryption of caregiver uploads, access checks before decryption, and email verification on November 10, 2026. They separately approved enabling Cloud KMS, its stated usage charges, and key-scoped runtime access.

## Configured cloud resource

The `caregiver-uploads` software symmetric key is enabled in the `workforce-documents` key ring in `us-central1` in project `primetimehomehealthservices`. Its full resource name is recorded in `functions/workforce-deployment.json`. The existing function runtime service account has `roles/cloudkms.cryptoKeyEncrypterDecrypter` on this key. Rotation is every 90 days. Retain old key versions for existing files. Do not disable or destroy them while documents still depend on them.

Chrome was used to enable KMS. The console initially returned errors opening key management. The approved key and key-scoped IAM binding were created through the authenticated Cloud API and then confirmed in Chrome. A real KMS wrap/unwrap round trip passed with synthetic bytes and no stored document.

## Upload and release

Uploads travel over HTTPS and are validated in function memory. Before any file bytes are written to Cloud Storage, a random 256-bit AES key encrypts the file using AES-GCM. KMS wraps that key. Storage receives only ciphertext at `workforce-private/<uid>/<document-id>.<original-extension>.enc`. Firestore stores the wrapped key, IV, authentication tag, object generation, and digests. The plaintext file key is cleared from its Buffer after use. The application server necessarily receives plaintext during upload and releases plaintext to authorized viewers.

The document path is authenticated by both AES-GCM and KMS. It binds the encrypted file to its owner and document ID. All storage writes retain generation preconditions, integrity checking, and private/no-store metadata. PDF quarantine still applies. A trusted PDF scanner must decrypt the exact generation in its private processing environment before issuing the existing digest-bound scan verdict. This change does not provision a scanner.

The new `workforceDocumentDecrypt` Cloud Function handles the verification and binary document routes through the reviewed Hosting rewrites. The original API also enforces the verification checks, so its direct URL is not a bypass. Authentication verifies revocation, current account state and email, and a sign-in age of at most 15 minutes. Staff access also requires current role, explicit application/document permissions, matching office, and completed account setup/training.

The View secure document button requests a six-digit code to the requesting user's verified account email. It accepts no destination supplied by the browser. Codes expire in five minutes and allow five guesses. There are at most three code requests per account per ten minutes. Successful verification returns a random proof bound to the account, original sign-in time, and exact file/print route. It expires within two minutes and is consumed transactionally once. Raw document, individual print and complete-packet routes all enforce it. Current identity and permissions are rechecked before key unwrapping and before returning bytes. Older unencrypted records still require the same access verification.

Email codes provide an additional mailbox check. This is not a claim of an independent second factor when the sign-in provider uses that same mailbox. SMS enrollment and delivery are not implemented by this change.

No file, file key, code or proof is placed in a public URL or application audit event. Verification mail contains only a code. Identity-upload notices contain a sign-in link and no attachments. The existing server-only database/storage rules remain in force. Administrative Google Cloud IAM access is separate from portal roles.

## Remaining launch configuration

Microsoft 365 verification delivery was configured and acceptance-tested on November 11, 2026. `WORKFORCE_DOCUMENT_EMAIL_APPROVED` is true. A document request dispatches only its own new verification message directly; no background worker scans or sends existing identity notices. Microsoft Graph's 202 response is recorded as accepted, not as proof of inbox arrival. This acceptance test separately confirmed the message arrived in the owner's Gmail inbox.

The single-tenant Entra application is **PTHHS Portal Verification Mail**, client ID `0275352c-c4fa-4c5b-8bae-8ef29ffed7b2`, tenant `79734f05-5da8-4995-97cb-c4e065fa327f`. The enterprise service principal is `67f6f572-9600-4da0-bc6d-5fdc66ea630a` (distinct from the app-registration object). An approved federated credential trusts issuer `https://accounts.google.com`, immutable runtime subject `117656650440553466137`, audience `api://AzureADTokenExchange`. The runtime gets a short-lived Google identity assertion from the metadata service and exchanges it with Entra. No mailbox password, client secret or refresh token is stored.

Exchange's `PTHHS-Verification-Sender-Only` management scope filters `PrimarySmtpAddress -eq 'jnwokorie@pthhs.net'`. The `PTHHS-Verification-Mail-Send` assignment grants only **Application Mail.Send** to that scoped service principal. `Test-ServicePrincipalAuthorization` confirmed the sender is in scope and `irab@pthhs.net` is excluded. No tenant-wide Entra application Mail.Send permission was granted. Scoping reference: [Microsoft Exchange application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac). Federation reference: [Microsoft Google Cloud federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-google-cloud).

The server checks the queued message's kind, account, session, single recipient, expiry and salted code hash. A transaction claims it once and removes its plaintext message before Graph dispatch. Concurrent dispatches and automatic retries are refused. An uncertain send requires a new code; neither codes nor provider tokens are logged. Verification emails have no document attachments and are not saved in Sent Items. Firestore TTL is ACTIVE on `deleteAfter` for challenges, verification mail and synthetic sample artifacts. TTL deletion is asynchronous; five-minute expiry is enforced by the server independently.

Real applicant collection and uploads remain closed by the existing release gates. Production launch additionally requires the approved retention process and PDF security screening. Do not use the local sample mailbox or test key wrapper in a deployed function. Application answers and structured employment-form fields keep their existing Firestore encryption at rest. This feature adds envelope encryption to uploaded file binaries, not to every database field.

Both `workforceApi` and `workforceDocumentDecrypt` are deployed with KMS and Microsoft verification email configured. Real application collection and uploads are still disabled. Hosting changes remain prepared on the feature branch and local previews; this email setup does not release the main site.

The temporary `/document-access/sample/{request,verify,pdf}` acceptance path exists only on the dedicated decryption function. It accepts only the owner's current verified Gmail identity with an active owner grant and explicit document-review permission. It rechecks identity and role before sending, verifying, unwrapping the sample key, and returning bytes. It cannot accept caller uploads or read any real application/HHA data. Its fixed fictional PDF is AES-GCM encrypted in Firestore with a KMS-wrapped key and an hourly cleanup timestamp. The path closes at **2026-11-12 14:15 UTC (8:15 a.m. America/Chicago)**, regardless of existing proofs.

Run the local acceptance screen with `node scripts/serve-secure-document-sample.mjs`, then open `http://localhost:4212/`. It uses real Google/Firebase sign-in and proxies only those three sample operations to the deployed function. On November 11 the owner signed in, a real code arrived from `jnwokorie@pthhs.net` in `jeremynwokorie@gmail.com`, an incorrect code was rejected, and the correct code opened the cloud-decrypted sample PDF. The challenge receipt confirmed one wrong attempt, verified=true, consumed=true and an erased proof hash. The queue record's plaintext message was erased. No real caregiver file was involved.

The earlier application preview also verified an empty missing-field summary, red missing fields, and focus/scroll to the first missing field. Those UI changes remain on this branch.

Validation for the Microsoft delivery addition: 912 backend tests and 27 targeted UI tests passed; asset hashes are current. Anonymous sample PDF access returns 401; real document access still returns the closed application-collection response.

The deployment helper refuses to enable identity uploads without the KMS resource, approved email delivery, and the pre-existing collection/packet/retention approvals. Deploy and verify the new function before releasing Hosting rewrites that refer to it. Application opening remains a separate launch decision.
