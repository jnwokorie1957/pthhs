import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(process.env.ADMISSION_PACK_SCRIPT || new URL('../public/assets/workforce-admission-pack.js',import.meta.url),'utf8');
const sample=()=>({title:'Fictional blank form',pages:['aGVsbG8='],requiredSigners:['staff'],signatureFields:[],textFields:[]});
class Element{constructor(tag){this.tagName=tag;this.children=[];this._text='';}append(...items){this.children.push(...items);}prepend(...items){this.children.unshift(...items);}replaceChildren(...items){this.children=[];this.append(...items);}set textContent(v){this._text=v;this.children=[];}get textContent(){return this._text+' '+this.children.map(c=>c.textContent).join(' ');}get childElementCount(){return this.children.length;}setAttribute(k,v){this[k]=v;}reportValidity(){return true;}querySelectorAll(selector){return walk(this).slice(1).filter(e=>e.tagName==='input'&&(selector==='input'||selector==='input:checked'&&e.checked));}reset(){for(const e of this.querySelectorAll('input')){e.value='';e.checked=false;if(e.type==='file')e.files=[];}}}
const walk=e=>[e,...e.children.flatMap(walk)];
function setup(handler=async()=>{},refresh=async()=>true){const events=new Map(),calls=[],root=new Element('div'),window={};let active=true,reloads=0;vm.runInNewContext(source,{window,document:{createElement:t=>new Element(t),addEventListener:(name,fn)=>events.set(name,fn)},workforceApi:async(path,data)=>{calls.push({path,data});await handler(calls.length,data);}});window.WorkforceAdmissionPack.mount(root,{office:'test-office',current:()=>active,reload:async()=>{reloads++;return refresh(reloads);}});return {root,calls,events,parse:window.WorkforceAdmissionPack.parse,get reloads(){return reloads;},close(){active=false;events.get('workforce-session-cleared')();}};}

async function choose(s,count=2){const file=walk(s.root).find(e=>e.type==='file');file.files=[{size:100,text:async()=>JSON.stringify({format:'pthhs-admission-pack-v1',forms:Array.from({length:count},(_,i)=>({...sample(),title:'Fictional form '+(i+1)}))})}];await file.onchange();return {file,form:walk(s.root).find(e=>e.tagName==='form'),submit:walk(s.root).find(e=>e.type==='submit'),status:walk(s.root).find(e=>e.role==='status')};}
const submit=form=>form.onsubmit({preventDefault(){}});

test('mixed results keep added, existing, failed and unattempted forms distinct before resuming',async()=>{
 let interrupted=true;const s=setup(async(count)=>{if(count===2)throw Object.assign(Error('Synthetic duplicate'),{code:'admission_template_exists'});if(count===3&&interrupted)throw Error('Synthetic interruption');});
 const ui=await choose(s,4);await submit(ui.form);
 assert.match(ui.status.textContent,/1 added.*1 already present.*1 failed.*1 not attempted/);
 assert.equal(ui.submit.textContent.trim(),'Retry remaining forms');assert.equal(s.reloads,0);
 interrupted=false;await submit(ui.form);
 assert.deepEqual(s.calls.map(c=>c.data.title),['Fictional form 1','Fictional form 2','Fictional form 3','Fictional form 3','Fictional form 4']);
 assert.match(ui.status.textContent,/3 added.*1 already present.*0 failed.*0 not attempted/);
 assert.match(ui.status.textContent,/client copy/i);assert.equal(ui.submit.disabled,true);
});

for(const mode of ['returns false','throws'])test('a library refresh that '+mode+' keeps a refresh-only retry without reuploading forms',async()=>{
 const s=setup(undefined,async count=>{if(count===1){if(mode==='throws')throw Error('Synthetic refresh failure');return false;}return true;});
 const ui=await choose(s);await submit(ui.form);
 assert.match(ui.status.textContent,/library refresh.*failed/i);assert.equal(ui.submit.textContent.trim(),'Refresh library');assert.equal(ui.submit.disabled,false);
 assert.match(ui.status.textContent,/2 added.*0 already present.*0 failed.*0 not attempted/);
 await submit(ui.form);assert.equal(s.calls.length,2);assert.equal(s.reloads,2);assert.equal(ui.submit.disabled,true);assert.match(ui.status.textContent,/^Library refreshed\./);
});

