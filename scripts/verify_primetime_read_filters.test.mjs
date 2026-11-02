import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('owner filtering preserves hidden selections through save and clears on sign-out', async () => {
  const elements = new Map(), events = new Map(), sent = [];
  function node(id = '') { return { id, children: [], handlers: new Map(), options: [], value: '', checked: false, hidden: id === 'appShell', dataset: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(e,f){this.handlers.set(e,f)}, append(...items){this.children.push(...items)}, replaceChildren(...items){this.children=items}, querySelectorAll(selector){ if(this.id !== 'readPermissions') return []; if(selector==='label') return this.children; if(selector==='input:checked') return this.children.map(x=>x.children[0]).filter(x=>x.checked); return [] }, querySelector(){return this.children[0]}, closest(){return {}}, reset(){}, focus(){}, setAttribute(){}, get textContent(){return this.text ?? this.children.map(x=>x.textContent || '').join('')}, set textContent(x){this.text=x} }; }
  const el = id => { if(!elements.has(id)) elements.set(id,node(id)); return elements.get(id) };
  const settings = { revision: 1, officeId: '7', officeTimezone: 'America/Chicago', policyReference: 'synthetic', enabledReads: ['SearchPatients','SearchCaregivers'] };
  const document = {getElementById:el, querySelectorAll:()=>[], createElement:()=>node(), createTextNode:text=>({textContent:text}), addEventListener:(e,f)=>events.set(e,f)};
  const window = {primetimeDataMode:{isLive:()=>true},async primetimeApiFetch(path, options){sent.push({path,body:options?.body}); return {ok:true,json:async()=>({ok:true,settings,dataApproved:false,supportedReads:['SearchPatients','SearchCaregivers','GetOffices']})}}};
  const isolatedMode = window.primetimeDataMode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/data-source.js', import.meta.url), 'utf8'), { document, window, Event });
  window.primetimeDataMode = isolatedMode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/workspace.js',import.meta.url),'utf8'),{document,window,console});
  events.get('primetime-ready')(); await new Promise(r=>setImmediate(r));
  el('readPermissionSearch').value='PATIENT'; el('readPermissionSearch').handlers.get('input')();
  assert.deepEqual(el('readPermissions').children.map(x=>x.hidden),[false,true,true]);
  assert.match(el('readPermissionCount').textContent,/1 of 3 reads shown; 2 selected/);
  assert.equal(sent.length,1,'filtering must not send any request');
  el('ownerForm').handlers.get('submit')({preventDefault(){}}); await new Promise(r=>setImmediate(r));
  assert.deepEqual(JSON.parse(sent[1].body).enabledReads,['SearchPatients','SearchCaregivers']);
  el('readPermissionSearch').value=''; el('readPermissionSelectedOnly').checked=true; el('readPermissionSelectedOnly').handlers.get('change')();
  assert.deepEqual(el('readPermissions').children.map(x=>x.hidden),[false,false,true]);
  el('readPermissionSearch').value='no match'; el('readPermissionSearch').handlers.get('input')();
  assert.match(el('readPermissionCount').textContent,/0 of 3 reads shown; 2 selected/);
  events.get('primetime-signed-out')();
  assert.equal(el('readPermissions').children.length,0); assert.equal(el('readPermissionSearch').value,''); assert.equal(el('readPermissionSelectedOnly').checked,false);
});

