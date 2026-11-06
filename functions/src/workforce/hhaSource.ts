import type {OperationsWorkspace} from "../operations/workspace.js";
import {identifier} from "../operations/reads.js";
import {WorkforceError} from "./policy.js";

export interface HhaProfile {id:string;office:string;firstName:string;lastName:string;email:string;status:string;code:string;fetchedAt:string;fields:Record<string,string|null>}
type Workspace=Pick<OperationsWorkspace,"settings"|"query">;
// The caller supplies a server-verified office and identity. Self-service callers
// obtain the caregiver ID only from the private, email-verified portal link.
export class HhaProfileSource {
 constructor(private workspace:Workspace,private actorId:string,private office:string){}
 private async settings(){const settings=await this.workspace.settings();if(!settings.dataApproved||settings.settings.officeId!==this.office)throw new WorkforceError(503,"hha_profile_unavailable");return settings.settings;}
 async discover(){
  const prior=await this.settings(),source=await this.workspace.query({operation:"SearchCaregivers"},this.actorId,"workforce_roster_import");
  if(source.operation!=="SearchCaregivers"||source.source!=="hhaexchange"||source.truncated||source.records.length>5000)throw new WorkforceError(503,"hha_roster_incomplete");
  if((await this.settings()).revision!==prior.revision)throw new WorkforceError(409,"revision_conflict");
  return {ids:[...new Set(source.records.map(row=>identifier(row.CaregiverID)))],revision:prior.revision};
 }
 async profile(id:string):Promise<HhaProfile>{
  identifier(id);const prior=await this.settings(),source=await this.workspace.query({operation:"GetCaregiverDemographics",id},this.actorId,"workforce_caregiver_profile");
  if(source.operation!=="GetCaregiverDemographics"||source.source!=="hhaexchange"||source.truncated||source.records.length!==1)throw new WorkforceError(503,"hha_profile_unavailable");
  const row=source.records[0]!;let offices:unknown;try{offices=JSON.parse(row.OfficeIDs||"");}catch{}
  if(row.ID!==id||!Array.isArray(offices)||!offices.includes(this.office)||!offices.every(value=>typeof value==="string"&&/^[1-9]\d{0,9}$/.test(value)))throw new WorkforceError(403,"hha_office_mismatch");
  if((await this.settings()).revision!==prior.revision)throw new WorkforceError(409,"revision_conflict");
  return {id,office:this.office,firstName:row.FirstName||"",lastName:row.LastName||"",email:row["NotificationPreferences/Email"]?.trim()||"",status:row["Status/Name"]||"Unknown",code:row.CaregiverCode||"",fetchedAt:source.fetchedAt,fields:row};
 }
 async documents(id:string){
  await this.profile(id);const prior=await this.settings(),source=await this.workspace.query({operation:"SearchCaregiverDocument",caregiverId:id},this.actorId,"workforce_caregiver_profile");
  if(source.source!=="hhaexchange"||source.operation!=="SearchCaregiverDocument")throw new WorkforceError(503,"hha_files_unavailable");
  const seen=new Set<string>();const items=source.records.map(row=>{const fileId=identifier(row.CaregiverDocID);if(row.CaregiverID!==id||seen.has(fileId))throw new WorkforceError(403,"hha_file_owner_mismatch");seen.add(fileId);return {id:fileId,name:row.FileName||row.CaregiverDocumentType||"HHA document",attachmentAvailable:!!row.FileName?.trim()&&row.FileSize!=="0",category:row.CaregiverDocumentType||"Document",createdAt:row.CreatedOn||null,size:row.FileSize||null};});
  if((await this.settings()).revision!==prior.revision)throw new WorkforceError(409,"revision_conflict");return {items,truncated:source.truncated,source:"hhaexchange",fetchedAt:source.fetchedAt};
 }
 async download(id:string,fileId:string){
  identifier(fileId);const before=await this.documents(id),file=before.items.find(file=>file.id===fileId);if(!file)throw new WorkforceError(404,"document_not_found");if(!file.attachmentAvailable)throw new WorkforceError(409,"hha_document_not_attached");
  const result=await this.workspace.query({operation:"DownloadCaregiverDocument",id:fileId},this.actorId,"workforce_caregiver_profile");
  if(result.source!=="hhaexchange"||result.operation!=="DownloadCaregiverDocument"||!result.attachment)throw new WorkforceError(503,"hha_files_unavailable");
  const current=await this.documents(id),same=current.items.find(item=>item.id===fileId);if(!same||JSON.stringify(same)!==JSON.stringify(file))throw new WorkforceError(409,"revision_conflict");
  return {bytes:Buffer.from(result.attachment.base64,"base64"),filename:result.attachment.filename};
 }
}
