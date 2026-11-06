import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import http from 'node:http';import {fileURLToPath} from 'node:url';
import {createAuthPreview} from './serve-workforce-auth-preview.mjs';
async function setup(t){
 const server=createAuthPreview({root:fileURLToPath(new URL('../public/',import.meta.url)),config:{projectId:'test',apiKey:'public-sdk-key',authDomain:'test.firebaseapp.com',clientSecret:'never-return'},sdkSource:async()=>'',verifyIdentity:async req=>{if(req.headers.authorization!=='Bearer signed-google')throw Object.assign(Error('unauthorized'),{status:401});return 'verified-google-uid';}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const origin='http://127.0.0.1:'+server.address().port;
 return {origin,get:(route,options={})=>fetch(origin+route,options)};
}
test('real-auth preview never exposes sample openings or a session anonymously',async t=>{
 const s=await setup(t);for(const route of ['/opportunities','/application/session']){const response=await s.get('/caregiver/workforce-api'+route);assert.equal(response.status,401);assert.ok(!(await response.text()).includes('Houston'));}
 const session=await s.get('/caregiver/workforce-api/application/session',{headers:{Authorization:'Bearer signed-google'}});const data=await session.json();assert.equal(data.uid,'verified-google-uid');assert.equal(data.applicationsEnabled,false);assert.equal(data.documentsEnabled,false);
});
test('auth-only preview rejects all application writes and other hostnames',async t=>{
 const s=await setup(t);const denied=await s.get('/caregiver/workforce-api/application',{method:'POST',headers:{Authorization:'Bearer signed-google'},body:'{}'});assert.equal(denied.status,405);
 const status=await new Promise((resolve,reject)=>{http.get(s.origin+'/caregiver/workforce-api/configuration',{headers:{Host:'untrusted.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);});assert.equal(status,403);
});
test('test configuration exposes only Google and cannot leak provider secrets',async t=>{
 const s=await setup(t),response=await s.get('/caregiver/workforce-api/configuration'),config=await response.json();assert.deepEqual(config.enabledSignInProviders,['google.com']);assert.equal(config.applicationsEnabled,false);
 const init=await s.get('/__/firebase/init.js');assert.doesNotMatch(await init.text(),/clientSecret|never-return/);assert.equal(init.headers.get('cache-control'),'no-store');
});
