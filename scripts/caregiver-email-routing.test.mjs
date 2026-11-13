import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../source/primetime/primetime.js',import.meta.url),'utf8');
function route(continuation,mode='signIn'){
 const action=new URL('https://pthhs.net/primetime');action.searchParams.set('mode',mode);action.searchParams.set('oobCode','synthetic-one-time-code');action.searchParams.set('apiKey','public-test-key');action.searchParams.set('email','untrusted@example.invalid');
 if(continuation!==undefined)action.searchParams.set('continueUrl',continuation);
 let redirected='',operationsStarted=false;
 try{vm.runInNewContext(source,{URL,location:{href:action.href,replace:value=>redirected=value},document:{querySelectorAll(){operationsStarted=true;throw Error('operations-started');}}});}catch(error){if(error.message!=='operations-started')throw error;}
 return {redirected,operationsStarted};
}
test('caregiver email links reach their portal before Operations initializes or consumes the code',()=>{
 for(const continuation of ['https://pthhs.net/caregiver','https://pthhs.net/caregiver/']){
  const result=route(continuation);assert.equal(result.operationsStarted,false);const target=new URL(result.redirected);assert.equal(target.origin,'https://pthhs.net');assert.equal(target.pathname,'/caregiver');assert.equal(target.searchParams.get('mode'),'signIn');assert.equal(target.searchParams.get('oobCode'),'synthetic-one-time-code');assert.equal(target.searchParams.get('apiKey'),'public-test-key');assert.equal(target.searchParams.has('email'),false);
 }
});
test('Operations links and untrusted destinations do not redirect',()=>{
 for(const continuation of [undefined,'https://pthhs.net/primetime','https://example.invalid/caregiver','https://pthhs.net.example.invalid/caregiver','javascript:alert(1)','https://pthhs.net/caregiver-extra']){const result=route(continuation);assert.equal(result.redirected,'');assert.equal(result.operationsStarted,true);}
 assert.equal(route('https://pthhs.net/caregiver','resetPassword').redirected,'');
});
