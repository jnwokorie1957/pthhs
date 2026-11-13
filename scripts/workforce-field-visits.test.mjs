import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FIELD_VISITS_SCRIPT || new URL('../public/assets/workforce-field-visits.js',import.meta.url),'utf8');
const importExpression="await import('/assets/workforce-authorization-extract.js')";
assert.equal(source.split(importExpression).length,2);
// Stub the extractor module boundary; exercise the remaining served controller unchanged.
const runtime=source.replace(importExpression,'await importExtractor()');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const walk=e=>[e,...e.children.flatMap(walk)];
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.hidden=false;this.checked=false;this.disabled=false;this._text='';}
 append(...items){for(const child of items){child.parent=this;this.children.push(child);}}
 prepend(...items){for(const child of items)child.parent=this;this.children.unshift(...items);}
 replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(e=>e.textContent).join(' ');}
 set value(value){this._value=value;}
 get value(){return this._value??(this.tagName==='SELECT'?this.children[0]?.value:'')??'';}
 get firstChild(){return this.children[0];}
 get childElementCount(){return this.children.length;}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelectorAll(selector){return walk(this).slice(1).filter(e=>selector.split(',').some(s=>s.startsWith('#')?e.id===s.slice(1):s==='input:checked'?e.tagName==='INPUT'&&e.checked:s.startsWith('[value=')?e.value===s.slice(7,-1):e.tagName===s.toUpperCase()));}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 reportValidity(){return true;}
 get elements(){return {namedItem:name=>walk(this).find(e=>e.name===name)};}
 scrollIntoView(){}
}
const templates={orientation:{title:'Synthetic orientation',description:'Synthetic test record',fields:{purpose:'Visit purpose'},requiredFields:['purpose']},upload:{title:'Synthetic upload',description:'Synthetic test attachment',fields:{}}};
const record=(id,client='Synthetic A',kind='orientation')=>({id,state:'draft',revision:1,contentSha256:'synthetic',data:{office:'office-a',clientName:client,memberId:'SYNTHETIC-'+id,caregiverName:'Synthetic caregiver',visitDate:'2026-11-13',kind,fields:{},pages:[],requiredSigners:['staff'],signatures:[]}});
function setup(handler=async()=>undefined){
 const root=new Element(),events=new Map(),calls=[],previews=[],mappings=[];
 root.id='field-visits-root';
 const api=async(path,body,blob)=>{calls.push({path,body,blob});const result=await handler(path,body,blob);if(result!==undefined)return result;if(path.endsWith('/templates'))return {templates};if(path.includes('?office='))return {items:[{id:'record-a',state:'draft',clientName:'Synthetic A',kind:'orientation',visitDate:'2026-11-13'}],next:null};if(body)return record('saved',body.data.clientName,body.data.kind);return record('record-a');};
 const document={getElementById:id=>id===root.id?root:null,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>events.set(name,fn)};
 const window={};
 const context=vm.createContext({window,document,workforceApi:api,location:{hash:''},URL:{revokeObjectURL(){}},AbortController,Intl,Date,crypto:{randomUUID:()=> 'new-record'},FormData:class{constructor(form){this.form=form;}*[Symbol.iterator](){for(const e of walk(this.form))if(e.name&&!e.disabled&&e.type!=='checkbox')yield[e.name,e.value];}},WorkforceSignatureFields:{mount:(target,options)=>mappings.push(options)},WorkforceSignature:{mount:()=>({get:()=>({kind:'synthetic'})})},WorkforcePrivatePdf:{show:async(...args)=>{previews.push(args);return true;}},importExtractor:async()=>({extractAuthorization:async(file,progress,signal)=>{file.progress=progress;file.signal=signal;return file.pending;}})});
 vm.runInContext(runtime,context);
 const button=text=>{const b=walk(root).find(e=>e.tagName==='BUTTON'&&e.textContent===text);assert.ok(b,'Missing button: '+text);return b;};
 const field=name=>{const f=walk(root).find(e=>e.name===name);assert.ok(f,'Missing field: '+name);return f;};
 const form=()=>walk(root).find(e=>e.tagName==='FORM');
 const status=()=>walk(root).find(e=>e.attrs.role==='status')?.textContent||'';
 const office=()=>walk(root).find(e=>e.tagName==='SELECT'&&!e.name);
 const start=async()=>{events.get('workforce-session')({detail:{grant:{offices:['office-a','office-b'],permissions:['field_visits.manage']}}});await window.WorkforceFieldVisits.show('fieldvisits');await tick();await tick();};
 const newRecord=()=>button('+ Start field visit').onclick();
 const submit=async()=>{form().onsubmit({preventDefault(){}});await tick();await tick();};
 return {root,calls,previews,mappings,start,newRecord,button,field,office,submit,status,events};
}

