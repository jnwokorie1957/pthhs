import {WorkforceError,validId} from './policy.js';
import {needs} from './opportunities.js';

export const MATCH_LIMIT=10,MAX_DRIVING_METERS=10*1609.344,MAX_WEEK_MINUTES=40*60;
export const MATCH_TIMEZONE='America/Chicago';
export interface Window {start:string;end:string}
export interface MatchPreferences {optIn:boolean;smsOptIn:boolean;placeId:string;tasks:string[];serviceTypes:string[];pets:boolean;maxWeeklyHours:number;available:Window[]}
export interface MatchPlan {placeId:string;shifts:Window[];automatic:boolean}
export interface Qualification {skills:string[];expiresAt:string;revision:number}
export interface RouteProof {meters:number;seconds:number;checkedAt:string}
export interface CandidateEvidence {id:string;preferences:MatchPreferences;qualification:Qualification;commitments:Window[];complete:boolean;route:RouteProof;checkedAt:string}
const format=new Intl.DateTimeFormat('en-CA',{timeZone:MATCH_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function localTime(epoch:number){const p=format.formatToParts(new Date(epoch)),get=(key:string)=>p.find(v=>v.type===key)!.value;return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;}
export function localInstant(value:string){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw new WorkforceError(400,'matching_time_invalid');
 const approximate=Date.parse(value+'Z');if(!Number.isFinite(approximate))throw new WorkforceError(400,'matching_time_invalid');
 const options=[5,6].map(hours=>approximate+hours*3600000).filter(epoch=>localTime(epoch)===value);
 if(options.length!==1)throw new WorkforceError(400,'matching_time_ambiguous_or_missing');return new Date(options[0]!).toISOString();
}
export function interval(input:unknown):Window{
 const v=input as Window;if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['start','end'].includes(k)))throw new WorkforceError(400,'matching_time_invalid');
 const convert=(s:string)=>{if(typeof s!=='string')throw new WorkforceError(400,'matching_time_invalid');if(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(s))return localInstant(s);if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(s)||!Number.isFinite(Date.parse(s)))throw new WorkforceError(400,'matching_time_invalid');return new Date(s).toISOString();};
 const start=convert(v.start),end=convert(v.end),length=Date.parse(end)-Date.parse(start);
 if(length<=0||length>25*3600000)throw new WorkforceError(400,'matching_time_invalid');return {start,end};
}
export function windows(input:unknown,max=100){if(!Array.isArray(input)||!input.length||input.length>max)throw new WorkforceError(400,'matching_shifts_required');const result=input.map(interval).sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<result.length;i++)if(result[i]!.start<result[i-1]!.end)throw new WorkforceError(400,'matching_overlapping_shifts');return result;}
export function sunday(epoch:number){const date=localTime(epoch).slice(0,10),d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-d.getUTCDay());return localInstant(d.toISOString().slice(0,10)+'T00:00');}
export function nextSunday(start:string){const d=new Date(localTime(Date.parse(start)).slice(0,10)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+7);return localInstant(d.toISOString().slice(0,10)+'T00:00');}
export function weekMinutes(items:Window[]){const totals:Record<string,number>={};for(const raw of items){const item=interval(raw);let start=Date.parse(item.start),end=Date.parse(item.end);while(start<end){const week=sunday(start),boundary=Date.parse(nextSunday(week)),finish=Math.min(end,boundary);totals[week]=(totals[week]||0)+(finish-start)/60000;start=finish;}}return totals;}
export function placeId(value:unknown){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,256}$/.test(value))throw new WorkforceError(400,'matching_address_required');return value;}
export function preferences(input:unknown):MatchPreferences{
 const p=input as MatchPreferences;if(!p||Object.keys(p).some(k=>!['optIn','smsOptIn','placeId','tasks','serviceTypes','pets','maxWeeklyHours','available'].includes(k))||typeof p.optIn!=='boolean'||typeof p.smsOptIn!=='boolean'||typeof p.pets!=='boolean'||!Number.isInteger(p.maxWeeklyHours)||p.maxWeeklyHours<1||p.maxWeeklyHours>40||!Array.isArray(p.tasks)||!p.tasks.length||p.tasks.some(t=>!needs.includes(t as typeof needs[number]))||!Array.isArray(p.serviceTypes)||!p.serviceTypes.length||p.serviceTypes.some(t=>!['regular','respite','protective_supervision'].includes(t)))throw new WorkforceError(400,'matching_preferences_invalid');
 if(p.smsOptIn&&!p.optIn)throw new WorkforceError(400,'matching_preferences_invalid');
 return {optIn:p.optIn,smsOptIn:p.smsOptIn,placeId:placeId(p.placeId),tasks:[...new Set(p.tasks)],serviceTypes:[...new Set(p.serviceTypes)],pets:p.pets,maxWeeklyHours:p.maxWeeklyHours,available:windows(p.available)};
}
export function plan(input:unknown,now=Date.now()):MatchPlan{
 const p=input as MatchPlan;if(!p||Object.keys(p).some(k=>!['placeId','shifts','automatic'].includes(k))||typeof p.automatic!=='boolean')throw new WorkforceError(400,'matching_plan_invalid');const shifts=windows(p.shifts,28);
 if(Date.parse(shifts[0]!.start)<=now||Date.parse(shifts.at(-1)!.end)-Date.parse(shifts[0]!.start)>28*86400000)throw new WorkforceError(400,'matching_future_shifts_required');return {placeId:placeId(p.placeId),shifts,automatic:p.automatic};
}
export function fresh(value:string,now:number,max=15*60000){const age=now-Date.parse(value);return Number.isFinite(age)&&age>=0&&age<=max;}
export function evaluateMatch(required:{tasks:string[];serviceType:string;pets:string},proposed:Window[],candidate:CandidateEvidence,now=Date.now()){
 const p=candidate.preferences,q=candidate.qualification,reasons:string[]=[];
 if(!validId(candidate.id)||!p.optIn)reasons.push('not_opted_in');
 if(!candidate.complete||!fresh(candidate.checkedAt,now))reasons.push('weekly_hours_unverified');
 if(!q||!Number.isFinite(Date.parse(q.expiresAt))||Date.parse(q.expiresAt)<=now||required.tasks.some(t=>!q.skills.includes(t)))reasons.push('qualifications_unverified');
 if(required.tasks.some(t=>!p.tasks.includes(t))||!p.serviceTypes.includes(required.serviceType)||required.pets==='yes'&&!p.pets||required.pets==='unknown')reasons.push('preferences_do_not_match');
 if(proposed.some(s=>!p.available.some(w=>w.start<=s.start&&w.end>=s.end)))reasons.push('not_available_for_all_shifts');
 const commitments=candidate.commitments.map(interval);
 if(proposed.some(s=>commitments.some(c=>s.start<c.end&&s.end>c.start)))reasons.push('schedule_conflict');
 const route=candidate.route;
 if(!route||!Number.isFinite(route.meters)||route.meters<0||!Number.isFinite(route.seconds)||route.seconds<0||!fresh(route.checkedAt,now,24*3600000))reasons.push('driving_distance_unverified');
 else if(route.meters>MAX_DRIVING_METERS)reasons.push('outside_ten_driving_miles');
 const totals=weekMinutes([...commitments,...proposed]);
 if(Object.values(totals).some(minutes=>minutes>Math.min(MAX_WEEK_MINUTES,p.maxWeeklyHours*60)))reasons.push('weekly_hour_limit');
 return {eligible:!reasons.length,reasons,weekMinutes:totals,drivingMiles:route?.meters/1609.344};
}
