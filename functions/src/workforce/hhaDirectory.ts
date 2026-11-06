import type {OperationsWorkspace} from "../operations/workspace.js";
import {identifier} from "../operations/reads.js";
import {nameQuery,normalizeName} from "./directory.js";
import {requirePermission,WorkforceError,type Actor} from "./policy.js";

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
  for(const id of [...ids].slice(0,8)){const row=await this.record(id,context);if(row&&[row.firstName,row.lastName,row.firstName+" "+row.lastName].some(value=>normalizeName(value).startsWith(query)))items.push(row);}
  const current=await this.scope();if(current.office!==context.office||current.revision!==context.revision)throw new WorkforceError(409,"revision_conflict");
  return {items,hasMore,source:"hhaexchange" as const};
 }
 async profile(id:string){const context=await this.scope(),record=await this.record(identifier(id),context);if(!record)throw new WorkforceError(404,"caregiver_account_unavailable");const current=await this.scope();if(current.office!==context.office||current.revision!==context.revision)throw new WorkforceError(409,"revision_conflict");return record;}
}
