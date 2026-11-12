import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(){
 const nodes=new Map(),events=new Map(),history=[],calls=[];
 const node=(tag='div')=>({tagName:tag.toUpperCase(),children:[],hidden:true,textContent:'',attrs:{},classList:{add(){},remove(){}},append(...n){this.children.push(...n);},replaceChildren(...n){this.children=n;},setAttribute(k,v){this.attrs[k]=v;},querySelector(){return {focus(){}};}});
 const el=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const loc={pathname:'/caregiver',search:'',hash:'',href:'https://pthhs.net/caregiver'};
 const window={addEventListener:(k,v)=>events.set(k,v),WorkforceReview:{flush:async()=>{}},WorkforceForms:{flush:async()=>{},clear(){}},WorkforceHha:{clear(){}}};
 const document={getElementById:el,createElement:node,querySelectorAll:()=>[],addEventListener:(k,v)=>events.set(k,v),body:node(),title:''};
 const navigateHistory=(state,title,url)=>{history.push(url);loc.hash=url.includes('#')?'#'+url.split('#')[1]:'';loc.href='https://pthhs.net'+url;};
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/workforce-navigation.js',import.meta.url),'utf8'),{window,document,location:loc,history:{pushState:navigateHistory,replaceState:navigateHistory},URL,URLSearchParams,sessionStorage:{getItem(){return null;},setItem(){}},console});
 const api=async path=>{calls.push(path);return path==='/application'?{application:null}:{items:[],form:null};};
 return {window,el,events,history,calls,loc,api,nav:window.WorkforceNavigation,settle:()=>new Promise(r=>setImmediate(r))};
}
test('home reads the signed-in application and routes to the task workspace',async()=>{const s=setup();s.nav.mount({actor:{uid:'test'},api:s.api});await s.settle();assert.equal(s.el('portal-home').hidden,false);assert.deepEqual(s.calls,['/application']);assert.equal(s.loc.hash,'#home');});
test('closed application release cannot be bypassed by a bookmarked application route',async()=>{const s=setup();let opened=false;s.loc.hash='#application';s.nav.mount({actor:{uid:'test',applicationsEnabled:false},api:s.api,application:()=>opened=true});await s.settle();assert.equal(opened,false);assert.equal(s.el('portal-application-link').hidden,true);assert.deepEqual(s.calls,[]);});
test('existing caregivers cannot enter the applicant route',async()=>{const s=setup();let opened=false;s.loc.hash='#application';s.nav.mount({actor:{uid:'existing',existingCaregiver:true},api:s.api,application:()=>opened=true});await s.settle();assert.equal(opened,false);assert.equal(s.el('portal-home').hidden,false);assert.deepEqual(s.calls,[]);});
test('failed saves keep the current screen and prevent navigation',async()=>{const s=setup();s.nav.mount({actor:{uid:'test'},api:s.api});await s.settle();s.window.WorkforceReview.flush=async()=>{throw Error('Connection lost');};await s.nav.navigate('documents');assert.equal(s.loc.hash,'#home');assert.equal(s.el('portal-home').hidden,false);assert.match(s.el('session-status').textContent,/could not be saved/);});
test('a late home response cannot restore private content after sign-out',async()=>{const s=setup();let finish;s.nav.mount({actor:{uid:'test'},api:()=>new Promise(r=>finish=r)});await s.settle();s.events.get('workforce-session-cleared')();finish({application:{state:'submitted'}});await s.settle();assert.equal(s.el('portal-home').hidden,true);assert.equal(s.el('portal-home').children.length,0);});
test('browser Back restores a permitted destination after flushing changes',async()=>{const s=setup();s.nav.mount({actor:{uid:'test'},api:s.api});await s.settle();await s.nav.navigate('profile');assert.match(s.loc.hash,/#profile/);s.loc.hash='#home';s.events.get('popstate')();await s.settle();assert.equal(s.el('portal-home').hidden,false);assert.equal(s.el('portal-profile').hidden,true);});
test('application sections preserve a bookmark without persisting application answers',async()=>{const s=setup();s.nav.mount({actor:{uid:'test'},api:s.api,application(){}});await s.settle();await s.nav.navigate('application');s.nav.step('Contact information',true);assert.equal(s.loc.hash,'#application?section=Contact+information');});
