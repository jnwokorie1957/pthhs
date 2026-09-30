import { submitLinkedScheduleCreation, LINKED_SCHEDULE_EVIDENCE_VERIFIER_AVAILABLE } from "./operations/linkedScheduleCreations.js";
import { collectionActionAllowed } from "./auth/workflowPermissions.js";
import { submitCollectionNote } from "./operations/collectionNotes.js";
import { submitReferralCreation } from "./operations/referralCreations.js";
import { submitContractCreation } from "./operations/contractCreations.js";
import { submitCaregiverPicture } from "./operations/caregiverPictures.js";
import { DOCUMENT_CREATION_WRITES, submitDocumentCreation } from "./operations/documentCreations.js";
import { DOCUMENT_REPLACEMENT_WRITES, submitDocumentReplacement } from "./operations/documentReplacements.js";
import { submitMedicalCreation } from "./operations/medicalCreations.js";
import { submitPatientClinical } from "./operations/patientClinical.js";
import { DOCUMENT_METADATA_WRITES, submitDocumentMetadata } from "./operations/documentMetadata.js";
import { submitPatientNote } from "./operations/patientNotes.js";
import { AVAILABILITY_CREATIONS, submitAvailabilityCreation } from "./operations/availabilityCreations.js";
import { submitPatientContract } from "./operations/patientContracts.js";
import { submitRateCreation } from "./operations/rateCreations.js";
import { submitTopic } from "./operations/topics.js";
import { submitDocumentType } from "./operations/documentTypes.js";
import { AVAILABILITY_WRITES, submitAvailability } from "./operations/availability.js";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import {
  PrimetimeAuthError,
  requirePrimetimeAdmin,
} from "./auth/admin.js";
import {
  getHhaCredentials,
  hhaBaseUrl,
  hhaCredentials,
} from "./integrations/hhaexchange/config.js";
import { HhaSoapClient } from "./integrations/hhaexchange/client.js";
import { SyncStateStore } from "./sync/state.js";
import { defineString } from "firebase-functions/params";
import { OperationsWorkspace, FirestoreWorkspaceRepository } from "./operations/workspace.js";
import { operationalRead } from "./operations/reads.js";
import { submitRate } from "./operations/writes.js";
import { workspaceRoute } from "./operations/routes.js";

// Deployment approval is separate from owner feature preferences. The browser
// cannot enable PHI processing or HHA write execution through settings.
const permanentAvailabilityCreateApproved = defineString("PRIMETIME_PERMANENT_AVAILABILITY_CREATE_APPROVED", { default: "false" });
const specialAvailabilityCreateApproved = defineString("PRIMETIME_SPECIAL_AVAILABILITY_CREATE_APPROVED", { default: "false" });
const collectionNoteApproved = defineString("PRIMETIME_COLLECTION_NOTE_WRITE_APPROVED", { default: "false" });
const linkedScheduleCreationApproved = defineString("PRIMETIME_LINKED_SCHEDULE_CREATE_APPROVED", { default: "false" });
const referralCreationApproved = defineString("PRIMETIME_REFERRAL_SOURCE_CREATE_APPROVED", { default: "false" });
const contractCreationApproved = defineString("PRIMETIME_PATIENT_CONTRACT_CREATE_APPROVED", { default: "false" });
const caregiverPictureApproved = defineString("PRIMETIME_CAREGIVER_PICTURE_WRITE_APPROVED", { default: "false" });
const patientDocumentCreationApproved = defineString("PRIMETIME_PATIENT_DOCUMENT_CREATE_APPROVED", { default: "false" });
const caregiverDocumentCreationApproved = defineString("PRIMETIME_CAREGIVER_DOCUMENT_CREATE_APPROVED", { default: "false" });
const patientDocumentReplacementApproved = defineString("PRIMETIME_PATIENT_DOCUMENT_REPLACEMENT_APPROVED", { default: "false" });
const caregiverDocumentReplacementApproved = defineString("PRIMETIME_CAREGIVER_DOCUMENT_REPLACEMENT_APPROVED", { default: "false" });
const medicalCreationWriteApproved = defineString("PRIMETIME_CAREGIVER_MEDICAL_DUE_CREATE_APPROVED", { default: "false" });
const patientClinicalWriteApproved = defineString("PRIMETIME_PATIENT_CLINICAL_COMMENT_WRITE_APPROVED", { default: "false" });
const patientDocumentMetadataApproved = defineString("PRIMETIME_PATIENT_DOCUMENT_METADATA_WRITE_APPROVED", { default: "false" });
const caregiverDocumentMetadataApproved = defineString("PRIMETIME_CAREGIVER_DOCUMENT_METADATA_WRITE_APPROVED", { default: "false" });
const patientNoteWriteApproved = defineString("PRIMETIME_INTERNAL_PATIENT_NOTE_CREATE_APPROVED", { default: "false" });
const patientContractWriteApproved = defineString("PRIMETIME_PATIENT_CONTRACT_ID_WRITE_APPROVED", { default: "false" });
const operationalDataApproved = defineString("PRIMETIME_OPERATIONAL_DATA_APPROVED", { default: "false" });
const rateWriteApproved = defineString("PRIMETIME_RATE_WRITE_APPROVED", { default: "false" });

