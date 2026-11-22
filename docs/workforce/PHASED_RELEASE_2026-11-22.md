# Staff portal release plan

Owner decision: November 22, 2026, America/Chicago. This supersedes a broad staff-portal launch. It does not approve new HHA writes or a TMHP integration.

## January 1, 2027 — Phase 1

At midnight Central (`2027-01-01T06:00:00.000Z`), the released staff workflows are:

- Review submitted applicants' basic, job-related application information.
- Prepare, review and publish job opportunities, using existing privacy-review and office-permission controls.

Identity scans, Social Security documents, clinical records and the full HR personnel folder are not part of basic applicant review. Existing staff account/security administration remains available only to its expressly authorized administrators. Home shows the permitted recruiting tools.

`WORKFORCE_STAFF_PHASED_RELEASE=true` enables the release boundary. Session grants are projected to the released permissions; server routes and permission checks independently enforce it. URLs, old sessions and broad owner grants cannot enable an unreleased module after launch. Original grants are preserved, not rewritten. Release approval never grants a staff member a permission they did not already have.

The existing owner-only prelaunch preview remains available until January 1 for reviewing upcoming work. Ordinary office accounts receive the limited release scope. After January 1, owners also need a later-module release before using its records, while retaining separately authorized security administration.

Public opportunity publication remains behind the existing caregiver launch window and authenticated board. Its reviewed publication flag is enabled for the January launch; it does not publish draft/unreviewed openings or open the board before its launch window, except existing personally authorized early access.

## Later phases — dates unassigned

The owner explicitly confirmed that authorizations remain a later phase. Other later modules are caregivers, HR/personnel documents, clinical forms/admission packets, matching and activity history. They do not open automatically on a random date. Review readiness and choose an agency-approved date for each; use the midnight Central release window when changing access or API behavior.

`WORKFORCE_STAFF_LATER_MODULES_APPROVED` is an initially empty, reviewed list of `caregivers,authorizations,forms,matching,activity,hr`. Each release still needs its existing role/office permissions and vendor/credential gates. Matching depends on its separately approved routing/SMS prerequisites; a module label cannot enable those. HR reminders and automatic caregiver sync remain held while their applicable module is unreleased. Independently approved caregiver intake, application email and HHA applicant-transfer workers retain their own launch/acceptance gates; their operational readiness must be reviewed separately and is not established by releasing the two staff views.

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
