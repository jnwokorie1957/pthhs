# PTHHS Schema Audit Report
**Date:** 2026-08-25 16:45 UTC
**Status:** Complete — production schema verified; no unsupported additions required.

## Production Schema Evidence (Homepage)
Fetched from https://pthhs.net/ on 2026-08-25.

Exact schema present (application/ld+json):

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": "https://www.pthhs.net/#business",
      "name": "Primetime Home Health Services, Inc.",
      "url": "https://www.pthhs.net/",
      "telephone": "+1-713-977-7721",
      "email": "pas@pthhs.net",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "11602 Burdine St, Suite A",
        "addressLocality": "Houston",
        "addressRegion": "TX",
        "postalCode": "77035",
        "addressCountry": "US"
      },
      "areaServed": ["Houston", "Katy", "Sugar Land", "Greater Houston"],
      "sameAs": [
        "https://www.facebook.com/primetimehomehealth/",
        "https://www.instagram.com/primetimehomehealthservices/"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://www.pthhs.net/#website",
      "url": "https://www.pthhs.net/",
      "name": "Primetime Home Health Services, Inc."
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What type of home care does Primetime provide?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Primetime focuses on non-medical personal assistance services such as attendant care, help with activities of daily living, personal care, respite care and approved medication reminders."
          }
        },
        {
          "@type": "Question",
          "name": "Does Primetime work with Medicaid health plans?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Primetime works with multiple Texas Medicaid and managed-care plans. Network participation and authorization requirements can change, so families should contact Primetime to confirm the current status of their plan."
          }
        },
        {
          "@type": "Question",
          "name": "What areas does Primetime serve?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Primetime serves eligible clients across Greater Houston and surrounding communities within its current coverage area."
          }
        },
        {
          "@type": "Question",
          "name": "How do I start home care services?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Contact Primetime with the client location, requested service and health-plan information. The agency can explain its process and coordinate services once required eligibility and authorization are in place."
          }
        }
      ]
    }
  ]
}
```

## Findings
- Schema is present and accurate for a non-medical PAS / Medicaid home care provider.
- No clinical/home-health terminology, Medicare claims, or doctor-developed treatment plans asserted.
- FAQ content aligns with verified service scope (non-medical attendant care, PAS, respite).
- One inconsistency: schema @id and url fields point to https://www.pthhs.net/ while production canonical domain is pthhs.net (matches known canonical mismatch already logged in technical_crawl and production_html_verification).
- No evidence of schema on other fetched pages in current verification set.

## Safe Patch Assessment
- No high-risk or unsupported schema additions identified.
- No payer-specific contract claims or unverified service scope statements present.
- The existing schema is low-risk and consistent with visible content.
- Minor recommendation (repo-only, non-production): align schema @id/url with canonical pthhs.net domain for consistency. This is optional and not a sitemap blocker.
- No new schema markup is required or authorized beyond current verified content.

## Conclusion
Schema audit complete. No blocking issues. Existing markup is appropriate and within safe bounds. No further schema changes needed before sitemap consideration.

**Evidence Location:** PTHHS_PRODUCTION_HTML_VERIFICATION.md (homepage fetch) + this report.
