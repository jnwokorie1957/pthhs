# Current patient profile action lifetime — October 27, 2026

After loading a current patient profile, its related-record controls checked
the selected visit page's context but not the profile request that created them.
A replacement profile request leaves the page context unchanged. A detached or
queued control from the older profile could therefore still select its record
while another profile loaded, after success, or after failure.

The patient panel now passes its existing request ownership check to the shared
record controls, matching the guarded caregiver/billing panels. Starting another
profile request invalidates every former profile action immediately. The current
successful profile keeps its normal related-record navigation.

This adds no request, source field, permission or stored state. Existing
visit/patient/office verification, source values, provenance and page/session
clearing remain in place. Selecting a record still prepares the existing source
navigation; no source record is changed.

## Verification

The synthetic regression failed before the fix: all seven old controls still
emitted record-selection events during a replacement request. It now verifies
both same-patient refresh and selecting another patient, pending and settled
success/failure, no stale event/request dispatch and working current navigation.
Each case performs only its two intended profile reads.

All 310 frontend/tooling tests passed. Generated public assets were rebuilt from
the reviewed source. Release and exact production asset/access evidence are
recorded in the dated handoff after publication. Backend code is unchanged.

The queued/detached-action cases are synthetic acceptance. No production
wrong-patient navigation was deliberately induced. This does not close broader
external-role, clinical, staffing, billing or whole-dashboard acceptance.
