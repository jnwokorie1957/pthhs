# PTHHS Performance Budgets

**Effective date:** September 12, 2026
**Scope:** Public marketing pages only; the separately governed `/primetime`
operations interface is excluded.

## Release thresholds

The machine-readable source of truth is `performance-budgets.json`.

| Measure | Budget | Enforcement |
| --- | ---: | --- |
| Largest Contentful Paint (LCP) | ≤ 2,500 ms | Mobile Chromium lab run on representative routes |
| Cumulative Layout Shift (CLS) | ≤ 0.10 | Mobile Chromium lab run on representative routes |
| Interaction to Next Paint (INP) | ≤ 200 ms | Mobile Chromium interaction sample on representative routes |
| JavaScript transferred per route | ≤ 12,000 bytes | Mobile Chromium resource timing |
| Images transferred per route | ≤ 250,000 bytes | Mobile Chromium resource timing |
| Marketing JavaScript in deploy output | ≤ 10,000 bytes | Every deterministic build |
| All image files in deploy output | ≤ 800,000 bytes | Every deterministic build |
| Largest individual image | ≤ 70,000 bytes | Every deterministic build |

The LCP, CLS, and INP thresholds use the established “good” Core Web Vitals
boundaries. Lab measurements are regression gates, not a substitute for real
visitor field data. When analytics and sufficient traffic are available,
review 75th-percentile field values separately before changing these budgets.

## Coverage and operation

- Eleven representative mobile routes cover Home, Services, Service Detail,
  Areas, Location, Insurance, Contact, Careers, Reviews, Resources, and Blog.
- `npm run check` enforces deterministic deploy-size limits without requiring a
  browser.
- `npm run check:browser` serves the built site locally and runs responsive plus
  performance checks in Chromium.
- Pull-request CI installs a pinned Chromium runtime and fails when any route or
  deploy threshold regresses.
- The initial full generated image set was 1,007,525 bytes. Palette optimization
  of the required Open Graph PNGs reduced it to 733,780 bytes (27.2%) before the
  800,000-byte budget was fixed, preserving reasonable headroom without masking
  the excess.
- Threshold changes require an explanation in this register and must never be
  used merely to make a failing build pass.
