import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/workforce-account.js',import.meta.url),'utf8');
function setup({enabled=true,search='',invalidCode=false,providers=[],providerOnly=false,existingAccessEnabled=false,existingCaregiverEnrollmentReady=true,api=async()=>({kind:'caregiver'})}={}) {
 const nodes=new Map(),events=[],calls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:true,children:[],append(child){this.children.push(child);},listeners:{},attrs:{},setAttribute(key,value){this.attrs[key]=value;},focus(){},scrollIntoView(){},reportValidity:()=>true,addEventListener(type,fn){this.listeners[type]=fn;}});return nodes.get(id);};
 let onAuth;
 const auth={currentUser:null,setPersistence:async()=>{},onAuthStateChanged:fn=>onAuth=fn,createUserWithEmailAndPassword:async()=>{calls.push('create');return {user:{updateProfile:async value=>calls.push(["profile",value.displayName]),sendEmailVerification:async()=>{}}};},signInWithEmailAndPassword:async()=>calls.push('signin'),sendPasswordResetEmail:async()=>{calls.push('reset');throw {code:'auth/user-not-found'};},signOut:async()=>{auth.currentUser=null;await onAuth(null);}};
 auth.verifyPasswordResetCode=async()=>{if(invalidCode)throw Error();calls.push('verify-code');return 'test@example.invalid';};auth.confirmPasswordReset=async(code,password)=>calls.push(['confirm-reset',code,password]);
 const board={clear:()=>calls.push('clear'),open:async()=>calls.push('board')};
 auth.signInWithPopup=async provider=>calls.push(['provider',provider.providerId]);let nextNode=0;
 const context=vm.createContext({window:{WorkforceNavigation:{mount:()=>calls.push("portal"),applicationOpened:()=>{}},WorkforceBoard:board,WorkforceReview:{flush:async()=>{}}},document:{createElement:()=>node('created-'+nextNode++),getElementById:node,dispatchEvent:e=>events.push(e.type)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},location:{search,pathname:'/caregiver',href:'http://localhost/caregiver'+search,origin:'http://localhost'},history:{replaceState:()=>calls.push('history')},URL,URLSearchParams,firebase:{auth:{Auth:{Persistence:{SESSION:'session'}},GoogleAuthProvider:class{constructor(){this.providerId='google.com';}setCustomParameters(params){calls.push(['google-parameters',params.prompt]);}},OAuthProvider:class{constructor(id){this.providerId=id;}}}},fetch:async()=>({ok:true,json:async()=>({accountsEnabled:enabled,enabledSignInProviders:providers,providerOnly,existingAccessEnabled,existingCaregiverEnrollmentReady})}),setTimeout:()=>{}});
 vm.runInContext(source,context);
 return {node,auth,calls,events,start:()=>context.window.WorkforceAccount.start({createAuth:()=>auth,api}),session:user=>{auth.currentUser=user;return onAuth(user);},submit:()=>node('workforce-login').listeners.submit({preventDefault(){}})};
}
const verified={email:'test@example.invalid',emailVerified:true,getIdToken:async()=>''};
test('unverified accounts cannot open the portal; verified accounts can',async()=>{
 let requests=0;const s=setup({api:async()=>{requests++;return {};}});await s.start();
 await s.session({...verified,emailVerified:false});assert.equal(requests,0);assert.ok(!s.calls.includes('portal'));assert.equal(s.node('account-verification').hidden,false);
 await s.session(verified);assert.equal(requests,1);assert.ok(s.calls.includes('portal'));
});
test('stale session result cannot reopen private content after sign-out',async()=>{
 let complete;const s=setup({api:()=>new Promise(resolve=>complete=resolve)});await s.start();const pending=s.session(verified);await Promise.resolve();
 s.node('workforce-email').value='test@example.invalid';s.node('workforce-password').value='secret';await s.node('workforce-signout').onclick();complete({});await pending;
 assert.ok(!s.calls.includes('portal'));assert.equal(s.node('workforce-email').value,'');assert.equal(s.node('workforce-password').value,'');assert.equal(s.node('caregiver-summary').hidden,true);assert.ok(s.events.includes('workforce-session-cleared'));
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
 const s=setup();await s.start();await s.session(verified);await s.node('dashboard-jobs').onclick();assert.ok(s.calls.includes('history'));assert.equal(s.calls.filter(c=>c==='portal').length,2);
});
test('signed-in reset is an isolated screen and returns to the portal',async()=>{
 const s=setup();await s.start();await s.session(verified);s.node('job-board').hidden=false;s.node('caregiver-summary').hidden=false;
 await s.node('dashboard-password').onclick();for(const id of ['job-board','caregiver-summary','caregiver-dashboard','account-tabs','account-forgot'])assert.equal(s.node(id).hidden,true,id);
 assert.equal(s.node('account-gateway').hidden,false);assert.equal(s.node('password-row').hidden,true);assert.equal(s.node('workforce-email').value,verified.email);assert.equal(s.node('workforce-email').readOnly,true);
 await s.node('account-back').onclick();assert.equal(s.node('account-gateway').hidden,true);assert.equal(s.node('caregiver-dashboard').hidden,false);
});
test('reset email action validates the code and only shows password fields',async()=>{
 const s=setup({search:'?mode=resetPassword&oobCode=synthetic-code'});await s.start();assert.ok(s.calls.includes('verify-code'));assert.ok(s.calls.includes('history'));
 assert.equal(s.node('email-row').hidden,true);assert.equal(s.node('account-tabs').hidden,true);assert.equal(s.node('confirm-password-row').hidden,false);
 s.node('workforce-password').value='SyntheticPassword123!';s.node('workforce-password-confirm').value='SyntheticPassword123!';await s.submit();assert.ok(s.calls.some(call=>Array.isArray(call)&&call[0]==='confirm-reset'&&call[1]==='synthetic-code'));assert.equal(s.node('workforce-password').value,'');assert.match(s.node('session-status').textContent,/password has been updated/);
});
test('invalid reset links cannot show the password editor or private workspace',async()=>{
 const s=setup({search:'?mode=resetPassword&oobCode=expired',invalidCode:true});await s.start();assert.equal(s.node('workforce-login').hidden,true);assert.equal(s.node('job-board').hidden,true);assert.match(s.node('account-title').textContent,/Link unavailable/);
});

