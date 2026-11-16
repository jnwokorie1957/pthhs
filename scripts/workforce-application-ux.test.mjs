import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {portalLinks,removeCareersFromSitemap} from './retire-careers.mjs';
test('Careers retirement keeps one recruiting link and preserves unrelated markup',()=>{
 assert.equal(portalLinks('<nav><a href="/about">About</a><a href="/home-care-careers">Careers</a><a href="/caregiver">Caregiver Portal</a></nav>'),'<nav><a href="/about">About</a><a href="/caregiver">Caregiver Portal</a></nav>');
 assert.equal(portalLinks('<nav><a href="/home-care-careers">Careers</a></nav><p>Unrelated content</p>'),'<nav><a href="/caregiver">Caregiver Portal</a></nav><p>Unrelated content</p>');
 assert.equal(removeCareersFromSitemap('<urlset><url><loc>https://pthhs.net/home-care-careers</loc><lastmod>2026-11-11</lastmod></url><url><loc>https://pthhs.net/</loc></url></urlset>'),'<urlset><url><loc>https://pthhs.net/</loc></url></urlset>');
});
test('frontend age boundary agrees with Chicago birthday rather than UTC date',()=>{
 const ctx=vm.createContext({URLSearchParams,Intl});vm.runInContext(fs.readFileSync('public/assets/workforce-contract.js','utf8'),ctx);const c=ctx.WorkforceContract;
 assert.equal(c.adultCutoff(new Date('2026-11-12T04:00:00Z')),'2008-11-11');assert.equal(c.isAdult('2008-11-11',new Date('2026-11-12T04:00:00Z')),true);assert.equal(c.isAdult('2008-11-12',new Date('2026-11-12T04:00:00Z')),false);assert.equal(c.isAdult('2008-02-30'),false);
});

test('application packet loading uses the signed-in API and surfaces access failures',async()=>{
 const listeners={},nodes=new Map(),calls=[];const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},prepend(){},append(){},replaceChildren(){},addEventListener(){},querySelector(){return null;}});return nodes.get(id);};
 const context=vm.createContext({document:{getElementById:node,querySelector:node,createElement:node,addEventListener:(type,callback)=>listeners[type]=callback},window:{},WorkforceContract:{reviewNavigationAllowed:()=>false},location:{hostname:'pthhs.net'},workforceApi:async path=>{calls.push(path);throw Error('Sign in required.');},fetch:()=>{throw Error('Unauthenticated fetch is forbidden');},setTimeout,clearTimeout,URL,URLSearchParams});
 vm.runInContext(fs.readFileSync('public/assets/workforce-application.js','utf8'),context);await listeners['workforce-caregiver-session']({detail:{}});assert.deepEqual(calls,['/application/packet','/application']);assert.equal(node('application-message').textContent,'Sign in required.');
});

test('submitted older applications render recorded answers without editing or migration',async()=>{
 const listeners={},nodes=new Map();const make=()=>({hidden:false,children:[],textContent:'',style:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},prepend(...n){this.children.unshift(...n);},append(...n){this.children.push(...n);},replaceChildren(...n){this.children=n;},addEventListener(){},querySelector(){return null;}});const node=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
 const recorded={uid:'sample',state:'submitted',revision:2,packetVersion:'historical-v1',submittedAt:'2026-11-15T12:00:00Z',answers:{firstName:'Jordan',lastName:'Taylor',ssn:'000001234',previousQuestion:'Recorded answer'},signature:{name:'Jordan Taylor',signedAt:'2026-11-15T12:00:00Z'}};
 const context=vm.createContext({document:{getElementById:node,querySelector:node,createElement:make,addEventListener:(type,callback)=>listeners[type]=callback},window:{},WorkforceContract:{reviewNavigationAllowed:()=>false,selectedId:()=>null},location:{hostname:'pthhs.net',search:''},workforceApi:async path=>path==='/application/packet'?{packet:{version:'current-v2',fields:[{id:'firstName',label:'First name',section:'Contact'}]},inventory:[]}:{application:recorded},setTimeout,clearTimeout,queueMicrotask,URL,URLSearchParams,Intl});
 vm.runInContext(fs.readFileSync('public/assets/workforce-application.js','utf8'),context);await listeners['workforce-caregiver-session']({detail:{navigation:{applicationId:'primary'}}});
 assert.equal(node('application-status-badge').textContent,'Submitted · view only');assert.equal(node('application-navigation').hidden,true);assert.equal(node('application-signature').hidden,true);assert.equal(node('private-documents').hidden,true);assert.equal(node('application-steps').hidden,true);
 const all=element=>[element.textContent,...element.children.flatMap(child=>typeof child==='object'?all(child):[child])].join(' ');assert.match(all(node('application-fields')),/Recorded answer/);assert.ok(!all(node('application-fields')).includes('000001234'));assert.equal(node('caregiver-application').hidden,false);assert.ok(!/must review/.test(node('application-message').textContent));
});
