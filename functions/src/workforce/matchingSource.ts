import {getApp} from 'firebase-admin/app';
import {addressComponents} from './addresses.js';
import {HhaProfileSource} from './hhaSource.js';
import {WorkforceError} from './policy.js';
import {interval,localInstant,localTime,sunday,nextSunday,placeId,type Window,type RouteProof} from './matching.js';
import type {OperationsWorkspace} from '../operations/workspace.js';
type Workspace=Pick<OperationsWorkspace,'settings'|'query'>;
export class MatchingMaps {
 constructor(private enabled:boolean,private request:typeof fetch=fetch,private token=async()=>{const c=getApp().options.credential;if(!c)throw Error('unavailable');return (await c.getAccessToken()).access_token;}){}
 private async headers(mask:string){if(!this.enabled)throw new WorkforceError(423,'matching_maps_pending');return {Authorization:'Bearer '+await this.token(),'X-Goog-User-Project':'primetimehomehealthservices','X-Goog-FieldMask':mask,'Content-Type':'application/json'};}
 async verify(id:string){placeId(id);const response=await this.request('https://places.googleapis.com/v1/places/'+encodeURIComponent(id),{headers:await this.headers('addressComponents'),redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new WorkforceError(503,'matching_address_unavailable');const result=await response.json() as {addressComponents:unknown};return addressComponents(result.addressComponents);}
 async route(origin:string,destination:string):Promise<RouteProof>{placeId(origin);placeId(destination);const response=await this.request('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:await this.headers('routes.distanceMeters,routes.duration'),redirect:'error',signal:AbortSignal.timeout(10000),body:JSON.stringify({origin:{placeId:origin},destination:{placeId:destination},travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',computeAlternativeRoutes:false})});if(!response.ok)throw new WorkforceError(503,'matching_route_unavailable');const result=await response.json() as {routes?:{distanceMeters:number;duration:string}[]};const row=result.routes?.[0];if(result.routes?.length!==1||!row||!Number.isSafeInteger(row.distanceMeters)||row.distanceMeters<0||!/^\d+(?:\.\d+)?s$/.test(row.duration))throw new WorkforceError(503,'matching_route_unavailable');return {meters:row.distanceMeters,seconds:Number(row.duration.slice(0,-1)),checkedAt:new Date().toISOString()};}
}
export function sourceTime(value:string|null|undefined){if(typeof value!=='string')throw new WorkforceError(423,'matching_hours_unverified');if(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::00)?$/.test(value))return localInstant(value.slice(0,16));if(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();throw new WorkforceError(423,'matching_hours_unverified');}
export async function matchingCommitments(workspace:Workspace,actor:string,office:string,caregiverId:string,shifts:Window[],now=Date.now()){
 const settings=await workspace.settings();if(!settings.dataApproved||settings.settings.officeId!==office||settings.settings.officeTimezone!=='America/Chicago')throw new WorkforceError(423,'matching_office_not_ready');
 const required=['GetCaregiverDemographics','SearchVisitsV2','GetVisitInfoV3'];if(required.some(op=>!settings.settings.enabledReads.includes(op)))throw new WorkforceError(423,'matching_hha_reads_pending');
 const source=new HhaProfileSource(workspace,actor,office),profile=await source.profile(caregiverId);let offices:unknown;try{offices=JSON.parse(profile.fields.OfficeIDs||'');}catch{}
 if(profile.status!=='Active'||!['employee','caregiver'].includes((profile.fields.EmployeeType||'').toLowerCase()))throw new WorkforceError(423,'matching_employee_unverified');
 if(!Array.isArray(offices)||offices.length!==1||offices[0]!==office)throw new WorkforceError(423,'matching_all_office_hours_required');
 const from=sunday(Date.parse(shifts[0]!.start)),through=nextSunday(sunday(Date.parse(shifts.at(-1)!.end)-1));
 const fromDate=localTime(Date.parse(from)-86400000).slice(0,10),toDate=localTime(Date.parse(through)).slice(0,10);
 const found=await workspace.query({operation:'SearchVisitsV2',officeId:office,caregiverId,fromDate,toDate},actor,'workforce_matching_hours');
 if(found.operation!=='SearchVisitsV2'||found.source!=='hhaexchange'||found.truncated||found.records.length>40)throw new WorkforceError(423,'matching_complete_schedule_required');
 const ids=found.records.map(r=>r.VisitID);if(new Set(ids).size!==ids.length||ids.some(id=>!id||!/^\d{1,10}$/.test(id)))throw new WorkforceError(423,'matching_complete_schedule_required');
 const commitments:Window[]=[];const started=Date.now();
 for(const id of ids){if(Date.now()-started>45000)throw new WorkforceError(503,'matching_source_budget_deferred');const data=await workspace.query({operation:'GetVisitInfoV3',id:id!},actor,'workforce_matching_hours');const row=data.records[0];if(data.source!=='hhaexchange'||data.operation!=='GetVisitInfoV3'||data.truncated||data.records.length!==1||!row||row.ID!==id||row['Caregiver/ID']!==caregiverId)throw new WorkforceError(423,'matching_complete_schedule_required');
  const planned=interval({start:sourceTime(row.ScheduleStartTime),end:sourceTime(row.ScheduleEndTime)});
  if(Date.parse(planned.start)<now){if(!row.VisitStartTime||!row.VisitEndTime)throw new WorkforceError(423,'matching_actual_hours_pending');const actual=interval({start:sourceTime(row.VisitStartTime),end:sourceTime(row.VisitEndTime)});if(Date.parse(actual.end)>now)throw new WorkforceError(423,'matching_actual_hours_pending');commitments.push(actual);}else commitments.push(planned);
 }
 commitments.sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<commitments.length;i++)if(commitments[i]!.start<commitments[i-1]!.end)throw new WorkforceError(423,'matching_schedule_conflict_requires_review');
 const current=await source.profile(caregiverId),latest=await workspace.settings();if(current.status!==profile.status||current.email!==profile.email||JSON.stringify(current.fields.OfficeIDs)!==JSON.stringify(profile.fields.OfficeIDs)||JSON.stringify(latest.settings)!==JSON.stringify(settings.settings))throw new WorkforceError(409,'matching_source_changed');
 const clipped=commitments.map(w=>({start:new Date(Math.max(Date.parse(from),Date.parse(w.start))).toISOString(),end:new Date(Math.min(Date.parse(through),Date.parse(w.end))).toISOString()})).filter(w=>w.start<w.end);
 return {commitments:clipped,complete:true,checkedAt:new Date().toISOString(),name:[current.firstName,current.lastName].filter(Boolean).join(' ')};
}
