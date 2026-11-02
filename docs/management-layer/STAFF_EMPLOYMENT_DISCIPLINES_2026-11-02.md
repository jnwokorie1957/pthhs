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
source value. An absent or unproved list says Source list unavailable; it does not claim that
HHA omitted every value. No string is
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
All 553 backend and 46 analytics tests passed for the original feature; the
label follow-up now passes 362 frontend/tooling tests.

The full Windows generator/QA sequence passes. Removing 572 bytes of remaining
static HTML indentation kept the private app within unchanged limits; an HTML
token comparison preserved markup, non-whitespace data and all pre/textarea/
script/style content. Generated Primetime assets total 374616 bytes across
11 files; app/catalog total is 419565 bytes against the existing 420000 limit.
Marketing generation preserved the new private assets byte-for-byte.
Runtime **8a340f2460090530f33cca2683facbff0005b464**, reviewed tree
**97ebf19d1522dd5a7d3d9482ac1d0706a01179de**, passed all three normal jobs in
[workflow 41387973431](https://github.com/jnwokorie1957/pthhs/actions/runs/41387973431):
Hosting 04:21:40 UTC, backend 04:23:00 UTC and analytics 04:23:19 UTC.
Public verification at 04:24:10 UTC matched 12 deployed app assets and ten
anonymous JSON 401/no-store boundaries, including POST /workspace/visit-context.
Private noindex protection remains.

## Authenticated production acceptance

The normal signed-in browser loaded dashboard c5ddf3671fba after one reload.
At 04:24:59 UTC, the same exact caregiver's office-checked Staffing profile
displayed eight fields. The new discipline value matched the independent
approved raw read; the other seven profile values remained unchanged. Its own
HHA fetch and independent patient-office receipt labels remained present, as did
the qualification/eligibility/availability caution. No source value is saved here.
Desktop viewport and scroll widths both measured 1265px.

Source Clear removed the discipline row with the profile. Resume live feed then
restored Overview and the current office date, November 1, with ten source rows.
At 04:26:40 UTC the live HHA page carried the 04:26:03.488 UTC search receipt and
an explicit partial-page status. These are bounded source records, not a staff
census or clinical qualification/availability acceptance. Malformed/empty-list,
late-response, Demo and session variants remain synthetic regression coverage;
no bad source response or source change was induced.

The populated source-field connection was accepted for runtime 8a340f2. Final
S04 acceptance includes the unproved-list label follow-up below. Existing external-role
permissions, effective clinical assignment, staffing eligibility, availability,
document/version/reviewer and financial decisions remain independent work.

S02 availability/effective assignment and P1-B/P2 external-role, document/version,
reviewer, signature and action contracts remain open. Authorization detail
was independently accepted in the concurrent owner-approved connection; no
enablement or duplicate permission request is made here.

## Unproved-list label follow-up

The first rendering fallback called a missing/unproved discipline list Not
supplied by HHA. Because the server can also withhold an ambiguous source list,
that text could imply a source omission that was not established. A fifth
regression fails against runtime 8a340f2 and passes after the correction.
Unknown lists now say Source list unavailable, explicit empty lists say
No values returned, and empty items say Empty source value. Other profile fields
and populated discipline rendering are unchanged.

All 362 frontend/tooling tests, generated-asset and performance checks pass.
This follow-up changes no backend source/read or permissions; the existing
553 backend and 46 analytics evidence remains unchanged. Generated output is
374641 bytes across 11 files; app/catalog is 419590 bytes within the unchanged
420000-byte limit.

Follow-up runtime **b583d350bc2687ed55f3a5b8a62e653bc7c950dd**, reviewed tree
**85b6f3f808dfc8979661e238f7581d3b3c6eb80e**, passed all three normal jobs in
[workflow 41388977194](https://github.com/jnwokorie1957/pthhs/actions/runs/41388977194):
Hosting 04:32:20 UTC, backend 04:32:39 UTC and analytics 04:33:55 UTC.
At 04:34:13 UTC, twelve exact assets, ten anonymous JSON 401/no-store boundaries
and private noindex passed. The backend is unchanged by this follow-up.

At 04:34:53 UTC, the ordinary signed-in browser loaded dashboard 1da35f29fdb0 and
again returned an eight-field office-checked caregiver profile with a populated
discipline, receipt labels and the qualification caution. This rechecks normal
populated behavior; the exact raw-value comparison remains the earlier dated
same-caregiver acceptance, and unknown/empty variants remain synthetic tests.
Desktop viewport/scroll widths remained equal at 1265px. Resume restored current
office-day November 1 Overview with ten rows and a 04:34:12.010 UTC source receipt.
Private browser buffers were cleared. S04's bounded administrator source-field
connection is complete; broader S02/P1-B/P2 work remains open.