test('a late library refresh failure after sign-out cannot restore the import status or retry',async()=>{
 let reject;const pending=new Promise((_,no)=>{reject=no;});const s=setup(undefined,()=>pending),ui=await choose(s);
 const result=submit(ui.form);await new Promise(resolve=>setImmediate(resolve));s.close();reject(Error('Synthetic late refresh failure'));await result;
 assert.equal(ui.status.textContent.trim(),'');assert.equal(ui.submit.disabled,true);assert.equal(ui.file.value,'');assert.equal(s.calls.length,2);
});

test('the real library loader reports refresh failure and success explicitly to the importer',async()=>{
 const library=fs.readFileSync(process.env.ADMISSION_LIBRARY_SCRIPT || new URL('../public/assets/workforce-admission-library.js',import.meta.url),'utf8');
 const root=new Element('div'),window={};let captured,fail=false;
 vm.runInNewContext(library,{window,document:{createElement:t=>new Element(t)},WorkforceAdmissionPack:{mount:(_,options)=>{captured=options;}},workforceApi:async()=>{if(fail)throw Error('Synthetic library unavailable');return {items:[],people:{}};}});
 await window.WorkforceAdmissionLibrary.mount(root,{office:'test-office',actor:{grant:{role:'owner',permissions:['documents.review']}},current:()=>true,prepare(){}});
 fail=true;assert.equal(await captured.reload(),false);assert.match(root.textContent,/Synthetic library unavailable/);
 fail=false;assert.equal(await captured.reload(),true);
});

