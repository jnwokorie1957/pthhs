import type { OperationsWorkspace } from "./workspace.js";
import { identifier, WorkflowError, type OperationalRead } from "./reads.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;

// Public administrator path. Internal workflows retain their existing raw
// query interface; this boundary never grants staff/patient role access.
export async function patientCarePlanRead(workspace: Workspace, value: unknown, actor: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_care_plan_query");
  const input = value as Record<string, unknown>, operation = input.operation;
  if (operation !== "SearchPatientPOC" && operation !== "GetPatientPOCInfo") throw new WorkflowError("invalid_care_plan_query");
  const detail = operation === "GetPatientPOCInfo";
  if (Object.keys(input).some(key => !(detail ? ["operation", "patientId", "officeId", "id"] : ["operation", "patientId", "officeId"]).includes(key))) throw new WorkflowError("invalid_care_plan_query");
  const patientId = identifier(input.patientId), officeId = identifier(input.officeId), id = detail ? identifier(input.id) : null;
  const current = await workspace.settings();
  if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  if (officeId !== current.settings.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  if (![operation, "GetPatientDemographics"].every(op => current.settings.enabledReads.includes(op))) throw new WorkflowError("read_not_owner_enabled", 423);
  const checkScope = async () => {
    const latest = await workspace.settings();
    if (!latest.dataApproved || JSON.stringify(current.settings) !== JSON.stringify(latest.settings)) throw new WorkflowError("office_policy_changed_restart", 409);
  };
  const checkPatient = async () => {
    const source = await workspace.query({ operation: "GetPatientDemographics", id: patientId }, actor);
    if (source.operation !== "GetPatientDemographics" || source.source !== "hhaexchange" || source.truncated || source.records.length !== 1
      || source.records[0]?.PatientID !== patientId || source.records[0]?.OfficeID !== officeId) throw new WorkflowError("patient_office_mismatch", 403);
  };
  await checkPatient(); await checkScope();
  const data = await workspace.query(detail ? { operation, id: id! } : { operation, patientId }, actor);
  if (data.operation !== operation || data.source !== "hhaexchange") throw new WorkflowError("care_plan_source_unavailable", 409);
  if (detail && (data.records.length !== 1 || data.records[0]?.ID !== id || data.records[0]?.["Patient/ID"] !== patientId)) throw new WorkflowError("care_plan_identity_unverified", 409);
  await checkScope();
  // A second independent read detects a patient moving office during retrieval.
  // It is not an atomic snapshot or proof of clinical validity/effective dates.
  await checkPatient(); await checkScope();
  const membershipCheckedAt = new Date().toISOString();
  let records = data.records;
  if (detail) {
    const { Tasks, TasksTruncated, ...header } = data.records[0]!;
    let tasks: OperationalRead["records"] = [];
    if (Tasks !== null && Tasks !== undefined) {
      try {
        const decoded: unknown = JSON.parse(Tasks);
        if (!Array.isArray(decoded) || decoded.length > 200 || decoded.some(row => !row || typeof row !== "object" || Array.isArray(row)
          || Object.values(row).some(value => value !== null && typeof value !== "string"))) throw new Error();
        tasks = decoded;
      } catch { throw new WorkflowError("care_plan_tasks_shape_unverified", 502); }
    }
    records = [{ ...header, SourceElement: "POCInfo (plan header)", TaskListState: Tasks == null ? "Not supplied / unknown" : TasksTruncated === "true" ? "Partial: first 200 task definitions" : "Returned " + tasks.length + " task definitions; coverage not inferred",
      Interpretation: "Plan/task definitions only. Weekday flags and weekly limits are raw HHA values; no completed duties, clinical approval, visit or authorization link is inferred." },
    ...tasks.map(task => ({ ...task, SourceElement: "POCInfo/Tasks/Task (definition)", POCID: id }))];
  }
  return { ...data, records, scope: { patientId, officeId }, membershipCheckedAt, interpretation: "care_plan_definitions_unvalidated" as const };
}
