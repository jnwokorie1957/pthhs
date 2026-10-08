# Integration review and reusable capability boundaries

Review baseline: main `99aa256df7a14d1eb13894aa5b904665e2199a69`, checked October 8, 2026. This isolated patch is not published. No identities, claims, permissions, production configuration, storage, or vendor records were changed. No protected production API or HHA calls were made.

## Implemented, deployed, verified

| Area | Implemented evidence | Deployment evidence | Actually verified / limitation |
| --- | --- | --- | --- |
| HHA transport and configuration | `functions/src/integrations/hhaexchange/config.ts`; backend secret binding and ENT v1.8 endpoint | Functions deploy log reports successful deployment | Configuration identifiers present; secret contents, current validity and account entitlement not inspected |
| Admin session and protected reads | `functions/src/index.ts`, `operations/reads.ts`, `public/primetime/workspace.js`; server authorization plus owner/deployment read gates | Hosting succeeded; Functions deployed with later cleanup-policy error | CI anonymous boundary passed six checks; approved administrator normal-session acceptance remains blocked |
| HHA reference check | `/hha/health` calls GetCollectionStatus through durable read throttling | Same Functions deployment | No production reference request in this review; Firestore/throttle/config failure can precede vendor contact |
| Mutations | Typed proposals, approval, locking, audit/readback paths | Same source revision deployed | All 24 source approval defaults and generated CI parameters remain false. Effective current runtime flags not independently inspected. CreateLinkedSchedule has an additional hard false verifier |
| Firebase Functions | `primetimeApi`, us-central1 | CI says Functions successfully deployed, then failed artifact cleanup-policy setup | Overall workflow remains failed; deployment is not end-to-end acceptance. Do not use force or change cleanup/IAM policy implicitly |
| Storage and privacy | Firestore repository, sync state/cursors, transaction locks, bounded DTOs and session clearing | Backend code deployed | Actual storage provisioning, retention, access configuration and agency privacy/BAA acceptance not verified; no PHI inspected |
| UI | Auth gate, operational forms and inventory; overview includes explicitly labeled demonstrations | Hosting job succeeded | Local mocked tests only for this patch; a reference response cannot validate imports, summaries, schedules or writes |

Current CI evidence: [run 37328749498](https://github.com/jnwokorie1957/pthhs/actions/runs/37328749498), Hosting job 111826095171 success; backend job 111826095602 failure. Logs rechecked October 8: 137 backend tests passed on Node 22; deployment succeeded before cleanup-policy failure; protected verifier exited 2 with BLOCKED and did not select an administrator, create credentials, or call protected endpoints. This is October 5 execution evidence rechecked today, not a new execution.

## Smallest blockers

1. Exact approved administrator in a normal sign-in session: UID, mailbox verification, disabled status, provider and existing claims must be reviewed through the authorized process. The intended mailbox `jnwokorie@pthhs.net` is not proof of an approved identity. No bootstrap script or custom token substitute.
2. Existing authorized operator verifies non-secret backend/storage readiness and effective gates. A storage/rate-limit failure is not proof of invalid HHA credentials. Resolve the separate artifact cleanup-policy issue through a reviewed infrastructure decision.
3. Only after normal-session acceptance is authorized, perform the explicitly approved reference check and record sanitized result. It establishes that one operation only. Operational reads require owner enablement, privacy approval and account entitlement separately.
4. Vendor-contract and persisted-state gaps still block unsupported operations. Do not infer authorization from WSDL presence or fabricate schedule types, discipline IDs, EVV settings or billing values.

## Safe UI patch

The prior UI accepted any HTTP-success `{ok:true}` as HHA reachability and collapsed distinct failure classes into one message. It now requires the expected operation and `reachable` status, separates session rejection, vendor authentication, operation failure and unavailable/deferred state, and uses fixed messages instead of raw vendor details. Static labels no longer claim the adapter is absent. Reference reachability remains explicitly separate from verified imports. Keyboard Refresh restores focus after temporary disabling only in the same session and if the user has not moved focus elsewhere. No backend, routing, flags or call timing changes.

Validation: 21 focused frontend tests passed (14 existing plus seven added health cases), including asset hashes, session races, file/session boundaries and read filters. Node 24 local tests used `--test-isolation=none` because sandbox child-process spawning is restricted. Local Chrome at 390 and 1440 pixels passed horizontal-overflow, keyboard Refresh and page-error checks; all requests were intercepted with fixtures and no real identity. `git diff --check` passed. The 137 backend tests are prior CI evidence, not a fresh local backend run; backend files are unchanged. No production acceptance is claimed.

## Reusable capability map for the separate original prototype

The new standalone prototype is owned by task `01a11963-90c4-7070-86ff-86fdbd2c2010`; this review does not duplicate it or connect it to production.

| Capability | Reusable existing foundation | Remaining product work |
| --- | --- | --- |
| Identity and permissions | Server-verified admin sessions and fail-closed gates | Agency/office/role policy; caregiver/member access; tenant isolation and negative authorization tests |
| Members and caregivers | Typed source searches, normalized fields, preferences/availability | Original lifecycle models, consent, restricted matching and authoritative ownership rules |
| Scheduling and authorizations | Schedule/authorization reads; proposal/audit patterns | Native scheduling engine, overlap/timezone/units rules, authorization balances, conflict resolution; six documented high-impact contract gaps remain |
| EVV | Source visit reads, sync cursor and exception-rule foundations | Original capture/maintenance workflow, provenance, offline reconciliation, state adapter and approval evidence |
| Billing and payroll exports | Billed-visit, payroll batch and rate source reads | Reconciled exports, mappings, idempotency and approval; no claim submission or payroll execution implied |
| Reporting and audit | Bounded DTOs, audit events, transaction locks, import health | Real approved datasets, reconciliation/freshness indicators, retention and operational support; demo cards are not real reports |

Captured contract accounting is non-overlapping: 222 operations = 144 workspace reads + 3 adapter-only reads + 15 missing reads + 23 prepared mutations + 37 missing mutations. Three workspace reads and all three adapter-only reads remain vendor blocked. Prepared mutations comprise 22 gated dispatch paths and the separately blocked CreateLinkedSchedule. This is coverage of a captured contract, not 222 working capabilities.

Recommended boundaries: keep an original domain model for agency, member, caregiver, authorization, schedule and visit; expose vendor-independent read and command interfaces; translate through an HHA adapter. Retain vendor IDs and source/version timestamps as provenance, not primary product identities. Use append-only audit events and an outbox/idempotency boundary for later external writes, with explicit reconciliation of ambiguous outcomes. Reuse reviewed patterns and tests, not HHA proprietary code, UI, branding or unlicensed assets.

Phases: first stabilize existing HHA acceptance; then use synthetic data for original internal PAS workflows and export previews; then approve data handling and a limited single-agency pilot; only later add tenant isolation, tenant-specific secrets, migrations, quotas, support and disaster-recovery tests. A state-facing product needs its own eligibility, security, accessibility and procurement evidence. Nothing here activates storage or grants state certification.

Texas distinction: [TMHP proprietary-system guidance](https://www.tmhp.com/topics/evv/evv-proprietary-systems), reviewed October 8, describes provider/FMSA onboarding and Operational Readiness Review, including standard and expedited paths. HHA connectivity is not that approval. PSO approval is also distinct from a state vendor award. Detailed rule-version and procurement research is being supplied by the parent; no current solicitation, eligibility or award is asserted here. The parent identifies current rules as v3.1 and v4.0 as effective April 1, 2027; independently confirm the supplied source before converting those version details into requirements.
