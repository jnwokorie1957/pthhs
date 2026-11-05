// Enterprise provider guide v3.30 (2025-02-24), compared to captured ENT WSDL.
// Contract presence is not entitlement or a reviewed business interface.
export const GUIDE_ABSENT = ["ConfirmVisits","ConfirmVisitsEVV","ConfirmVisitsV2","GetCaregiverAbsenceChangesV3","GetCaregiverAbsenceChangesV4","GetCaregiverChangesV3","GetCaregiverChangesV4","GetDeletedVisitsV2","GetMissedVisitActionTakenV2","GetMissedVisitReasonsV2","GetPatientChangesV3","GetPatientChangesV4","GetPatientContractChanges","GetVisitChangesV5","GetVisitEditReasonActionTaken","GetVisitInfo","UpdateCaregiverDirectDeposit","UpdateCaregiverMedical","UpdateCaregiverMedicalProfileCustom","UpdateCaregiverOtherCompliance","VisitCallInOut"] as const;
export const GUIDE_REMOVED = ["GetPatientChanges","GetCaregiverChanges","GetCaregiverAbsenceChanges","GetCaregiverPayrollInfoChanges"] as const;
export function vendorContractBlocked(operation: string): boolean {
  return [...GUIDE_ABSENT, ...GUIDE_REMOVED].some(name => name === operation);
}
// Narrow read-only staging review of the published ENT request shape. The
// dedicated caller proves visit/patient/office membership first and still needs
// the owner's enabled-read grant. Generic reads and all confirmation writes stay
// behind their original gate; this is not a reviewed confirmation contract.
export function scopedReasonReview(operation: string, context?: string): boolean {
  return operation === "GetVisitEditReasonActionTaken" && context === "visit_reason_review";
}
export function ownerReadable(operation: string): boolean {
  return !vendorContractBlocked(operation) || scopedReasonReview(operation, "visit_reason_review");
}
