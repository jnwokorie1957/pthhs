import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('recruiting print checks one submitted application and prints only its hiring fields',async()=>{
 const elements=new Map(),events=new Map(),paths=[],printed=[];let delayed=false,resolveRequest;
 const node=()=>({value:'',textContent:'',children:[],style:{},elements:{},append(...v){this.children.push(...v);},prepend(){},replaceChildren(...v){this.children=v;if(v[0]?.value)this.value=v[0].value;},addEventListener(){},setAttribute(){},reset(){},focus(){},remove(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
 const make=tag=>{const n=node();if(tag==='iframe'){n.contentDocument={createElement:node,body:node()};n.contentWindow={focus(){},print(){printed.push(n.contentDocument.body.children.map(x=>x.textContent));}};}return n;};
 const item={uid:'demo',office:'100',state:'submitted',employmentStatus:'applicant',answers:{firstName:'Fictional',lastName:'Candidate',city:'Houston',ssn:'private-value'}};
 const api=async path=>{paths.push(path);if(path.includes('/print?'))return delayed?new Promise(r=>{resolveRequest=r;}):item;return {items:[item]};};
 const window={workforceApi:api},document={body:node(),createElement:make,getElementById:el,querySelectorAll:()=>[],addEventListener:(k,f)=>events.set(k,f)};
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/workforce-office-tools.js',import.meta.url),'utf8'),{window,document,setInterval(){},URL:{revokeObjectURL(){}},AbortController});
 el('applicant-filter').value='all';events.get('workforce-session')({detail:{grant:{offices:['100'],permissions:['applicants.review']}}});
 window.WorkforceOfficeTools.show('applicants');await new Promise(r=>setImmediate(r));
 const all=n=>[n,...n.children.flatMap(all)],button=all(el('applicant-list')).find(n=>n.textContent==='Print submitted application');
 await button.onclick();assert.ok(paths.includes('/staff/applicants/demo/print?office=100'));assert.ok(printed[0].includes('Fictional Candidate'));assert.ok(printed[0].includes('Houston'));assert.ok(!printed[0].includes('private-value'));
 delayed=true;const pending=button.onclick();window.WorkforceOfficeTools.show('overview');resolveRequest(item);await pending;assert.equal(printed.length,1);
});

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

test('applicant search matches only first and last names, never other answers',async()=>{
 const elements=new Map(),events=new Map();const node=()=>({value:'',textContent:'',children:[],hidden:false,elements:{},append(...children){this.children.push(...children);},prepend(){},replaceChildren(...children){this.children=children;if(children[0]?.value)this.value=children[0].value;},addEventListener(){},setAttribute(){},reset(){},focus(){}}),el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};el('applicant-filter').value='all';
 const window={workforceApi:async()=>({items:[{employmentStatus:'applicant',answers:{firstName:'Jane',lastName:'Smith',city:'Test city',zip:'77000',phone:'5550123'}},{employmentStatus:'applicant',answers:{firstName:'Other',lastName:'Person',email:'jane@example.invalid',job1_employer:'Jane Clinic',city:'Test city'}}],next:null})};
 const document={getElementById:el,createElement:node,querySelectorAll:()=>[],addEventListener:(key,fn)=>events.set(key,fn),visibilityState:'visible'},context=vm.createContext({window,document,URL:{revokeObjectURL(){}},setInterval(){},AbortController});vm.runInContext(fs.readFileSync(new URL('../public/assets/workforce-office-tools.js',import.meta.url),'utf8'),context);events.get('workforce-session')({detail:{grant:{offices:['100'],permissions:['applicants.review']}}});window.WorkforceOfficeTools.show('applicants');await new Promise(resolve=>setImmediate(resolve));
 for(const query of ['77000','5550123','example.invalid','Test city','Clinic']){el('applicant-search').value=query;el('applicant-search').oninput();assert.match(el('applicant-coverage').textContent,/Showing 0 of 2/);}
 for(const query of ['JANE','Smith','Jane Smith']){el('applicant-search').value=query;el('applicant-search').oninput();assert.match(el('applicant-coverage').textContent,/Showing 1 of 2/);}
});
