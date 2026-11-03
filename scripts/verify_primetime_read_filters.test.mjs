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

function carePlanFixture(documents = false, visits = false) {
  const elements = new Map(), events = new Map(), sent = [];
  function node(id = '') { const label = { hidden: false }; return { id, children: [], handlers: new Map(), options: [], value: '', checked: false, hidden: id === 'appShell', dataset: {}, classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(e,f){this.handlers.set(e,f)}, append(...items){this.children.push(...items)}, prepend(...items){this.children.unshift(...items)}, remove(){this.removed=true}, replaceChildren(...items){this.text=undefined;this.children=items}, querySelectorAll(selector){if(this.id!=='readPermissions')return [];if(selector==='label')return this.children;if(selector==='input:checked')return this.children.map(x=>x.children[0]).filter(x=>x.checked);return []},querySelector(){return this.children[0]},closest(){return label},reset(){this.resets=(this.resets||0)+1},focus(){},setAttribute(){},
    get textContent(){return this.text??this.children.map(x=>x.textContent||'').join(' ')},set textContent(value){this.text=value} }; }
  const el=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id)};
  const settings={revision:1,officeId:'9',enabledReads:visits?['SearchVisitsV2','GetVisitInfoV3']:documents?['SearchPatientDocument','DownloadPatientDocument']:['SearchPatientPOC','GetPatientPOCInfo']};
  const state={live:true,deferred:null,truncated:false,dialogs:0,fetchedAt:'2026-11-02T20:00:00.000Z'};
  const document={getElementById:el,querySelectorAll:()=>[],createElement:()=>node(),createTextNode:text=>({textContent:text}),addEventListener:(e,f)=>events.set(e,f)};
  const window={primetimeDataMode:{isLive:()=>state.live},confirm(){state.dialogs++;return false},async primetimeApiFetch(path,options){
    sent.push({path,body:options?.body});
    if(path.endsWith('/visit-review')){
      if(state.reviewDeferred)await state.reviewDeferred;
      if(state.reviewError)return {ok:false,status:429,json:async()=>({ok:false,error:'source_rate_limited',retryAfterSeconds:30})};
      return {ok:true,json:async()=>({ok:true,state:'source_unvalidated',visits:JSON.parse(options.body).visitIds.map(visitId=>({visitId,state:'source_unvalidated',fetchedAt:state.fetchedAt,flags:[],facts:{VisitStartTime:'synthetic start'}}))})};
    }
    if(path.endsWith('/read')){
      if(state.deferred)await state.deferred;const input=JSON.parse(options.body);
      const records=input.operation==='SearchVisitsV2'?Array.from({length:12},(_,i)=>({VisitID:String(101+i)})):input.operation==='SearchPatientPOC'?[{ID:'7'}]:input.operation==='SearchPatientDocument'?[{PatientDocID:'7',PatientID:'8',FileName:'synthetic.pdf'}]:input.operation==='DownloadPatientDocument'?[{PatientDocID:'7',FileName:'synthetic.pdf',FileSize:null}]:[{ID:'7',SourceElement:'POCInfo (plan header)',TaskListState:'Not supplied / unknown',Interpretation:'Plan/task definitions only.'}];
      return {ok:true,json:async()=>({ok:true,operation:input.operation,source:'hhaexchange',fetchedAt:state.fetchedAt,truncated:state.truncated,records,...(input.operation==='DownloadPatientDocument'?{attachment:{filename:'synthetic.pdf',byteLength:4,base64:'dGVzdA==',contentType:'application/octet-stream'}}:{})})};
    }
    return {ok:true,json:async()=>({ok:true,settings,dataApproved:true,supportedReads:settings.enabledReads,readInputs:{SearchVisitsV2:['officeId','date'],SearchPatientPOC:['patientId','officeId'],GetPatientPOCInfo:['patientId','officeId','id'],SearchPatientDocument:['patientId','officeId','documentTypeId','id','date'],DownloadPatientDocument:['patientId','officeId','id']}})};
  }};
  const mode=window.primetimeDataMode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/data-source.js',import.meta.url),'utf8'),{document,window,Event});window.primetimeDataMode=mode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/workspace.js',import.meta.url),'utf8'),{document,window,console});events.get('primetime-ready')();
  return {el,events,sent,state,submit(){el('readForm').handlers.get('submit')({preventDefault(){}})}};
}
const settleCarePlan=()=>new Promise(resolve=>setImmediate(resolve));

