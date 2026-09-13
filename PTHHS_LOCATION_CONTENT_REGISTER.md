# PTHHS Location Content Register

## Scope

All published `/locations/` pages use the service-area inventory approved by PTHHS ownership. The inventory covers the eleven counties already named on the Areas page: Brazoria, Chambers, Fort Bend, Galveston, Harris, Jefferson, Liberty, Montgomery, Waller, Walker, and Wharton.

## Content controls

- Every route identifies its service-area context and links to at least four other published location routes.
- Every route explains the non-medical PAS boundary, eligibility and authorization dependencies, payer-participation caveat, caregiver-availability caveat, and local contact path.
- A location page is not a promise of immediate placement, a specific number of hours, or acceptance of every referral.
- The content does not invent landmarks, travel times, demographics, facility relationships, local offices, or clinical capabilities.
- `scripts/location_content_quality.py` is the single location-profile source. Adding or removing a location route requires updating that inventory.
- `scripts/verify_location_content_quality.py` rejects missing profiles, thin main content, broken related-location targets, or missing qualification language.

## Review trigger

PTHHS operations should update the source profile whenever county coverage changes. Payer, authorization, and staffing availability remain referral-specific and must be confirmed before onboarding.
