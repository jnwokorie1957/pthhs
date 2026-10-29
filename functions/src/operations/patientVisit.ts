import type { OperationsWorkspace } from "./workspace.js";
import { identifier, WorkflowError, type ReadOperation } from "./reads.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;

export async function patientVisitRead(workspace: Workspace, value: unknown, actor: string) {
  const { visit, patient, scope } = await checkedVisitPatient(workspace, value, actor);
  return { ...visit, scope, membershipCheckedAt: patient.fetchedAt, interpretation: "visit_source_unvalidated" as const };
}

export async function visitPatientRead(workspace: Workspace, value: unknown, actor: string) {
  const { patient, scope } = await checkedVisitPatient(workspace, value, actor);
  return { ...patient, scope, membershipCheckedAt: patient.fetchedAt, interpretation: "patient_source_unvalidated" as const };
}

export async function visitContextRead(workspace: Workspace, value: unknown, actor: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_visit_context_query");
  const input = value as Record<string, unknown>, kind = input.kind;
  if ((kind !== "caregiver" && kind !== "billing") || Object.keys(input).some(key => !["kind", "visitId", "patientId", "officeId", ...(kind === "caregiver" ? ["caregiverId"] : [])].includes(key))) throw new WorkflowError("invalid_visit_context_query");
  const expectedCaregiver = kind === "caregiver" ? identifier(input.caregiverId) : null;
  const operation = kind === "caregiver" ? "GetCaregiverDemographics" : "GetVisitBillInfoV2";
  const { visit, patient, scope, checkScope } = await checkedVisitPatient(workspace, { visitId: input.visitId, patientId: input.patientId, officeId: input.officeId }, actor, [operation]);
  if (expectedCaregiver !== null && visit.records[0]?.["Caregiver/ID"] !== expectedCaregiver) throw new WorkflowError("visit_caregiver_changed_restart", 409);
  const data = await workspace.query({ operation, id: kind === "caregiver" ? expectedCaregiver! : scope.visitId }, actor);
  if (data.operation !== operation || data.source !== "hhaexchange" || data.truncated) throw new WorkflowError("visit_context_source_not_unique", 409);
  if (data.records.length === 0) throw new WorkflowError("visit_context_source_empty", 409);
  if (data.records.length !== 1) throw new WorkflowError("visit_context_source_not_unique", 409);
  const record = data.records[0]!;
  if (kind === "caregiver") {
    let offices: unknown; try { offices = JSON.parse(record.OfficeIDs || ""); } catch { /* rejected below */ }
    if (record.ID !== expectedCaregiver || !Array.isArray(offices) || offices.length > 200 || !offices.length
      || offices.some(id => typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647)
      || new Set(offices).size !== offices.length || !offices.includes(scope.officeId)) throw new WorkflowError("caregiver_office_mismatch", 403);
  } else {
    if (record.ID !== scope.visitId || record["Patient/ID"] !== scope.patientId) throw new WorkflowError("billing_visit_patient_mismatch", 403);
    if (!record.VisitDate || record.VisitDate !== visit.records[0]?.VisitDate
      || record["Caregiver/ID"] !== visit.records[0]?.["Caregiver/ID"]) throw new WorkflowError("billing_source_changed_restart", 409);
  }
  await checkScope();
  return { ...data, scope: { ...scope, ...(expectedCaregiver ? { caregiverId: expectedCaregiver } : {}) }, membershipCheckedAt: patient.fetchedAt,
    interpretation: kind === "caregiver" ? "caregiver_profile_unvalidated" as const : "billing_source_unvalidated" as const };
}

async function checkedVisitPatient(workspace: Workspace, value: unknown, actor: string, extraReads: ReadOperation[] = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_patient_visit_query");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["visitId", "patientId", "officeId"].includes(key))) throw new WorkflowError("invalid_patient_visit_query");
  const visitId = identifier(input.visitId), patientId = identifier(input.patientId), officeId = identifier(input.officeId);
  const current = await workspace.settings();
  if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  if (officeId !== current.settings.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  if (!(["GetVisitInfoV3", "GetPatientDemographics", ...extraReads] as ReadOperation[]).every(operation => current.settings.enabledReads.includes(operation))) throw new WorkflowError("read_not_owner_enabled", 423);
  const checkScope = async () => {
    const latest = await workspace.settings();
    if (!latest.dataApproved || JSON.stringify(current.settings) !== JSON.stringify(latest.settings)) throw new WorkflowError("office_policy_changed_restart", 409);
  };
  const visit = await workspace.query({ operation: "GetVisitInfoV3", id: visitId }, actor);
  if (visit.operation !== "GetVisitInfoV3" || visit.source !== "hhaexchange" || visit.truncated || visit.records.length !== 1) throw new WorkflowError("visit_source_not_unique", 409);
  if (visit.records[0]?.ID !== visitId || visit.records[0]?.["Patient/ID"] !== patientId) throw new WorkflowError("visit_patient_mismatch", 403);
  await checkScope();
  // Historical calendar membership is not authority for current source access.
  // Verify the visit's current patient against current office evidence as well.
  const patient = await workspace.query({ operation: "GetPatientDemographics", id: patientId }, actor);
  if (patient.operation !== "GetPatientDemographics" || patient.source !== "hhaexchange" || patient.truncated || patient.records.length !== 1
    || patient.records[0]?.PatientID !== patientId || patient.records[0]?.OfficeID !== officeId) throw new WorkflowError("patient_office_mismatch", 403);
  await checkScope();
  return { visit, patient, scope: { visitId, patientId, officeId }, checkScope };
}