async function librarySetup(handler,role='owner'){
 const library=fs.readFileSync(process.env.ADMISSION_LIBRARY_SCRIPT || new URL('../public/assets/workforce-admission-library.js',import.meta.url),'utf8');
 const expression=library.match(/import\(["']\/assets\/workforce-authorization-extract\.js["']\)/)?.[0];assert.ok(expression);assert.equal(library.split(expression).length,2);
 const root=new Element('div'),window={},calls=[],events=new Map();let active=true,captured;
 vm.runInNewContext(library.replace(expression,'importExtractor()'),{window,AbortController,document:{createElement:t=>new Element(t),addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}},WorkforceAdmissionPack:{mount:(_,options)=>{captured=options;}},WorkforceDocumentFields:{mount:()=>({get:()=>[]})},WorkforceSignatureFields:{mount:()=>({get:()=>[{role:'member'},{role:'staff'}]})},importExtractor:async()=>({extractAuthorization:async()=>({pages:['aGVsbG8=']})}),workforceApi:async(path,data)=>{calls.push({path,data});return await handler(path,data,calls.length)??{items:[],people:{}};}});
 await window.WorkforceAdmissionLibrary.mount(root,{office:'test-office',actor:{grant:{role,permissions:role==='owner'?['documents.review']:[]}},current:()=>active,prepare(){}});
 return {root,calls,get reload(){return captured?.reload;},close(){active=false;events.get('workforce-session-cleared')?.();},button:label=>walk(root).find(e=>e.tagName==='button'&&e.textContent.trim()===label),status:()=>walk(root).find(e=>e.role==='status').textContent};
}

test('a failed initial library read can retry for an existing reader without any upload',async()=>{
 let fail=true;const s=await librarySetup(()=>{if(fail)throw Error('Synthetic list unavailable');},'office');
 const retry=s.button('Refresh library');assert.ok(retry);assert.equal(retry.hidden,false);assert.match(s.status(),/could not be loaded/i);
 fail=false;await retry.onclick();assert.equal(s.calls.length,2);assert.ok(s.calls.every(c=>!c.data));assert.equal(retry.hidden,true);assert.doesNotMatch(s.status(),/unavailable|could not/i);
});

test('a saved single template keeps refresh failure visible and retries the list without another upload',async()=>{
 let saved=false,fail=true;const s=await librarySetup((path,data)=>{if(data){saved=true;return {};}if(saved&&fail)throw Error('Synthetic list unavailable');});
 const form=walk(s.root).find(e=>e.tagName==='form'),file=walk(form).find(e=>e.type==='file');file.files=[{name:'fictional-blank.pdf'}];
 await submit(form);await submit(form);
 assert.equal(s.calls.filter(c=>c.data).length,1);assert.match(s.status(),/saved securely.*could not be refreshed/i);assert.match(s.status(),/Synthetic list unavailable/);
 const retry=s.button('Refresh library');assert.ok(retry);assert.equal(retry.hidden,false);await retry.onclick();assert.equal(s.calls.filter(c=>c.data).length,1);assert.equal(retry.hidden,false);
 fail=false;await retry.onclick();assert.equal(s.calls.filter(c=>c.data).length,1);assert.equal(retry.hidden,true);assert.match(s.status(),/saved securely.*client copy/i);assert.equal(file.files.length,0);
});

test('refresh cannot invalidate a single-template save that is still pending',async()=>{
 let release,reads=0;const pending=new Promise(resolve=>{release=resolve;});const s=await librarySetup((path,data)=>{if(data)return pending;if(++reads===1)throw Error('Synthetic initial list failure');});
 const form=walk(s.root).find(e=>e.tagName==='form'),file=walk(form).find(e=>e.type==='file');file.files=[{name:'fictional-blank.pdf'}];await submit(form);
 const result=submit(form),retry=s.button('Refresh library');assert.equal(retry.disabled,true);await retry.onclick();assert.equal(reads,1);
 release({});await result;assert.equal(reads,2);assert.equal(s.calls.filter(c=>c.data).length,1);assert.equal(file.files.length,0);assert.equal(retry.hidden,true);assert.match(s.status(),/saved securely.*client copy/i);
});

test('a superseded library failure cannot replace a newer list or reveal its retry',async()=>{
 let reject,reads=0;const pending=new Promise((_,no)=>{reject=no;});const s=await librarySetup(()=>{if(++reads===2)return pending;});
 const old=s.reload();await s.reload();reject(Error('Synthetic old failure'));assert.equal(await old,false);assert.doesNotMatch(s.status(),/old failure/);const retry=s.button('Refresh library');assert.ok(retry);assert.equal(retry.hidden,true);
});

test('a late failed library read after sign-out cannot restore an error or refresh action',async()=>{
 let reject,reads=0;const pending=new Promise((_,no)=>{reject=no;});const s=await librarySetup(()=>{if(++reads===2)return pending;});
 const result=s.reload();s.close();reject(Error('Synthetic late failure'));assert.equal(await result,false);assert.doesNotMatch(s.status(),/late failure/);const retry=s.button('Refresh library');assert.ok(retry);assert.equal(retry.hidden,true);
});
test('prepared packs reject unbounded or incomplete input and whitelist template properties',()=>{const s=setup();for(const input of [{},{format:'pthhs-admission-pack-v1',forms:[]},{format:'pthhs-admission-pack-v1',forms:[{...sample(),requiredSigners:['member']}]},{format:'pthhs-admission-pack-v1',forms:[{...sample(),pages:['javascript:alert(1)']}]}])assert.throws(()=>s.parse(JSON.stringify(input)));const [row]=s.parse(JSON.stringify({format:'pthhs-admission-pack-v1',forms:[{...sample(),createdBy:'forged',office:'outside'}]}));assert.equal(row.createdBy,undefined);assert.equal(row.office,undefined);});
test('an interrupted import retries only unfinished forms and keeps the selected office server-bound',async()=>{let fail=true;const s=setup(async count=>{if(count===2&&fail)throw Error('Synthetic interruption');});const file=walk(s.root).find(e=>e.type==='file'),form=walk(s.root).find(e=>e.tagName==='form');file.files=[{size:100,text:async()=>JSON.stringify({format:'pthhs-admission-pack-v1',forms:[sample(),{...sample(),title:'Second form'}]})}];await file.onchange();await form.onsubmit({preventDefault(){}});assert.equal(s.calls.length,2);fail=false;await form.onsubmit({preventDefault(){}});assert.equal(s.calls.length,3);assert.equal(s.calls[2].data.title,'Second form');assert.equal(s.calls[2].data.office,'test-office');assert.equal(s.calls[2].data.blankTemplateConfirmed,true);assert.equal(s.reloads,1);});
test('sign-out during an upload prevents the remaining forms from being submitted',async()=>{let release;const pending=new Promise(resolve=>{release=resolve;});const s=setup(()=>pending),file=walk(s.root).find(e=>e.type==='file'),form=walk(s.root).find(e=>e.tagName==='form');file.files=[{size:100,text:async()=>JSON.stringify({format:'pthhs-admission-pack-v1',forms:[sample(),sample()]})}];await file.onchange();const result=form.onsubmit({preventDefault(){}});s.close();release();await result;assert.equal(s.calls.length,1);assert.equal(s.reloads,0);assert.equal(file.value,'');});
