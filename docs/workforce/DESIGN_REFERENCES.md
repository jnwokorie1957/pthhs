# Primetime design direction

November 6, 2026. Owner preference: research strong examples for each page, then adapt useful patterns to Primetime's visual style and actual workflows. Apply this direction to future page work; it does not expand the current change into an unrelated site-wide redesign.

## Workforce management references

- [Deputy manager dashboard](https://help.deputy.com/hc/en-au/articles/4657365737231-Managing-the-Dashboard-on-the-Deputy-website): actionable summaries, role-aware visibility and separate areas for work needing attention. Adapted into real record counts, recruiting stages and permission-aware quick actions.
- [UKG Pro Workforce Management solution guide](https://www.ukg.com/sites/default/files/2025-02/cv2587_ukg_prowfm_solutions_guide.pdf), dashboard screenshot on PDF page 5: persistent navigation and grouped summary panels. Adapted into a dedicated sidebar, restrained cards and a separate working area for each task.
- [Workday workforce management](https://www.workday.com/en-us/products/workforce-management.html): integrated workforce tasks. Used as workflow context, without implying that this implementation provides Workday scheduling or payroll features.

## Primetime implementation

Forest teal navigation, gold active indicators, pale green summary surfaces, system fonts, readable contrast and generous spacing establish a consistent Primetime workspace. Accounts, applications, opportunities and team access have focused screens. Opportunity editing opens on demand. Status badges, search and filters make the recruiting list easier to scan. Narrow screens use a horizontally scrollable navigation strip and a single content column.

Counts come from authorized API responses. Failed or unloaded counts display an unavailable state rather than invented zeroes. Sign-out clears private panels and counts; stale responses cannot restore them. Application inbox names are projected only for authorized, office-scoped reviewers; the queue adds no birth date, SSN or contact fields.

The independent management page, stylesheet and controller have a 48 KB raw / 13 KB gzip budget. Shared caregiver/workforce assets retain their existing 156 KB / 48 KB allowance; marketing and operations limits are unchanged. No remote fonts or new runtime libraries were introduced.

Local browser verification uses clearly labeled synthetic records: focused account lookup/reset, inbox/detail navigation, opportunity filtering and draft saving, desktop and narrow-screen layout. Production collection gates, staff grants and provider settings are unchanged by the redesign.
