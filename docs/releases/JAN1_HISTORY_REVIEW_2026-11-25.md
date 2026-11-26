# January 1 release: November 25 history reconciliation
Reviewed main: `ca4a9f7b7501ec3f707696dd818999258f6151b1`. This is operator evidence only; production publication and later portal phases remain held. The reported calendar failure made no deployment. The scheduled production selector still refuses the audited history.

## What was delivered
The last full delivery in this interval was run 45066249129 at 4c1149a. The 20 subsequent main workflow runs each had exactly three skipped deployment jobs. All 21 runs were first attempts; the GitHub jobs API returned complete job lists. This is Actions evidence only. Independently the Firebase Hosting live-channel API identified version d9b13bf09c70ed12 released at 2026-11-25T04:00:28.379Z. The [security release record](../security/README.md) documents that separate policy-only Hosting release from the previous live manifest. It is not a new full delivery or a source baseline for the other two components.

| Main workflow run | Source | Event | Result | Verify release scope step | Hosting/backend/analytics |
|---|---|---|---|---|---|
| [45066249129](https://github.com/jnwokorie1957/pthhs/actions/runs/45066249129) | 4c1149a18a51 | push | success | success | deploy_backend:success, build_and_deploy:success, deploy_website_analytics:success |
| [45066610993](https://github.com/jnwokorie1957/pthhs/actions/runs/45066610993) | 3325d14745c2 | push | success | skipped | all skipped |
| [45067293829](https://github.com/jnwokorie1957/pthhs/actions/runs/45067293829) | 7e80baf71755 | push | success | skipped | all skipped |
| [45067810612](https://github.com/jnwokorie1957/pthhs/actions/runs/45067810612) | f497793404ec | push | success | success | all skipped |
| [45068434706](https://github.com/jnwokorie1957/pthhs/actions/runs/45068434706) | 38418a39a125 | push | success | success | all skipped |
| [45098954087](https://github.com/jnwokorie1957/pthhs/actions/runs/45098954087) | e6ea21c9aaaf | push | success | success | all skipped |
| [45099839459](https://github.com/jnwokorie1957/pthhs/actions/runs/45099839459) | c594e4ad9f7a | push | success | success | all skipped |
| [45100890382](https://github.com/jnwokorie1957/pthhs/actions/runs/45100890382) | cca0676b36a6 | push | success | success | all skipped |
| [45101754252](https://github.com/jnwokorie1957/pthhs/actions/runs/45101754252) | 6330ac23c3e9 | push | success | success | all skipped |
| [45233045936](https://github.com/jnwokorie1957/pthhs/actions/runs/45233045936) | 6330ac23c3e9 | schedule | success | skipped | all skipped |
| [45449607680](https://github.com/jnwokorie1957/pthhs/actions/runs/45449607680) | 6330ac23c3e9 | schedule | success | skipped | all skipped |
| [45529112319](https://github.com/jnwokorie1957/pthhs/actions/runs/45529112319) | 405ae920dbc5 | push | success | success | all skipped |
| [45531274060](https://github.com/jnwokorie1957/pthhs/actions/runs/45531274060) | 2c6d33592720 | push | success | success | all skipped |
| [45537095810](https://github.com/jnwokorie1957/pthhs/actions/runs/45537095810) | ef66bf6d1630 | push | success | success | all skipped |
| [45541364426](https://github.com/jnwokorie1957/pthhs/actions/runs/45541364426) | a28699759eaa | push | failure | failure | all skipped |
| [45543904995](https://github.com/jnwokorie1957/pthhs/actions/runs/45543904995) | 8c15af1f6dba | push | success | success | all skipped |
| [45544105784](https://github.com/jnwokorie1957/pthhs/actions/runs/45544105784) | 2b4f2001f0f7 | push | success | success | all skipped |
| [45642037469](https://github.com/jnwokorie1957/pthhs/actions/runs/45642037469) | 3ca8601aac1b | push | failure | failure | all skipped |
| [45642988257](https://github.com/jnwokorie1957/pthhs/actions/runs/45642988257) | 438a1434a021 | push | success | success | all skipped |
| [45643774885](https://github.com/jnwokorie1957/pthhs/actions/runs/45643774885) | 743c406a5189 | push | success | success | all skipped |
| [45660973215](https://github.com/jnwokorie1957/pthhs/actions/runs/45660973215) | ca4a9f7b7501 | schedule | success | skipped | all skipped |

## First-parent source review
- 3325d14 (#55): added the authorization-security test to the release runner alongside 52 other paths. The run succeeded during the hold but skipped the scope-verification step. The added test remains; this was not an isolated control rollout.
- f497793 (#58): changed only six release-control paths for the January 1 hold. Scope verification passed with no delivery.
- a286997: pinned the Hosting action, changed how both backend deployment jobs write credentials, and adjusted the associated release test. The same commit included three non-control paths. Run 45541364426 failed scope; no component shipped through it. Preserve the credential hardening.
- 3ca8601 (#68): mixed a runner edit with seven calendar paths. Run 45642037469 failed scope; nothing shipped. The direct successor 438a143 (#69) restored only scripts/build-and-verify.sh. Its Git blob d4206f9b966d44d3f755f2e37854efe4801b6f37 equals the pre-#68 blob and the reviewed head's blob. Scope verification passed; nothing deployed. #70 registered the calendar tests via the existing suite; its push scope passed without delivery.

## Read-only verification
Replayed deliveryBaselines with the actual GitHub run and job lists: it stopped on the failed workflow. Separately exercised scheduledPlan against the last full Actions delivery and the checkout's real first-parent graph: it refused mixed release-control history. That diagnostic did not substitute a production baseline or authorize a release. The publication-window, push-scope, scheduled-scope and Hosting-only suites passed all 96 tests. A green pre-launch scheduled run skipped the selection step and is not launch clearance.

## Decision needed
The [current policy](STAFF_RELEASE_POLICY.md) has no operator receipt for this combination of failed runs, mixed main commits and an independently changed Hosting baseline. The marketing-only Hosting receipt is inapplicable. A forward fix or revert cannot remove these historical facts. Do not rerun, force-push, manufacture a fresh push to trigger deployment, or promote a baseline to the reviewed head.

**Proposed separate approval:** authorize preparing a control-only PR for a narrowly scoped, machine-verifiable reconciliation path. A reviewer would attest the exact three exceptional main edges, two failed first-attempt runs and independent per-component production evidence. The verifier must re-fetch complete jobs, require no delivery on each failed run, check the exact source/parent/tree and reviewed control deltas, preserve normal checks for every other edge, and stop on missing or stale evidence. Independently reconcile the live Hosting file manifest/configuration and backend/analytics inventories before accepting any baseline. Test changed inputs, missing evidence and partial deliveries as refusals; prove the control-only push selects no deployment; perform a read-only replay on the actual candidate. No January 1 readiness claim until that replay succeeds. This record does not request early publication or approve changing policy.
