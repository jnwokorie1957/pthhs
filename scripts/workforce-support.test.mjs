import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/workforce-personnel.js',import.meta.url),'utf8');
function setup(request){
 const nodes=new Map(),listeners=new Map(),sent=[];
 const make=()=>({hidden:true,value:'',children:[],append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},reportValidity:()=>true});
 const node=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
 const context=vm.createContext({document:{getElementById:node,createElement:make,addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}},window:{WorkforceSendPasswordReset:async email=>sent.push(email)},workforceApi:request});vm.runInContext(source,context);
 return {node,sent,emit:(type,detail)=>listeners.get(type)?.forEach(fn=>fn({detail})),search:()=>node('caregiver-account-search').onsubmit({preventDefault(){},currentTarget:node('caregiver-account-search')})};
}
const account={uid:'synthetic',email:'caregiver@example.invalid',providers:['password'],emailVerified:true,disabled:false,state:'draft',office:'test-office'};
test('management sends reset using the scoped account email and clears on sign-out',async()=>{
 const requests=[],s=setup(async(path,body)=>{requests.push({path,body});return path.endsWith('/reset')?{email:account.email}:account;});s.emit('workforce-session',{grant:{role:'owner',permissions:['accounts.support']}});assert.equal(s.node('caregiver-account-support').hidden,false);
 s.node('caregiver-account-email').value=account.email;await s.search();const send=s.node('caregiver-account-detail').children.find(n=>n.textContent==='Send password reset email');assert.ok(send);await send.onclick();assert.deepEqual(s.sent,[account.email]);assert.match(requests[1].path,/synthetic\/reset$/);
 s.emit('workforce-session-cleared');assert.equal(s.node('caregiver-account-detail').children.length,0);assert.equal(s.node('caregiver-account-email').value,'');assert.equal(s.node('caregiver-account-support').hidden,true);
});
test('provider-managed accounts do not offer a local reset button',async()=>{
 const s=setup(async()=>({...account,providers:['google.com']}));await s.search();assert.ok(!s.node('caregiver-account-detail').children.some(n=>n.textContent==='Send password reset email'));assert.ok(s.node('caregiver-account-detail').children.some(n=>n.textContent.includes('managed by the sign-in provider')));
});
test('a late account search cannot restore private content after sign-out',async()=>{
 let complete;const s=setup(()=>new Promise(resolve=>complete=resolve)),pending=s.search();s.emit('workforce-session-cleared');complete(account);await pending;assert.equal(s.node('caregiver-account-detail').children.length,0);
});
