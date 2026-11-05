(() => {
  'use strict';
  const panel=document.getElementById('websiteAnalytics');if(!panel)return;
  const $=id=>document.getElementById(id),site=$('waSite');
  let ready=Boolean(window.firebase?.auth().currentUser&&!$('appShell')?.hidden),sequence=0,controller=null,busy=false,receipt=null;
  const active=()=>ready&&!document.hidden&&panel.classList.contains('is-active')&&!$('appShell')?.hidden&&window.primetimeDataMode?.isLive()===true;
  const time=value=>new Date(value).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',second:'2-digit'})+' Central';
  const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  function clear(note='Waiting for live counter'){sequence++;controller?.abort();controller=null;busy=false;receipt=null;$('waToday').textContent='—';$('waTodayNote').textContent=note;}
  function verified(data,key){
    const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
    if(data?.ok!==true||!['pthhs','rideprimetime'].includes(key)||data.site!==key||data.timeZone!=='America/Chicago'||!stamp(data.updatedAt)
      ||Date.now()-Date.parse(data.updatedAt)>20000||Date.parse(data.updatedAt)-Date.now()>60000||data.date!==day(data.updatedAt)
      ||data.count!==null&&(!Number.isSafeInteger(data.count)||data.count<0)||data.startedAt!==null&&(!stamp(data.startedAt)||data.startedAt>data.updatedAt)
      ||(data.count===null)!==(data.startedAt===null))throw new Error('invalid_counter');return data;
  }
  async function load(){
    if(!active()||busy)return;const user=window.firebase?.auth().currentUser;if(!user){clear('Sign in to see live page views.');return;}
    const key=site.value,ticket=++sequence;controller?.abort();const request=new AbortController();controller=request;busy=true;
    const timeout=setTimeout(()=>request.abort(),10000);
    try{
      const token=await user.getIdToken();if(ticket!==sequence||user!==window.firebase.auth().currentUser)return;
      const response=await fetch('/primetime/api/website-live-views?site='+encodeURIComponent(key),{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',signal:request.signal});
      const data=await response.json();if(ticket!==sequence||user!==window.firebase.auth().currentUser||!active()||site.value!==key)return;
      if(!response.ok)throw new Error('unavailable');verified(data,key);receipt=Date.parse(data.updatedAt);
      $('waToday').textContent=data.count===null?'Waiting':new Intl.NumberFormat('en-US').format(data.count);
      $('waTodayNote').textContent=data.count===null?'Live counting starts with the next public page visit.':
        data.date+' · '+(day(data.startedAt)===data.date?'Counting since '+time(data.startedAt)+'; first partial day.':'Midnight–now · America/Chicago.')+' Updates every 5 seconds. Checked '+time(data.updatedAt)+'.';
    }catch(error){if(ticket===sequence){receipt=null;$('waToday').textContent='Unavailable';$('waTodayNote').textContent='Live counter could not be reached. Retrying in 5 seconds.';}}
    finally{clearTimeout(timeout);if(ticket===sequence){busy=false;controller=null;}}
  }
  const selection=()=>{clear();void load();};
  site.addEventListener('change',selection);
  $('waRefresh').addEventListener('click',()=>void load());
  document.addEventListener('primetime-ready',()=>{ready=true;selection();});
  document.addEventListener('primetime-signed-out',()=>{ready=false;clear('Sign in to see live page views.');});
  document.addEventListener('primetime-data-mode-changed',selection);
  document.addEventListener('primetime-view-changed',selection);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear('Live counter paused while this tab is hidden.');else selection();});
  setInterval(()=>{if(receipt!==null&&Date.now()-receipt>20000)clear('Refreshing live count…');void load();},5000);
  selection();
})();
