import test from 'node:test';
import assert from 'node:assert/strict';
import {reportRequests,shapeReports} from './report.js';
test('only the two configured properties and bounded windows can be read',()=>{
  for(const args of [['evil',28],['pthhs',1],['__proto__',28]])assert.throws(()=>reportRequests(...args),/invalid_query/);
  const result=reportRequests('pthhs',28);
  assert.equal(result.requests.length,5);
  assert.deepEqual(result.requests[0].dateRanges,[{startDate:'28daysAgo',endDate:'yesterday',name:'current'},{startDate:'56daysAgo',endDate:'29daysAgo',name:'previous'}]);
  assert.deepEqual(result.requests[0].dimensionFilter.filter.inListFilter.values,['pthhs.net','www.pthhs.net']);
});
test('summary maps date ranges by their names and never sums top-page rows',()=>{
  const reports=[{dimensionHeaders:[{name:'dateRange'}],metricHeaders:[{name:'sessions'}],rows:[{dimensionValues:[{value:'previous'}],metricValues:[{value:'9'}]},{dimensionValues:[{value:'current'}],metricValues:[{value:'4'}]}]}, {},{metricHeaders:[{name:'screenPageViews'}],rows:[{metricValues:[{value:'200'}]}]}, {},{}];
  const shaped=shapeReports(reports);assert.equal(shaped.current.sessions,4);assert.equal(shaped.previous.sessions,9);assert.equal(shaped.pages[0].screenPageViews,200);
});
test('an empty Google report is a real zero; malformed responses fail',()=>{
  assert.equal(shapeReports([{}, {}, {}, {}, {}]).current.sessions,0);
  assert.throws(()=>shapeReports([]),/invalid_report/);
});
