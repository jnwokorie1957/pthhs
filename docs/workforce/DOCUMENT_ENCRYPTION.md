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

`WORKFORCE_DOCUMENT_EMAIL_APPROVED` remains false. Connect and acceptance-test an organization-approved mail worker for `workforceIdentityMail` before setting it true. Configure Firestore TTL on `deleteAfter` for `workforceDocumentChallenges` and verification mail. Never treat queuing a message as proof that it arrived.

Real applicant collection and uploads remain closed by the existing release gates. Production launch additionally requires the approved retention process and PDF security screening. Do not use the local sample mailbox or test key wrapper in a deployed function. Application answers and structured employment-form fields keep their existing Firestore encryption at rest. This feature adds envelope encryption to uploaded file binaries, not to every database field.

The deployment helper refuses to enable identity uploads without the KMS resource, approved email delivery, and the pre-existing collection/packet/retention approvals. Deploy and verify the new function before releasing Hosting rewrites that refer to it. Application opening remains a separate launch decision.
