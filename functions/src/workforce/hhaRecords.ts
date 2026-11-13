import type {OperationsWorkspace} from '../operations/workspace.js';
import {identifier, WorkflowError, type ReadInput} from '../operations/reads.js';
import type {HhaProfile} from './hhaSource.js';
import {WorkforceError} from './policy.js';

const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const weekFields = days.flatMap(day => [day+'AvailabilityType',day+'From',day+'To',day+'LiveIn']);
// Only these projections cross the workforce boundary. Patient references,
// internal notes and arbitrary Operations methods are never forwarded.
export const HHA_RECORDS = {
 'weekly-availability': {operation:'GetCaregiverPermanentWeekAvailability', fields:weekFields},
 'special-availability': {operation:'GetCaregiverSpecialAvailability', fields:['FromDate','ToDate',...weekFields]},
 training: {operation:'GetCaregiverInServices', fields:['InserviceDate','FromTime','EndTime','NoShow','NoShowReason/Name','InserviceCountCompliance']},
 preferences: {operation:'GetCaregiverPreferences', fields:['Language1','Language2','Language3','Language4']},
 'pay-rates': {operation:'GetCaregiverRates', fields:['Discipline','FromDate','ToDate','HourlyRate','DailyRate','VisitRate','Status']},
} as const;
export type HhaRecordKind = keyof typeof HHA_RECORDS;
export function hhaRecordKind(value:string, self:boolean):HhaRecordKind {
 if(!Object.hasOwn(HHA_RECORDS,value) || !self && value==='pay-rates') throw new WorkforceError(404,'hha_record_not_available');
 return value as HhaRecordKind;
}
type Workspace=Pick<OperationsWorkspace,'settings'|'query'>;
export class HhaRecords {
 constructor(private workspace:Workspace, private authorize:()=>Promise<HhaProfile>, private actor:string, private self:boolean){}
 async read(value:string) {
  const kind=hhaRecordKind(value,this.self),spec=HHA_RECORDS[kind],before=await this.authorize();
  identifier(before.id);identifier(before.office);
  if(this.self && (before.status!=='Active' || before.fields.EmployeeType?.toLowerCase()==='applicant')) throw new WorkforceError(403,'hha_record_not_available');
  const prior=await this.workspace.settings();
  if(!prior.dataApproved || prior.settings.officeId!==before.office)throw new WorkforceError(503,'hha_records_unavailable');
  if(!prior.settings.enabledReads.includes(spec.operation))throw new WorkforceError(423,'hha_record_connection_pending');
  let source;
  try {source=await this.workspace.query({operation:spec.operation,id:before.id} as ReadInput,this.actor,'workforce_caregiver_records');}
  catch(error){if(error instanceof WorkflowError && ['read_not_owner_enabled','vendor_contract_clarification_required'].includes(error.code))throw new WorkforceError(423,'hha_record_connection_pending');throw new WorkforceError(503,'hha_records_unavailable');}
  if(source.source!=='hhaexchange' || source.operation!==spec.operation || source.attachment)throw new WorkforceError(503,'hha_records_unavailable');
  for(const row of source.records){
   if(row.CaregiverID!==before.id)throw new WorkforceError(403,'hha_record_owner_mismatch');
   if(kind.endsWith('availability'))identifier(row.OfficeID);
  }
  const after=await this.authorize(),latest=await this.workspace.settings();
  if(after.id!==before.id || after.office!==before.office || after.email!==before.email || after.status!==before.status || after.fields.EmployeeType!==before.fields.EmployeeType || !latest.dataApproved || JSON.stringify(latest.settings)!==JSON.stringify(prior.settings))throw new WorkforceError(409,'hha_record_changed_reload');
  const rows=source.records.filter(row=>!kind.endsWith('availability') || row.OfficeID===before.office);
  return {kind,source:'hhaexchange',fetchedAt:source.fetchedAt,truncated:source.truncated,
   items:rows.map(row=>Object.fromEntries(spec.fields.map(key=>[key,row[key]??null])))};
 }
}
