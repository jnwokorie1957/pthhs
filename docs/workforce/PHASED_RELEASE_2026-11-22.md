# Staff portal release plan

The owner confirmed this four-release plan on November 22, 2026. Each release has one operational focus. The owner can preview later workflows within existing office and record permissions. Staff receive each additional workflow only after explicit release approval.

| Release | Staff workflow | Evidence for the owner’s release decision |
| --- | --- | --- |
| **1 · Recruiting** | **January 1, 2027.** Review a submitted caregiver application, print its job-related answers, and prepare, review and publish job opportunities. | A recruiting user can find a submitted application in their assigned office, review it and print the selected application. A permitted publisher can post a reviewed opening and see the intended listing. A recruiting account cannot reach later workflows through navigation or a direct URL. |
| **2 · Staffing, supervisory visits and eligibility** | **Tentative review in February or March 2027**, after the office is comfortable with recruiting. Browse members and hired caregivers, view current schedules, and prepare supervisory visits with an HHA-suggested client and a manual visit override. Check member eligibility for the date of service. | Reconcile full source and office rosters, resolve unmatched hires, verify current schedules and demonstrate an editable visit selection that survives reopening. Identify ongoing assignments without scheduled shifts. Verify an authorized TMHP or payer response for the correct member and service date. Show an unavailable or ambiguous response as unverified and route it for review. Verify later-phase admission and assessment workflows have separate access before opening supervisory visits to staff. |
| **3 · Admissions and authorizations** | Review authorizations, complete admission forms, collect signatures and retrieve the completed documents from encrypted storage. | Confirm payer and member linkage, effective dates, encrypted retrieval, signature completeness and corrected-copy handling with approved office roles. |
| **4 · Billing and remittances** | Prepare billing handoffs and reconcile incoming TMHP or payer 835 remittances to claims and outstanding balances. | Establish the authorized trading-partner connection, reconcile a test remittance including adjustments, and approve the exception and duplicate-handling process before live use. |

A later release needs a separate owner decision. February and March are planning estimates. Dates alone do not expand access. Automated caregiver matching can follow Phase 2 once mileage, hours and contact preferences are verified. Finance integration work is deferred to Phase 4.

## Recruiting access and owner preview

Phase 1 starts at midnight Central on January 1, 2027. Staff view and print the same recruiting fields, including contact information, availability, education and work experience. Identity scans, tax forms, bank details and the personnel packet remain restricted to their separate workflows. Job publication uses the existing office, permission, review and caregiver-board controls.

The phased-release setting restricts both session navigation and server routes. Owner preview continues across January 1. Staff retain only their released workflows and their existing office and role permissions. Existing security administration remains restricted to authorized administrators.

The eight-hour Astra checks review connection health in owner preview and track the current release. The release does not enable vendor mutations, matching messages or payer transactions. Under the staged configuration the background caregiver sync is held until its module is approved. During preview, distinguish the last completed authorized roster import from a successful automatic cycle. The first post-midnight check on November 23 uses the staged release to verify application viewing, printing and job publication with recruiting permissions, plus owner-only access to later workflows. Record any failures or unverified steps before January 1. Production publication can begin January 1 at midnight Central under the [staff release policy](../releases/STAFF_RELEASE_POLICY.md). Verify the deployed version and live recruiting workflow separately after publication.

### Field-director route planner in review

