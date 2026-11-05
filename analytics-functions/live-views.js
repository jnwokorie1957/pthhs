export const LIVE_ZONE='America/Chicago';
export const PUBLIC_ORIGINS=Object.freeze({'https://pthhs.net':'pthhs','https://www.pthhs.net':'pthhs','https://rideprimetime.net':'rideprimetime','https://www.rideprimetime.net':'rideprimetime'});
export function liveDay(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:LIVE_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function createLiveViews({db,increment,clock=()=>new Date()}) {
  const root=site=>db.collection('websitePageViewCounters').doc(site);
  return {
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
      const startedAt=start.exists?start.data().startedAt.toDate().toISOString():null;
      const count=start.exists?(day.exists?day.data().count:0):null;
      if(count!==null&&(!Number.isSafeInteger(count)||count<0)||day.exists&&!start.exists)throw new Error('invalid_counter');
      return {ok:true,site,date,timeZone:LIVE_ZONE,count,startedAt,updatedAt:now.toISOString()};
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
    if(!/^application\/json(?:;|$)/i.test(request.get('Content-Type')||'')||request.rawBody?.length>32||!request.body||request.body.v!==1||Object.keys(request.body).length!==1){response.status(400).end();return;}
    const minute=Math.floor(clock()/60000),bucket=windows.get(site);
    if(!bucket||bucket.minute!==minute)windows.set(site,{minute,count:0});
    const active=windows.get(site);
    if(++active.count>limit){response.set('Retry-After','60').status(429).end();return;}
    try{await counter.count(site);response.status(204).end();}
    catch{response.status(503).end();}
  };
}
