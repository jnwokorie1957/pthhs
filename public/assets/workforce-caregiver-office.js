(()=>{
 let actor=null,generation=0;const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;},can=p=>actor?.grant.permissions.includes(p);
 const date=value=>value?new Date(value+'T12:00:00').toLocaleDateString('en-US'):'Not on file';
 async function augment(target,{source='portal',id,current=()=>true}){
  const base='/staff/caregivers/'+source+'/'+encodeURIComponent(id),token=generation,valid=()=>token===generation&&current();
  if(can('hr.expirations')){
   const area=node('section');area.dataset.recordGroup='employment';area.className='caregiver-license office-inline-form';const label=node('label',"Driver’s license / ID expiration date"),input=node('input');input.type='date';label.append(input);const save=node('button','Save expiration date');save.type='button';save.className='manager-primary';save.disabled=true;const message=node('p','Loading expiration date…');message.setAttribute('role','status');area.append(label,save,node('p','HR alerts start 30 days before expiration. Reminders go to IRAB@PTHHS.net.'),message);
   const contact=[...target.children].find(e=>e.tagName==='H3'&&/Contact information/.test(e.textContent));
   if(contact?.nextElementSibling)contact.nextElementSibling.after(area);else target.append(area);
   let revision=0;
   try{const data=await workforceApi(base+'/license');if(!valid())return;input.value=data.date;revision=data.revision;save.disabled=false;message.textContent=data.date?'On file: '+date(data.date):'Enter the expiration date shown on the current ID.';}catch{if(valid())message.textContent='Expiration date unavailable. Reopen the record to try again.';}
   save.onclick=async()=>{save.disabled=true;try{const data=await workforceApi(base+'/license',{date:input.value,revision});if(!valid())return;revision=data.revision;message.textContent=data.date?'Expiration date saved.':'Expiration date cleared.';loadAlerts();}catch(error){if(valid())message.textContent=error.message;}finally{if(valid())save.disabled=false;}};
  }
  if(!valid())return;
  if(source==='hhaexchange')window.WorkforceHhaRecords?.mount(target,{api:workforceApi,base:'/staff/roster/'+encodeURIComponent(id)+'/records/',self:false,current:valid});
  const schedule=node('section');schedule.dataset.recordGroup='schedule';schedule.append(node('h3','Current schedule'),node('p','Today and the next six days. Times are shown as recorded in HHA.'));const message=node('p','Loading schedule…');message.setAttribute('role','status');const list=node('div'),more=node('button','Load more shifts'),retry=node('button','Refresh schedule');more.type=retry.type='button';more.className=retry.className='btn-secondary';more.hidden=true;schedule.append(message,list,more,retry);target.append(schedule);let next=null,busy=false;
  async function load(append=false){if(busy||!valid())return;busy=true;more.disabled=retry.disabled=true;if(!append)list.replaceChildren();message.textContent='Loading schedule…';try{const result=await workforceApi(base+'/schedule'+(append&&next?'?after='+encodeURIComponent(next):''));if(!valid())return;
   for(const row of result.items){const item=node('article');item.className='office-record';item.append(node('strong',(row.date||'Date not supplied').slice(0,10)),node('p',(row.start||'Start not supplied')+' – '+(row.end||'End not supplied')),node('p','Member ID: '+(row.memberId||'Not supplied')));list.append(item);}
   next=result.next;more.hidden=!next;message.textContent=!result.linked?'Schedule appears after this caregiver is linked to an HHA record.':result.total===0?'No scheduled shifts returned for the next seven days.':list.childElementCount+' of '+result.total+' scheduled shifts loaded.';
  }catch{if(valid())message.textContent='HHA schedule could not be loaded. Refresh to try again.';}finally{if(valid()){busy=false;more.disabled=retry.disabled=false;}}}
  more.onclick=()=>load(true);retry.onclick=()=>load();void load();
 }
 async function loadAlerts(){
  const root=document.getElementById('caregiver-id-alerts');if(!root)return;root.hidden=!can('hr.expirations');if(root.hidden)return;const token=generation;root.replaceChildren(node('h2','ID expiration alerts'),node('p','Loading HR alerts…'));
  try{const results=await Promise.all(actor.grant.offices.map(office=>workforceApi('/staff/id-expirations?office='+encodeURIComponent(office))));if(token!==generation)return;const items=results.flatMap(r=>r.items);root.replaceChildren(node('h2','ID expiration alerts'),node('p',items.length?items.length+' IDs are expired or expire within 30 days.':'No recorded ID expiration dates are due within 30 days.'),node('p','HR can enter or update dates in each caregiver’s Employment tab. Reminder emails: IRAB@PTHHS.net.'));
   for(const item of items){const button=node('button',item.name+' · '+date(item.date)+(item.days<0?' · Expired':' · '+item.days+' days remaining'));button.type='button';button.className='btn-secondary';button.onclick=()=>{window.WorkforceStaffNavigation.set('accounts',{record:item.id,source:item.source,tab:'employment'});window.WorkforceStaffNavigation.restore();};root.append(button);}
  }catch{if(token===generation)root.replaceChildren(node('h2','ID expiration alerts'),node('p','Could not load ID expiration alerts. Refresh the portal to try again.'));}
 }
 async function syncStatus(){const el=document.getElementById('caregiver-sync-status');if(!el||!can('accounts.support'))return;const token=generation;try{const data=await workforceApi('/staff/caregiver-sync');if(token!==generation)return;el.textContent='Automatic HHA sync: every 15 minutes, Monday–Friday, 9 a.m.–5 p.m. Central.'+(data.lastCompletedAt?' Last completed: '+new Date(data.lastCompletedAt).toLocaleString('en-US',{timeZone:'America/Chicago'})+' CT.':' First scheduled sync is pending.')+(data.state==='needs_attention'?' Latest sync needs attention.':data.remaining?' Refreshing '+data.remaining+' changed profiles.':'');}catch{if(token===generation)el.textContent='Caregiver sync status could not be loaded.';}}
 document.addEventListener('workforce-session',event=>{actor=event.detail;generation++;loadAlerts();syncStatus();});
 document.addEventListener('workforce-session-cleared',()=>{actor=null;generation++;document.getElementById('caregiver-id-alerts')?.replaceChildren();});
 setInterval(()=>{if(document.visibilityState==='visible'&&actor){loadAlerts();syncStatus();}},300000);
 window.WorkforceCaregiverOffice={augment};
})();
