# PTHHS Structured Navigation Register

**Reviewed:** September 11, 2026  
**Scope:** Plan items 58, 59, 66, and 67

## Selective Service schema

Exactly five verified non-medical routes receive a minimal `Service` node:

- Personal assistance service overview
- Activities of Daily Living assistance
- Attendant care services
- Personal care assistance
- Respite care

Each node is limited to the visible page name and description, canonical URL, controlled non-medical service type, and the verified PTHHS organization reference. It deliberately omits payer participation, area served, prices/offers, clinical capabilities, credentials, ratings, reviews, awards, history, and quantitative marketing claims.

Medication reminders remain outside the Service-schema allowlist because its health-adjacent wording merits the more conservative WebPage-only treatment.

## Breadcrumb coverage

Semantic ordered-list breadcrumbs and matching `BreadcrumbList` nodes are generated for:

- Five canonical service-detail routes
- 65 indexable location routes
- The retained home-care information index

The first-party hierarchy is Home → Services → service, Home → Areas We Serve → location, or Home → Home Care Information. The final visible item is marked as current and the final schema item relies on the containing page URL, following Google's documented pattern.

## 404 and crawler policy

Firebase Hosting documents that an unmatched request uses `public/404.html` as a custom 404 response. PTHHS has that file, no catch-all rewrite, a noindex directive, modern navigation, and Home, Services, Areas, and Contact recovery paths.

The generator writes one root-level `robots.txt` policy with one fully qualified canonical sitemap directive. Search Console submission and live canonical-host validation remain separate blocked items.

## Release control

The structured-navigation gate validates the exact Service allowlist, prohibited schema fields, visible/schema breadcrumb agreement, canonical URLs, sequential positions, custom 404 recovery paths, Firebase rewrite safety, sitemap exclusion, and the single canonical robots directive.

## Implementation references

- Google Search Central, [Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb), reviewed September 11, 2026
- Schema.org, [Service](https://schema.org/Service), reviewed September 11, 2026
- Firebase, [Customize a 404/Not Found page](https://firebase.google.com/docs/hosting/full-config#customize_a_404not_found_page), reviewed September 11, 2026
- Google Search Central, [How to write and submit a robots.txt file](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt), reviewed September 11, 2026
