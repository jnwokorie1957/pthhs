import type { OperationsWorkspace } from "./workspace.js";
import { identifier, WorkflowError, type OperationalRead, type ReadInput } from "./reads.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function caregiverAvailabilityRead(workspace: Workspace, value: unknown, actor: string, elapsedClock: () => number = () => performance.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new WorkflowError("invalid_caregiver_availability_query");
  const input = value as Record<string, unknown>, operation = input.operation;
  if ((operation !== "GetCaregiverPermanentWeekAvailability" && operation !== "GetCaregiverSpecialAvailability")
    || Reflect.ownKeys(input).some(key => typeof key !== "string" || !["operation", "id", "officeId"].includes(key))) throw new WorkflowError("invalid_caregiver_availability_query");
  const caregiverId = identifier(input.id), officeId = identifier(input.officeId);
  const current = await workspace.settings();
  if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
  if (officeId !== current.settings.officeId) throw new WorkflowError("office_scope_mismatch", 403);
  if (!["GetCaregiverDemographics", operation].every(op => current.settings.enabledReads.includes(op))) throw new WorkflowError("read_not_owner_enabled", 423);
  const checkScope = async () => {
    const latest = await workspace.settings();
    if (!latest.dataApproved || JSON.stringify(current.settings) !== JSON.stringify(latest.settings)) throw new WorkflowError("office_policy_changed_restart", 409);
  };
  const started = elapsedClock();
  const read = async (input: ReadInput) => {
    // Leave a full transport attempt and response headroom. No automatic retry.
    if (elapsedClock() - started >= 30_000) throw new WorkflowError("caregiver_availability_read_budget_deferred", 503);
    await checkScope();
    const data = await workspace.query(input, actor);
    await checkScope();
    if (data.operation !== input.operation || data.source !== "hhaexchange") throw new WorkflowError("caregiver_availability_source_unavailable", 409);
    return data;
  };
  const checkCaregiver = async () => {
    const data = await read({ operation: "GetCaregiverDemographics", id: caregiverId });
    let offices: unknown; try { offices = JSON.parse(data.records[0]?.OfficeIDs || ""); } catch { /* rejected below */ }
    if (data.truncated || data.records.length !== 1 || data.records[0]?.ID !== caregiverId || !Array.isArray(offices) || !offices.length || offices.length > 200
      || offices.some(id => typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647)
      || new Set(offices).size !== offices.length || !offices.includes(officeId)) throw new WorkflowError("caregiver_office_mismatch", 403);
    return data.fetchedAt;
  };
  const before = await checkCaregiver();
  const data = await read({ operation, id: caregiverId });
  const key = operation === "GetCaregiverPermanentWeekAvailability" ? "PermanentWeekID" : "SpecialAvailabilityID";
  const fields = [key, "CaregiverID", "OfficeID", ...(operation === "GetCaregiverSpecialAvailability" ? ["FromDate", "ToDate"] : []), ...days.flatMap(day => [day + "AvailabilityType", day + "From", day + "To", day + "LiveIn"])];
  const seen = new Set<string>();
  if (data.attachment || data.records.length > 200) throw new WorkflowError("caregiver_availability_source_unavailable", 409);
  for (const row of data.records) {
    if (row.CaregiverID !== caregiverId) throw new WorkflowError("caregiver_availability_caregiver_mismatch", 403);
    if (row.OfficeID !== officeId) throw new WorkflowError("caregiver_availability_office_mismatch", 403);
    const id = row[key];
    if (!id || !/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647 || seen.has(id)) throw new WorkflowError("caregiver_availability_identity_unverified", 409);
    if (fields.some(field => row[field] !== undefined && row[field] !== null && typeof row[field] !== "string")) throw new WorkflowError("caregiver_availability_source_unavailable", 409);
    seen.add(id);
  }
  const after = await checkCaregiver(); await checkScope();
  const records: OperationalRead["records"] = data.records.map(row => ({ ...Object.fromEntries(fields.map(field => [field, row[field] ?? null])),
    Interpretation: "Raw HHA availability fields; time, type, live-in and period meanings remain unvalidated. No eligibility, complete schedule, assignment, EVV, worked hours or pay is established." }));
  return { ...data, records, scope: { caregiverId, officeId }, membershipCheckedAt: after, membershipReadAt: { before, after }, interpretation: "caregiver_availability_unvalidated" as const };
}
