import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../source/primetime/maintenance-search.js',import.meta.url),'utf8');
const tick=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(){let active=true,live=true,clock=Date.parse('2026-11-05T18:00:00Z'),nextTimer=1;const timers=new Map(),ids=new Map(),calls=[],results=[];
 class Element extends EventTarget{children=[];value='';textContent='';disabled=false;dataset={};hidden=false;classList={contains:()=>active};append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}querySelectorAll(){return[];}}
 const names=['maintenanceWorkspace','maintenanceRefresh','maintenanceDate','maintenanceDateTo','maintenanceFindPatient','maintenanceFindCaregiver','maintenanceLoadPayers','maintenanceSearchSource','maintenanceContinueSearch','maintenanceResetSearch','maintenanceSearchStatus','maintenancePatientMore','maintenanceCaregiverMore','maintenancePayer','maintenanceSearchKind','maintenancePatientFields','maintenanceCaregiverFields','maintenancePayerFilters','maintenanceReferences','maintenanceReferenceCatalog','maintenanceReferenceStatus','maintenanceReferenceRows','maintenanceReadReferences'];
 for(const kind of ['Patient','Caregiver'])for(const field of ['First','Last','Code','Choice'])names.push('maintenance'+kind+field);
 for(const id of names)ids.set(id,new Element());ids.get('maintenanceDate').value='2026-11-05';ids.get('maintenanceSearchKind').value='all';ids.get('maintenanceReferenceCatalog').value='schedule';
 const document=new EventTarget();document.hidden=false;document.getElementById=id=>ids.get(id);document.createElement=()=>new Element();document.addEventListener('primetime-maintenance-results',event=>results.push(event.detail));
 let handler=async(path,options)=>{
  if(path.endsWith('/people'))return{ok:true,kind:JSON.parse(options.body).kind,items:[{id:'25',firstName:'Synthetic',lastName:'Person',code:'TEST'}],nextOffset:null,truncated:false};
  if(path.endsWith('/contracts'))return{ok:true,items:[{id:'75',name:'Synthetic payer'}],truncated:false};
  return{ok:true,source:'hhaexchange',mode:'live',scope:{officeId:'123',from:'2026-10-23',to:'2026-11-05'},items:[],unavailable:[],checkedThrough:0,totalIds:0,nextCursor:null,retryAfterSeconds:null};
 };
 class ClockDate extends Date{static now(){return clock;}}
 vm.runInNewContext(source,{document,window:{primetimeDataMode:{isActive:()=>active,isLive:()=>live},primetimeApiFetch:async(...args)=>{calls.push(args);const value=await handler(...args);return value instanceof Response?value:new Response(JSON.stringify(value),{status:value.status||200});}},AbortController,CustomEvent,Event,Date:ClockDate,Map,Set,setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{at:clock+ms,fn});return id;},clearTimeout:id=>timers.delete(id)});
 const event=(id,name='click')=>ids.get(id).dispatchEvent(new Event(name));
 return{ids,calls,results,document,event,handler(value){handler=value;},async advance(ms){clock+=ms;for(const[id,timer]of [...timers])if(timer.at<=clock){timers.delete(id);timer.fn();}await tick();},off(){active=false;document.dispatchEvent(new Event('primetime-signed-out'));}};
}
test('native range search supports fourteen days and sends an inclusive from/to request',async()=>{
 const f=fixture();f.ids.get('maintenanceDate').value='2026-10-23';f.event('maintenanceSearchSource');await tick();assert.deepEqual(JSON.parse(f.calls[0][1].body),{from:'2026-10-23',to:'2026-11-05'});assert.equal(f.results.length,1);
});
test('separate first/last/code lookup fields resolve a profile before filtering visits',async()=>{
 const f=fixture();f.ids.get('maintenanceSearchKind').value='patient';f.event('maintenanceSearchKind','change');f.ids.get('maintenancePatientFirst').value='Synthetic';f.ids.get('maintenancePatientLast').value='Person';f.ids.get('maintenancePatientCode').value='TEST';f.event('maintenanceFindPatient');await tick();
 assert.deepEqual(JSON.parse(f.calls[0][1].body),{kind:'patient',firstName:'Synthetic',lastName:'Person',code:'TEST',offset:0});assert.equal(f.ids.get('maintenancePatientChoice').value,'25');
 f.ids.get('maintenanceDate').value='2026-10-23';f.event('maintenanceSearchSource');await tick();assert.equal(JSON.parse(f.calls[1][1].body).patientId,'25');
 f.event('maintenancePatientLast','input');assert.equal(f.ids.get('maintenancePatientChoice').children.length,1);
});
test('ambiguous name searches require a source identity choice; payer selection passes the real contract ID',async()=>{
 const f=fixture();f.ids.get('maintenanceSearchKind').value='patient';f.event('maintenanceSearchKind','change');f.ids.get('maintenancePatientFirst').value='Synthetic';f.event('maintenanceSearchSource');await tick();assert.equal(f.calls.length,0);assert.match(f.ids.get('maintenanceSearchStatus').textContent,/select the matching patient/);
 f.ids.get('maintenanceSearchKind').value='all';f.event('maintenanceSearchKind','change');f.event('maintenanceLoadPayers');await tick();f.ids.get('maintenancePayer').value='75';f.ids.get('maintenanceDate').value='2026-10-23';f.event('maintenanceSearchSource');await tick();assert.equal(JSON.parse(f.calls[1][1].body).contractId,'75');
});
test('a deferred page retains its cursor, disables premature reads and resumes after the source delay',async()=>{
 const f=fixture();f.ids.get('maintenanceDate').value='2026-10-23';f.handler(async()=>({ok:true,source:'hhaexchange',mode:'live',scope:{officeId:'123',from:'2026-10-23',to:'2026-11-05'},items:[],unavailable:[],checkedThrough:1,totalIds:3,nextCursor:'synthetic-cursor',retryAfterSeconds:25}));
 f.event('maintenanceSearchSource');await tick();assert.equal(f.ids.get('maintenanceContinueSearch').disabled,true);await f.advance(25000);assert.equal(f.ids.get('maintenanceContinueSearch').disabled,false);
 f.event('maintenanceContinueSearch');await tick();assert.equal(JSON.parse(f.calls[1][1].body).cursor,'synthetic-cursor');f.off();
});
test('timeouts unlock search controls, and late private results cannot cross a signed-out context',async()=>{
 const f=fixture();f.ids.get('maintenanceDate').value='2026-10-23';let finish;f.handler(()=>new Promise(resolve=>{finish=resolve;}));f.event('maintenanceSearchSource');await tick();await f.advance(45000);
 assert.equal(f.ids.get('maintenanceSearchSource').disabled,false);assert.match(f.ids.get('maintenanceSearchStatus').textContent,/timed out/);f.off();finish({ok:true,source:'hhaexchange',scope:{from:'2026-10-23',to:'2026-11-05'},items:[],checkedThrough:0,totalIds:0,nextCursor:null});await tick();assert.equal(f.results.length,0);
});
test('invalid or overlong ranges do not call HHA, and name fields clear on sign out',async()=>{
 const f=fixture();f.ids.get('maintenanceDate').value='2025-01-01';f.event('maintenanceSearchSource');await tick();assert.equal(f.calls.length,0);assert.match(f.ids.get('maintenanceSearchStatus').textContent,/366/);
 f.ids.get('maintenanceCaregiverLast').value='Private synthetic';f.off();assert.equal(f.ids.get('maintenanceCaregiverLast').value,'');
});
test('refresh cancels an in-flight range and ignores its late result before reading the range again',async()=>{
 const f=fixture();f.ids.get('maintenanceDate').value='2026-10-23';let finish;let calls=0;
 const value={ok:true,source:'hhaexchange',mode:'live',scope:{officeId:'123',from:'2026-10-23',to:'2026-11-05'},items:[],checkedThrough:0,totalIds:0,nextCursor:null};
 f.handler(()=>++calls===1?new Promise(resolve=>{finish=resolve;}):Promise.resolve(value));f.event('maintenanceSearchSource');await tick();const detail={handled:false};f.document.dispatchEvent(new CustomEvent('primetime-maintenance-refresh',{detail}));await tick();assert.equal(detail.handled,true);assert.equal(f.results.length,1);finish(value);await tick();assert.equal(f.results.length,1);assert.equal(f.calls.length,2);f.off();
});
test('one search method is visible at a time and hidden person filters cannot constrain all-visit searches',async()=>{
 const f=fixture();assert.equal(f.ids.get('maintenancePatientFields').hidden,true);assert.equal(f.ids.get('maintenanceCaregiverFields').hidden,true);
 f.ids.get('maintenancePatientChoice').value='25';f.ids.get('maintenancePatientFirst').value='Synthetic';f.ids.get('maintenanceDate').value='2026-10-23';f.event('maintenanceSearchSource');await tick();assert.equal(JSON.parse(f.calls[0][1].body).patientId,undefined);
 f.ids.get('maintenanceSearchKind').value='patient';f.event('maintenanceSearchKind','change');assert.equal(f.ids.get('maintenancePatientFields').hidden,false);assert.equal(f.ids.get('maintenanceCaregiverFields').hidden,true);assert.equal(f.ids.get('maintenancePatientChoice').value,'');f.event('maintenanceSearchSource');await tick();assert.equal(f.calls.length,1);
 f.ids.get('maintenancePatientLast').value='Synthetic';f.ids.get('maintenanceSearchKind').value='caregiver';f.event('maintenanceSearchKind','change');assert.equal(f.ids.get('maintenancePatientFields').hidden,true);assert.equal(f.ids.get('maintenanceCaregiverFields').hidden,false);assert.equal(f.ids.get('maintenancePatientLast').value,'');
});
test('agency reference lists are shown as references, clear on a catalog change and never become a confirmation',async()=>{
 const f=fixture();f.handler(async()=>({ok:true,catalog:'schedule',scope:'agency_reference',supportsConfirmation:false,operation:'GetScheduleBillInfoEditReasons',fetchedAt:'2026-11-05T18:00:00Z',truncated:false,items:[{id:'51',label:'Synthetic source code',description:'Synthetic detail',status:'Raw status',noteRequired:'Y',minimumNoteCharacters:'10'}]}));
 f.event('maintenanceReadReferences');await tick();assert.equal(f.ids.get('maintenanceReferenceRows').children.length,1);assert.match(f.ids.get('maintenanceReferenceStatus').textContent,/Reference only; not approved/);assert.equal(f.calls[0][0],'/primetime/api/maintenance/reference-codes?catalog=schedule');f.event('maintenanceReferenceCatalog','change');assert.equal(f.ids.get('maintenanceReferenceRows').children.length,0);f.off();assert.equal(f.ids.get('maintenanceReferences').open,false);
});
test('the cached-visit shortcut reads a fresh patient/day scope and clears unrelated hidden filters',async()=>{
 const f=fixture();f.ids.set('maintenanceFilter',{value:'cases'});f.ids.set('maintenanceSearch',{value:'another visit'});f.ids.get('maintenancePayer').value='75';f.ids.get('maintenanceCaregiverChoice').value='35';f.handler(async(_path,options)=>{const body=JSON.parse(options.body);return{ok:true,source:'hhaexchange',mode:'live',scope:{officeId:'123',from:body.from,to:body.to},items:[],unavailable:[],checkedThrough:0,totalIds:0,nextCursor:null};});
 f.document.dispatchEvent(new CustomEvent('primetime-maintenance-read-patient-day',{detail:{kind:'patient',id:'25',firstName:'Synthetic',lastName:'Person',date:'2026-10-23'}}));await tick();assert.deepEqual(JSON.parse(f.calls[0][1].body),{from:'2026-10-23',to:'2026-10-23',patientId:'25'});assert.equal(f.ids.get('maintenanceSearchKind').value,'patient');assert.equal(f.ids.get('maintenancePayer').value,'');assert.equal(f.ids.get('maintenanceFilter').value,'all');assert.equal(f.ids.get('maintenanceSearch').value,'');assert.equal(f.results.length,1);
});
