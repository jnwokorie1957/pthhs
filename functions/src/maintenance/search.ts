import { createHash } from "node:crypto";
import { detailItem, type VisitPreviewItem } from "../views/visits.js";
import { identifier, readRequest, WorkflowError, type ReadInput } from "../operations/reads.js";
import type { OperationsWorkspace, WorkspaceRepository, Versioned } from "../operations/workspace.js";

type Workspace = Pick<OperationsWorkspace, "settings" | "query">;
export interface SearchRow extends VisitPreviewItem {
  serviceDate: string; patientFirstName: string | null; patientLastName: string | null; admissionId: string | null;
  caregiverFirstName: string | null; caregiverLastName: string | null; caregiverCode: string | null;
  profilePayerId: string | null; profilePayerName: string | null; contractIds: string[] | null;
}
interface Evidence extends Versioned { context: string; officeId: string; date: string; row: SearchRow; }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const evidenceId = (officeId: string, date: string, visitId: string) => hash([officeId, date, visitId]);
function object(value: unknown, fields: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new WorkflowError("invalid_maintenance_search");
  return value as Record<string, unknown>;
}
function optional(value: unknown) { if (value === undefined || value === "") return undefined; return identifier(value); }
function name(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > 60 || value.trim().length < 2 || /[\u0000-\u001f]/.test(value)) throw new WorkflowError("name_filter_requires_2_to_60_characters");
  return value.trim();
}
function caregiverOffice(record: Record<string, string | null>, id: string, officeId: string) {
  let offices: unknown; try { offices = JSON.parse(record.OfficeIDs || ""); } catch { /* rejected */ }
  if (record.ID !== id || !Array.isArray(offices) || offices.length > 200 || !offices.includes(officeId) || offices.some(value => typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value))) throw new WorkflowError("caregiver_office_mismatch", 403);
}

