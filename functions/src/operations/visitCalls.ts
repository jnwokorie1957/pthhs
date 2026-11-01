import type { OperationsWorkspace } from "./workspace.js";
import { checkedVisitPatient } from "./patientVisit.js";
import { identifier, readRequest, WorkflowError } from "./reads.js";
import { warn } from "firebase-functions/logger";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
type IdentityState = "match" | "unavailable" | "invalid" | "noncanonical_match" | "different";
export interface CallSubjectDiagnostic { patientIdentity: IdentityState; caregiverIdentity: IdentityState; admissionIdentity: "expected_unavailable" | "unavailable" | "invalid" | "match" | "different"; }
function identityState(value: string | null | undefined, expected: string): IdentityState {
  if (value == null || value === "") return "unavailable";
  const lexical = value.trim();
  if (value !== expected && /^\+?\d+$/.test(lexical) && Number(lexical) <= 2147483647 && String(Number(lexical)) === expected) return "noncanonical_match";
  if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647) return "invalid";
  return value === expected ? "match" : "different";
}
function admissionState(value: string | null | undefined, expected: string | null | undefined): CallSubjectDiagnostic["admissionIdentity"] {
  const valid = (text: string | null | undefined) => typeof text === "string" && text.length > 0 && text.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(text);
  if (!valid(expected)) return "expected_unavailable";
  if (value == null || value === "") return "unavailable";
  return !valid(value) ? "invalid" : value === expected ? "match" : "different";
}
export async function visitCallRead(workspace: Workspace, value: unknown, actor: string,
  diagnose: (diagnostic: CallSubjectDiagnostic) => void = diagnostic => warn("HHA call subject proof rejected", diagnostic)) {
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
    if (row["Patient/ID"] !== patientId || row["Caregiver/ID"] !== caregiverId) {
      await checkScope();
      try { diagnose({ patientIdentity: identityState(row["Patient/ID"], patientId), caregiverIdentity: identityState(row["Caregiver/ID"], caregiverId), admissionIdentity: admissionState(row["Patient/AdmissionID"], patient.records[0]?.AdmissionID) }); } catch { /* Diagnostics never replace the access refusal. */ }
      throw new WorkflowError("call_subject_mismatch", 403);
    }
    if (row.CallTime && !inDay(row.CallTime)) throw new WorkflowError("call_source_date_unverified", 409);
  }
  await checkScope();
  return { ...data, scope: { ...scope, caregiverId, date }, membershipCheckedAt: patient.fetchedAt,
    state: data.truncated ? "partial" as const : data.records.length ? "ready" as const : "empty" as const,
    relationship: "same_patient_caregiver_day_only" as const, visitLink: "not_supplied_by_source" as const,
    completeness: "bounded_response_not_complete_history" as const, interpretation: "call_events_unvalidated" as const };
}
