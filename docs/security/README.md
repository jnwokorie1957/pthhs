# Portal security review

Reviewed November 24, 2026. Scope includes the caregiver and workforce portals, their two HTTP backend functions, Firebase client rules and the production deployment workflow. Evidence came from public headers, configuration metadata, source review and local tests with synthetic inputs. No personnel or patient records were accessed.

## Fixes on main

- Removed inline script execution from the workforce route in commit ef66bf6. Published a Hosting-only release from the previous live manifest. All 292 file paths and hashes matched, and the only configuration change was the workforce CSP. Live version d9b13bf09c70ed12 replaced 859d79ebd216f736. A subsequent HTTPS GET returned 200 with the tightened script policy.
- Repaired a stale regression test that required the workforce CSP to equal the broader Primetime policy. The updated test requires an explicit script policy on both portal routes and rejects unsafe-inline and unsafe-eval.
- Pinned the Hosting deployment action to its resolved 40-character commit. Its regression check now requires an immutable revision. Review upstream changes before updating the pin.
- Updated both backend deployment jobs to pass the Firebase credential through a step-scoped environment variable. The shell writes it as data with a restrictive umask in place before file creation. This change does not rotate the existing credential.

## Verification

The workforce configuration, Hosting-only deployment and management authentication suites passed 36 tests locally. Earlier synthetic checks returned 401 for signed-out document listing, applicant file retrieval, HHA file retrieval, staff-side document retrieval, and staff opportunity reads and writes. Seven local document protection tests passed, including recent authentication, single-use verification and encryption failure handling. These tests cover selected paths and do not establish production handler behavior.

The released Firestore and Storage rules matched main in every executable line. Both deny direct client reads and writes. Server-side Admin SDK access is governed separately by IAM.

## Open production risk

Both active portal functions still run under the default Compute Engine service account with unconditional project Editor. Two dedicated accounts were created, portal-workforce-api and portal-document-decrypt. No runtime switch or permission grant was made. Nine additional functions and two regional Cloud Run jobs were confirmed on the shared account. The inventory is a lower bound.

A project IAM administrator must provide scoped runtime grants. Validate authorized reads and writes as well as signed-out denials with synthetic fixtures under each new identity, then verify the deployed identities. Review the other workloads before removing Editor. The current account lacks project IAM policy write permission. Main was also observed to lack branch protection.

## IAM administrator runbook for synthetic document tests

Run these commands in Google Cloud Shell (Bash). Use the two existing production-owned identities against **test resources only**. This first test uses impersonation and requires no function deployment, production data access or cross-project runtime attachment. The administrator needs authority to create the named test resources, create custom roles and set IAM on each target. Supply a dedicated, billing-enabled Firebase test project with a default Firestore database and Firebase Authentication configured.

```bash
set -euo pipefail
read -rp 'Dedicated Firebase test project ID: ' TEST_PROJECT
export TEST_PROJECT
[[ -n "$TEST_PROJECT" && "$TEST_PROJECT" != primetimehomehealthservices ]]
OWNER_PROJECT=primetimehomehealthservices
API="portal-workforce-api@$OWNER_PROJECT.iam.gserviceaccount.com"
DEC="portal-document-decrypt@$OWNER_PROJECT.iam.gserviceaccount.com"
BUCKET="gs://$TEST_PROJECT-portal-iam-test"
gcloud services enable cloudkms.googleapis.com firestore.googleapis.com storage.googleapis.com identitytoolkit.googleapis.com --project="$TEST_PROJECT"
gcloud firestore databases describe --database='(default)' --project="$TEST_PROJECT"
```

Create the following resources once. On a rerun, describe existing resources and verify they belong to the synthetic environment before continuing.

```bash
gcloud storage buckets create "$BUCKET" --project="$TEST_PROJECT" --location=us-central1 --uniform-bucket-level-access --public-access-prevention
gcloud kms keyrings create portal-test --location=us-central1 --project="$TEST_PROJECT"
gcloud kms keys create documents --keyring=portal-test --location=us-central1 --purpose=encryption --project="$TEST_PROJECT"
create_role() {
  gcloud iam roles create "$1" --project="$TEST_PROJECT" --title="$2" --permissions="$3" --stage=GA
}
create_role portalTestAuthWrite 'Portal synthetic account enrollment' 'firebaseauth.users.get,firebaseauth.users.create,firebaseauth.users.update'
create_role portalTestAuthRead 'Portal synthetic identity verification' 'firebaseauth.users.get'
create_role portalTestObjectWrite 'Portal synthetic document upload' 'storage.objects.create,storage.objects.get'
create_role portalTestObjectRead 'Portal synthetic document retrieval' 'storage.objects.get'
```

Apply these bindings. Firestore writes are needed by both handlers for challenges and audit events. The test project contains synthetic identities only. Project-wide Auth permissions affect every Auth user in that test project.

