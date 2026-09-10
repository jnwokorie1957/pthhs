# Blog Service-Scope Triage

**Triage date:** September 10, 2026  
**Decision:** All 24 imported WordPress articles and four legacy pagination indexes are temporarily quarantined from indexing and redirected to the verified Resources landing page pending article-level rewrite and source review.

## Why the archive was quarantined

The imported posts repeatedly contain nursing, wound care, medication administration/management, therapy, medical-attention, diagnosis, treatment, or Medicare language that may be educational in another context but is unsafe beside PTHHS service marketing without careful framing. The old articles also retain legacy WordPress metadata and comment UI.

## Required article-level disposition

Each post must receive one of four outcomes before republication:

- **Rewrite:** Retain the topic only when it can be supported with authoritative sources and clearly separated from PTHHS's non-medical PAS scope.
- **Disclaimer and contextual edit:** Keep limited educational references while explicitly stating that PTHHS does not provide the clinical service.
- **Redirect:** Point the URL to a verified service/resource page when the old topic creates search-intent confusion.
- **Retire:** Keep the URL redirected when the topic cannot be made relevant and safe.

## Publication checklist

- Accurate title, H1, description, canonical, author/reviewer, sources, and review date.
- No implication that PTHHS diagnoses, treats, administers medication, or provides skilled services.
- No unverified payer, credential, outcome, award, or quantitative claims.
- No open comment form or unreviewed testimonial content.
- Passes `scripts/verify_batch_a.py` before release.

The affected URL inventory is maintained in `scripts/batch_a_remediation.py` as `BLOG_SLUGS`, which is also used to verify noindex and redirect coverage.
