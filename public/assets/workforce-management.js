(() => {
 const el=id=>document.getElementById(id),panels=[...document.querySelectorAll('[data-manager-panel]')],links=[...document.querySelectorAll('[data-manager-go]')];
 const views={overview:['Overview','A clear view of your caregiver workforce.'],accounts:['Caregiver accounts','Help caregivers sign in and manage their account access.'],applications:['Applications','Review each application, one step at a time.'],opportunities:['Opportunities','Prepare and publish openings for your next great caregiver.'],access:['Team access','Keep the right people connected to the right work.']};
 let actor=null,generation=0,applicationSummary=null,applicationsOpened=false;
 const can=permission=>actor?.grant.permissions.includes(permission);
 const allowed=view=>view==='overview'||view==='opportunities'&&can('opportunities.read')||view==='accounts'&&['owner','hr'].includes(actor?.grant.role)&&can('accounts.support')||view==='applications'&&['owner','hr'].includes(actor?.grant.role)&&can('applications.review')||view==='access'&&actor?.grant.role==='owner'&&can('staff.manage');
 function show(view){
  if(!actor||!views[view]||!allowed(view))return false;
  for(const panel of panels)panel.hidden=panel.dataset.managerPanel!==view;el('manager-page-actions').hidden=view!=='overview';
  for(const button of document.querySelectorAll('[data-manager-view]'))button.setAttribute('aria-current',button.dataset.managerView===view?'page':'false');
  el('manager-title').textContent=views[view][0];el('manager-subtitle').textContent=views[view][1];el('manager-breadcrumb').textContent=views[view][0];document.title=views[view][0]+' | Primetime Workforce';
  el('manager-title').focus({preventScroll:true});
  if(view==='applications'&&!applicationsOpened){applicationsOpened=true;el('personnel-refresh').click();}
  return true;
 }
 window.WorkforceManagement={show};
 for(const button of links)button.addEventListener('click',()=>{
  if(!show(button.dataset.managerGo))return;
  if(button.dataset.managerFilter){el('staff-filter').value=button.dataset.managerFilter;el('staff-filter').dispatchEvent(new Event('change'));}
 });
 async function applicationCounts(){
  if(!allowed('applications'))return;const sequence=generation;
  try{const result=await window.workforceApi('/staff/applications');if(sequence!==generation)return;applicationSummary=result.items;el('manager-count-applications').textContent=String(result.items.filter(item=>item.state==='submitted').length);el('manager-summary-message').textContent='';}
  catch(error){if(sequence===generation){el('manager-count-applications').textContent='—';el('manager-summary-message').textContent='Application totals are unavailable. Refresh to try again.';}}
 }
 el('manager-refresh').onclick=async()=>{const button=el('manager-refresh');button.disabled=true;try{await Promise.allSettled([can('opportunities.read')?window.WorkforceRecruiting?.refresh():Promise.resolve(),applicationCounts()]);}finally{button.disabled=false;}};
 el('manager-new').onclick=()=>{if(show('opportunities'))el('staff-new').click();};
 document.addEventListener('workforce-opportunities-updated',event=>{
  if(!actor)return;for(const state of ['draft','review','approved','published']){el('manager-pipeline-'+state).textContent=String(event.detail[state]||0);const count=el('manager-count-'+state);if(count)count.textContent=String(event.detail[state]||0);}
 });
 document.addEventListener('workforce-applications-updated',event=>{if(!actor)return;applicationSummary=event.detail;el('manager-count-applications').textContent=String(event.detail.filter(item=>item.state==='submitted').length);});
 document.addEventListener('workforce-session-cleared',()=>{
  generation++;actor=null;applicationSummary=null;applicationsOpened=false;el('manager-nav').hidden=true;el('manager-page-actions').hidden=true;el('manager-login-card').hidden=false;
  for(const panel of panels)panel.hidden=true;
  for(const id of ['manager-count-published','manager-count-review','manager-count-applications','manager-count-draft',...['draft','review','approved','published'].map(state=>'manager-pipeline-'+state)])el(id).textContent='—';
  el('manager-title').textContent='Workforce management';el('manager-subtitle').textContent='Sign in to your team’s workspace.';el('manager-breadcrumb').textContent='Workforce';el('manager-scope').textContent='Staff workspace';el('manager-summary-message').textContent='';
 });
 document.addEventListener('workforce-session',event=>{
  generation++;actor=event.detail;applicationSummary=null;applicationsOpened=false;el('manager-nav').hidden=false;el('manager-page-actions').hidden=false;el('manager-login-card').hidden=true;el('session-status').textContent='';
  el('manager-scope').textContent=actor.grant.offices.length+' assigned '+(actor.grant.offices.length===1?'office':'offices');el('manager-scope').title=actor.grant.offices.join(', ');
  for(const button of links)button.hidden=!allowed(button.dataset.managerGo);for(const item of document.querySelectorAll('[data-manager-feature]'))item.hidden=!allowed(item.dataset.managerFeature);
  el('manager-new').hidden=!can('opportunities.edit');el('manager-application-stat').hidden=!allowed('applications');
  el('staff-editor-panel').hidden=!can('opportunities.edit');show('overview');applicationCounts();
 });
})();
