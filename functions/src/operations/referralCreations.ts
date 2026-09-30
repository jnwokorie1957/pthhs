import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID, createHash } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface ReferralCreation extends Versioned {
  operation: "CreateReferralSource"; officeId: string;
  before: Facts; proposed: Facts; authorityReference: string; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
export interface ReferralCreationSubmission { result: "acknowledged" | "unknown" | "not_submitted"; recordId?: string; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_referral_creation_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
function sourceName(value:unknown):string{if(typeof value!=="string"||!value.trim()||value!==value.trim()||value.length>160||/[\x00-\x1f]/.test(value))throw new WorkflowError("explicit_referral_source_name_required");return value;}
export const referralCreationTarget=(facts:Facts)=>`referral_create_${createHash("sha256").update(sourceName(facts.Name).toLowerCase()).digest("hex")}`;
export function sameCreatedReferralFacts(left:Facts,right:Facts){const canonical=(facts:Facts)=>Object.fromEntries(Object.entries(facts).filter(([key])=>key!=="ReferralSourceID"));return sameSourceFacts(canonical(left),canonical(right));}
export function createReferralRequest(facts:Facts):string{
 const name=sourceName(facts.Name),type=identifier(facts.ReferralSourceTypeID),office=identifier(facts.OfficeID);
 if(facts.Status!=="Inactive"||typeof facts.OfficeName!=="string"||!facts.OfficeName)throw new WorkflowError("inactive_referral_office_required");
 return `<CreateReferralSourceInfo><ReferralSourceID>0</ReferralSourceID><Name>${escaped(name)}</Name><ReferralSourceTypeId>${type}</ReferralSourceTypeId><ParentReferralSourceId xsi:nil="true"/><AccountManagerId xsi:nil="true"/><MarketerId xsi:nil="true"/><StatusID>0</StatusID><Offices><Office><ID>${office}</ID><Name>${escaped(facts.OfficeName)}</Name></Office></Offices></CreateReferralSourceInfo>`;
}
export async function currentReferralCreation(read:(input:ReadInput)=>Promise<OperationalRead>,facts:Facts,officeId:string):Promise<Facts>{
 const [offices,types,sources]=await Promise.all([read({operation:"GetOfficesV2"}),read({operation:"GetReferralSourceType",status:"Active"}),read({operation:"GetReferralSource",officeId,status:"All"})]);
 if([offices,types,sources].some(row=>row.truncated))throw new WorkflowError("complete_referral_source_required",409);
 const office=offices.records.filter(row=>row.OfficeID===officeId),type=types.records.filter(row=>row.ReferralSourceTypeID===facts.ReferralSourceTypeID);
 if(office.length!==1||office[0]!.Status!=="Active"||!office[0]!.OfficeName||type.length!==1||type[0]!.Status!=="Active"||!type[0]!.ReferralSourceTypeName||/^other$/i.test(type[0]!.ReferralSourceTypeName!))throw new WorkflowError("active_referral_office_type_required",409);
 const base={OfficeID:officeId,OfficeName:office[0]!.OfficeName!,ReferralSourceTypeID:facts.ReferralSourceTypeID!,ReferralSourceType:type[0]!.ReferralSourceTypeName!};
 const matching=sources.records.filter(row=>row.ReferralSourceName?.toLowerCase()===sourceName(facts.Name).toLowerCase());
 if(!matching.length)return {Exists:"false",...base};
 if(matching.length!==1)throw new WorkflowError("referral_source_not_unique",409);
 const row=matching[0]!;identifier(row.ReferralSourceID);
 let returnedOffices:unknown;try{returnedOffices=JSON.parse(row.OfficeIDs||"");}catch{}
 if(!Array.isArray(returnedOffices)||returnedOffices.length!==1||returnedOffices[0]!==officeId)throw new WorkflowError("referral_office_readback_required",409);
 return {Exists:"true",...base,ReferralSourceID:row.ReferralSourceID!,Name:row.ReferralSourceName??null,ReferralSourceType:row.ReferralSourceType??null,Status:row.Status??null};
}
export async function submitReferralCreation(client:Pick<HhaSoapClient,"call">,facts:Facts):Promise<ReferralCreationSubmission>{
 const response=await client.call("CreateReferralSource",createReferralRequest(facts),1);
 if(!response.ok||!response.resultXml)return {result:"unknown"};
 const recordId=extractElementText(response.resultXml,"ReferralSourceId");try{identifier(recordId);return {result:"acknowledged",recordId:recordId!};}catch{return {result:"unknown"};}
}
export class ReferralCreationWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<ReferralCreationSubmission> }, private clock = () => performance.now()) {}
  private async current(facts: Facts, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentReferralCreation(this.read, facts, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<ReferralCreation>("referralCreations", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id);
    if(Object.keys(input).some(key=>!["id","name","typeId","authorityReference","rationale"].includes(key))||typeof input.rationale!=="string"||!input.rationale.trim()||input.rationale.length>2000||typeof input.authorityReference!=="string"||input.authorityReference.trim().length<8||input.authorityReference.length>500)throw new WorkflowError("referral_authority_and_explicit_fields_required");
    const officeId=await this.office();if(!officeId)throw new WorkflowError("office_scope_required",409);
    const proposed:Facts={Exists:"true",Name:sourceName(input.name),ReferralSourceTypeID:identifier(input.typeId),OfficeID:officeId,Status:"Inactive"};
    const before=await this.current(proposed,officeId);if(before.Exists!=="false")throw new WorkflowError("existing_referral_source_requires_separate_review",409);
    proposed.OfficeName=before.OfficeName!;proposed.ReferralSourceType=before.ReferralSourceType!;createReferralRequest(proposed);
    return this.repository.change<ReferralCreation>("referralCreations", id, 0, actor, "referral_creation_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "CreateReferralSource", officeId, before, proposed, authorityReference: input.authorityReference as string, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: ReferralCreation["sourceCheck"] = "unavailable";
    try { sourceCheck = sameCreatedReferralFacts(await this.current(prior.proposed, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<ReferralCreation>("referralCreations", prior.id, prior.revision, actor, "referral_creation_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<ReferralCreation>("referralCreations", prior.id, prior.revision, actor, "referral_creation_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("referral_creation_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = referralCreationTarget(prior.proposed);
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameCreatedReferralFacts(await this.current(prior.proposed, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    createReferralRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<ReferralCreation>("referralCreations", prior.id, prior.revision, actor, "referral_creation_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let submission: ReferralCreationSubmission = { result: "unknown" };
    try { submission = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) submission = { result: "not_submitted" }; }
    const recorded = await this.repository.change<ReferralCreation>("referralCreations", prior.id, attempt.revision, actor, "referral_creation_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: submission.result, ...(submission.recordId ? { vendorRecordId: submission.recordId } : {}) } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<ReferralCreation["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.proposed, prior.officeId); reconciliation = sameCreatedReferralFacts(current, prior.proposed) && (!prior.execution?.vendorRecordId || current.ReferralSourceID === prior.execution.vendorRecordId) ? "matches_proposal" : sameCreatedReferralFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<ReferralCreation>("referralCreations", prior.id, prior.revision, actor, "referral_creation_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(referralCreationTarget(prior.proposed), prior.id);
    return reconciled;
  }
}
