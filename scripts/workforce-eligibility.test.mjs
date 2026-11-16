import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const source=fs.readFileSync(new URL('../public/assets/workforce-eligibility.js',import.meta.url),'utf8');
const fixture=()=>({available:true,connectionReady:false,items:[{key:'a'.repeat(64),memberId:'SYNTHETIC-1',displayName:'Synthetic Client',
  identityReady:true,medicaidId:'Protected',department:'Intake',assignee:null,review:'pending',revision:1,authorizations:null,
  latest:{status:'unable_to_verify',checkedAt:'2026-11-16T01:00:00Z',asOf:'2026-11-15',source:'tmhp',coverage:null,mco:null},
  lastSuccessful:{checkedAt:'2026-11-14T12:00:00Z'},discrepancies:['authorization_unavailable']}],
  summary:{total:1,active:0,inactive:0,unable_to_verify:1,pendingReview:1,changed:0,lastSuccessful:'2026-11-14T12:00:00Z'},
  next:null,nextScheduled:null,rosterComplete:true,summaryComplete:true,reviewers:[{uid:'synthetic-staff',name:'Synthetic Staff'},{uid:'synthetic-other',name:'Synthetic Reviewer'}]});
function setup(api=async()=>fixture(),permissions=['read','verify','review','identifiers']){
  const events=new Map(),calls=[];
  class Node {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.handlers={};this.value='';this.hidden=false;this._text='';}
    set textContent(value){this._text=String(value);this.children=[];}
    get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    set innerHTML(_){throw Error('Unsafe HTML rendering');}
    append(...nodes){this.children.push(...nodes);if(this.tagName==='SELECT'&&this.children.length===nodes.length&&nodes.length)this.value=nodes[0].value;}
    prepend(...nodes){this.children.unshift(...nodes);}
    replaceChildren(...nodes){this._text='';this.children=nodes;}
    contains(node){return this===node||this.children.some(c=>c.contains(node));}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(name,fn){this.handlers[name]=fn;}
    reset(){}
  }
  const root=new Node('section'),nav=new Node('button');
  const document={getElementById:()=>root,createElement:tag=>new Node(tag),querySelectorAll:()=>[nav],addEventListener:(event,fn)=>events.set(event,fn)};
  vm.runInNewContext(source,{document,Date,Intl,Map,crypto:{randomUUID},workforceApi:async(path,body)=>{calls.push({path,body});return api(path,body);}});
  const nodes=()=>{const walk=n=>[n,...n.children.flatMap(walk)];return walk(root);};
  events.get('workforce-session')({detail:{uid:'synthetic-staff',grant:{offices:['test-office'],permissions:permissions.map(p=>'eligibility.'+p)}}});
  return {root,calls,nodes,text:()=>root.textContent,load:()=>nav.handlers.click(),clear:()=>events.get('workforce-session-cleared')(),
    button:name=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name),control:name=>nodes().find(n=>n.name===name)};
}

test('eligibility is lazy, scoped, and disabled connections cannot request verification',async()=>{
  const s=setup();assert.equal(s.calls.length,0);await s.load();assert.equal(s.calls[0].body.office,'test-office');
  assert.equal(s.button('Verify now').disabled,true);assert.match(s.text(),/Unable to Verify/);assert.match(s.text(),/Last successful/);
  assert.match(s.text(),/Authorization information unavailable/);assert.match(s.text(),/Not provided/);assert.doesNotMatch(s.text(),/000000001/);
  const denied=setup(undefined,[]);await denied.load();assert.equal(denied.calls.length,0);
});
test('closed release shows unavailable totals instead of zero or fabricated clients',async()=>{
  const s=setup(async()=>({available:false,connectionReady:false,summary:null,items:[],next:null,nextScheduled:null}));await s.load();
  assert.match(s.text(),/awaiting activation/);assert.match(s.text(),/Total active clients—/);assert.doesNotMatch(s.text(),/Synthetic Client/);
});
test('late eligibility data cannot restore private rows after logout',async()=>{
  let resolve;const s=setup(()=>new Promise(r=>resolve=r)),pending=s.load();s.clear();resolve(fixture());await pending;
  assert.doesNotMatch(s.text(),/Synthetic Client|SYNTHETIC-1/);assert.match(s.text(),/Sign in/);
});
test('newer filter response wins over a delayed older response',async()=>{
  const finish=[];const s=setup(()=>new Promise(r=>finish.push(r)));const older=s.load();s.control('status').value='inactive';const newer=s.load();
  const fresh=fixture();fresh.items[0].displayName='New filter';finish[1](fresh);await newer;
  finish[0](fixture());await older;assert.match(s.text(),/New filter/);assert.doesNotMatch(s.text(),/Synthetic Client/);
});
test('Medicaid ID requires separate permission and late reveal cannot survive logout',async()=>{
  let reveal;const s=setup(path=>path.endsWith('/identifier')?new Promise(r=>reveal=r):Promise.resolve(fixture()));await s.load();
  const pending=s.button('View Medicaid ID').onclick();s.clear();reveal({medicaidId:'000000001'});await pending;assert.doesNotMatch(s.text(),/000000001/);
  const limited=setup(undefined,['read']);await limited.load();assert.equal(limited.button('View Medicaid ID'),undefined);
});
test('manual retry reuses the idempotency key after an uncertain API response',async()=>{
  let verifies=0;const s=setup(async path=>{if(path.endsWith('/verify')){if(++verifies===1)throw Error();return {jobId:'synthetic'};}return {...fixture(),connectionReady:true};});await s.load();
  await s.button('Verify now').onclick();await s.button('Verify now').onclick();
  const calls=s.calls.filter(c=>c.path.endsWith('/verify'));assert.equal(calls.length,2);assert.equal(calls[0].body.idempotencyKey,calls[1].body.idempotencyKey);
});
test('follow-up history renders source text without HTML execution',async()=>{
  const s=setup(async path=>path.endsWith('/history')?{results:[],notes:[{at:'2026-11-15T12:00:00Z',note:'<img src=x onerror=alert(1)>'}],limitedTo:50}:fixture());
  await s.load();await s.button('History / follow-up').onclick();assert.match(s.text(),/<img src=x onerror=alert\(1\)>/);assert.ok(s.button('Save follow-up'));
});
test('named employee filter sends the selected authorized staff reference',async()=>{
  const s=setup();await s.load();assert.match(s.text(),/Synthetic Reviewer/);s.control('assignment').value='synthetic-other';await s.load();
  assert.equal(s.calls.at(-1).body.filters.assignee,'synthetic-other');
});
