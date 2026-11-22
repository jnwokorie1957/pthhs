import {createHash} from 'node:crypto';
import type {OperationsWorkspace} from '../operations/workspace.js';
import {requirePermission,WorkforceError,type Actor} from './policy.js';
type Workspace=Pick<OperationsWorkspace,'settings'|'query'>;
export function clientAccess(actor:Actor,office?:string){requirePermission(actor,actor.grant.permissions.includes('field_visits.manage')?'field_visits.manage':'authorizations.manage',office);}
const identifier=(id:unknown)=>{if(typeof id!=='string'||!/^\d{1,10}$/.test(id))throw new WorkforceError(400,'invalid_request');return id;};
export class ClientDirectory {
 constructor(private workspace:Workspace,private actor:()=>Promise<Actor>){}
 private async scope(){const actor=await this.actor(),config=await this.workspace.settings();if(!config.settings.officeId)throw new WorkforceError(503,'client_directory_unavailable');clientAccess(actor,config.settings.officeId);if(!config.dataApproved||!['SearchPatients','GetPatientDemographics'].every(op=>config.settings.enabledReads.includes(op)))throw new WorkforceError(503,'client_directory_unavailable');return {actor,office:config.settings.officeId,revision:config.settings.revision,reads:config.settings.enabledReads};}
 private async check(context:Awaited<ReturnType<ClientDirectory['scope']>>){const current=await this.scope();if(context.office!==current.office||context.revision!==current.revision)throw new WorkforceError(409,'revision_conflict');}
 private async record(id:string,context:Awaited<ReturnType<ClientDirectory['scope']>>){
  const result=await this.workspace.query({operation:'GetPatientDemographics',id},context.actor.uid);
  if(result.source!=='hhaexchange'||result.operation!=='GetPatientDemographics'||result.truncated||result.records.length!==1)throw new WorkforceError(503,'client_directory_unavailable');
  const row=result.records[0]!;if(row.PatientID!==id)throw new WorkforceError(503,'client_directory_unavailable');if(row.OfficeID!==context.office)return null;
  return {id,office:context.office,name:[row.FirstName,row.LastName].filter(Boolean).join(' '),memberId:row.AdmissionID||id,status:row.PatientStatusName||'Not provided by source',sourceModifiedAt:row.LastModifiedDate||null,fetchedAt:result.fetchedAt,source:'hhaexchange'};
 }
 async list(name='',after?:string){
  if(typeof name!=='string'||name.length>60||name.trim().length===1)throw new WorkforceError(400,'client_name_required');name=name.trim().replace(/\s+/g,' ');if(after!==undefined&&(typeof after!=='string'||after.length>200))throw new WorkforceError(400,'invalid_request');
  const context=await this.scope(),ids=new Set<string>(),words=name.trim().split(/\s+/),filters=!name.trim()?[{}]:words.length>1?[{firstName:words[0],lastName:words.slice(1).join(' ')}]:[{firstName:words[0]},{lastName:words[0]}];let truncated=false;
  for(const filter of filters){const result=await this.workspace.query({operation:'SearchPatients',...filter},context.actor.uid,'workforce_roster_import');if(result.source!=='hhaexchange'||result.operation!=='SearchPatients')throw new WorkforceError(503,'client_directory_unavailable');truncated||=result.truncated;for(const row of result.records)ids.add(identifier(row.PatientID));}
  const ordered=[...ids].sort((a,b)=>Number(a)-Number(b)),digest=createHash('sha256').update(JSON.stringify([context.office,name,ordered])).digest('hex');let offset=0;if(after){let cursor:any;try{cursor=JSON.parse(Buffer.from(after,'base64url').toString());}catch{throw new WorkforceError(400,'invalid_request');}if(!Number.isSafeInteger(cursor.offset)||cursor.offset<0||cursor.offset>5000||cursor.digest!==digest)throw new WorkforceError(409,'client_directory_changed');offset=cursor.offset;}const selected=ordered.slice(offset,offset+5),items=[];
  for(const id of selected){const row=await this.record(id,context);if(row&&(!name||row.name.toLowerCase().includes(name.trim().toLowerCase())))items.push(row);}
  await this.check(context);return {items,next:offset+selected.length<ordered.length?Buffer.from(JSON.stringify({offset:offset+selected.length,digest})).toString('base64url'):null,source:'hhaexchange',truncated,office:context.office,coverage:'Five source profiles checked per page; only members verified in your assigned office are shown.'};
 }
 async verify(id:string){const context=await this.scope(),row=await this.record(identifier(id),context);if(!row)throw new WorkforceError(404,'client_not_found');await this.check(context);return row;}
 async detail(id:string){const context=await this.scope(),row=await this.record(identifier(id),context);if(!row)throw new WorkforceError(404,'client_not_found');let addresses:Record<string,string|null>[]=[],addressAvailable=false;
  if(context.reads.includes('GetPatientAddress')){const result=await this.workspace.query({operation:'GetPatientAddress',id},context.actor.uid);if(result.source!=='hhaexchange'||result.operation!=='GetPatientAddress'||result.truncated)throw new WorkforceError(503,'client_directory_unavailable');addresses=result.records.map(item=>Object.fromEntries(['Address1','Address2','City','State','Zip5','Zip4'].map(key=>[key,item[key]||null])));addressAvailable=true;}
  const verified=await this.record(id,context);if(!verified||verified.memberId!==row.memberId)throw new WorkforceError(409,'client_directory_changed');await this.check(context);return {...verified,addresses,addressAvailable};
 }
}
