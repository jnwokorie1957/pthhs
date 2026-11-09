import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/workforce-management-auth.js',import.meta.url),'utf8');
function setup(overrides={}){
 const nodes=new Map(),events=new Map(),calls=[],messages=[];let submit;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,required:false,type:'password',attrs:{},reportValidity:()=>true,setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,fn){if(type==='submit')submit=fn;}});return nodes.get(id);};
 const auth={signInWithEmailAndPassword:async(email,password)=>calls.push({kind:'password',email,password}),sendSignInLinkToEmail:async(email,settings)=>calls.push({kind:'link',email,settings}),signInWithEmailLink:async(email,link)=>{calls.push({kind:'confirm',email,link});return {user:{uid:'verified-staff'}};},sendPasswordResetEmail:async(email,settings)=>calls.push({kind:'reset',email,settings}),...overrides};
 const window={},context=vm.createContext({window,document:{getElementById:node,addEventListener:(type,fn)=>events.set(type,fn)},location:{origin:'https://portal.example.invalid'}});vm.runInContext(source,context);
 const controller=window.WorkforceManagementAuth({form:node('workforce-login'),auth:()=>auth,session:async user=>calls.push({kind:'session',uid:user.uid}),message:text=>messages.push(text)});
 node('workforce-email').value='office@example.invalid';
 return {node,calls,messages,controller,submit:()=>submit({preventDefault(){}}),clear:()=>events.get('workforce-session-cleared')()};
}
test('management password is the default and is sent only through Firebase then cleared from the form',async()=>{const s=setup();assert.equal(s.node('staff-password-row').hidden,false);assert.equal(s.node('staff-password').required,true);s.node('staff-password').value='SyntheticPassword123!';await s.submit();assert.deepEqual(s.calls,[{kind:'password',email:'office@example.invalid',password:'SyntheticPassword123!'}]);assert.equal(s.node('staff-password').value,'');assert.ok(!s.calls.some(c=>c.kind==='session'));});
test('email link remains available without a password and returns to management',async()=>{const s=setup();s.node('staff-password').value='discarded';s.node('staff-link-method').onclick();assert.equal(s.node('staff-password').value,'');assert.equal(s.node('staff-password').required,false);assert.equal(s.node('staff-password-row').hidden,true);await s.submit();assert.equal(s.calls[0].kind,'link');assert.equal(s.calls[0].settings.url,'https://portal.example.invalid/workforce');assert.equal(s.calls[0].settings.handleCodeInApp,true);});
test('email-link confirmation never requires a password and consumes its token once',async()=>{const s=setup();s.controller.link('synthetic-link');assert.equal(s.node('staff-signin-methods').hidden,true);assert.equal(s.node('staff-password').required,false);await s.submit();assert.equal(s.calls[0].kind,'confirm');assert.equal(s.calls[1].uid,'verified-staff');assert.equal(s.controller.pending(),false);});
test('incorrect passwords receive generic errors and never expose the attempted password',async()=>{const s=setup({signInWithEmailAndPassword:async()=>{throw {code:'auth/invalid-credential'};}});s.node('staff-password').value='DoNotKeepThis123!';await s.submit();assert.equal(s.node('staff-password').value,'');assert.match(s.messages.at(-1),/Unable to sign in/);assert.doesNotMatch(s.messages.join(' '),/DoNotKeep/);assert.equal(s.node('workforce-login-button').disabled,false);});
test('forgot password validates the email only and sends a management return path',async()=>{const s=setup();await s.node('staff-forgot-password').onclick();assert.equal(s.calls[0].kind,'reset');assert.equal(s.calls[0].settings.url,'https://portal.example.invalid/workforce');assert.match(s.messages.at(-1),/If an account uses this email/);});
test('duplicate submissions and mode switching are blocked while Firebase is pending',async()=>{let finish;const s=setup({signInWithEmailAndPassword:()=>new Promise(resolve=>finish=resolve)});s.node('staff-password').value='SyntheticPassword123!';const pending=s.submit();await s.submit();s.node('staff-link-method').onclick();assert.equal(s.node('staff-password-row').hidden,false);assert.equal(s.node('workforce-login-button').disabled,true);finish();await pending;assert.equal(s.node('workforce-login-button').disabled,false);});
test('sign-out clears a revealed password and resets the sign-in method',()=>{const s=setup();s.node('staff-password').value='SyntheticPassword123!';s.node('staff-show-password').onclick();assert.equal(s.node('staff-password').type,'text');s.clear();assert.equal(s.node('staff-password').value,'');assert.equal(s.node('staff-password').type,'password');assert.equal(s.node('staff-show-password').attrs['aria-pressed'],'false');});
test('expired sign-in links recover to requesting a fresh link',async()=>{const s=setup({signInWithEmailLink:async()=>{throw {code:'auth/expired-action-code'};}});s.controller.link('expired');await s.submit();assert.equal(s.controller.pending(),false);assert.equal(s.node('staff-signin-methods').hidden,false);assert.equal(s.node('workforce-login-button').textContent,'Send sign-in link');assert.match(s.messages.at(-1),/Request a new link/);});

test('both served workforce paths initialize the staff sign-in and configuration', () => {
  const sessionScript = fs.readFileSync(new URL('../public/assets/workforce-session.js', import.meta.url), 'utf8');
  for (const [pathname, expected] of [
    ['/workforce', ['staff', '/primetime/workforce-api/configuration']],
    ['/workforce/', ['staff', '/primetime/workforce-api/configuration']],
    ['/primetime/workforce', ['staff', '/primetime/workforce-api/configuration']],
    ['/caregiver', ['caregiver']],
  ]) {
    const calls = [];
    vm.runInNewContext(sessionScript, {
      document: { getElementById: () => ({ addEventListener() {} }) },
      location: { pathname },
      window: {
        WorkforceAccount: { start: () => calls.push('caregiver') },
        WorkforceManagementAuth: () => { calls.push('staff'); return {}; },
      },
      fetch: async path => {
        calls.push(path);
        return { ok: true, json: async () => ({ staffEnabled: false }) };
      },
    });
    assert.deepEqual(calls, expected, pathname);
  }
});
