# Verified current-visit caregiver selection

The October 19, 2026, 13:07 UTC implementation heartbeat (including the earlier
queued 08:23 UTC trigger) implemented P1-I in frontend release
`38535ae3b97063e9e3102bca49d599b906757fa3`. Both normal jobs passed
[workflow 39258138011](https://github.com/jnwokorie1957/pthhs/actions/runs/39258138011).

## Implemented behavior

The separate, verified Current HHA visit evidence panel offers Open caregiver
read only for a returned positive string `Caregiver/ID` within 2147483647.
Missing, malformed, zero and out-of-range IDs remain unavailable. A saved tile's
name or historical assignment never supplies the identity.

The native button prepares the existing caregiver read form with the exact
current evidence ID and selected office, clears unrelated subject fields and
prior read results, and focuses Record ID. It makes no source/storage request,
preference change, permission grant, import, write or communication. Fetching
still requires the normal explicit read action and existing server gates.
Selection feedback now refers to source evidence rather than only a live page.

The button checks its successful current-read request, saved-row revision,
patient/version, office/policy, mode/session and view context. A newer read of the
same visit immediately removes and invalidates the previous action. Pending or
failed refreshes, changed filters/pages/versions and detached controls cannot
select a former caregiver. Saved charts/counts, source cells, authorizations and
capture/import provenance remain unchanged. P1-E's server visit/patient/current
office checks are unchanged. No backend or external-role authorization changed.

## Verification

- All 193 frontend tests passed, including eight new regressions for exact
  selection and explicit fetch, bounded/unknown IDs, the owner gate, pending and
  failed same-visit refresh/reassignment, thirteen context changes, invalid source
  envelopes, late same-visit success/error and a pending saved-version load.
  Generated assets, repository integrity and whitespace checks passed.
- Backend unchanged; both normal workflow jobs passed. Production HTML/workspace/
  dashboard/CSS matched tested bytes. Private noindex/nofollow/noarchive and
  anonymous session/current-visit 401 remain.
- The existing administrator session restored normally. Signed-in production
  current evidence matched the selected visit and patient. Enter selected the
  exact returned caregiver and office, cleared other subjects/prior results,
  opened Advanced tools and focused Record ID. The full October 41-tile chart,
  authorization rows, saved source cells and provenance matched before/after.
- Production correctly disclosed the existing owner entitlement gate. A normal
  explicit caregiver read returned its enablement denial and no source results.
  No operation was enabled and no caregiver demographics acceptance is claimed.
- Refreshing the same visit removed the previous action while pending. Space
  selected the newly returned exact caregiver after refresh, with the same focus
  and permission feedback. Saved-date selection cleared current evidence/action
  while retaining all 41 chart tiles. September opened with empty filters, no
  current action and its full 36-tile chart.
- Actual reassignment, revocation and races were not induced in private records;
  the synthetic tests cover them. This task did not revalidate live office-page
  chart calculations or clinical/EVV/billing semantics.
- The source ID was cleared after exact comparison for the cropped screenshot.
  The final screenshot was visually checked and contains no patient/staff/account
  identifiers. Reload confirmed empty patient, capture/detail and read-ID fields.
  The existing signed-in Primetime tab remains available. No new HHA UI capture
  or import occurred.

## Remaining work

P1-I is accepted only as protected administrator navigation. Caregiver details
remain behind their existing owner entitlement gate. If needed, the owner reviews
that entitlement through normal controls and enables it only when approved.
For additional tenant UI evidence, reopen HHA and complete normal sign-in.
Representative field/unit/period validation, approved authorization-detail
entitlement, P1-B office/supervisor migration and external identity/discipline/
form/reviewer/signature prerequisites remain open.

Proposed P1-J: group current visit source fields into readable Schedule, Actual
and EVV sections while retaining all raw fields, unknown/empty/zero distinctions,
independent source timestamps and context fences. No time conversion, unit
calculation, completeness claim or operational classification is implied.
