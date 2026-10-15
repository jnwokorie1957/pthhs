# Primetime live-mode Firestore prerequisite

## October 14, 2026 incident

Turning off demo data sends authenticated requests to `/primetime/api/data/status`,
`/primetime/api/integration/health`, `/primetime/api/hha/health` and
`/primetime/api/workspace/settings`. All four need the default Firestore database:
settings and data readiness read owner preferences, integration health reads sync
metadata, and the HHA reference check reserves a shared request budget in storage.
Demo mode does not exercise these dependencies.

The live project `primetimehomehealthservices` initially returned an empty database
list. The default Standard / Native database was subsequently provisioned in
`us-central1`; metadata records creation at `2026-10-14T23:54:54.991783Z`.
Successful Hosting and Functions deployment alone had not established storage
availability.

After provisioning, the approved administrator's existing normal browser session
was reloaded with Demo data off. The live UI showed loaded owner controls,
unconfigured-office readiness rather than a status-loading error, import history
with no successful sync, and **Reference API reachable**. No new warning/error
console entries were captured. Provisioning itself did not enable operational data. The subsequent [read-only release](LIVE_HHA_ACCEPTANCE_2026-10-14.md) enabled operational reads only; the other 28 capability gates remain closed.

## One-time owner action

The production database above already exists. These steps are for a future
missing-database incident; inspect before creating anything.

Use an existing project owner or an operator with `datastore.databases.create`;
repository write access does not grant Firebase database administration.

```sh
firebase firestore:databases:list --project primetimehomehealthservices
firebase firestore:databases:create '(default)' --location us-central1 --project primetimehomehealthservices
firebase deploy --only firestore:rules --project primetimehomehealthservices
```

Create the **Standard / Native mode** database named **`(default)`**. `us-central1`
matches the deployed API region. The location is a persistent infrastructure
choice; if an existing Native default database is found, keep it and inspect its
configuration rather than attempting recreation. In the Firebase console, use
Firestore Database → Create database and select production/locked rules.

The committed rules deny all direct browser/mobile access. Primetime's Admin SDK
uses the runtime service account's IAM permissions through the authenticated API.
Do not enable test-mode rules. An operator must verify that the API runtime
service account has the required Firestore document access if a 403 persists.

The deployment preflight reads only database metadata using deployment
credentials. It rejects a missing or Datastore-mode default database before
deploying Functions. Rules are published separately by an authorized operator;
the Functions deployer does not need Firebase Rules administration. The October
14 deployment reached this check successfully but its attempted Rules publish
returned HTTP 403. Keeping Rules publication separate preserves the existing
locked rules without blocking an unrelated backend release. The preflight neither
creates infrastructure automatically nor proves runtime service-account access.
Run it locally only with existing approved Application Default Credentials:

```sh
node functions/scripts/verify-firestore-deployment.mjs
```

## Acceptance after provisioning

Reload `/primetime` in the existing approved administrator's normal session with
Demo data off. Check the four responses in the browser's Network panel:

- `data/status` and `workspace/settings`: HTTP 200 with current locked/unconfigured
  settings. A new database starts with no office preferences.
- `integration/health`: HTTP 200 with `never_synced` until an import is accepted.
- `hha/health`: perform the existing read-only reference check. A remaining
  vendor/credential/throttle error must be diagnosed separately; database creation
  does not prove HHA connectivity.

Provisioning storage does not change deployment approvals. The reviewed release
now enables operational reads only; source acceptance, monitoring, SMS and all
HHA mutation gates remain closed. Storage availability does not prove a persisted
visit import, source validation or SMS delivery.
Never mint an administrator token or disable authentication for verification.

References: [database management](https://firebase.google.com/docs/firestore/manage-databases),
[server SDK and Security Rules](https://firebase.google.com/docs/firestore/security/get-started).
