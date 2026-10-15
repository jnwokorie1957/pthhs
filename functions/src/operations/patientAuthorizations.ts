import type { OperationsWorkspace } from "./workspace.js";
import { identifier, WorkflowError } from "./reads.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;

export async function patientAuthorizationRead(workspace: Workspace, value: unknown, actor: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_authorization_query");
  const input = value as Record<string, unknown>;
  const operation = input.operation;
  if (operation !== "SearchPatientAuthorizations" && operation !== "GetPatientAuthorizationInfo") throw new WorkflowError("invalid_authorization_query");
  const detail = operation === "GetPatientAuthorizationInfo";
  const allowed = detail ? ["operation", "patientId", "officeId", "id", "contractId"] : ["operation", "patientId", "officeId"];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new WorkflowError("invalid_authorization_query");
  const patientId = identifier(input.patientId), officeId = identifier(input.officeId);
  const id = detail ? identifier(input.id) : null;
  const contractId = input.contractId === undefined ? null : identifier(input.contractId);
  const current = await workspace.settings();
  if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  if (officeId !== current.settings.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  if (!current.settings.enabledReads.includes(operation) || !current.settings.enabledReads.includes("GetPatientDemographics")) throw new WorkflowError("read_not_owner_enabled", 423);
  const checkScope = async () => {
    const latest = await workspace.settings();
    if (!latest.dataApproved || JSON.stringify(current.settings) !== JSON.stringify(latest.settings)) throw new WorkflowError("office_policy_changed_restart", 409);
  };
  const patient = await workspace.query({ operation: "GetPatientDemographics", id: patientId }, actor);
  if (patient.operation !== "GetPatientDemographics" || patient.source !== "hhaexchange" || patient.truncated || patient.records.length !== 1
    || patient.records[0]?.PatientID !== patientId || patient.records[0]?.OfficeID !== officeId) throw new WorkflowError("patient_office_mismatch", 403);
  await checkScope();
  const data = await workspace.query(detail ? { operation, patientId, id: id! } : { operation, patientId }, actor);
  if (data.operation !== operation || data.source !== "hhaexchange") throw new WorkflowError("authorization_source_unavailable", 409);
  if (detail) {
    if (data.truncated || data.records.length !== 1) throw new WorkflowError("authorization_detail_not_unique", 409);
    const row = data.records[0]!;
    if (!row.AuthorizationID || !row["Patient/ID"] || !row["Contract/ID"]) throw new WorkflowError("authorization_identity_unavailable", 409);
    if (row.AuthorizationID !== id || row["Patient/ID"] !== patientId) throw new WorkflowError("authorization_identity_mismatch", 403);
    if (contractId !== null && row["Contract/ID"] !== contractId) throw new WorkflowError("authorization_contract_changed_restart", 409);
  }
  await checkScope();
  return { ...data, scope: { patientId, officeId }, interpretation: "authorization_limits_unvalidated" as const };
}
