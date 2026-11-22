import {WorkforceError} from './policy.js';
export function authorizationClient(details:any,client:{id:string;office:string;name:string;memberId:string;source:string}){
 if(!details||client.source!=='hhaexchange'||details.clientId!==client.id||details.office!==client.office)throw new WorkforceError(409,'authorization_client_mismatch');
 return {...details,clientId:client.id,agencyMemberId:client.memberId,clientName:client.name};
}
// No eligibility result is fabricated before an accepted TMHP connection exists.
export function authorizationCoverage(row:{startDate:string;endDate:string;renewalStatus?:string;servicesContinuing?:boolean},today:string){
 const authorization=['renewed','closed'].includes(row.renewalStatus||'')?'historical':row.endDate<today?'expired':row.startDate>today?'not_started':'dates_current';
 return {authorization,eligibility:'unverified',billingReadiness:'review_required',servicesContinuing:row.servicesContinuing===true,
  action:authorization==='expired'?(row.servicesContinuing?'urgent_service_hold_review':'renewal_and_service_review'):'verify_eligibility_and_service_scope',
  caseManagerFollowup:authorization==='expired'?'Review whether to notify the case manager about a possible service hold.':null};
}
