# Staff employment-discipline connection — November 2, 2026

The October 31 role research asks for independent office, assignment, discipline
and document authority before therapist/staff workflows. This bounded change
connects an already-approved caregiver source field to the administrator Staffing
profile; it grants no patient, therapist or external staff access.

## Observed source and omitted display

At 04:09:48 UTC, the protected current-office/day caregiver profile showed seven
fields and no discipline row. An independent existing approved
GetCaregiverDemographics read matched that exact caregiver and returned one
employment-discipline value. No source identity or value is retained here.

The captured [WSDL](../../hharefs/hha-wdsl.xml) supplies
CaregiverInfo/EmploymentTypes/Discipline. The operational reader already projected
this as the JSON string EmploymentDisciplines, and the related caregiver route
already returned it after fresh visit/patient/office/caregiver checks. The browser
discarded it from the profile field allowlist.

## Implementation and limits

Staffing now displays Employment disciplines (source), using the current profile's
own fetch and patient-office receipts. Values are rendered as text in source
order. A supplied empty list says No values returned; an empty item says Empty
source value. An absent or unproved list remains Not supplied by HHA. No string is
treated as a license, PT qualification, effective clinical assignment, patient-
information grant, availability or eligible staffing candidate. The existing
qualification/eligibility/availability caution remains visible.

Before exposing the list, the server now requires one direct EmploymentTypes
root with only direct scalar Discipline children. Absent/nil/duplicate roots,
nested/unexpected content, nil/non-scalar children or an over-limit list return
null for this optional field without discarding the remaining profile. A genuine
empty root retains an empty array. Exact scalar text and source order are
preserved. The JSON projection is bounded to 1000 characters and 200 items.
The client independently validates the optional bounded string array and rejects
malformed replacement responses without retaining prior profile facts.

This tightens the existing source projection used by rate proposal checks as
well; malformed or absent evidence cannot supply discipline matching. No rate
logic, proposal, financial outcome or approval was changed. Existing scope,
read approvals and reassignment checks remain; no new endpoint, HHA call,
permission, source write, import or demographic secret is introduced.

## Verification and release

Four new regressions fail before and pass after: two backend source-list cases
and two browser normalization/render/context cases. They cover exact/empty source
text, genuine empty lists versus absent/nil/ambiguous lists, namespaces, bounds,
no extra reads and removal after date, Clear, Demo and session changes.
All 553 backend, 361 frontend/tooling and 46 analytics tests pass.

The full Windows generator/QA sequence passes. Removing 572 bytes of remaining
static HTML indentation kept the private app within unchanged limits; an HTML
token comparison preserved markup, non-whitespace data and all pre/textarea/
script/style content. Generated Primetime assets total 374616 bytes across
11 files; app/catalog total is 419565 bytes against the existing 420000 limit.
Marketing generation preserved the new private assets byte-for-byte.
Normal release and authenticated Staffing acceptance remain pending.

S02 availability/effective assignment and P1-B/P2 external-role, document/version,
reviewer, signature and action contracts remain open. Authorization detail
was independently accepted in the concurrent owner-approved connection; no
enablement or duplicate permission request is made here.
