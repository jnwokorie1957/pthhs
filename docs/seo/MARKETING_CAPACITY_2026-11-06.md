# Marketing build capacity

The owner requested more room for website growth on November 6, 2026.
The static marketing output allowance is now 5,000,000 bytes, with a visible
build warning at 4,000,000 bytes and a hard failure above 5,000,000 bytes.
This is bounded headroom for the article archive, not an unlimited allowance.

The separate lossless social-card optimization preserves every decoded pixel
and saves 42,916 bytes. The eight-article candidate uses 1,968,953 marketing
bytes, leaving 3,031,047 bytes under the new cap. This is a build measurement,
not a claim about traffic, total retained Hosting storage or billing usage.

The protected app's 500,000-byte raw, 128,000-byte gzip estimate and 110,000-byte
per-file limits are unchanged. Image-dimension, responsive-image, lazy-loading,
zero-external-runtime, source integrity, article, accessibility and deployment
boundary checks are unchanged. Five focused tests cover normal growth, exact
warning and limit boundaries, over-limit rejection and invalid accounting.

This change does not alter Firebase quotas, billing plan, budget alerts,
permissions, source-read gates, runtime code or deployed content. Raising this
internal threshold itself does not purchase capacity or incur a charge. Actual
Hosting storage and visitor data transfer remain subject to the existing
account's plan and usage. Current plan and usage were not verified because the
available Firebase console session required sign-in. Official references:

- https://firebase.google.com/pricing
- https://firebase.google.com/docs/hosting/usage-quotas-pricing

These build-tooling paths are not in the automatic Hosting-only allowlist.
Publish a reviewed tooling-only change with `[skip ci]` rather than initiating
an ordinary full backend release. Full checks and independent review must pass
first. No live deployment is needed for this build-only change; the next
authorized release uses this gate. Do not expand the release allowlist, dispatch
backend jobs or change billing as a side effect of capacity maintenance.
