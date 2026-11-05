import test from 'node:test';
import assert from 'node:assert/strict';
import {reportRequests,reportPeriods,shapeReports,shapeRealtime,shapeToday,reportTimezone} from './report.js';
import {reports,report,context,periods} from './test-fixtures.js';

test('bounded property allowlist and explicit source-calendar periods',()=>{
  for(const args of [['evil',28],['pthhs',1],['__proto__',28]])assert.throws(()=>reportRequests(...args,periods),/invalid_query/);
  assert.throws(()=>reportRequests('pthhs',28),/invalid_query/);
  const result=reportRequests('pthhs',28,periods);assert.equal(result.requests.length,5);
  assert.deepEqual(result.requests[0].dateRanges,[{...periods.current,name:'current'},{...periods.previous,name:'previous'}]);
  assert.deepEqual(result.requests[0].dimensionFilter.filter.inListFilter.values,['pthhs.net','www.pthhs.net']);
});
test('source timezone handles calendar boundary and DST without elapsed-day shifts',()=>{
  const instant=new Date('2026-11-01T00:30:00Z');
  assert.equal(reportPeriods('America/Chicago',7,instant).asOfDate,'2026-10-31');
  assert.equal(reportPeriods('Asia/Tokyo',7,instant).asOfDate,'2026-11-01');
  assert.deepEqual(reportPeriods('America/Chicago',7,new Date('2026-11-02T12:00:00Z')).current,{startDate:'2026-10-26',endDate:'2026-11-01'});
  for(const source of [{},{metadata:{timeZone:'Invalid/Timezone'}},{metadata:{timeZone:null}}])assert.throws(()=>reportTimezone(source),/invalid_report/);
});
test('date-range summary names map independently; explicit zeros survive',()=>{
  const source=reports();source[0].rows[1].metricValues[1].value='0';const result=shapeReports(source,context());
  assert.equal(result.current.sessions,0);assert.equal(result.previous.sessions,9);assert.equal(result.pages[0].screenPageViews,11);
  assert.equal(result.coverage.summary.returnedRows,2);assert.equal(result.dataQuality,null);
});
test('empty source and missing comparison remain null, never fabricated zero summaries',()=>{
  const source=reports();source[0].rows.shift();source[0].rowCount=1;
  const one=shapeReports(source,context());assert.equal(one.previous,null);assert.equal(one.current.sessions,20);assert.match(one.dataQuality,/No comparison summary row/);
  for(const r of source){delete r.rows;delete r.rowCount;r.metadata.emptyReason='NO_DATA';}
  const empty=shapeReports(source,context());assert.equal(empty.current,null);assert.equal(empty.previous,null);assert.deepEqual(empty.pages,[]);
  assert.equal(empty.coverage.summary.totalRows,null);assert.equal(empty.coverage.summary.emptyReason,'NO_DATA');assert.match(empty.dataQuality,/NO_DATA/);
  assert.throws(()=>shapeReports([{}, {}, {}, {}, {}],context()),/invalid_report/);
});
test('sampling, thresholds, row limits, other aggregation and truncation remain disclosed',()=>{
  const source=reports();source[2].rowCount=20;Object.assign(source[2].metadata,{subjectToThresholding:true,dataLossFromOtherRow:true,
    samplingMetadatas:[{samplesReadCount:'9007199254740993',samplingSpaceSize:'9007199254740994'}],dataTruncationReasons:[{dataTruncationType:'DATA_TRUNCATION_TYPE_UNSPECIFIED'}]});
  const result=shapeReports(source,context()),c=result.coverage.pages;assert.equal(c.totalRows,20);assert.equal(c.returnedRows,1);assert.equal(c.limited,true);
  assert.equal(c.sampling[0].samplesReadCount,'9007199254740993');assert.equal(c.truncated,true);assert.equal(c.thresholded,true);assert.equal(c.otherRow,true);
  assert.match(result.dataQuality,/1 of 20.*privacy-thresholded.*aggregation.*sampled.*truncated/);
});
for(const [name,change] of [
  ['missing metric header',r=>r[0].metricHeaders.pop()],['duplicate header',r=>r[0].metricHeaders[0]={...r[0].metricHeaders[1]}],
  ['unexpected dimension',r=>r[0].dimensionHeaders=[{name:'unknown'}]],['wrong metric unit',r=>r[0].metricHeaders[0].type='TYPE_SECONDS'],
  ['missing metric value',r=>r[0].rows[0].metricValues.pop()],['blank metric value',r=>r[0].rows[0].metricValues[0].value=''],
  ['null metric value',r=>r[0].rows[0].metricValues[0].value=null],['negative count',r=>r[0].rows[0].metricValues[0].value='-1'],
  ['null row array',r=>r[0].rows=null],['null sample metadata',r=>r[0].metadata.samplingMetadatas=null],
  ['numeric sample count',r=>r[0].metadata.samplingMetadatas=[{samplesReadCount:1,samplingSpaceSize:'10'}]],
  ['overflow sample space',r=>r[0].metadata.samplingMetadatas=[{samplesReadCount:'1',samplingSpaceSize:'99999999999999999999'}]],
  ['fractional count',r=>r[0].rows[0].metricValues[0].value='1.5'],['overflow count',r=>r[0].rows[0].metricValues[0].value='9007199254740992'],
  ['NaN',r=>r[0].rows[0].metricValues[0].value='NaN'],['engagement over one',r=>r[0].rows[0].metricValues[3].value='1.1'],
  ['unknown summary range',r=>r[0].rows[0].dimensionValues[0].value='date_range_0'],['duplicate summary range',r=>r[0].rows[0].dimensionValues[0].value='current'],
  ['impossible row count',r=>r[0].rowCount=1],['oversized summary',r=>r[0].rowCount=3],
  ['missing metadata timezone',r=>delete r[1].metadata.timeZone],['changed property timezone',r=>r[1].metadata.timeZone='Asia/Tokyo'],
  ['out-of-period date',r=>r[1].rows[0].dimensionValues[0].value='20261101'],['invalid calendar date',r=>r[1].rows[0].dimensionValues[0].value='20261032'],
  ['unexpected event',r=>r[4].rows[0].dimensionValues[0].value='unrequested_event'],['empty reason with facts',r=>r[0].metadata.emptyReason='EMPTY'],
  ['malformed threshold',r=>r[0].metadata.subjectToThresholding='true'],['invalid sample counts',r=>r[0].metadata.samplingMetadatas=[{samplesReadCount:'11',samplingSpaceSize:'10'}]],
  ['restricted requested metric',r=>r[0].metadata.schemaRestrictionResponse={activeMetricRestrictions:[{metricName:'sessions',restrictedMetricTypes:['COST_DATA']}]}]
])test('rejects source '+name+' before any report is accepted',()=>{const r=reports();change(r);assert.throws(()=>shapeReports(r,context()),/invalid_report/);});
test('realtime explicit zero is valid; empty or malformed response is never a zero',()=>{
  assert.equal(shapeRealtime(report([],['activeUsers'],[[[],[0]]])),0);assert.equal(shapeRealtime(report([],['activeUsers'],[])),null);
  for(const r of [{},report([],['activeUsers'],[[[],['NaN']]]),report(['unexpected'],['activeUsers'],[[['x'],[2]]])])assert.throws(()=>shapeRealtime(r),/invalid_report/);
});
test('typed realtime empty report accepts omitted ProtoJSON defaults without creating a zero',()=>{
  const kind='analyticsData#runRealtimeReport';
  for(const value of [{kind},{kind,metricHeaders:[],dimensionHeaders:[],rows:[],rowCount:0,totals:[],maximums:[],minimums:[]},{kind,propertyQuota:{}}])assert.equal(shapeRealtime(value),null);
});
test('typed empty recognition cannot hide missing values, contradictory counts or unknown errors',()=>{
  const base={kind:'analyticsData#runRealtimeReport'};
  for(const value of [{},{kind:'analyticsData#runReport'},{...base,metricHeaders:null},{...base,rows:null},{...base,rowCount:1},{...base,error:{message:'PRIVATE'}},
    {...base,totals:[{}]},{...base,rows:[{metricValues:[{value:'3'}]}]},{...base,propertyQuota:null}])assert.throws(()=>shapeRealtime(value),/invalid_report/);
});

test('today verifies timezone, integer views and coverage; missing rows never become zero',()=>{
  assert.equal(shapeToday(report([],['screenPageViews'],[[[],[0]]]),'America/Chicago').pageViews,0);
  assert.equal(shapeToday(report([],['screenPageViews'],[]),'America/Chicago').pageViews,null);
  assert.match(shapeToday(report([],['screenPageViews'],[[[],[5]]],{subjectToThresholding:true}),'America/Chicago').warning,/thresholded/);
  for(const source of [{},report([],['screenPageViews'],[[[],['NaN']]]),report([],['screenPageViews'],[[[],[1.5]]]),report([],['screenPageViews'],[[[],[2]]],{timeZone:'Asia/Tokyo'})])assert.throws(()=>shapeToday(source,'America/Chicago'),/invalid_report/);
});
