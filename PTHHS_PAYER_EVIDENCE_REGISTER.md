# PTHHS Payer Evidence Register

**Last reviewed:** September 29, 2026 (America/Chicago)

## Owner-approved website display

The owner explicitly confirmed in the project conversation on September 22 that the insurance providers and their logos are approved and that the agency works with all of them. On September 29, the owner explicitly directed restoration of the original logos from commit history. This supersedes the earlier blanket suppression instruction for the six images below. Do not remove these approved logos merely because confidential contracts are not committed to a public repository.

| Previously displayed payer/program | Website display approval | Original Git blob |
|---|---|---|
| Wellpoint | Owner-confirmed; restore original | `a44fd90bfc589abff932c1e09b14bf52f32de4e9` |
| Molina Healthcare | Owner-confirmed; restore original | `c726e19ffb8f377cca77beb867c37df540b7a0ab` |
| UnitedHealthcare | Owner-confirmed; restore original | `747236ed42cf98ee9dc65db5b554ab56a4440a38` |
| Medicaid | Owner-confirmed; restore original | `76c0fd9c4de73551072243f5f9796aaa2d37a11c` |
| Texas Children's Health Plan | Owner-confirmed; restore original | `05c5ef37ecbfded2eb67d0fd46d5962a5ac23c99` |
| Community Health Choice | Owner-confirmed; restore original | `d154921348ba4031eb6a3f881d0da2c04ded54bf` |

## Recovery provenance

Source: `178ab2a68c1c69dbedca32de11b4f06465c67c01`, the immediate parent of `311c0a63184e04d2e80c8e8a28e35148085cba9e` ("Suppress unverified payer logo wellpoint.png"). The remaining five image-suppression commits followed it. Commit `9731c3289ee1fd1ba4e37ebd70e565855839b30b` then suppressed the homepage grid; `bec65e3839abcc5f300ffc8cdc03f2001fe14a70` retained that suppression while resolving the homepage conflict.

The recovery restores the original binary blobs, not recreated logos or text substitutes. Both the homepage and insurance page must display the full original set. `scripts/verify-insurance-logos.mjs` verifies their exact hashes, usable dimensions, accessible labels, and page references. Versioned image URLs avoid stale cached placeholder responses.

## Scope and continuing checks

This records owner authorization and the owner's confirmation of the relationships. It does not claim that contracts, effective dates, rates, or provider directories were independently inspected. Do not infer coverage for every member, program, service, or location. Keep the existing individual eligibility and authorization explanation. The administrator should update the site when relationships change; new payer claims require administrator approval. Confidential contracts remain outside the public repository.
