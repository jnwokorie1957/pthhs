import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildWorkforceRuntime,runtimeAssets} from './build-workforce-runtime.mjs';
const served=fs.readFileSync('public/assets/workforce-matching.js','utf8');
function setup(api=async()=>({preferences:null,items:[]})){
 const listeners=new Map(),roots=[];class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this._text='';}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
  set textContent(t){this._text=String(t);this.children=[];}
  get textContent(){return this._text+' '+this.children.map(n=>n.textContent).join(' ');}
  setAttribute(){}
  remove(){}
 }
 const window={WorkforceOpportunityFields:{services:{regular:'Regular'},tasks:{bathing:'Bathing'}}};
 vm.runInNewContext(served,{window,document:{createElement:tag=>new Element(tag),addEventListener:(name,fn)=>listeners.set(name,fn),querySelectorAll:()=>roots},workforceApi:api,Date,Intl,crypto:{randomUUID:()=> '00000000-0000-0000-0000-000000000000'}});
 const target=new Element('div');roots.push(target);const all=e=>[e,...e.children.flatMap(all)];return {target,all:()=>all(target),module:window.WorkforceMatching,emit:(name,detail)=>listeners.get(name)?.({detail})};
}
test('late preference and notice responses cannot restore content after sign-out/navigation',async()=>{
 for(const method of ['preferences','notices']){let finish,current=true;const s=setup(),pending=s.module[method](s.target,{api:()=>new Promise(r=>finish=r),current:()=>current});s.emit('workforce-session-cleared');current=false;finish({preferences:{placeId:'PRIVATE'},items:[{opportunity:{location:'PRIVATE'}}]});await pending;assert.doesNotMatch(s.target.textContent,/PRIVATE/);}
});
test('caregiver controls disclose driving miles, workweek, verified phone consent and independent opt-out',async()=>{
 const calls=[],api=async(path,body)=>{calls.push({path,body});return {preferences:null,items:[]};},s=setup(api);await s.module.preferences(s.target,{api,current:()=>true});assert.match(s.target.textContent,/10 driving miles/);assert.match(s.target.textContent,/Sunday–Saturday/);assert.match(s.target.textContent,/verified phone/);
 const sms=s.all().find(n=>n.tagName==='LABEL'&&n.textContent.trim().startsWith('Text me'));assert.equal(!!sms.children[0].checked,false);
 await s.all().find(n=>n.textContent==='Turn off all opening alerts ').onclick();assert.equal(calls.at(-1).path,'/matching/opt-out');assert.match(s.target.textContent,/alerts are off/);
});
test('source setup errors are explained and staff matching controls require both existing permissions',async()=>{
 const s=setup();await s.module.preferences(s.target,{api:async()=>{throw {code:'matching_maps_pending'};},current:()=>true});assert.match(s.target.textContent,/Google Maps setup/);
 const t=setup();t.emit('workforce-session',{grant:{permissions:['opportunities.read']}});t.module.openingButton(t.target,{state:'published'},{current:()=>true});assert.equal(t.target.children.length,0);
 t.emit('workforce-session',{grant:{permissions:['opportunities.read','accounts.support']}});t.module.openingButton(t.target,{state:'draft'},{current:()=>true});assert.equal(t.target.children.length,0);
 t.module.openingButton(t.target,{state:'published'},{current:()=>true});assert.equal(t.target.children.length,1);
});
test('runtime builds preserve readable sources and detect a stale served controller',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pthhs-runtime-'));try{await mkdir(join(root,'source/workforce'),{recursive:true});await mkdir(join(root,'public/assets'),{recursive:true});for(const name of runtimeAssets)await writeFile(join(root,'source/workforce',name),'function stableName() { const localValue = 7; return localValue; }\r\n');await buildWorkforceRuntime({root});await buildWorkforceRuntime({root,check:true});assert.match(await readFile(join(root,'source/workforce',runtimeAssets[0]),'utf8'),/localValue/);await writeFile(join(root,'public/assets',runtimeAssets[0]),'stale');await assert.rejects(buildWorkforceRuntime({root,check:true}),/Stale workforce runtime/);}finally{await rm(root,{recursive:true,force:true});}
});
