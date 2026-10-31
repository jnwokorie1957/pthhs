(() => {
  'use strict';
  const panel=document.getElementById('websiteAnalytics');
  if(!panel)return;
  const $=id=>document.getElementById(id);
  const site=$('waSite'),days=$('waDays'),refresh=$('waRefresh'),status=$('waStatus');
  let ready=false,sequence=0,controller=null,busy=false;
  const num=value=>new Intl.NumberFormat('en-US').format(Number(value)||0);
  const pct=value=>(100*(Number(value)||0)).toFixed(1)+'%';
  const duration=value=>{const s=Math.round(Number(value)||0);return Math.floor(s/60)+'m '+s%60+'s';};
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
  const visible=()=>panel.classList.contains('is-active')&&!$('appShell')?.hidden;
  function message(text,error=false){status.textContent=text;status.classList.toggle('wa-error',error);}
  function clear(){sequence++;controller?.abort();controller=null;busy=false;refresh.disabled=false;$('waMetrics').replaceChildren(...['Page views','Sessions','Active visitors','Engagement rate','Average session','Phone & email clicks'].map(label=>{const c=el('article',undefined,'wa-metric');c.append(el('p',label),el('strong','—'),el('small','Awaiting report'));return c;}));$('waChart').replaceChildren(el('p','Your traffic trend will appear when reporting is connected.','wa-empty'));for(const id of ['waPages','waChannels','waDaily'])$(id).replaceChildren();$('waLive').textContent='—';$('waUpdated').textContent='';}
  function table(target,headings,data){const t=el('table');const h=el('thead'),hr=el('tr');for(const heading of headings){const c=el('th',heading);c.scope='col';hr.append(c);}h.append(hr);const b=el('tbody');for(const cells of data){const r=el('tr');for(const value of cells)r.append(el('td',value));b.append(r);}t.append(h,b);target.replaceChildren(data.length?t:el('p','No activity recorded for this period yet.','wa-empty'));}
  function card(label,value,previous,format=num){const c=el('article',undefined,'wa-metric');c.append(el('p',label),el('strong',format(value)));let note='';if(previous!==null&&previous!==undefined){if(previous>0){const delta=(value-previous)/previous*100;note=(delta>0?'+':'')+delta.toFixed(1)+'% vs previous period';}else note=value>0?'No activity in the previous period':'No activity yet';}c.append(el('small',note,previous>0&&value>previous?'wa-up':''));return c;}
  function chart(data,windowDays,timeZone){
    const byDate=new Map(data.map(r=>[r.date,r]));const dates=[];const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timeZone||'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});const current=formatter.format(new Date());
    const today=new Date(current+'T12:00:00Z');for(let n=windowDays;n>=1;n--){const d=new Date(today);d.setUTCDate(d.getUTCDate()-n);dates.push(d.toISOString().slice(0,10).replaceAll('-',''));}
    const all=dates.map(date=>byDate.get(date)||{date,screenPageViews:0,sessions:0});
    table($('waDaily'),['Date','Page views','Sessions'],all.map(r=>[r.date.slice(4,6)+'/'+r.date.slice(6,8)+'/'+r.date.slice(0,4),num(r.screenPageViews),num(r.sessions)]));
    if(!data.length){$('waChart').replaceChildren(el('p','Your traffic trend will appear as Google processes the first visits.','wa-empty'));return;}
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 900 250');svg.setAttribute('role','img');svg.setAttribute('aria-label','Daily page views and sessions. Exact values are in the daily table below.');
    const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;};
    const max=Math.max(1,...all.flatMap(r=>[r.screenPageViews||0,r.sessions||0]));
    for(let i=0;i<=4;i++){const y=22+i*46;add('line',{x1:42,x2:880,y1:y,y2:y,stroke:'#e8eff4'});add('text',{x:32,y:y+4,'text-anchor':'end'},num(Math.round(max*(1-i/4))));}
    for(const[key,color]of[['screenPageViews','#2467a2'],['sessions','#127c77']]){const points=all.map((r,i)=>[42+i*838/Math.max(1,all.length-1),206-(r[key]||0)/max*184]);add('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-linejoin':'round'});for(let i=0;i<points.length;i++){const[x,y]=points[i];const circle=add('circle',{cx:x,cy:y,r:windowDays<=28?3:2,fill:color});const title=document.createElementNS(ns,'title');title.textContent=all[i].date+': '+num(all[i][key])+' '+(key==='sessions'?'sessions':'views');circle.append(title);}}
    for(const i of [0,Math.floor((all.length-1)/2),all.length-1])add('text',{x:42+i*838/Math.max(1,all.length-1),y:238,'text-anchor':i===0?'start':i===all.length-1?'end':'middle'},all[i].date.slice(4,6)+'/'+all[i].date.slice(6,8));
    $('waChart').replaceChildren(svg);
  }
  function render(data){const c=data.current,p=data.previous;const contacts=(data.events||[]).filter(r=>['phone_click','email_click'].includes(r.eventName)).reduce((sum,r)=>sum+r.eventCount,0);
    $('waMetrics').replaceChildren(card('Page views',c.screenPageViews,p.screenPageViews),card('Sessions',c.sessions,p.sessions),card('Active visitors',c.activeUsers,p.activeUsers),card('Engagement rate',c.engagementRate,p.engagementRate,pct),card('Average session',c.averageSessionDuration,p.averageSessionDuration,duration),card('Phone & email clicks',contacts,null));
    $('waLive').textContent=data.realtime===null?'Unavailable':num(data.realtime);chart(data.trend,data.days,data.timeZone);
    table($('waPages'),['Page','Views','Visitors'],data.pages.map(r=>[r.pagePath==='/'?'Home /':r.pagePath,num(r.screenPageViews),num(r.activeUsers)]));
    table($('waChannels'),['Channel','Sessions','Visitors'],data.channels.map(r=>[r.sessionDefaultChannelGroup,num(r.sessions),num(r.activeUsers)]));
    $('waUpdated').textContent='Updated '+new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/Chicago'})+' Central · '+data.timeZone+' reporting time zone';
    $('waNote').textContent=data.periodNote+' Contact clicks show intent to call or email; they do not confirm a completed inquiry.';
    message([data.name+' · last '+data.days+' complete calendar days',data.dataQuality,data.realtimeError].filter(Boolean).join(' · '));
  }
  async function load(){if(!ready||!visible()||busy)return;const user=window.firebase?.auth().currentUser;if(!user){message('Sign in to see your website analytics.');return;}
    const ticket=++sequence;controller?.abort();controller=new AbortController();busy=true;refresh.disabled=true;message('Loading '+site.options[site.selectedIndex].text+' analytics…');
    try{const token=await user.getIdToken();if(ticket!==sequence||user!==window.firebase.auth().currentUser)return;
      const response=await fetch('/primetime/api/website-analytics?site='+encodeURIComponent(site.value)+'&days='+encodeURIComponent(days.value),{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',signal:controller.signal});
      const data=await response.json();if(ticket!==sequence||user!==window.firebase.auth().currentUser||!visible())return;
      if(!response.ok||data.ok!==true)throw new Error(data.message||'Analytics is unavailable. Sign in again or try Refresh.');render(data);
    }catch(error){if(ticket===sequence&&error.name!=='AbortError')message(error.message||'Analytics could not be loaded. Try Refresh.',true);}
    finally{if(ticket===sequence){busy=false;refresh.disabled=false;}}
  }
  function selection(){clear();$('waChart').replaceChildren(el('p','Loading this website’s traffic…','wa-empty'));void load();}
  site.addEventListener('change',selection);days.addEventListener('change',selection);refresh.addEventListener('click',()=>void load());
  document.addEventListener('primetime-ready',()=>{ready=true;void load();});
  document.addEventListener('primetime-signed-out',()=>{ready=false;clear();message('Sign in to see your website analytics.');});
  document.addEventListener('primetime-view-changed',event=>{if(event.detail?.view==='analytics')void load();else{sequence++;controller?.abort();busy=false;refresh.disabled=false;}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
  setInterval(()=>{if(!document.hidden)void load();},60000);
  ready=Boolean(window.firebase?.auth().currentUser&&!$('appShell')?.hidden);
  clear();void load();
})();
