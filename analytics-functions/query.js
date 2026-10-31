import {SITES, reportPeriods, reportRequests, reportTimezone, shapeReports, shapeRealtime} from './report.js';

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
  let realtime=null,realtimeError=null,realtimeUpdatedAt=null;
  try {
    const live=await read('runRealtimeReport',{metrics:[{name:'activeUsers'}],minuteRanges:[{startMinutesAgo:29,endMinutesAgo:0}],
      dimensionFilter:{filter:{fieldName:'streamId',stringFilter:{matchType:'EXACT',value:site.stream}}}},15000);
    realtime=shapeRealtime(live.data);
    realtimeUpdatedAt=clock().toISOString();
    if (realtime===null) realtimeError='No realtime source row returned.';
  } catch {realtimeError='Realtime source unavailable or invalid.';}
  return {ok:true,contractVersion:2,site:siteKey,name:site.name,days,propertyId:site.property,...shaped,realtime,realtimeError,realtimeUpdatedAt,
    realtimeStreamId:site.stream,updatedAt,
    periodNote:'Historical reports match website hostnames. Realtime covers the selected GA4 web stream, last 30 minutes. Recent historical data may still be processing.'};
}
