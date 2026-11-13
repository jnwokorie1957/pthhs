# Verify an applicant upload in HHAeXchange

Use this acceptance test for HHAeXchange case **00579829**. It submits a synthetic application through the portal's signing code, renders the same PDF used by staff, creates an HHA **Applicant** and uploads the PDF to the ID returned by HHA. The production onboarding queue has no consumer for this workflow.

## Before the vendor test

Have HHA confirm the sandbox endpoint, sandbox-only credentials, test office, valid applicant discipline, and the active employment application document type ID. The credentials need `CreateCaregiver`, `GetCaregiverDemographics`, `AddCaregiverDocument`, `SearchCaregiverDocument` and `DownloadCaregiverDocument`. Confirm that the sandbox can create the synthetic applicant with the fields in the harness and return the Applicant classification, office and external employee ID. The harness omits the SSN and notification fields from the create request. If HHA requires additional fields or a different sandbox endpoint, update the harness against their instructions before running it.

The [HHA Texas API guide](https://hhaxsupport.s3.amazonaws.com/SupportDocs/EDI%20Guides/ProviderIntegration/HHAeXchange%20Web%20Service%20API%20-%20TX.pdf) lists required fields such as Gender and EmploymentTypes. The harness supplies a synthetic Gender and a vendor-confirmed discipline for the test. A production rollout still needs an approved mapping for required fields, including fields the current portal does not collect.

## Run the test

From `functions`, build with `npm run build`. Run the local acceptance tests with `node --test lib/workforce/hhaApplicantUpload.test.js`. These tests use mocked HHA responses.

Once HHA confirms the test setup, supply the following in the process environment. Load test credentials from the approved secret store.

| Variable | Value |
| --- | --- |
| `HHA_APPLICANT_TEST_ENDPOINT` | HHA-confirmed sandbox SOAP URL |
| `HHA_APPLICANT_TEST_OFFICE` | Authorized test office ID |
| `HHA_APPLICANT_TEST_DOCUMENT_TYPE` | Active application document type ID |
| `HHA_APPLICANT_TEST_DISCIPLINE` | Accepted applicant discipline for the test office |
| `HHA_APPLICANT_TEST_RUN_ID` | Unique reference like `PTHHS-TEST-A100`, also sent as the external employee ID |
| `HHA_APPLICANT_TEST_APP_NAME`, `HHA_APPLICANT_TEST_APP_KEY`, `HHA_APPLICANT_TEST_APP_SECRET` | Sandbox-only credentials |

Run `node scripts/verify-hha-applicant-upload.mjs --approved-sandbox`. The command writes the synthetic applicant and its signed application to HHA. It blocks known production endpoints and the Primetime production office, uses generated sample data, and rejects redirects.

The test passes only when HHA lists the new document under the exact applicant and document type, the downloaded PDF has the original SHA-256 hash, and a final read still confirms the applicant and attachment. The receipt in the system temporary directory records the test reference, revision, HHA IDs and hash. In the HHA sandbox, open the applicant by the receipt's caregiver ID and check that the file opens and displays the synthetic signature.

If the test stops after a create or attach attempt, use the receipt to inspect the sandbox by the external employee ID or the returned IDs before another run. A missing response can follow a successful write. Keep the receipt, reconcile the attempt with HHA, then use a new test reference for a fresh run.