/** On-demand source API pages, with protected receipts usable by office reviews. */
export class MaintenanceSearch {
  constructor(private workspace: Workspace, private repository: Pick<WorkspaceRepository, "get" | "change">, private now = () => new Date()) {}
  private async context() {
    const current = await this.workspace.settings();
    if (!current.dataApproved) throw new WorkflowError("operational_data_release_not_approved", 423);
    const officeId = identifier(current.settings.officeId), context = hash(current);
    const check = async () => { if (hash(await this.workspace.settings()) !== context) throw new WorkflowError("office_policy_changed_restart", 409); };
    return { current, officeId, context, check };
  }
  async capabilities() {
    const ctx = await this.context(); await ctx.check();
    return { ok: true, officeId: ctx.officeId, officeTimezone: ctx.current.settings.officeTimezone, enabledReads: ctx.current.settings.enabledReads.filter(op => ["SearchPatients", "SearchCaregivers", "GetContracts", "GetScheduleInfo", "GetVisitEditReasonActionTaken"].includes(op)), sourceWritesEnabled: false };
  }
  async evidence(date: string, visitId: string, receipt: unknown) {
    const ctx = await this.context(), item = await this.repository.get<Evidence>("maintenanceSearchEvidence", evidenceId(ctx.officeId, date, visitId));
    await ctx.check();
    if (!item || item.officeId !== ctx.officeId || item.date !== date || item.context !== ctx.context || item.row.id !== visitId || item.row.detailFetchedAt !== receipt) return null;
    const age = this.now().getTime() - Date.parse(item.updatedAt);
    return age >= 0 && age <= 15 * 60000 ? item.row : null;
  }
  async people(value: unknown, actor: string) {
    const input = object(value, ["kind", "firstName", "lastName", "code", "offset"]), ctx = await this.context();
    const kind = input.kind;
    if (kind !== "patient" && kind !== "caregiver") throw new WorkflowError("invalid_person_kind");
    const firstName = name(input.firstName), lastName = name(input.lastName), code = name(input.code);
    if (!firstName && !lastName && !code) throw new WorkflowError("enter_a_name_or_code");
    const operation = kind === "patient" ? "SearchPatients" : "SearchCaregivers";
    const offset = input.offset ?? 0;
    if (!Number.isSafeInteger(offset) || (offset as number) < 0 || (offset as number) > 200) throw new WorkflowError("invalid_person_offset");
    const query: ReadInput = { operation, ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}), ...(code ? kind === "patient" ? { admissionId: code } : { caregiverCode: code } : {}) };
    const source = await this.workspace.query(query, actor, "maintenance_people_search");
    if (source.operation !== operation || source.source !== "hhaexchange") throw new WorkflowError("person_search_unverified", 502);
    const ids = [...new Set(source.records.map(row => identifier(row[kind === "patient" ? "PatientID" : "CaregiverID"])))];
    const items = [];
    for (const id of ids.slice(offset as number, (offset as number) + 5)) {
      await ctx.check();
      const profile = await this.workspace.query({ operation: kind === "patient" ? "GetPatientDemographics" : "GetCaregiverDemographics", id }, actor);
      if (profile.source !== "hhaexchange" || profile.operation !== (kind === "patient" ? "GetPatientDemographics" : "GetCaregiverDemographics") || profile.truncated || profile.records.length !== 1) continue;
      const row = profile.records[0]!;
      if (kind === "patient") { if (row.PatientID !== id || row.OfficeID !== ctx.officeId) continue; }
      else { try { caregiverOffice(row, id, ctx.officeId); } catch { continue; } }
      items.push({ id, firstName: row.FirstName, lastName: row.LastName, code: kind === "patient" ? row.AdmissionID : row.CaregiverCode, fetchedAt: profile.fetchedAt });
    }
    await ctx.check();
    return { ok: true, kind, officeId: ctx.officeId, items, source: "hhaexchange", truncated: source.truncated,
      nextOffset: (offset as number) + 5 < ids.length ? (offset as number) + 5 : null };
  }
  async contracts(actor: string) {
    const ctx = await this.context(), source = await this.workspace.query({ operation: "GetContracts", officeId: ctx.officeId }, actor);
    if (source.operation !== "GetContracts" || source.source !== "hhaexchange") throw new WorkflowError("contract_source_unverified", 502);
    await ctx.check();
    return { ok: true, officeId: ctx.officeId, source: "hhaexchange", fetchedAt: source.fetchedAt, truncated: source.truncated,
      items: source.records.map(row => ({ id: identifier(row.ContractID), name: row.ContractName, status: row.Active })) };
  }
  async search(value: unknown, actor: string, elapsed = () => performance.now()) {
    const input = object(value, ["from", "to", "patientId", "caregiverId", "contractId", "cursor"]), ctx = await this.context();
    const from = input.from as string, to = input.to as string, patientId = optional(input.patientId), caregiverId = optional(input.caregiverId), contractId = optional(input.contractId);
    const query: ReadInput = { operation: "SearchVisitsV2", officeId: ctx.officeId, fromDate: from, toDate: to, ...(patientId ? { patientId } : {}), ...(caregiverId ? { caregiverId } : {}) };
    readRequest(query);
    const signature = hash([ctx.context, actor, from, to, patientId ?? null, caregiverId ?? null, contractId ?? null]);
    let cursor: { signature: string; discovery: string; offset: number } | null = null;
    if (input.cursor !== undefined) {
      try { if (typeof input.cursor !== "string" || input.cursor.length > 600) throw new Error(); cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString());
        if (!cursor || Object.keys(cursor).sort().join() !== "discovery,offset,signature" || cursor.signature !== signature || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0 || !/^[a-f0-9]{64}$/.test(cursor.discovery)) throw new Error();
      } catch { throw new WorkflowError("maintenance_search_changed_restart", 409); }
    }
    const discovery = await this.workspace.query(query, actor, "visit_discovery");
    if (discovery.operation !== "SearchVisitsV2" || discovery.source !== "hhaexchange") throw new WorkflowError("maintenance_search_unverified", 502);
    const ids = [...new Set(discovery.records.map(row => identifier(row.VisitID)))].sort((a, b) => Number(a) - Number(b)), fingerprint = hash(ids);
    if (ids.length > 10000 || cursor && (cursor.discovery !== fingerprint || cursor.offset >= ids.length)) throw new WorkflowError("maintenance_search_changed_restart", 409);
    let offset = cursor?.offset ?? 0, checked = 0, retryAfterSeconds: number | null = null, unknownPayers = 0;
    const items: SearchRow[] = [], unavailable: { id: string; error: string }[] = [], started = elapsed(), profiles = new Map<string, Record<string, string | null>>();
    while (offset < ids.length && checked < 10 && elapsed() - started < 24000) {
      const id = ids[offset]!;
      try {
        await ctx.check();
        const visit = await this.workspace.query({ operation: "GetVisitInfoV3", id }, actor), facts = visit.records[0];
        const date = facts?.VisitDate?.slice(0, 10);
        if (!date || date < from || date > to) throw new WorkflowError("visit_date_scope_mismatch", 409);
        const base = detailItem(id, date, visit), patient = await this.workspace.query({ operation: "GetPatientDemographics", id: identifier(base.patientId) }, actor);
        if (patient.truncated || patient.records.length !== 1 || patient.records[0]?.PatientID !== base.patientId || patient.records[0]?.OfficeID !== ctx.officeId) throw new WorkflowError("visit_patient_office_mismatch", 403);
        if (patientId && base.patientId !== patientId || caregiverId && base.caregiverId !== caregiverId) throw new WorkflowError("visit_search_subject_mismatch", 409);
        const cgId = base.caregiverId ? identifier(base.caregiverId) : null;
        let cg: Record<string, string | null> | undefined = cgId ? profiles.get(cgId) : {};
        if (!cg && cgId) {
          const profile = await this.workspace.query({ operation: "GetCaregiverDemographics", id: cgId }, actor);
          if (profile.truncated || profile.records.length !== 1) throw new WorkflowError("caregiver_source_not_unique", 409);
          cg = profile.records[0]!; caregiverOffice(cg, cgId, ctx.officeId); profiles.set(cgId, cg);
        }
        cg ??= {};
        let contractIds: string[] | null = null;
        if (contractId) {
          let billing = await this.workspace.query({ operation: ctx.current.settings.enabledReads.includes("GetScheduleInfo") ? "GetScheduleInfo" : "GetVisitBillInfoV2", id }, actor);
          if (billing.operation === "GetScheduleInfo" && !billing.truncated && billing.records.length === 0) {
            await ctx.check(); billing = await this.workspace.query({ operation: "GetVisitBillInfoV2", id }, actor);
          }
          if (!billing.truncated && billing.records.length === 0 && ctx.current.settings.enabledReads.includes("GetVisitBillInfo")) {
            await ctx.check(); billing = await this.workspace.query({ operation: "GetVisitBillInfo", id }, actor);
          }
          const record = billing.records[0];
          if (billing.source !== "hhaexchange" || !["GetScheduleInfo", "GetVisitBillInfoV2", "GetVisitBillInfo"].includes(billing.operation)) throw new WorkflowError("billing_source_context_mismatch", 403);
          if (billing.truncated || billing.records.length > 1 || record && (record.ID !== id || record["Patient/ID"] !== base.patientId || record["Caregiver/ID"] !== cgId || record.VisitDate?.slice(0, 10) !== date)) throw new WorkflowError("billing_source_context_mismatch", 403);
          contractIds = record ? [record["PrimaryBillTo/Contract/ID"], record["SecondaryBillTo/Contract/ID"]].filter((id): id is string => Boolean(id) && id !== "0").map(identifier) : null;
          if (!contractIds?.length) { unknownPayers++; contractIds = null; }
        }
        await ctx.check();
        const p = patient.records[0]!, row: SearchRow = { ...base, officeCheckedAt: patient.fetchedAt, serviceDate: date,
          patientFirstName: p.FirstName ?? null, patientLastName: p.LastName ?? null, admissionId: p.AdmissionID ?? null,
          caregiverFirstName: cg.FirstName ?? null, caregiverLastName: cg.LastName ?? null, caregiverCode: cg.CaregiverCode ?? null,
          profilePayerId: p.PayerID ?? null, profilePayerName: p.PayerName ?? null, contractIds };
        if (!contractId || contractIds?.includes(contractId)) {
          const key = evidenceId(ctx.officeId, date, id), prior = await this.repository.get<Evidence>("maintenanceSearchEvidence", key);
          await this.repository.change<Evidence>("maintenanceSearchEvidence", key, prior?.revision ?? 0, actor, "maintenance_source_read", () => ({ id: key, revision: (prior?.revision ?? 0) + 1, updatedAt: this.now().toISOString(), context: ctx.context, officeId: ctx.officeId, date, row }));
          items.push(row);
        }
        offset++; checked++;
      } catch (error) {
        await ctx.check();
        if (!(error instanceof WorkflowError) || [429, 503].includes(error.status)) { retryAfterSeconds = error instanceof WorkflowError ? error.retryAfterSeconds || 60 : 60; break; }
        if (error.status === 409) throw error;
        unavailable.push({ id, error: error.code }); offset++; checked++;
        if ([403, 423].includes(error.status)) break;
      }
    }
    await ctx.check();
    return { ok: true, source: "hhaexchange", mode: "live", scope: { officeId: ctx.officeId, from, to }, items, unavailable,
      fetchedAt: discovery.fetchedAt, checkedAt: this.now().toISOString(), totalIds: ids.length, checkedThrough: offset, checkedThisPage: checked,
      truncated: discovery.truncated, unknownPayers, complete: offset === ids.length && !discovery.truncated && !unavailable.length && unknownPayers === 0,
      nextCursor: offset < ids.length ? Buffer.from(JSON.stringify({ signature, discovery: fingerprint, offset })).toString("base64url") : null, retryAfterSeconds };
  }
}
