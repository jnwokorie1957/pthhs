# Fall-back source-duration regression receipt

November 5, 2026. Base: cff098413fa63a71d7f17000fb460cb4471b8c8c.

Backlog v101 section 75's proposed preservation checks now have eight synthetic
tests against both readable source and generated data-source.js, run separately
under UTC, America/Chicago and Pacific/Auckland (24 passing executions).
They preserve exact source actual/rounded hours, including zero; distinguish
empty from unknown; refuse elapsed-time substitution across repeated clocks;
preserve values through JSON replay and fresh display contexts; and label
offset-free spans as written times rather than actual hours.

The complete local npm release gate passed with all three zones, metadata,
sitemap, article, accessibility, performance and repository checks. Windows QA
used Python UTF-8 mode to match the Linux release locale. No runtime, generated asset, source-read
admission, record, permission or business-rule change is part of this patch.
Serialization is synthetic, not authenticated persistence acceptance. Native,
source-contract, payable-time and broader fall-back workflow acceptance remain
pending. Publication/CI outcomes must be checked separately from these tests.
