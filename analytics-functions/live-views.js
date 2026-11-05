import {createHash} from 'node:crypto';
export const LIVE_ZONE='America/Chicago';
export const PRESENCE_SECONDS=60;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const hash=value=>createHash('sha256').update(value).digest('hex');
const millis=value=>value instanceof Date?value.getTime():value?.toMillis?.();
export const PUBLIC_ORIGINS=Object.freeze({'https://pthhs.net':'pthhs','https://www.pthhs.net':'pthhs','https://rideprimetime.net':'rideprimetime','https://www.rideprimetime.net':'rideprimetime'});
export function liveDay(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:LIVE_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function createLiveViews({db,increment,clock=()=>new Date()}) {
  const root=site=>db.collection('websitePageViewCounters').doc(site);
  return {
    async pulse(site,session,tab,active) {
      if(!['pthhs','rideprimetime'].includes(site)||!uuid(session)||!uuid(tab)||typeof active!=='boolean')throw new Error('invalid_presence');
      const now=clock(),ref=root(site).collection('websiteActiveSessions').doc(hash(session)),key=hash(tab);
      await db.runTransaction(async tx=>{
        const source=await tx.get(ref),tabs={};
        for(const [id,until]of Object.entries(source.exists?source.data().tabs||{}:{})){
          const value=millis(until);if(/^[a-f0-9]{64}$/.test(id)&&Number.isFinite(value)&&value>now.getTime())tabs[id]=new Date(value);
        }
        if(active){if(Object.keys(tabs).length>=32&&!tabs[key])throw new Error('too_many_tabs');tabs[key]=new Date(now.getTime()+PRESENCE_SECONDS*1000);}else delete tabs[key];
        tx.set(ref,{tabs,expiresAt:new Date(Math.max(now.getTime(),...Object.values(tabs).map(millis))),updatedAt:now});
      });
    },
    async count(site) {
      if(!['pthhs','rideprimetime'].includes(site))throw new Error('invalid_site');
      const now=clock(),date=liveDay(now),ref=root(site);
      await db.runTransaction(async tx=>{
        const source=await tx.get(ref);
        if(!source.exists)tx.create(ref,{startedAt:now,timeZone:LIVE_ZONE});
        tx.set(ref.collection('days').doc(date),{count:increment(1),updatedAt:now},{merge:true});
      });
    },
    async read(site) {
      if(!['pthhs','rideprimetime'].includes(site))throw new Error('invalid_site');
      const now=clock(),date=liveDay(now),ref=root(site);
      const [start,day]=await db.getAll(ref,ref.collection('days').doc(date));
      const active=await ref.collection('websiteActiveSessions').where('expiresAt','>',now).count().get();
      const visitors=active.data().count;
      if(!Number.isSafeInteger(visitors)||visitors<0)throw new Error('invalid_presence_count');
      const startedAt=start.exists?start.data().startedAt.toDate().toISOString():null;
      const count=start.exists?(day.exists?day.data().count:0):null;
      if(count!==null&&(!Number.isSafeInteger(count)||count<0)||day.exists&&!start.exists)throw new Error('invalid_counter');
      return {ok:true,site,date,timeZone:LIVE_ZONE,count,startedAt,visitors,presenceWindowSeconds:PRESENCE_SECONDS,updatedAt:clock().toISOString()};
    }
  };
}
export function createCollector(counter,{clock=()=>Date.now(),limit=120}={}) {
  const windows=new Map();
  return async(request,response)=>{
    response.set({'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Vary':'Origin'});
    const origin=request.get('Origin'),site=Object.hasOwn(PUBLIC_ORIGINS,origin)?PUBLIC_ORIGINS[origin]:null;
    if(!site){response.status(403).end();return;}
    response.set({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'3600'});
    if(request.method==='OPTIONS'){response.status(204).end();return;}
    if(request.method!=='POST'){response.set('Allow','POST, OPTIONS').status(405).end();return;}
    const body=request.body,keys=body&&Object.keys(body);
    const view=body?.v===1&&keys.length===1&&(request.rawBody?.length||0)<=32;
    const presence=body?.v===2&&body.kind==='presence'&&keys.length===5&&['v','kind','session','tab','active'].every(k=>Object.hasOwn(body,k))&&uuid(body.session)&&uuid(body.tab)&&typeof body.active==='boolean';
    if(!/^application\/json(?:;|$)/i.test(request.get('Content-Type')||'')||request.rawBody?.length>256||!view&&!presence){response.status(400).end();return;}
    const minute=Math.floor(clock()/60000),key=site+':'+(presence?'presence':'view'),bucket=windows.get(key);
    if(!bucket||bucket.minute!==minute)windows.set(key,{minute,count:0});
    const active=windows.get(key);
    if(++active.count>limit*(presence?5:1)){response.set('Retry-After','60').status(429).end();return;}
    try{if(presence)await counter.pulse(site,body.session,body.tab,body.active);else await counter.count(site);response.status(204).end();}
    catch{response.status(503).end();}
  };
}
