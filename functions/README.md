# PTHHS `/primetime` backend

This directory contains server-side code for the internal PTHHS management layer.

## Namespace

- Admin UI: `/primetime/*`
- Admin API: `/primetime/api/*`
- Firebase Function entry point: `primetimeApi`
- HHA adapter: `src/integrations/hhaexchange/`
- Vendor-neutral domain models: `src/domain/models.ts`

The Function is scaffolded but **must not be activated for HHA/PHI-bearing endpoints until the existing `/primetime` authentication mechanism is identified and enforced server-side**.

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

### Recommended secret setup

Use Google Cloud Secret Manager / Firebase Functions secrets in the **confirmed live Firebase project**. Do not commit the value to Git and do not use a checked-in `.env` file as the production secret store.

Interactive Firebase CLI flow:

```bash
firebase functions:secrets:set HHAEXCHANGE_CREDENTIALS --project <CONFIRMED_PROJECT_ID>
```

When prompted, paste the JSON object above with the real values.

GitHub Actions Secrets should remain for CI/deployment credentials; the HHA runtime credentials should live in Secret Manager and be granted only to the function(s) that need them.

## Current blocker before deployment

The repository currently references two Firebase project IDs:

- `.github/workflows/deploy-firebase.yml` deploys Hosting to `primetimehomehealthservices`
- `.firebaserc` defaults to `pthhs-net`

Confirm which project serves the live `/primetime` panel before adding the Hosting rewrite or deploying `primetimeApi`.

## Current implementation status

Implemented:

- TypeScript/Firebase Functions backend scaffold
- `/primetime/api` namespace guard
- non-sensitive `/primetime/api/status` scaffold response
- HHA credentials/config contract
- generic SOAP envelope/transport scaffold
- vendor-neutral management domain interfaces

Next:

1. confirm live Firebase project
2. create `HHAEXCHANGE_CREDENTIALS`
3. identify/enforce existing admin authentication
4. activate Firebase Functions + Hosting rewrite
5. add SOAP response/error parser
6. make the first harmless read-only HHA call

Track completion in `../docs/management-layer/DEVELOPER_TASKS.md` and the root `../README.md` checkpoint.
