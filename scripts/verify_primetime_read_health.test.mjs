import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const code = readFileSync(process.env.PRIMETIME_READ_HEALTH_BASELINE || new URL('../public/primetime/workspace.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const rows = [['SearchBilledVisits', 'Successful empty response · 2026-11-02T19:00:00.000Z', '2026-11-02T19:00:00.000Z', '0 · no truncation flag'], ['GetVisitInfoV3', 'No current receipt', 'Not recorded', 'Unknown']];
function fixture() {
  const elements = new Map(), events = new Map(), sent = [];
  function node(id = '', tag = '') { return { id, tag, children: [], handlers: new Map(), options: [], value: '', checked: false, hidden: id === 'appShell', dataset: {}, classList: {add(){},remove(){},toggle(){}},
    addEventListener(e,f){this.handlers.set(e,f)}, append(...items){this.children.push(...items)}, replaceChildren(...items){this.text=undefined;this.children=items},
    querySelectorAll(selector){if(this.id!=='readPermissions')return [];if(selector==='label')return this.children;if(selector==='input:checked')return this.children.map(x=>x.children[0]).filter(x=>x.checked);return []}, querySelector(){return this.children[0]}, closest(){return {}}, reset(){}, focus(){}, setAttribute(){},
    get textContent(){return this.text??this.children.map(x=>x.textContent||'').join(' ')},set textContent(value){this.text=value} }; }
  const el=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id)};
  const settings={revision:8,officeId:'12',officeTimezone:'America/Chicago',policyReference:'synthetic',enabledReads:['SearchBilledVisits','GetVisitInfoV3']};
  const state={live:true,reply:{officeId:'12',settingsRevision:8,rows:structuredClone(rows),sources:[{PrivateField:'private-synthetic-marker'}]},deferred:null};
  const document={getElementById:el,querySelectorAll:()=>[],createElement:tag=>node('',tag),createTextNode:text=>({textContent:text}),addEventListener:(e,f)=>events.set(e,f)};
  const window={primetimeDataMode:{isLive:()=>state.live},async primetimeApiFetch(path){
    sent.push(path);
    if(path.endsWith('/read-health')){if(state.deferred)await state.deferred;return {ok:true,json:async()=>({ok:true,...state.reply})};}
    return {ok:true,json:async()=>({ok:true,settings,dataApproved:true,supportedReads:settings.enabledReads,readInputs:{}})};
  }};
  const mode=window.primetimeDataMode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/data-source.js',import.meta.url),'utf8'),{document,window,Event});
  window.primetimeDataMode=mode;
  vm.runInNewContext(code,{document,window,console});
  events.get('primetime-ready')();
  const host=el('dashboardReadHealth');
  return {state,events,sent,host,load(){const button=host.children.find(x=>x.textContent==='Load read receipts');assert.ok(button,'protected receipt action must be rendered');return button.handlers.get('click')()}};
}
test('read receipts render honest empty and unobserved states without extra HHA queries or source fields',async()=>{
  const f=fixture();await tick();await f.load();
  assert.match(f.host.textContent,/Successful empty response/);assert.match(f.host.textContent,/0 · no truncation flag/);assert.match(f.host.textContent,/No current receipt/);
  assert.match(f.host.textContent,/field meaning and office coverage remain unvalidated/);
  assert.doesNotMatch(f.host.textContent,/private-synthetic-marker/);
  assert.deepEqual(f.sent,['/primetime/api/workspace/settings','/primetime/api/workspace/read-health']);
});
test('receipt lists reject foreign preferences, duplicate methods and malformed cells instead of retaining old facts',async()=>{
  for(const corrupt of [data=>data.officeId='99',data=>data.settingsRevision=9,data=>data.rows[1]=data.rows[0],data=>data.rows[0][2]={private:'private-synthetic-marker'},data=>data.rows[0][2]='x'.repeat(181)]){
    const f=fixture();await tick();await f.load();corrupt(f.state.reply);await f.load();
    assert.match(f.host.textContent,/could not be verified/);assert.doesNotMatch(f.host.textContent,/Successful empty response|private-synthetic-marker/);
  }
});
test('late receipt responses cannot repopulate the panel after Demo or sign-out',async()=>{
  for(const event of ['primetime-data-mode-changed','primetime-signed-out']){
    const f=fixture();await tick();let release;f.state.deferred=new Promise(resolve=>release=resolve);
    const pending=f.load();await tick();f.state.live=false;f.events.get(event)();release();await pending;await tick();
    assert.doesNotMatch(f.host.textContent,/Successful empty response|2026-11-02T19:00:00/);
  }
});