async function visitReviewFixture(){
  const f=carePlanFixture(false,true);await settleCarePlan();
  f.el('readOperation').value='SearchVisitsV2';f.el('readOperation').handlers.get('change')();
  f.el('readOffice').value='9';f.el('readDate').value='2026-11-03';f.submit();await settleCarePlan();
  f.review=f.el('readResults').children.find(x=>x.textContent==='Inspect next 10 visits for EVV evidence');assert.ok(f.review);
  return f;
}

test('advanced visit review ignores obsolete controls and late successes after source filters change',async()=>{
  for(const field of ['readDate','readOffice','readPatient','operation']){
    const f=await visitReviewFixture();let release;f.state.reviewDeferred=new Promise(resolve=>release=resolve);
    f.review.handlers.get('click')();await settleCarePlan();
    if(field==='operation'){f.el('readOperation').value='GetVisitInfoV3';f.el('readOperation').handlers.get('change')();}
    else{f.el(field).value=field==='readDate'?'2026-11-04':'99';f.el(field).handlers.get('input')();}
    release();await settleCarePlan();
    assert.equal(f.el('readResults').children.length,0,field+' must not receive the old review');
    const count=f.sent.length;f.review.handlers.get('click')();await settleCarePlan();assert.equal(f.sent.length,count,'obsolete control must not request old visit IDs');
  }
});

test('advanced visit review suppresses obsolete failures while current quota errors remain retryable',async()=>{
  for(const stale of [false,true]){
    const f=await visitReviewFixture();let release;f.state.reviewDeferred=new Promise(resolve=>release=resolve);f.state.reviewError=true;
    f.review.handlers.get('click')();await settleCarePlan();
    if(stale){f.el('readDate').value='2026-11-04';f.el('readDate').handlers.get('input')();}
    release();await settleCarePlan();
    assert.equal(f.review.disabled,false,'failed action unlocks its button');
    if(stale)assert.doesNotMatch(f.el('workspaceMessage').textContent,/Retry in 30 seconds/);
    else{assert.match(f.el('workspaceMessage').textContent,/Retry in 30 seconds/);f.state.reviewError=false;f.state.reviewDeferred=null;f.review.handlers.get('click')();await settleCarePlan();assert.deepEqual(JSON.parse(f.sent.at(-1).body).visitIds,Array.from({length:10},(_,i)=>String(101+i)));}
  }
});

test('advanced visit review cannot overwrite a newer discovery or return after Demo or sign-out',async()=>{
  for(const context of ['new-discovery','demo','sign-out']){
    const f=await visitReviewFixture();let release;f.state.reviewDeferred=new Promise(resolve=>release=resolve);
    f.review.handlers.get('click')();await settleCarePlan();
    if(context==='new-discovery'){f.el('readDate').value='2026-11-04';f.submit();await settleCarePlan();}
    else{f.state.live=false;f.events.get(context==='demo'?'primetime-data-mode-changed':'primetime-signed-out')();}
    const before=f.el('readResults').textContent;release();await settleCarePlan();
    assert.equal(f.el('readResults').textContent,before,context+' must retain only current content');
    assert.doesNotMatch(f.el('readResults').textContent,/synthetic start/);
  }
});

test('advanced visit review keeps current batch order, raw fields and receipts without writing an investigation',async()=>{
  const f=await visitReviewFixture();f.review.handlers.get('click')();await settleCarePlan();
  assert.match(f.el('readResults').textContent,/synthetic start/);assert.match(f.el('readResults').textContent,/2026-11-02T20:00:00.000Z/);
  const queue=f.el('readResults').children[0],investigate=queue.children[1].children.find(x=>x.textContent==='Investigate visit 101');assert.ok(investigate);
  f.review.handlers.get('click')();await settleCarePlan();assert.deepEqual(JSON.parse(f.sent.at(-1).body),{visitIds:['111','112']});assert.equal(f.review.removed,true);
  assert.equal(f.sent.some(x=>x.path.endsWith('/investigations')),false);
  f.el('readDate').value='2026-11-04';f.el('readDate').handlers.get('input')();const resets=f.el('investigationForm').resets||0;
  investigate.handlers.get('click')();await settleCarePlan();assert.equal(f.el('investigationForm').resets||0,resets,'obsolete visit action cannot retarget the draft');
});