const permanentAvailabilityWriteApproved = defineString("PRIMETIME_PERMANENT_AVAILABILITY_WRITE_APPROVED", { default: "false" });
const specialAvailabilityWriteApproved = defineString("PRIMETIME_SPECIAL_AVAILABILITY_WRITE_APPROVED", { default: "false" });

const documentTypeWriteApproved = defineString("PRIMETIME_DOCUMENT_TYPE_WRITE_APPROVED", { default: "false" });

const topicWriteApproved = defineString("PRIMETIME_INSERVICE_TOPIC_CREATE_APPROVED", { default: "false" });

const rateCreationApproved = defineString("PRIMETIME_CAREGIVER_RATE_CREATE_APPROVED", { default: "false" });

const API_PREFIX = "/primetime/api";

function apiPath(path: string): string {
  if (path.startsWith(API_PREFIX)) {
    return path.slice(API_PREFIX.length) || "/";
  }
  return path || "/";
}

export const primetimeApi = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
    secrets: [hhaCredentials],
  },
  async (request, response) => {
    response.set("Cache-Control", "no-store");

    let principal;
    try {
      principal = await requirePrimetimeAdmin(request);
    } catch (error) {
      if (error instanceof PrimetimeAuthError) {
        response.status(error.statusCode).json({ error: error.code });
        return;
      }

      logger.error("Primetime authentication failed unexpectedly", {
        errorName: error instanceof Error ? error.name : "unknown",
      });
      response.status(500).json({ error: "auth_internal_error" });
      return;
    }

    const path = apiPath(request.path);

    if (path.startsWith("/workspace/")) {
      if (!collectionActionAllowed(principal.roles, request.method, path, request.body)) {
        response.status(403).json({ ok: false, error: path.includes("linked-schedule") || request.body?.family === "linked_schedule_create" ? "scheduling_reviewer_role_required" : "collections_reviewer_role_required" });
        return;
      }
      const bodyLimit = /^\/workspace\/(?:document-replacements|document-creations|caregiver-pictures)\/(prepare|review|execute)$/.test(path) ? 2_820_000 : 16000;
      if (request.method === "POST" && (!request.is("application/json") || JSON.stringify(request.body ?? {}).length > bodyLimit)) {
        response.status(400).json({ ok: false, error: "invalid_json_request" });
        return;
      }
      const repository = new FirestoreWorkspaceRepository();
      const client = new HhaSoapClient(hhaBaseUrl.value(), getHhaCredentials(), { beforeRequest: () => repository.reserveRead(), defer: seconds => repository.deferReads(seconds) });
      const service = new OperationsWorkspace(repository, (input, projectionScope) => operationalRead(client, input, projectionScope), operationalDataApproved.value() === "true", { approved: rateWriteApproved.value() === "true", submit: (before, hourlyRate) => submitRate(client, before, hourlyRate) }, undefined, { enabled: AVAILABILITY_WRITES.filter((_, index) => (index === 0 ? permanentAvailabilityWriteApproved : specialAvailabilityWriteApproved).value() === "true"), submit: (operation, facts) => submitAvailability(client, operation, facts) }, { approved: documentTypeWriteApproved.value() === "true", submit: facts => submitDocumentType(client, facts) }, { approved: topicWriteApproved.value() === "true", submit: facts => submitTopic(client, facts) }, { approved: rateCreationApproved.value() === "true", submit: facts => submitRateCreation(client, facts) }, { approved: patientContractWriteApproved.value() === "true", submit: facts => submitPatientContract(client, facts) }, { enabled: AVAILABILITY_CREATIONS.filter((_, index) => (index === 0 ? permanentAvailabilityCreateApproved : specialAvailabilityCreateApproved).value() === "true"), submit: facts => submitAvailabilityCreation(client, facts) }, { approved: patientNoteWriteApproved.value() === "true", submit: facts => submitPatientNote(client, facts) }, { enabled: DOCUMENT_METADATA_WRITES.filter((_, index) => (index === 0 ? patientDocumentMetadataApproved : caregiverDocumentMetadataApproved).value() === "true"), submit: (facts, base64) => submitDocumentMetadata(client, facts, base64) }, { approved: patientClinicalWriteApproved.value() === "true", submit: facts => submitPatientClinical(client, facts) }, { approved: medicalCreationWriteApproved.value() === "true", submit: facts => submitMedicalCreation(client, facts) }, { enabled: DOCUMENT_REPLACEMENT_WRITES.filter((_, index) => (index === 0 ? patientDocumentReplacementApproved : caregiverDocumentReplacementApproved).value() === "true"), submit: (facts, base64) => submitDocumentReplacement(client, facts, base64) }, { enabled: DOCUMENT_CREATION_WRITES.filter((_, index) => (index === 0 ? patientDocumentCreationApproved : caregiverDocumentCreationApproved).value() === "true"), submit: (facts, base64) => submitDocumentCreation(client, facts, base64) }, { approved: caregiverPictureApproved.value() === "true", submit: (facts, base64) => submitCaregiverPicture(client, facts, base64) }, { approved: contractCreationApproved.value() === "true", submit: facts => submitContractCreation(client, facts) }, { approved: referralCreationApproved.value() === "true", submit: facts => submitReferralCreation(client, facts) }, { approved: collectionNoteApproved.value() === "true" && principal.roles.includes("collections_reviewer"), submit: facts => submitCollectionNote(client, facts) }, { approved: LINKED_SCHEDULE_EVIDENCE_VERIFIER_AVAILABLE && linkedScheduleCreationApproved.value() === "true" && principal.roles.includes("scheduling_reviewer"), submit: facts => submitLinkedScheduleCreation(client, facts) });
      const result = await workspaceRoute(service, request.method, path, request.method === "GET" ? request.query : request.body, principal.uid);
      response.status(result?.status ?? 404).json(result?.body ?? { error: "not_found" });
      return;
    }

    if (request.method === "GET" && path === "/integration/health") {
      try {
        response.status(200).json({ ok: true, sync: await new SyncStateStore().health() });
      } catch {
        response.status(503).json({ ok: false, error: "integration_state_unavailable" });
      }
      return;
    }

    if (request.method === "GET" && path === "/session") {
      response.status(200).json({
        ok: true,
        uid: principal.uid,
        roles: principal.roles,
        ...(principal.email ? { email: principal.email } : {}),
      });
      return;
    }

    if (request.method === "GET" && path === "/status") {
      response.status(200).json({
        ok: true,
        service: "primetime-admin-api",
        stage: "auth-gated",
        hhaConnection: "not_tested",
      });
      return;
    }

    if (request.method === "GET" && path === "/hha/health") {
      try {
      const repository = new FirestoreWorkspaceRepository();
      const client = new HhaSoapClient(
        hhaBaseUrl.value(),
        getHhaCredentials(),
        { beforeRequest: () => repository.reserveRead(), defer: seconds => repository.deferReads(seconds) },
      );
      const result = await client.getCollectionStatuses("Active");

      if (result.response.ok) {
        response.status(200).json({
          ok: true,
          hhaConnection: "reachable",
          operation: "GetCollectionStatus",
          correlationId: result.response.correlationId,
          referenceCount: result.statuses.length,
          durationMs: result.response.durationMs,
        });
        return;
      }

      const statusCode = result.response.httpStatus === 0 ? 503 : 502;
      response.status(statusCode).json({
        ok: false,
        hhaConnection:
          result.response.httpStatus === 401 || result.response.httpStatus === 403
            ? "auth_failure"
            : "operation_failure",
        operation: "GetCollectionStatus",
        correlationId: result.response.correlationId,
        httpStatus: result.response.httpStatus,
        applicationStatus: result.response.status ?? "unknown",
        errorKind: result.response.error?.kind ?? "unknown",
        ...(result.response.error?.id !== undefined
          ? { errorId: result.response.error.id }
          : {}),
      });
      return;
      } catch {
        response.status(503).json({ ok: false, hhaConnection: "unavailable_or_deferred", operation: "GetCollectionStatus" });
        return;
      }
    }

    logger.info("Unhandled Primetime API route", {
      method: request.method,
      path,
      uid: principal.uid,
    });

    response.status(404).json({ error: "not_found" });
  },
);
