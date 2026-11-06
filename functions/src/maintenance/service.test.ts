import assert from "node:assert/strict";
import test from "node:test";
import { MaintenanceService, maintenanceRoute } from "./service.js";
import type { MaintenanceCase } from "./service.js";
import type { Versioned } from "../operations/workspace.js";
import { WorkflowError } from "../operations/reads.js";

const date = "2026-11-05", actor = { uid: "synthetic-admin", roles: ["admin"] };
const row = { id: "15", patientId: "25", caregiverId: "35", scheduledStart: date + " 09:00", scheduledEnd: date + " 12:00",
  actualStart: date + " 08:57", actualEnd: null, evvStart: date + " 08:57", evvEnd: null, state: "source_unvalidated",
  error: null, detailFetchedAt: date + "T15:00:00.000Z", officeCheckedAt: date + "T15:00:01.000Z" } as const;
const input = { date, visitId: "15", revision: 0, sourceReceipt: row.detailFetchedAt, status: "in_review", queue: "administrator", followUpAt: null, note: "Synthetic source review; no HHA action.", proposalKind: "investigate", selectedCallIds: [] };
function fixture(sourceLookup?: ConstructorParameters<typeof MaintenanceService>[5]) {
  const records = new Map<string, Versioned>();
  let writes = 0, callReads = 0, afterDay: (() => void) | null = null;
  const current = { dataApproved: true, settings: { officeId: "123", revision: 1, enabledReads: ["SearchVisitsV2", "GetVisitInfoV3", "GetPatientDemographics", "GetCallDashBoardData"] } };
  const day = { ok: true, scope: { officeId: "123", date, timezone: "America/Chicago" }, items: [structuredClone(row)], officeDayCache: { stale: false } };
  const calls = { records: [{ CallDashboardID: "45", CallTime: date + " 08:57", CallType: "source-type", CallStatus: "source-status" }],
    scope: { officeId: "123", date, visitId: "15", patientId: "25", caregiverId: "35" }, fetchedAt: date + "T15:03:00.000Z", membershipCheckedAt: date + "T15:02:59.000Z", truncated: false };
  const repository = {
    async get<T extends Versioned>(collection: string, id: string) { return structuredClone(records.get(collection + "/" + id) as T ?? null); },
    async page<T extends Versioned>(collection: string) { return { items: [...records.entries()].filter(([key]) => key.startsWith(collection + "/")).map(([, value]) => structuredClone(value) as T), nextCursor: null }; },
    async change<T extends Versioned>(collection: string, id: string, revision: number, _actor: string, _action: string, update: (prior: T | null) => T) {
      const key = collection + "/" + id, prior = records.get(key) as T ?? null;
      if ((prior?.revision ?? 0) !== revision) throw new WorkflowError("revision_conflict", 409);
      const value = update(structuredClone(prior)); records.set(key, structuredClone(value)); writes++; return structuredClone(value);
    }
  };
  const sourceQueries: {operation:string;scope?:string}[]=[];
  const reasonSource={operation:'GetVisitEditReasonActionTaken',source:'hhaexchange',records:[],truncated:false,fetchedAt:date+'T16:00:00.000Z',visitEditReasons:[{id:'55',label:'Source | reason; label',description:'Synthetic source reason',status:'Unmapped',actions:[{id:'65',label:'Source | action; label',description:'Synthetic source action',status:'Unknown'}]}]};
  const service = new MaintenanceService(repository, { settings: async () => structuredClone(current), query:async (query:{operation:string},_actor:string,scope?:string)=>{
    sourceQueries.push({operation:query.operation,...(scope?{scope}:{})});
    if(query.operation==='GetVisitInfoV3')return{operation:query.operation,source:'hhaexchange',truncated:false,fetchedAt:date+'T16:00:00.000Z',records:[{ID:'15','Patient/ID':'25','Caregiver/ID':'35',VisitDate:date}]};
    if(query.operation==='GetPatientDemographics')return{operation:query.operation,source:'hhaexchange',truncated:false,fetchedAt:date+'T16:00:00.000Z',records:[{PatientID:'25',OfficeID:'123'}]};
    return structuredClone(reasonSource);
  } } as never,
    (async () => { afterDay?.(); return structuredClone(day); }) as never,
    (async () => { callReads++; return structuredClone(calls); }) as never, () => new Date(date + "T16:00:00.000Z"), sourceLookup);
  return { service, current, day, calls, records, sourceQueries,reasonSource, counts: () => ({ writes, callReads }), afterDay(value: () => void) { afterDay = value; } };
}
test("maintenance saves one durable local case per office/day/visit, with immutable first receipt and revision conflicts", async () => {
  const f = fixture(), first = await f.service.save(input, actor.uid);
  assert.equal(first.item.revision, 1); assert.equal(first.item.hhaSubmission, "not_submitted"); assert.equal(first.hhaWritesEnabled, false);
  assert.deepEqual(first.item.initialSource, row); assert.equal(first.item.events[0]?.actor, actor.uid);
  await assert.rejects(f.service.save(input, actor.uid), /revision_conflict/);
  const next = await f.service.save({ ...input, revision: 1, status: "needs_attention", queue: "supervisor", note: "Synthetic next step: inspect actual calls." }, actor.uid);
  assert.equal(next.item.id, first.item.id); assert.equal(next.item.events.length, 2); assert.deepEqual(next.item.initialSource, row);
  assert.equal(f.records.size, 1); assert.deepEqual(f.counts(), { writes: 2, callReads: 0 });
});
test('a current protected search receipt supports local review while an old office cache stays blocked',async()=>{
 const fresh={...row,detailFetchedAt:date+'T16:00:00.000Z',officeCheckedAt:date+'T16:00:00.000Z'};
 const f=fixture(async(day,id,receipt)=>day===date&&id===fresh.id&&receipt===fresh.detailFetchedAt?fresh:null);f.day.officeDayCache.stale=true;
 const saved=await f.service.save({...input,sourceReceipt:fresh.detailFetchedAt},actor.uid);assert.equal(saved.item.source.detailFetchedAt,fresh.detailFetchedAt);assert.equal(saved.hhaWritesEnabled,false);assert.equal(saved.item.hhaSubmission,'not_submitted');
 const denied=fixture(async()=>null);denied.day.officeDayCache.stale=true;await assert.rejects(denied.service.save({...input,sourceReceipt:fresh.detailFetchedAt},actor.uid),/maintenance_source_stale/);
});
test("source facts and arbitrary clock/reason/approval fields cannot be injected", async () => {
  const f = fixture();
  for (const field of ["actualStart", "evvEnd", "source", "approved", "hhaSubmission", "reasonCode", "officeId"]) await assert.rejects(f.service.save({ ...input, [field]: "injected" }, actor.uid), /invalid_maintenance_request/);
  await assert.rejects(f.service.save({ ...input, note: " " }, actor.uid), /maintenance_note_required/);
  await assert.rejects(f.service.save({ ...input, status: "hha_confirmed" }, actor.uid), /invalid_maintenance_choice/);
  assert.deepEqual(f.counts(), { writes: 0, callReads: 0 });
});
test("stale, missing, failed and different-scope source rows cannot create cases", async () => {
  for (const change of [f => { f.day.officeDayCache.stale = true; }, f => { f.day.items = []; },
    f => { f.day.scope.officeId = "456"; }, f => { (f.day.items[0] as unknown as { state: string }).state = "unavailable"; } ] as ((f: ReturnType<typeof fixture>) => void)[]) {
    const f = fixture(); change(f); await assert.rejects(f.service.save(input, actor.uid), /maintenance_source_(?:stale|unavailable)/); assert.equal(f.counts().writes, 0);
  }
});
test("revoked release, changed office/read settings and malformed dates block work without HHA dispatch", async () => {
  const f = fixture(); f.current.dataApproved = false;
  await assert.rejects(f.service.cases({ date }), /operational_data_release_not_approved/);
  f.current.dataApproved = true; f.current.settings.enabledReads = [];
  await assert.rejects(f.service.save(input, actor.uid), /visit_reads_not_owner_enabled/);
  const g = fixture(); g.afterDay(() => { g.current.settings.revision++; });
  await assert.rejects(g.service.save(input, actor.uid), /office_policy_changed_restart/); assert.equal(g.counts().writes, 0);
  await assert.rejects(fixture().service.cases({ date: "2026-02-30" }), /invalid_date/);
});
test("a source receipt changed since browser inspection cannot silently become a new proposal", async () => {
  const f = fixture(); await assert.rejects(f.service.save({ ...input, sourceReceipt: date + "T14:00:00.000Z" }, actor.uid), /maintenance_source_changed_refresh/);
  assert.equal(f.counts().writes, 0);
});
test("only retained actual timed call IDs can be proposed; no new or guessed clocks exist", async () => {
  const f = fixture(); await f.service.save(input, actor.uid);
  await assert.rejects(f.service.save({ ...input, revision: 1, proposalKind: "review_existing_calls", selectedCallIds: ["45"] }, actor.uid), /call_selection_not_in_evidence/);
  const evidence = await f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid);
  assert.equal(evidence.item.revision, 2); assert.equal(evidence.item.calls?.visitLink, "not_supplied_by_source"); assert.equal(evidence.item.proposal, null);
  const proposal = await f.service.save({ ...input, revision: 2, proposalKind: "review_existing_calls", selectedCallIds: ["45"], status: "awaiting_hha_action" }, actor.uid);
  assert.deepEqual(proposal.item.proposal?.selectedCallIds, ["45"]); assert.equal(proposal.item.hhaSubmission, "not_submitted");
  await assert.rejects(f.service.save({ ...input, revision: 3, proposalKind: "review_existing_calls", selectedCallIds: ["46"] }, actor.uid), /call_selection_not_in_evidence/);
  assert.equal(f.counts().callReads, 1);
});
test("date-only calls, empty/duplicate selections and selections on unrelated proposal kinds are rejected", async () => {
  const f = fixture(); await f.service.save(input, actor.uid); f.calls.records[0]!.CallTime = date;
  await f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid);
  for (const selectedCallIds of [[], ["45", "45"], ["45"]]) await assert.rejects(f.service.save({ ...input, revision: 2, proposalKind: "review_existing_calls", selectedCallIds }, actor.uid), /invalid_call_selection|call_selection_not_in_evidence/);
  await assert.rejects(f.service.save({ ...input, revision: 2, selectedCallIds: ["45"] }, actor.uid), /invalid_call_selection/);
});
test("call reads require a saved revision, fresh source subject checks and correct context; failures retain prior case", async () => {
  const f = fixture();
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 0 }, actor.uid), /maintenance_save_case_first/);
  await f.service.save(input, actor.uid); f.calls.scope.patientId = "26";
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid), /maintenance_scope_mismatch/);
  const page = await f.service.cases({ date }); assert.equal(page.items[0]?.revision, 1); assert.equal(page.items[0]?.calls, null);
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 99 }, actor.uid), /revision_conflict/);
});
test("new source subjects clear retained calls, refreshed evidence clears prior proposals and office close is local", async () => {
  const f = fixture(); await f.service.save(input, actor.uid); await f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid);
  (f.day.items[0] as unknown as { caregiverId: string }).caregiverId = "36";
  const result = await f.service.save({ ...input, revision: 2, status: "office_review_complete" }, actor.uid);
  assert.equal(result.item.calls, null); assert.equal(result.item.initialSource.caregiverId, "35"); assert.equal(result.item.source.caregiverId, "36");
  assert.equal(result.item.hhaSubmission, "not_submitted");
});
test("case listings remain office/day scoped and validate cursors; router exposes no execution routes", async () => {
  const f = fixture(); await f.service.save(input, actor.uid);
  assert.equal((await f.service.cases({ date })).items.length, 1); assert.equal((await f.service.cases({ date: "2026-11-04" })).items.length, 0);
  await assert.rejects(f.service.cases({ date, cursor: ["bad"] }), /invalid_page_cursor/);
  for (const path of ["/maintenance/confirm", "/maintenance/execute", "/maintenance/clock-in", "/maintenance/approve"]) {
    assert.equal((await maintenanceRoute(f.service, actor, "POST", path, {})).status, 404);
  }
  assert.equal((await maintenanceRoute(f.service, { ...actor, roles: ["office_staff"] }, "GET", "/maintenance/cases", { date })).status, 403);
  assert.deepEqual(f.counts(), { writes: 1, callReads: 0 });
});
test("retained case history is bounded, and call source errors serialize safely without private facts", async () => {
  const f = fixture(); const first = await f.service.save(input, actor.uid), key = [...f.records.keys()][0]!;
  f.records.set(key, { ...first.item, events: Array(150).fill(first.item.events[0]) } as MaintenanceCase);
  await assert.rejects(f.service.save({ ...input, revision: 1 }, actor.uid), /maintenance_history_limit/);
  const result = await maintenanceRoute(f.service, actor, "POST", "/maintenance/save", { ...input, revision: 1 });
  assert.deepEqual(result.body, { ok: false, error: "maintenance_history_limit" });
});
test("large call evidence cannot exceed record and paged-response capacity or damage the prior revision", async () => {
  const f = fixture(); await f.service.save(input, actor.uid);
  f.calls.records = Array.from({ length: 200 }, (_, i) => ({ CallDashboardID: String(i + 100), CallTime: date + " 09:00", CallType: "x".repeat(1000), CallStatus: "y".repeat(1000) }));
  await assert.rejects(f.service.calls({ date, visitId: "15", revision: 1 }, actor.uid), /maintenance_history_limit/);
  const saved = (await f.service.cases({ date })).items[0]!; assert.equal(saved.revision, 1); assert.equal(saved.calls, null);
});
test('case details can be opened without creating a case or changing a visit',async()=>{
 const f=fixture();assert.equal((await f.service.getCase({date,visitId:'15'})).item,null);await f.service.save(input,actor.uid);
 assert.equal((await f.service.getCase({date,visitId:'15'})).item?.revision,1);assert.equal(f.counts().writes,1);
});
test('reason reads require the explicit owner grant, fresh visit/office proof and the internal read-only context',async()=>{
 const f=fixture();await f.service.save(input,actor.uid);await assert.rejects(f.service.reasons({date,visitId:'15',revision:1},actor.uid),/read_not_owner_enabled/);assert.equal(f.sourceQueries.length,0);
 f.current.settings.enabledReads.push('GetVisitEditReasonActionTaken');const result=await f.service.reasons({date,visitId:'15',revision:1},actor.uid);
 assert.equal(result.item.reasonCatalog?.reasons[0]?.actions[0]?.name,'Source | action; label');assert.deepEqual(f.sourceQueries.map(q=>q.operation),['GetVisitInfoV3','GetPatientDemographics','GetVisitEditReasonActionTaken']);
 assert.equal(f.sourceQueries[2]?.scope,'visit_reason_review');assert.equal(result.item.hhaSubmission,'not_submitted');
});
test('staged reason/action pairs must belong to the retained fresh visit catalog; no arbitrary codes or source writes',async()=>{
 const f=fixture();await f.service.save(input,actor.uid);f.current.settings.enabledReads.push('GetVisitEditReasonActionTaken');await f.service.reasons({date,visitId:'15',revision:1},actor.uid);
 await assert.rejects(f.service.save({...input,revision:2,reasonId:'55',actionId:'66'},actor.uid),/reason_selection_not_in_fresh_source/);
 await assert.rejects(f.service.save({...input,revision:2,reasonId:'55'},actor.uid),/select_reason_and_action/);
 const saved=await f.service.save({...input,revision:2,proposalKind:'review_confirmation',reasonId:'55',actionId:'65'},actor.uid);
 assert.equal(saved.item.proposal?.reasonId,'55');assert.equal(saved.item.proposal?.actionId,'65');assert.equal(saved.item.hhaSubmission,'not_submitted');
 assert.ok(f.sourceQueries.every(q=>q.operation.startsWith('Get')));
});
test('duplicate catalog IDs and stale source choices cannot be staged',async()=>{
 const f=fixture();await f.service.save(input,actor.uid);f.current.settings.enabledReads.push('GetVisitEditReasonActionTaken');f.reasonSource.visitEditReasons.push(f.reasonSource.visitEditReasons[0]!);
 await assert.rejects(f.service.reasons({date,visitId:'15',revision:1},actor.uid),/reason_source_unverified/);
 f.reasonSource.visitEditReasons.pop();f.reasonSource.fetchedAt=date+'T14:00:00.000Z';await f.service.reasons({date,visitId:'15',revision:1},actor.uid);
 await assert.rejects(f.service.save({...input,revision:2,reasonId:'55',actionId:'65'},actor.uid),/reason_selection_not_in_fresh_source/);
});
