# PTHHS `/primetime` backend

This directory contains server-side code for the internal PTHHS management layer.

## Namespace

- Admin UI: `/primetime/*`
- Admin API: `/primetime/api/*`
- Firebase Function entry point: `primetimeApi`
- HHA adapter: `src/integrations/hhaexchange/`
- Vendor-neutral domain models: `src/domain/models.ts`

The backend now contains Firebase ID-token verification and an `admin` custom-claim authorization gate. Do not activate the live Hosting rewrite or HHA-bearing UI calls until Firebase Email/Password Authentication is enabled and the first trusted admin user is claim-authorized.

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
3. Grant that Firebase Auth user an `admin: true` custom claim from a privileged Firebase Admin SDK environment.
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
3. wire the `/primetime` login UI to obtain Firebase ID tokens
4. activate Firebase Functions + the `/primetime/api/**` Hosting rewrite
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
