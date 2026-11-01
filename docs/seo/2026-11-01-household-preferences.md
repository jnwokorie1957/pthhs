# Household preferences article and article presentation candidate

Prepared against main `0c7eb1c77f6b00346fc90dcb2e23cd85a7e0436b` for the
November 1 request to publish eligible articles and improve article styling.
This is a local candidate, not a claim of a committed or live publication.

Proposed route: `/articles/household-preferences-sheet-nonmedical-home-care`.
The November 1 date in the candidate manifest must match the actual release day.
The source is Library item `libfile_898915f83acc8191a60b815fc64a2e61`.
The public body omits internal release metadata; a subsection uses the existing
H2 renderer, and each blank prompt is a separate selectable-text paragraph.
The existing PAS phrase links to the current service overview. No other prose
or substantive claim is changed. The template remains an optional conversation
aid, not an approved agency procedure, service plan, clinical or eligibility guide.

Sources rechecked November 1: ACL person-centered planning directly; NIA
Talking With Your Older Patients through indexed primary-source retrieval after
the direct page returned a robot-verification screen. Both support the narrowly
attributed communication principles; no medical advice is inferred.

The article renderer alone loads the new stylesheet. Compact hero, readable
72ch body and clearer cards preserve the existing brand, shell and navigation.
A scoped mobile title override defeats the shared mobile important rule, and
the article card retains the shared keyboard focus shadow. Existing published
article bodies, dates and credit remain unchanged. No decorative image is needed.

Release gates: full aggregate build, article regressions, independent source
review, supported rendered desktop/mobile/keyboard/zoom review, then existing
Hosting-only release and ordinary public URL/byte verification. Do not substitute
static source checks for rendered acceptance. Do not use a normal main push:
the current workflow also deploys Functions and website analytics. A source-only
commit must skip CI and must not be described as live. Use the existing manual
`deployment_target=hosting` route only when supported access is available.

Rollback is a scoped reversal of these article/content/style files, regenerated
through the same checks and released by the same Hosting-only process. Keep all
private portal, backend, held release and unrelated working-tree files unchanged.
