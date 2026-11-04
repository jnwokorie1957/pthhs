# V2 clock and duration projection

Runtime: `15ba09d18148c8e6c1dc71f3807e5c9535d88836`.
Implementation is bounded to the existing `GetVisitInfoV2` reader. A live V2
source comparison is not accepted by this correction.

## Captured contract and reproduced gaps

The repository's [captured WSDL](../../hharefs/hha-wdsl.xml) links
`GetVisitInfoV2Response/GetVisitInfoV2Result` to `GetVisitInfoResponseV2`, whose
`VisitInfo` has type `GetVisitInfoDetailsV2`. It explicitly includes all eight
optional string fields below. This is captured contract evidence, not a fresh
patient record, current tenant entitlement or vendor-format confirmation.

| Source path under VisitInfo | Treatment |
| --- | --- |
| ScheduleStartTime / ScheduleEndTime | Raw scheduled clock strings |
| VisitStartTime / VisitEndTime | Raw recorded clock strings |
| EVVStartTime / EVVEndTime | Raw EVV clock strings, not proved physical-device events |
| ActualHours / ActualHoursRounded | Independent raw duration strings; no unit/format/rounding interpretation |
| ScheduleDuration/ScheduleDurationHours / ScheduleDuration/ScheduleDurationMinutes | Separate source schedule components; never actual-hour substitutes |

The V2 projection previously omitted `ActualHoursRounded` entirely, and its
older generic clock extraction could borrow a nested field. Two new regressions
fail before the correction: supplied rounded text is absent, and an unrelated
nested clock is incorrectly selected. These are synthetic protocol reproductions;
they do not diagnose the remaining genuine-empty V3 records.

## Bounded correction and local checks

V2 now includes the documented rounded-hours field and uses the existing strict
scalar time projector for its six clock fields, both duration strings and both
schedule components. Explicit empty, absent/unknown, zero and exact text stay
distinct. Duplicate, nil, nested or nonscalar candidates remain unknown instead
of borrowing another field. No local hours, timezone, decimal or rounding
calculation is introduced. Suggested/payroll/billed values remain separate.

The V3 projection branch and current live-feed source selection are unchanged.
Read registry, saved enabled-read preferences, office/subject proof, release and
source-write controls are unchanged. No V2 source request or new grant is made.

Both fail-before regressions pass after; all 643 backend checks pass. The
existing V3 regression cases also pass. Generated client assets remain current
and performance limits pass, with all public app/catalog bytes unchanged from
the accepted 9fb89f1 release. No dependency or client build change is included;
the isolated checkout reuses already installed backend dependencies.

## Release and source-acceptance limits

Normal [workflow 41752622722](https://github.com/jnwokorie1957/pthhs/actions/runs/41752622722)
succeeds in all three jobs on November4 UTC: Hosting 01:14:50, backend 01:16:06
and analytics 01:16:19. After all jobs, twelve exact unchanged app assets retain
noindex and twelve anonymous API boundaries return 401 JSON/no-store, including
the generic workspace read route. This verifies release delivery and the public
authentication boundary; it does not exercise authenticated V2 field output.

The previously reported signed-in Primetime attachment dependency is unchanged;
the source inventory exposes no new eligible tab or HHA application. No repeated
attachment attempt or sign-in-link communication is made this pass.

After the existing signed-in tab handoff, verify the currently authorized read
scope before any V2 trial. If V2 is not already approved, retain its gate and
prepare the specific decision through the existing workflow. Deployment alone
does not authorize an alternate source read. A later actual comparison must
retain exact visit/patient/caregiver/office/day linkage, independent fetch
receipts and source provenance; the documented field need not be populated.

P03/E04 and actual V2-source acceptance remain open. No missing time/hour recovery,
completed/verified/worked/payable/billable state, physical-event join, source
write/import, operational decision or communication is accepted. The original
October24 screenshot remains independently resolved as dated.

Safe outputs: `primetime-v2-time-projection-backend-2026-11-03-2252.log` and
`primetime-v2-time-projection-public-release-2026-11-03-2252.json`. Evidence
contains synthetic test results or nonsensitive status/hash metadata only.
