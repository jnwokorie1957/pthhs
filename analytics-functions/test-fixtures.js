export const zone='America/Chicago';
export const periods={asOfDate:'2026-10-31',current:{startDate:'2026-10-03',endDate:'2026-10-30'},previous:{startDate:'2026-09-05',endDate:'2026-10-02'}};
export const context=()=>({days:28,timeZone:zone,periods:structuredClone(periods)});
export function report(dimensions,metrics,values,metadata={}) {
  return {dimensionHeaders:dimensions.map(name=>({name})),metricHeaders:metrics.map(name=>({name,type:name==='engagementRate'?'TYPE_FLOAT':name==='averageSessionDuration'?'TYPE_SECONDS':'TYPE_INTEGER'})),
    rows:values.map(([dims,nums])=>({dimensionValues:dims.map(value=>({value})),metricValues:nums.map(value=>({value:String(value)}))})),rowCount:values.length,metadata:{timeZone:zone,...metadata}};
}
export function reports() {
  return [report(['dateRange'],['screenPageViews','sessions','activeUsers','engagementRate','averageSessionDuration'],[[['previous'],[60,9,8,.4,30]],[['current'],[100,20,12,.5,75]]]),
    report(['date'],['screenPageViews','sessions'],[[['20261030'],[9,3]],[['20261028'],[7,2]]]),
    report(['pagePath'],['screenPageViews','activeUsers'],[[['/synthetic-page'],[11,8]]]),
    report(['sessionDefaultChannelGroup'],['sessions','activeUsers'],[[['Direct'],[10,8]]]),
    report(['eventName'],['eventCount'],[[['phone_click'],[2]],[['email_click'],[3]]])];
}
