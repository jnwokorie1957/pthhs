import {SITES, reportPeriods, reportRequests, reportTimezone, shapeReports, shapeRealtime} from './report.js';

export function realtimeFailure(error) {
  const rawStatus=error?.response?.status;
  const httpStatus=Number.isInteger(rawStatus)&&rawStatus>=100&&rawStatus<=599?rawStatus:null;
  let category='unavailable',shape=null,message='Realtime source request failed. Try again later.';
  if (error?.code==='ANALYTICS_SOURCE_INVALID') {
    category='invalid_response';
    const known=['source_shape','report_kind','dimension_headers','metric_headers','metric_type','rows','row_count','row_fields','dimension_value','duplicate_dimension','metric_value'];
    shape=known.includes(error.shape)?error.shape:'source_shape';
    message='Realtime response could not be verified.';
  } else if (httpStatus===403) {category='access_denied';message='Google realtime access is unavailable for this source.';}
  else if (httpStatus===429) {category='rate_limited';message='Google realtime read limit reached. Try again later.';}
  else if (httpStatus!==null) {category=httpStatus>=500?'upstream_unavailable':'request_rejected';message=`Google realtime request failed (HTTP ${httpStatus}).`;}
  else if (['ETIMEDOUT','ECONNABORTED'].includes(error?.code)||error?.name==='TimeoutError') {category='timeout';message='Google realtime request timed out.';}
  else if (['ENOTFOUND','ECONNRESET','EAI_AGAIN'].includes(error?.code)) {category='network_unavailable';message='Google realtime could not be reached.';}
  return {diagnostic:{category,httpStatus,shape},message};
}

export async function queryReports(client, siteKey, days, clock=()=>new Date()) {
  if (!Object.hasOwn(SITES,siteKey) || ![7,28,90].includes(days)) throw new Error('invalid_query');
  const site=SITES[siteKey], base='https://analyticsdata.googleapis.com/v1beta/properties/'+site.property;
  const read=(method,data,timeout)=>client.request({url:base+':'+method,method:'POST',data,timeout,retry:false});
  // Probe values are never displayed or cached as report facts.
  const probe=await read('runReport',{dateRanges:[{startDate:'yesterday',endDate:'yesterday'}],metrics:[{name:'activeUsers'}],limit:'1',
    dimensionFilter:{filter:{fieldName:'hostName',inListFilter:{values:site.hosts}}}},10000);
  const timeZone=reportTimezone(probe.data), periods=reportPeriods(timeZone,days,clock());
  const {requests}=reportRequests(siteKey,days,periods);
  const batch=await read('batchRunReports',{requests},20000);
  const shaped=shapeReports(batch.data?.reports,{days,timeZone,periods});
  const updatedAt=clock().toISOString();
  let realtime=null,realtimeError=null,realtimeUpdatedAt=null,realtimeDiagnostic=null;
  try {
    const live=await read('runRealtimeReport',{metrics:[{name:'activeUsers'}],minuteRanges:[{startMinutesAgo:29,endMinutesAgo:0}],
      dimensionFilter:{filter:{fieldName:'streamId',stringFilter:{matchType:'EXACT',value:site.stream}}}},15000);
    realtime=shapeRealtime(live.data);
    realtimeUpdatedAt=clock().toISOString();
    if (realtime===null) {realtimeError='No realtime source rows returned.';realtimeDiagnostic={category:'empty_result',httpStatus:null,shape:live.data.metricHeaders?.length?null:'typed_empty_report'};}
  } catch(error) {const failure=realtimeFailure(error);realtimeError=failure.message;realtimeDiagnostic=failure.diagnostic;}
  return {ok:true,contractVersion:2,site:siteKey,name:site.name,days,propertyId:site.property,...shaped,realtime,realtimeError,realtimeUpdatedAt,realtimeDiagnostic,
    realtimeStreamId:site.stream,updatedAt,
    periodNote:'Historical reports match website hostnames. Realtime covers the selected GA4 web stream, last 30 minutes. Recent historical data may still be processing.'};
}
