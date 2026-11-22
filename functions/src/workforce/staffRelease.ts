import type {Actor, Permission} from './policy.js';

export const STAFF_PHASE_ONE_AT=Date.parse('2027-01-01T06:00:00.000Z');
export const laterModules=['caregivers','authorizations','forms','matching','activity','hr'] as const;
export type LaterModule=typeof laterModules[number];
export function staffRelease(actor:Actor,now=Date.now(),env=process.env){
 const enabled=env.WORKFORCE_STAFF_PHASED_RELEASE==='true';
 const preview=enabled&&actor.grant.role==='owner'&&now<STAFF_PHASE_ONE_AT;
 const approved=new Set((env.WORKFORCE_STAFF_LATER_MODULES_APPROVED||'').split(',').map(x=>x.trim()).filter(x=>laterModules.includes(x as LaterModule)));
 const has=(module:LaterModule)=>!enabled||preview||approved.has(module);
 const permission=(p:Permission)=>p.startsWith('opportunities.')||p.startsWith('staff.')||p==='applicants.review'||has(p==='field_visits.manage'?'forms':p.startsWith('authorizations.')?'authorizations':p==='accounts.support'?'caregivers':'hr');
 return {enabled,preview,has,permission,phase:preview?'owner_preview':'phase_one',launchAt:new Date(STAFF_PHASE_ONE_AT).toISOString()};
}
export function releasedStaffActor(actor:Actor,now=Date.now(),env=process.env):Actor{
 const release=staffRelease(actor,now,env);return {...actor,grant:{...actor.grant,permissions:actor.grant.permissions.filter(release.permission)}};
}
export function staffRouteReleased(actor:Actor,path:string,now=Date.now(),env=process.env){
 const r=staffRelease(actor,now,env);if(!r.enabled||r.preview)return true;
 if(/^\/staff\/(?:applicants|opportunities|training|invitations|team|grant)(?:\/|$)/.test(path))return true;
 if(/^\/staff\/(?:field-visits|admission-templates|admission-packets)(?:\/|$)/.test(path))return r.has('forms');
 if(/^\/staff\/clients(?:\/|$)/.test(path))return r.has('forms')||r.has('authorizations');
 if(/^\/staff\/authorizations(?:\/|$)/.test(path))return r.has('authorizations');
 if(/^\/staff\/matching(?:\/|$)/.test(path))return r.has('matching');
 if(/^\/staff\/activity(?:\/|$)/.test(path))return r.has('activity');
 if(/^\/staff\/(?:applications|personnel)(?:\/|$)/.test(path))return r.has('hr');
 if(/^\/staff\/(?:accounts|roster|caregivers|caregiver-sync|id-expirations)(?:\/|$)/.test(path))return r.has('caregivers');
 return false;
}
