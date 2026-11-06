import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function camera(getUserMedia){
 const nodes=[],events={},revoked=[];let stops=0;
 const stream={getTracks:()=>[{stop:()=>stops++}]};
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.events={};nodes.push(this);}
  append(...items){this.children.push(...items);}setAttribute(){}addEventListener(name,fn){this.events[name]=fn;}
  showModal(){}close(){this.events.close?.();}remove(){}
  async play(){this.videoWidth=1280;this.videoHeight=720;this.onloadeddata?.();}
  getContext(){return {drawImage:()=>{}};}toBlob(fn){fn(new Blob(['synthetic'],{type:'image/jpeg'}));}
 }
 const context=vm.createContext({window:{addEventListener:(n,fn)=>events[n]=fn},document:{body:new Node('body'),createElement:tag=>new Node(tag),addEventListener:(n,fn)=>events[n]=fn},navigator:{mediaDevices:{getUserMedia:getUserMedia||(async(options)=>{assert.equal(options.audio,false);assert.equal(options.video.facingMode.ideal,'environment');return stream;})}},File,URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:u=>revoked.push(u)}});
 vm.runInContext(read('public/assets/workforce-camera.js'),context);
 return {api:context.window.WorkforceCamera,nodes,events,stream,revoked,stops:()=>stops};
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
test('camera captures a JPEG and stops all tracks without a file picker',async()=>{
 const c=camera(),result=c.api.capture('Photo ID');await settle();
 const button=c.nodes.find(n=>n.textContent==='Capture photo');assert.equal(button.disabled,false);button.onclick();
 const file=await result;assert.equal(file.type,'image/jpeg');assert.equal(c.stops(),1);
 assert.equal(c.nodes.filter(n=>n.tagName==='input').length,0);
});
test('cancelling before camera permission resolves stops the late stream',async()=>{
 let release;const c=camera(()=>new Promise(resolve=>release=resolve)),result=c.api.capture('Photo ID');c.api.clear();assert.equal(await result,null);
 release(c.stream);await settle();assert.equal(c.stops(),1);
});
test('denied camera access has an explicit message and never opens a file picker',async()=>{
 const c=camera(async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});}),result=c.api.capture('Photo ID');await settle();
 assert.ok(c.nodes.some(n=>n.textContent?.includes('Camera access was blocked')));assert.equal(c.nodes.find(n=>n.textContent==='Capture photo').disabled,true);c.api.clear();assert.equal(await result,null);
});
test('leaving the page stops a live camera; document views revoke their local URL',async()=>{
 const c=camera(),result=c.api.capture('Photo ID');await settle();c.events.pagehide();assert.equal(await result,null);assert.equal(c.stops(),1);
 c.api.view(new Blob(['synthetic']),'Photo ID');c.api.clear();assert.deepEqual(c.revoked,['blob:synthetic']);
});
test('live document navigation blocks missing receipts and in-flight uploads; owner review stays free',()=>{
 const source=read('public/assets/workforce-application.js'),fn=source.slice(source.indexOf('  function validateStep()'),source.indexOf('  function renderRoleDescription()'));
 for(const [reviewNavigation,uploading,kinds,blocked]of [[false,false,['identity'],true],[false,true,[],true],[false,false,[],false],[true,false,['identity','social_security'],false]]){
  const ctx=vm.createContext({reviewNavigation,uploading,sections:['Documents'],step:0,packet:{fields:[]},answers:{},requiredDocuments:()=>kinds,document:{getElementById:()=>({focus(){}})}});vm.runInContext(fn,ctx);
  if(blocked)assert.throws(()=>ctx.validateStep(),/before continuing/);else assert.doesNotThrow(()=>ctx.validateStep());
 }
});
test('camera access is confined to the caregiver page and other sensors remain blocked',()=>{
 const headers=JSON.parse(read('firebase.json')).hosting.headers;
 assert.match(headers.find(h=>h.source==='**').headers.find(h=>h.key==='Permissions-Policy').value,/camera=\(\)/);
 assert.equal(headers.find(h=>h.source==='/caregiver').headers.find(h=>h.key==='Permissions-Policy').value,'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
});