test('required answers prevent a signing request while incomplete drafts remain saveable',async()=>{
 const s=setup();await s.start();await s.button('Open visit').onclick();await s.button('Sign and secure this document').onclick();
 assert.match(s.status(),/Complete the required visit answers.*Visit purpose/);assert.ok(!s.calls.some(c=>c.path.endsWith('/sign')));await s.submit();assert.ok(s.calls.some(c=>c.body?.data));
});

test('uploaded signature mappings are saved with their own draft',async()=>{
 const s=setup();await s.start();s.newRecord();s.field('kind').value='upload';s.field('kind').onchange();
 const file=walk(s.root).find(e=>e.type==='file');file.files=[{pending:Promise.resolve({pages:['mapped-page']})}];await file.onchange();
 assert.equal(s.mappings.length,1);s.mappings[0].onChange([{role:'staff',page:0,x:.1,y:.6,width:.5,height:.08}]);await s.submit();
 assert.equal(s.calls.filter(c=>c.body?.data).at(-1).body.data.signatureFields[0].role,'staff');
});

test('a delayed corrected-copy response cannot replace a different editor',async()=>{
 const pending=deferred(),original={...record('record-a'),state:'signed'};
 const s=setup(path=>path.endsWith('/amend')?pending.promise:path.endsWith('/record-a')?original:undefined);await s.start();await s.button('Open visit').onclick();
 s.field('correctionReason').value='Synthetic correction';const correction=s.button('Create corrected draft').onclick();s.newRecord();s.field('clientName').value='Synthetic B';pending.resolve(record('corrected'));await correction;
 assert.equal(s.field('clientName').value,'Synthetic B');assert.doesNotMatch(s.status(),/Corrected draft created/);
});
test('a delayed save cannot replace another editor or announce its success there',async()=>{
 const pending=deferred(),s=setup((path,body)=>body?.data?pending.promise:undefined);await s.start();s.newRecord();s.field('clientName').value='Synthetic A';await s.submit();
 s.newRecord();s.field('clientName').value='Synthetic B';pending.resolve(record('saved-a'));await tick();await tick();
 assert.equal(s.field('clientName').value,'Synthetic B');assert.doesNotMatch(s.status(),/Draft saved/);
});
test('a delayed save failure cannot overwrite a later editor status',async()=>{
 const pending=deferred(),s=setup((path,body)=>body?.data?pending.promise:undefined);await s.start();s.newRecord();await s.submit();s.newRecord();
 pending.reject(Error('Synthetic earlier failure'));await tick();await tick();assert.doesNotMatch(s.status(),/earlier failure/);
});
test('a late upload and its progress cannot supply pages to a newly opened draft',async()=>{
 const pending=deferred(),s=setup();await s.start();s.newRecord();s.field('kind').value='upload';s.field('kind').onchange();
 const file=walk(s.root).find(e=>e.type==='file'),input={pending:pending.promise};file.files=[input];const upload=file.onchange();await tick();
 s.newRecord();s.field('kind').value='upload';s.field('kind').onchange();input.progress('Synthetic old progress');pending.resolve({pages:['old-record-page']});await upload;await tick();
 assert.ok(input.signal.aborted);assert.doesNotMatch(s.status(),/old progress|pages prepared/);await s.submit();
 const saved=s.calls.filter(c=>c.body?.data).at(-1);assert.ok(saved);assert.deepEqual(Array.from(saved.body.data.pages),[]);
});
test('switching upload type away and back rejects its earlier extraction',async()=>{
 const pending=deferred(),s=setup();await s.start();s.newRecord();const kind=s.field('kind');kind.value='upload';kind.onchange();
 const file=walk(s.root).find(e=>e.type==='file'),input={pending:pending.promise};file.files=[input];const upload=file.onchange();await tick();
 kind.value='orientation';kind.onchange();kind.value='upload';kind.onchange();pending.resolve({pages:['old-kind-page']});await upload;await s.submit();
 assert.deepEqual(Array.from(s.calls.filter(c=>c.body?.data).at(-1).body.data.pages),[]);
});
test('closing a record rejects its pending PDF before a preview opens',async()=>{
 const pending=deferred(),s=setup(path=>path.endsWith('/pdf')?pending.promise:undefined);await s.start();await s.button('Open visit').onclick();
 const preview=s.button('View / print saved document').onclick();s.button('Close').onclick();pending.resolve(new Blob(['synthetic-pdf']));await preview;assert.equal(s.previews.length,0);
});
test('switching office starts its own read and discards the prior office failure',async()=>{
 const pending=deferred();let initial=true;const s=setup(path=>{if(path.includes('?office=office-a')&&initial){initial=false;return pending.promise;}});
 await s.start();s.office().value='office-b';s.office().onchange();await tick();await tick();
 assert.ok(s.calls.some(c=>c.path.includes('?office=office-b')));pending.reject(Error('Synthetic prior-office failure'));await tick();await tick();assert.doesNotMatch(s.status(),/prior-office failure/);
});
test('the selected draft still saves its own uploaded pages normally',async()=>{
 const s=setup();await s.start();s.newRecord();s.field('clientName').value='Synthetic current';s.field('kind').value='upload';s.field('kind').onchange();
 const file=walk(s.root).find(e=>e.type==='file');file.files=[{pending:Promise.resolve({pages:['current-page']})}];await file.onchange();await s.submit();
 const saved=s.calls.filter(c=>c.body?.data).at(-1);assert.equal(saved.body.data.clientName,'Synthetic current');assert.deepEqual(Array.from(saved.body.data.pages),['current-page']);
 assert.match(s.status(),/Draft saved/);
});

