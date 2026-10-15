# Connected source records — October 15

Live Overview visit windows and Visit Preview rows now offer patient, caregiver
and visit read shortcuts when the server returned a readable visit with explicit
source identifiers. Each shortcut selects the existing operational read, carries
the source ID and current office, and clears fields and results from prior
queries. Selection does not fetch data, save an import or enable a permission.
The administrator submits the selected read through the existing protected API.

Unavailable details, absent or invalid identifiers and synthetic examples do not
offer source shortcuts. Old controls stop working after page refresh/navigation,
date, office/policy, data-mode or session changes. Workspace selection independently
checks the current approved live office. Owner-disabled reads retain their gate
and show the existing entitlement-review requirement.

All 136 frontend tests pass. Four new regressions exercise both dashboard views,
exact identifiers, clearing prior context, explicit source submission, disabled
reads, malformed IDs, unavailable details, Demo isolation, stale controls and
mismatched/locked offices. Asset freshness, whitespace and repository checks pass.
Backend contracts and source permissions are unchanged.

Release: `f25df5477629d7b3b46b201590c01d11ce1b8d51`.
Both Hosting and backend jobs passed in
[workflow 38751659750](https://github.com/jnwokorie1957/pthhs/actions/runs/38751659750).
Production dashboard, workspace and application scripts exactly match the tested
local asset hashes. Normal administrator acceptance verified:

- The live page returned ten readable visits and thirty record shortcuts in Visit
  Preview; Overview showed the same three choices per readable visit.
- Patient selection carried the matching source patient ID, cleared prior
  caregiver context and selected Patient overview. Explicit submission returned
  one current HHA record.
- Caregiver selection carried the matching source caregiver ID, cleared prior
  patient facts and showed the owner-enablement requirement. No permission was
  granted and no caregiver request was submitted.
- Visit selection carried the matching visit ID, cleared the caregiver field and
  selected Visit and EVV evidence. Explicit submission returned one HHA record.

Source identifiers were compared against visible visit rows in session memory;
no identifiers or source payloads are retained in this report. The local output
preview shows the new controls and source context. No HHA records were changed.

This completes a bounded connection from live visit evidence to existing source
reads. Patient/family access, staff identity/discipline validation and therapist
documentation remain separate prerequisites in the role research. Manual calendar
capture still requires the owner's normal sign-in to the expired HHA browser tab.
