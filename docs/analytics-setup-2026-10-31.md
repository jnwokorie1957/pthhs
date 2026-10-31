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

## Search Console and release verification

PTHHS domain verification already existed; its canonical sitemap was submitted successfully. Google showed 43 indexed URLs at the initial check. Ride Primetime's canonical HTTPS URL-prefix property was verified using `google42b973e2d43e4ad9.html`; the permanent file must remain deployed. Google successfully read its sitemap and discovered 34 URLs; URL inspection confirmed its homepage is indexed. The existing unverified Ride domain property was not removed. Google controls subsequent indexing timing.

Hosting releases preserve the existing production file manifest and replace only reviewed analytics/dashboard files. Ride's production booking page differs from Git main; the release injected only the analytics tag into the existing live booking content. A concurrent PTHHS operations update was incorporated from `fbc16f8`, and the generated dashboard shell retains its latest operations assets.

Validation includes URL/referrer privacy and exclusion tests, contact payload tests, report range/property allowlist and date-range mapping tests, deterministic asset rebuilds, existing operations regression tests, static accessibility/CSP/performance checks, all 40 Ride site tests, menu checks, live HTTPS tags, owner dashboard rendering and anonymous 401 responses. Google reporting and first-event receipt are checked separately from deployment success.
