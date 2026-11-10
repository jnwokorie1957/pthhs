import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const hhaSource=fs.readFileSync(new URL('../public/assets/workforce-hha.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../public/assets/workforce-personnel.js',import.meta.url),'utf8');
function setup(request){
 const nodes=new Map(),listeners=new Map(),sent=[],revoked=[],timers=new Map();let timerId=0;
 const make=()=>({hidden:true,value:'',attrs:{},setAttribute(key,value){this.attrs[key]=value;},children:[],append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},reportValidity:()=>true});
 const node=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
 const context=vm.createContext({document:{getElementById:node,createElement:make,addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatchEvent(){}},window:{open:()=>null,WorkforceSendPasswordReset:async email=>sent.push(email)},URL:{createObjectURL:()=> 'blob:private-preview',revokeObjectURL:url=>revoked.push(url)},workforceApi:(path,...args)=>path==='/staff/applications'?Promise.resolve({items:[],limitPerOffice:50}):request(path,...args),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}});vm.runInContext(fs.readFileSync(new URL('../public/assets/workforce-contract.js',import.meta.url),'utf8'),context);vm.runInContext(hhaSource,context);vm.runInContext(source,context);

 node('caregiver-account-name').value='Synthetic';
 const descendants=n=>[n,...n.children.flatMap(descendants)];
 return {node,sent,revoked,flush:async()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)await fn();},find:(id,text)=>descendants(node(id)).find(n=>n.textContent===text),emit:(type,detail)=>listeners.get(type)?.forEach(fn=>fn({detail:type==='workforce-session'?{...detail,grant:{...detail.grant,offices:['test-office']}}:detail})),search:()=>node('caregiver-account-search').onsubmit({preventDefault(){},currentTarget:node('caregiver-account-search')})};
}
const account={uid:'synthetic',email:'caregiver@example.invalid',providers:['password'],emailVerified:true,disabled:false,state:'draft',office:'test-office'};
const match={uid:'synthetic',firstName:'Synthetic',lastName:'Applicant',state:'draft'};
const actor={grant:{role:'owner',permissions:['accounts.support']}};
const application={state:'submitted',updatedAt:'2026-11-06',answers:{firstName:'Synthetic',lastName:'Applicant',phone:'(713) 555-0100',ssn:'000-00-1234',birthDate:'2000-01-01'},signature:null};
async function open(s){s.emit('workforce-session',actor);s.node('caregiver-account-name').value='Synthetic';await s.search();await s.find('caregiver-account-results','Applicant, Synthetic · Draft').onclick();}

test('management searches by name, selects the scoped profile and sends reset to its account email',async()=>{
 const requests=[],s=setup(async(path,body)=>{requests.push({path,body});return path.endsWith('/lookup')?{items:[match]}:path.endsWith('/reset')?{email:account.email}:account;});await open(s);
 assert.equal(requests[0].body.name,'Synthetic');assert.match(requests[1].path,/synthetic\/profile$/);
 const send=s.find('caregiver-account-detail','Send password reset email');assert.ok(send);await send.onclick();assert.deepEqual(s.sent,[account.email]);assert.match(requests[2].path,/synthetic\/reset$/);
 s.emit('workforce-session-cleared');assert.equal(s.node('caregiver-account-detail').children.length,0);assert.equal(s.node('caregiver-account-name').value,'');assert.equal(s.node('caregiver-account-support').hidden,true);
});

test('provider-managed accounts do not offer a local reset button',async()=>{
 const s=setup(async path=>path.endsWith('/lookup')?{items:[match]}:{...account,providers:['google.com']});await open(s);assert.ok(!s.find('caregiver-account-detail','Send password reset email'));assert.ok(s.find('caregiver-account-detail','Password recovery is managed by the sign-in provider.'));
});

test('a late name search cannot restore private results after sign-out',async()=>{
 let complete;const s=setup(()=>new Promise(resolve=>complete=resolve)),pending=s.search();s.emit('workforce-session-cleared');complete({items:[match]});await pending;assert.equal(s.node('caregiver-account-results').children.length,0);
});

test('profile shows contact, official forms and available documents, while quarantined PDF has no print action',async()=>{
 const s=setup(async path=>path.endsWith('/lookup')?{items:[match]}:path.endsWith('/profile')?account:path==='/application/packet'?{packet:{fields:[{section:'Contact information',id:'ssn',label:'SSN'},{section:'Contact information',id:'birthDate',label:'Date of birth'}]}}:path.endsWith('/documents')?{items:[{id:'id-photo',kind:'identity',state:'pending_review',createdAt:'2026-11-06'},{id:'ssn-pdf',kind:'social_security',state:'pending_security_review',createdAt:'2026-11-06'}]}:path.includes('/forms/')?{form:{state:'submitted',updatedAt:'2026-11-06'}}:{application});
 s.emit('workforce-session',{grant:{role:'owner',permissions:['accounts.support','applications.review','documents.review']}});await s.search();await s.find('caregiver-account-results','Applicant, Synthetic · Draft').onclick();
 for(const label of ['Contact information','Emergency contact','Employment forms','Private documents','Print complete packet','View / print application','View / print Form W-4','View / print Photo ID','***-**-1234'])assert.ok(s.find('caregiver-account-detail',label),label);
 assert.ok(!s.find('caregiver-account-detail','View / print Social Security card'));assert.ok(!s.find('caregiver-account-detail',application.answers.ssn));assert.ok(!s.find('caregiver-account-detail',application.answers.birthDate));
});

