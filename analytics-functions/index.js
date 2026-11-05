import {onRequest} from 'firebase-functions/v2/https';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {GoogleAuth} from 'google-auth-library';
import {SITES} from './report.js';
import {queryReports} from './query.js';
import {createLiveViews,createCollector} from './live-views.js';
initializeApp();
const liveViews=createLiveViews({db:getFirestore(),increment:FieldValue.increment});
export const websitePageView=onRequest({region:'us-central1',memory:'256MiB',timeoutSeconds:15,maxInstances:1,concurrency:20,invoker:'public'},createCollector(liveViews));
const auth = new GoogleAuth({scopes:['https://www.googleapis.com/auth/analytics.readonly']});
const cache = new Map();
const pending = new Map();
const realtimeStates = new Map();
async function owner(request) {
  const header=request.get('Authorization')||'';
  if (!header.startsWith('Bearer ')) return false;
  try {
    const token=await getAuth().verifyIdToken(header.slice(7),true);
    const user=await getAuth().getUser(token.uid);
    return !user.disabled && (token.email_verified===true && token.email==='jeremynwokorie@gmail.com' && user.emailVerified && user.email===token.email ||
      token.phone_number==='+18324030094' && user.phoneNumber===token.phone_number);
  } catch {return false;}
}
async function query(siteKey,days) {
  const client=await auth.getClient();
  const result=await queryReports(client,siteKey,days);
  const diagnostic=result.realtimeDiagnostic,key=siteKey+':'+days,signature=JSON.stringify(diagnostic);
  if(realtimeStates.get(key)!==signature){
    realtimeStates.set(key,signature);
    if(diagnostic?.category==='empty_result') console.info('Website analytics realtime source empty',diagnostic);
    else if(diagnostic) console.warn('Website analytics realtime unavailable',diagnostic);
  }
  return result;
}
export const websiteAnalytics=onRequest({region:'us-central1',memory:'256MiB',timeoutSeconds:60,maxInstances:1,concurrency:10,invoker:'public'},async(request,response)=>{
  response.set({'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'});
  if (!await owner(request)) {response.status(401).json({ok:false,error:'sign_in_required'});return;}
  if(request.method!=='GET'){response.set('Allow','GET').status(405).json({ok:false,error:'method_not_allowed'});return;}
  const site=typeof request.query.site==='string'?request.query.site:'';
  if(request.path==='/primetime/api/website-live-views'){
    if(!Object.hasOwn(SITES,site)||Object.keys(request.query).some(key=>key!=='site')){response.status(400).json({ok:false,error:'invalid_query'});return;}
    try{response.json(await liveViews.read(site));}catch{response.status(503).json({ok:false,error:'live_counter_unavailable'});}return;
  }
  const days=typeof request.query.days==='string'?Number(request.query.days):28;
  if(!Object.hasOwn(SITES,site)||![7,28,90].includes(days)||Object.keys(request.query).some(k=>!['site','days'].includes(k))){response.status(400).json({ok:false,error:'invalid_query'});return;}
  const key=site+':'+days;
  try {
    let result=cache.get(key);
    if(!result||Date.now()-result.at>60000){
      if(!pending.has(key))pending.set(key,query(site,days).then(data=>{const entry={at:Date.now(),data};cache.set(key,entry);return entry;}).finally(()=>pending.delete(key)));
      result=await pending.get(key);
    }
    response.status(200).json(result.data);
  }catch(error){
    const status=error?.response?.status;
    const upstream=error?.response?.data?.error;
    console.warn('Website analytics report unavailable', {status:status||0,reason:upstream?.details?.find(d=>d.reason)?.reason||'',message:typeof upstream?.message==='string'?upstream.message.slice(0,180):'upstream_unavailable'});
    response.status(503).json({ok:false,error:status===403?'analytics_access_pending':'analytics_temporarily_unavailable',
      message:status===403?'The dashboard is ready. Google reporting access still needs to be connected.':'Google Analytics could not be reached. Try Refresh in a minute.'});
  }
});
