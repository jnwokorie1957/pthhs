(() => {
  'use strict';
  const sites = {
    'pthhs.net': ['G-4VE4NM960V', 'https://pthhs.net'],
    'www.pthhs.net': ['G-4VE4NM960V', 'https://pthhs.net'],
    'rideprimetime.net': ['G-T9M25PS348', 'https://www.rideprimetime.net'],
    'www.rideprimetime.net': ['G-T9M25PS348', 'https://www.rideprimetime.net']
  };
  const site = sites[location.hostname];
  if (!site || window.__publicAnalyticsLoaded || /^\/(?:primetime|api)(?:\/|$)/.test(location.pathname) ||
      document.querySelector('meta[name="robots"]')?.content.includes('noindex') ||
      navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  let page;
  try { page = new URL(canonical); } catch { return; }
  if (page.origin !== site[1] || page.search || page.hash) return;
  window.__publicAnalyticsLoaded = true;
  // Aggregate views and short-lived presence never include page addresses.
  function send(data) {
    if(typeof fetch!=='function')return;
    void fetch('https://pthhs.net/api/public-page-view',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),
      credentials:'omit',referrerPolicy:'no-referrer',keepalive:true
    }).catch(()=>{});
  }
  send({v:1});
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'){
    const tab=crypto.randomUUID(),storageKey='primetime.publicPresence';let session=crypto.randomUUID();
    function pulse(active){
      try{
        const stored=JSON.parse(window.localStorage.getItem(storageKey)||'null');
        if(stored&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(stored.id)&&stored.expiresAt>Date.now())session=stored.id;
        if(active)window.localStorage.setItem(storageKey,JSON.stringify({id:session,expiresAt:Date.now()+1800000}));
      }catch{/* Storage-disabled browsers keep a document-scoped anonymous token. */}
      send({v:2,kind:'presence',session,tab,active});
    }
    let visible=document.visibilityState!=='hidden';
    pulse(visible);
    setInterval(()=>{if(visible)pulse(true);},15000);
    document.addEventListener('visibilitychange',()=>{visible=document.visibilityState!=='hidden';pulse(visible);});
    window.addEventListener('pagehide',()=>{visible=false;pulse(false);});
    window.addEventListener('pageshow',event=>{if(event.persisted){visible=document.visibilityState!=='hidden';pulse(visible);}});
  }
  window.dataLayer = window.dataLayer || [];
  const gtag = function () { window.dataLayer.push(arguments); };
  window.gtag = gtag;
  let referrer = '';
  try { const ref = new URL(document.referrer); referrer = ref.origin === location.origin ? site[1] + '/' : ref.origin + '/'; } catch { /* Direct visit. */ }
  gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  gtag('set', {page_location: page.href, page_referrer: referrer, page_title: document.title, ads_data_redaction: true, url_passthrough: false});
  gtag('js', new Date());
  gtag('config', site[0], {page_location: page.href, page_referrer: referrer, page_title: document.title,
    allow_google_signals: false, allow_ad_personalization_signals: false, cookie_flags: 'SameSite=Lax;Secure'});
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + site[0];
  document.head.append(script);
  // Count contact intent, never the destination number, address, message or form data.
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    const href = link?.getAttribute('href') || '';
    const name = /^tel:/i.test(href) ? 'phone_click' : /^mailto:/i.test(href) ? 'email_click' : null;
    if (name) gtag('event', name, {send_to: site[0], page_location: page.href, page_referrer: referrer});
  });
})();
