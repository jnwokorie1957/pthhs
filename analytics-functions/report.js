export const SITES = Object.freeze({
  pthhs: {property: '546711548', stream: '16244033088', name: 'PTHHS', hosts: ['pthhs.net', 'www.pthhs.net']},
  rideprimetime: {property: '561765914', stream: '16244067646', name: 'Ride Primetime', hosts: ['rideprimetime.net', 'www.rideprimetime.net']}
});
const summaryMetrics = ['screenPageViews', 'sessions', 'activeUsers', 'engagementRate', 'averageSessionDuration'];
const events = ['phone_click', 'email_click', 'scroll', 'page_view', 'session_start', 'user_engagement'];
const countMetrics = new Set(['screenPageViews', 'sessions', 'activeUsers', 'eventCount']);
const fail = (shape='source_shape') => {throw Object.assign(new Error('invalid_report'),{code:'ANALYTICS_SOURCE_INVALID',shape});};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 2048) => typeof value === 'string' && value.trim() !== '' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
const shift = (value, days) => new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export function reportTimezone(report) {
  const zone = report?.metadata?.timeZone;
  if (!text(zone, 100)) fail();
  try {new Intl.DateTimeFormat('en', {timeZone: zone}).format();} catch {fail();}
  return zone;
}
export function reportPeriods(timeZone, days, now = new Date()) {
  if (![7,28,90].includes(days) || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('invalid_query');
  const parts = new Intl.DateTimeFormat('en-US', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const asOfDate = `${part('year')}-${part('month')}-${part('day')}`;
  return {asOfDate, current:{startDate:shift(asOfDate,-days), endDate:shift(asOfDate,-1)}, previous:{startDate:shift(asOfDate,-2*days), endDate:shift(asOfDate,-days-1)}};
}
export function reportRequests(siteKey, days, periods) {
  if (!Object.hasOwn(SITES, siteKey) || ![7,28,90].includes(days)) throw new Error('invalid_query');
  if (!periods || !date(periods.asOfDate) || !['current','previous'].every(name => date(periods[name]?.startDate) && date(periods[name]?.endDate))
    || periods.current.startDate !== shift(periods.asOfDate,-days) || periods.current.endDate !== shift(periods.asOfDate,-1)
    || periods.previous.startDate !== shift(periods.asOfDate,-days*2) || periods.previous.endDate !== shift(periods.asOfDate,-days-1)) throw new Error('invalid_query');
  const site = SITES[siteKey];
  const dateRanges = ['current','previous'].map(name => ({...periods[name],name}));
  const hostFilter = {filter:{fieldName:'hostName',inListFilter:{values:site.hosts}}};
  const common = {dateRanges:[dateRanges[0]],dimensionFilter:hostFilter};
  return {site, requests:[
    {dateRanges,dimensionFilter:hostFilter,metrics:summaryMetrics.map(name=>({name})),limit:'2'},
    {...common,dimensions:[{name:'date'}],metrics:[{name:'screenPageViews'},{name:'sessions'}],orderBys:[{dimension:{dimensionName:'date'}}],limit:String(days)},
    {...common,dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'}],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}],limit:'10'},
    {...common,dimensions:[{name:'sessionDefaultChannelGroup'}],metrics:[{name:'sessions'},{name:'activeUsers'}],orderBys:[{metric:{metricName:'sessions'},desc:true}],limit:'10'},
    {...common,dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'}],dimensionFilter:{andGroup:{expressions:[hostFilter,{filter:{fieldName:'eventName',inListFilter:{values:events}}}]}},limit:'10'}
  ]};
}
function headers(actual, expected, shape) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some(h=>!object(h)||!expected.includes(h.name)) || new Set(actual.map(h=>h.name)).size !== expected.length) fail(shape);
  return actual.map(h=>h.name);
}
export function rows(report, dimensions, metrics, limit) {
  if (!object(report)) fail();
  const dims = headers(report.dimensionHeaders === undefined ? [] : report.dimensionHeaders, dimensions,'dimension_headers');
  const names = headers(report.metricHeaders, metrics,'metric_headers');
  for (const h of report.metricHeaders) {
    const allowed = countMetrics.has(h.name) ? ['TYPE_INTEGER'] : h.name === 'averageSessionDuration' ? ['TYPE_SECONDS','TYPE_FLOAT'] : ['TYPE_FLOAT'];
    if (!allowed.includes(h.type)) fail('metric_type');
  }
  const sourceRows = report.rows === undefined ? [] : report.rows;
  if (!Array.isArray(sourceRows) || sourceRows.length > limit) fail('rows');
  if (report.rowCount !== undefined && (!count(report.rowCount) || report.rowCount < sourceRows.length)) fail('row_count');
  const seen = new Set();
  return sourceRows.map(row => {
    if (!object(row) || !Array.isArray(row.metricValues) || row.metricValues.length !== metrics.length || !Array.isArray(row.dimensionValues === undefined ? [] : row.dimensionValues) || (row.dimensionValues === undefined ? [] : row.dimensionValues).length !== dimensions.length) fail('row_fields');
    const result = {};
    dims.forEach((name,i) => {const value=row.dimensionValues[i]?.value;if(!text(value))fail('dimension_value');result[name]=value;});
    const key = JSON.stringify(dims.map(name=>result[name]));if(seen.has(key))fail('duplicate_dimension');seen.add(key);
    names.forEach((name,i) => {
      const value=row.metricValues[i]?.value;
      if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) || value.length>100) fail('metric_value');
      const number=Number(value);
      if (!Number.isFinite(number) || number<0 || number>Number.MAX_SAFE_INTEGER || countMetrics.has(name) && (!/^\d+$/.test(value)||!count(number)) || name==='engagementRate' && number>1) fail('metric_value');
      result[name]=number;
    });
    return result;
  });
}
function coverage(report, returned, zone, metrics) {
  if (reportTimezone(report) !== zone) fail();
  const m=report.metadata;
  for (const key of ['subjectToThresholding','dataLossFromOtherRow']) if (m[key] !== undefined && typeof m[key] !== 'boolean') fail();
  if (m.emptyReason !== undefined && m.emptyReason !== '' && !text(m.emptyReason,512)) fail();
  if (m.emptyReason && returned) fail();
  const sampling=m.samplingMetadatas === undefined ? [] : m.samplingMetadatas;
  if (!Array.isArray(sampling) || sampling.length>2) fail();
  for (const sample of sampling) {
    if (!object(sample) || typeof sample.samplesReadCount!=='string' || typeof sample.samplingSpaceSize!=='string' || !/^\d{1,20}$/.test(sample.samplesReadCount) || !/^\d{1,20}$/.test(sample.samplingSpaceSize)
      || BigInt(sample.samplesReadCount)>BigInt(sample.samplingSpaceSize) || BigInt(sample.samplingSpaceSize)>18446744073709551615n) fail();
  }
  const truncation=m.dataTruncationReasons === undefined ? [] : m.dataTruncationReasons;
  if (!Array.isArray(truncation) || truncation.length>20 || truncation.some(item=>!object(item))) fail();
  const restrictions=m.schemaRestrictionResponse?.activeMetricRestrictions === undefined ? [] : m.schemaRestrictionResponse.activeMetricRestrictions;
  if (m.schemaRestrictionResponse !== undefined && !object(m.schemaRestrictionResponse) || !Array.isArray(restrictions) || restrictions.length>100) fail();
  if (restrictions.some(r=>!object(r)||!text(r.metricName,100)||!Array.isArray(r.restrictedMetricTypes)||r.restrictedMetricTypes.some(type=>!['RESTRICTED_METRIC_TYPE_UNSPECIFIED','COST_DATA','REVENUE_DATA'].includes(type)))) fail();
  if (restrictions.some(r=>metrics.includes(r.metricName))) fail();
  return {returnedRows:returned,totalRows:report.rowCount ?? null,limited:report.rowCount === undefined ? null : report.rowCount>returned,
    emptyReason:m.emptyReason || null,thresholded:m.subjectToThresholding===true,otherRow:m.dataLossFromOtherRow===true,
    sampling:sampling.map(s=>({samplesReadCount:s.samplesReadCount,samplingSpaceSize:s.samplingSpaceSize})),truncated:truncation.length>0,
    restrictedMetrics:restrictions.map(r=>r.metricName)};
}
export function shapeReports(reports, {days,timeZone,periods}) {
  if (!Array.isArray(reports) || reports.length!==5) fail();
  reportRequests('pthhs',days,periods);
  const schemas=[['summary',['dateRange'],summaryMetrics,2],['trend',['date'],['screenPageViews','sessions'],days],
    ['pages',['pagePath'],['screenPageViews','activeUsers'],10],['channels',['sessionDefaultChannelGroup'],['sessions','activeUsers'],10],['events',['eventName'],['eventCount'],10]];
  const parsed={}, evidence={};
  schemas.forEach(([name,dims,metrics,limit],i)=>{parsed[name]=rows(reports[i],dims,metrics,limit);evidence[name]=coverage(reports[i],parsed[name].length,timeZone,metrics);});
  if (parsed.summary.some(row=>!['current','previous'].includes(row.dateRange)) || evidence.summary.totalRows>2) fail();
  for (const row of parsed.trend) {
    const value=row.date, iso=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6);
    if (!/^\d{8}$/.test(value) || !date(iso) || iso<periods.current.startDate || iso>periods.current.endDate) fail();
  }
  if (parsed.events.some(row=>!events.includes(row.eventName))) fail();
  const warnings=[];
  const labels={summary:'Summary',trend:'Daily report',pages:'Pages',channels:'Channels',events:'Events'};
  for (const [name,c] of Object.entries(evidence)) {
    if (c.limited===true) warnings.push(`${labels[name]}: ${c.returnedRows} of ${c.totalRows} source rows returned.`);
    if (c.totalRows===null) warnings.push(`${labels[name]}: total row count not supplied.`);
    if (c.emptyReason) warnings.push(`${labels[name]} empty: ${c.emptyReason}`);
    if (c.thresholded) warnings.push(`${labels[name]} may be privacy-thresholded.`);
    if (c.otherRow) warnings.push(`${labels[name]} includes source aggregation into (other).`);
    if (c.sampling.length) warnings.push(`${labels[name]} uses sampled source data.`);
    if (c.truncated) warnings.push(`${labels[name]} source data is truncated.`);
    if (c.restrictedMetrics.length) warnings.push(`${labels[name]} has source metric restrictions.`);
  }
  const current=parsed.summary.find(r=>r.dateRange==='current') ?? null;
  const previous=parsed.summary.find(r=>r.dateRange==='previous') ?? null;
  if (!current) warnings.push('No current summary row returned.');
  if (!previous) warnings.push('No comparison summary row returned.');
  return {current,previous,...Object.fromEntries(['trend','pages','channels','events'].map(name=>[name,parsed[name]])),coverage:evidence,
    timeZone,periods,dataQuality:warnings.length ? warnings.join(' ') : null};
}
export function shapeToday(report, timeZone) {
  const result=rows(report,[],['screenPageViews'],1);
  const evidence=coverage(report,result.length,timeZone,['screenPageViews']);
  if(evidence.totalRows>1)fail('row_count');
  const warnings=[];
  if(evidence.thresholded)warnings.push('May be privacy-thresholded.');
  if(evidence.sampling.length)warnings.push('Uses sampled source data.');
  if(evidence.truncated)warnings.push('Source data is truncated.');
  if(evidence.emptyReason)warnings.push(evidence.emptyReason);
  return {pageViews:result[0]?.screenPageViews??null,coverage:evidence,warning:warnings.join(' ')||null};
}
export function shapeRealtime(report, includeViews=false) {
  const kind='analyticsData#runRealtimeReport';
  if (report?.kind!==undefined && report.kind!==kind) fail('report_kind');
  // ProtoJSON can omit empty repeated fields and the default zero row count.
  // Recognize only the documented typed empty report, never an arbitrary {}.
  const emptyFields=['dimensionHeaders','metricHeaders','rows','totals','maximums','minimums'];
  const allowed=[...emptyFields,'rowCount','propertyQuota','kind'];
  if (object(report) && report.kind===kind && Object.keys(report).every(key=>allowed.includes(key))
    && emptyFields.every(key=>report[key]===undefined || Array.isArray(report[key])&&report[key].length===0)
    && (report.rowCount===undefined || report.rowCount===0)
    && (report.propertyQuota===undefined || object(report.propertyQuota))) return null;
  const result=rows(report,[],includeViews?['activeUsers','screenPageViews']:['activeUsers'],1);
  if (report.rowCount !== undefined && report.rowCount>1) fail('row_count');
  return result.length ? (includeViews?result[0]:result[0].activeUsers) : null;
}
