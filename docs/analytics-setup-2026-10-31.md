# Website analytics — October 31, 2026

The owner requested GA4 for PTHHS and Ride Primetime, Google indexing checks, and an authenticated website dashboard covering both businesses.

## Properties and streams

| Website | Property | Stream | Measurement ID |
| --- | --- | --- | --- |
| PTHHS | 546711548 | 16244033088 | G-4VE4NM960V |
| Ride Primetime | 561765914 | 16244067646 | G-T9M25PS348 |

Public pages load the deferred first-party `/assets/analytics.js`, which loads Google's standard tag. Only recognized production hostnames and public canonical pages can initialize it. Internal `/primetime` and API routes, noindex pages, preview hosts, Do Not Track and Global Privacy Control visits are excluded. Page locations contain canonical URLs without query strings or fragments. Referrers contain only their origin; internal referrals contain the canonical homepage. Advertising storage, personalization, user data and Google Signals are disabled. No user IDs, form values, medical details, telephone numbers, mail destinations or message contents are sent.

## Event definitions

| Event | Meaning |
| --- | --- |
| `page_view` | A public page load, collected once by the Google tag configuration |
| `session_start`, `first_visit`, `user_engagement` | Google's automatic session and engagement events |
| `scroll` | Google's enhanced 90% depth measurement |
| `phone_click` | Click on a public phone link; no number is included |
| `email_click` | Click on a public email link; no address or message is included |

Automatic outbound-link, form, search, video and download measurement are disabled. Contact clicks indicate intent, not a completed call, delivered email, booking or qualified lead.

## Private dashboard

Open `https://pthhs.net/primetime#analytics`, or choose Website analytics in the operations navigation. Existing administrator sign-in protects the page flow. The reporting function separately verifies a current, unrevoked Firebase identity against the existing owner email or verified phone and rereads the current account. Anonymous access returns HTTP 401. Reports are never embedded in public HTML or browser storage.

The dashboard supports each site's 7, 28 or 90 complete days ending yesterday, the preceding equal period, daily views/sessions, ten leading pages and channels, contact events, and 30-minute live visitors. It displays unavailable states instead of synthetic data. Reporting time zones come from GA4. In-memory server caching lasts 60 seconds and is consulted only after authorization; responses are `private, no-store`. Selectors and sign-out fence pending requests. Cloud Run uses its existing project service identity and read-only Analytics scope. The owner explicitly approved Analytics Data API activation and Viewer access for both properties and reported adding those grants.

The independently deployed `website-analytics` Functions codebase never deploys, modifies or invokes the HHA backend. Deploy it with:

```sh
firebase deploy --config firebase.analytics.json --only functions:website-analytics --project primetimehomehealthservices
```

The standard Hosting rewrite for `/primetime/api/website-analytics` targets this function. Public invocation reaches an owner authentication gate; it does not expose reports anonymously. No service-account key is created or stored in frontend code.

## Runtime access diagnosis

The subsequent [source-contract change](management-layer/ANALYTICS_SOURCE_CONTRACT_2026-10-31.md)
adds strict reports, explicit dates, source-empty/quality evidence and selected
web-stream realtime. Normal push now deploys the existing separate codebase
after site checks using its frozen dependency lock; manual Hosting-only releases
remain unchanged. Both report connections are now verified within the returned
empty-historical/stream-realtime bounds below; populated historical acceptance
remains open.

At October31,20:36UTC, direct read-only checks in the existing signed-in Google
consoles verified the following independently of the earlier reported setup:

- Cloud Run `websiteanalytics` in `us-central1`, project
  `primetimehomehealthservices`, uses the selected default compute identity
  `733708568001-compute@developer.gserviceaccount.com`.
- The Google Analytics Data API is already **API Enabled** in that project.
  No activation or project change is required by this evidence.
- Analytics-only runtime logs report upstream403 with insufficient permissions
  for the property. The protected report returns503; this is not zero traffic,
  successful reporting or an HHA API problem.
- Unfiltered PTHHS property access management lists four Firebase-linked virtual
  users plus the owner; Ride Primetime lists only the owner. Neither lists this
  runtime service account directly. Firebase virtual users can supply inherited
  roles, so a missing direct entry alone does not prove effective permissions.
  The actual PTHHS API denial separately establishes its failed report access.
  A successful Ride report has not been established.

The precise proposed correction is a direct **Viewer** grant to that verified
runtime identity on PTHHS property546711548 and Ride Primetime property561765914,
with **No Cost Metrics** and **No Revenue Metrics**, and email notifications off.
The PTHHS form was prepared for review without clicking Add. Separate action-time
confirmation was requested because this grants access to Google reporting data;
the approved HHA call-source read is a different permission boundary. No new
permission, credential, key, API activation or HHA setting was changed.

That proposed action is now superseded. After release47a9e6c, native21:20-21:22UTC
reads succeed for BOTH properties: actual empty historical reports and a returned
count for each configured web stream, with receipts and explicit date ranges.
PTHHS reports `Etc/GMT+5`; Ride reports `America/Chicago`. Cloud Run still selects
the same verified compute identity. This agent submitted no Google grant or
credential/API/role change, and closed the unsubmitted grant form. The previous
confirmation question is no longer needed. Why the earlier403 changed is unknown.

The source-empty historical cards remain unavailable, with no invented zeroes,
table rows or charts. Native property changes first clear prior realtime/receipt
facts. Actual populated historical calculations and quality/failure/expiry
variants still require GA02/GA03 acceptance in the
[live-data checklist](management-layer/PRIMETIME_LIVE_DATA_CHECKLIST.txt).

The connected analytics plugin separately returned a subscription-required
error; it supplied no property or permission evidence. Diagnosis used the native
Google consoles instead, without extracting browser tokens or credentials.

Primary guidance rechecked October31: Google's
[API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart),
[Firebase linked-user access](https://support.google.com/analytics/answer/9289234),
[effective and direct roles](https://support.google.com/analytics/answer/9305587),
and [response metadata contract](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData).

## Search Console and release verification

PTHHS domain verification already existed; its canonical sitemap was submitted successfully. Google showed 43 indexed URLs at the initial check. Ride Primetime's canonical HTTPS URL-prefix property was verified using `google42b973e2d43e4ad9.html`; the permanent file must remain deployed. Google successfully read its sitemap and discovered 34 URLs; URL inspection confirmed its homepage is indexed. The existing unverified Ride domain property was not removed. Google controls subsequent indexing timing.

Hosting releases preserve the existing production file manifest and replace only reviewed analytics/dashboard files. Ride's production booking page differs from Git main; the release injected only the analytics tag into the existing live booking content. A concurrent PTHHS operations update was incorporated from `fbc16f8`, and the generated dashboard shell retains its latest operations assets.

Validation includes URL/referrer privacy and exclusion tests, contact payload tests, report range/property allowlist and date-range mapping tests, deterministic asset rebuilds, existing operations regression tests, static accessibility/CSP/performance checks, all 40 Ride site tests, menu checks, live HTTPS tags, owner dashboard rendering and anonymous 401 responses. Google reporting and first-event receipt are checked separately from deployment success.
