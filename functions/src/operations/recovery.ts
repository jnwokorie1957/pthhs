import { currentLinkedScheduleCreation, sameCreatedLinkedScheduleFacts, linkedScheduleCreationTarget, type LinkedScheduleCreation } from "./linkedScheduleCreations.js";
import { currentCollectionNote, sameCollectionNoteFacts, collectionNoteTarget, type CollectionNoteChange } from "./collectionNotes.js";
import { currentReferralCreation, sameCreatedReferralFacts, referralCreationTarget, type ReferralCreation } from "./referralCreations.js";
import { currentContractCreation, sameCreatedContractFacts, contractCreationTarget, type ContractCreation } from "./contractCreations.js";
import { currentCaregiverPicture, caregiverPictureTarget, type CaregiverPictureChange } from "./caregiverPictures.js";
import { DOCUMENT_CREATION_WRITES, currentDocumentCreation, sameCreatedDocument, documentCreationTarget, type DocumentCreationChange } from "./documentCreations.js";
import { DOCUMENT_REPLACEMENT_WRITES, type DocumentReplacementChange } from "./documentReplacements.js";
import { currentMedicalCreation, sameCreatedMedicalFacts, medicalCreationTarget, type MedicalCreation } from "./medicalCreations.js";
import { currentPatientClinical, type PatientClinicalChange } from "./patientClinical.js";
import { DOCUMENT_METADATA_WRITES, currentDocumentMetadata, documentMetadataTarget, type DocumentMetadataChange } from "./documentMetadata.js";
import { patientNoteTarget, currentPatientNote, samePatientNoteFacts, type PatientNoteChange } from "./patientNotes.js";
import { AVAILABILITY_CREATIONS, availabilityCreationTarget, currentAvailabilityCreation, sameAvailabilityCreationFacts, type AvailabilityCreation } from "./availabilityCreations.js";
import { currentPatientContract, type PatientContractChange } from "./patientContracts.js";
import { currentRateCreation, sameCreatedRateFacts, rateCreationTarget, type RateCreation } from "./rateCreations.js";
import { currentTopic, sameTopicFacts, topicTarget, type TopicChange } from "./topics.js";
import type { DocumentTypeChange } from "./documentTypes.js";
import { createHash } from "node:crypto";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
import type { AvailabilityChange } from "./availability.js";
import { WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameDecimal, sameSourceFacts } from "./writes.js";

