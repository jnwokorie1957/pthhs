import type { OperationsWorkspace } from "./workspace.js";
import { checkedVisitPatient } from "./patientVisit.js";
import { identifier, readRequest, WorkflowError } from "./reads.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
export async function visitCallRead(workspace: Workspace, value: unknown, actor: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_visit_call_query");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["visitId", "patientId", "caregiverId", "officeId", "date"].includes(key))) throw new WorkflowError("invalid_visit_call_query");
  const patientId = identifier(input.patientId), caregiverId = identifier(input.caregiverId), officeId = identifier(input.officeId);
  const date = input.date as string;
  const request = { operation: "GetCallDashBoardData" as const, patientId, caregiverId, officeId, date, lastId: "0" };
  readRequest(request); // Validate the exact office/day filters before dispatch.
  const { visit, patient, scope, checkScope } = await checkedVisitPatient(workspace, { visitId: input.visitId, patientId, officeId }, actor, [request.operation]);
  if (visit.records[0]?.["Caregiver/ID"] !== caregiverId) throw new WorkflowError("visit_caregiver_changed_restart", 409);
  const inDay = (text: unknown) => typeof text === "string" && new RegExp(`^${date}(?:$|[ T](?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|[+-]\\d\\d:\\d\\d)?)$`).test(text);
  if (!inDay(visit.records[0]?.VisitDate)) throw new WorkflowError("visit_call_date_mismatch", 409);
  const data = await workspace.query(request, actor);
  if (data.operation !== request.operation || data.source !== "hhaexchange" || data.records.length > 200) throw new WorkflowError("call_source_unverified", 409);
  const ids = new Set<string>();
  for (const row of data.records) {
    const id = identifier(row.CallDashboardID);
    if (ids.has(id)) throw new WorkflowError("call_source_unverified", 409);
    ids.add(id);
    if (row["Patient/ID"] !== patientId || row["Caregiver/ID"] !== caregiverId) throw new WorkflowError("call_subject_mismatch", 403);
    if (row.CallTime && !inDay(row.CallTime)) throw new WorkflowError("call_source_date_unverified", 409);
  }
  await checkScope();
  return { ...data, scope: { ...scope, caregiverId, date }, membershipCheckedAt: patient.fetchedAt,
    state: data.truncated ? "partial" as const : data.records.length ? "ready" as const : "empty" as const,
    relationship: "same_patient_caregiver_day_only" as const, visitLink: "not_supplied_by_source" as const,
    completeness: "bounded_response_not_complete_history" as const, interpretation: "call_events_unvalidated" as const };
}
