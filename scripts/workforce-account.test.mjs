import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/workforce-account.js',import.meta.url),'utf8');
function setup({enabled=true,api=async()=>({kind:'caregiver'})}={}) {
 const nodes=new Map(),events=[],calls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:true,listeners:{},setAttribute(){},focus(){},scrollIntoView(){},reportValidity:()=>true,addEventListener(type,fn){this.listeners[type]=fn;}});return nodes.get(id);};
 let onAuth;
 const auth={currentUser:null,setPersistence:async()=>{},onAuthStateChanged:fn=>onAuth=fn,createUserWithEmailAndPassword:async()=>{calls.push('create');return {user:{sendEmailVerification:async()=>{}}};},signInWithEmailAndPassword:async()=>calls.push('signin'),sendPasswordResetEmail:async()=>{calls.push('reset');throw {code:'auth/user-not-found'};},signOut:async()=>{auth.currentUser=null;await onAuth(null);}};
 const board={clear:()=>calls.push('clear'),open:async()=>calls.push('board')};
 const context=vm.createContext({window:{WorkforceBoard:board,WorkforceReview:{flush:async()=>{}}},document:{getElementById:node,dispatchEvent:e=>events.push(e.type)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},location:{search:'',pathname:'/caregiver',href:'http://localhost/caregiver',origin:'http://localhost'},history:{replaceState:()=>calls.push('history')},URL,URLSearchParams,firebase:{auth:{Auth:{Persistence:{SESSION:'session'}}}},fetch:async()=>({ok:true,json:async()=>({accountsEnabled:enabled})}),setTimeout:()=>{}});
 vm.runInContext(source,context);
 return {node,auth,calls,events,start:()=>context.window.WorkforceAccount.start({createAuth:()=>auth,api}),session:user=>{auth.currentUser=user;return onAuth(user);},submit:()=>node('workforce-login').listeners.submit({preventDefault(){}})};
}
const verified={email:'test@example.invalid',emailVerified:true,getIdToken:async()=>''};
test('unverified accounts cannot open the board; verified accounts can',async()=>{
 let requests=0;const s=setup({api:async()=>{requests++;return {};}});await s.start();
 await s.session({...verified,emailVerified:false});assert.equal(requests,0);assert.ok(!s.calls.includes('board'));assert.equal(s.node('account-verification').hidden,false);
 await s.session(verified);assert.equal(requests,1);assert.ok(s.calls.includes('board'));
});
test('stale session result cannot reopen private content after sign-out',async()=>{
 let complete;const s=setup({api:()=>new Promise(resolve=>complete=resolve)});await s.start();const pending=s.session(verified);await Promise.resolve();
 s.node('workforce-email').value='test@example.invalid';s.node('workforce-password').value='secret';await s.node('workforce-signout').onclick();complete({});await pending;
 assert.ok(!s.calls.includes('board'));assert.equal(s.node('workforce-email').value,'');assert.equal(s.node('workforce-password').value,'');assert.equal(s.node('caregiver-summary').hidden,true);assert.ok(s.events.includes('workforce-session-cleared'));
});
test('mismatched confirmation does not create an account',async()=>{
 const s=setup();await s.start();s.node('account-create').onclick();s.node('workforce-password').value='long-password';s.node('workforce-password-confirm').value='different';await s.submit();assert.ok(!s.calls.includes('create'));assert.match(s.node('session-status').textContent,/do not match/);
});
test('password recovery does not disclose whether an email exists',async()=>{
 const s=setup();await s.start();s.node('account-forgot').onclick();await s.submit();assert.ok(s.calls.includes('reset'));assert.match(s.node('session-status').textContent,/If an account uses this email/);
});
test('closed release gates prevent account creation',async()=>{
 const s=setup({enabled:false});await s.start();s.node('account-create').onclick();await s.submit();assert.ok(!s.calls.includes('create'));assert.equal(s.node('workforce-login-button').disabled,true);
});
test('returning to openings clears the previous selected-position URL',async()=>{
 const s=setup();await s.start();await s.session(verified);await s.node('dashboard-jobs').onclick();assert.ok(s.calls.includes('history'));assert.equal(s.calls.filter(c=>c==='board').length,2);
});
