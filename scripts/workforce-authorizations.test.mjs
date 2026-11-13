import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('expiry cards use full server totals and refreshing preserves previously loaded pages',async()=>{
 const elements=new Map(),events=new Map(),requests=[];
 const node=()=>({value:'',textContent:'',children:[],hidden:false,elements:{},append(...children){this.children.push(...children);},prepend(){},replaceChildren(...children){this.children=children;if(children[0]?.value)this.value=children[0].value;},addEventListener(){},setAttribute(){},reset(){},focus(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
 el('authorization-filter').value='all';
 const row=(i,bucket)=>({id:String(i),clientName:'Synthetic '+i,memberId:'TEST',payer:'Test payer',authorizationNumber:'TEST-'+i,services:'Personal assistance',endDate:bucket==='current'?'2099-12-01':'2026-11-13',startDate:'2026-01-01',renewalStatus:'not_started',bucket,days:bucket==='current'?100:1});
 const first=Array.from({length:100},(_,i)=>row(i,'current')),last=row(100,'within15');
 let unavailable=false;const api=async path=>{requests.push(path);if(unavailable)throw Error('Please sign in again.');if(path.includes('/summary'))return {counts:{expired:0,within15:1,within30:0,current:100},total:101};return path.includes('&after=')?{items:[last],next:null}:{items:[...first],next:'99'};};
 const window={workforceApi:api},document={getElementById:el,createElement:node,querySelectorAll:()=>[],addEventListener:(k,fn)=>events.set(k,fn),visibilityState:'visible'};
 const ctx=vm.createContext({window,document,URL:{revokeObjectURL(){}},setInterval(){},AbortController,console});
 vm.runInContext(fs.readFileSync(new URL('../public/assets/workforce-office-tools.js',import.meta.url),'utf8'),ctx);
 events.get('workforce-session')({detail:{grant:{offices:['100'],permissions:['authorizations.manage']}}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(el('authorization-count-within15').textContent,1);assert.equal(el('office-home-alert').hidden,false);assert.equal(el('authorization-list').children.length,100);assert.match(el('authorization-coverage').textContent,/cover all 101/);
 await el('authorization-more').onclick();assert.equal(el('authorization-list').children.length,101);
 await el('authorization-refresh').onclick();assert.equal(el('authorization-list').children.length,101);assert.equal(el('authorization-count-within15').textContent,1);
 unavailable=true;await el('authorization-refresh').onclick();assert.equal(el('authorization-count-within15').textContent,'—');assert.equal(el('office-home-alert').hidden,false);assert.match(el('office-home-alert-text').textContent,/unavailable.*sign in again/);
 assert.ok(requests.includes('/staff/authorizations/summary'));assert.ok(requests.includes('/staff/authorizations/summary?office=100'));
});
