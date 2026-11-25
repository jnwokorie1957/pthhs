import test from 'node:test';import assert from 'node:assert/strict';
import {STAFF_PHASE_ONE_AT,staffRelease,releasedStaffActor,staffRouteReleased} from './staffRelease.js';
import {permissions,type Actor} from './policy.js';
const env={WORKFORCE_STAFF_PHASED_RELEASE:'true',WORKFORCE_STAFF_LATER_MODULES_APPROVED:''};
const actor=(role:Actor['grant']['role']='office'):Actor=>({uid:'synthetic',grant:{active:true,role,offices:['a'],permissions:[...permissions]}});
test('Phase 1 releases applicant review and opportunities to permitted staff without expanding grants',()=>{
 const owner=actor('owner');assert.equal(staffRelease(owner,STAFF_PHASE_ONE_AT-1,env).preview,true);
 for(const role of ['office','office_manager','hr','supervisor'] as const){const result=releasedStaffActor(actor(role),STAFF_PHASE_ONE_AT,env);assert(result.grant.permissions.includes('applicants.review'));assert(result.grant.permissions.includes('opportunities.publish'));for(const p of ['field_visits.manage','applications.review','documents.review','accounts.support','authorizations.manage','hr.expirations'])assert(!result.grant.permissions.includes(p as any));}
 const limited=actor();limited.grant.permissions=['opportunities.read'];assert.deepEqual(releasedStaffActor(limited,STAFF_PHASE_ONE_AT,env).grant.permissions,['opportunities.read']);
 assert.equal(new Date(STAFF_PHASE_ONE_AT).toISOString(),'2027-01-01T06:00:00.000Z');
});
test('Phase 1 blocks direct later-module routes and unknown future routes, while authorized owner preview continues after launch',()=>{
 for(const role of ['office','office_manager','hr','supervisor'] as const){const a=actor(role);for(const path of ['/staff/field-visits/x/pdf','/staff/admission-templates','/staff/clients/search','/staff/authorizations','/staff/accounts/lookup','/staff/roster','/staff/applications/x/packet/pdf','/staff/matching/openings/x','/staff/activity','/staff/future-tool'])assert.equal(staffRouteReleased(a,path,STAFF_PHASE_ONE_AT,env),false,path);for(const path of ['/staff/applicants','/staff/opportunities','/staff/opportunities/x/publish','/staff/training','/staff/invitations/accept'])assert.equal(staffRouteReleased(a,path,STAFF_PHASE_ONE_AT,env),true,path);}
 for(const at of [STAFF_PHASE_ONE_AT-1,STAFF_PHASE_ONE_AT,Date.parse('2027-03-01')])assert.equal(staffRouteReleased(actor('owner'),'/staff/field-visits',at,env),true);
 assert.equal(staffRouteReleased(actor(),'/staff/field-visits',STAFF_PHASE_ONE_AT-1,env),false);
});
test('assignment schedules require Phase 2 approval in all release modes',()=>{
 const path='/staff/assignment-schedules/opening/application';
 for(const role of ['owner','office'] as const){
  for(const config of [env,{}, {...env,WORKFORCE_STAFF_LATER_MODULES_APPROVED:'caregivers'}])assert(!staffRouteReleased(actor(role),path,STAFF_PHASE_ONE_AT,config));
  assert(staffRouteReleased(actor(role),path,STAFF_PHASE_ONE_AT,{...env,WORKFORCE_STAFF_LATER_MODULES_APPROVED:'scheduling'}));
 }
});
test('later modules need explicit separate approval; unknown names and date passage never release them',()=>{
 const configuration={...env,WORKFORCE_STAFF_LATER_MODULES_APPROVED:'forms,unknown'};const a=actor();assert(staffRouteReleased(a,'/staff/field-visits',STAFF_PHASE_ONE_AT,configuration));assert(!staffRouteReleased(a,'/staff/authorizations',Date.parse('2028-01-01'),configuration));assert(!staffRouteReleased(a,'/staff/unknown',STAFF_PHASE_ONE_AT,configuration));assert(staffRelease(a,STAFF_PHASE_ONE_AT,{}).permission('field_visits.manage'));
});
