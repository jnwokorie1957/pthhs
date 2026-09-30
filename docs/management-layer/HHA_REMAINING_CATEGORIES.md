# Remaining HHA work by prerequisite

This categorizes the currently not-implemented operations listed below. Counts are generated per category. Other server-blocked operations already have wrappers and are outside these counts. Category D is code work still in progress, not an approval blocker. Category C concerns execution; read-only handoff preparation may still be added.

## A. Vendor-undocumented or removed (19)

`ConfirmVisits`, `ConfirmVisitsEVV`, `ConfirmVisitsV2`, `GetCaregiverAbsenceChanges`, `GetCaregiverAbsenceChangesV3`, `GetCaregiverAbsenceChangesV4`, `GetCaregiverChanges`, `GetCaregiverChangesV3`, `GetCaregiverPayrollInfoChanges`, `GetDeletedVisitsV2`, `GetPatientChanges`, `GetPatientChangesV3`, `GetPatientContractChanges`, `GetVisitInfo`, `UpdateCaregiverDirectDeposit`, `UpdateCaregiverMedical`, `UpdateCaregiverMedicalProfileCustom`, `UpdateCaregiverOtherCompliance`, `VisitCallInOut`

## B. Missing documented semantics or current-state mapping (30)

`AddCaregiverInService`, `AddCaregiverTrainingSchool`, `CreateCaregiver`, `CreateCaregiverNote`, `CreateCaregiverOtherCompliance`, `CreateDocumentType`, `CreatePatient`, `CreatePatientAuthorization`, `CreatePatientPOC`, `CreateSchedule`, `CreateWeeklyVariable`, `GetCaregiverCityTaxes`, `GetDisciplines`, `GetPayrollCostCenters`, `RemoveCaregiverPicture`, `SearchVisits`, `UpdateCaregiverAccrualPTO`, `UpdateCaregiverAvailabilityMaxVisits`, `UpdateCaregiverDemographics`, `UpdateCaregiverI9Requirements`, `UpdateCaregiverInService`, `UpdateCaregiverTrainingSchool`, `UpdateLinkedSchedule`, `UpdatePatientAuthorization`, `UpdatePatientDemographics`, `UpdatePatientPOC`, `UpdatePatientPreference`, `UpdatePatientReferralInfo`, `UpdateSchedule`, `UpdateWeeklyVariable`

