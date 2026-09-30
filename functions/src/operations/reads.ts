import { extractExactElementText } from "../integrations/hhaexchange/parser.js";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementBodies, extractElementBody, extractElementText } from "../integrations/hhaexchange/parser.js";

export const READ_OPERATIONS = ["GetReferralProfile", "GetOfficesV2", "GetContracts", "GetMissedVisitReasonsV2", "GetMissedVisitActionTakenV2", "GetVisitEditReasonActionTaken", "GetBillingServiceCodes", "SearchVisitsV2", "SearchPatients", "SearchCaregivers", "SearchPatientAuthorizations", "SearchBilledVisits", "GetScheduleInfo", "GetVisitInfoV3", "GetPatientDemographics", "GetCaregiverDemographics", "GetPatientAuthorizationInfo", "GetVisitBillInfoV2", "GetCaregiverPermanentWeekAvailability", "GetCaregiverSpecialAvailability", "GetPatientContracts", "GetPatientDisciplines", "GetPatientReferralInfo", "GetPatientPreferences", "GetPatientDeclinedCaregivers", "GetCaregiverRates", "GetCaregiverPayCodes", "GetCaregiverInServices", "GetCaregiverRestriction", "GetCaregiverPreferences", "SearchPayrollBatches", "SearchPayrollBatchCaregivers", "GetVisitPayrollInfoV2", "SearchPatientPOC", "GetPatientPOCInfo", "GetPatientTeams", "GetCaregiverTeams", "GetBranches", "GetLocations", "GetPayRateCodes", "GetPayers", "GetLanguages", "GetSourceOfAdmissions", "GetPatientDischargeTo", "GetReferralStatus", "GetReferralSourceType", "GetReferralLostReason", "GetCollectionStatus", "GetCollectionARNoteReasons", "GetCollectionRepresentatives", "GetCollectionFollowUpRepresentatives", "GetCollectionClaimStatus", "GetCollectionReasonForNonPayment", "GetPayrollTaxTypes", "GetPayrollTaxLocations", "GetEthnicity", "GetGenders", "GetInServiceTopics", "GetInServiceInstructors", "GetInServiceNoShowReason", "GetContractDischargeReason", "GetRefusedDutyReason", "GetI9ColumnCDocument", "GetCaregiverPTOAccrualTypes", "GetCaregiverGender", "GetCaregiverGenderForPatientPreference", "GetScheduleBillInfoEditReasons", "GetFluSeasonYears", "GetI9Documents", "GetCaregiverReferralSources", "GetEmergencyContactRelationships", "GetCaregiverNotificationMethods", "GetPayrollStateFillingStatus", "GetPayrollFederalFillingStatus", "GetMobilityStatuses", "GetEvacuationZones", "GetNurses", "GetEvacuationLocations", "GetReferralSalesStaff", "GetElectricEquipments", "GetCollectionNotes", "GetPayrollBatchDetails", "GetMasterWeeks", "GetLinkedScheduleInfo", "GetComplianceTrainingSchools", "GetVisitDeleteReasons", "GetVisitChangesV4", "GetDeletedVisits", "GetDeletedPatientAuthorizations", "GetPatientChangesV2", "GetCaregiverChangesV2", "GetCaregiverAbsenceChangesV2", "GetPatientContractChangesV2", "GetPatientAuthorizationChanges", "GetCaregiverMedicalDetails", "GetCaregiverComplianceItemDue", "GetNumberOfComplianceItemDue", "GetPatientClinicalInfo", "GetCaregiversAccessPatientInfoToMobileApp", "SearchPatientDocument", "SearchCaregiverDocument", "GetPatientDocumentType", "GetCaregiverDocumentType", "GetCaregiverMedicals", "GetCaregiverOtherCompliance", "GetCaregiverMedicalResults", "GetCaregiverOtherComplianceResults", "GetCaregiverTrainingSchools", "GetContractServiceCode", "GetLinkedContractServiceCodes", "GetCoordinators", "GetEvaluationCodes", "GetMissedVisitActionTaken", "GetMissedVisitReasons", "GetOffices", "GetPOCTasks", "GetPatientCaregiverPreferences", "GetStatusReasonsForCaregiver", "GetCaregiverNoteSubjects", "GetPatientNoteReasons", "GetCaregiverMedicalDetailChanges", "GetCaregiverPayrollInfoChangesV2", "GetCaregiverPictureChanges", "GetVisitChangesV2", "GetVisitChangesV3", "GetCaregiverNoteChanges", "GetCaregiverPermanentWeekAvailabilityChanges", "GetCaregiverPreferenceChanges", "GetCaregiverSpecialAvailabilityChanges", "GetPatientNoteChanges", "GetPatientNotes", "GetCaregiverNotes", "GetCallDashBoardData", "GetReferralSource", "GetReferralSourceContact", "GetPatientAddress", "GetPOCDutyLists", "GetVisitBillInfo", "GetVisitInfoV2", "GetVisitPayrollInfo", "SearchPhoneNumber", "DownloadCaregiverDocument", "DownloadPatientDocument", "DownloadCaregiverPicture"] as const;
export type ReadOperation = typeof READ_OPERATIONS[number];
export type ReadInput = { operation: ReadOperation; id?: string; patientId?: string; officeId?: string; date?: string; term?: string; status?: string; contractId?: string; caregiverId?: string; excludeZeroAmount?: string; groupByVisit?: string; modifiedAfter?: string; page?: string; complianceType?: string; sequence?: string; documentTypeId?: string; scheduleType?: string; appliesTo?: string; caregiverStatus?: string; modifiedAfterUtc?: string; lastId?: string; phone?: string; noteId?: string; referralStatusId?: string; referralSourceId?: string; salesStaffId?: string };
export class WorkflowError extends Error { constructor(public code: string, public status = 400, public retryAfterSeconds?: number) { super(code); } }
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647) throw new WorkflowError("invalid_identifier");
  return value;
}
export const OFFICE_SCOPED_READS = ["GetReferralProfile", "GetCallDashBoardData", "GetReferralSource", "GetReferralSourceContact", "SearchPhoneNumber", "GetCaregiverMedicalDetailChanges", "GetCaregiverPayrollInfoChangesV2", "GetCaregiverPermanentWeekAvailabilityChanges", "GetCaregiverPreferenceChanges", "GetCaregiverSpecialAvailabilityChanges", "GetCoordinators", "GetPOCTasks", "GetPatientCaregiverPreferences", "GetCaregiverNoteSubjects", "GetPatientNoteReasons", "GetCaregiverMedicals", "GetCaregiverOtherCompliance", "GetCaregiverMedicalResults", "GetCaregiverOtherComplianceResults", "GetCaregiverComplianceItemDue", "GetNumberOfComplianceItemDue", "SearchVisitsV2", "SearchBilledVisits", "GetContracts", "GetPatientTeams", "GetCaregiverTeams", "GetBranches", "GetLocations", "GetPayRateCodes", "GetPayers", "GetCollectionRepresentatives", "GetInServiceTopics", "GetInServiceInstructors", "GetCaregiverReferralSources", "GetMobilityStatuses", "GetEvacuationZones", "GetNurses", "GetEvacuationLocations", "GetReferralSalesStaff", "GetElectricEquipments", "GetPatientChangesV2", "GetCaregiverChangesV2", "GetCaregiverAbsenceChangesV2", "GetPatientContractChangesV2", "GetPatientAuthorizationChanges"];
function day(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) throw new WorkflowError("invalid_date");
  return value;
}
const referenceInputs: Partial<Record<ReadOperation, readonly ("OfficeID" | "Status")[]>> = {
  "GetCollectionStatus": ["Status"],
  "GetPatientTeams": [
    "OfficeID",
    "Status"
  ],
  "GetCaregiverTeams": [
    "OfficeID",
    "Status"
  ],
  "GetBranches": [
    "OfficeID",
    "Status"
  ],
  "GetLocations": [
    "OfficeID",
    "Status"
  ],
  "GetPayRateCodes": [
    "OfficeID",
    "Status"
  ],
  "GetPayers": [
    "OfficeID"
  ],
  "GetLanguages": [],
  "GetSourceOfAdmissions": [],
  "GetPatientDischargeTo": [],
  "GetReferralStatus": [
    "Status"
  ],
  "GetReferralSourceType": [
    "Status"
  ],
  "GetReferralLostReason": [
    "Status"
  ],
  "GetCollectionARNoteReasons": [
    "Status"
  ],
  "GetCollectionRepresentatives": [
    "Status",
    "OfficeID"
  ],
  "GetCollectionFollowUpRepresentatives": [
    "Status"
  ],
  "GetCollectionClaimStatus": [
    "Status"
  ],
  "GetCollectionReasonForNonPayment": [
    "Status"
  ],
  "GetPayrollTaxTypes": [
    "Status"
  ],
  "GetPayrollTaxLocations": [
    "Status"
  ],
  "GetEthnicity": [],
  "GetGenders": [],
  "GetInServiceTopics": [
    "OfficeID"
  ],
  "GetInServiceInstructors": [
    "OfficeID"
  ],
  "GetInServiceNoShowReason": [],
  "GetContractDischargeReason": [
    "Status"
  ],
  "GetRefusedDutyReason": [],
  "GetI9ColumnCDocument": [],
  "GetCaregiverPTOAccrualTypes": [],
  "GetCaregiverGender": [
    "Status"
  ],
  "GetCaregiverGenderForPatientPreference": [],
  "GetScheduleBillInfoEditReasons": [],
  "GetFluSeasonYears": [],
  "GetI9Documents": [],
  "GetCaregiverReferralSources": [
    "OfficeID"
  ],
  "GetEmergencyContactRelationships": [],
  "GetCaregiverNotificationMethods": [],
  "GetPayrollStateFillingStatus": [
    "Status"
  ],
  "GetPayrollFederalFillingStatus": [
    "Status"
  ],
  "GetMobilityStatuses": [
    "OfficeID",
    "Status"
  ],
  "GetEvacuationZones": [
    "OfficeID",
    "Status"
  ],
  "GetNurses": [
    "OfficeID",
    "Status"
  ],
  "GetEvacuationLocations": [
    "OfficeID",
    "Status"
  ],
  "GetReferralSalesStaff": [
    "OfficeID",
    "Status"
  ],
  "GetElectricEquipments": [
    "OfficeID"
  ]
};
export const EST_CHANGE_READS: readonly ReadOperation[] = ["GetCaregiverMedicalDetailChanges", "GetCaregiverPayrollInfoChangesV2", "GetCaregiverPictureChanges", "GetVisitChangesV2", "GetVisitChangesV3", "GetVisitChangesV4", "GetDeletedVisits", "GetDeletedPatientAuthorizations", "GetPatientChangesV2", "GetCaregiverChangesV2", "GetCaregiverAbsenceChangesV2", "GetPatientContractChangesV2", "GetPatientAuthorizationChanges"];
export const UTC_CHANGE_READS: readonly ReadOperation[] = ["GetCaregiverNoteChanges", "GetCaregiverPermanentWeekAvailabilityChanges", "GetCaregiverPreferenceChanges", "GetCaregiverSpecialAvailabilityChanges", "GetPatientNoteChanges", "GetPatientNotes", "GetCaregiverNotes"];
function sourceCursor(value: unknown, maximum = 9223372036854775807n): string {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,18})$/.test(value) || BigInt(value) > maximum) throw new WorkflowError("explicit_source_cursor_required");
  return value;
}
function utcTimestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?Z$/.test(value)) throw new WorkflowError("explicit_utc_timestamp_required");
  day(value.slice(0, 10)); return value;
}
function vendorEstTimestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?$/.test(value)) throw new WorkflowError("vendor_est_timestamp_required");
  day(value.slice(0, 10));
  return value; // Calendar validation only. Never convert this source wall time to UTC.
}
export function readRequest(input: ReadInput): string {
  if (UTC_CHANGE_READS.includes(input.operation)) {
    const modified = `<ModifiedAfter>${utcTimestamp(input.modifiedAfterUtc)}</ModifiedAfter>`;
    if (["GetCaregiverPermanentWeekAvailabilityChanges", "GetCaregiverPreferenceChanges", "GetCaregiverSpecialAvailabilityChanges"].includes(input.operation)) return `<OfficeID>${identifier(input.officeId)}</OfficeID>${input.caregiverId ? `<CaregiverID>${identifier(input.caregiverId)}</CaregiverID>` : '<CaregiverID xsi:nil="true"/>'}${modified}<LastChangeSeq>${sourceCursor(input.lastId, 2147483647n)}</LastChangeSeq>`;
    const patient = input.operation.includes("Patient"), subject = patient ? "Patient" : "Caregiver", scoped = input.operation === "GetPatientNotes" || input.operation === "GetCaregiverNotes";
    const last = input.lastId !== undefined && input.lastId !== "" ? `<Last${subject}NoteID>${sourceCursor(input.lastId)}</Last${subject}NoteID>` : scoped ? `<Last${subject}NoteID>${sourceCursor(input.lastId)}</Last${subject}NoteID>` : `<Last${subject}NoteID xsi:nil="true"/>`;
    return `${scoped ? `<${subject}ID>${identifier(patient ? input.patientId : input.caregiverId)}</${subject}ID>` : ""}${modified}${last}`;
  }
  if (EST_CHANGE_READS.includes(input.operation)) {
    const modified = `<ModifiedAfter>${vendorEstTimestamp(input.modifiedAfter)}</ModifiedAfter>`;
    if (input.operation === "GetVisitChangesV4") return `<GetVisitChanges>${modified}<PageNumber>${identifier(input.page || "1")}</PageNumber></GetVisitChanges>`;
    return (OFFICE_SCOPED_READS.includes(input.operation) ? `<OfficeID>${identifier(input.officeId)}</OfficeID>` : "") + modified;
  }
  const reference = referenceInputs[input.operation];
  if (reference) return reference.map(field => {
    if (field === "OfficeID") return `<OfficeID>${identifier(input.officeId)}</OfficeID>`;
    if (input.status === undefined || input.status === "") return "";
    if (typeof input.status !== "string" || !/^[A-Za-z]{1,20}$/.test(input.status)) throw new WorkflowError("invalid_reference_status");
    return `<Status>${input.status}</Status>`;
  }).join("");
  if (["GetPatientClinicalInfo", "GetCaregiversAccessPatientInfoToMobileApp"].includes(input.operation)) return `<PatientID>${identifier(input.patientId)}</PatientID>`;
  if (input.operation === "GetCaregiverMedicalDetails") {
    if (input.status && !["All", "Completed", "Pending", "Overdue"].includes(input.status)) throw new WorkflowError("invalid_compliance_status");
    return `<SearchFilter><CaregiverID>${identifier(input.caregiverId)}</CaregiverID>${input.id ? `<CaregiverComplianceExpItemID>${identifier(input.id)}</CaregiverComplianceExpItemID>` : ""}${input.status ? `<ComplianceStatus>${input.status}</ComplianceStatus>` : ""}</SearchFilter>`;
  }
  if (["GetCaregiverComplianceItemDue", "GetNumberOfComplianceItemDue"].includes(input.operation)) {
    if (!["Medical", "OtherCompliance"].includes(input.complianceType || "")) throw new WorkflowError("invalid_compliance_type");
    if (input.status && !["All", "Pending", "Overdue"].includes(input.status)) throw new WorkflowError("invalid_compliance_status");
    const detailed = input.operation === "GetCaregiverComplianceItemDue";
    if (detailed && (typeof input.sequence !== "string" || !/^(0|[1-9]\d{0,9})$/.test(input.sequence) || Number(input.sequence) > 2147483647)) throw new WorkflowError("explicit_compliance_sequence_required");
    const caregiver = detailed ? (input.caregiverId ? `<CaregiverID>${identifier(input.caregiverId)}</CaregiverID>` : '<CaregiverID xsi:nil="true"/>') : "";
    return `<SearchFilter><OfficeID>${identifier(input.officeId)}</OfficeID>${caregiver}<MedicalID>${identifier(input.id)}</MedicalID><ComplianceItemType>${input.complianceType}</ComplianceItemType>${input.status ? `<ComplianceStatus>${input.status}</ComplianceStatus>` : ""}${detailed ? `<SequenceID>${input.sequence}</SequenceID>` : ""}</SearchFilter>`;
  }
  if (["SearchPatientDocument", "SearchCaregiverDocument"].includes(input.operation)) {
    const subject = input.operation === "SearchPatientDocument" ? "Patient" : "Caregiver";
    const subjectId = identifier(subject === "Patient" ? input.patientId : input.caregiverId);
    const optionalId = (tag: string, value: string | undefined) => value ? `<${tag}>${identifier(value)}</${tag}>` : `<${tag} xsi:nil="true"/>`;
    const dates = input.date ? `<FromDate>${day(input.date)}T00:00:00</FromDate><ToDate>${day(input.date)}T23:59:59</ToDate>` : '<FromDate xsi:nil="true"/><ToDate xsi:nil="true"/>';
    return `<SearchFilters><${subject}ID>${subjectId}</${subject}ID>${optionalId(subject + "DocumentTypeID", input.documentTypeId)}${optionalId(subject + "DocumentID", input.id)}${dates}</SearchFilters>`;
  }
  if (["GetPatientDocumentType", "GetCaregiverDocumentType"].includes(input.operation)) {
    if (input.status && !["All", "Active", "Inactive"].includes(input.status)) throw new WorkflowError("invalid_document_status");
    // WSDL requires a non-nillable document ID despite the guide saying optional.
    // Require a known document; never invent zero to request an unbounded catalog.
    const subject = input.operation === "GetPatientDocumentType" ? "Patient" : "Caregiver";
    return `${input.status ? `<Status>${input.status}</Status>` : ""}<${subject}DocID>${identifier(input.id)}</${subject}DocID>`;
  }
  if (["GetCaregiverMedicals", "GetCaregiverOtherCompliance", "GetCaregiverMedicalResults", "GetCaregiverOtherComplianceResults"].includes(input.operation)) {
    const key = input.operation.includes("OtherCompliance") ? "OtherComplianceID" : "MedicalID";
    return `<OfficeID>${identifier(input.officeId)}</OfficeID>${input.id ? `<${key}>${identifier(input.id)}</${key}>` : `<${key} xsi:nil="true"/>`}`;
  }
  if (["GetMissedVisitActionTaken", "GetMissedVisitReasons", "GetOffices"].includes(input.operation)) return "";
  if (input.operation === "GetCaregiverTrainingSchools") return `<CaregiverID>${identifier(input.caregiverId)}</CaregiverID>`;
  if (input.operation === "GetEvaluationCodes") return input.id ? `<EvaluationCodeID>${identifier(input.id)}</EvaluationCodeID>` : "";
  if (input.operation === "GetPOCTasks") return `<OfficeID>${identifier(input.officeId)}</OfficeID><PatientID>${identifier(input.patientId)}</PatientID>`;
  if (["GetCoordinators", "GetCaregiverNoteSubjects", "GetPatientNoteReasons"].includes(input.operation)) {
    if (input.status && !["All", "Active", "Inactive"].includes(input.status)) throw new WorkflowError("invalid_reference_status");
    return `<SearchFilters><OfficeID>${identifier(input.officeId)}</OfficeID>${input.status ? `<Status>${input.status}</Status>` : ""}${input.operation === "GetPatientNoteReasons" ? `<PatientID>${identifier(input.patientId)}</PatientID>` : ""}</SearchFilters>`;
  }
  if (["GetContractServiceCode", "GetLinkedContractServiceCodes"].includes(input.operation)) {
    if (input.scheduleType && !["Non-Skilled", "Skilled"].includes(input.scheduleType)) throw new WorkflowError("invalid_schedule_type");
    return `<PatientID>${identifier(input.patientId)}</PatientID>${input.operation === "GetContractServiceCode" ? `<ContractID>${identifier(input.contractId)}</ContractID>` : ""}${input.scheduleType ? `<ScheduleType>${input.scheduleType}</ScheduleType>` : ""}${input.operation === "GetContractServiceCode" ? '<IsInternalContract xsi:nil="true"/>' : ""}`;
  }
  if (input.operation === "GetPatientCaregiverPreferences") {
    if (!["Patient", "Caregiver", "All"].includes(input.appliesTo || "") || !["Active", "Inactive", "All"].includes(input.status || "")) throw new WorkflowError("explicit_preference_catalog_filters_required");
    return `<GetPatientCaregiverPreferencesInfo><OfficeID>${identifier(input.officeId)}</OfficeID><AppliesTo>${input.appliesTo}</AppliesTo><Status>${input.status}</Status></GetPatientCaregiverPreferencesInfo>`;
  }
  if (input.operation === "GetStatusReasonsForCaregiver") {
    if (!/^[0-4]$/.test(input.caregiverStatus || "")) throw new WorkflowError("explicit_vendor_caregiver_status_required");
    return `<CaregiverStatus>${input.caregiverStatus}</CaregiverStatus>`;
  }
  if (input.operation === "GetReferralSource") {
    if (!["All", "Active", "Inactive"].includes(input.status || "")) throw new WorkflowError("explicit_referral_status_required");
    return `<OfficeID>${identifier(input.officeId)}</OfficeID><Status>${input.status}</Status>`;
  }
  if (input.operation === "GetReferralSourceContact") return `<OfficeID>${identifier(input.officeId)}</OfficeID><ReferralSourceID>${identifier(input.id)}</ReferralSourceID>`;
  if (input.operation === "GetPatientAddress") return `<PatientID>${identifier(input.patientId)}</PatientID>`;
  if (input.operation === "GetPOCDutyLists") return "";
  if (input.operation === "SearchPhoneNumber") {
    if (typeof input.phone !== "string" || !/^\d{10}$/.test(input.phone)) throw new WorkflowError("ten_digit_phone_required");
    return `<SearchFilters><OfficeID>${identifier(input.officeId)}</OfficeID><PhoneNumber>${input.phone}</PhoneNumber><SearchPatients>YES</SearchPatients><SearchCaregivers>YES</SearchCaregivers></SearchFilters>`;
  }
  if (input.operation === "GetCallDashBoardData") {
    const date = day(input.date);
    return `<SearchFilters><OfficeID>${identifier(input.officeId)}</OfficeID><StartDate>${date}T00:00:00</StartDate><EndDate>${date}T23:59:59</EndDate>${input.patientId ? `<PatientID>${identifier(input.patientId)}</PatientID>` : '<PatientID xsi:nil="true"/>'}${input.caregiverId ? `<CaregiverID>${identifier(input.caregiverId)}</CaregiverID>` : '<CaregiverID xsi:nil="true"/>'}<TimeAndAttendancePIN xsi:nil="true"/><LastCallDashboardID>${sourceCursor(input.lastId, 2147483647n)}</LastCallDashboardID></SearchFilters>`;
  }
  if (input.operation === "DownloadPatientDocument") return `<PatientDocID>${identifier(input.id)}</PatientDocID>`;
  if (input.operation === "DownloadCaregiverDocument") return `<CaregiverDocID>${identifier(input.id)}</CaregiverDocID>`;
  if (input.operation === "DownloadCaregiverPicture") return `<CaregiverID>${identifier(input.caregiverId)}</CaregiverID>`;
  if (input.operation === "GetOfficesV2") return "<OfficesV2RequestInfo/>";
  if (input.operation === "GetContracts") return `<OfficeID>${identifier(input.officeId)}</OfficeID><Status>Active</Status>`;
  if (input.operation === "SearchPatients" || input.operation === "SearchCaregivers") {
    if (typeof input.term !== "string" || input.term.trim().length < 2 || input.term.length > 60) throw new WorkflowError("last_name_search_requires_2_to_60_characters");
    const term = input.term.trim().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
    return `<SearchFilters><LastName>${term}</LastName></SearchFilters>`;
  }
  if (input.operation === "SearchPatientAuthorizations") return `<SearchFilters><PatientID>${identifier(input.patientId)}</PatientID></SearchFilters>`;
  if (input.operation === "SearchBilledVisits") {
    const date = day(input.date);
    return `<StartDate>${date}T00:00:00</StartDate><EndDate>${date}T23:59:59</EndDate><OfficeID>${identifier(input.officeId)}</OfficeID><PatientID xsi:nil="true"/>`;
  }
  if (input.operation === "SearchVisitsV2") {
    const date = day(input.date), office = identifier(input.officeId);
    // One office-local calendar day, not a guessed UTC conversion. Null optional
    // filters use the nillable WSDL contract rather than invented zero IDs.
    const patient = input.patientId ? `<PatientID>${identifier(input.patientId)}</PatientID>` : '<PatientID xsi:nil="true"/>';
    const caregiver = input.caregiverId ? `<CaregiverID>${identifier(input.caregiverId)}</CaregiverID>` : '<CaregiverID xsi:nil="true"/>';
    return `<SearchFilters><StartDate>${date}T00:00:00</StartDate><EndDate>${date}T23:59:59</EndDate>${patient}${caregiver}<OfficeID>${office}</OfficeID></SearchFilters>`;
  }
  if (input.operation === "SearchPayrollBatches") {
    const date = day(input.date);
    return `<StartDate>${date}T00:00:00</StartDate><EndDate>${date}T23:59:59</EndDate>`;
  }
  // AllSearchFilter requires these integers; no invented zero/all sentinel.
  if (input.operation === "GetReferralProfile") return `<SearchFilters><ReferralID>${identifier(input.id)}</ReferralID><OfficeID>${identifier(input.officeId)}</OfficeID><ReferralStatusID>${identifier(input.referralStatusId)}</ReferralStatusID><ReferralSourceID>${identifier(input.referralSourceId)}</ReferralSourceID><SalesStaffID>${identifier(input.salesStaffId)}</SalesStaffID><ReferralContractID>${identifier(input.contractId)}</ReferralContractID></SearchFilters>`;
  if (input.operation === "GetPatientContracts") return `<PatientID>${identifier(input.patientId)}</PatientID><VisitDate>${day(input.date)}T00:00:00</VisitDate>`;
  if (["GetPatientDisciplines", "GetPatientReferralInfo", "GetPatientPreferences"].includes(input.operation)) return `<PatientID>${identifier(input.patientId)}</PatientID>`;
  if (input.operation === "SearchPatientPOC") return `<SearchFilters><PatientID>${identifier(input.patientId)}</PatientID></SearchFilters>`;
  if (input.operation === "GetPatientDeclinedCaregivers") return `<PatientInfo><PatientID>${identifier(input.patientId)}</PatientID></PatientInfo>`;
  if (input.operation === "GetMasterWeeks") return `<PatientID>${identifier(input.patientId)}</PatientID>`;
  if (input.operation === "GetCollectionNotes") return `<collectionNoteParam>${input.noteId ? `<CollectionNoteDetailID>${identifier(input.noteId)}</CollectionNoteDetailID>` : '<CollectionNoteDetailID xsi:nil="true"/>'}<VisitID>${identifier(input.id)}</VisitID><ContractID>${identifier(input.contractId)}</ContractID><PatientID>${identifier(input.patientId)}</PatientID></collectionNoteParam>`;
  if (input.operation === "GetPayrollBatchDetails") {
    const exclude = input.excludeZeroAmount || "NO", grouping = input.groupByVisit || "No";
    if (!["NO", "SINGLE VISIT", "GROUP BY VISIT"].includes(exclude) || !["Yes", "No"].includes(grouping)) throw new WorkflowError("invalid_payroll_view_filter");
    const caregiver = input.caregiverId ? `<CaregiverID>${identifier(input.caregiverId)}</CaregiverID>` : '<CaregiverID xsi:nil="true"/>';
    return `<BatchID>${identifier(input.id)}</BatchID>${caregiver}<ExcludeZeroAmount>${exclude}</ExcludeZeroAmount><GroupByVisit>${grouping}</GroupByVisit>`;
  }
  const id = identifier(input.id);
  switch (input.operation) {
    case "GetMissedVisitReasonsV2": case "GetMissedVisitActionTakenV2": case "GetVisitEditReasonActionTaken": return `<VisitInfo><VisitId>${id}</VisitId></VisitInfo>`;
    case "GetBillingServiceCodes": return `<BillingServiceCodeInfo><ContractID>${id}</ContractID></BillingServiceCodeInfo>`;
    case "SearchPayrollBatchCaregivers": return `<BatchID>${id}</BatchID>`;
    case "GetPatientPOCInfo": return `<POCInfo><POCID>${id}</POCID></POCInfo>`;
    case "GetVisitPayrollInfo": case "GetVisitPayrollInfoV2": return `<VisitPayrollInfo><ID>${id}</ID></VisitPayrollInfo>`;
    case "GetCaregiverPreferences": return `<CaregiverInfo><ID>${id}</ID></CaregiverInfo>`;
    case "GetCaregiverRates": case "GetCaregiverPayCodes": case "GetCaregiverInServices": case "GetCaregiverRestriction": return `<CaregiverID>${id}</CaregiverID>`;
    case "GetVisitDeleteReasons": return `<VisitID>${id}</VisitID><Status>Active</Status>`;
    case "GetComplianceTrainingSchools": return `<CaregiverID>${id}</CaregiverID>`;
    case "GetLinkedScheduleInfo": return `<LinkedScheduleInfo><ID>${id}</ID></LinkedScheduleInfo>`;
    case "GetScheduleInfo": return `<ScheduleInfo><ID>${id}</ID></ScheduleInfo>`;
    case "GetVisitInfoV2": case "GetVisitInfoV3": return `<VisitInfo><ID>${id}</ID></VisitInfo>`;
    case "GetPatientDemographics": return `<PatientInfo><ID>${id}</ID></PatientInfo>`;
    case "GetCaregiverDemographics": return `<CaregiverInfo><ID>${id}</ID></CaregiverInfo>`;
    case "GetPatientAuthorizationInfo": return `<AuthorizationInfo><PatientID>${identifier(input.patientId)}</PatientID><AuthorizationID>${id}</AuthorizationID></AuthorizationInfo>`;
    case "GetVisitBillInfo": case "GetVisitBillInfoV2": return `<VisitBillInfo><ID>${id}</ID></VisitBillInfo>`;
    case "GetCaregiverPermanentWeekAvailability": case "GetCaregiverSpecialAvailability": return `<CaregiverID>${id}</CaregiverID>`;
    default: throw new WorkflowError("unsupported_operation");
  }
}
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const projections: Record<Exclude<ReadOperation, "SearchVisitsV2" | "SearchPatients" | "SearchCaregivers">, { record: string; fields: string[] }> = {
  GetPatientClinicalInfo: { record: "PatientClinicalInfo", fields: ["PatientID", "NursingVisitsDue", "MDOrderRequired", "MDOrderDue", "MDVisitDue"] },
  GetCaregiversAccessPatientInfoToMobileApp: { record: "Caregiver", fields: ["ID", "Name"] },
  GetCaregiverMedicalDetails: { record: "CaregiverMedicalDetails", fields: ["OfficeID", "CaregiverID", "CaregiverMedicalID", "MedicalID", "MedicalName", "Required", "Status", "DueDate", "DatePerformed", "ModifiedDate"] },
  GetCaregiverComplianceItemDue: { record: "CaregiverComplianceItemDue", fields: ["OfficeID", "CaregiverID", "CaregiverMedicalID", "MedicalID", "MedicalName", "ComplianceItemType", "Required", "Status", "DueDate", "ModifiedDate", "SequenceID"] },
  GetNumberOfComplianceItemDue: { record: "$result", fields: ["NumberOfComplianceItemDue"] },
  SearchPatientDocument: { record: "PatientDocument", fields: ["PatientDocID", "PatientID", "PatientDocumentTypeID", "PatientDocumentType", "FileName", "CreatedOn", "FileSize"] },
  SearchCaregiverDocument: { record: "CaregiverDocument", fields: ["CaregiverDocID", "CaregiverID", "CaregiverDocumentTypeID", "CaregiverDocumentType", "FileName", "CreatedOn", "FileSize"] },
  GetPatientDocumentType: { record: "DocumentType", fields: ["PatientDocumentTypeID", "PatientDocumentType", "Description", "Status"] },
  GetCaregiverDocumentType: { record: "DocumentType", fields: ["CaregiverDocumentTypeID", "CaregiverDocumentType", "Description", "Status"] },
  GetCaregiverMedicals: { record: "CaregiverMedicalInfo", fields: ["MedicalID", "MedicalName", "Active", "Require", "OfficeID", "OfficeName", "ComplianceSetupName"] },
  GetCaregiverOtherCompliance: { record: "CaregiverOtherComplianceInfo", fields: ["OtherComplianceID", "ComplianceName", "Active", "Require", "OfficeID", "OfficeName", "ComplianceSetupName"] },
  GetCaregiverMedicalResults: { record: "CaregiverMedicalResult", fields: ["MedicalID", "MedicalName", "ResultID", "OptionValue", "OfficeID", "OfficeName", "ComplianceSetupName"] },
  GetCaregiverOtherComplianceResults: { record: "CaregiverOtherComplianceResult", fields: ["OtherComplianceID", "ComplianceName", "OtherComplianceResultID", "OptionValue", "OfficeID", "OfficeName", "ComplianceSetupName"] },
  GetCaregiverTrainingSchools: { record: "TrainingSchoolInfo", fields: ["TrainingSchoolID", "SetupID", "TrainingSchoolName", "CertificationDate", "IsVerification", "OnFile", "VerificationDate", "CertificationVerified", "DisciplineText"] },
  GetContractServiceCode: { record: "ServiceCodeInfo", fields: ["ServiceCodeID", "ServiceCodeName"] },
  GetLinkedContractServiceCodes: { record: "ServiceCodeInfo", fields: ["ServiceCodeID", "ServiceCodeName"] },
  GetCoordinators: { record: "Coordinator", fields: ["CoordinatorID", "Name", "Active"] },
  GetEvaluationCodes: { record: "EvaluationCodesInfo", fields: ["EvaluationCodeID", "EvaluationCode", "Status", "Expirable", "Required", "MonthsToExpire"] },
  GetMissedVisitActionTaken: { record: "MissedVisitActionTakenInfo", fields: ["ReasonID", "Reason", "Status", "IsDefault"] },
  GetMissedVisitReasons: { record: "MissedVisitReasonsInfo", fields: ["ReasonID", "Reason", "Status", "ReasonNoteRequired", "ReasonNoteMinCharacterCount"] },
  GetOffices: { record: "Office", fields: ["OfficeID", "OfficeName", "OfficeCode"] },
  GetPOCTasks: { record: "POCTask", fields: ["POCTaskID", "POCTaskCode", "TaskName", "TaskCategory"] },
  GetPatientCaregiverPreferences: { record: "GetPatientCaregiverPreferencesInfo", fields: ["PreferenceID", "OfficeID", "Preference", "PreferenceType", "AppliesToPatient", "AppliesToCaregiver", "Status"] },
  GetStatusReasonsForCaregiver: { record: "StatusReasonsForCaregiver", fields: ["ReasonID", "Reason"] },
  GetCaregiverNoteSubjects: { record: "CaregiverNoteSubject", fields: ["ID", "OfficeID", "Name", "Active"] },
  GetPatientNoteReasons: { record: "PatientNoteReason", fields: ["ID", "OfficeID", "Name", "Active"] },
  GetCaregiverMedicalDetailChanges: { record: "GetCaregiverMedicalCompliance", fields: ["OfficeID", "CaregiverID", "ModifiedDate", "CaregiverMedicalID", "MedicalID", "MedicalName", "Status", "DueDate", "DatePerformed", "Required"] },
  GetCaregiverPayrollInfoChangesV2: { record: "GetCaregiverPayrollInfoChangesV2Info", fields: ["OfficeID", "CaregiverID", "ModifiedDate", "RateType", "PayCycle", "BaseRate", "ExemptionFromOvertime"] },
  GetCaregiverPictureChanges: { record: "GetCaregiverPictureChangesInfo", fields: ["CaregiverID", "ModifiedDate"] },
  GetVisitChangesV2: { record: "GetVisitChangesV2Info", fields: ["VisitID", "LastModifiedDate", "OfficeID", "VisitDate", "Patient/ID", "Caregiver/ID", "ScheduleStartTime", "ScheduleEndTime", "VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime", "IsMissedVisit", "ActualHours", "PayHours", "AdjustedHours", "TimeZone"] },
  GetVisitChangesV3: { record: "GetVisitChangesV3Info", fields: ["VisitID", "LastModifiedDate", "OfficeID", "VisitDate", "Patient/ID", "Caregiver/ID", "ScheduleStartTime", "ScheduleEndTime", "VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime", "IsMissedVisit", "ActualHours", "PayHours", "AdjustedHours", "TimeZone", "MissedVisitReasonID"] },
  GetCaregiverPermanentWeekAvailabilityChanges: { record: "PermanentWeekAvailabilityChangesInfo", fields: ["OfficeID", "CaregiverID", "ModifiedDate", "PermanentWeekID", "ChangeSequenceNumber", "Action", "MondayAvailabilityType", "MondayLiveIn", "MondayFrom", "MondayTo", "TuesdayAvailabilityType", "TuesdayLiveIn", "TuesdayFrom", "TuesdayTo", "WednesdayAvailabilityType", "WednesdayLiveIn", "WednesdayFrom", "WednesdayTo", "ThursdayAvailabilityType", "ThursdayLiveIn", "ThursdayFrom", "ThursdayTo", "FridayAvailabilityType", "FridayLiveIn", "FridayFrom", "FridayTo", "SaturdayAvailabilityType", "SaturdayLiveIn", "SaturdayFrom", "SaturdayTo", "SundayAvailabilityType", "SundayLiveIn", "SundayFrom", "SundayTo"] },
  GetCaregiverSpecialAvailabilityChanges: { record: "SpecialAvailabilityInfo", fields: ["OfficeID", "CaregiverID", "ModifiedDate", "SpecialAvailabilityID", "ChangeSequenceNumber", "Action", "FromDate", "ToDate", "MondayAvailabilityType", "MondayLiveIn", "MondayFrom", "MondayTo", "TuesdayAvailabilityType", "TuesdayLiveIn", "TuesdayFrom", "TuesdayTo", "WednesdayAvailabilityType", "WednesdayLiveIn", "WednesdayFrom", "WednesdayTo", "ThursdayAvailabilityType", "ThursdayLiveIn", "ThursdayFrom", "ThursdayTo", "FridayAvailabilityType", "FridayLiveIn", "FridayFrom", "FridayTo", "SaturdayAvailabilityType", "SaturdayLiveIn", "SaturdayFrom", "SaturdayTo", "SundayAvailabilityType", "SundayLiveIn", "SundayFrom", "SundayTo"] },
  GetCaregiverPreferenceChanges: { record: "PreferenceInfo", fields: ["OfficeID", "CaregiverID", "ModifiedDate", "ChangeSequenceNumber", "Action", "PreferenceID", "PreferenceName", "UsedForScheduling"] },
  GetPatientNoteChanges: { record: "PatientNoteInfo", fields: ["PatientNoteID", "PatientID", "NoteDate", "NoteType", "FromDate", "ToDate", "Note", "EmergencyOfPriority", "Internal"] },
  GetCaregiverNoteChanges: { record: "CaregiverNoteInfo", fields: ["CaregiverNoteID", "CaregiverID", "NoteDate", "Note", "CaregiverNotified", "SubjectID", "PatientID"] },
  GetPatientNotes: { record: "PatientNote", fields: ["PatientNoteID", "PatientID", "NoteReason/ID", "NoteDate", "NoteType", "FromDate", "ToDate", "Note", "EmergencyOfPriority", "Internal"] },
  GetCaregiverNotes: { record: "CaregiverNoteInfo", fields: ["CaregiverNoteID", "CaregiverID", "NoteDate", "Note", "CaregiverNotified"] },
  GetCallDashBoardData: { record: "CallInfo", fields: ["CallDashboardID", "CallTime", "CallType", "CallStatus"] },
  GetReferralSource: { record: "ReferralSourceInfo", fields: ["ReferralSourceID", "ReferralSourceName", "Status", "ParenetReferralSourceID", "ParentReferralsourceName", "ReferralSourceType", "AccountManagerId", "AccountMangerName", "MarketerId", "DefaultMarketer"] },
  GetReferralSourceContact: { record: "ReferralSourceContact", fields: ["ReferralSourceContactID", "ReferralSourceContactName", "Position", "Phone1", "Phone2", "EmailAddress", "OfficeHours", "IsPrimary"] },
  GetPatientAddress: { record: "Addresses", fields: ["AddressID", "Address1", "Address2", "State", "County", "City", "Zip5", "Zip4"] },
  GetPOCDutyLists: { record: "DutyLists", fields: ["DutyListId", "DutyListName", "DutyListStatus"] },
  GetVisitBillInfo: { record: "VisitBillInfo", fields: ["ID", "VisitDate", "Patient/ID", "Caregiver/ID", "PrimaryBillTo/IsBilled", "PrimaryBillTo/BilledRate", "PrimaryBillTo/BilledMinutes", "PrimaryBillTo/BilledAmount", "SecondaryBillTo/IsBilled", "SecondaryBillTo/BilledAmount"] },
  GetVisitInfoV2: { record: "VisitInfo", fields: ["VisitType", "ScheduleDuration/ScheduleDurationHours", "ScheduleDuration/ScheduleDurationMinutes", "IsScheduleTemporary", "IsCaregiverTemporary", "BudgetNumber", "SuggestedStartTime", "SuggestedEndTime", "BilledAmount", "ID", "VisitDate", "Patient/ID", "Caregiver/ID", "ScheduleStartTime", "ScheduleEndTime", "VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime", "ActualHours", "PayHours", "AdjustedHours", "TimeZone", "IsMissedVisit", "VisitAggregationStatus/Status"] },
  GetVisitPayrollInfo: { record: "VisitPayrollInfo", fields: ["ID", "VisitDate", "Caregiver/ID", "Caregiver/CaregiverCode", "PayrollAdjustmentMinutes", "Payrolldate", "RegularHours/Minutes", "RegularHours/Amount", "OTHours/Minutes", "OTHours/Amount", "HolidayHours/Minutes", "HolidayHours/Amount"] },
  SearchPhoneNumber: { record: "$result", fields: ["Patients/Patient/PatientID", "Patients/Patient/FirstName", "Patients/Patient/LastName", "Caregivers/Caregiver/CaregiverID", "Caregivers/Caregiver/FirstName", "Caregivers/Caregiver/LastName"] },
  DownloadPatientDocument: { record: "PatientDocument", fields: ["PatientDocID", "FileName", "FileSize", "ContentType", "StreamData"] },
  DownloadCaregiverDocument: { record: "CaregiverDocument", fields: ["CaregiverDocID", "FileName", "FileSize", "ContentType", "StreamData"] },
  DownloadCaregiverPicture: { record: "CaregiverPicture", fields: ["CaregiverID", "FileName", "ContentType", "StreamData"] },
  GetReferralProfile: { record: "ReferralSearchInfo", fields: ["ReferralID", "ReferralName", "ReferralStatus", "ReferralSource", "ReferralSourceType", "AdmittedDate"] },
  GetPatientContracts: { record: "PatientContractInfo", fields: ["PlacementID", "Contract/ID", "Contract/Name", "IsPrimaryContract", "AltPatientID", "ServiceStartDate", "ServiceCode/ID", "ServiceCode/Name", "DischargeDate"] },
  GetPatientDisciplines: { record: "PatientDiscipline", fields: ["DisciplineID", "DisciplineName"] },
  GetPatientReferralInfo: { record: "PatientReferralInfo", fields: ["PatientID", "ReferralMasterId", "ReferralCreatedDate", "ReferralReceivedDate", "ReferralStatusId", "ReferralStatus", "ReferralSourceId", "ReferralSourceType"] },
  GetPatientPreferences: { record: "GetPatientPreferencesInfo", fields: ["PatientID", "RequestGender", "PrimaryLanguage", "SecondaryLanguage"] },
  GetPatientDeclinedCaregivers: { record: "DeclinedCaregiverInfo", fields: ["CaregiverID", "PrimaryOfficeID", "RestrictionDate", "CaregiverStatus"] },
  GetCaregiverRates: { record: "CaregiverRateInfo", fields: ["CaregiverRateID", "CaregiverID", "Discipline", "PayCodeID", "PatientID", "FromDate", "ToDate", "HourlyRate", "DailyRate", "VisitRate", "Status"] },
  GetCaregiverPayCodes: { record: "PayCodeInfo", fields: ["PayCodeID", "PayCodeName", "Discipline", "DisciplineID"] },
  GetCaregiverInServices: { record: "CaregiverInServicesInfo", fields: ["InServiceID", "CaregiverID", "InserviceDate", "FromTime", "EndTime", "NoShow", "NoShowReason/Name", "InserviceCountCompliance"] },
  GetCaregiverRestriction: { record: "GetCaregiverRestrictionInfo", fields: ["RestrictionID", "RestrictionStartDate", "RestrictionEndDate", "Contract"] },
  GetCaregiverPreferences: { record: "CaregiverPreferencesInfo", fields: ["CaregiverID", "Language1", "Language2", "Language3", "Language4"] },
  SearchPayrollBatches: { record: "Batch", fields: ["BatchID", "BatchNumber", "BatchDate"] },
  SearchPayrollBatchCaregivers: { record: "BatchDetail", fields: ["BatchID", "BatchNumber", "BatchDate", "CaregiverID", "CaregiverCode"] },
  GetVisitPayrollInfoV2: { record: "VisitPayrollInfo", fields: ["ID", "VisitDate", "Patient/ID", "Caregiver/ID", "Caregiver/CaregiverCode", "VisitStartTime", "VisitEndTime", "PayrollAdjustmentMinutes", "Payrolldate", "RegularHours/Minutes", "RegularHours/Payrate", "RegularHours/Amount", "RegularHours/PayCode/ID", "OTHours/Minutes", "OTHours/Payrate", "OTHours/Amount", "OTHours/PayCode/ID", "HolidayHours/Minutes", "HolidayHours/Payrate", "HolidayHours/Amount", "HolidayHours/PayCode/ID"] },
  SearchPatientPOC: { record: "POC", fields: ["ID", "StartDate", "StopDate", "POCNumber"] },
  GetPatientPOCInfo: { record: "POCInfo", fields: ["Patient/ID", "ID", "StartDate", "StopDate", "POCNumber", "CreatedDate"] },
  GetPatientTeams: { record: "PatientTeam", fields: ["PatientTeamID", "PatientTeamName", "Active"] },
  GetCaregiverTeams: { record: "CaregiverTeam", fields: ["CaregiverTeamID", "CaregiverTeamName", "Active"] },
  GetBranches: { record: "Branch", fields: ["BranchID", "BranchName", "Active"] },
  GetLocations: { record: "Location", fields: ["LocationID", "LocationName", "Active"] },
  GetPayRateCodes: { record: "PayRateCode", fields: ["PayRateCodeID", "PayRateCodeName", "Discipline", "DisciplineID", "Active"] },
  GetPayers: { record: "Payer", fields: ["PayerID", "PayerName"] },
  GetLanguages: { record: "Language", fields: ["LanguageID", "LanguageName"] },
  GetSourceOfAdmissions: { record: "SourceOfAdmission", fields: ["SourceOfAdmissionID", "SourceOfAdmissionName"] },
  GetPatientDischargeTo: { record: "PatientDischargeToRason", fields: ["PatientDischargeToID", "PatientDischargeToName"] },
  GetReferralStatus: { record: "ReferralStatus", fields: ["ReferralStatusID", "ReferralStatusDesc", "Status"] },
  GetReferralSourceType: { record: "ReferralSourceType", fields: ["ReferralSourceTypeID", "ReferralSourceTypeName", "Status"] },
  GetReferralLostReason: { record: "ReferralLostReason", fields: ["LostReferralReasonID", "LostReferralReason", "Status"] },
  GetCollectionStatus: { record: "CollectionStatus", fields: ["CollectionStatusID", "CollectionStatusValue", "Active"] },
  GetCollectionARNoteReasons: { record: "CollectionARNoteReason", fields: ["ReasonID", "Reason", "Active"] },
  GetCollectionRepresentatives: { record: "CollectionRepresentative", fields: ["RefCollectionRepID", "CollectionRep", "Active"] },
  GetCollectionFollowUpRepresentatives: { record: "CollectionFollowUpRepresentative", fields: ["RepresentativeID", "Representative", "Active"] },
  GetCollectionClaimStatus: { record: "CollectionClaimStatus", fields: ["RefClaimStatusID", "ClaimStatusName", "Active"] },
  GetCollectionReasonForNonPayment: { record: "CollectionReasonForNonPayment", fields: ["RefReasonForNonPaymentID", "NonPaymentName", "Active"] },
  GetPayrollTaxTypes: { record: "TaxType", fields: ["TaxTypeID", "TaxTypeName", "Active"] },
  GetPayrollTaxLocations: { record: "TaxLocation", fields: ["TaxLocationID", "TaxLocationName", "Active"] },
  GetEthnicity: { record: "Ethnicity", fields: ["EthnicityID", "EthnicityName"] },
  GetGenders: { record: "Gender", fields: ["GenderID", "GenderName", "GenderCode", "GenderInitial"] },
  GetInServiceTopics: { record: "InServiceTopicsInfo", fields: ["TopicID", "TopicDescription", "Status", "CountTowardsCompliance"] },
  GetInServiceInstructors: { record: "InServiceInstructorsInfo", fields: ["InstructorID", "InstructorName", "Status"] },
  GetInServiceNoShowReason: { record: "InServiceNoShowReasonInfo", fields: ["ReasonID", "Reason", "ReasonDescription", "Status"] },
  GetContractDischargeReason: { record: "ContractDischargeReasonInfo", fields: ["ReasonID", "Reason", "ReasonDescription", "Status"] },
  GetRefusedDutyReason: { record: "RefusedDutyReasonInfo", fields: ["RefusedDutyReasonID", "RefusedDutyReasonCode", "RefusedDutyReasonDesc", "Status"] },
  GetI9ColumnCDocument: { record: "GetI9ColumnCDocumentInfo", fields: ["I9ColumnCDocumentID", "DocumentName"] },
  GetCaregiverPTOAccrualTypes: { record: "GetCaregiverPTOAccrualTypes", fields: ["PTOAccrualTypeID", "PTOAccrualType", "Description", "Status"] },
  GetCaregiverGender: { record: "CaregiverGender", fields: ["CaregiverGenderID", "GenderName", "Description", "Status"] },
  GetCaregiverGenderForPatientPreference: { record: "GetCaregiverGenderForPatientPreferenceInfo", fields: ["CaregiverGenderID", "GenderName"] },
  GetScheduleBillInfoEditReasons: { record: "GetScheduleBillInfoEditReason", fields: ["ReasonID", "Reason", "ReasonDescription", "NoteRequired", "MinCharacterCount", "ReasonStatus"] },
  GetFluSeasonYears: { record: "FluSeasonYear", fields: ["FluSeasonRangeID", "YearOfMedical", "FromDate", "ToDate"] },
  GetI9Documents: { record: "I9Document", fields: ["I9DocumentID", "I9DocumentName"] },
  GetCaregiverReferralSources: { record: "CaregiverReferralSource", fields: ["CaregiverReferralSourceID", "CaregiverReferralSourceName"] },
  GetEmergencyContactRelationships: { record: "EmergencyContactRelationship", fields: ["EmergencyContactRelationshipID", "EmergencyContactRelationshipName"] },
  GetCaregiverNotificationMethods: { record: "CaregiverNotificationMethod", fields: ["CaregiverNotificationMethodID", "CaregiverNotificationMethodName"] },
  GetPayrollStateFillingStatus: { record: "StateFillingStatus", fields: ["StateFillingStatusID", "StateFillingStatusName", "Active"] },
  GetPayrollFederalFillingStatus: { record: "FederalFillingStatus", fields: ["FederalFillingStatusID", "FederalFillingStatusName", "Active"] },
  GetMobilityStatuses: { record: "MobilityStatus", fields: ["MobilityStatusID", "MobilityStatusName", "Active"] },
  GetEvacuationZones: { record: "EvacuationZone", fields: ["EvacuationZonesID", "EvacuationZonesName", "Active"] },
  GetNurses: { record: "Nurse", fields: ["NurseID", "NurseName", "Active"] },
  GetEvacuationLocations: { record: "EvacuationLocation", fields: ["EvacuationLocationID", "EvacuationLocationName", "Active"] },
  GetReferralSalesStaff: { record: "ReferralSalesStaffInfo", fields: ["SalesStaffId", "SalesStaff", "Status"] },
  GetElectricEquipments: { record: "ElectricEquipment", fields: ["ElectricEquipmentDependencyID", "ElectricEquipmentName", "Description", "Status", "OfficeID"] },
  GetCollectionNotes: { record: "GetCollectionNoteInfo", fields: ["CreatedDate", "Reason", "ColRep", "CollectionFollowUpRep", "ClaimStatusName", "NonPaymentName", "CollectionStatus", "FollowupDate", "Notes"] },
  GetPayrollBatchDetails: { record: "BatchDetail", fields: ["BatchID", "BatchNumber", "BatchDate", "CaregiverID", "CaregiverCode", "VisitID", "VisitDate", "VisitStartTime", "VisitEndTime", "RegularHours", "RegularPayRate", "RegularAmount", "RegularPayCode", "OverTimeHours", "OverTimeAmount", "OverTimePayrate", "OverTimePayCode", "HolidayHours", "HolidayPayRate", "HolidayAmount", "HolidayPayCode", "PayType", "OriginalPayType", "PayrollWeekendingDate", "WeekNumber", "DifferentialHours", "DifferentialRate", "DifferentialAmount"] },
  GetMasterWeeks: { record: "MasterWeekInfo", fields: ["MasterWeekID", "PatientID", "FromDate", "ToDate", "Monday/ScheduleStartTime", "Monday/ScheduleEndTime", "Monday/CaregiverID", "Monday/PayCodeID", "Monday/PrimaryContractID", "Monday/PrimaryContractHours", "Monday/SecondaryContractID", "Monday/SecondaryContractHours", "Tuesday/ScheduleStartTime", "Tuesday/ScheduleEndTime", "Tuesday/CaregiverID", "Tuesday/PayCodeID", "Tuesday/PrimaryContractID", "Tuesday/PrimaryContractHours", "Tuesday/SecondaryContractID", "Tuesday/SecondaryContractHours", "Wednesday/ScheduleStartTime", "Wednesday/ScheduleEndTime", "Wednesday/CaregiverID", "Wednesday/PayCodeID", "Wednesday/PrimaryContractID", "Wednesday/PrimaryContractHours", "Wednesday/SecondaryContractID", "Wednesday/SecondaryContractHours", "Thursday/ScheduleStartTime", "Thursday/ScheduleEndTime", "Thursday/CaregiverID", "Thursday/PayCodeID", "Thursday/PrimaryContractID", "Thursday/PrimaryContractHours", "Thursday/SecondaryContractID", "Thursday/SecondaryContractHours", "Friday/ScheduleStartTime", "Friday/ScheduleEndTime", "Friday/CaregiverID", "Friday/PayCodeID", "Friday/PrimaryContractID", "Friday/PrimaryContractHours", "Friday/SecondaryContractID", "Friday/SecondaryContractHours", "Saturday/ScheduleStartTime", "Saturday/ScheduleEndTime", "Saturday/CaregiverID", "Saturday/PayCodeID", "Saturday/PrimaryContractID", "Saturday/PrimaryContractHours", "Saturday/SecondaryContractID", "Saturday/SecondaryContractHours", "Sunday/ScheduleStartTime", "Sunday/ScheduleEndTime", "Sunday/CaregiverID", "Sunday/PayCodeID", "Sunday/PrimaryContractID", "Sunday/PrimaryContractHours", "Sunday/SecondaryContractID", "Sunday/SecondaryContractHours"] },
  GetLinkedScheduleInfo: { record: "LinkedScheduleInfo", fields: ["Caregiver/PayCode/ID", "PrimaryBillTo/ServiceCode/ID", "ID", "Patient/ID", "Caregiver/ID", "VisitDate", "ScheduleStartTime", "ScheduleEndTime", "PrimaryBillTo/Payer/ID", "PrimaryBillTo/Hours", "PrimaryBillTo/Minutes", "LastModifiedDate"] },
  GetComplianceTrainingSchools: { record: "TrainingSchoolInfo", fields: ["TrainingSchoolID", "TrainingSchoolName", "CertificationDate", "CertificationVerified", "CertificationVerifiedDate", "OnFile", "Default", "DisciplineText"] },
  GetVisitDeleteReasons: { record: "DeleteVisitReason", fields: ["ReasonID", "Reason", "Active"] },
  GetVisitChangesV4: { record: "GetVisitChangesV4Info", fields: ["VisitID", "LastModifiedDate", "OfficeID", "VisitDate", "Patient/ID", "Caregiver/ID", "ScheduleStartTime", "ScheduleEndTime", "VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime", "IsMissedVisit", "MissedVisitReasonID", "ActualHours", "PayHours", "AdjustedHours", "TimeZone", "OriginalVisitID", "SplitVisitID"] },
  GetDeletedVisits: { record: "GetDeletedVisitsInfo", fields: ["VisitID", "VisitDate", "LastModifiedDate", "CaregiverID", "PatientID", "DeletedDate"] },
  GetDeletedPatientAuthorizations: { record: "GetDeletedPatientAuthorizationsInfo", fields: ["PatientAuthorizationID", "Authorizationnumber", "DeletedDate", "PatientID", "FromDate", "ToDate", "Contract", "ServiceCode"] },
  GetPatientChangesV2: { record: "GetPatientChangesV2Info", fields: ["OfficeID", "PatientID", "ModifiedDate", "FirstName", "LastName", "StatusID", "AdmissionID", "ServiceStartDate", "DischargeDate"] },
  GetCaregiverChangesV2: { record: "GetCaregiverChangesV2Info", fields: ["OfficeID", "CaregiverID", "ModifiedDate", "FirstName", "LastName", "CaregiverCode", "EmployeeID", "Status", "TimeZone"] },
  GetCaregiverAbsenceChangesV2: { record: "GetCaregiverAbsenceChangesV2Info", fields: ["OfficeID", "CaregiverAbsenceID", "CaregiverID", "ModifiedDate", "AbsenceTypeID", "AbsenceTypeName", "StartDate", "EndDate", "ContractID", "PayRateID"] },
  GetPatientContractChangesV2: { record: "PatientContractChangesV2", fields: ["PlacementID", "OfficeID", "PatientID", "ContractID", "ModifiedDate", "IsPrimaryContract", "ServiceStartDate", "DischargeDate", "DischargeToID"] },
  GetPatientAuthorizationChanges: { record: "GetPatientAuthorizationChangesInfo", fields: ["Patient/ID", "Patient/OfficeID", "Patient/UpdatedDate", "AuthorizationID", "Contract/ID", "ServiceCode/Name", "StartDate", "StopDate", "MaxUnits", "RemainingUnits", "WeeklyMaxAuthorization", "MonthlyMaxAuthorization", "EntirePeriodMaxAuthorization"] },
  GetOfficesV2: { record: "Office", fields: ["OfficeID", "OfficeName", "OfficeCode", "Status"] },
  GetContracts: { record: "Contract", fields: ["ContractID", "ContractName", "Active"] },
  GetBillingServiceCodes: { record: "ServiceCode", fields: ["ServiceCodeID", "ServiceCodeName", "ContractName", "ContractID", "Discipline"] },
  GetMissedVisitReasonsV2: { record: "MissedVisitReasonCodeInfo", fields: ["ReasonID", "Reason", "ReasonDescription", "Status", "ReasonNoteRequired", "ReasonNoteMinCharacterCount"] },
  GetMissedVisitActionTakenV2: { record: "MissedVisitActionTakenInfo", fields: ["ReasonID", "Reason", "ReasonDescription", "Status", "IsDefault"] },
  GetVisitEditReasonActionTaken: { record: "VisitEditReasonInfo", fields: ["VisitEditReasonID", "VisitEditReason", "VisitEditReasonDescription", "VisitEditStatus"] },
  SearchPatientAuthorizations: { record: "Authorization", fields: ["ID", "StartDate", "StopDate", "AuthorizationNumber", "ContractID", "ContractName"] },
  SearchBilledVisits: { record: "BilledVisits", fields: ["VisitID", "PatientID", "ContractID", "OtherChargeID"] },
  GetScheduleInfo: { record: "ScheduleInfo", fields: ["Caregiver/PayCode/ID", "PrimaryBillTo/ServiceCode/ID", "PrimaryBillTo/ServiceCode/BillType", "PrimaryBillTo/Hours", "PrimaryBillTo/Minutes", "SecondaryBillTo/ServiceCode/ID", "SecondaryBillTo/ServiceCode/BillType", "SecondaryBillTo/Hours", "SecondaryBillTo/Minutes", "ID", "Patient/ID", "Caregiver/ID", "PrimaryBillTo/Contract/ID", "SecondaryBillTo/Contract/ID", "VisitDate", "ScheduleStartTime", "ScheduleEndTime", "VisitType", "LastModifiedDate"] },
  GetVisitInfoV3: { record: "VisitInfo", fields: ["ID", "Patient/ID", "Caregiver/ID", "VisitDate", "ScheduleStartTime", "ScheduleEndTime", "VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime", "ActualHours", "ActualHoursRounded", "PayHours", "PayHoursUnrounded", "AdjustedHours", "BilledAmount", "TimeZone", "VisitType"] },
  GetPatientDemographics: { record: "PatientInfo", fields: ["PatientID", "OfficeID", "FirstName", "LastName", "PatientStatusName", "AdmissionID", "PayerName", "LastModifiedDate"] },
  GetCaregiverDemographics: { record: "CaregiverInfo", fields: ["ID", "FirstName", "LastName", "CaregiverCode", "EmployeeID", "Status/Name", "TimeZone", "LastModifiedDate"] },
  GetPatientAuthorizationInfo: { record: "AuthorizationInfo", fields: ["AuthorizationID", "Patient/ID", "AuthorizationNumber", "ServiceCode/Name", "StartDate", "StopDate", "MaxUnits", "RemainingUnits", "BankedHours", "WeeklyMaxAuthorization", "MonthlyMaxAuthorization", "EntirePeriodMaxAuthorization"] },
  GetVisitBillInfoV2: { record: "VisitBillInfo", fields: ["PrimaryBillTo/Contract/ID", "SecondaryBillTo/Contract/ID", "ID", "VisitDate", "Patient/ID", "Caregiver/ID", "PrimaryBillTo/IsBilled", "PrimaryBillTo/BilledRate", "PrimaryBillTo/BilledMinutes", "PrimaryBillTo/BilledAmount", "SecondaryBillTo/IsBilled", "SecondaryBillTo/BilledAmount"] },
  GetCaregiverPermanentWeekAvailability: { record: "PermanentWeekAvailabilityInfo", fields: ["PermanentWeekID", "CaregiverID", "OfficeID", ...days.flatMap(d => [d + "AvailabilityType", d + "From", d + "To", d + "LiveIn"])] },
  GetCaregiverSpecialAvailability: { record: "SpecialAvailabilityInfo", fields: ["SpecialAvailabilityID", "CaregiverID", "OfficeID", "FromDate", "ToDate", ...days.flatMap(d => [d + "AvailabilityType", d + "From", d + "To", d + "LiveIn"])] },
};
export const READ_PROJECTIONS = projections;
export function readInputFields(operation: ReadOperation): string[] {
  if (operation === "GetReferralProfile") return ["id", "officeId", "referralStatusId", "referralSourceId", "salesStaffId", "contractId"];
  if (["GetPatientClinicalInfo", "GetCaregiversAccessPatientInfoToMobileApp"].includes(operation)) return ["patientId"];
  if (operation === "GetCaregiverMedicalDetails") return ["caregiverId", "id", "status"];
  if (operation === "GetNumberOfComplianceItemDue") return ["officeId", "id", "complianceType", "status"];
  if (operation === "GetCaregiverComplianceItemDue") return ["officeId", "id", "caregiverId", "complianceType", "status", "sequence"];
  if (["SearchPatientDocument", "SearchCaregiverDocument"].includes(operation)) return [operation === "SearchPatientDocument" ? "patientId" : "caregiverId", "documentTypeId", "id", "date"];
  if (["GetPatientDocumentType", "GetCaregiverDocumentType"].includes(operation)) return ["id", "status"];
  if (["GetCaregiverMedicals", "GetCaregiverOtherCompliance", "GetCaregiverMedicalResults", "GetCaregiverOtherComplianceResults"].includes(operation)) return ["officeId", "id"];
  if (operation === "GetCaregiverTrainingSchools") return ["caregiverId"];
  if (operation === "GetContractServiceCode") return ["patientId", "contractId", "scheduleType"];
  if (operation === "GetLinkedContractServiceCodes") return ["patientId", "scheduleType"];
  if (operation === "GetCoordinators") return ["officeId", "status"];
  if (operation === "GetEvaluationCodes") return ["id"];
  if (operation === "GetMissedVisitActionTaken") return [];
  if (operation === "GetMissedVisitReasons") return [];
  if (operation === "GetOffices") return [];
  if (operation === "GetPOCTasks") return ["officeId", "patientId"];
  if (operation === "GetPatientCaregiverPreferences") return ["officeId", "appliesTo", "status"];
  if (operation === "GetStatusReasonsForCaregiver") return ["caregiverStatus"];
  if (operation === "GetCaregiverNoteSubjects") return ["officeId", "status"];
  if (operation === "GetPatientNoteReasons") return ["officeId", "patientId", "status"];
  if (UTC_CHANGE_READS.includes(operation)) return [...(OFFICE_SCOPED_READS.includes(operation) ? ["officeId", "caregiverId"] : operation === "GetPatientNotes" ? ["patientId"] : operation === "GetCaregiverNotes" ? ["caregiverId"] : []), "modifiedAfterUtc", "lastId"];
  if (operation === "GetCallDashBoardData") return ["officeId", "date", "patientId", "caregiverId", "lastId"];
  if (operation === "GetReferralSource") return ["officeId", "status"];
  if (operation === "GetReferralSourceContact") return ["officeId", "id"];
  if (operation === "GetPatientAddress") return ["patientId"];
  if (operation === "GetPOCDutyLists") return [];
  if (operation === "GetVisitBillInfo") return ["id"];
  if (operation === "GetVisitInfoV2") return ["id"];
  if (operation === "GetVisitPayrollInfo") return ["id"];
  if (operation === "SearchPhoneNumber") return ["officeId", "phone"];
  if (["DownloadPatientDocument", "DownloadCaregiverDocument"].includes(operation)) return ["id"];
  if (operation === "DownloadCaregiverPicture") return ["caregiverId"];
  const reference = referenceInputs[operation];
  if (reference) return reference.map(field => field === "OfficeID" ? "officeId" : "status");
  if (EST_CHANGE_READS.includes(operation)) return [...(OFFICE_SCOPED_READS.includes(operation) ? ["officeId"] : []), "modifiedAfter", ...(operation === "GetVisitChangesV4" ? ["page"] : [])];
  if (operation === "GetOfficesV2") return [];
  if (operation === "GetContracts") return ["officeId"];
  if (["SearchPatients", "SearchCaregivers"].includes(operation)) return ["term"];
  if (["SearchPatientAuthorizations", "SearchPatientPOC", "GetPatientDisciplines", "GetPatientReferralInfo", "GetPatientPreferences", "GetPatientDeclinedCaregivers", "GetMasterWeeks"].includes(operation)) return ["patientId"];
  if (operation === "SearchVisitsV2") return ["officeId", "date", "patientId", "caregiverId"];
  if (operation === "SearchBilledVisits") return ["officeId", "date"];
  if (operation === "SearchPayrollBatches") return ["date"];
  if (operation === "GetPatientContracts") return ["patientId", "date"];
  if (operation === "GetPatientAuthorizationInfo") return ["id", "patientId"];
  if (operation === "GetPayrollBatchDetails") return ["id", "caregiverId", "excludeZeroAmount", "groupByVisit"];
  if (operation === "GetCollectionNotes") return ["id", "patientId", "contractId", "noteId"];
  return ["id"];
}
function field(xml: string, path: string): string | null {
  const parts = path.split("/");
  for (const parent of parts.slice(0, -1)) xml = extractElementBody(xml, parent) ?? "";
  return extractElementText(xml, parts.at(-1)!) ?? null;
}
export interface OperationalRead { operation: ReadOperation; fetchedAt: string; source: "hhaexchange"; validation: "source_unvalidated"; timezone: "source_values_unconverted"; records: Record<string, string | null>[]; truncated: boolean; attachment?: { filename: string; byteLength: number; base64: string; contentType: "application/octet-stream" }; changePreview?: { timeBasis: "vendor_EST_wall_time_unconverted" | "UTC"; modifiedAfter: string; page: string | null; completeness: "not_inferred"; checkpointAdvanced: false }; }
export function boundedAttachment(record: Record<string, string | null>, identity: string, expected: string) {
  if (record[identity] !== expected) throw new WorkflowError("download_identity_mismatch", 502);
  const encoded = (record.StreamData || "").replace(/\s/g, "");
  if (!encoded || encoded.length > 2_796_204 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new WorkflowError("invalid_or_oversize_download", 502);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > 2 * 1024 * 1024 || bytes.toString("base64") !== encoded || (record.FileSize !== undefined && (record.FileSize === null || !/^\d+$/.test(record.FileSize) || Number(record.FileSize) !== bytes.length))) throw new WorkflowError("download_size_mismatch", 502);
  const original = record.FileName || "document.bin";
  const filename = original.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "_").replace(/^[. ]+|[. ]+$/g, "").slice(0, 100) || "document.bin";
  return { filename, byteLength: bytes.length, base64: encoded, contentType: "application/octet-stream" as const };
}
export async function operationalRead(client: Pick<HhaSoapClient, "call">, input: ReadInput, projectionScope?: "document_metadata" | "clinical_review" | "medical_review" | "write_recovery"): Promise<OperationalRead> {
  const body = readRequest(input);
  // One attempt per owner-requested read; shared server quota controls requests.
  const response = await client.call(input.operation, body, 1);
  if (!response.ok || !response.resultXml) {
    let wait: number | undefined;
    const value = response.retryAfter?.trim();
    if (value && /^\d+(?:\.\d+)?$/.test(value)) wait = Math.ceil(Number(value));
    else if (value && /^\d{1,2}:\d{2}:\d{2}$/.test(value)) { const parts = value.split(':').map(Number); wait = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!; }
    else if (value && Number.isFinite(Date.parse(value))) wait = Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 1000));
    if (wait !== undefined && Number.isFinite(wait) && wait > 0) throw new WorkflowError("vendor_backoff_active", 429, wait);
    throw new WorkflowError("hha_read_failed", 502);
  }
  let records: Record<string, string | null>[];
  if (input.operation === "SearchVisitsV2" || input.operation === "SearchPatients" || input.operation === "SearchCaregivers") {
    const [container, field] = input.operation === "SearchVisitsV2" ? ["Visits", "VisitID"] : input.operation === "SearchPatients" ? ["Patients", "PatientID"] : ["Caregivers", "CaregiverID"];
    const values = extractElementBody(response.resultXml, container!) ?? "";
    records = extractElementBodies(values, field!).map(value => ({ [field!]: identifier(value.trim()) }));
  } else {
    const projection = projections[input.operation];
    let bodies = projection.record === "$result" ? [response.resultXml] : extractElementBodies(response.resultXml, projection.record);
    // The v3.30 guide and captured WSDL disagree on this response element name.
    // Accept either observed contract shape for preview; never infer sync completion.
    if (input.operation === "GetVisitChangesV4") {
      const alternate = extractElementBodies(response.resultXml, "GetVisitChangesInfo");
      if (bodies.length && alternate.length) throw new WorkflowError("ambiguous_change_response_shape", 502);
      if (!bodies.length) bodies = alternate;
    }
    records = bodies.map(xml => {
      const projected = Object.fromEntries(projection.fields.map(name => [name, field(xml, name)]));
      if ((projectionScope === "medical_review" || projectionScope === "write_recovery") && input.operation === "GetCaregiverMedicalDetails") { for (const name of ["Notes", "Result", "DocumentName"]) projected[name] = extractExactElementText(xml, name) ?? null; }
      if ((projectionScope === "clinical_review" || projectionScope === "write_recovery") && input.operation === "GetPatientClinicalInfo") { projected.Comments = extractExactElementText(xml, "Comments") ?? null; projected.Allergies = extractExactElementText(xml, "Allergies") ?? null; }
      if ((projectionScope === "document_metadata" || projectionScope === "write_recovery") && ["SearchPatientDocument", "SearchCaregiverDocument"].includes(input.operation)) projected.Description = field(xml, "Description");
      if (input.operation === "GetVisitEditReasonActionTaken") projected.Actions = extractElementBodies(xml, "VisitEditActionTakenInfo").map(action => [field(action, "VisitEditActionTakenReasonID"), field(action, "VisitEditActionTakenReason"), field(action, "VisitEditActionTakenStatus")].join(" | ")).join("; ");
      if (input.operation === "GetPOCDutyLists") {
        projected.Offices = JSON.stringify(extractElementBodies(xml, "Offices").map(office => ({ OfficeID: field(office, "OfficeId"), OfficeName: field(office, "OfficeName") })));
        projected.Tasks = JSON.stringify(extractElementBodies(xml, "SubDutyList").map(task => Object.fromEntries(["DutyTaskId", "DutyCode", "DutyName", "DutyCategory", "UseForSpeakOutDuty", "Status"].map(name => [name, field(task, name)]))));
      }
      if (input.operation === "GetCaregiverDemographics") {
        projected.OfficeIDs = JSON.stringify(extractElementBodies(extractElementBody(xml, "CaregiverOffices") || "", "Office").map(office => field(office, "OfficeID")));
        projected.EmploymentDisciplines = JSON.stringify(extractElementBodies(extractElementBody(xml, "EmploymentTypes") || "", "Discipline").map(value => extractElementText(`<Discipline>${value}</Discipline>`, "Discipline")));
      }
      if (input.operation === "GetPatientPOCInfo") projected.Tasks = JSON.stringify(extractElementBodies(xml, "Task").map(task => Object.fromEntries(["ID", "Code", "Name", "Required", "AsNeeded", "WeeklyMin", "WeeklyMax", ...days].map(name => [name, field(task, name)]))));
      if (input.operation === "GetPatientPreferences" || input.operation === "GetCaregiverPreferences") projected.Preferences = JSON.stringify(extractElementBodies(xml, input.operation === "GetPatientPreferences" ? "PreferenceInfo" : "Preference").map(pref => Object.fromEntries(["PreferenceID", "PreferenceName", "PreferenceValue", "PreferenceType"].map(name => [name, field(pref, name)]))));
      if (input.operation === "GetCollectionNotes" && (projected.Notes?.length ?? 0) > 4000) { projected.Notes = projected.Notes!.slice(0, 4000); projected.NotesTruncated = "true"; }
      if (input.operation === "GetReferralSource") projected.OfficeIDs = JSON.stringify(extractElementBodies(extractElementBody(xml, "Offices") || "", "Office").map(office => field(office, "OfficeID")));
      if (input.operation === "GetPayrollBatchDetails") projected.SourceDurationUnit = "minutes (including fields named Hours); not recalculated";
      if ((projected.Note?.length ?? 0) > 4000) { projected.Note = projected.Note!.slice(0, 4000); projected.NoteTruncated = "true"; }
      return projected;
    });
  }
  if (input.operation === "SearchPhoneNumber") records = ["Patient", "Caregiver"].flatMap(subject => extractElementBodies(extractElementBody(response.resultXml!, subject === "Patient" ? "Patients" : "Caregivers") || "", subject).map(xml => ({ Subject: subject, ID: field(xml, subject + "ID"), FirstName: field(xml, "FirstName"), LastName: field(xml, "LastName") })));
  if (input.operation === "GetReferralProfile" && (records.length > 1 || records.some(row => row.ReferralID !== input.id))) throw new WorkflowError("referral_exact_filter_not_honored", 502);
  let attachment: OperationalRead["attachment"];
  if (input.operation.startsWith("Download")) {
    if (records.length !== 1) throw new WorkflowError("download_not_uniquely_returned", 502);
    const identity = input.operation === "DownloadPatientDocument" ? "PatientDocID" : input.operation === "DownloadCaregiverDocument" ? "CaregiverDocID" : "CaregiverID";
    attachment = boundedAttachment(records[0]!, identity, identity === "CaregiverID" ? identifier(input.caregiverId) : identifier(input.id));
    delete records[0]!.StreamData;
    records[0]!.FileName = attachment.filename;
  }
  return { operation: input.operation, fetchedAt: new Date().toISOString(), source: "hhaexchange", validation: "source_unvalidated", timezone: "source_values_unconverted", records: records.slice(0, 200), ...(attachment ? { attachment } : {}), truncated: records.length > 200, ...([...EST_CHANGE_READS, ...UTC_CHANGE_READS].includes(input.operation) ? { changePreview: { timeBasis: UTC_CHANGE_READS.includes(input.operation) ? "UTC" as const : "vendor_EST_wall_time_unconverted" as const, modifiedAfter: UTC_CHANGE_READS.includes(input.operation) ? input.modifiedAfterUtc! : input.modifiedAfter!, page: input.operation === "GetVisitChangesV4" ? input.page || "1" : null, completeness: "not_inferred" as const, checkpointAdvanced: false as const } } : {}) };
}