test('configured providers use Firebase OAuth and stay hidden on reset screens',async()=>{
 const s=setup({providers:['google.com','apple.com','not-supported']});await s.start();assert.equal(s.node('account-providers').children.length,2);const google=s.node('account-providers').children[0];assert.equal(google.attrs['aria-label'],'Sign in with Google');assert.equal(google.children[0].alt,'');assert.match(google.children[0].src,/^data:image\/png;base64,/);assert.ok(!google.textContent);await s.node('account-providers').children[0].onclick();assert.ok(s.calls.some(call=>Array.isArray(call)&&call[0]==='provider'&&call[1]==='google.com'));assert.ok(s.calls.some(call=>Array.isArray(call)&&call[0]==='google-parameters'&&call[1]==='select_account'));assert.ok(!s.calls.includes('portal'));s.node('account-forgot').onclick();assert.equal(s.node('account-providers').hidden,true);assert.equal(s.node('account-help').hidden,true);
});
test('provider-managed accounts receive sign-in help instead of a local password reset',async()=>{
 const s=setup();await s.start();await s.session({...verified,providerData:[{providerId:'google.com'}]});await s.node('dashboard-password').onclick();assert.equal(s.node('workforce-login').hidden,true);assert.match(s.node('account-description').textContent,/managed by Google/);assert.ok(!s.calls.includes('reset'));
});

test('real sign-in test keeps password forms and applications closed',async()=>{
 const s=setup({providerOnly:true,providers:['google.com'],api:async()=>({applicationsEnabled:false})});await s.start();assert.equal(s.node('workforce-login').hidden,true);await s.session(verified);assert.equal(s.node('dashboard-application').hidden,true);await s.node('dashboard-application').onclick();assert.equal(s.node('caregiver-summary').hidden,true);
});

test('signup collects the caregiver name and keeps name fields off sign-in and reset screens',async()=>{
 const s=setup();await s.start();assert.equal(s.node('account-names').hidden,true);s.node('account-create').onclick();assert.equal(s.node('account-names').hidden,false);assert.equal(s.node('account-first-name').required,true);
 s.node('account-first-name').value='Hannah';s.node('account-last-name').value='Howard';s.node('workforce-password').value='SyntheticPassword123!';s.node('workforce-password-confirm').value='SyntheticPassword123!';await s.submit();assert.ok(s.calls.some(call=>Array.isArray(call)&&call[0]==='profile'&&call[1]==='Hannah Howard'));
 s.node('account-forgot').onclick();assert.equal(s.node('account-names').hidden,true);assert.equal(s.node('account-first-name').required,false);
});

test('existing caregiver access is an isolated email-only request and does not use an HHA password',async()=>{
 const requests=[],s=setup({existingAccessEnabled:true,api:async(path,body)=>{requests.push({path,body});return {requested:true};}});await s.start();s.node('account-existing').onclick();
 assert.equal(s.node('password-row').hidden,true);assert.equal(s.node('account-names').hidden,true);assert.equal(s.node('account-providers').hidden,true);assert.equal(s.node('job-board').hidden,true);assert.match(s.node('account-description').textContent,/HHAeXchange/);
 s.node('workforce-email').value='legacy@example.invalid';await s.submit();assert.equal(requests[0].path,'/existing-caregiver/access');assert.equal(requests[0].body.email,'legacy@example.invalid');assert.match(s.node('session-status').textContent,/If your email matches/);assert.ok(!s.calls.includes('signin')&&!s.calls.includes('reset'));
});

test('existing access remains hidden until its separate release configuration is enabled',async()=>{
 const s=setup();await s.start();assert.equal(s.node('account-existing').hidden,true);
});

test('existing HHA caregivers do not enter the new-applicant application or identity-upload pathway',async()=>{const s=setup({api:async()=>({applicationsEnabled:true,existingCaregiver:true})});await s.start();await s.session(verified);assert.equal(s.node('dashboard-application').hidden,true);await s.node('dashboard-application').onclick();assert.equal(s.node('caregiver-summary').hidden,true);});

test('initial HHA preparation explains the wait instead of claiming that an access email was sent',async()=>{const requests=[],s=setup({existingAccessEnabled:true,existingCaregiverEnrollmentReady:false,search:'?intent=existing',api:async path=>requests.push(path)});await s.start();assert.match(s.node('account-description').textContent,/profiles are being prepared/);assert.equal(s.node('workforce-login-button').disabled,true);await s.submit();assert.equal(requests.length,0);s.node('account-back').onclick();assert.equal(s.node('workforce-login-button').disabled,false);});