```bash
project_grant() {
  gcloud projects add-iam-policy-binding "$TEST_PROJECT" --member="serviceAccount:$1" --role="$2" --condition=None
}
for sa in "$API" "$DEC"; do
  project_grant "$sa" roles/serviceusage.serviceUsageConsumer
  project_grant "$sa" roles/datastore.user
done
project_grant "$API" "projects/$TEST_PROJECT/roles/portalTestAuthWrite"
project_grant "$DEC" "projects/$TEST_PROJECT/roles/portalTestAuthRead"
gcloud storage buckets add-iam-policy-binding "$BUCKET" --member="serviceAccount:$API" --role="projects/$TEST_PROJECT/roles/portalTestObjectWrite"
gcloud storage buckets add-iam-policy-binding "$BUCKET" --member="serviceAccount:$DEC" --role="projects/$TEST_PROJECT/roles/portalTestObjectRead"
for spec in "$API cryptoKeyEncrypterDecrypter" "$DEC cryptoKeyDecrypter"; do
  read -r sa role <<< "$spec"
  gcloud kms keys add-iam-policy-binding documents --project="$TEST_PROJECT" --location=us-central1 --keyring=portal-test --member="serviceAccount:$sa" --role="roles/cloudkms.$role"
done
```

For the smoke test, a trusted tester needs temporary impersonation on these two identities. Run the test before granting these identities production data access. This command expires the grants after one hour. Use an already authorized tester's Google email. Run the test from the repository checkout.

```bash
read -rp 'Trusted tester email: ' TESTER
expiry=$(date -u -d '+1 hour' +%FT%TZ)
for sa in "$API" "$DEC"; do
  gcloud iam service-accounts add-iam-policy-binding "$sa" --project="$OWNER_PROJECT" --member="user:$TESTER" --role=roles/iam.serviceAccountTokenCreator --condition="expression=request.time < timestamp('$expiry'),title=portal-fixture-$RANDOM"
done
# As the tester, with TEST_PROJECT exported:
bash scripts/test-portal-runtime-iam.sh
```

The script encrypts unique synthetic bytes as the API identity, uploads them to a fresh object, reads and decrypts them as the document identity, and checks byte equality. Keep its exit status and fixture URI. The test bucket administrator can remove that one object after review. An IAM smoke test does not exercise signed-in application authorization.

### Before switching production traffic

1. Return the test project ID, smoke-test result, controlled test mailbox, and test Entra app and tenant IDs to the deployment operator. Keep credentials in the approved secret store.
2. For the full application test, use the dedicated backend package described below. Use test-only integrations. Confirm all application calls are directed to test resources before exercising authenticated handlers. A same-project staging runtime identity can avoid cross-project attachment restrictions, but its federation subject differs.
3. For a mail test using the actual decrypt identity, the Entra administrator must trust Google issuer `https://accounts.google.com`, subject `115808490644514448607`, and audience `api://AzureADTokenExchange` on the **test** mail application. Restrict mail to the controlled test sender. Use two synthetic applicants and one synthetic staff user to verify owner access, staff access, cross-applicant denial and signed-out denial.
4. Review permission use across the other enabled API features before authorizing production resource bindings. The commands above cover the synthetic document workflow. They are not a production-wide permission manifest. Grant the deployment principal `roles/iam.serviceAccountUser` individually on each runtime identity for cutover. Record the previous function revisions and runtime identities, switch one function at a time, and verify both the revision identity and application behavior.
5. Retire the shared Editor grant only after the other identified workloads have been migrated or independently verified.

Once the production bindings have been reviewed, an IAM administrator can enable the designated deployer to attach the identities. Enter its full IAM member string, such as `serviceAccount:NAME@PROJECT.iam.gserviceaccount.com`. Use this after the temporary impersonation grants expire.

```bash
read -rp 'Authorized deployment principal (full IAM member string): ' DEPLOYER
for sa in "$API" "$DEC"; do
  gcloud iam service-accounts add-iam-policy-binding "$sa" --project="$OWNER_PROJECT" --member="$DEPLOYER" --role=roles/iam.serviceAccountUser --condition=None
done
```

### Build and validate the synthetic portal backend

From the repository root, run:

```bash
npm ci --prefix functions
npm run build:portal-test --prefix functions
node --test functions/scripts/portal-test-build.test.mjs
```

The generated Functions source directory is `functions/portal-test-build`. Its package entry exports only `workforceApi` and `workforceDocumentDecrypt`. Use this separate source for staging. The normal production Functions entry remains in `functions/package.json`.

Set `PORTAL_TEST_PROJECT` to the administrator's test project ID and `PORTAL_TEST_SENDER` to the controlled test sender mailbox in the test runtime and during function discovery. `GCLOUD_PROJECT` must identify the same test project. The package derives its bucket as `<project>-portal-iam-test`, its quota project as `<project>`, and its key as `projects/<project>/locations/us-central1/keyRings/portal-test/cryptoKeys/documents`. A conflicting explicit KMS key aborts startup. Supply the test Entra tenant and client through `WORKFORCE_DOCUMENT_MAIL_TENANT` and `WORKFORCE_DOCUMENT_MAIL_CLIENT`. Test verification messages go to the controlled sender inbox even when a synthetic applicant has a different address.

The offline test uses a reserved .invalid address and a mocked mail transport. Runtime IAM, real test-mailbox delivery and authenticated end-to-end access require the administrator grants and a staging deployment with the intended identities. Keep unrelated integrations disabled and use only synthetic fixtures in staging.
