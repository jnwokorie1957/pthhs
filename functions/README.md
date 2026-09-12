# PTHHS `/primetime` backend

This directory contains server-side code for the internal PTHHS management layer.

## Namespace

- Admin UI: `/primetime/*`
- Admin API: `/primetime/api/*`
- Firebase Function entry point: `primetimeApi`
- HHA adapter: `src/integrations/hhaexchange/`
- Vendor-neutral domain models: `src/domain/models.ts`

The Function is scaffolded but **must not be activated for HHA/PHI-bearing endpoints until the existing `/primetime` authentication mechanism is identified and enforced server-side**.

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

### Current developer action

Create the secret in the confirmed live project:

```bash
firebase functions:secrets:set HHAEXCHANGE_CREDENTIALS --project primetimehomehealthservices
```

When prompted, paste the JSON object above with the real values.

Do not commit the value to Git or a checked-in `.env` file. GitHub Actions Secrets remain appropriate for CI/deployment credentials; HHA runtime credentials belong in Secret Manager and should be accessible only to function(s) that need them.

## Current implementation status

Implemented:

- TypeScript/Firebase Functions backend scaffold
- `/primetime/api` namespace guard
- non-sensitive `/primetime/api/status` scaffold response
- HHA credentials/config contract
- generic SOAP envelope/transport scaffold
- vendor-neutral management domain interfaces
- live Firebase project confirmed as `primetimehomehealthservices`

Next:

1. create `HHAEXCHANGE_CREDENTIALS`
2. identify/enforce existing admin authentication
3. activate Firebase Functions + Hosting rewrite
4. add SOAP response/error parser
5. make the first harmless read-only HHA call

Track completion in `../docs/management-layer/DEVELOPER_TASKS.md` and the root `../README.md` checkpoint.

## Local verification

Use the committed lockfile and Node 22:

```bash
npm ci
npm run check
npm audit --audit-level=high
```

The September 12, 2026 audit found no high/critical advisory. Two moderate
findings remain in an optional Firebase Admin storage dependency path; see the
repository review log before considering any transitive override.
