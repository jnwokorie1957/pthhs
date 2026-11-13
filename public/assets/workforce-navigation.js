/* Navigation only: all records and actions still use the existing authorized API. */
(() => {
  const el = id => document.getElementById(id);
  if (!el('caregiver-dashboard')) return;
  let context = null, generation = 0, route = 'home';
  const titles = {home:'Home',application:'My application',profile:'My profile',documents:'Documents & forms',opportunities:'Opportunities'};
  const node = (tag, label, cls) => { const n=document.createElement(tag); n.textContent=label; if(cls)n.className=cls; return n; };
  const read = () => {const [view, query='']=location.hash.slice(1).split('?');return {view:titles[view]?view:'home',params:new URLSearchParams(query)};};
  function set(view, params={}, replace=false) {
    const query=new URLSearchParams(params).toString(), hash='#'+view+(query?'?'+query:'');
    if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',location.pathname+location.search+hash);
  }
  function link(label, view, params={}, primary=false) {
    const a=node('a',label,primary?'btn-primary':'btn-secondary');a.href='#'+view+(Object.keys(params).length?'?'+new URLSearchParams(params):'');
    a.onclick=event=>{event.preventDefault();navigate(view,params);};return a;
  }
  function hide() { for(const id of ['portal-home','portal-profile','portal-documents','job-board','caregiver-summary','caregiver-hha-profile']) { const n=el(id);if(n)n.hidden=true; } }
  function heading(target,title,description) {target.replaceChildren();const h=node('h1',title);h.tabIndex=-1;target.append(h,node('p',description,'portal-lead'));return h;}
  function card(target,title,description,action) {const c=node('section','','portal-task');c.append(node('h2',title),node('p',description));if(action)c.append(action);target.append(c);}
  async function home(target, seq) {
    heading(target,'Welcome to My Primetime',context.actor.existingCaregiver?'Your records and next steps, in one place.':'Your application and next steps, in one place.');
    if(context.actor.existingCaregiver) {
      card(target,'Your caregiver profile','Review the information held by the office.',link('View my profile','profile',{},true));
      card(target,'Your documents','Access your existing personnel files. No duplicate ID upload is needed.',link('View documents','documents'));return;
    }
    if(context.actor.applicationsEnabled===false) {card(target,'Applications are not open yet','Contact the office for help with the current application process.');target.append(link('Browse opportunities','opportunities'));return;}
    const result=await context.api('/application');if(seq!==generation)return;
    const app=result.application, submitted=app?.state==='submitted';
    card(target,submitted?'Application received':app?'Continue your application':'Apply to join Primetime',submitted?'The office will review your application and contact you. Contact the office if a correction is needed.': 'Complete each section, save your progress, and return whenever you are ready.',link(submitted?'View submitted application':app?'Continue application':'Start application','application',{},true));
    if(submitted)card(target,'What happens next','Screening, onboarding approval and employer verification are separate. Complete only the tasks requested by the office.',link('View forms and documents','documents'));
    else card(target,'Required documents & acknowledgment','Review your uploads and complete the DPS CCH acknowledgment before submitting.',link('View checklist','documents'));
  }
  async function profile(target,seq,filesOnly=false) {
    if(context.actor.existingCaregiver){
      const data=await context.api('/application/hha-profile');if(seq!==generation)return;
      heading(target,filesOnly?'Documents & forms':'My profile','Information from HHAeXchange. Contact the office to request a correction.');
      const body=node('div','');target.append(body);window.WorkforceHha.render(body,data,context.api,'/application/hha-files/',()=>seq===generation);
      // Keep one source of truth; show the requested slice of the existing renderer.
      let inFiles=false;for(const child of [...body.children]){if(child.tagName==='H3'&&child.textContent==='Files from HHAeXchange')inFiles=true;child.hidden=filesOnly?!inFiles:inFiles;}
      if(data.profile.fetchedAt)target.append(node('p','Last synchronized: '+new Date(data.profile.fetchedAt).toLocaleString(),'small-note'));return;
    }
    const result=await context.api('/application');if(seq!==generation)return;
    const a=result.application?.answers||{};
    heading(target,'My profile','Your application information. Updates use the same saved application.');
    for(const [title,keys,step]of [['Contact information',['firstName','lastName','email','phone'],'Contact information'],['Emergency contact',['emergencyName','emergencyRelationship','emergencyPhone'],'Emergency contact'],['Availability',['workTime','weeklyHours','availableDate'],'Availability & eligibility']]){
      card(target,title,keys.map(k=>a[k]).filter(Boolean).join(' · ')||'Not entered',link(result.application?.state==='submitted'?'View application':'Review / edit','application',{section:step}));
    }
  }
  async function documents(target,seq) {
    if(context.actor.existingCaregiver)return profile(target,seq,true);
    heading(target,'Documents & forms','Keep application requirements separate from later employment tasks.');
    if(context.actor.applicationsEnabled===false){target.append(node('p','Document collection is not open. Please contact the office.'));return;}
    const results=await Promise.allSettled([context.api('/application/documents'),...['cch','i9','w4','new_hire'].map(k=>context.api('/application/forms/'+k))]);if(seq!==generation)return;
    const docs=results[0].status==='fulfilled'?results[0].value.items:[];
    card(target,'Application documents',results[0].status==='rejected'?'Documents could not be loaded. Try opening the upload checklist.':docs.length+' uploaded file(s). Uploaded files remain subject to security and office review.',link('Review uploads','application',{section:'Documents'}));
    card(target,'Direct deposit form','Optional. Upload your completed form for payroll; it will be included with your submitted application after security review.',link('Upload direct deposit form','application',{section:'Documents'}));
    const labels={cch:'DPS CCH acknowledgment',i9:'Form I-9',w4:'Form W-4',new_hire:'Texas new-hire information'};
    ['cch','i9','w4','new_hire'].forEach((kind,i)=>{if(kind==='cch'||kind==='i9')target.append(node('h2',kind==='cch'?'Before submitting your application':'Employment onboarding','portal-task-stage'));const result=results[i+1],record=result.status==='fulfilled'?result.value.form:null;
      const status=result.status==='rejected'?'Status unavailable':record?.state==='submitted'?'Submitted':record?'Draft saved':'Not started';
      card(target,labels[kind],status+' · '+(kind==='cch'?'Required before application submission.':kind==='i9'?'Sign after accepting an offer; employer verification is separate.':'Complete during onboarding as directed by the office.'),link(record?.state==='submitted'?'View form':'Open form','application',{section:'Tax & employment forms',form:kind}));
    });
  }
  async function navigate(view,params={},fromHistory=false) {
    if(!context)return;
    try {await window.WorkforceReview?.flush();await window.WorkforceForms?.flush();}
    catch(error){el('session-status').textContent='Your changes could not be saved. '+error.message;if(fromHistory)history.replaceState(null,'',location.pathname+location.search+'#'+route);return;}
    if(!context)return;const seq=++generation;route=titles[view]?view:'home';
    if((route==='application')&&(context.actor.existingCaregiver||context.actor.applicationsEnabled===false))route='home';
    window.WorkforceForms?.clear();window.WorkforceHha?.clear();hide();
    if(!fromHistory)set(route,params);document.title=titles[route]+' | Primetime';
    for(const a of document.querySelectorAll('[data-portal-route]'))a.setAttribute('aria-current',a.dataset.portalRoute===route?'page':'false');
    el('portal-account-menu').open=false;el('session-status').textContent='';
    try {
      if(route==='application'){context.application(undefined,params);return;}
      if(route==='opportunities'){if(!fromHistory){const url=new URL(location.href);url.searchParams.delete('opportunity');history.replaceState(null,'',url.pathname+url.search+url.hash);}await context.jobs();return;}
      const target=el('portal-'+route);target.hidden=false;heading(target,titles[route],'Loading…');
      await (route==='home'?home(target,seq):route==='profile'?profile(target,seq):documents(target,seq));
      if(seq===generation)target.querySelector('h1')?.focus({preventScroll:true});
    }catch(error){if(seq===generation)el('session-status').textContent='Unable to load this section. '+error.message;}
  }
  window.WorkforceNavigation={set,navigate,mount(next){context=next;el('portal-home-link').hidden=false;el('portal-application-link').hidden=next.actor.existingCaregiver||next.actor.applicationsEnabled===false;const current=read();if(!location.hash&&new URLSearchParams(location.search).has('opportunity'))current.view='opportunities';if(!location.hash)set(current.view,{},true);if(new URLSearchParams(location.search).get('intent')==='apply'&&['#home','#application'].includes(location.hash)){current.view='application';const url=new URL(location.href);url.searchParams.delete('intent');history.replaceState(null,'',url.pathname+url.search+url.hash);}navigate(current.view,Object.fromEntries(current.params),true);},
    step(label,push=false){if(!context||route!=='application')return;const current=read();const params=Object.fromEntries(current.params);params.section=label;delete params.form;set('application',params,!push);try{sessionStorage.setItem('primetime-step-'+context.actor.uid,label);}catch{};},
    resume(){try{return context?sessionStorage.getItem('primetime-step-'+context.actor.uid):null;}catch{return null;}},
    form(kind){const params=Object.fromEntries(read().params);params.form=kind;set('application',params);document.body.classList.add('portal-form-focus');},
    formClosed(){document.body.classList.remove('portal-form-focus');},
    applicationOpened(){if(route!=='application')set('application');route='application';hide();el('caregiver-summary').hidden=false;for(const a of document.querySelectorAll('[data-portal-route]'))a.setAttribute('aria-current',a.dataset.portalRoute===route?'page':'false');}
  };
  for(const a of document.querySelectorAll('[data-portal-route]'))a.onclick=e=>{e.preventDefault();navigate(a.dataset.portalRoute);};
  window.addEventListener('popstate',()=>{const current=read();navigate(current.view,Object.fromEntries(current.params),true);});
  document.addEventListener('workforce-session-cleared',()=>{generation++;context=null;hide();for(const id of ['portal-home','portal-profile','portal-documents'])el(id).replaceChildren();document.body.classList.remove('portal-form-focus');});
})();
