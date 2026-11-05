import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/assets/analytics.js',import.meta.url),'utf8');
function run(overrides={}){
 const listeners={},scripts=[],requests=[];
 const context={URL,Date,Element:class{},location:{hostname:'pthhs.net',origin:'https://pthhs.net',pathname:'/home-care-services',href:'https://pthhs.net/home-care-services?email=private@example.test#patient'},navigator:{},window:{},document:{title:'Public services',referrer:'https://search.example.test/?q=private@example.test',querySelector:q=>q.includes('canonical')?{href:'https://pthhs.net/home-care-services'}:null,createElement:()=>({}),head:{append:s=>scripts.push(s)},addEventListener:(name,fn)=>listeners[name]=fn},...overrides};
 context.fetch=(...args)=>{requests.push(args);return Promise.resolve({ok:true});};
 vm.runInNewContext(source,context);return{...context,scripts,listeners,requests};
}
test('public tracking strips URL query, fragment and referrer search and disables advertising',()=>{
 const c=run();assert.equal(c.scripts.length,1);const commands=c.window.dataLayer.map(x=>Array.from(x));
 const config=commands.find(x=>x[0]==='config')[2];assert.equal(config.page_location,'https://pthhs.net/home-care-services');assert.equal(config.page_referrer,'https://search.example.test/');assert.equal(config.allow_google_signals,false);assert.equal(config.allow_ad_personalization_signals,false);
 assert.equal(JSON.stringify(commands).includes('private@example.test'),false);assert.equal(commands[0][2].ad_storage,'denied');
});
test('internal operations, unknown hosts, privacy signals and noindex pages never load a tag',()=>{
 for(const overrides of [{location:{hostname:'pthhs.net',pathname:'/primetime'}},{location:{hostname:'preview.web.app',pathname:'/'}},{navigator:{globalPrivacyControl:true}},{navigator:{doNotTrack:'1'}},{document:{querySelector:()=>({content:'noindex,nofollow'})}}]){const c=run(overrides);assert.equal(c.scripts.length,0);assert.equal(c.requests.length,0);}
});

test('first-party counter sends exactly one fixed payload per document without referrer, cookies, URL or identity',()=>{
  const c=run();vm.runInNewContext(source,c);assert.equal(c.requests.length,1);
  const [url,options]=c.requests[0];assert.equal(url,'https://pthhs.net/api/public-page-view');assert.equal(options.body,'{"v":1}');
  assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.keepalive,true);
  assert.doesNotMatch(JSON.stringify(options),/private|email|phone|patient|location|clientId/);
});
test('contact tracking sends intent without destination or link text',()=>{
 const c=run();const target=new c.Element();target.closest=()=>({getAttribute:()=> 'mailto:private@example.test?body=private-health-details'});
 c.listeners.click({target});const last=c.window.dataLayer.at(-1);assert.equal(last[1],'email_click');assert.equal(JSON.stringify(Array.from(last)).includes('private'),false);
});

test('presence shares a temporary browser token across tabs, stops hidden heartbeats and never inflates page views',()=>{
  const storage=new Map(),intervals=[],handlers={};let id=0;
  const overrides=()=>({crypto:{randomUUID:()=>String(++id).padStart(8,'0')+'-1111-4111-8111-111111111111'},setInterval:(fn,ms)=>intervals.push({fn,ms}),
    window:{localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},addEventListener:(name,fn)=>handlers[name]=fn}});
  const first=run(overrides()),second=run(overrides());
  const payloads=c=>c.requests.map(([,options])=>JSON.parse(options.body));
  assert.equal(payloads(first)[1].session,payloads(second)[1].session);assert.notEqual(payloads(first)[1].tab,payloads(second)[1].tab);
  assert.equal(intervals[0].ms,15000);intervals[0].fn();assert.equal(payloads(first).filter(p=>p.v===1).length,1);
  first.document.visibilityState='hidden';first.listeners.visibilitychange();assert.equal(payloads(first).at(-1).active,false);
  const before=first.requests.length;intervals[0].fn();assert.equal(first.requests.length,before);
  assert.doesNotMatch(JSON.stringify(first.requests),/private@example|private-health|page_location|page_title/);
  assert.ok(JSON.parse([...storage.values()][0]).expiresAt>Date.now());
});
