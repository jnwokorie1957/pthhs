// No supported verifier for persisted ScheduleType has been integrated.
// Deployment configuration alone must not make this partial workflow executable.
export const LINKED_SCHEDULE_EVIDENCE_VERIFIER_AVAILABLE = false;
import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface LinkedScheduleCreation extends Versioned {
  operation: "CreateLinkedSchedule"; officeId: string;
  before: Facts; proposed: Facts; authorityReference: string; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface LinkedScheduleCreationSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_linked_schedule_creation_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function date(value:unknown):string{if(typeof value!=="string"||!/^\d{4}-\d\d-\d\d$/.test(value)||!Number.isFinite(Date.parse(value+"T00:00:00Z"))||new Date(value+"T00:00:00Z").toISOString().slice(0,10)!==value)throw new WorkflowError("explicit_schedule_date_required");return value;}
function time(value:unknown):string{if(typeof value!=="string"||! /^(?:[01]\d|2[0-3])[0-5]\d$/.test(value))throw new WorkflowError("explicit_office_HHMM_required");return value;}
const shifted=(value:string,days:number)=>new Date(Date.parse(value+"T00:00:00Z")+days*86400000).toISOString().slice(0,10);
// One office-wide scheduling target prevents patient/caregiver collisions between
// different local proposals. It cannot lock external HHA operators.
export const linkedScheduleCreationTarget=(facts:Facts)=>`schedule_office_${identifier(facts.OfficeID)}`;
export function sameCreatedLinkedScheduleFacts(left:Facts,right:Facts){const canonical=(facts:Facts)=>Object.fromEntries(Object.entries(facts).filter(([key])=>key!=="VisitID"));return sameSourceFacts(canonical(left),canonical(right));}
export function createLinkedScheduleRequest(facts:Facts):string{
 for(const key of ["PatientID","CaregiverID","PayCodeID","ServiceCodeID","OfficeID"])identifier(facts[key]);
 const start=time(facts.ScheduleStartTime),end=time(facts.ScheduleEndTime);
 if(facts.ScheduleType!=="Non-Skilled"||start>=end)throw new WorkflowError("same_day_non_skilled_schedule_required");
 return `<ScheduleInfo><PatientID>${facts.PatientID}</PatientID><PatientDateOfBirth xsi:nil="true"/><ScheduleType>Non-Skilled</ScheduleType><VisitDate>${date(facts.VisitDate)}T00:00:00</VisitDate><ScheduleStartTime>${start}</ScheduleStartTime><ScheduleEndTime>${end}</ScheduleEndTime><CaregiverID>${facts.CaregiverID}</CaregiverID><CaregiverDateOfBirth xsi:nil="true"/><PayCodeID>${facts.PayCodeID}</PayCodeID><ServiceCodeID>${facts.ServiceCodeID}</ServiceCodeID></ScheduleInfo>`;
}
export async function currentLinkedScheduleCreation(read:(input:ReadInput)=>Promise<OperationalRead>,facts:Facts,officeId:string):Promise<Facts>{
 createLinkedScheduleRequest(facts);
 const [patient,caregiver]=await Promise.all([read({operation:"GetPatientDemographics",id:identifier(facts.PatientID)}),read({operation:"GetCaregiverDemographics",id:identifier(facts.CaregiverID)})]);
 if(patient.truncated||patient.records.length!==1||patient.records[0]?.PatientID!==facts.PatientID||patient.records[0]?.OfficeID!==officeId||patient.records[0]?.PatientStatusName!=="Active")throw new WorkflowError("active_schedule_patient_office_required",409);
 if(caregiver.truncated||caregiver.records.length!==1||caregiver.records[0]?.ID!==facts.CaregiverID||caregiver.records[0]?.OfficeIDs!==JSON.stringify([officeId])||caregiver.records[0]?.["Status/Name"]!=="Active")throw new WorkflowError("active_single_office_schedule_caregiver_required",409);
 const [services,skilled,paycodes]=await Promise.all([read({operation:"GetLinkedContractServiceCodes",patientId:facts.PatientID!,scheduleType:"Non-Skilled"}),read({operation:"GetLinkedContractServiceCodes",patientId:facts.PatientID!,scheduleType:"Skilled"}),read({operation:"GetCaregiverPayCodes",id:facts.CaregiverID!})]);
 const service=services.records.filter(row=>row.ServiceCodeID===facts.ServiceCodeID),pay=paycodes.records.filter(row=>row.PayCodeID===facts.PayCodeID);
 if([services,skilled,paycodes].some(row=>row.truncated)||service.length!==1||!service[0]!.ServiceCodeName||skilled.records.some(row=>row.ServiceCodeID===facts.ServiceCodeID)||pay.length!==1||!pay[0]!.PayCodeName)throw new WorkflowError("unambiguous_non_skilled_service_and_pay_code_required",409);
 const base:Facts={OfficeID:officeId,PatientID:facts.PatientID!,CaregiverID:facts.CaregiverID!,PayCodeID:facts.PayCodeID!,ServiceCodeID:facts.ServiceCodeID!,ScheduleType:"Non-Skilled",VisitDate:date(facts.VisitDate),ServiceCodeName:service[0]!.ServiceCodeName!,PayCodeName:pay[0]!.PayCodeName!};
 // Conservative first schedule scope: no other schedules on either subject's
 // adjacent calendar days. This also rejects unknown overnight overlaps.
 const discovery=await Promise.all([-1,0,1].flatMap(offset=>["patient","caregiver"].map(subject=>read({operation:"SearchVisitsV2",officeId,date:shifted(base.VisitDate!,offset),...(subject==="patient"?{patientId:base.PatientID!}:{caregiverId:base.CaregiverID!})}))));
 if(discovery.some(row=>row.truncated))throw new WorkflowError("complete_schedule_discovery_required",409);
 if([0,1,4,5].some(index=>discovery[index]!.records.length))throw new WorkflowError("adjacent_day_schedule_requires_operator_review",409);
 const patientVisits=discovery[2]!.records,caregiverVisits=discovery[3]!.records;
 if(!patientVisits.length&&!caregiverVisits.length)return {Exists:"false",...base};
 if(patientVisits.length!==1||caregiverVisits.length!==1||patientVisits[0]!.VisitID!==caregiverVisits[0]!.VisitID)throw new WorkflowError("existing_schedule_requires_operator_review",409);
 const visitId=identifier(patientVisits[0]!.VisitID),source=await read({operation:"GetLinkedScheduleInfo",id:visitId});
 if(source.truncated||source.records.length!==1)throw new WorkflowError("unique_linked_schedule_readback_required",409);
 const row=source.records[0]!;
 if(row.ID!==visitId||row["Patient/ID"]!==base.PatientID||row["Caregiver/ID"]!==base.CaregiverID)throw new WorkflowError("linked_schedule_identity_mismatch",409);
 return {...base,Exists:"true",VisitID:visitId,VisitDate:date(row.VisitDate),ScheduleStartTime:time(row.ScheduleStartTime),ScheduleEndTime:time(row.ScheduleEndTime),PayCodeID:row["Caregiver/PayCode/ID"]??null,ServiceCodeID:row["PrimaryBillTo/ServiceCode/ID"]??null};
}
export async function submitLinkedScheduleCreation(client:Pick<HhaSoapClient,"call">,facts:Facts):Promise<LinkedScheduleCreationSubmission>{
 const response=await client.call("CreateLinkedSchedule",createLinkedScheduleRequest(facts),1);
 if(!response.ok||!response.resultXml||extractElementText(response.resultXml,"PatientID")!==facts.PatientID)return {result:"unknown"};
 const recordId=extractElementText(response.resultXml,"VisitID");try{identifier(recordId);return {result:"acknowledged",recordId:recordId!};}catch{return {result:"unknown"};}
}
export class LinkedScheduleCreationWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<LinkedScheduleCreationSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentLinkedScheduleCreation(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<LinkedScheduleCreation>("linkedScheduleCreations", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    if(Object.keys(input).some(key=>!["id","patientId","caregiverId","payCodeId","serviceCodeId","date","startTime","endTime","authorityReference","rationale"].includes(key))||typeof input.rationale!=="string"||!input.rationale.trim()||input.rationale.length>2000||typeof input.authorityReference!=="string"||input.authorityReference.trim().length<8||input.authorityReference.length>500)throw new WorkflowError("schedule_authority_and_explicit_fields_required");
    const officeId=await this.office();if(!officeId)throw new WorkflowError("office_scope_required",409);
    const proposed:Facts={Exists:"true",PatientID:identifier(input.patientId),CaregiverID:identifier(input.caregiverId),PayCodeID:identifier(input.payCodeId),ServiceCodeID:identifier(input.serviceCodeId),OfficeID:officeId,ScheduleType:"Non-Skilled",VisitDate:date(input.date),ScheduleStartTime:time(input.startTime),ScheduleEndTime:time(input.endTime)};
    const before=await this.current(proposed,officeId);if(before.Exists!=="false")throw new WorkflowError("existing_schedule_requires_operator_review",409);
    proposed.ServiceCodeName=before.ServiceCodeName!;proposed.PayCodeName=before.PayCodeName!;createLinkedScheduleRequest(proposed);
    return this.repository.change<LinkedScheduleCreation>("linkedScheduleCreations", id, 0, actor, "linked_schedule_creation_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "CreateLinkedSchedule", officeId, before, proposed, authorityReference: input.authorityReference as string, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: LinkedScheduleCreation["sourceCheck"] = "unavailable";
    try { sourceCheck = sameCreatedLinkedScheduleFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<LinkedScheduleCreation>("linkedScheduleCreations", prior.id, prior.revision, actor, "linked_schedule_creation_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<LinkedScheduleCreation>("linkedScheduleCreations", prior.id, prior.revision, actor, "linked_schedule_creation_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("linked_schedule_creation_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = linkedScheduleCreationTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameCreatedLinkedScheduleFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    createLinkedScheduleRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<LinkedScheduleCreation>("linkedScheduleCreations", prior.id, prior.revision, actor, "linked_schedule_creation_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: LinkedScheduleCreationSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<LinkedScheduleCreation>("linkedScheduleCreations", prior.id, attempt.revision, actor, "linked_schedule_creation_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<LinkedScheduleCreation["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = sameCreatedLinkedScheduleFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.VisitID === prior.execution.vendorRecordId) ? "matched_returned_fields" : sameCreatedLinkedScheduleFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<LinkedScheduleCreation>("linkedScheduleCreations", prior.id, prior.revision, actor, "linked_schedule_creation_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    // The vendor readback omits persisted ScheduleType. Matching returned fields
    // is partial evidence, not permission to unlock; independent recovery must
    // attest the missing type using a vendor case and worker-termination proof.
    if (prior.execution.result === "not_submitted") await this.repository.releaseWriteTarget(linkedScheduleCreationTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
