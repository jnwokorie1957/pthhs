(() => {
  'use strict';
  const panel=document.getElementById('websiteAnalytics');
  if(!panel)return;
  const $=id=>document.getElementById(id);
  const site=$('waSite'),days=$('waDays'),refresh=$('waRefresh'),status=$('waStatus');
  let ready=false,sequence=0,controller=null,busy=false,receipt=null;
  const num=value=>new Intl.NumberFormat('en-US').format(value);
  const pct=value=>(100*value).toFixed(1)+'%';
  const duration=value=>{const s=Math.round(value);return Math.floor(s/60)+'m '+s%60+'s';};
  function verified(data,scope){
    const properties={pthhs:'546711548',rideprimetime:'561765914'};
    const streams={pthhs:'16244033088',rideprimetime:'16244067646'};
    const validText=value=>typeof value==='string'&&value.trim()!==''&&value.length<=2048;
    const count=value=>Number.isSafeInteger(value)&&value>=0;
    const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
    const summary=row=>row&&['screenPageViews','sessions','activeUsers'].every(key=>count(row[key]))&&number(row.averageSessionDuration)&&number(row.engagementRate)&&row.engagementRate<=1;
    const age=Date.now()-Date.parse(data?.updatedAt);
    if(data?.ok!==true||data.contractVersion!==2||!Object.hasOwn(properties,scope.site)||data.site!==scope.site||data.propertyId!==properties[scope.site]||data.days!==scope.days||![7,28,90].includes(data.days)
      ||data.current!==null&&!summary(data.current)||data.previous!==null&&!summary(data.previous)||!Number.isFinite(age)||age< -60000||age>120000
      ||typeof data.updatedAt!=='string'||new Date(data.updatedAt).toISOString()!==data.updatedAt||!validText(data.timeZone)
      ||!validText(data.periodNote)||![null,undefined].includes(data.dataQuality)&&!(typeof data.dataQuality==='string'&&data.dataQuality.length>0&&data.dataQuality.length<=8192)
      ||data.realtime!==null&&!count(data.realtime)||data.realtime===null&&!validText(data.realtimeError))throw new Error('invalid_report');
    new Intl.DateTimeFormat('en',{timeZone:data.timeZone});
    const p=data.periods,iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
    const shift=(value,n)=>new Date(Date.parse(value+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
    if(!p||!iso(p.asOfDate)||!['current','previous'].every(key=>iso(p[key]?.startDate)&&iso(p[key]?.endDate))
      ||p.current.startDate!==shift(p.asOfDate,-data.days)||p.current.endDate!==shift(p.asOfDate,-1)||p.previous.startDate!==shift(p.asOfDate,-2*data.days)||p.previous.endDate!==shift(p.asOfDate,-data.days-1)
      ||data.realtimeStreamId!==streams[scope.site]||data.realtime!==null&&typeof data.realtimeUpdatedAt!=='string'
      ||data.realtimeUpdatedAt!==null&&(!Number.isFinite(Date.parse(data.realtimeUpdatedAt))||new Date(data.realtimeUpdatedAt).toISOString()!==data.realtimeUpdatedAt||Date.parse(data.realtimeUpdatedAt)<Date.parse(data.updatedAt)||Date.parse(data.realtimeUpdatedAt)-Date.parse(data.updatedAt)>60000||Date.parse(data.realtimeUpdatedAt)-Date.now()>60000))throw new Error('invalid_report');
    const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:data.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.updatedAt));
    if(p.asOfDate!==calendar&&p.asOfDate!==shift(calendar,-1))throw new Error('invalid_report');
    const rows=(items,max,dimension,metrics)=>{
      const seen=new Set();
      if(!Array.isArray(items)||items.length>max||items.some(row=>!row||!validText(row[dimension])||seen.has(row[dimension])||!seen.add(row[dimension])||metrics.some(key=>!count(row[key]))))throw new Error('invalid_report');
    };
    rows(data.trend,data.days,'date',['screenPageViews','sessions']);rows(data.pages,10,'pagePath',['screenPageViews','activeUsers']);
    rows(data.channels,10,'sessionDefaultChannelGroup',['sessions','activeUsers']);rows(data.events,10,'eventName',['eventCount']);
    for(const[key,n]of Object.entries({summary:Number(data.current!==null)+Number(data.previous!==null),trend:data.trend.length,pages:data.pages.length,channels:data.channels.length,events:data.events.length})){
      const c=data.coverage?.[key];if(!c||c.returnedRows!==n||c.totalRows!==null&&(!count(c.totalRows)||c.totalRows<n)||c.limited!==(c.totalRows===null?null:c.totalRows>n)||c.emptyReason&&n)throw new Error('invalid_report');
    }
    for(const row of data.trend){const value=row.date,day=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6);if(!/^\d{8}$/.test(value)||!iso(day)||day<p.current.startDate||day>p.current.endDate)throw new Error('invalid_report');}
    const contactRows=data.events.filter(row=>['phone_click','email_click'].includes(row.eventName)),contacts=contactRows.length?contactRows.reduce((sum,row)=>sum+row.eventCount,0):null;
    if(contacts!==null&&!count(contacts))throw new Error('invalid_report');
    return {...data,contacts,trend:[...data.trend].sort((a,b)=>a.date.localeCompare(b.date))};
  }
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
  const live=()=>window.primetimeDataMode?.isLive()===true;
  const visible=()=>panel.classList.contains('is-active')&&!$('appShell')?.hidden;
  function message(text,error=false){status.textContent=text;status.classList.toggle('wa-error',error);}
  function facts(label='Awaiting report'){receipt=null;$('waMetrics').replaceChildren(...['Page views','Sessions','Active visitors','Engagement rate','Average session','Phone & email clicks'].map(name=>{const c=el('article',undefined,'wa-metric');c.append(el('p',name),el('strong','—'),el('small',label));return c;}));$('waChart').replaceChildren(el('p',label,'wa-empty'));for(const id of ['waPages','waChannels','waDaily'])$(id).replaceChildren();$('waLive').textContent='—';$('waUpdated').textContent='';$('waNote').textContent='';}
  function clear(){sequence++;controller?.abort();controller=null;busy=false;refresh.disabled=!ready||!live();facts();}
  function table(target,headings,data){const t=el('table');const h=el('thead'),hr=el('tr');for(const heading of headings){const c=el('th',heading);c.scope='col';hr.append(c);}h.append(hr);const b=el('tbody');for(const cells of data){const r=el('tr');for(const value of cells)r.append(el('td',value));b.append(r);}t.append(h,b);target.replaceChildren(data.length?t:el('p','No source rows returned.','wa-empty'));}
  function card(label,value,previous,format=num,empty='No summary row returned.'){const c=el('article',undefined,'wa-metric');c.append(el('p',label),el('strong',value===null?'—':format(value)));let note=value===null?empty:previous===null?'Comparison not returned.':'';if(value!==null&&previous!==null&&previous!==undefined){if(previous>0){const delta=(value-previous)/previous*100;note=(delta>0?'+':'')+delta.toFixed(1)+'% vs previous period';}else note=value>0?'Previous reported value: 0':'Reported value: 0 in both periods';}c.append(el('small',note,previous>0&&value>previous?'wa-up':''));return c;}
  function chart(all){
    table($('waDaily'),['Date','Page views','Sessions'],all.map(r=>[r.date.slice(4,6)+'/'+r.date.slice(6,8)+'/'+r.date.slice(0,4),num(r.screenPageViews),num(r.sessions)]));
    if(!all.length){$('waChart').replaceChildren(el('p','No daily source rows returned.','wa-empty'));return;}
    const day=row=>Date.parse(row.date.slice(0,4)+'-'+row.date.slice(4,6)+'-'+row.date.slice(6)+'T00:00:00Z');
    const first=day(all[0]),span=Math.max(86400000,day(all.at(-1))-first),x=row=>42+(day(row)-first)*838/span;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 900 250');svg.setAttribute('role','img');svg.setAttribute('aria-label','Daily page views and sessions. Exact values are in the daily table below.');
    const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;};
    const max=Math.max(1,...all.flatMap(r=>[r.screenPageViews,r.sessions]));
    for(let i=0;i<=4;i++){const y=22+i*46;add('line',{x1:42,x2:880,y1:y,y2:y,stroke:'#e8eff4'});add('text',{x:32,y:y+4,'text-anchor':'end'},num(Math.round(max*(1-i/4))));}
    for(const[key,color]of[['screenPageViews','#2467a2'],['sessions','#127c77']]){add('path',{d:all.map((row,i)=>(!i||day(row)-day(all[i-1])>86400000?'M':'L')+x(row)+','+(206-row[key]/max*184)).join(' '),fill:'none',stroke:color,'stroke-width':3});for(const row of all){const circle=add('circle',{cx:x(row),cy:206-row[key]/max*184,r:3,fill:color});const title=document.createElementNS(ns,'title');title.textContent=row.date+': '+num(row[key])+' '+key;circle.append(title);}}
    for(const i of new Set([0,Math.floor((all.length-1)/2),all.length-1]))add('text',{x:x(all[i]),y:238,'text-anchor':i===0?'start':i===all.length-1?'end':'middle'},all[i].date.slice(4,6)+'/'+all[i].date.slice(6,8));
    $('waChart').replaceChildren(svg);
  }
  function render(data,label){const c=data.current,p=data.previous;
    $('waMetrics').replaceChildren(card('Page views',c?.screenPageViews??null,p?.screenPageViews??null),card('Sessions',c?.sessions??null,p?.sessions??null),card('Active visitors',c?.activeUsers??null,p?.activeUsers??null),card('Engagement rate',c?.engagementRate??null,p?.engagementRate??null,pct),card('Average session',c?.averageSessionDuration??null,p?.averageSessionDuration??null,duration),card('Reported phone & email clicks',data.contacts,undefined,num,'No contact event rows returned.'));
    $('waLive').textContent=data.realtime===null?'Unavailable':num(data.realtime);chart(data.trend);
    table($('waPages'),['Page','Views','Visitors'],data.pages.map(r=>[r.pagePath==='/'?'Home /':r.pagePath,num(r.screenPageViews),num(r.activeUsers)]));
    table($('waChannels'),['Channel','Sessions','Visitors'],data.channels.map(r=>[r.sessionDefaultChannelGroup,num(r.sessions),num(r.activeUsers)]));
    $('waUpdated').textContent='Updated '+new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/Chicago'})+' Central · '+data.timeZone+' reporting time zone';
    $('waNote').textContent=data.periodNote+' Contact clicks show intent to call or email; they do not confirm a completed inquiry.';
    receipt=Date.parse(data.updatedAt);message([label+' · '+data.periods.current.startDate+' to '+data.periods.current.endDate+' · previous '+data.periods.previous.startDate+' to '+data.periods.previous.endDate,data.dataQuality,data.realtime===null?data.realtimeError:null].filter(Boolean).join(' · '));
  }
  async function load(){if(!ready||!visible()||busy||!live())return;const user=window.firebase?.auth().currentUser;if(!user){clear();message('Sign in to see your website analytics.');return;}
    const scope={site:site.value,days:Number(days.value)},label=site.options[site.selectedIndex].text;
    let failure='Analytics source unavailable. Refresh to retry.';
    facts('Loading report');const ticket=++sequence;controller?.abort();controller=new AbortController();busy=true;refresh.disabled=true;message('Loading '+label+' analytics…');
    try{const token=await user.getIdToken();if(ticket!==sequence||user!==window.firebase.auth().currentUser)return;
      const response=await fetch('/primetime/api/website-analytics?site='+encodeURIComponent(scope.site)+'&days='+scope.days,{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',signal:controller.signal});
      failure='Report could not be verified. Refresh to retry.';
      const data=await response.json();if(ticket!==sequence||user!==window.firebase.auth().currentUser||!visible()||site.value!==scope.site||Number(days.value)!==scope.days)return;
      if(!response.ok){failure=response.status===401?'Sign in to see your website analytics.':data.error==='analytics_access_pending'?'Google reporting access still needs to be connected.':'Analytics source unavailable. Refresh to retry.';throw new Error();}render(verified(data,scope),label);
    }catch(error){if(ticket===sequence&&error?.name!=='AbortError'){facts('Unavailable');message(failure,true);}}
    finally{if(ticket===sequence){busy=false;refresh.disabled=!ready||!live();}}
  }
  function selection(){clear();$('waChart').replaceChildren(el('p','Loading this website’s traffic…','wa-empty'));void load();}
  site.addEventListener('change',selection);days.addEventListener('change',selection);refresh.addEventListener('click',()=>void load());
  document.addEventListener('primetime-ready',()=>{ready=true;void load();});
  document.addEventListener('primetime-signed-out',()=>{ready=false;clear();message('Sign in to see your website analytics.');});
  document.addEventListener('primetime-data-mode-changed',()=>{clear();message(live()?'Read website analytics.':'Website analytics paused in Demo mode. Turn Demo data off to read the source.');void load();});
  document.addEventListener('primetime-view-changed',event=>{if(event.detail?.view==='analytics')void load();else clear();});
  function expire(){if(receipt!==null&&(Date.now()-receipt>120000||Date.now()-receipt< -60000)){facts('Refresh required');message('Report freshness could not be verified. Refresh to retry.',true);}}
  document.addEventListener('visibilitychange',()=>{expire();if(!document.hidden)void load();});
  setInterval(()=>{expire();if(!document.hidden)void load();},60000);
  ready=Boolean(window.firebase?.auth().currentUser&&!$('appShell')?.hidden);
  clear();void load();
})();
