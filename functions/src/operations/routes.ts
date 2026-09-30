import { OperationsWorkspace } from "./workspace.js";
import { WorkflowError } from "./reads.js";

export async function workspaceRoute(service: OperationsWorkspace, method: string, path: string, body: unknown, actor: string): Promise<{ status: number; body: unknown } | null> {
  const paths = ["/workspace/settings", "/workspace/read", "/workspace/investigations", "/workspace/intents", "/workspace/audit", "/workspace/rate-proposals", "/workspace/rate-proposals/recheck", "/workspace/visit-review", "/workspace/rate-proposals/execute", "/workspace/rate-proposals/reconcile", "/workspace/staffing-review", "/workspace/availability-proposals", "/workspace/availability-proposals/recheck", "/workspace/availability-proposals/review", "/workspace/availability-proposals/execute", "/workspace/availability-proposals/reconcile", "/workspace/write-recovery/prepare", "/workspace/write-recovery/approve"];
  const availabilityCreationAction = path.match(/^\/workspace\/availability-creations(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const patientNoteAction = path.match(/^\/workspace\/patient-notes(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const documentMetadataAction = path.match(/^\/workspace\/document-metadata(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const medicalCreationAction = path.match(/^\/workspace\/medical-creations(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const replacementAction = path.match(/^\/workspace\/document-replacements(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const creationAction = path.match(/^\/workspace\/document-creations(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const collectionNoteAction = path.match(/^\/workspace\/collection-notes(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const linkedScheduleCreationAction = path.match(/^\/workspace\/linked-schedule-creations(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const referralCreationAction = path.match(/^\/workspace\/referral-creations(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const contractCreationAction = path.match(/^\/workspace\/contract-creations(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const pictureAction = path.match(/^\/workspace\/caregiver-pictures(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const clinicalAction = path.match(/^\/workspace\/patient-clinical(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const contractAction = path.match(/^\/workspace\/patient-contracts(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const rateCreationAction = path.match(/^\/workspace\/rate-creations(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const topicAction = path.match(/^\/workspace\/topics(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  const documentAction = path.match(/^\/workspace\/document-types(?:\/(prepare|recheck|review|execute|reconcile))?$/)?.[1];
  if (path !== "/workspace/schedule-review" && path !== "/workspace/linked-schedule-creations" && !linkedScheduleCreationAction && path !== "/workspace/collection-notes" && !collectionNoteAction && path !== "/workspace/referral-creations" && !referralCreationAction && path !== "/workspace/contract-creations" && !contractCreationAction && path !== "/workspace/caregiver-pictures" && !pictureAction && path !== "/workspace/document-creations" && !creationAction && path !== "/workspace/document-replacements" && !replacementAction && path !== "/workspace/medical-creations" && !medicalCreationAction && path !== "/workspace/patient-clinical" && !clinicalAction && path !== "/workspace/document-metadata" && !documentMetadataAction && path !== "/workspace/patient-notes" && !patientNoteAction && path !== "/workspace/availability-creations" && !availabilityCreationAction && path !== "/workspace/patient-contracts" && !contractAction && !paths.includes(path) && path !== "/workspace/document-types" && !documentAction && path !== "/workspace/topics" && !topicAction && path !== "/workspace/rate-creations" && !rateCreationAction) return null;
  try {
    let result: unknown;
    if (method === "POST" && path === "/workspace/schedule-review") result = await service.reviewSchedule(body, actor);
    else if (method === "POST" && pictureAction) result = { change: await service.caregiverPicture(pictureAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "POST" && collectionNoteAction) result = { change: await service.collectionNote(collectionNoteAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/collection-notes") { const page = await service.page("collectionNoteChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && linkedScheduleCreationAction) result = { change: await service.createLinkedSchedule(linkedScheduleCreationAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/linked-schedule-creations") { const page = await service.page("linkedScheduleCreations", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && referralCreationAction) result = { change: await service.createReferral(referralCreationAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/referral-creations") { const page = await service.page("referralCreations", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && contractCreationAction) result = { change: await service.createContract(contractCreationAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/contract-creations") { const page = await service.page("contractCreations", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "GET" && path === "/workspace/caregiver-pictures") { const page = await service.page("caregiverPictureChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && creationAction) result = { change: await service.documentCreation(creationAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/document-creations") { const page = await service.page("documentCreationChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && replacementAction) result = { change: await service.documentReplacement(replacementAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/document-replacements") { const page = await service.page("documentReplacementChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && medicalCreationAction) result = { change: await service.createMedical(medicalCreationAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/medical-creations") { const page = await service.page("medicalCreations", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && clinicalAction) result = { change: await service.patientClinical(clinicalAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/patient-clinical") { const page = await service.page("patientClinicalChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && documentMetadataAction) result = { change: await service.documentMetadata(documentMetadataAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/document-metadata") { const page = await service.page("documentMetadataChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && patientNoteAction) result = { change: await service.patientNote(patientNoteAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/patient-notes") { const page = await service.page("patientNoteChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && availabilityCreationAction) result = { change: await service.createAvailability(availabilityCreationAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/availability-creations") { const page = await service.page("availabilityCreations", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && contractAction) result = { change: await service.patientContract(contractAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/patient-contracts") { const page = await service.page("patientContractChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && rateCreationAction) result = { change: await service.createRate(rateCreationAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/rate-creations") { const page = await service.page("rateCreations", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && topicAction) result = { change: await service.topic(topicAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/topics") { const page = await service.page("topicChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "POST" && documentAction) result = { change: await service.documentType(documentAction as "prepare" | "recheck" | "review" | "execute" | "reconcile", body, actor) };
    else if (method === "GET" && path === "/workspace/document-types") { const page = await service.page("documentTypeChanges", body); result = { changes: page.items, nextCursor: page.nextCursor }; }
    else if (method === "GET" && path === paths[0]) result = await service.settings();
    else if (method === "POST" && path === paths[0]) result = { settings: await service.saveSettings(body, actor) };
    else if (method === "POST" && path === paths[1]) result = await service.query(body, actor);
    else if (method === "GET" && path === paths[2]) { const page = await service.page("investigations", body); result = { investigations: page.items, nextCursor: page.nextCursor, limit: 100 }; }
    else if (method === "POST" && path === paths[2]) result = { investigation: await service.saveInvestigation(body, actor) };
    else if (method === "GET" && path === paths[3]) { const page = await service.page("writeIntents", body); result = { intents: page.items, nextCursor: page.nextCursor, limit: 100, submissionAutomatic: false }; }
    else if (method === "POST" && path === paths[3]) result = { intent: await service.saveIntent(body, actor), submissionAutomatic: false };
    else if (method === "GET" && path === paths[4]) { const page = await service.page("workspaceAudit", body); result = { events: page.items, nextCursor: page.nextCursor, limit: 100 }; }
    else if (method === "POST" && path === paths[5]) result = { intent: await service.prepareRate(body, actor), submissionAutomatic: false };
    else if (method === "POST" && path === paths[6]) result = { intent: await service.recheckRate(body, actor), submissionAutomatic: false };
    else if (method === "POST" && path === paths[7]) result = await service.reviewVisits(body, actor);
    else if (method === "POST" && path === paths[8]) result = { intent: await service.executeRate(body, actor) };
    else if (method === "POST" && path === paths[9]) result = { intent: await service.reconcileRate(body, actor) };
    else if (method === "POST" && path === paths[10]) result = await service.reviewStaffing(body, actor);
    else if (method === "GET" && path === paths[11]) { const page = await service.page("availabilityChanges", body); result = { changes: page.items, nextCursor: page.nextCursor, limit: 100 }; }
    else if (method === "POST" && path === paths[11]) result = { change: await service.availability("prepare", body, actor) };
    else if (method === "POST" && path === paths[12]) result = { change: await service.availability("recheck", body, actor) };
    else if (method === "POST" && path === paths[13]) result = { change: await service.availability("review", body, actor) };
    else if (method === "POST" && path === paths[14]) result = { change: await service.availability("execute", body, actor) };
    else if (method === "POST" && path === paths[15]) result = { change: await service.availability("reconcile", body, actor) };
    else if (method === "POST" && path === paths[16]) result = { proposal: await service.recoverWrite("prepare", body, actor) };
    else if (method === "POST" && path === paths[17]) result = { proposal: await service.recoverWrite("approve", body, actor) };
    else return { status: 405, body: { ok: false, error: "method_not_allowed" } };
    return { status: 200, body: { ok: true, ...result as object } };
  } catch (error) {
    return { status: error instanceof WorkflowError ? error.status : 503, body: { ok: false, error: error instanceof WorkflowError ? error.code : "workspace_unavailable", ...(error instanceof WorkflowError && error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) } };
  }
}
