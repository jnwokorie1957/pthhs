import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Synthetic DOM and records exercise the actual controllers together, in page order.
function setup(request) {
 const nodes=new Map(),listeners=new Map(),requests=[];
 const make=(dataset={})=>({dataset,hidden:false,textContent:'',value:'',title:'',children:[],handlers:{},attrs:{},elements:new Proxy({},{get:(target,key)=>target[key]??=make()}),
  append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},reset(){},focus(){},querySelectorAll(){return [];},
  setAttribute(key,value){this.attrs[key]=value;},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},
  dispatchEvent(event){for(const fn of this.handlers[event.type]||[])fn(event);return this['on'+event.type]?.(event);},click(){return this.dispatchEvent({type:'click'});}});
 const el=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
 const views=['overview','accounts','applications','opportunities','access'],panels=views.map(managerPanel=>make({managerPanel})),links=views.map(managerGo=>make({managerGo}));
 const submitted=make({managerGo:'applications',managerFilter:'submitted'}),review=make({managerGo:'opportunities',managerFilter:'review'});links.push(submitted,review);
 const emit=(type,detail)=>{for(const fn of listeners.get(type)||[])fn({type,detail});};
 const document={getElementById:el,createElement:()=>make(),createTextNode:text=>({textContent:text}),querySelectorAll:selector=>selector==='[data-manager-panel]'?panels:selector==='[data-manager-go]'?links:[],addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatchEvent(event){emit(event.type,event.detail);}};
 const api=async path=>{requests.push(path);return request(path);};
 const window={workforceApi:api,open:()=>null};
 const context=vm.createContext({document,window,workforceApi:api,URLSearchParams,URL:{revokeObjectURL(){}},setTimeout,clearTimeout,Event:class {constructor(type){this.type=type;}},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}});
 for(const file of ['contract','management','staff','personnel'])vm.runInContext(fs.readFileSync(new URL('../public/assets/workforce-'+file+'.js',import.meta.url),'utf8'),context);
 return {el,emit,requests,submitted,review,nav:view=>links[views.indexOf(view)].click(),refreshApplications:()=>window.WorkforcePersonnel.refresh(),refreshOpportunities:()=>window.WorkforceRecruiting.refresh(),settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
const actor={grant:{role:'owner',offices:['office-a','office-b'],permissions:['opportunities.read','applications.review']}};
const app=(i,office='office-a')=>({uid:'synthetic-'+i,displayName:'Synthetic '+i,state:i%2?'draft':'submitted',office});
const opportunity=(i,office='office-a')=>({id:'synthetic-'+i,office,state:i%2?'review':'published',public:{location:'Synthetic area',recruitingZip:'77000',weeklyHours:20,schedule:'weekdays',assistance:[]}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

for(const extra of [0,1])test(`capped per-office lists (${50+extra}/${100+extra} candidates) share counts, coverage and filters`,async()=>{
 const applications={items:[...Array.from({length:50+extra},(_,i)=>app(i)).slice(0,50),app(100,'office-b')],limitPerOffice:50};
 const opportunities={items:[...Array.from({length:100+extra},(_,i)=>opportunity(i)).slice(0,100),opportunity(200,'office-b')],limitPerOffice:100};
 const s=setup(async path=>path==='/staff/applications'?applications:opportunities);s.emit('workforce-session',actor);await s.settle();
 assert.equal(s.requests.filter(path=>path==='/staff/applications').length,1);
 assert.equal(s.el('manager-count-applications').textContent,'26');assert.equal(s.el('manager-count-published').textContent,'51');
 for(const [kind,limit] of [['applications',50],['opportunities',100]]){
  const text=s.el('manager-'+kind+'-coverage').textContent;assert.match(text,/2 assigned offices/);assert.ok(text.includes('up to '+limit+' per office'));assert.match(text,/more records may exist/);assert.doesNotMatch(text,/truncated|complete total/i);
 }
 s.submitted.click();assert.equal(s.el('personnel-filter').value,'submitted');assert.equal(s.el('personnel-list').children.length,26);assert.match(s.el('personnel-coverage').textContent,/Showing 26 of 51 loaded/);
 s.nav('applications');assert.equal(s.el('personnel-filter').value,'');assert.equal(s.el('personnel-list').children.length,51);assert.equal(s.requests.filter(path=>path==='/staff/applications').length,1);
 s.el('staff-search').value='unrelated';s.review.click();assert.equal(s.el('staff-search').value,'');assert.equal(s.el('staff-filter').value,'review');assert.equal(s.el('staff-opportunities').children.length,50);assert.match(s.el('staff-coverage').textContent,/Showing 50 of 101 loaded/);
 s.nav('opportunities');assert.equal(s.el('staff-filter').value,'');assert.equal(s.el('staff-opportunities').children.length,101);
});

test('unloaded, failed and successful zero remain distinct in both lists and summaries',async()=>{
 const first=deferred();let response=()=>first.promise;const s=setup(()=>response());s.emit('workforce-session',actor);
 assert.equal(s.el('manager-count-applications').textContent,'—');assert.match(s.el('staff-coverage').textContent,/loading/);assert.equal(s.el('staff-opportunities').children.length,0);
 first.reject(Error('unavailable'));await s.settle();
 for(const kind of ['applications','opportunities']){assert.match(s.el('manager-'+kind+'-coverage').textContent,/unavailable/);}
 assert.equal(s.el('manager-count-published').textContent,'—');assert.equal(s.el('personnel-list').children.length,0);
 response=()=>({items:[],limitPerOffice:50});await s.el('manager-refresh').onclick();
 assert.equal(s.el('manager-count-applications').textContent,'0');assert.equal(s.el('manager-count-published').textContent,'0');assert.match(s.el('personnel-coverage').textContent,/Showing 0 of 0 loaded/);assert.doesNotMatch(s.el('manager-applications-coverage').textContent,/reached the read limit/);
});

test('a newer refresh wins and a failed refresh clears previous records and counts',async()=>{
 const pending=[];let fail=false;const s=setup(path=>path==='/staff/opportunities'?{items:[],limitPerOffice:100}:fail?Promise.reject(Error('failed')):(pending.push(deferred()),pending.at(-1).promise));
 s.emit('workforce-session',actor);const newer=s.refreshApplications();pending[1].resolve({items:[app(0)],limitPerOffice:50});await newer;pending[0].resolve({items:[app(0),app(2)],limitPerOffice:50});await s.settle();
 assert.equal(s.el('manager-count-applications').textContent,'1');assert.equal(s.el('personnel-list').children.length,1);
 fail=true;await s.refreshApplications();assert.equal(s.el('manager-count-applications').textContent,'—');assert.equal(s.el('personnel-list').children.length,0);assert.match(s.el('personnel-coverage').textContent,/unavailable/);
});

test('opportunity refreshes preserve filters and reject an older response or failure',async()=>{
 const pending=[];const s=setup(path=>path==='/staff/applications'?{items:[],limitPerOffice:50}:(pending.push(deferred()),pending.at(-1).promise));
 s.emit('workforce-session',actor);s.review.click();const newer=s.refreshOpportunities();pending[1].resolve({items:[opportunity(1)],limitPerOffice:100});await newer;pending[0].reject(Error('old failure'));await s.settle();
 assert.equal(s.el('manager-pipeline-review').textContent,'1');assert.equal(s.el('staff-filter').value,'review');assert.match(s.el('staff-coverage').textContent,/Showing 1 of 1 loaded/);
 const failed=s.refreshOpportunities();pending[2].reject(Error('current failure'));await failed;assert.equal(s.el('manager-pipeline-review').textContent,'—');assert.equal(s.el('staff-opportunities').children.length,0);assert.match(s.el('staff-coverage').textContent,/unavailable/);
});

test('an application filter change rejects a pending profile without changing summary scope',async()=>{
 const profile=deferred(),s=setup(path=>path==='/staff/applications'?{items:[app(0),app(1)],limitPerOffice:50}:path.startsWith('/staff/applications/')?profile.promise:{items:[],limitPerOffice:100});
 s.emit('workforce-session',actor);await s.settle();const opened=s.el('personnel-list').children[0].onclick();s.el('personnel-filter').value='draft';s.el('personnel-filter').onchange();
 profile.resolve({application:{state:'submitted',answers:{firstName:'Synthetic'}}});await opened;
 assert.equal(s.el('personnel-detail').children.length,0);assert.equal(s.el('manager-count-applications').textContent,'1');assert.match(s.el('personnel-coverage').textContent,/Showing 1 of 2 loaded/);
});

test('sign-out followed by a new session fences old application and opportunity responses',async()=>{
 const old=deferred();let response=()=>old.promise;const s=setup(()=>response());s.emit('workforce-session',actor);s.emit('workforce-session-cleared');
 for(const id of ['personnel-coverage','staff-coverage','manager-applications-coverage','manager-opportunities-coverage'])assert.equal(s.el(id).textContent,'');assert.equal(s.el('manager-scope').title,'');
 response=()=>({items:[],limitPerOffice:50});s.emit('workforce-session',actor);await s.settle();old.resolve({items:[app(0)],limitPerOffice:50});await s.settle();
 assert.equal(s.el('manager-count-applications').textContent,'0');assert.equal(s.el('manager-count-published').textContent,'0');assert.equal(s.el('personnel-list').children[0].textContent,'No applications in the loaded records.');
});

test('account support alone does not read either management list',async()=>{
 const s=setup(()=>{throw Error('unexpected read');});s.emit('workforce-session',{grant:{role:'hr',offices:['office-a'],permissions:['accounts.support']}});await s.settle();assert.equal(s.requests.length,0);
});

test('management markup provides named status filters and coverage adjacent to each list',()=>{
 const page=fs.readFileSync(new URL('../public/primetime/workforce.html',import.meta.url),'utf8');
 assert.match(page,/<label>Status<select id="personnel-filter">/);assert.match(page,/data-manager-go="applications" data-manager-filter="submitted"/);
 for(const id of ['staff-coverage','personnel-coverage','manager-applications-coverage','manager-opportunities-coverage'])assert.match(page,new RegExp('id="'+id+'"[^>]*role="status"'));
});