| Operation | Specific prerequisite |
|---|---|
| `AddCaregiverInService` | Required IsScheduled distinguishes Scheduled/Completed but is absent from GetCaregiverInServices readback; obtain status reconciliation before execution |
| `AddCaregiverTrainingSchool` | GetComplianceTrainingSchools TrainingSchoolID is a caregiver-training association candidate (guide p102), but equality to returned CaregiverTrainingID is not explicit; obtain verified cross-method identity mapping |
| `CreateCaregiver` | Guide pp75-76 requires an employment discipline from GetDisciplines. Its optional DisciplineType selector has no documented accepted values or omission behavior. Obtain an authoritative catalog request and agency-required Employee/Applicant fields; do not substitute payroll codes or existing employees as current catalog validation. |
| `CreateCaregiverNote` | Vendor notification and payer-note string controls lack verified suppression semantics; obtain explicit no-notification values before any executable note workflow |
| `CreateCaregiverOtherCompliance` | The creation response returns CaregiverOtherComplianceID, but captured read contracts expose no completed compliance record with that ID, score, performed date and result. The due-item feed uses CaregiverMedicalID and lacks these fields; obtain a verified ID mapping and current-record reconciliation before execution |
| `CreateDocumentType` | New-type readback needs an unfiltered type catalog. The guide calls document ID optional but WSDL requires a non-null integer; obtain the supported no-filter sentinel instead of guessing zero |
| `CreatePatient` | Guide p31 requires an accepted-service discipline from GetDisciplines, whose selector/default is undocumented. EVVRequired, FOBRequired, BeaconRequired and automatic-verification/downward-adjustment settings also lack current readback. Obtain approved agency values plus a supported persisted-settings verifier; no referral prerequisite is inferred. |
| `CreatePatientAuthorization` | Guide pp23-25 supplies HoursPerAuthPeriod, MaxHoursPeriod and weekday fields named Minutes but describes decimal hour fractions; readback exposes MaxUnits and period limits without a canonical units mapping. Obtain a worked request/readback pair for the intended period/service, nil-field behavior and LTC ProviderNumber applicability. ProgramCode/BudgetAmount also lack readback when supplied. |
| `CreatePatientPOC` | Guide v3.30 pp17-21 and WSDL lack persisted POC Shift/configured task Minutes readback. Ask which supported operation/export returns these by POCHeaderID/POCTaskID; performed visit-task minutes are not a substitute. If none, require independent post-write reconciliation |
| `CreateSchedule` | Required ScheduleType appears only in creation requests, not persisted visit/schedule readback. Obtain a supported persisted-type verifier. Also confirm agency variable-visit configuration and UPR EnableBudgetNumber applicability for any chosen scope; do not guess defaults. Temporary flags/budget/duration do have GetVisitInfoV2 readback. |
| `CreateWeeklyVariable` | No current weekly-variable record or balance readback in the captured WSDL; obtain a reconciliation endpoint and exact result identity before execution |
| `GetCaregiverCityTaxes` | Guide references the method without defining its Status request semantics; obtain vendor clarification |
| `GetDisciplines` | Guide references the method but does not define DisciplineType selection semantics; obtain vendor request examples before enabling |
| `GetPayrollCostCenters` | Guide references the method but does not define CostCenterNo selection/sentinel semantics; obtain vendor request examples |
| `RemoveCaregiverPicture` | Download response does not define an explicit absent/deleted state; obtain absence-versus-failure semantics before deletion reconciliation |
| `SearchVisits` | Current guide documents SearchVisitsV2; verify legacy SearchVisits compatibility and filters (V2 is already implemented) |
| `UpdateCaregiverAccrualPTO` | Guide p117 documents caregiver/type upsert; current accrued minutes and returned CaregiverAccrualID lack ledger readback. Obtain current balance/history reconciliation before executing |
| `UpdateCaregiverAvailabilityMaxVisits` | Documented current availability responses do not expose MaxVisit before-values; obtain supported readback mapping before enabling a mutation |
| `UpdateCaregiverDemographics` | Non-star NYCRegistryCheckedDate lacks direct GetCaregiverDemographics readback (only changes feed); p79 preservation applies only to starred fields. Establish complete fresh changes projection or documented omission-preserves behavior, while preserving immutable OfficeID/CaregiverCode |
| `UpdateCaregiverI9Requirements` | GetCaregiverChangesV2Info exposes all I9 fields; read Y/N maps to write YES/NO. Establish complete feed bootstrap, ties, freshness and required/nillable encoding; only HireDate omission-preserves is explicit (p117). Qualified evidence review remains required |
| `UpdateCaregiverInService` | Required IsScheduled has no current-value mapping in GetCaregiverInServices; obtain lossless status preservation and reconciliation |
| `UpdateCaregiverTrainingSchool` | GetComplianceTrainingSchools TrainingSchoolID is an association-ID candidate (p102), but equality to update CaregiverTrainingID is not explicit. Obtain verified current-record identity mapping before substitution |
| `UpdateLinkedSchedule` | GetLinkedScheduleInfo lacks persisted ScheduleType and Comments. Guide p139 applies Comments only to Skilled schedules but gives no omission-preserves rule. Obtain current type/comment readback or an authoritative preservation contract, plus edit-reason/note applicability and persisted-event verification; service-catalog membership is not proof of the visit type. |
| `UpdatePatientAuthorization` | ProgramCode and BudgetAmount occur only in create/update requests, absent from current authorization readback. Obtain current values or explicit omission-preserves semantics before edits; verify hours-versus-MaxUnits mapping independently |
| `UpdatePatientDemographics` | EVVRequired, FOBRequired, BeaconRequired, ExpandedTimeForAutoVerification and AutomaticDownwardAdjustment occur only in create/update contracts, not current readback. Obtain their current-state endpoint or explicit operation-specific omission-preserves semantics before lossless edits; caregiver blank-preserves rules do not apply |
| `UpdatePatientPOC` | Confirm persisted Shift/task Minutes readback; if unavailable define omitted/empty Shift, nil Minutes, omitted/empty POCTasks and omitted-task behavior, plus independent reconciliation. Caregiver-demographics preservation rules do not apply. Payer-synchronized UPR POCs reject updates under guide p19 |
| `UpdatePatientPreference` | Current preference Type/Value strings are not mapped to scheduled/not-scheduled request lists; obtain lossless preservation and clear-field semantics |
| `UpdatePatientReferralInfo` | GetPatientReferralInfo returns ReferralCommissionStatusID/Status; ComissionStatus write maps 1 Paid and 0 Not Paid. Lost-reason current mapping and omission/clearing remain unresolved; changes-feed ReferralLostReasonNote conflicts (int XSD versus String guide p233) |
| `UpdateSchedule` | V2 exposes temporary flags, duration, budget and suggested times, so these are not missing. Remaining prerequisites: documented edit-reason/note applicability and omission/preservation behavior, persisted edit-event verification, and canonical BillType/dollar-service mapping. BilledAmount is non-nullable in WSDL although guide p136 makes it situational; GetVisitInfoV2 returns it only for dollar services. Do not insert a guessed zero or infer note preservation. |
| `UpdateWeeklyVariable` | WeeklyVariableID occurs only in write contracts; obtain current record lookup and reconciliation semantics before execution |

## C. Sensitive deletion handoff / missing owner policy (3)

`DeleteCaregiverDocument`, `DeletePatientDocument`, `DeleteVisit`

| Operation | Specific prerequisite |
|---|---|
| `DeleteCaregiverDocument` | Destructive personnel/compliance-record removal: requires approved retention/archive policy, verified preserved copy and per-record authorization; execution stays with an authorized HHA operator |
| `DeletePatientDocument` | Destructive patient-record removal: requires approved retention/archive policy, verified preserved copy and per-record authorization; execution stays with an authorized HHA operator |
| `DeleteVisit` | Requires per-visit maintenance authority, reason, already-billed review and preservation of actual EVV/payroll evidence; no automatic deletion policy was recovered |

## D. Further contract-grounded implementation work (0)