test('account support alone cannot request application or document records',async()=>{
 const requests=[],s=setup(async path=>{requests.push(path);return path.endsWith('/lookup')?{items:[match]}:account;});await open(s);assert.ok(!requests.some(path=>path.includes('/applications')));assert.ok(!s.find('caregiver-account-detail','View / print application'));
});

test('a stale profile response cannot replace a newer name search',async()=>{
 let complete;const s=setup(path=>path.endsWith('/lookup')?Promise.resolve({items:[match]}):new Promise(resolve=>complete=resolve));s.emit('workforce-session',actor);await s.search();const pending=s.find('caregiver-account-results','Applicant, Synthetic · Draft').onclick();await s.search();complete(account);await pending;assert.equal(s.node('caregiver-account-detail').children.length,0);
});

test('no results and truncated matches are explained without automatically choosing a person',async()=>{
 let response={items:[],hasMore:false};const s=setup(async()=>response);await s.search();assert.match(s.node('caregiver-account-message').textContent,/No matching/);response={items:[match],hasMore:true};await s.search();assert.match(s.node('caregiver-account-message').textContent,/narrow your search/);assert.equal(s.node('caregiver-account-detail').children.length,0);
});

test('complete packet print requests one private PDF and sign-out revokes its local preview URL',async()=>{
 const requests=[],s=setup(async path=>{requests.push(path);return path.endsWith('/lookup')?{items:[match]}:path.endsWith('/profile')?account:path==='/application/packet'?{packet:{fields:[]}}:path.endsWith('/documents')?{items:[]}:path.endsWith('/pdf')?{type:'application/pdf'}:path.includes('/forms/')?{form:null}:{application};});
 s.emit('workforce-session',{grant:{role:'owner',permissions:['accounts.support','applications.review','documents.review']}});await s.search();await s.find('caregiver-account-results','Applicant, Synthetic · Draft').onclick();await s.find('caregiver-account-detail','Print complete packet').onclick();
 assert.ok(requests.includes('/staff/applications/synthetic/packet/pdf'));assert.ok(s.find('caregiver-account-detail','Open PDF to view or print'));s.emit('workforce-session-cleared');assert.deepEqual(s.revoked,['blob:private-preview']);
});

test('typing starts a bounded name lookup and each new letter clears older matches immediately',async()=>{
 const requests=[],s=setup(async(path,body)=>{if(!body){requests.push(path);return {items:[],activeCount:0,next:null};}requests.push(body.name);return {items:body.name==='H'?[{...match,firstName:'Hannah'},{...match,uid:'second',firstName:'Henry'}]:[{...match,firstName:'Hannah'}]};});
 s.node('caregiver-account-name').value='H';s.node('caregiver-account-name').oninput({});assert.equal(requests.length,0);await s.flush();assert.equal(s.node('caregiver-account-results').children.length,2);
 s.node('caregiver-account-name').value='Han';s.node('caregiver-account-name').oninput({});assert.equal(s.node('caregiver-account-results').children.length,0);await s.flush();assert.equal(s.node('caregiver-account-results').children.length,1);assert.deepEqual(requests,['H','Han']);
 s.node('caregiver-account-name').value='';s.node('caregiver-account-name').oninput({});await s.flush();assert.deepEqual(requests,['H','Han','/staff/roster']);assert.equal(s.node('caregiver-account-results').children.length,0);
});

test('sign-out cancels a scheduled typeahead request',async()=>{
 let requests=0;const s=setup(async()=>{requests++;return {items:[]};});s.node('caregiver-account-name').value='H';s.node('caregiver-account-name').oninput({});s.emit('workforce-session-cleared');await s.flush();assert.equal(requests,0);
});

test('HHA selections keep source identity and never assume a portal account with the same name',async()=>{
 const requests=[],record={uid:'hha-101',hhaId:'101',source:'hhaexchange',firstName:'Hannah',lastName:'Hart',state:'Active',code:'DEMO-101'};
 const s=setup(async path=>{requests.push(path);return path.endsWith('/lookup')?{items:[record]}:{profile:{...record,id:'101',status:'Active',email:'legacy@example.invalid',fields:{}},files:{items:[]},accessEnabled:false};});s.emit('workforce-session',actor);await s.search();await s.find('caregiver-account-results','Hart, Hannah · HHAeXchange').onclick();
 assert.ok(requests.includes('/staff/roster/101/detail'));assert.ok(!requests.some(path=>path.includes('/accounts/hha-')||path.includes('/applications/')));assert.ok(s.find('caregiver-account-detail','Hannah Hart'));assert.ok(!s.find('caregiver-account-detail','Send password reset email'));
});

test('newly registered portal accounts have account support before their application starts',async()=>{
 const requests=[],s=setup(async path=>{requests.push(path);return path.endsWith('/lookup')?{items:[{...match,state:'not_started'}]}:{...account,state:'not_started'};});s.emit('workforce-session',{grant:{role:'owner',permissions:['accounts.support','applications.review']}});await s.search();await s.find('caregiver-account-results','Applicant, Synthetic · Not started').onclick();
 assert.ok(s.find('caregiver-account-detail','Application not started.'));assert.ok(s.find('caregiver-account-detail','Send password reset email'));assert.ok(!requests.some(path=>path.includes('/applications/')));
});
