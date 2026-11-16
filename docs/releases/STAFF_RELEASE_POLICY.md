# Staff portal releases and session security

Owner instruction, November 15, 2026: protect active work; use midnight Central for releases that cannot safely run while the portal is in use.

Ordinary pushes to main queue for the midnight America/Chicago window. Two UTC cron entries cover Central standard and daylight time; the local-hour guard permits only midnight. Scheduled runs compare code and site changes with the last verified full deployment and skip unchanged releases. Deferred, partial and Hosting-only runs do not count as a full deployment.

A reviewed, backward-compatible release may run during office hours when its merge/commit message contains `[compatible]`. Put this marker in the PR title only after verifying compatibility with already-open portal pages and previous record formats. The current presentation update preserves existing API fields, handles old and new PDF page layouts and does not force reloads. Breaking API, schema, session or document changes must not use this marker. Existing explicit manual releases remain Hosting-only; they cannot deploy backend services.

Production workflows run serially and do not cancel a deployment midway. All deployment jobs use the exact selected source SHA. Midnight is a scheduled start window, not a guarantee of a zero-delay completion: GitHub can delay scheduled jobs during heavy load. See [GitHub scheduling guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Newly loaded staff portal pages warn after 28 minutes without interaction and sign out after 30. Trusted keyboard, pointer, wheel or touch activity resets the timer. Background reads and token refreshes do not. Same-user tabs share activity through a same-origin channel without sending record information. Returning to a background tab checks expiry immediately. Sign-out uses the existing Firebase handler and clears private workspace content. Existing recent-login requirements and encrypted private document storage remain in force.

Reusable signature appearances do not authenticate a signer or reuse consent. Each signer reviews each document, applies their own appearance to the relevant fields, and confirms electronic signing. Signed documents remain locked; corrections create a new audited copy.
