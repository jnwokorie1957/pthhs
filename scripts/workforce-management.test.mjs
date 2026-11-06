import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/workforce-management.js',import.meta.url),'utf8');
function setup(request=async()=>({items:[]})){
 const elements=new Map(),events=new Map();
 const make=(dataset={})=>({dataset,hidden:true,textContent:'',value:'',attrs:{},handlers:{},clicks:0,setAttribute(key,value){this.attrs[key]=value;},focus(){},addEventListener(name,fn){this.handlers[name]=fn;},dispatchEvent(event){this.handlers[event.type]?.(event);},click(){this.clicks++;this.handlers.click?.();this.onclick?.();}});
 const el=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const names=['overview','accounts','applications','opportunities','access'],panels=names.map(managerPanel=>make({managerPanel})),links=names.map(managerGo=>make({managerGo,managerView:managerGo}));
 const features=[make({managerFeature:'opportunities'})];
 const doc={getElementById:el,querySelectorAll:selector=>selector==='[data-manager-panel]'?panels:selector==='[data-manager-feature]'?features:links,addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
 const context=vm.createContext({document:doc,window:{workforceApi:request,WorkforceRecruiting:{refresh:async()=>{}}},Event:class{constructor(type){this.type=type;}},Promise});vm.runInContext(fs.readFileSync(new URL('../public/assets/workforce-contract.js',import.meta.url),'utf8'),context);vm.runInContext(source,context);
 const emit=(name,detail)=>events.get(name)?.forEach(fn=>fn({detail}));
 return {el,panels,links,features,show:context.window.WorkforceManagement.show,emit,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
const owner={grant:{role:'owner',offices:['office-a'],permissions:['opportunities.read','opportunities.edit','applications.review','accounts.support','staff.manage']}};
test('staff workspace shows one task at a time without a second inbox read on navigation',async()=>{
 const s=setup();s.emit('workforce-session',owner);await s.settle();assert.equal(s.panels.filter(p=>!p.hidden).length,1);assert.equal(s.panels[0].hidden,false);
 s.show('accounts');assert.equal(s.panels[1].hidden,false);assert.equal(s.panels[0].hidden,true);
 s.show('applications');s.show('applications');assert.equal(s.el('personnel-refresh').clicks,0);assert.equal(s.panels[2].hidden,false);
});
test('restricted staff cannot navigate to owner or unrelated data tools',()=>{
 const s=setup();s.emit('workforce-session',{grant:{role:'hr',offices:['office-a'],permissions:['accounts.support']}});
 assert.equal(s.show('access'),false);assert.equal(s.show('applications'),false);assert.equal(s.show('opportunities'),false);assert.equal(s.show('accounts'),true);
 assert.equal(s.links.find(link=>link.dataset.managerGo==='access').hidden,true);assert.equal(s.features[0].hidden,true);
});
test('summary cards reflect received states and never substitute a failed count with zero',async()=>{
 const s=setup();s.emit('workforce-session',owner);s.emit('workforce-applications-updated',{state:'unavailable'});assert.equal(s.el('manager-count-applications').textContent,'—');assert.match(s.el('manager-applications-coverage').textContent,/unavailable/);
 s.emit('workforce-opportunities-updated',{items:['draft','draft','review','approved','published','published','published','published'].map(state=>({state,office:'office-a'})),limitPerOffice:100});assert.equal(s.el('manager-count-published').textContent,'4');assert.equal(s.el('manager-pipeline-review').textContent,'1');
});
test('sign-out clears all management summaries and ignores later list events',async()=>{
 const s=setup();s.emit('workforce-session',owner);s.emit('workforce-session-cleared');s.emit('workforce-applications-updated',{items:[{state:'submitted'}],limitPerOffice:50});await s.settle();
 assert.equal(s.el('manager-nav').hidden,true);assert.equal(s.el('manager-count-applications').textContent,'—');assert.ok(s.panels.every(panel=>panel.hidden));assert.equal(s.show('accounts'),false);
});
