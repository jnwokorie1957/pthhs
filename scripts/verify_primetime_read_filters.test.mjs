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
  const window = {async primetimeApiFetch(path, options){sent.push({path,body:options?.body}); return {ok:true,json:async()=>({ok:true,settings,dataApproved:false,supportedReads:['SearchPatients','SearchCaregivers','GetOffices']})}}};
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
