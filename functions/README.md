# PTHHS `/primetime` backend

This directory contains server-side code for the internal PTHHS management layer.

## Namespace

- Admin UI: `/primetime/*`
- Admin API: `/primetime/api/*`
- Firebase Function entry point: `primetimeApi`
- HHA adapter: `src/integrations/hhaexchange/`
- Vendor-neutral domain models: `src/domain/models.ts`

The backend contains Firebase ID-token verification and an `admin` custom-claim authorization gate. The Hosting rewrite is configured. Production verification distinguishes an invalid-token check from authenticated access and HHA connectivity, which remain pending until an approved admin exists.

## Confirmed Firebase project

The developer explicitly confirmed that the live site/admin project is:

`primetimehomehealthservices`

The GitHub deployment workflow and `.firebaserc` both target that project.

## HHA runtime configuration

The code expects one Secret Manager JSON secret:

`HHAEXCHANGE_CREDENTIALS`

Shape:

```json
{
  "appName": "YOUR_APP_NAME",
  "appSecret": "YOUR_APP_SECRET",
  "appKey": "YOUR_APP_KEY"
}
```

The production ENT v1.8 endpoint defaults to:

`https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx`

and can be overridden with the non-secret parameter `HHAEXCHANGE_BASE_URL` if HHA provisions a different endpoint.

### Runtime secret status

The developer confirmed `HHAEXCHANGE_CREDENTIALS` has been created in `primetimehomehealthservices`. Do not commit the value to Git or a checked-in `.env` file.

### Current human auth gate

1. Enable Firebase Authentication Email/Password for `primetimehomehealthservices`.
2. Create the first trusted admin user.
3. Confirm the approved user's UID and email independently. From a privileged Firebase Admin SDK environment, set `GOOGLE_APPLICATION_CREDENTIALS`, `PRIMETIME_ADMIN_UID`, and `PRIMETIME_ADMIN_EMAIL`; run `node functions/scripts/bootstrap-sole-admin.mjs`. This script rejects mismatches and existing admins. It does not run in CI.
4. Sign out and back in so the next ID token contains the claim.

Do not send passwords, ID tokens, or service-account keys through chat.

## Current implementation status

Implemented:

- TypeScript/Firebase Functions backend scaffold
- Firebase Admin ID-token verification + `admin` custom-claim gate
- protected `/primetime/api/session` and `/primetime/api/status` handlers
- HHA credentials/config contract
- SOAP envelope/transport with bounded retries, correlation IDs, and metadata-only logging
- normalized SOAP/application/transport error parser with sanitized tests
- protected HHA health handler prepared around the read-only `GetCollectionStatus` reference operation
- vendor-neutral management domain interfaces
- live Firebase project confirmed as `primetimehomehealthservices`

Next:

1. enable Firebase Email/Password Authentication and create the first trusted admin user
2. grant that user the `admin` custom claim
3. verify the already wired `/primetime` login UI and protected `/session` route
4. verify Firebase Functions and the configured `/primetime/api/**` Hosting rewrite
5. deploy and verify the protected `GetCollectionStatus` HHA health call

Track completion in `../docs/management-layer/DEVELOPER_TASKS.md` and the root `../README.md` checkpoint.

## Local verification

Use the committed lockfile and Node 22:

```bash
npm ci
npm run check
npm test
npm audit --audit-level=high
```

The September 12, 2026 audit found no high/critical advisory. Two moderate
findings remain in an optional Firebase Admin storage dependency path; see the
repository review log before considering any transitive override.


### Limited linked-schedule creation

`/workspace/linked-schedule-creations/{prepare,recheck,review,execute,reconcile}` supports explicit same-day Non-Skilled creation only. All source reads must be owner-enabled. `PRIMETIME_LINKED_SCHEDULE_CREATE_APPROVED=false` is a separate default-off deployment gate; review/execute and applied recovery approval additionally require `scheduling_reviewer` on the verified principal. This does not grant that role.

Source checks require an active patient in the configured office, an active caregiver belonging only to that office, explicit caregiver pay code, a linked service present only in the Non-Skilled catalog, and complete empty schedules for both subjects across the selected/adjacent dates. The office-wide scheduling target remains locked across unknown outcomes. Existing visits, clocks and bill amounts are never updated.

GetLinkedScheduleInfo omits persisted ScheduleType. Automatic reconciliation therefore reports `matched_returned_fields`, never complete proposal verification, and retains the lock even after acknowledgement. Applied recovery is server-blocked until an independent evidence verifier exists; a case-reference string, checkbox and independent approval are insufficient. Production dispatch also requires that unavailable verifier, independently of deployment configuration. Eligibility, authorization coverage and notification behavior require documented human review before any release. No live activation is authorized.


Correction to linked-schedule recovery: applied recovery is server-blocked until a supported independent evidence verifier is integrated. Constant type assertions, reference strings and independent approval alone are insufficient. Previously pending/resolved applied records cannot use the release shortcut. The UI offers no linked recovery form. This operation remains partially reconcilable and is not ready for production activation.

`POST /workspace/schedule-review` accepts `{visitId,kind:"standard"|"linked"}` and only reads owner-enabled operations. It verifies patient office, record identity and shared snapshot fields. Standard review exposes GetScheduleInfo, GetVisitInfoV2 and GetVisitBillInfoV2 separately; V2 supplies temporary flags, budget, suggested times and duration. Nulls remain unknown. Linked review explicitly identifies missing persisted ScheduleType/Comments. No schedule mutation is prepared or submitted by this route.

### Noninteractive deployment parameters

CI generates an ignored, non-secret `functions/.env.primetimehomehealthservices` from reviewed source defaults before deployment. All 24 `PRIMETIME_*_APPROVED` parameters are explicitly false. The HHA endpoint must match both the existing ENT v1.8 default and captured vendor contract. Generation refuses changed approval inventories, enabled defaults, unverified endpoints or an existing parameter file. Credentials are neither read nor written by this step. An agency-specific endpoint, entitlement validation and any future activation require separate review; deployment does not authorize PHI processing or HHA writes.