test('finishing an old save cannot unlock a newer pending save',async()=>{
 const pending=[],s=setup((path,body)=>{if(body?.data){const request=deferred();pending.push(request);return request.promise;}});
 await s.start();s.newRecord();await s.submit();s.newRecord();s.field('clientName').value='Synthetic B';await s.submit();assert.equal(pending.length,2);
 pending[0].resolve(record('saved-a'));await tick();await s.submit();assert.equal(pending.length,2);
 pending[1].resolve(record('saved-b','Synthetic B'));await tick();await tick();assert.equal(s.field('clientName').value,'Synthetic B');
});

test('a pending record open cannot replace a newly started draft',async()=>{
 const pending=deferred(),s=setup(path=>path.endsWith('/record-a')?pending.promise:undefined);
 await s.start();const opening=s.button('Open visit').onclick();s.newRecord();s.field('clientName').value='Synthetic B';pending.resolve(record('record-a'));await opening;
 assert.equal(s.field('clientName').value,'Synthetic B');
});

test('returning to an office rejects its older list even when the office name matches again',async()=>{
 const pending=deferred();let first=true;
 const s=setup(path=>{if(path.includes('?office=office-a')){if(first){first=false;return pending.promise;}return {items:[{id:'current-a',clientName:'Synthetic current list',state:'draft',kind:'orientation',visitDate:'2026-11-13'}],next:null};}});
 await s.start();s.office().value='office-b';s.office().onchange();await tick();s.office().value='office-a';s.office().onchange();await tick();
 pending.resolve({items:[{id:'old-a',clientName:'Synthetic old list',state:'draft',kind:'orientation',visitDate:'2026-11-13'}],next:null});await tick();await tick();
 assert.match(s.root.textContent,/Synthetic current list/);assert.doesNotMatch(s.root.textContent,/Synthetic old list/);
});
