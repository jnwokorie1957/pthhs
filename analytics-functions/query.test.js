import test from 'node:test';
import assert from 'node:assert/strict';
import {queryReports} from './query.js';
import {reports,report,periods} from './test-fixtures.js';
const clock=()=>new Date('2026-10-31T18:00:00.000Z');
function source(override=()=>null) {
  const calls=[];
  return {calls,async request(options){calls.push(options);const special=override(options,calls.length);if(special)return special;
    if(options.url.endsWith(':runReport'))return {data:{metadata:{timeZone:'America/Chicago'}}};
    if(options.url.endsWith(':batchRunReports'))return {data:{reports:reports()}};
    return {data:report([],['activeUsers'],[[[],[0]]])};}};
}
test('source timezone precedes explicit-date batch; realtime is bounded to selected web stream',async()=>{
  for(const [site,property,stream] of [['pthhs','546711548','16244033088'],['rideprimetime','561765914','16244067646']]){
    const client=source(),result=await queryReports(client,site,28,clock);
    assert.equal(result.contractVersion,2);assert.deepEqual(result.periods,periods);assert.equal(result.current.sessions,20);assert.equal(result.realtime,0);
    assert.equal(result.realtimeStreamId,stream);assert.equal(result.realtimeUpdatedAt,'2026-10-31T18:00:00.000Z');
    assert.equal(client.calls.length,3);assert.ok(client.calls.every(c=>c.url.includes('/properties/'+property+':')&&c.method==='POST'&&c.retry===false));
    assert.deepEqual(client.calls[1].data.requests[0].dateRanges,[{...periods.current,name:'current'},{...periods.previous,name:'previous'}]);
    assert.deepEqual(client.calls[2].data.dimensionFilter,{filter:{fieldName:'streamId',stringFilter:{matchType:'EXACT',value:stream}}});
    assert.deepEqual(client.calls[2].data.minuteRanges,[{startMinutesAgo:29,endMinutesAgo:0}]);
    assert.equal(client.calls[0].data.dimensionFilter.filter.fieldName,'hostName');
  }
});
test('access denial stops before further reads; no automatic retry or zero report',async()=>{
  const denial=Object.assign(new Error('source access denied'),{response:{status:403}}),client=source(()=>{throw denial;});
  await assert.rejects(queryReports(client,'pthhs',28,clock),e=>e===denial);assert.equal(client.calls.length,1);
});
test('missing source timezone and malformed historical response fail before realtime',async()=>{
  for(const mode of ['timezone','report']){
    const client=source(o=>o.url.endsWith(mode==='timezone'?':runReport':':batchRunReports')?{data:{}}:null);
    await assert.rejects(queryReports(client,'pthhs',28,clock),/invalid_report/);assert.equal(client.calls.length,mode==='timezone'?1:2);
  }
});
test('empty, invalid and failed realtime never replace valid historical facts or become zero',async()=>{
  for(const mode of ['empty','invalid','failure']){
    const client=source(o=>{if(!o.url.endsWith(':runRealtimeReport'))return null;if(mode==='failure')throw new Error('private upstream detail');return {data:mode==='empty'?report([],['activeUsers'],[]):{}};});
    const result=await queryReports(client,'pthhs',28,clock);assert.equal(result.current.sessions,20);assert.equal(result.realtime,null);
    assert.match(result.realtimeError,mode==='empty'?/No realtime source row/:/unavailable or invalid/);assert.doesNotMatch(result.realtimeError,/private/);
  }
});
test('query allowlist rejects unknown properties/windows before any source read',async()=>{
  const client=source();for(const args of [['__proto__',28],['pthhs',2]])await assert.rejects(queryReports(client,...args,clock),/invalid_query/);assert.equal(client.calls.length,0);
});
