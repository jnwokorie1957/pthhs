import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(process.env.ADMISSION_PACK_SCRIPT || new URL('../public/assets/workforce-admission-pack.js',import.meta.url),'utf8');
const sample=()=>({title:'Fictional blank form',pages:['aGVsbG8='],requiredSigners:['staff'],signatureFields:[],textFields:[]});
class Element{constructor(tag){this.tagName=tag;this.children=[];this._text='';}append(...items){this.children.push(...items);}prepend(...items){this.children.unshift(...items);}replaceChildren(...items){this.children=[];this.append(...items);}set textContent(v){this._text=v;this.children=[];}get textContent(){return this._text+' '+this.children.map(c=>c.textContent).join(' ');}get childElementCount(){return this.children.length;}setAttribute(k,v){this[k]=v;}reportValidity(){return true;}}
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
test('prepared packs reject unbounded or incomplete input and whitelist template properties',()=>{const s=setup();for(const input of [{},{format:'pthhs-admission-pack-v1',forms:[]},{format:'pthhs-admission-pack-v1',forms:[{...sample(),requiredSigners:['member']}]},{format:'pthhs-admission-pack-v1',forms:[{...sample(),pages:['javascript:alert(1)']}]}])assert.throws(()=>s.parse(JSON.stringify(input)));const [row]=s.parse(JSON.stringify({format:'pthhs-admission-pack-v1',forms:[{...sample(),createdBy:'forged',office:'outside'}]}));assert.equal(row.createdBy,undefined);assert.equal(row.office,undefined);});
test('an interrupted import retries only unfinished forms and keeps the selected office server-bound',async()=>{let fail=true;const s=setup(async count=>{if(count===2&&fail)throw Error('Synthetic interruption');});const file=walk(s.root).find(e=>e.type==='file'),form=walk(s.root).find(e=>e.tagName==='form');file.files=[{size:100,text:async()=>JSON.stringify({format:'pthhs-admission-pack-v1',forms:[sample(),{...sample(),title:'Second form'}]})}];await file.onchange();await form.onsubmit({preventDefault(){}});assert.equal(s.calls.length,2);fail=false;await form.onsubmit({preventDefault(){}});assert.equal(s.calls.length,3);assert.equal(s.calls[2].data.title,'Second form');assert.equal(s.calls[2].data.office,'test-office');assert.equal(s.calls[2].data.blankTemplateConfirmed,true);assert.equal(s.reloads,1);});
test('sign-out during an upload prevents the remaining forms from being submitted',async()=>{let release;const pending=new Promise(resolve=>{release=resolve;});const s=setup(()=>pending),file=walk(s.root).find(e=>e.type==='file'),form=walk(s.root).find(e=>e.tagName==='form');file.files=[{size:100,text:async()=>JSON.stringify({format:'pthhs-admission-pack-v1',forms:[sample(),sample()]})}];await file.onchange();const result=form.onsubmit({preventDefault(){}});s.close();release();await result;assert.equal(s.calls.length,1);assert.equal(s.reloads,0);assert.equal(file.value,'');});
