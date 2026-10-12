# October 12 office release review

Baseline: main `412b820486b44c56f1a88c9451bfa661ee41bfc7`. Work is isolated in `task-4/pthhs-oct12`; the other working trees and the pre-existing resources edit are untouched. This patch requires independent review before publication. No laptop files were transferred.

## Changes and evidence

- Shared Demo/Live generation now invalidates all panels and pending responses when observed server office, timezone or owner settings revision changes. Owner settings reads/saves and both visit screens feed this scope. Visit refresh reloads source-access metadata; preview requests carry the expected office. This is an intent/response fence, never a browser authorization grant.
- Workspace reads recheck owner settings after the source returns. Revision reads translate changed-policy failures into their existing restart contract and recheck scope around patient-office joins. Visit preview, batch visit review and revision detail use the returned patient ID and a uniquely returned patient demographic record with the configured OfficeID before exposing facts. GetPatientDemographics must be owner-enabled; this patch does not enable it.
- Composite staffing review is explicitly blocked with `staffing_caregiver_office_evidence_unavailable`. The captured caregiver demographic projection lacks OfficeID and the existing last-name search does not prove current office membership. No empty-schedule or input-ID inference is substituted. It makes zero source calls until a reviewed authoritative caregiver-office join is implemented. Generic administrator read controls remain governed by their existing permissions.
- The older visit-change adapter preserves VisitStartTime/VisitEndTime as actual service timestamps and keeps EVVStartTime/EVVEndTime separate. EVV no longer supplies a fallback actual timestamp. Existing actual-hour, payroll, billing and source-correction evidence is not recalculated; missing GPS remains unknown. The vendor-blocked change operation remains blocked.
- The shared SOAP quota was already reserved only at transport dispatch on this baseline. Regression coverage confirms one reservation per actual dispatch, retries charging their actual attempts, and denied reservations sending no request. No second quota layer was removed.
- API-only Firebase discovery omits the new scheduled monitor using PRIMETIME_API_ONLY_DEPLOY=true. CI targets only functions:primetimeApi, with no force, deletion, IAM or service-enablement command. SDK manifest tests prove the API-only export has no Scheduler requirement; ordinary discovery retains both API and monitor. This does not deploy, activate or validate monitoring and does not delete any existing function. Actual deployment still needs exact-commit verification.
- Updated asset hashes and date-relative regression fixtures. Added tests for Demo paging and immediate clearing of integration history on office/policy changes. No sample data or billed amounts become live revenue, cash or profit.

## Performance decision

The prior 256,000-byte aggregate cap predates the shared source view and durable review UI; main's 329,464-byte payload failed it. This patch retains readable source files and adopts explicit limits of 360,000 raw bytes, 90,000 gzip-estimated bytes across all internal files, and 110,000 raw bytes for any individual internal asset. The marketing 2 MB cap, image checks and every other release check remain unchanged. Current LF payload: 330,397 raw bytes; 68,451 gzip-estimated bytes; largest asset 101,280 bytes. Gzip is a reproducible transfer estimate, not a claim about observed Hosting compression or measured real-network latency. Revisit splitting/loading as functionality grows; the limits do not grow automatically.

## Validation

- Complete repository `scripts/build-and-verify.sh`: PASS, including all 86 frontend tests, sitemap, preservation, accessibility, performance, frontend controls, repository audit and generator-drift checks.
- Complete backend runner: 325 passed, zero failed; TypeScript build passed. Three tests use actual Firebase SDK discovery in isolated processes, without credentials or production requests.
- Local Chrome: 390 and 1440 pixel widths, Demo paging, keyboard Demo/Live toggle, removal of synthetic values in blocked Live, no horizontal overflow or page errors. All network requests intercepted with synthetic fixtures. Screenshots visually inspected.
- All 29 source approval defaults remain false. No owner preference, source acceptance, storage configuration, identity, IAM, credential or SMS state changed.

Local tests ran Node 24.19.0; CI's Node 20 frontend and Node 22 backend remain the deployment-runtime validation. The npm lockfiles were installed without changes. Old generator line-ending differences in the isolated working tree are not publication content.

## Actual connection and remaining acceptance

The updated FIRST_ADMIN_HANDOFF records email-link/domain and seven-day artifact-cleanup setup complete on October 10; those are not current blockers. The approved owner mailbox is jeremynwokorie@gmail.com. Provider configuration is not evidence that normal mailbox sign-in, protected session authorization or HHA reference connectivity has succeeded.

No signed-in HHA navigation, EVV, authorization, staffing or report screen was inspected: this task exposes local execution and headless Chrome but no supported browser-control tool for the owner's existing session. No credential/profile extraction, custom token, privileged identity selection, protected production API call, patient/caregiver mutation, care approval or real message occurred. Actual connectivity therefore remains unverified, not failed.

Next: independent patch review, exact-commit main publication and separate Hosting/API deployment evidence; then use an available owner-controlled normal session to verify the protected session and permitted reference check. Operational source acceptance, patient-office read enablement, caregiver-office evidence, storage/privacy readiness and closed write/SMS gates remain separate. A green API deployment or reference check must not mark live operational workflows accepted.
