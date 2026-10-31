export const SITES = Object.freeze({
  pthhs: {property: '546711548', name: 'PTHHS', hosts: ['pthhs.net', 'www.pthhs.net']},
  rideprimetime: {property: '561765914', name: 'Ride Primetime', hosts: ['rideprimetime.net', 'www.rideprimetime.net']}
});
const metricNames = ['screenPageViews', 'sessions', 'activeUsers', 'engagementRate', 'averageSessionDuration'];
export function reportRequests(siteKey, days) {
  if (!Object.hasOwn(SITES, siteKey) || ![7,28,90].includes(days)) throw new Error('invalid_query');
  const site = SITES[siteKey];
  const dateRanges = [{startDate: `${days}daysAgo`, endDate:'yesterday',name:'current'}, {startDate:`${days*2}daysAgo`,endDate:`${days+1}daysAgo`,name:'previous'}];
  const hostFilter = {filter:{fieldName:'hostName',inListFilter:{values:site.hosts}}};
  const common={dateRanges:[dateRanges[0]],dimensionFilter:hostFilter};
  return {site, requests:[
    {dateRanges,dimensionFilter:hostFilter, metrics:metricNames.map(name=>({name}))},
    {...common,dimensions:[{name:'date'}],metrics:[{name:'screenPageViews'},{name:'sessions'}],orderBys:[{dimension:{dimensionName:'date'}}],limit:String(days)},
    {...common,dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'}],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}],limit:'10'},
    {...common,dimensions:[{name:'sessionDefaultChannelGroup'}],metrics:[{name:'sessions'},{name:'activeUsers'}],orderBys:[{metric:{metricName:'sessions'},desc:true}],limit:'10'},
    {...common,dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'}],dimensionFilter:{andGroup:{expressions:[hostFilter,{filter:{fieldName:'eventName',inListFilter:{values:['phone_click','email_click','scroll','page_view','session_start','user_engagement']}}}]}},limit:'10'}
  ]};
}
export function rows(report) {
  const dimensions=report.dimensionHeaders?.map(x=>x.name)||[];
  const metrics=report.metricHeaders?.map(x=>x.name)||[];
  return (report.rows||[]).map(row=>Object.fromEntries([...dimensions.map((name,i)=>[name,row.dimensionValues?.[i]?.value||'']),...metrics.map((name,i)=>[name,Number(row.metricValues?.[i]?.value||0)])]));
}
export function shapeReports(reports) {
  if (!Array.isArray(reports) || reports.length!==5) throw new Error('invalid_report');
  const summary=rows(reports[0]);
  const empty=Object.fromEntries(metricNames.map(name=>[name,0]));
  const current=summary.find(r=>r.dateRange==='current')||(!reports[0].dimensionHeaders?.length?summary[0]:null)||empty;
  const previous=summary.find(r=>r.dateRange==='previous')||empty;
  return {current,previous,trend:rows(reports[1]),pages:rows(reports[2]),channels:rows(reports[3]),events:rows(reports[4]),
    timeZone:reports[0].metadata?.timeZone||'America/Chicago',
    dataQuality:reports.some(r=>r.metadata?.subjectToThresholding)?'Some results may be privacy-thresholded.':null};
}
