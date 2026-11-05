import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../public/assets/workforce-readings.js',import.meta.url),'utf8');
class Node {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};}
 append(...children){this.children.push(...children);}
 replaceChildren(){this.children=[];}
 setAttribute(key,value){this.attrs[key]=value;}
}
const walk=node=>[node,...node.children.flatMap(walk)];
function setup({fail=false,stale=false}={}) {
 const doc={edition:'test-v1',text:'## Responsibilities\n- One\n- Two\n\nEmployee: {{employee}}\n<script>text only</script>'};
 doc.contentSha256=createHash('sha256').update(doc.text).digest('hex');
 const reading={page:9,title:'Confidentiality',agreement:true,edition:doc.edition,contentSha256:stale?'changed':doc.contentSha256};
 const answers={},target=new Node('section'),requests=[];
 const ctx=vm.createContext({window:{},document:{createElement:tag=>new Node(tag)},crypto:webcrypto,TextEncoder,workforceApi:async route=>{requests.push(route);if(fail)throw Error('offline');return doc;}});
 vm.runInContext(source,ctx);ctx.window.WorkforceReadings.render(target,[reading],answers,(key,value)=>answers[key]=value,false);
 return {target,answers,requests,ctx,nodes:()=>walk(target)};
}
test('clean reading opens without scan links, toggles accessibly and saves explicit agreement or HR questions',async()=>{
 const s=setup(),open=s.nodes().find(n=>n.tagName==='BUTTON'),box=s.nodes().find(n=>n.type==='checkbox');
 assert.equal(box.disabled,true);await open.onclick();assert.equal(box.disabled,false);
 assert.deepEqual(s.requests,['/application/reading-documents/9']);assert.equal(open.attrs['aria-expanded'],'true');
 assert.equal(s.nodes().filter(n=>n.tagName==='LI').length,2);
 assert.ok(s.nodes().some(n=>n.textContent==='<script>text only</script>'));
 assert.ok(!s.nodes().some(n=>['IMG','A','SCRIPT'].includes(n.tagName)));
 box.checked=true;box.onchange();assert.equal(s.answers.read_page_9,'Read');assert.equal(s.answers.terms_page_9,'I agree');
 s.nodes().find(n=>n.textContent==='Questions for HR').onclick();assert.equal(box.checked,false);assert.equal(s.answers.terms_page_9,'I have questions for HR before agreeing');
 await open.onclick();assert.equal(open.attrs['aria-expanded'],'false');assert.equal(s.requests.length,1);
});
test('unavailable or stale digital wording cannot enable agreement',async()=>{
 for(const options of [{fail:true},{stale:true}]){const s=setup(options);await s.nodes().find(n=>n.tagName==='BUTTON').onclick();assert.equal(s.nodes().find(n=>n.type==='checkbox').disabled,true);assert.deepEqual(s.answers,{});}
});
