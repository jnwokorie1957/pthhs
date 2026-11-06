import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const projectId='primetimehomehealthservices';
const samples=[['houston','Houston','77035',20,'weekdays'],['katy','Katy','77450',30,'flexible'],['pearland','Pearland','77581',10,'weekends'],['sugarland','Sugar Land','77478',40,'weekdays']].map(([id,location,recruitingZip,weeklyHours,schedule])=>({id:'sample-'+id,location,recruitingZip,weeklyHours,schedule,assistance:['personal_care'],type:'assignment'}));
export function createAuthPreview({root,config,verifyIdentity,sdkSource,headers=[]}){
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const json=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
  try{
   if(!/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host||''))return json(403,{error:'preview_host_required'});
   const route=new URL(req.url,'http://localhost').pathname;
   if(req.method!=='GET')return json(405,{error:'preview_collection_closed'});
   if(route==='/caregiver')for(const header of headers)res.setHeader(header.key,header.value);
   if(route==='/__/firebase/init.js'){res.setHeader('Content-Type','text/javascript');res.end('firebase.initializeApp('+JSON.stringify({apiKey:config.apiKey,authDomain:config.authDomain,projectId:config.projectId,appId:config.appId})+');');return;}
   const sdk=route.match(/^\/__\/firebase\/13\.2\.0\/(firebase-(?:app|auth)-compat\.js)$/);
   if(sdk){res.setHeader('Content-Type','text/javascript');res.end(await sdkSource(sdk[1]));return;}
   if(route==='/caregiver/workforce-api/configuration')return json(200,{staffEnabled:false,accountsEnabled:true,applicationsEnabled:false,documentsEnabled:false,addressLookupEnabled:false,enabledSignInProviders:['google.com'],providerOnly:true});
   if(route.startsWith('/caregiver/workforce-api/')){
    const uid=await verifyIdentity(req);
    if(route.endsWith('/application/session'))return json(200,{uid,kind:'caregiver',applicationsEnabled:false,documentsEnabled:false,addressLookupEnabled:false,previewNavigation:true,authTest:true});
    if(route.endsWith('/opportunities'))return json(200,{items:samples});
    return json(503,{error:'application_collection_pending'});
   }
   if(route.startsWith('/primetime')||route.startsWith('/preview-auth'))return json(404,{error:'route_not_found'});
   let relative=decodeURIComponent(route).replace(/^\//,'');if(!relative)relative='caregiver.html';if(!path.extname(relative))relative+='.html';
   const filename=path.resolve(root,relative);if(!filename.startsWith(path.resolve(root)+path.sep))return json(403,{error:'route_not_found'});
   let bytes=await fs.readFile(filename);const extension=path.extname(filename);
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon'};
   res.setHeader('Content-Type',types[extension]||'application/octet-stream');
   if(extension==='.html')bytes=Buffer.from(bytes.toString().replace('<main','<p class="notice">Google sign-in test — your Google account creates a real Firebase login. Openings are demonstrations. Application and document submission are closed.</p><main'));
   res.end(bytes);
  }catch(error){json(error.status===401?401:400,{error:error.status===401?'verified_identity_required':'preview_request_failed'});}
 });
}
async function main(){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public'),config=JSON.parse(await fs.readFile(process.env.PTHHS_AUTH_PREVIEW_CONFIG,'utf8'));
 if(config.projectId!==projectId||config.authDomain!==projectId+'.firebaseapp.com'||!config.apiKey)throw Error('Use this project’s Firebase web SDK configuration.');
 const require=createRequire(new URL('../functions/package.json',import.meta.url));
 const {initializeApp,applicationDefault}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth');
 let credential=applicationDefault();if(process.env.PTHHS_AUTH_PREVIEW_CREDENTIAL_MODULE){const helper=await import(pathToFileURL(process.env.PTHHS_AUTH_PREVIEW_CREDENTIAL_MODULE));credential={getAccessToken:async()=>({access_token:await helper.googleToken(),expires_in:3000})};}
 const auth=getAuth(initializeApp({projectId,credential},'workforce-auth-preview'));
 const {workforceIdentity}=await import('../functions/lib/workforce/auth.js');
 const cache=new Map(),sdkSource=async name=>{if(!cache.has(name)){const response=await fetch('https://www.gstatic.com/firebasejs/13.2.0/'+name);if(!response.ok)throw Error('Firebase SDK unavailable');cache.set(name,await response.text());}return cache.get(name);};
 const hosting=JSON.parse(await fs.readFile(new URL('../firebase.json',import.meta.url),'utf8')).hosting;
 const server=createAuthPreview({root,config,sdkSource,headers:hosting.headers.filter(rule=>['**','/caregiver'].includes(rule.source)).flatMap(rule=>rule.headers),verifyIdentity:async req=>{
  const identity=await workforceIdentity({get:name=>req.headers[name.toLowerCase()]},auth);
  const token=await auth.verifyIdToken(req.headers.authorization.slice(7).trim(),true);
  if(token.firebase?.sign_in_provider!=='google.com')throw Object.assign(Error('Google sign-in required'),{status:401});return identity;
 }});
 server.listen(4176,'127.0.0.1',()=>process.stdout.write('Real Google sign-in preview: http://localhost:4176/caregiver\n'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{process.stderr.write('Auth preview could not start. Check its local configuration and operator credentials.\n');process.exitCode=1;});
