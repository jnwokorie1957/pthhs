import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveViews,createCollector,liveDay} from './live-views.js';
function database(){
  const values=new Map();let pending=Promise.resolve();
  const ref=path=>({path,collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)})});
  const snap=r=>({exists:values.has(r.path),data:()=>{const d=values.get(r.path);return {...d,startedAt:d?.startedAt?{toDate:()=>d.startedAt}:undefined};}});
  return {values,collection:name=>({doc:id=>ref(name+'/'+id)}),getAll:async(...refs)=>refs.map(snap),
    runTransaction(fn){const call=pending.then(()=>fn({get:async r=>snap(r),create(r,d){assert.equal(values.has(r.path),false);values.set(r.path,d);},set(r,d){const previous=values.get(r.path)||{};values.set(r.path,{...previous,...d,count:(previous.count||0)+d.count.increment});}}));pending=call.catch(()=>{});return call;}};
}
test('durable aggregate separates sites, preserves first start and atomically counts concurrent loads',async()=>{
  const db=database();let now=new Date('2026-11-05T02:00:00Z');const service=()=>createLiveViews({db,increment:n=>({increment:n}),clock:()=>now});
  assert.equal((await service().read('pthhs')).count,null);
  await Promise.all(Array.from({length:15},()=>service().count('pthhs')));await service().count('rideprimetime');
  assert.equal((await service().read('pthhs')).count,15);assert.equal((await service().read('rideprimetime')).count,1);
  now=new Date('2026-11-05T07:00:00Z');const next=await service().read('pthhs');assert.equal(next.count,0);assert.equal(next.startedAt,'2026-11-05T02:00:00.000Z');
  await service().count('pthhs');assert.equal((await service().read('pthhs')).count,1);
  assert.equal([...db.values.values()].some(d=>Object.keys(d).some(k=>/url|ip|user|visitor|phone|email/i.test(k))),false);
  await assert.rejects(service().count('__proto__'),/invalid_site/);
});
test('calendar follows Chicago midnight and both repeated DST hours',()=>{
  for(const time of ['2026-11-01T06:30:00Z','2026-11-01T07:30:00Z'])assert.equal(liveDay(new Date(time)),'2026-11-01');
  assert.equal(liveDay(new Date('2026-11-05T05:59:59Z')),'2026-11-04');assert.equal(liveDay(new Date('2026-11-05T06:00:00Z')),'2026-11-05');
});
function response(){return {headers:{},statusCode:200,set(a,b){if(typeof a==='string')this.headers[a]=b;else Object.assign(this.headers,a);return this;},status(n){this.statusCode=n;return this;},end(){return this;}};}
const request=(overrides={})=>({method:'POST',body:{v:1},rawBody:Buffer.from('{"v":1}'),get:name=>({'Origin':'https://pthhs.net','Content-Type':'application/json'}[name]),...overrides});
test('collector admits only explicit public origins and the fixed anonymous payload',async()=>{
  const calls=[],collect=createCollector({count:async site=>calls.push(site)});
  for(const origin of ['https://pthhs.net','https://www.rideprimetime.net']){const r=response();await collect(request({get:name=>name==='Origin'?origin:'application/json'}),r);assert.equal(r.statusCode,204);assert.equal(r.headers['Access-Control-Allow-Origin'],origin);}
  assert.deepEqual(calls,['pthhs','rideprimetime']);
  for(const [overrides,status] of [[{get:()=> 'https://evil.test'},403],[{get:()=> '__proto__'},403],[{method:'GET'},405],[{body:{v:1,url:'PRIVATE'}},400],[{body:{v:2}},400],[{rawBody:Buffer.alloc(33)},400]]){
    const r=response();await collect(request(overrides),r);assert.equal(r.statusCode,status);
  }
  assert.equal(calls.length,2);
  const r=response();await collect(request({method:'OPTIONS'}),r);assert.equal(r.statusCode,204);assert.equal(calls.length,2);
});
test('collector bounds write volume and never reports success after a failed durable write',async()=>{
  let count=0;const collect=createCollector({count:async()=>{count++;}},{limit:2,clock:()=>0});
  for(const status of [204,204,429]){const r=response();await collect(request(),r);assert.equal(r.statusCode,status);}assert.equal(count,2);
  const r=response();await createCollector({count:async()=>{throw new Error('PRIVATE');}})(request(),r);assert.equal(r.statusCode,503);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
