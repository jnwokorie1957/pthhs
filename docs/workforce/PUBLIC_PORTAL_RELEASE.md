# Public Careers and portal release

Current status: see [November 11 office testing and January launch](OFFICE_TEST_LAUNCH.md). The account-only release below is historical; the owner subsequently authorized the time-limited application test.

November 6, 2026. The owner explicitly authorized publishing the reviewed Careers page and authenticated portals on PTHHS.net, with all changes pushed to Git.

## Published paths and scope

The public homepage already contains the reviewed Caregiver Sign In entry in this branch. The Careers page offers Sign In, account creation and a separate Staff Sign In link. Caregiver access uses /caregiver and staff management uses /primetime/workforce, with same-origin API rewrites to the existing workforceApi service. Portal pages retain noindex/noarchive and their CSP boundaries. Caregiver pages and private API responses use no-store; the staff HTML shell contains no private records. Original marketing navigation, insurance logos and the operational backend remain intact.

This release publishes account access. Application submission, packet collection, identity uploads, retention activation, public opportunity publication and all HHA mutations remain closed. Careers and the signed-in board explain the closed application state; Apply is exposed only if the server later approves intake. New verified accounts receive their minimal office-scoped name directory entry before any application exists. Existing HHA profiles continue using the private verified-email source link and office-held physical identity records.

Existing-caregiver setup additionally waits for the first complete office roster. While preparation runs, the public access screen explains the wait and does not claim to have sent a setup email. The completed-roster readiness flag opens that screen automatically on the next page load. Individual recovery stays generic and quota-limited.

## Release procedure

Review branch checks precede publication. Merge the tested source with automatic release suppressed, then perform the explicit Hosting-only deployment to the existing Firebase site. This avoids an unrelated all-Functions redeployment resetting the live HHA/portal settings. Deploy only the reviewed workforceApi update separately for verified-account registration/readiness and canonical origin. No other HHA/clinical service is redeployed by this procedure.

functions/workforce-deployment.json records the owner's reviewed non-secret portal parameters. The standard parameter preparer now validates its exact inventory, closed code defaults, canonical HTTPS origin, provider names, office and identity-collection prerequisites before writing environment values. This preserves live sign-in on later ordinary releases without opening application or document collection. Existing 29 HHA approval declarations and their independent review remain unchanged.

Password, verification and existing-caregiver recovery return paths use https://pthhs.net after publication. No passwords, reset tokens, real personnel contacts or files are committed. Only the staff owner enters passwords during live acceptance.

Production homepage navigation, canonical caregiver/staff pages, asset hashes, anonymous API denial, current release flags and authenticated access are checked after publication. Actual acceptance evidence is appended when observed.

## Production acceptance — November 6, 2026

Published Firebase Hosting successfully from merged commit dd47352faa651b7c1743bf8c7d70bc11df2abc61. Only workforceApi was separately updated; Cloud Functions reports ACTIVE with canonical https://pthhs.net origin, configured intake office, staff and HHA access enabled, and application/upload collection disabled. No unrelated function was redeployed.

Repository quality run 42304582766 passed both jobs. Local validation passed 887 backend tests and 652 site/tooling/analytics tests (1,539 total), type checking and release verification. The published homepage, Careers, caregiver page, staff page and both account/password modules returned HTTP 200 and matched the Git bytes exactly. Public configuration confirms account access and Google enabled, applications/documents disabled; anonymous application session returns HTTP 401 with no-store.

Browser acceptance followed the actual homepage Caregiver Sign In link to https://pthhs.net/caregiver. Careers Sign In reached the same separate portal; Careers Staff Sign In reached https://pthhs.net/primetime/workforce with Password selected and Email link available. A reload refreshed browser-cached marketing pages after release. Screenshots saved outside Git: published-caregiver-portal.png and published-management-signin.png. Password submission was not repeated on the production domain during this release; prior owner-entered password acceptance is recorded separately.

Initial HHA roster preparation was still running at the release check (1,632 of 1,843 source IDs processed). Public configuration correctly reports existingCaregiverEnrollmentReady=false until completion. Existing-caregiver setup therefore displays its preparation state; it does not claim a setup email was sent prematurely. Daily midnight source refresh remains scheduled. New accounts and existing password sign-in are available independently; applications, identity uploads and public job publication remain closed.

The owner requested the final homepage navigation label **Caregiver Portal**, retaining the same /caregiver destination. The label-only update is included in the final release record.


## Existing caregiver setup readiness follow-up

Observed November 8, 2026 Central time (November 9, 01:47 UTC). The deployed
public `/caregiver/workforce-api/configuration` returns HTTP 200/no-store with
`existingAccessEnabled` and `existingCaregiverEnrollmentReady` true. Accounts,
staff access and Google sign-in remain enabled; applications and document
collection remain disabled. Anonymous application session returns HTTP 401
with no-store.

The live [existing caregiver setup](https://pthhs.net/caregiver?intent=existing)
screen displays **Existing caregiver access** and an enabled **Send portal
access link** button. The earlier preparation message is no longer shown. This
supersedes the dated preparation state above; it does not establish a fresh
roster count or a successful match for any individual.

The release checks the office preparation marker, while an actual request still
requires the existing unique scoped email match and fresh source-profile check.
No email was entered, no link sent, no account created and no password changed
in this verification. Individual enrollment acceptance requires a separately
approved eligible account and owner-controlled credential entry. No permissions,
source records, feature flags or runtime deployment changed for this follow-up.


## Staff sign-in at both workforce URLs

The November 9 Hosting release verified `/workforce` and `/workforce/`
against the reviewed staff shell. The legacy address redirects to
`/workforce` with its query preserved. The caregiver shell and versioned
session script matched Git. The regression confirmed staff startup for both
workforce paths and separate caregiver startup. Portal HTML and configuration
kept noindex/no-store. Anonymous staff and Primetime sessions returned 401.
Existing caregiver setup stayed ready, with applications and documents disabled.

Verify signed-in office and role scope with an existing authorized staff
account at `/workforce/`. Invite lifetime, acceptance and applicant handoff
need separate acceptance.

[PR 17](https://github.com/jnwokorie1957/pthhs/pull/17) · [Quality](https://github.com/jnwokorie1957/pthhs/actions/runs/42673198808) · [Hosting](https://github.com/jnwokorie1957/pthhs/actions/runs/42686922671)
