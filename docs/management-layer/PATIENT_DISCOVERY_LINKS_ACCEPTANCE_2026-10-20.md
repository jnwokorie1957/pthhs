# Patient care-plan and document discovery links

P1-N is implemented in `ebc2857976fc66fa7bdfd71b002fb73322ad69fe` during the
October 20, 2026, 02:49 UTC SEO/owner-task heartbeat, October 19 local. Both normal
jobs passed [workflow 39361432526](https://github.com/jnwokorie1957/pthhs/actions/runs/39361432526).
This accepts administrator form preparation only. No private record identity or
source value is included here.

## Result and boundaries

Readable live visit windows and Visit Preview rows offer Find patient care plans
and Find patient documents. Their exact patient ID prepares SearchPatientPOC or
SearchPatientDocument in the existing administrator form. Selection clears
unrelated fields, document/record filters and old results, leaves record ID empty,
retains the office context and focuses the visible patient input.

Selecting a link does not fetch results, download files, import records, choose
a plan/document, change settings or grant access. Existing read entitlement,
release and scope controls remain. Missing/invalid patient IDs, unavailable
details and Demo examples have no action. The existing page/context token rejects
detached controls after refresh, paging, date, office/policy, mode or session
changes. Other source shortcuts retain their prior behavior.

This adds no server patient-office wrapper or external account authorization.
Current administrator search access is not a family/therapist sharing policy.
POC task discovery does not establish a physician order, clinical form, plan
applicability, signed assessment or therapist authority. Document metadata does
not establish origin, version, review state, sharing or completeness. Detail/byte
links still need independently verified parent and action scope.

## Verification

- All 221 frontend tests passed, including four new regressions covering both
  representations and same-named patients with different source IDs; exact form
  selection, cleared fields/results and focus without a request; malformed/
  unavailable subjects and Demo; owner-disabled/release/office gates; and detached
  controls during and after eight context transitions. Existing source navigation,
  age, snapshot and investigation tests pass. Assets, repository and whitespace
  checks passed. Backend unchanged; both normal release jobs passed.
- Production HTML, data-source, workspace, dashboard and CSS matched tested bytes
  at 02:55:33 UTC. Private noindex/nofollow/noarchive and anonymous session/current-
  visit 401 responses remain.
- Normal-session production showed ten of each new action in the ten-row page.
  Both actions from Overview and Visit Preview prepared the exact source patient
  and operation, with empty record ID, unrelated filters and results. The patient
  input was visible and focused. Native Enter activated the care-plan action;
  pointer activation worked for documents. The original source receipt remained
  identical through all four selections.
- Both operations displayed the existing owner-enablement message. No POC or
  document read was submitted, no file opened and no permission changed. Production
  verified form preparation; exact absence of requests is tested synthetically,
  without network instrumentation in the real session.
- The fresh bounded live page at 02:55:43 UTC returned ten readable visits. All
  six field-presence chart counts and denominators matched its current source
  fields. Partial/on-demand/source-unvalidated labels remain. This is a source
  read, not an import, background sync or complete office census.
- Controls fit the observed source-tools container. Narrow layout was not
  revalidated. Invalid/revoked/changed contexts were exercised synthetically,
  rather than inducing source or permission changes on real records.
- HHA still requires normal sign-in. No new tenant UI capture/import occurred.
  Cleanup emptied patient-read, read-ID, patient-entry, capture/detail and result
  fields. Existing signed-in Primetime/HHA/Search Console tabs are retained.

Aggregate local evidence: `primetime-patient-discovery-live-acceptance.json`,
`primetime-patient-discovery-release-acceptance.json`,
`primetime-patient-discovery-acceptance.txt` and `primetime-patient-discovery.png`.
The visually checked crop contains only the two button labels. SHA-256:
`fbdebc7f4b34b19c64db1e7425100ba900e70b012af84622213749d82b88f129`.

## Remaining owner and developer work

P1-N is accepted for navigation only. Owner read enablement remains subject to
entitlement review; it was not changed for testing. Normal HHA sign-in and
protected representative source/office/unit/period/identity/discipline/document
validation remain open. P1-B and external account/assignment/action/sharing,
approved form/version/reviewer/signature prerequisites remain. A future richer
result or file service must verify unique current patient-office membership,
exact result-parent binding and final account/action scope before exposure.
