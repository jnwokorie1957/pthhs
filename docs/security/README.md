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
