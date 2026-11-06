# Public Careers and portal release

November 6, 2026. The owner explicitly authorized publishing the reviewed Careers page and authenticated portals on PTHHS.net, with all changes pushed to Git.

## Published paths and scope

The public homepage already contains the reviewed Caregiver Sign In entry in this branch. The Careers page offers Sign In, account creation and a separate Staff Sign In link. Caregiver access uses /caregiver and staff management uses /primetime/workforce, with same-origin API rewrites to the existing workforceApi service. Portal pages retain noindex/noarchive, no-store and their private CSP boundaries. Original marketing navigation, insurance logos and the operational backend remain intact.

This release publishes account access. Application submission, packet collection, identity uploads, retention activation, public opportunity publication and all HHA mutations remain closed. Careers and the signed-in board explain the closed application state; Apply is exposed only if the server later approves intake. New verified accounts receive their minimal office-scoped name directory entry before any application exists. Existing HHA profiles continue using the private verified-email source link and office-held physical identity records.

Existing-caregiver setup additionally waits for the first complete office roster. While preparation runs, the public access screen explains the wait and does not claim to have sent a setup email. The completed-roster readiness flag opens that screen automatically on the next page load. Individual recovery stays generic and quota-limited.

## Release procedure

Review branch checks precede publication. Merge the tested source with automatic release suppressed, then perform the explicit Hosting-only deployment to the existing Firebase site. This avoids an unrelated all-Functions redeployment resetting the live HHA/portal settings. Deploy only the reviewed workforceApi update separately for verified-account registration/readiness and canonical origin. No other HHA/clinical service is redeployed by this procedure.

functions/workforce-deployment.json records the owner's reviewed non-secret portal parameters. The standard parameter preparer now validates its exact inventory, closed code defaults, canonical HTTPS origin, provider names, office and identity-collection prerequisites before writing environment values. This preserves live sign-in on later ordinary releases without opening application or document collection. Existing 29 HHA approval declarations and their independent review remain unchanged.

Password, verification and existing-caregiver recovery return paths use https://pthhs.net after publication. No passwords, reset tokens, real personnel contacts or files are committed. Only the staff owner enters passwords during live acceptance.

Production homepage navigation, canonical caregiver/staff pages, asset hashes, anonymous API denial, current release flags and authenticated access are checked after publication. Actual acceptance evidence is appended when observed.
