# PTHHS Claim-Verification Release Gate

**Effective:** September 10, 2026; owner-attestation update September 11, 2026
**Status:** Required for every website release until the migration and governance backlog is complete

A release is blocked when an indexable public page contains any of the following without documented approval:

1. A claim that PTHHS provides skilled, clinical, nursing, treatment, therapy, wound-care, diagnosis, or medication-administration services.
2. A named payer/network participation claim or payer logo without current evidence in `PTHHS_PAYER_EVIDENCE_REGISTER.md`. The September 11, 2026 business-owner attestation is recorded evidence for the six approved names and logos only.
3. An award, ranking, customer count, satisfaction rate, guarantee, precise founding date, or years-in-business claim without a dated source. The business owner's September 11, 2026 attestation approves the 1999 and 25-plus-year history claims only.
4. A testimonial without a documented public source, attribution, publication approval, and privacy treatment in `PTHHS_REVIEW_SOURCE_REGISTER.md`.
5. Contact information that conflicts with `PTHHS_PUBLIC_FACTS.json`.
6. A malformed, relative, `www`, or non-HTTPS canonical/OG URL.

## Required checks

- Run `python3 scripts/verify_batch_a.py`.
- Review the generated sensitive-term report and any permitted-context exceptions.
- Confirm all quarantined articles remain noindex and redirected away from public discovery.
- Require a human compliance/administrative review before publishing a new regulated-service or payer claim not covered by `PTHHS_OWNER_ATTESTATION.md`.

The automated gate detects likely violations; it does not replace business, compliance, privacy, HR, or legal review.
