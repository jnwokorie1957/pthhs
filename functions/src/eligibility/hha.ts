import type { OperationsWorkspace } from '../operations/workspace.js';
import { WorkforceError } from '../workforce/policy.js';
import { dateOnly, type Authorization, type Identity } from './domain.js';
type Workspace=Pick<OperationsWorkspace,'settings'|'query'>;
const date=(value:string|null|undefined)=>{if(!value)return null;try{return dateOnly(value.slice(0,10));}catch{return null;}};
export class HhaEligibilitySource {
  constructor(private workspace:Workspace){}
  private async context(office:string){const config=await this.workspace.settings();if(!config.dataApproved||config.settings.officeId!==office)throw new WorkforceError(403,'eligibility_source_scope');return config;}
  async discover(office:string,actor:string){
    const before=await this.context(office),result=await this.workspace.query({operation:'SearchPatients'},actor,'workforce_roster_import');
    if(result.source!=='hhaexchange'||result.operation!=='SearchPatients'||result.truncated||result.records.length>5000)throw new WorkforceError(503,'eligibility_roster_incomplete');
    const ids=result.records.map(r=>r.PatientID);if(ids.some(id=>!id||!/^\d{1,10}$/.test(id)))throw new WorkforceError(503,'eligibility_source_invalid');
    if((await this.context(office)).settings.revision!==before.settings.revision)throw new WorkforceError(409,'revision_conflict');
    return [...new Set(ids)] as string[];
  }
  async read(office:string,id:string,actor:string){
    if(!/^\d{1,10}$/.test(id))throw new WorkforceError(400,'invalid_request');
    const before=await this.context(office),result=await this.workspace.query({operation:'GetPatientDemographics',id},actor,'eligibility_identity');
    if(result.source!=='hhaexchange'||result.operation!=='GetPatientDemographics'||result.truncated||result.records.length!==1)throw new WorkforceError(503,'eligibility_source_invalid');
    const row=result.records[0]!;if(row.PatientID!==id)throw new WorkforceError(503,'eligibility_source_invalid');
    if(row.OfficeID!==office)return null;
    if(!row.PatientStatusName)throw new WorkforceError(503,'eligibility_source_status_missing');
    let authorizations:Authorization[]|null=null,authorizationsFetchedAt:string|null=null;
    if(before.settings.enabledReads.includes('SearchPatientAuthorizations')){
      try { const data=await this.workspace.query({operation:'SearchPatientAuthorizations',patientId:id},actor);
        if(data.source==='hhaexchange'&&data.operation==='SearchPatientAuthorizations'&&!data.truncated){
          authorizations=data.records.map(a=>({source:'hhaexchange',fetchedAt:data.fetchedAt,authorizationId:a.ID??'',
            effective:date(a.StartDate),termination:date(a.StopDate),serviceCode:null}));authorizationsFetchedAt=data.fetchedAt;
        }
      } catch { /* Unknown remains unknown; no eligibility inference from authorization dates. */ }
    }
    if((await this.context(office)).settings.revision!==before.settings.revision)throw new WorkforceError(409,'revision_conflict');
    const identity:Identity|null=row.MedicaidNumber&&row.LastName?{medicaidId:row.MedicaidNumber,lastName:row.LastName,birthDate:date(row.BirthDate)}:null;
    return {snapshot:{office,hhaPatientId:id,memberId:row.AdmissionID||id,displayName:[row.FirstName,row.LastName].filter(Boolean).join(' '),
      active:row.PatientStatusName==='Active',sourceFetchedAt:result.fetchedAt,authorizations,authorizationsFetchedAt},identity};
  }
}
