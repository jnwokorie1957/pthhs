# PTHHS Browser Accessibility QA

**Automated review date:** September 12, 2026

## Coverage

The browser gate covers the eleven required public templates: Home, Services,
Service Detail, Areas, Location, Insurance, Contact, Careers, Reviews,
Resources, and Blog. It runs axe-core at mobile and desktop widths and exercises
the skip link, mobile navigation, Escape behavior, focus return, runtime errors,
landmark visibility, and content overflow.

Reflow is tested at effective widths of 640 CSS pixels (the 200% equivalent for
a 1280-pixel viewport) and 320 CSS pixels (the 400% equivalent). The gate fails
for document-level horizontal scrolling, clipped visible text, missing
landmarks, off-screen primary actions, or unavailable mobile navigation.

## Human review still required

Automated checks cannot determine whether every accessible name is the clearest
choice, whether screen-reader announcements are understandable in context, or
whether the complete experience remains comfortable under varied assistive
technology. Item 84 therefore remains open until a human completes keyboard,
screen-reader, and visual review of the same templates and records the browser,
assistive technology, findings, repairs, and review date here.

The automated gate supplements rather than replaces the existing static
accessibility checks and must not be disabled to permit a release.
