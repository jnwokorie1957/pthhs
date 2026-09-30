import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { randomUUID } from "node:crypto";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";
import { sameSourceFacts } from "./writes.js";
import type { Versioned, WorkspaceRepository, WriteIntent } from "./workspace.js";
type Facts = Record<string, string | null>;
export interface PatientContractChange extends Versioned {
  operation: "UpdatePatientContract"; patientId: string; date: string; recordId: string; officeId: string;
  before: Facts; proposed: Facts; rationale: string; requestedBy: string; reviewedBy: string | null;
  state: "pending_review" | "approved" | "rejected";
  sourceCheck: "not_rechecked" | "unchanged" | "changed" | "unavailable"; checkedAt: string | null;
  execution?: WriteIntent["execution"]; recovery?: WriteIntent["recovery"];
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_patient_contract_request"); return value as Record<string, unknown>; }
function docId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new WorkflowError("invalid_proposal_id"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkflowError("invalid_revision"); return Number(value); }
function escaped(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function sourceDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new WorkflowError("invalid_contract_as_of_date");
  return value;
}
export function patientContractRequest(facts: Facts): string {
  identifier(facts.PatientID); identifier(facts.PlacementID);
  if (typeof facts.AltPatientID !== "string" || !facts.AltPatientID.trim() || facts.AltPatientID.length > 100 || /[\x00-\x1f]/.test(facts.AltPatientID) || !["Y", "N"].includes(facts.IsPrimaryContract || "")) throw new WorkflowError("complete_contract_identity_required", 409);
  // v3.30 pp49-50: false update flags preserve the corresponding fields.
  // Primary status is explicitly preserved; no date/service/discharge edits.
  return `<PatientContractInfo><PatientID>${facts.PatientID}</PatientID><PlacementID>${facts.PlacementID}</PlacementID><UpdateAltPateintID>true</UpdateAltPateintID><AltPateintID>${escaped(facts.AltPatientID)}</AltPateintID><UpdateStartDate>false</UpdateStartDate><StartDate xsi:nil="true"/><SourceOfAdmissionID xsi:nil="true"/><UpdateServiceCode>false</UpdateServiceCode><ServiceCodeID xsi:nil="true"/><UpdateDischargeDate>false</UpdateDischargeDate><DischargeDate xsi:nil="true"/><DischargeToID xsi:nil="true"/><DischargeReasonID xsi:nil="true"/><IsPrimaryContract>${facts.IsPrimaryContract === "Y"}</IsPrimaryContract></PatientContractInfo>`;
}
export async function currentPatientContract(read: (input: ReadInput) => Promise<OperationalRead>, patientId: string, date: string, recordId: string, officeId: string): Promise<Facts> {
  const results = await Promise.allSettled([read({ operation: "GetPatientDemographics", id: patientId }), read({ operation: "GetPatientContracts", patientId, date: sourceDate(date) })]);
  const failed = results.find(row => row.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
  const [patient, source] = results.map(row => (row as PromiseFulfilledResult<OperationalRead>).value);
  if (patient!.truncated || patient!.records.length !== 1 || patient!.records[0]?.PatientID !== patientId || patient!.records[0]?.OfficeID !== officeId) throw new WorkflowError("contract_patient_office_mismatch", 409);
  const matches = source!.records.filter(row => row.PlacementID === recordId);
  if (source!.truncated || matches.length !== 1) throw new WorkflowError("patient_contract_not_uniquely_returned", 409);
  const row = matches[0]!;
  if (typeof row.AltPatientID !== "string" || !["Y", "N"].includes(row.IsPrimaryContract || "")) throw new WorkflowError("complete_contract_source_required", 409);
  // Include preserved fields in the fingerprint to detect concurrent changes.
  return { PatientID: patientId, PlacementID: recordId, AltPatientID: row.AltPatientID, IsPrimaryContract: row.IsPrimaryContract!, ContractID: row["Contract/ID"] ?? null, ServiceStartDate: row.ServiceStartDate ?? null, ServiceCodeID: row["ServiceCode/ID"] ?? null, DischargeDate: row.DischargeDate ?? null };
}
export async function submitPatientContract(client: Pick<HhaSoapClient, "call">, facts: Facts): Promise<"acknowledged" | "unknown" | "not_submitted"> {
  const response = await client.call("UpdatePatientContract", patientContractRequest(facts), 1);
  return response.ok && response.resultXml && extractElementText(response.resultXml, "PatientID") === facts.PatientID && extractElementText(response.resultXml, "PlacementID") === facts.PlacementID ? "acknowledged" : "unknown";
}
export class PatientContractWorkflow {
  constructor(private repository: WorkspaceRepository, private read: (input: ReadInput) => Promise<OperationalRead>, private office: () => Promise<string | null>, private write?: { approved: boolean; submit: (facts: Facts) => Promise<"acknowledged" | "unknown" | "not_submitted"> }, private clock = () => performance.now()) {}
  private async current(patientId: string, date: string, recordId: string, officeId: string) {
    if (!officeId || await this.office() !== officeId) throw new WorkflowError("office_scope_mismatch", 403);
    return currentPatientContract(this.read, patientId, date, recordId, officeId);
  }
  private async prior(value: unknown) {
    const input = object(value);
    if (Object.keys(input).some(key => !["id", "revision", "decision"].includes(key))) throw new WorkflowError("unsupported_review_field");
    const prior = await this.repository.get<PatientContractChange>("patientContractChanges", docId(input.id));
    if (!prior || prior.revision !== revision(input.revision)) throw new WorkflowError("revision_conflict", 409);
    return { input, prior };
  }
  async prepare(value: unknown, actor: string) {
    const input = object(value), id = docId(input.id), patientId = identifier(input.patientId), date = sourceDate(input.date), recordId = identifier(input.recordId);
    if (Object.keys(input).some(key => !["id", "patientId", "date", "recordId", "altPatientId", "rationale"].includes(key)) || typeof input.rationale !== "string" || !input.rationale.trim() || input.rationale.length > 2000) throw new WorkflowError("invalid_patient_contract_proposal");
    const officeId = await this.office(); if (!officeId) throw new WorkflowError("office_scope_required", 409);
    const before = await this.current(patientId, date, recordId, officeId);
    const proposed = { ...before, AltPatientID: input.altPatientId as string };
    patientContractRequest(proposed); if (sameSourceFacts(before, proposed)) throw new WorkflowError("proposal_has_no_change");
    return this.repository.change<PatientContractChange>("patientContractChanges", id, 0, actor, "patient_contract_prepared", () => ({ id, revision: 1, updatedAt: new Date().toISOString(), operation: "UpdatePatientContract", patientId, date, recordId, officeId, before, proposed, rationale: input.rationale as string, requestedBy: actor, reviewedBy: null, state: "pending_review", sourceCheck: "not_rechecked", checkedAt: null }));
  }
  async recheck(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (prior.execution) throw new WorkflowError("use_post_write_reconciliation", 409);
    let sourceCheck: PatientContractChange["sourceCheck"] = "unavailable";
    try { sourceCheck = sameSourceFacts(await this.current(prior.patientId, prior.date, prior.recordId, prior.officeId), prior.before) ? "unchanged" : "changed"; } catch { /* Explicit unavailable; no stale success. */ }
    return this.repository.change<PatientContractChange>("patientContractChanges", prior.id, prior.revision, actor, "patient_contract_rechecked", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), sourceCheck, checkedAt: new Date().toISOString() }));
  }
  async review(value: unknown, actor: string) {
    const { input, prior } = await this.prior(value);
    if (prior.state !== "pending_review" || !["approved", "rejected"].includes(String(input.decision))) throw new WorkflowError("invalid_review", 409);
    if (actor === prior.requestedBy) throw new WorkflowError("independent_reviewer_required", 403);
    if (input.decision === "approved" && prior.sourceCheck !== "unchanged") throw new WorkflowError("unchanged_source_recheck_required", 409);
    return this.repository.change<PatientContractChange>("patientContractChanges", prior.id, prior.revision, actor, "patient_contract_reviewed", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), reviewedBy: actor, state: input.decision as "approved" | "rejected" }));
  }
  async execute(value: unknown, actor: string) {
    const started = this.clock(), { prior } = await this.prior(value);
    if (!this.write?.approved) throw new WorkflowError("patient_contract_write_release_not_approved", 423);
    if (prior.state !== "approved" || actor !== prior.reviewedBy || actor === prior.requestedBy) throw new WorkflowError("independent_approving_reviewer_required", 403);
    if (prior.recovery) throw new WorkflowError("proposal_in_recovery_or_resolved", 409);
    if (prior.execution) throw new WorkflowError("write_already_attempted_reconcile_only", 409);
    const target = `patient_contracts_${prior.patientId}`;
    await this.repository.reserveWriteTarget(target, prior.id); let attempted = false;
    try {
    if (!sameSourceFacts(await this.current(prior.patientId, prior.date, prior.recordId, prior.officeId), prior.before)) throw new WorkflowError("source_changed_prepare_new_proposal", 409);
    patientContractRequest(prior.proposed); await this.repository.reserveRead();
    if (this.clock() - started >= 25_000) throw new WorkflowError("write_not_started_time_budget", 503);
    const attempt = await this.repository.change<PatientContractChange>("patientContractChanges", prior.id, prior.revision, actor, "patient_contract_write_started", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { attemptId: randomUUID(), actor, startedAt: new Date().toISOString(), result: "submitting", reconciliation: "not_checked", checkedAt: null } }));
    attempted = true;
    let result: "acknowledged" | "unknown" | "not_submitted" = "unknown";
    try { result = await this.write.submit(prior.proposed); } catch (error) { if (error instanceof HhaNotSubmittedError) result = "not_submitted"; }
    const recorded = await this.repository.change<PatientContractChange>("patientContractChanges", prior.id, attempt.revision, actor, "patient_contract_write_result", row => ({ ...row!, revision: attempt.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result } }));
    if (recorded.execution?.result === "not_submitted") { await this.repository.releaseWriteTarget(target, prior.id); return recorded; }
    return this.clock() - started >= 25_000 ? recorded : this.reconcile({ id: prior.id, revision: recorded.revision }, actor);
    } finally { if (!attempted) await this.repository.releaseWriteTarget(target, prior.id); }
  }

  async reconcile(value: unknown, actor: string) {
    const { prior } = await this.prior(value); if (!prior.execution) throw new WorkflowError("attempted_proposal_required", 409);
    if (prior.execution.result === "submitting" && Date.now() - Date.parse(prior.execution.startedAt) < 90_000) throw new WorkflowError("write_attempt_in_progress", 409);
    let reconciliation: NonNullable<PatientContractChange["execution"]>["reconciliation"] = "unavailable";
    try { const current = await this.current(prior.patientId, prior.date, prior.recordId, prior.officeId); reconciliation = sameSourceFacts(current, prior.proposed) ? "matches_proposal" : sameSourceFacts(current, prior.before) ? "source_unchanged" : "different"; } catch { /* Keep unavailable distinct from success. */ }
    const reconciled = await this.repository.change<PatientContractChange>("patientContractChanges", prior.id, prior.revision, actor, "patient_contract_reconciled", row => ({ ...row!, revision: prior.revision + 1, updatedAt: new Date().toISOString(), execution: { ...row!.execution!, result: row!.execution!.result === "submitting" ? "unknown" : row!.execution!.result, reconciliation, checkedAt: new Date().toISOString() } }));
    if (prior.execution.result === "not_submitted" || (prior.execution.result === "acknowledged" && reconciliation === "matches_proposal")) await this.repository.releaseWriteTarget(`patient_contracts_${prior.patientId}`, prior.id);
    return reconciled;
  }
}
