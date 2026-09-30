import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID, createHash } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface CollectionNoteChange extends Versioned {
  operation: "AddCollectionNote"; officeId: string;
  before: Facts; proposed: Facts; authorityReference: string; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface CollectionNoteSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_collection_note_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function date(value:unknown):string{if(typeof value!=="string"||!/^\d{4}-\d\d-\d\d$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new WorkflowError("explicit_collection_followup_date_required");return value;}
export const collectionNoteTarget=(facts:Facts)=>`collection_note_${identifier(facts.VisitID)}_${identifier(facts.ContractID)}`;
export function sameCollectionNoteFacts(left:Facts,right:Facts){const strip=(facts:Facts)=>Object.fromEntries(Object.entries(facts).filter(([key])=>key!=="NoteID"));return sameSourceFacts(strip(left),strip(right));}
const mappings = [
 ["GetCollectionARNoteReasons","ARNotesReasonID","ReasonID","Reason","Reason"],
 ["GetCollectionRepresentatives","CollectionRepID","RefCollectionRepID","CollectionRep","ColRep"],
 ["GetCollectionStatus","CollectionStatusID","CollectionStatusID","CollectionStatusValue","CollectionStatus"],
 ["GetCollectionClaimStatus","RefClaimStatusID","RefClaimStatusID","ClaimStatusName","ClaimStatusName"],
 ["GetCollectionReasonForNonPayment","RefReasonForNonPaymentID","RefReasonForNonPaymentID","NonPaymentName","NonPaymentName"],
 ["GetCollectionFollowUpRepresentatives","FollowUpRepID","RepresentativeID","Representative","CollectionFollowUpRep"]
] as const;
export function collectionNoteRequest(facts:Facts):string{
 for(const key of ["VisitID","PatientID","ContractID","OfficeID",...mappings.map(row=>row[1])])identifier(facts[key]);
 if(typeof facts.Notes!=="string"||!facts.Notes.trim()||facts.Notes!==facts.Notes.trim()||facts.Notes.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(facts.Notes))throw new WorkflowError("explicit_collection_note_required");
 return `<CollectionNoteInfo><VisitID>${facts.VisitID}</VisitID><ContractID>${facts.ContractID}</ContractID><PatientID>${facts.PatientID}</PatientID><OfficeID>${facts.OfficeID}</OfficeID><ARNotesReasonID>${facts.ARNotesReasonID}</ARNotesReasonID><CollectionRepID>${facts.CollectionRepID}</CollectionRepID><Notes>${escaped(facts.Notes)}</Notes><CollectionStatus>${facts.CollectionStatusID}</CollectionStatus><RefClaimStatusID>${facts.RefClaimStatusID}</RefClaimStatusID><RefReasonForNonPaymentID>${facts.RefReasonForNonPaymentID}</RefReasonForNonPaymentID><collectionFollowUpRepID>${facts.FollowUpRepID}</collectionFollowUpRepID><OtherChargeID xsi:nil="true"/><FollowupDate>${date(facts.FollowupDate)}T00:00:00</FollowupDate></CollectionNoteInfo>`;
}
export async function currentCollectionNote(read:(input:ReadInput)=>Promise<OperationalRead>,facts:Facts,officeId:string,noteId?:string):Promise<Facts>{
 const patient=await read({operation:"GetPatientDemographics",id:identifier(facts.PatientID)});
 if(patient.truncated||patient.records.length!==1||patient.records[0]?.PatientID!==facts.PatientID||patient.records[0]?.OfficeID!==officeId)throw new WorkflowError("collection_patient_office_mismatch",409);
 const [schedule,bill,notes,...catalogs]=await Promise.all([read({operation:"GetScheduleInfo",id:identifier(facts.VisitID)}),read({operation:"GetVisitBillInfoV2",id:identifier(facts.VisitID)}),read({operation:"GetCollectionNotes",id:identifier(facts.VisitID),patientId:identifier(facts.PatientID),contractId:identifier(facts.ContractID)}),...mappings.map(([operation])=>read({operation,status:"All",...(operation==="GetCollectionRepresentatives"?{officeId}:{})}))]);
 if([schedule!,bill!,notes!,...catalogs].some(row=>row.truncated))throw new WorkflowError("complete_collection_evidence_required",409);
 if(schedule!.records.length!==1||schedule!.records[0]?.ID!==facts.VisitID||schedule!.records[0]?.["Patient/ID"]!==facts.PatientID||bill!.records.length!==1||bill!.records[0]?.ID!==facts.VisitID||bill!.records[0]?.["Patient/ID"]!==facts.PatientID)throw new WorkflowError("collection_visit_subject_mismatch",409);
 const visit=schedule!.records[0]!,billing=bill!.records[0]!;
 const side=visit["PrimaryBillTo/Contract/ID"]===facts.ContractID?"PrimaryBillTo":visit["SecondaryBillTo/Contract/ID"]===facts.ContractID?"SecondaryBillTo":null;
 if(!side || (visit["PrimaryBillTo/Contract/ID"]===facts.ContractID && visit["SecondaryBillTo/Contract/ID"]===facts.ContractID))throw new WorkflowError("verified_visit_contract_required",409);
 // This workflow targets the visit charge, never an ancillary other charge.
 // No amount-based or truthy-string inference: unknown billing states fail closed.
 if(billing[`${side}/Contract/ID`]!==facts.ContractID || billing[`${side}/IsBilled`]!=="Yes")throw new WorkflowError("verified_visit_billing_status_required",409);
 const billed=await read({operation:"SearchBilledVisits",officeId,date:date(visit.VisitDate)});
 const billedMatches=billed.records.filter(row=>row.VisitID===facts.VisitID&&row.PatientID===facts.PatientID&&row.ContractID===facts.ContractID&&row.OtherChargeID===null);
 if(billed.truncated||billedMatches.length!==1)throw new WorkflowError("verified_billed_contract_required",409);
 const metadata:Facts={PatientID:facts.PatientID!,VisitID:facts.VisitID!,ContractID:facts.ContractID!,OfficeID:officeId,BillingEvidence:JSON.stringify(billing),ScheduleEvidence:JSON.stringify(visit)};
 mappings.forEach(([,requestKey,idKey,nameKey,outputKey],index)=>{const rows=catalogs[index]!.records,found=rows.filter(row=>row[idKey]===facts[requestKey]);if(found.length!==1||found[0]!.Active?.toLowerCase()!=="true"||!found[0]![nameKey]||rows.filter(row=>row[nameKey]===found[0]![nameKey]).length!==1)throw new WorkflowError("unique_active_collection_reference_required",409);metadata[requestKey]=facts[requestKey]!;metadata[outputKey]=found[0]![nameKey]!;});
 if(notes!.records.some(row=>row.NotesTruncated||typeof row.Notes!=="string"||!row.CreatedDate))throw new WorkflowError("complete_collection_history_required",409);
 const matches=notes!.records.filter(row=>row.Notes===facts.Notes);
 if(matches.length>1)throw new WorkflowError("collection_note_not_unique",409);
 const history=notes!.records.filter(row=>row.Notes!==facts.Notes).map(row=>JSON.stringify(row)).sort();metadata.PriorHistoryHash=createHash("sha256").update(JSON.stringify(history)).digest("hex");metadata.PriorStatusEvidence=JSON.stringify(history.slice(0,20).map(encoded=>{const row=JSON.parse(encoded) as Facts;return Object.fromEntries(["CreatedDate","Reason","ClaimStatusName","CollectionStatus","FollowupDate"].map(key=>[key,row[key]??null]));}));
 if(!matches.length)return {Exists:"false",...metadata};
 let row=matches[0]!;
 if(noteId){const exact=await read({operation:"GetCollectionNotes",id:identifier(facts.VisitID),patientId:identifier(facts.PatientID),contractId:identifier(facts.ContractID),noteId:identifier(noteId)});if(exact.truncated||exact.records.length!==1||exact.records[0]?.Notes!==facts.Notes)throw new WorkflowError("collection_note_identity_readback_required",409);row=exact.records[0]!;}
 const followup=row.FollowupDate?.replace(/T00:00:00(?:\.0+)?$/,"");
 const actual:Facts={Exists:"true",...metadata,Notes:row.Notes!,FollowupDate:followup??null};
 for(const [,,,,outputKey] of mappings)actual[outputKey]=row[outputKey]??null;
 if(noteId)actual.NoteID=noteId;
 return actual;
}
export async function submitCollectionNote(client:Pick<HhaSoapClient,"call">,facts:Facts):Promise<CollectionNoteSubmission>{
 const response=await client.call("AddCollectionNote",collectionNoteRequest(facts),1);
 if(!response.ok||!response.resultXml)return {result:"unknown"};
 if(extractElementText(response.resultXml,"OtherChargeID"))return {result:"unknown"};
 for(const field of ["VisitID","PatientID","ContractID"])if(extractElementText(response.resultXml,field)!==facts[field])return {result:"unknown"};
 const recordId=extractElementText(response.resultXml,"CollectionNotesDetailID");try{identifier(recordId);return {result:"acknowledged",recordId:recordId!};}catch{return {result:"unknown"};}
}
export class CollectionNoteWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<CollectionNoteSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string, noteId?: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentCollectionNote(this.read, facts, officeId, noteId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<CollectionNoteChange>("collectionNoteChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    const fields=["patientId","visitId","contractId","reasonId","representativeId","collectionStatusId","claimStatusId","nonPaymentReasonId","followUpRepresentativeId","followupDate","note","authorityReference","rationale"];
    if(Object.keys(input).some(key=>key!=="id"&&!fields.includes(key))||typeof input.rationale!=="string"||!input.rationale.trim()||input.rationale.length>2000||typeof input.authorityReference!=="string"||input.authorityReference.trim().length<8||input.authorityReference.length>500)throw new WorkflowError("collection_authority_and_explicit_fields_required");
    const officeId=await this.office();if(!officeId)throw new WorkflowError("office_scope_required",409);
    const proposed:Facts={Exists:"true",PatientID:input.patientId as string,VisitID:input.visitId as string,ContractID:input.contractId as string,OfficeID:officeId,ARNotesReasonID:input.reasonId as string,CollectionRepID:input.representativeId as string,CollectionStatusID:input.collectionStatusId as string,RefClaimStatusID:input.claimStatusId as string,RefReasonForNonPaymentID:input.nonPaymentReasonId as string,FollowUpRepID:input.followUpRepresentativeId as string,FollowupDate:input.followupDate as string,Notes:input.note as string};
    collectionNoteRequest(proposed);const before=await this.current(proposed,officeId);if(before.Exists!=="false")throw new WorkflowError("matching_collection_note_already_exists",409);
    Object.assign(proposed,{...before,Exists:"true",Notes:proposed.Notes,FollowupDate:proposed.FollowupDate});
    return this.repository.change<CollectionNoteChange>("collectionNoteChanges", id, 0, actor, "collection_note_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "AddCollectionNote", officeId, before, proposed, authorityReference: input.authorityReference as string, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: CollectionNoteChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameCollectionNoteFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<CollectionNoteChange>("collectionNoteChanges", prior.id, prior.revision, actor, "collection_note_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<CollectionNoteChange>("collectionNoteChanges", prior.id, prior.revision, actor, "collection_note_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("collection_note_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = collectionNoteTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameCollectionNoteFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    collectionNoteRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<CollectionNoteChange>("collectionNoteChanges", prior.id, prior.revision, actor, "collection_note_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: CollectionNoteSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<CollectionNoteChange>("collectionNoteChanges", prior.id, attempt.revision, actor, "collection_note_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<CollectionNoteChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId, prior.execution.vendorRecordId); reconciliation = sameCollectionNoteFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.NoteID === prior.execution.vendorRecordId) ? "matches_proposal" : sameCollectionNoteFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<CollectionNoteChange>("collectionNoteChanges", prior.id, prior.revision, actor, "collection_note_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(collectionNoteTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
