# PTHHS Google Business Profile Public-Surface Audit

**Checked:** September 14, 2026
**Scope:** Read-only comparison of the website source of truth with current public search and directory surfaces. No profile was claimed, signed into, or changed.

## Canonical profile target

| Field | Website source of truth | Current public evidence | Status |
|---|---|---|---|
| Business name | Primetime Home Health Services, Inc. | CareAvailability uses the same name and Waze omits only the punctuation/suffix styling | Aligned |
| Address | 11602 Burdine St, Suite A, Houston, TX 77035 | CareAvailability and Waze show the same street, suite/unit, city, state, and ZIP | Aligned |
| Phone | 713-977-7721 | CareAvailability, Waze, and New LifeStyles show the same number | Aligned |
| Website URL | https://pthhs.net/ | Waze exposes `pthhs.net`; the PTHHS site resolves on the canonical host | Aligned on the inspected public surfaces |
| Office hours | Monday–Friday, 9 a.m.–5 p.m. | Waze exposes a matching Monday 9 a.m.–5 p.m. interval; the complete weekly profile schedule was not independently exposed | Partial—verify the full weekly schedule in the owned profile |
| Service areas | Texas HHS Regions 5 and 6; Brazoria, Chambers, Fort Bend, Galveston, Harris, Jefferson, Liberty, Montgomery, Waller, Walker, and Wharton counties | Public search did not expose the owned profile's configured service-area list | Account check required |
| Primary category | Non-medical personal assistance services (PAS) | A directly inspectable Google category was not available through public search | Account check required; do not select a clinical category |

## Evidence register

| Surface | URL | Observation | Limitation |
|---|---|---|---|
| PTHHS website | https://pthhs.net/ | Canonical business name, suite address, phone, website, office hours, and approved coverage are published from `PTHHS_PUBLIC_FACTS.json` | Owner-controlled source of truth, not independent confirmation |
| CareAvailability | https://careavailability.com/ | Its indexed Primetime result shows a matching name, Suite A address, and phone | Third-party directory; the provider result currently resolves to the directory root |
| Waze | https://www.waze.com/ | Its indexed Primetime result shows a matching address, phone, website, and Monday hours | The result does not expose Google-owned fields or the complete weekly schedule |
| New LifeStyles | https://www.newlifestyles.com/ | Its indexed Primetime result shows a matching Suite A address and phone | Third-party directory; the listing currently resolves to the directory root |

Public search did not return a directly inspectable Google Business Profile, and the public Maps surface could not be independently completed in the available read-only browser session. The public NAP signals inspected are aligned, but item 100 remains open until an authorized administrator verifies the owned profile's exact website URL, complete hours, primary category, and service-area configuration.

## Account-level completion checklist

- Confirm the owned profile name is `Primetime Home Health Services, Inc.`.
- Confirm the address retains `Suite A` and the primary phone is `713-977-7721`.
- Confirm the website is exactly `https://pthhs.net/` and does not redirect through a tracking or legacy host.
- Confirm weekday/weekend hours match current operations.
- Reconcile every configured service area with the eleven owner-attested counties; remove any unsupported area and do not add a new one without updating the fact register.
- Use a non-medical personal-assistance/home-care category that accurately describes the business; do not select a skilled, nursing, or clinical category.
- Record the reviewer and date after saving, then rerun the website release gate.
