import type {OperationsWorkspace} from "../operations/workspace.js";
import {FieldPath, type Firestore} from "firebase-admin/firestore";
import {ACTIVE_HHA_CAREGIVER_STATUS, HHA_ROSTER_FRESHNESS_MS, cachedHhaName} from "./hhaCachedNames.js";
import {identifier} from "../operations/reads.js";
import {nameQuery,normalizeName} from "./directory.js";
import {requirePermission,WorkforceError,type Actor} from "./policy.js";
import type {HhaProfile} from "./hhaSource.js";

type Workspace=Pick<OperationsWorkspace,"settings"|"query">;
export class HhaDirectory {
 constructor(private workspace:Workspace,private actor:()=>Promise<Actor>){}
 private async scope(){
  const actor=await this.actor(),settings=await this.workspace.settings();
  if(!settings.dataApproved)throw new WorkforceError(503,"hha_directory_unavailable");
  const office=identifier(settings.settings.officeId);requirePermission(actor,"accounts.support",office);
  if(!["SearchCaregivers","GetCaregiverDemographics"].every(operation=>settings.settings.enabledReads.includes(operation)))throw new WorkforceError(503,"hha_directory_unavailable");
  return {actor,office,revision:settings.settings.revision};
 }
 private async record(id:string,context:Awaited<ReturnType<HhaDirectory["scope"]>>){
  const current=await this.scope();if(current.office!==context.office||current.revision!==context.revision)throw new WorkforceError(409,"revision_conflict");
  const source=await this.workspace.query({operation:"GetCaregiverDemographics",id},context.actor.uid);
  if(source.source!=="hhaexchange"||source.operation!=="GetCaregiverDemographics"||source.truncated||source.records.length!==1)throw new WorkforceError(503,"hha_directory_unavailable");
  const row=source.records[0]!;let offices:unknown;try{offices=JSON.parse(row.OfficeIDs||"");}catch{}
  if(row.EmployeeType?.toLowerCase()==="applicant")return null;
  if(row.ID!==id||!Array.isArray(offices)||!offices.includes(context.office)||!offices.every(value=>typeof value==="string"&&/^[1-9]\d{0,9}$/.test(value)))return null;
  return {uid:"hha-"+id,hhaId:id,source:"hhaexchange" as const,firstName:row.FirstName||"",lastName:row.LastName||"",state:row["Status/Name"]||"Unknown",code:row.CaregiverCode||"",office:context.office,fetchedAt:source.fetchedAt};
 }
 async search(input:unknown){
  const query=nameQuery(input);if(query.length>60)throw new WorkforceError(400,"invalid_caregiver_name");
  const context=await this.scope(),ids=new Set<string>();let hasMore=false;
  const words=(input as string).trim().split(/\s+/),filters=words.length>1?[{firstName:words[0]!,lastName:words.slice(1).join(" ")}]:[{firstName:words[0]!},{lastName:words[0]!}];
  for(const filter of filters){
   const source=await this.workspace.query({operation:"SearchCaregivers",...filter},context.actor.uid,"workforce_caregiver_search");
   if(source.source!=="hhaexchange"||source.operation!=="SearchCaregivers")throw new WorkforceError(503,"hha_directory_unavailable");
   hasMore ||= source.truncated;for(const row of source.records)ids.add(identifier(row.CaregiverID));
  }
  hasMore ||= ids.size>8;const items=[];
  for (const id of [...ids].slice(0, 8)) {
   const row = await this.record(id, context);
   if (row?.state === ACTIVE_HHA_CAREGIVER_STATUS
     && [row.firstName, row.lastName, row.firstName + " " + row.lastName].some(value => normalizeName(value).startsWith(query))) {
    items.push(row);
   }
  }
  const current=await this.scope();if(current.office!==context.office||current.revision!==context.revision)throw new WorkforceError(409,"revision_conflict");
  return {items,hasMore,source:"hhaexchange" as const};
 }
 async profile(id:string){const context=await this.scope(),record=await this.record(identifier(id),context);if(!record)throw new WorkforceError(404,"caregiver_account_unavailable");const current=await this.scope();if(current.office!==context.office||current.revision!==context.revision)throw new WorkforceError(409,"revision_conflict");return record;}
 async savedProfile(db: Firestore, id: string): Promise<HhaProfile | null> {
  const {office, revision} = await this.scope();
  const row = (await db.collection("workforceHhaProfiles").doc(identifier(id)).get()).data();
  const name = row && cachedHhaName(office, row, Date.now());
  if (!name || name.hhaId !== id || typeof row?.email !== "string" || !row.fields || typeof row.fields !== "object") {
   return null;
  }
  const current = await this.scope();
  if (current.office !== office || current.revision !== revision) throw new WorkforceError(409, "revision_conflict");
  return {id, office, firstName:name.firstName, lastName:name.lastName, status:name.state, code:name.code,
   fetchedAt:name.fetchedAt, email:row.email, fields:row.fields};
 }
 async browse(db: Firestore, after?: unknown) {
  const {office, revision} = await this.scope();
  const profiles = db.collection("workforceHhaProfiles");
  const pageSize = 50;
  const active = profiles.where("office", "==", office).where("status", "==", ACTIVE_HHA_CAREGIVER_STATUS);
  let query = active.orderBy("lastName").orderBy("firstName").orderBy(FieldPath.documentId());
  if (after !== undefined) {
   if (typeof after !== "string" || !/^[1-9]\d{0,9}$/.test(after)) throw new WorkforceError(400, "invalid_request");
   const cursor = await profiles.doc(after).get();
   const data = cursor.data();
   if (data?.office !== office || typeof data.lastName !== "string" || typeof data.firstName !== "string") {
    throw new WorkforceError(400, "invalid_request");
   }
   query = query.startAfter(data.lastName, data.firstName, cursor.id);
  }
  const now = Date.now();
  const [page, ready, run, count] = await Promise.all([
   query.select("id", "office", "firstName", "lastName", "status", "code", "fetchedAt").limit(pageSize + 1).get(),
   db.collection("workforceHhaRosterReady").doc(office).get(),
   db.collection("workforceHhaSyncRuns").doc(office).get(),
   active.where("fetchedAt", ">", new Date(now - HHA_ROSTER_FRESHNESS_MS).toISOString())
    .where("fetchedAt", "<=", new Date(now).toISOString()).count().get(),
  ]);
  const current = await this.scope();
  if (current.office !== office || current.revision !== revision) throw new WorkforceError(409, "revision_conflict");
  return {
   activeCount: count.data().count,
   items: page.docs.slice(0, pageSize).map(doc => cachedHhaName(office, doc.data(), now)).filter(item => item !== null),
   next: page.docs.length > pageSize ? page.docs[pageSize - 1]!.id : null,
   syncedAt: ready.data()?.completedAt ?? null,
   refreshFailed: run.data()?.state === "failed",
   refreshRunning: run.data()?.state === "running",
  };
 }
}