The supervisory visit and admission route planner is staged in [draft PR #53](https://github.com/jnwokorie1957/pthhs/pull/53) for review after Phase 1. The draft includes optional nearby visits, a projected map, editable visit order and private fuel estimates. Before selecting a release date, verify the restricted Maps Embed browser key, the authenticated Google Routes response and a signed-in upload through cloud storage and document review.

## Form completion and export

Individual admission, supervisory, assessment and survey records turn green and display **Completed — fully signed** only after the server records all required signatures. Server signing still enforces the configured required answers and reviewed-content hash. Partially signed records remain incomplete. Corrections retain the signed original and create an unsigned copy.

Admission packets now persist their document membership on the server. Staff can select the member and resume a saved packet after a reload; status is derived from the current included documents, rather than an editable browser checkbox. Each form and the complete packet display their completion status. Combined packet export is limited to 20 MB of source PDFs and 100 pages; larger packets can be exported as individual completed forms.

Drafts have review previews with no download/print controls. The direct export endpoint rejects drafts and partially signed records. Completed exports recheck current office access and record state. Packet export requires every member document to be complete and rechecks revisions after merging. Templates are previewed without export controls; template PDFs are blank administrative source material, distinct from completed member records.

This controls portal exports and print controls, not operating-system screenshots or copying information already displayed to an authorized person. A green status establishes completion of configured answers/signatures; the forms phase still needs agency approval of all packet questions and mapped required fields before general clinical use.

## Later-phase authorization requirements and implementation

- Local PDF text extraction/neural OCR suggests payer, program, authorization number, dates, services and units. Ambiguity stays unknown. Staff verify the results before saving. No authorization or patient text is sent to an external AI model.
- New uploads must be linked to a verified, same-office HHA member. The server rechecks the member and stores the canonical client ID and agency member ID separately from the payer's member ID. A name-only suggestion cannot establish linkage.
- Client profiles link to their uploaded authorizations. Office lists sort by expiration date. Coverage checks disclose partial scans and old unlinked documents rather than interpreting them as proof of no coverage.
- Original uploads and rendered review copies retain AES-256-GCM envelope encryption with per-file keys wrapped by Cloud KMS, immutable object generations, integrity checks, server-only storage/database access and no-store responses.
- Managing records requires `authorizations.manage`. Viewing a stored document additionally requires the new explicit `authorizations.view` permission. No current staff grant is automatically expanded. The owner must designate authorized viewers through reviewed staff access.
- Each view prompts for the staff member's own existing portal password using Firebase reauthentication. The document endpoint independently requires a verified, non-revoked identity with authentication no older than two minutes, in addition to office/view permissions. Passwords are never put in application requests or stored by the portal. SMS verification is not enabled by this change.
- Uploaded renewal documents replace only the matching member/payer record and preserve its history and audit. A new upload does not automatically prove eligibility, authorized units for every service, or payment readiness.
- Existing complete office-wide 15/30-day expiration totals remain independent of browser pagination. Staff can record renewal follow-up and whether services are continuing. An expired authorization with staff-confirmed continuing services receives an urgent hold/case-manager review warning. The portal does not automatically pause services, modify HHA records or contact a case manager.
- Eligibility is explicitly **unverified** until a working, accepted TMHP connection supplies evidence for the date of service. Missing current uploaded authorizations and unlinked legacy records require staff review. No billing-ready or guaranteed-payment claim is made.

## Dependencies before authorizations are released

Designate the authorization staff/viewers, reminder recipients and department ownership. Approve representative payer document formats and required field mappings. Reconcile older unlinked records. Establish the TMHP interface, credentials/agency authorization and accepted service-date response contract. Define the agency's hold/escalation and retention procedures. A general external AI extractor additionally needs an approved PHI processing arrangement and configured service; current extraction is local OCR with reviewed suggestions.

TMHP follow-up reminder: Monday, November 23, 2026, 9:00 a.m. America/Chicago, one time. Automation: `follow-up-on-tmhp-eligibility-connection`.

Sources: [Firebase reauthentication](https://firebase.google.com/docs/auth/web/manage-users#re-authenticate_a_user); [TMHP prior authorization and eligibility requirements](https://www.tmhp.com/sites/default/files/microsites/provider-manuals/tmppm/html/TMPPM/1_05_Prior_Authorization/1_05_Prior_Authorization.htm). TMHP explicitly distinguishes prior authorization from a payment guarantee.
