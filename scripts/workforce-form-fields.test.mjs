import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/assets/workforce-form-fields.js',import.meta.url),'utf8'),schemas=JSON.parse(fs.readFileSync(new URL('../public/assets/forms/schema.json',import.meta.url)));
test('I-9 and W-4 status boxes are single named radio groups; employer fields are locked in every form',()=>{
 for(const kind of ['i9','w4','new_hire']){
  const nodes=[];class Node{constructor(tag){this.tagName=tag;this.attrs={};nodes.push(this);}append(){}setAttribute(k,v){this.attrs[k]=v;}}
  const ctx=vm.createContext({window:{},URLSearchParams,document:{createElement:t=>new Node(t)}});vm.runInContext(fs.readFileSync(new URL('../public/assets/workforce-contract.js',import.meta.url),'utf8'),ctx);vm.runInContext(source,ctx);
  ctx.window.WorkforceFormFields.render({target:new Node('div'),schema:schemas[kind],kind,pageNumber:1,fields:{},employer:{name:'Primetime',address:'Test office'},fullName:'Synthetic Applicant',readOnly:false,onChange:()=>{}});
  const radios=nodes.filter(n=>n.type==='radio');assert.equal(radios.length,kind==='i9'?4:kind==='w4'?3:0);
  if(radios.length){assert.equal(new Set(radios.map(n=>n.name)).size,1);assert.ok(radios.every(n=>n.attrs['aria-required']==='false'));assert.ok(nodes.some(n=>n.attrs.role==='radiogroup'&&n.attrs['aria-required']==='true'));}
  const employer=nodes.filter(n=>n.id?.startsWith('official-employer-'));assert.equal(employer.length,schemas[kind].employerFields.length);
  for(const input of employer){assert.equal(input.readOnly,true);assert.equal(input.disabled,true);assert.equal(input.oninput,undefined);}
 }
});
