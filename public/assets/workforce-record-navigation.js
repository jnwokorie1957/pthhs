(() => {
  let actor=null;
  const allowed=view=>view==='overview'||({accounts:'accounts.support',applications:'applications.review',opportunities:'opportunities.read',access:'staff.review'}[view] && actor?.grant.permissions.includes({accounts:'accounts.support',applications:'applications.review',opportunities:'opportunities.read',access:'staff.review'}[view])) || view==='access'&&actor?.grant.role==='owner'&&actor.grant.permissions.includes('staff.manage');
  function set(view,params={},replace=false){const query=new URLSearchParams(params).toString(),hash='#'+view+(query?'?'+query:'');if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',location.pathname+location.search+hash);}
  async function restore(){if(!actor)return;const legacy=location.hash.match(/^#application=([a-zA-Z0-9_-]{1,128})$/);const [view='overview',query='']=location.hash.slice(1).split('?');const selected=legacy?'applications':view||'overview',params=legacy?new URLSearchParams({record:legacy[1],source:'portal'}):new URLSearchParams(query);
    if(!allowed(selected)||!window.WorkforceManagement.show(selected,false))return; if(params.get('record'))await window.WorkforcePersonnel.openRoute(selected,params);else {window.WorkforcePersonnel.closeRecord?.(selected);if(selected==='accounts')window.WorkforcePersonnel.browse();}
  }
  window.WorkforceStaffNavigation={set,restore};
  window.WorkforceRecordTabs={decorate(target,{view,id,source='portal',selected='overview',writeHistory=true}={}){
    if(!target.childElementCount)return;
    const sections=[...target.children];const groups=new Map();
    const classify=title=>/account access/i.test(title)?'access':/Employment application|application responses/i.test(title)?'application':/forms|documents|files from/i.test(title)?'documents':/employment information/i.test(title)?'employment':'overview';
    let current='overview';
    for(const child of sections){const heading=child.querySelector?.('h3')||(['H3'].includes(child.tagName)?child:null);if(heading)current=classify(heading.textContent);else if(child.tagName==='BUTTON'&&/portal access/.test(child.textContent))current='access';
      if(child.classList.contains('caregiver-profile-heading')||child.tagName==='H2')continue;
      if(!groups.has(current)){const panel=document.createElement('section');panel.setAttribute('role','tabpanel');panel.id='record-'+view+'-'+current;groups.set(current,panel);}groups.get(current).append(child);
    }
    const nav=document.createElement('div');nav.className='record-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Caregiver record');
    const back=document.createElement('button');back.type='button';back.className='btn-secondary record-back';back.textContent=view==='applications'?'← Back to applications':'← Back to caregivers';back.onclick=()=>{target.replaceChildren();document.body.classList.remove('manager-record-focus');window.WorkforceManagement.show(view);document.getElementById(view==='applications'?'personnel-filter':'caregiver-account-name')?.focus();};target.prepend(back,nav);
    const labels={overview:'Overview',application:'Application',documents:'Documents & forms',employment:'Employment',access:'Account access'};
    const select=(key,write=true)=>{for(const [k,panel]of groups){panel.hidden=k!==key;const button=nav.querySelector('[data-record-tab="'+k+'"]');button.setAttribute('aria-selected',String(k===key));button.tabIndex=k===key?0:-1;}if(write)set(view,{record:id,source,tab:key});};
    for(const [key,label]of Object.entries(labels)){if(!groups.has(key))continue;const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.recordTab=key;button.id='record-tab-'+view+'-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls',groups.get(key).id);groups.get(key).setAttribute('aria-labelledby',button.id);button.onclick=()=>select(key);button.onkeydown=e=>{const buttons=[...nav.children],index=buttons.indexOf(button);let next;if(e.key==='ArrowRight')next=(index+1)%buttons.length;if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;if(next!==undefined){e.preventDefault();buttons[next].click();buttons[next].focus();}};nav.append(button);target.append(groups.get(key));}
    const active=groups.has(selected)?selected:groups.keys().next().value;if(active)select(active,false);if(writeHistory)set(view,{record:id,source,tab:active||'overview'});if(view==='applications')document.body.classList.add('manager-record-focus');
  }};
  window.addEventListener('popstate',restore);
  document.addEventListener('workforce-session',event=>{actor=event.detail;queueMicrotask(restore);});
  document.addEventListener('workforce-session-cleared',()=>{actor=null;document.body.classList.remove('manager-record-focus');});
})();