export interface WriteRecovery {
  state: "pending_review" | "resolved";
  outcome: "applied" | "not_applied";
  vendorCaseReference: string;
  confirmedScheduleType?: "Non-Skilled";
  runtimeTerminationReference: string;
  requestedBy: string; requestedAt: string;
  sourceFingerprint: string;
  reviewedBy?: string; resolvedAt?: string;
}
type Recoverable = (WriteIntent | AvailabilityChange | DocumentTypeChange | TopicChange | RateCreation | PatientContractChange | AvailabilityCreation | PatientNoteChange | DocumentMetadataChange | PatientClinicalChange | MedicalCreation | DocumentReplacementChange | DocumentCreationChange | CaregiverPictureChange | ContractCreation | ReferralCreation | CollectionNoteChange | LinkedScheduleCreation) & { recovery?: WriteRecovery };
const fingerprint = (facts: Record<string, string | null>) => createHash("sha256").update(JSON.stringify(Object.keys(facts).sort().map(key => [key, facts[key]]))).digest("hex");
function reference(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 8 || value.length > 500 || /[\r\n]/.test(value)) throw new WorkflowError("verified_evidence_reference_required");
  return value.trim();
}
export class WriteRecoveryWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>) {}
  async handle(action: "prepare" | "approve", value: unknown, actor: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_recovery_request");
    const input = value as Record<string, unknown>;
    if (Object.keys(input).some(key => !["family", "id", "revision", "outcome", "vendorCaseReference", "runtimeTerminationReference", "confirmedScheduleType"].includes(key)) || !["rate", "availability", "document_type", "topic", "rate_create", "patient_contract", "availability_create", "patient_note", "document_metadata", "patient_clinical", "medical_create", "document_replacement", "document_create", "caregiver_picture", "contract_create", "referral_create", "collection_note", "linked_schedule_create"].includes(String(input.family)) || typeof input.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(input.id) || !Number.isSafeInteger(input.revision)) throw new WorkflowError("invalid_recovery_request");
    const collection = input.family === "linked_schedule_create" ? "linkedScheduleCreations" : input.family === "collection_note" ? "collectionNoteChanges" : input.family === "referral_create" ? "referralCreations" : input.family === "contract_create" ? "contractCreations" : input.family === "caregiver_picture" ? "caregiverPictureChanges" : input.family === "document_create" ? "documentCreationChanges" : input.family === "document_replacement" ? "documentReplacementChanges" : input.family === "medical_create" ? "medicalCreations" : input.family === "patient_clinical" ? "patientClinicalChanges" : input.family === "document_metadata" ? "documentMetadataChanges" : input.family === "patient_note" ? "patientNoteChanges" : input.family === "availability_create" ? "availabilityCreations" : input.family === "patient_contract" ? "patientContractChanges" : input.family === "rate" ? "writeIntents" : input.family === "document_type" ? "documentTypeChanges" : input.family === "topic" ? "topicChanges" : input.family === "rate_create" ? "rateCreations" : "availabilityChanges";
    const prior = await this.repository.get<Recoverable>(collection, input.id);
    if (!prior || prior.revision !== input.revision || prior.state !== "approved") throw new WorkflowError("approved_current_proposal_required", 409);
    if ("officeId" in prior) {
      const settings = await this.repository.get<Versioned & { officeId: string | null }>("workspaceSettings", "owner");
      if (!settings?.officeId || settings.officeId !== prior.officeId) throw new WorkflowError("office_scope_mismatch", 403);
    }
    const rate = "preparation" in prior ? prior.preparation : undefined;
    const availability = prior as AvailabilityChange;
    const documentType = input.family === "document_type" ? prior as DocumentTypeChange : undefined;
    if (documentType && documentType.operation !== "UpdateDocumentType") throw new WorkflowError("unsupported_recovery_family");
    if (input.family === "rate" && !rate || input.family === "availability" && !["UpdateCaregiverPermanentWeekAvailability", "UpdateCaregiverSpecialAvailability"].includes(availability.operation)) throw new WorkflowError("unsupported_recovery_family");
    const topic = input.family === "topic" ? prior as TopicChange : undefined;
    if (topic && topic.operation !== "CreateInserviceTopics") throw new WorkflowError("unsupported_recovery_family");
    const creation = input.family === "rate_create" ? prior as RateCreation : undefined;
    if (creation && creation.operation !== "AddCaregiverRate") throw new WorkflowError("unsupported_recovery_family");
    const contract = input.family === "patient_contract" ? prior as PatientContractChange : undefined;
    if (contract && contract.operation !== "UpdatePatientContract") throw new WorkflowError("unsupported_recovery_family");
    const availabilityCreation = input.family === "availability_create" ? prior as AvailabilityCreation : undefined;
    if (availabilityCreation && !AVAILABILITY_CREATIONS.includes(availabilityCreation.operation)) throw new WorkflowError("unsupported_recovery_family");
    const patientNote = input.family === "patient_note" ? prior as PatientNoteChange : undefined;
    if (patientNote && patientNote.operation !== "CreatePatientNote") throw new WorkflowError("unsupported_recovery_family");
    const documentMetadata = input.family === "document_metadata" ? prior as DocumentMetadataChange : undefined;
    if (documentMetadata && !DOCUMENT_METADATA_WRITES.includes(documentMetadata.operation)) throw new WorkflowError("unsupported_recovery_family");
    const clinical = input.family === "patient_clinical" ? prior as PatientClinicalChange : undefined;
    if (clinical && clinical.operation !== "UpdatePatientClinicalInfo") throw new WorkflowError("unsupported_recovery_family");
    const medical = input.family === "medical_create" ? prior as MedicalCreation : undefined;
    if (medical && medical.operation !== "CreateCaregiverMedical") throw new WorkflowError("unsupported_recovery_family");
    const replacement = input.family === "document_replacement" ? prior as DocumentReplacementChange : undefined;
    if (replacement && !DOCUMENT_REPLACEMENT_WRITES.includes(replacement.operation)) throw new WorkflowError("unsupported_recovery_family");
    const documentCreation = input.family === "document_create" ? prior as DocumentCreationChange : undefined;
    if (documentCreation && !DOCUMENT_CREATION_WRITES.includes(documentCreation.operation)) throw new WorkflowError("unsupported_recovery_family");
    const picture = input.family === "caregiver_picture" ? prior as CaregiverPictureChange : undefined;
    if (picture && picture.operation !== "UploadCaregiverPicture") throw new WorkflowError("unsupported_recovery_family");
    const contractCreation = input.family === "contract_create" ? prior as ContractCreation : undefined;
    if (contractCreation && contractCreation.operation !== "AddPatientContract") throw new WorkflowError("unsupported_recovery_family");
    const referralCreation = input.family === "referral_create" ? prior as ReferralCreation : undefined;
    if (referralCreation && referralCreation.operation !== "CreateReferralSource") throw new WorkflowError("unsupported_recovery_family");
    const collectionNote = input.family === "collection_note" ? prior as CollectionNoteChange : undefined;
    if (collectionNote && collectionNote.operation !== "AddCollectionNote") throw new WorkflowError("unsupported_recovery_family");
    const linkedScheduleCreation = input.family === "linked_schedule_create" ? prior as LinkedScheduleCreation : undefined;
    if (linkedScheduleCreation && linkedScheduleCreation.operation !== "CreateLinkedSchedule") throw new WorkflowError("unsupported_recovery_family");
    const target = linkedScheduleCreation ? linkedScheduleCreationTarget(linkedScheduleCreation.proposed) : collectionNote ? collectionNoteTarget(collectionNote.proposed) : referralCreation ? referralCreationTarget(referralCreation.proposed) : contractCreation ? contractCreationTarget(contractCreation.proposed) : picture ? caregiverPictureTarget(picture.caregiverId) : documentCreation ? documentCreationTarget(documentCreation.userRole, documentCreation.subjectId) : replacement ? documentMetadataTarget(replacement.userRole, replacement.subjectId) : medical ? medicalCreationTarget(medical.proposed) : clinical ? `patient_clinical_${clinical.patientId}` : documentMetadata ? documentMetadataTarget(documentMetadata.userRole, documentMetadata.subjectId) : patientNote ? patientNoteTarget(patientNote.proposed) : availabilityCreation ? availabilityCreationTarget(availabilityCreation.proposed) : contract ? `patient_contracts_${contract.patientId}` : creation ? rateCreationTarget(creation.proposed) : topic ? topicTarget(topic.topic, topic.officeId) : documentType ? `document_type_${documentType.userRole}_${documentType.recordId}` : rate ? `rate_${rate.caregiverId}_${rate.rateId}` : `availability_${availability.operation}_${availability.caregiverId}_${availability.recordId}`;
    if (linkedScheduleCreation && prior.recovery?.outcome === "applied") throw new WorkflowError("linked_schedule_vendor_evidence_verifier_required", 423);
    // Retrying a completed recovery can only release this exact proposal's lock;
    // it cannot clear a newer proposal's lock or resubmit the original mutation.
    if (action === "approve" && prior.recovery?.state === "resolved") {
      if (actor !== prior.recovery.reviewedBy) throw new WorkflowError("recovery_reviewer_required", 403);
      await this.repository.releaseWriteTarget(target, prior.id); return prior;
    }
    const lock = await this.repository.getWriteTarget(target);
    if (!lock?.active || lock.proposalId !== prior.id) throw new WorkflowError("matching_active_target_lock_required", 409);
    // API runtime is explicitly capped at 60 seconds. This guard is additional
    // to, not a substitute for, reviewed proof that the submitting worker ended.
    if (!Number.isFinite(Date.parse(lock.updatedAt)) || Date.now() - Date.parse(lock.updatedAt) < 120_000) throw new WorkflowError("write_recovery_wait_for_worker_termination", 409);
    if (action === "prepare" && prior.recovery) throw new WorkflowError("recovery_already_prepared", 409);
    const pending = prior.recovery;
    if (action === "approve" && (!pending || pending.state !== "pending_review" || pending.requestedBy === actor)) throw new WorkflowError("independent_recovery_reviewer_required", 403);
    const outcome = action === "prepare" ? input.outcome : pending!.outcome;
    if (outcome !== "applied" && outcome !== "not_applied") throw new WorkflowError("invalid_recovery_outcome");
    // A typed assertion and a case-reference string are not source evidence.
    // No supported verifier for persisted linked ScheduleType exists yet.
    if (linkedScheduleCreation && outcome === "applied") throw new WorkflowError("linked_schedule_vendor_evidence_verifier_required", 423);
    if (!prior.execution && outcome === "applied") throw new WorkflowError("unattempted_proposal_cannot_be_confirmed_applied", 409);
    let current: Record<string, string | null>, matches: boolean;
    if (linkedScheduleCreation) {
      current = await currentLinkedScheduleCreation(this.read, linkedScheduleCreation.proposed, linkedScheduleCreation.officeId);
      matches = sameCreatedLinkedScheduleFacts(current, outcome === "applied" ? linkedScheduleCreation.proposed : linkedScheduleCreation.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.VisitID === prior.execution.vendorRecordId);
    } else if (collectionNote) {
      current = await currentCollectionNote(this.read, collectionNote.proposed, collectionNote.officeId, outcome === "applied" ? prior.execution?.vendorRecordId : undefined);
      matches = sameCollectionNoteFacts(current, outcome === "applied" ? collectionNote.proposed : collectionNote.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.NoteID === prior.execution.vendorRecordId);
    } else if (referralCreation) {
      current = await currentReferralCreation(this.read, referralCreation.proposed, referralCreation.officeId);
      matches = sameCreatedReferralFacts(current, outcome === "applied" ? referralCreation.proposed : referralCreation.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.ReferralSourceID === prior.execution.vendorRecordId);
    } else if (contractCreation) {
      current = await currentContractCreation(this.read, contractCreation.proposed, contractCreation.officeId);
      matches = sameCreatedContractFacts(current, outcome === "applied" ? contractCreation.proposed : contractCreation.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.PlacementID === prior.execution.vendorRecordId);
    } else if (picture) {
      current = await currentCaregiverPicture(this.read, picture.caregiverId, picture.officeId);
      matches = sameSourceFacts(current, outcome === "applied" ? picture.proposed : picture.before);
    } else if (documentCreation) {
      current = await currentDocumentCreation(this.read, documentCreation.proposed, documentCreation.officeId);
      matches = sameCreatedDocument(current, outcome === "applied" ? documentCreation.proposed : documentCreation.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.DocumentID === prior.execution.vendorRecordId);
    } else if (replacement) {
      current = (await currentDocumentMetadata(this.read, replacement.userRole, replacement.subjectId, replacement.documentId, replacement.officeId)).facts;
      matches = sameSourceFacts(current, outcome === "applied" ? replacement.proposed : replacement.before);
    } else if (medical) {
      current = await currentMedicalCreation(this.read, medical.proposed, medical.officeId);
      matches = sameCreatedMedicalFacts(current, outcome === "applied" ? medical.proposed : medical.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.CaregiverMedicalID === prior.execution.vendorRecordId);
    } else if (clinical) {
      current = await currentPatientClinical(this.read, clinical.patientId, clinical.officeId);
      matches = sameSourceFacts(current, outcome === "applied" ? clinical.proposed : clinical.before);
    } else if (documentMetadata) {
      current = (await currentDocumentMetadata(this.read, documentMetadata.userRole, documentMetadata.subjectId, documentMetadata.documentId, documentMetadata.officeId)).facts;
      matches = sameSourceFacts(current, outcome === "applied" ? documentMetadata.proposed : documentMetadata.before);
    } else if (patientNote) {
      current = await currentPatientNote(this.read, patientNote.proposed, patientNote.officeId);
      matches = samePatientNoteFacts(current, outcome === "applied" ? patientNote.proposed : patientNote.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.NoteID === prior.execution.vendorRecordId);
    } else if (availabilityCreation) {
      current = await currentAvailabilityCreation(this.read, availabilityCreation.proposed, availabilityCreation.officeId);
      matches = sameAvailabilityCreationFacts(current, outcome === "applied" ? availabilityCreation.proposed : availabilityCreation.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.RecordID === prior.execution.vendorRecordId);
    } else if (contract) {
      current = await currentPatientContract(this.read, contract.patientId, contract.date, contract.recordId, contract.officeId);
      matches = sameSourceFacts(current, outcome === "applied" ? contract.proposed : contract.before);
    } else if (creation) {
      current = await currentRateCreation(this.read, creation.proposed, creation.officeId);
      matches = sameCreatedRateFacts(current, outcome === "applied" ? creation.proposed : creation.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.CaregiverRateID === prior.execution.vendorRecordId);
    } else if (topic) {
      current = await currentTopic(this.read, topic.topic, topic.officeId);
      matches = sameTopicFacts(current, outcome === "applied" ? topic.proposed : topic.before) && (outcome !== "applied" || !prior.execution?.vendorRecordId || current.TopicID === prior.execution.vendorRecordId);
    } else {
    const source = await this.read(documentType ? { operation: documentType.userRole === "Patient" ? "GetPatientDocumentType" : "GetCaregiverDocumentType", id: documentType.documentId, status: "All" } : rate ? { operation: "GetCaregiverRates", id: rate.caregiverId } : { operation: availability.operation === "UpdateCaregiverPermanentWeekAvailability" ? "GetCaregiverPermanentWeekAvailability" : "GetCaregiverSpecialAvailability", id: availability.caregiverId });
    const rows = source.records.filter(row => documentType ? row[documentType.userRole + "DocumentTypeID"] === documentType.recordId : rate ? row.CaregiverID === rate.caregiverId && row.CaregiverRateID === rate.rateId : row.CaregiverID === availability.caregiverId && row[availability.operation === "UpdateCaregiverPermanentWeekAvailability" ? "PermanentWeekID" : "SpecialAvailabilityID"] === availability.recordId && row.OfficeID === availability.officeId);
    if (source.truncated || rows.length !== 1) throw new WorkflowError("recovery_source_not_unique", 409);
    const row = rows[0]!;
    current = documentType ? { UserRole: documentType.userRole, DocumentTypeID: documentType.recordId, DocumentType: row[documentType.userRole + "DocumentType"] ?? null, Description: row.Description ?? null, Status: row.Status ?? null } : row;
    matches = documentType ? sameSourceFacts(current, outcome === "applied" ? documentType.proposed : documentType.before) : rate ? outcome === "applied" ? sameDecimal(current.HourlyRate, rate.proposedHourlyRate) && sameSourceFacts({ ...current, HourlyRate: rate.before.HourlyRate ?? null }, rate.before) : sameSourceFacts(current, rate.before) : sameSourceFacts(current, outcome === "applied" ? availability.proposed : availability.before);
    }
    if (!matches) throw new WorkflowError("recovery_outcome_source_mismatch", 409);
    const sourceFingerprint = fingerprint(current);
    if (action === "approve" && sourceFingerprint !== pending!.sourceFingerprint) throw new WorkflowError("recovery_source_changed", 409);
    const recovery: WriteRecovery = action === "prepare" ? { state: "pending_review", outcome, ...(linkedScheduleCreation && outcome === "applied" ? { confirmedScheduleType: "Non-Skilled" as const } : {}), vendorCaseReference: reference(input.vendorCaseReference), runtimeTerminationReference: reference(input.runtimeTerminationReference), requestedBy: actor, requestedAt: new Date().toISOString(), sourceFingerprint } : { ...pending!, state: "resolved", reviewedBy: actor, resolvedAt: new Date().toISOString() };
    const saved = await this.repository.change<Recoverable>(collection, prior.id, prior.revision, actor, action === "prepare" ? "write_recovery_evidence_prepared" : "write_recovery_independently_resolved", row => ({ ...row!, recovery, revision: prior.revision + 1, updatedAt: new Date().toISOString() }));
    // Terminal proposal + audit are durable before releasing. A crash between
    // these steps is recoverable by the same approving actor without SOAP writes.
    if (action === "approve") await this.repository.releaseWriteTarget(target, prior.id);
    return saved;
  }
}