test('raw read receipts preserve exact offsets and milliseconds through repeated local times',async()=>{
  const f=carePlanFixture(true);await settleCarePlan();f.el('readOperation').value='SearchPatientDocument';f.el('readPatient').value='8';f.el('readOffice').value='9';
  for(const receipt of ['2026-11-01T01:30:00.123-05:00','2026-11-01T01:30:00.123-06:00','2026-11-03T19:00:00.456Z']){
    f.state.fetchedAt=receipt;f.submit();await settleCarePlan();
    assert.ok(f.el('readResults').textContent.includes(`Fetched ${receipt} from HHA.`));
    assert.match(f.el('readResults').textContent,/synthetic\.pdf/);
  }
  assert.equal(f.sent.filter(x=>x.path.endsWith('/read')).length,3);
});

test('raw read receipts with missing or ambiguous instants remain unavailable without discarding source fields',async()=>{
  const f=carePlanFixture(true);await settleCarePlan();f.el('readOperation').value='SearchPatientDocument';f.el('readPatient').value='8';f.el('readOffice').value='9';f.state.truncated=true;
  for(const receipt of [undefined,'','2026-11-01T01:30:00','not a timestamp']){
    f.state.fetchedAt=receipt;f.submit();await settleCarePlan();
    assert.match(f.el('readResults').textContent,/Fetched Unavailable from HHA\./);
    assert.match(f.el('readResults').textContent,/synthetic\.pdf/);
    assert.match(f.el('readResults').textContent,/Partial source result; row or task limits apply/);
    assert.doesNotMatch(f.el('readResults').textContent,/Invalid Date/);
  }
  assert.equal(f.sent.filter(x=>x.path.endsWith('/read')).length,4);
});

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

test('patient file selection retains exact subject/office, requests bytes explicitly and never saves automatically',async()=>{
  const f=carePlanFixture(true);await settleCarePlan();f.el('readOperation').value='SearchPatientDocument';f.el('readPatient').value='8';f.el('readOffice').value='9';f.submit();await settleCarePlan();
  const card=f.el('readResults').children.find(x=>x.children.some(c=>c.textContent==='Read attachment'));assert.ok(card);
  const count=f.sent.length;await card.children.find(c=>c.textContent==='Read attachment').handlers.get('click')();assert.equal(f.sent.length,count);
  assert.equal(f.el('readOperation').value,'DownloadPatientDocument');assert.equal(f.el('readId').value,'7');assert.equal(f.el('readPatient').value,'8');assert.equal(f.el('readOffice').value,'9');
  f.submit();await settleCarePlan();assert.deepEqual(JSON.parse(f.sent.at(-1).body),{operation:'DownloadPatientDocument',patientId:'8',officeId:'9',id:'7'});
  assert.match(f.el('readResults').textContent,/Attachment ready: synthetic.pdf, 4 bytes/);assert.doesNotMatch(f.el('readResults').textContent,/dGVzdA==/);assert.equal(f.state.dialogs,0);
  const save=f.el('readResults').children.find(x=>x.textContent==='Save attachment to this device');assert.ok(save);await save.handlers.get('click')();assert.equal(f.state.dialogs,1);
});

test('late patient file bytes cannot repopulate results after subject, office, document, Demo or sign-out changes',async()=>{
  for(const mode of ['readPatient','readOffice','readId','demo','sign-out']){
    const f=carePlanFixture(true);await settleCarePlan();f.el('readOperation').value='DownloadPatientDocument';f.el('readPatient').value='8';f.el('readOffice').value='9';f.el('readId').value='7';
    let release;f.state.deferred=new Promise(resolve=>release=resolve);f.submit();await settleCarePlan();
    if(mode.startsWith('read')){f.el(mode).value='99';f.el(mode).handlers.get('input')();}else{f.state.live=false;f.events.get(mode==='demo'?'primetime-data-mode-changed':'primetime-signed-out')();}
    release();await settleCarePlan();assert.doesNotMatch(f.el('readResults').textContent,/Attachment ready|Save attachment|synthetic.pdf/);assert.equal(f.state.dialogs,0);
  }
});