function carePlanFixture() {
  const elements = new Map(), events = new Map(), sent = [];
  function node(id = '') { const label = { hidden: false }; return { id, children: [], handlers: new Map(), options: [], value: '', checked: false, hidden: id === 'appShell', dataset: {}, classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(e,f){this.handlers.set(e,f)}, append(...items){this.children.push(...items)}, replaceChildren(...items){this.text=undefined;this.children=items}, querySelectorAll(selector){if(this.id!=='readPermissions')return [];if(selector==='label')return this.children;if(selector==='input:checked')return this.children.map(x=>x.children[0]).filter(x=>x.checked);return []},querySelector(){return this.children[0]},closest(){return label},reset(){},focus(){},setAttribute(){},
    get textContent(){return this.text??this.children.map(x=>x.textContent||'').join(' ')},set textContent(value){this.text=value} }; }
  const el=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id)};
  const settings={revision:1,officeId:'9',enabledReads:['SearchPatientPOC','GetPatientPOCInfo']};
  const state={live:true,deferred:null,truncated:false};
  const document={getElementById:el,querySelectorAll:()=>[],createElement:()=>node(),createTextNode:text=>({textContent:text}),addEventListener:(e,f)=>events.set(e,f)};
  const window={primetimeDataMode:{isLive:()=>state.live},async primetimeApiFetch(path,options){
    sent.push({path,body:options?.body});
    if(path.endsWith('/read')){if(state.deferred)await state.deferred;const input=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,operation:input.operation,source:'hhaexchange',fetchedAt:'2026-11-02T20:00:00.000Z',truncated:state.truncated,records:input.operation==='SearchPatientPOC'?[{ID:'7'}]:[{ID:'7',SourceElement:'POCInfo (plan header)',TaskListState:'Not supplied / unknown',Interpretation:'Plan/task definitions only.'}]})};}
    return {ok:true,json:async()=>({ok:true,settings,dataApproved:true,supportedReads:settings.enabledReads,readInputs:{SearchPatientPOC:['patientId','officeId'],GetPatientPOCInfo:['patientId','officeId','id']}})};
  }};
  const mode=window.primetimeDataMode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/data-source.js',import.meta.url),'utf8'),{document,window,Event});window.primetimeDataMode=mode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/workspace.js',import.meta.url),'utf8'),{document,window,console});events.get('primetime-ready')();
  return {el,events,sent,state,submit(){el('readForm').handlers.get('submit')({preventDefault(){}})}};
}
const settleCarePlan=()=>new Promise(resolve=>setImmediate(resolve));

test('care-plan reader uses server metadata for patient/office fields and keeps exact context when selecting detail',async()=>{
  const f=carePlanFixture();await settleCarePlan();f.el('readOperation').value='SearchPatientPOC';f.el('readOperation').handlers.get('change')();
  f.el('readPatient').value='8';f.el('readOffice').value='9';f.submit();await settleCarePlan();
  assert.deepEqual(JSON.parse(f.sent.at(-1).body),{operation:'SearchPatientPOC',patientId:'8',officeId:'9'});
  const card=f.el('readResults').children.find(x=>x.children.some(c=>c.textContent==='Inspect care plan tasks'));
  await card.children.find(c=>c.textContent==='Inspect care plan tasks').handlers.get('click')();
  assert.equal(f.el('readOperation').value,'GetPatientPOCInfo');assert.equal(f.el('readPatient').value,'8');assert.equal(f.el('readOffice').value,'9');assert.equal(f.el('readId').value,'7');
  f.state.truncated=true;f.submit();await settleCarePlan();assert.deepEqual(JSON.parse(f.sent.at(-1).body),{operation:'GetPatientPOCInfo',patientId:'8',officeId:'9',id:'7'});
  assert.match(f.el('readResults').textContent,/Plan\/task definitions only/);assert.match(f.el('readResults').textContent,/Not supplied \/ unknown/);
  assert.match(f.el('readResults').textContent,/Partial source result; row or task limits apply/);assert.doesNotMatch(f.el('readResults').textContent,/first 200 rows/);
});

test('late care-plan replies are discarded when patient context changes, Demo starts or the user signs out',async()=>{
  for(const mode of ['patient','demo','sign-out']){
    const f=carePlanFixture();await settleCarePlan();f.el('readOperation').value='SearchPatientPOC';f.el('readPatient').value='8';f.el('readOffice').value='9';
    let release;f.state.deferred=new Promise(resolve=>release=resolve);f.submit();await settleCarePlan();
    if(mode==='patient'){f.el('readPatient').value='88';f.el('readPatient').handlers.get('input')();}
    else {f.state.live=false;f.events.get(mode==='demo'?'primetime-data-mode-changed':'primetime-signed-out')();}
    release();await settleCarePlan();assert.doesNotMatch(f.el('readResults').textContent,/Inspect care plan tasks|Fetched/);
  }
});
