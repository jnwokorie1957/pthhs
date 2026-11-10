import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/workforce-management-auth.js',import.meta.url),'utf8');
function setup(overrides={}){
 const nodes=new Map(),events=new Map(),calls=[],messages=[];let submit;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,required:false,type:'password',attrs:{},reportValidity:()=>true,focus(){},setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,fn){if(type==='submit')submit=fn;}});return nodes.get(id);};
 const auth={signInWithEmailAndPassword:async(email,password)=>{calls.push({kind:'password',email,password});return {user:{uid:'verified-staff'}};},sendSignInLinkToEmail:async(email,settings)=>calls.push({kind:'link',email,settings}),signInWithEmailLink:async(email,link)=>{calls.push({kind:'confirm',email,link});return {user:{uid:'verified-staff'}};},...overrides};
 const window={},context=vm.createContext({window,document:{getElementById:node,addEventListener:(type,fn)=>events.set(type,fn)},location:{origin:'https://portal.example.invalid'}});vm.runInContext(source,context);
 const controller=window.WorkforceManagementAuth({form:node('workforce-login'),auth:()=>auth,session:async user=>calls.push({kind:'session',uid:user.uid}),message:text=>messages.push(text),api:async(path,body)=>{calls.push({kind:'api',path,body});return {email:'office@example.invalid',saved:true};}});
 node('workforce-email').value='office@example.invalid';
 return {node,calls,messages,controller,submit:()=>submit({preventDefault(){}}),clear:()=>events.get('workforce-session-cleared')()};
}
test('management password is the default and is sent only through Firebase then cleared from the form',async()=>{const s=setup();assert.equal(s.node('staff-password-row').hidden,false);assert.equal(s.node('staff-password').required,true);s.node('staff-password').value='SyntheticPassword123!';await s.submit();assert.deepEqual(s.calls,[{kind:'password',email:'office@example.invalid',password:'SyntheticPassword123!'}]);assert.equal(s.node('staff-password').value,'');assert.ok(!s.calls.some(c=>c.kind==='session'));});
test('email-link confirmation never requires a password and consumes its token once',async()=>{const s=setup();s.controller.link('synthetic-link');assert.equal(s.node('staff-password').required,false);await s.submit();assert.equal(s.calls[0].kind,'confirm');assert.equal(s.calls[1].uid,'verified-staff');assert.equal(s.controller.pending(),false);});
test('incorrect passwords receive generic errors and never expose the attempted password',async()=>{const s=setup({signInWithEmailAndPassword:async()=>{throw {code:'auth/invalid-credential'};}});s.node('staff-password').value='DoNotKeepThis123!';await s.submit();assert.equal(s.node('staff-password').value,'');assert.match(s.messages.at(-1),/Unable to sign in/);assert.doesNotMatch(s.messages.join(' '),/DoNotKeep/);assert.equal(s.node('workforce-login-button').disabled,false);});
test('forgot password opens recovery for an active staff account', async () => {
  const s = setup();
  s.node('staff-forgot-password').onclick();
  assert.equal(s.node('staff-password-row').hidden, true);
  assert.equal(s.node('workforce-email').type, 'email');
  await s.submit();
  assert.equal(s.calls[0].path, '/staff-auth/password-setup');
  assert.equal(s.calls[0].body.email, 'office@example.invalid');
  assert.match(s.messages.at(-1), /active staff account/);
});
test('a password setup link asks for a new password before access and accepts the eight-character minimum', async () => {
  const s = setup();
  s.controller.link('synthetic-setup-link', true);
  assert.equal(s.node('workforce-login-button').textContent, 'Continue');
  await s.submit();
  s.controller.setup('office@example.invalid');
  assert.equal(s.node('staff-login-heading').textContent, 'Create a password');
  assert.equal(s.node('staff-identifier-label').textContent, 'Verified work email');
  assert.equal(s.node('workforce-email').readOnly, true);
  assert.equal(s.node('workforce-email').value, 'office@example.invalid');
  s.node('staff-new-password').value = 'Demo12!';
  s.node('staff-confirm-password').value = 'Demo12!';
  await s.submit();
  assert.match(s.messages.at(-1), /at least 8 characters/);
  assert.ok(!s.calls.some(call => call.kind === 'api'));
  s.node('staff-new-password').value = 'Demo123!';
  s.node('staff-confirm-password').value = 'Demo123!';
  s.node('staff-new-username').value = 'demo.staff';
  await s.submit();
  assert.equal(s.calls[2].path, '/staff-auth/credentials');
  assert.deepEqual(s.calls[3], {kind:'password',email:'office@example.invalid',password:'Demo123!'});
  s.clear();
  assert.equal(s.node('staff-login-heading').textContent, 'Welcome to your workspace');
  s.node('workforce-email').value = 'demo.staff';
  s.node('staff-forgot-password').onclick();
  assert.equal(s.node('workforce-email').readOnly, false);
  assert.equal(s.node('workforce-email').value, 'office@example.invalid');
});
test('username sign-in verifies the password through the staff resolver before Firebase sign-in', async () => {
  const s = setup();
  s.node('workforce-email').value = 'demo.staff';
  s.node('staff-password').value = 'Demo123!';
  await s.submit();
  assert.equal(s.calls[0].path, '/staff-auth/resolve-username');
  assert.deepEqual(s.calls[1], {kind:'password',email:'office@example.invalid',password:'Demo123!'});
});
test('duplicate submissions and mode switching are blocked while Firebase is pending',async()=>{let finish;const s=setup({signInWithEmailAndPassword:()=>new Promise(resolve=>finish=resolve)});s.node('staff-password').value='SyntheticPassword123!';const pending=s.submit();await s.submit();s.node('staff-forgot-password').onclick();assert.equal(s.node('staff-password-row').hidden,false);assert.equal(s.node('workforce-login-button').disabled,true);finish();await pending;assert.equal(s.node('workforce-login-button').disabled,false);});
test('sign-out clears a revealed password and resets the sign-in method',()=>{const s=setup();s.node('staff-password').value='SyntheticPassword123!';s.node('staff-show-password').onclick();assert.equal(s.node('staff-password').type,'text');s.clear();assert.equal(s.node('staff-password').value,'');assert.equal(s.node('staff-password').type,'password');assert.equal(s.node('staff-show-password').attrs['aria-pressed'],'false');});
test('expired invitation links return to password sign-in',async()=>{const s=setup({signInWithEmailLink:async()=>{throw {code:'auth/expired-action-code'};}});s.controller.link('expired');await s.submit();assert.equal(s.controller.pending(),false);assert.equal(s.node('staff-password-row').hidden,false);assert.equal(s.node('workforce-login-button').textContent,'Sign in');assert.match(s.messages.at(-1),/new invitation/);});

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
