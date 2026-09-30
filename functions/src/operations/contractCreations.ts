import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface ContractCreation extends Versioned {
  operation: "AddPatientContract"; officeId: string;
  before: Facts; proposed: Facts; authorityReference: string; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface ContractCreationSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_contract_creation_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function date(value: unknown): string { if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new WorkflowError("source_contract_date_mapping_required", 409); return value; }
function escaped(value: string) { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
export const contractCreationTarget = (facts: Facts) => `patient_contracts_${identifier(facts.PatientID)}`;
export function sameCreatedContractFacts(left: Facts, right: Facts) {
 const withoutId = (facts: Facts) => Object.fromEntries(Object.entries(facts).filter(([key])=>key!=="PlacementID"));
 return sameSourceFacts(withoutId(left),withoutId(right));
}
export function createContractRequest(facts: Facts): string {
 const patient=identifier(facts.PatientID),contract=identifier(facts.ContractID),service=identifier(facts.ServiceCodeID),start=date(facts.StartDate);
 if(facts.IsPrimaryContract!=="N" || typeof facts.AltPatientID!=="string" || !facts.AltPatientID.trim() || facts.AltPatientID.length>100 || /[\x00-\x1f]/.test(facts.AltPatientID)) throw new WorkflowError("explicit_secondary_contract_identity_required");
 return `<PatientContractInfo><PatientID>${patient}</PatientID><ContractID>${contract}</ContractID><StartDate>${start}T00:00:00</StartDate><AltPateintID>${escaped(facts.AltPatientID)}</AltPateintID><ServiceCodeID>${service}</ServiceCodeID><IsPrimaryContract>false</IsPrimaryContract></PatientContractInfo>`;
}
export async function currentContractCreation(read:(input:ReadInput)=>Promise<OperationalRead>,facts:Facts,officeId:string):Promise<Facts>{
 const patient=await read({operation:"GetPatientDemographics",id:identifier(facts.PatientID)});
 if(patient.truncated||patient.records.length!==1||patient.records[0]?.PatientID!==facts.PatientID||patient.records[0]?.OfficeID!==officeId)throw new WorkflowError("contract_patient_office_mismatch",409);
 const catalogs=await Promise.all([read({operation:"GetContracts",officeId}),read({operation:"GetBillingServiceCodes",id:identifier(facts.ContractID)}),read({operation:"GetPatientContracts",patientId:identifier(facts.PatientID),date:date(facts.StartDate)})]);
 if(catalogs.some(row=>row.truncated))throw new WorkflowError("complete_contract_source_required",409);
 const [contracts,codes,placements]=catalogs;
 const contract=contracts!.records.filter(row=>row.ContractID===facts.ContractID),code=codes!.records.filter(row=>row.ServiceCodeID===facts.ServiceCodeID&&row.ContractID===facts.ContractID);
 if(contract.length!==1||contract[0]!.Active!=="Y"||code.length!==1)throw new WorkflowError("active_contract_service_mapping_required",409);
 const matching=placements!.records.filter(row=>row["Contract/ID"]===facts.ContractID);
 if(!matching.length)return {Exists:"false",ContractName:contract[0]!.ContractName??null,ServiceCodeName:code[0]!.ServiceCodeName??null};
 if(matching.length!==1)throw new WorkflowError("contract_placement_not_unique",409);
 const row=matching[0]!;identifier(row.PlacementID);
 return {Exists:"true",PlacementID:row.PlacementID!,PatientID:facts.PatientID!,ContractID:row["Contract/ID"]??null,StartDate:date(row.ServiceStartDate),AltPatientID:row.AltPatientID??null,ServiceCodeID:row["ServiceCode/ID"]??null,IsPrimaryContract:row.IsPrimaryContract??null,DischargeDate:row.DischargeDate??null,ContractName:contract[0]!.ContractName??null,ServiceCodeName:code[0]!.ServiceCodeName??null};
}
export async function submitContractCreation(client:Pick<HhaSoapClient,"call">,facts:Facts):Promise<ContractCreationSubmission>{
 const response=await client.call("AddPatientContract",createContractRequest(facts),1);
 if(!response.ok||!response.resultXml||extractElementText(response.resultXml,"PatientID")!==facts.PatientID)return {result:"unknown"};
 const recordId=extractElementText(response.resultXml,"PlacementID");try{identifier(recordId);return {result:"acknowledged",recordId:recordId!};}catch{return {result:"unknown"};}
}
export class ContractCreationWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<ContractCreationSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentContractCreation(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<ContractCreation>("contractCreations", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    if (Object.keys(input).some(key=>!["id","patientId","contractId","serviceCodeId","startDate","altPatientId","authorityReference","rationale"].includes(key))||typeof input.rationale!=="string"||!input.rationale.trim()||input.rationale.length>2000||typeof input.authorityReference!=="string"||input.authorityReference.trim().length<8||input.authorityReference.length>500)throw new WorkflowError("contract_authority_and_explicit_fields_required");
    const officeId=await this.office();if(!officeId)throw new WorkflowError("office_scope_required",409);
    const proposed:Facts={Exists:"true",PatientID:input.patientId as string,ContractID:input.contractId as string,ServiceCodeID:input.serviceCodeId as string,StartDate:input.startDate as string,AltPatientID:input.altPatientId as string,IsPrimaryContract:"N",DischargeDate:null};
    createContractRequest(proposed);const before=await this.current(proposed,officeId);
    if(before.Exists!=="false")throw new WorkflowError("existing_contract_requires_separate_review",409);
    proposed.ContractName=before.ContractName!;proposed.ServiceCodeName=before.ServiceCodeName!;
    return this.repository.change<ContractCreation>("contractCreations", id, 0, actor, "contract_creation_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "AddPatientContract", officeId, before, proposed, authorityReference: input.authorityReference as string, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: ContractCreation["sourceCheck"] = "unavailable";
    try { sourceCheck = sameCreatedContractFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<ContractCreation>("contractCreations", prior.id, prior.revision, actor, "contract_creation_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<ContractCreation>("contractCreations", prior.id, prior.revision, actor, "contract_creation_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("contract_creation_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = contractCreationTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameCreatedContractFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    createContractRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<ContractCreation>("contractCreations", prior.id, prior.revision, actor, "contract_creation_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: ContractCreationSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<ContractCreation>("contractCreations", prior.id, attempt.revision, actor, "contract_creation_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<ContractCreation["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = sameCreatedContractFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.PlacementID === prior.execution.vendorRecordId) ? "matches_proposal" : sameCreatedContractFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<ContractCreation>("contractCreations", prior.id, prior.revision, actor, "contract_creation_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(contractCreationTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
