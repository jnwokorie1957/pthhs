(() => {
  const panel=document.getElementById('maintenanceWorkspace'); if(!panel)return;
  const $=id=>document.getElementById(id);
  let ready=window.primetimeDataMode?.isActive?.()===true, epoch=0, busy=false, controller=null, cursor=null, query=null, retryAt=0, retryTimer=null;
  const peopleOffsets={patient:null,caregiver:null}; let grants=null,officeTimezone=null;
  const active=()=>ready&&window.primetimeDataMode?.isLive?.()===true&&panel.classList.contains('is-active')&&!document.hidden;
  const ids=['maintenanceFindPatient','maintenanceFindCaregiver','maintenanceLoadPayers','maintenanceSearchSource','maintenanceContinueSearch','maintenancePatientMore','maintenanceCaregiverMore','maintenanceReadReferences'];
  function message(text){$('maintenanceSearchStatus').textContent=text;}
  const owned=[...panel.querySelectorAll('.maintenance-search-fields input,.maintenance-search-fields select,.maintenance-search-fields button'),$('maintenanceDate'),$('maintenanceDateTo')];
  for(const node of owned)node.dataset.searchOwner='true';
  function controls(){for(const node of owned)node.disabled=!active()||busy;
    for(const id of ids)$(id).disabled=!active()||busy||Date.now()<retryAt;
    if(grants){for(const[id,method]of [['maintenanceFindPatient','SearchPatients'],['maintenancePatientMore','SearchPatients'],['maintenanceFindCaregiver','SearchCaregivers'],['maintenanceCaregiverMore','SearchCaregivers'],['maintenanceLoadPayers','GetContracts']])if(!grants.includes(method)){$(id).disabled=true;$(id).title='Awaiting the office read permission';}}
    $('maintenanceContinueSearch').hidden=!cursor;
    for(const kind of ['patient','caregiver'])$('maintenance'+(kind==='patient'?'Patient':'Caregiver')+'More').hidden=peopleOffsets[kind]===null;
  }
  function resetPrivate(){epoch++;controller?.abort();controller=null;busy=false;cursor=null;query=null;grants=null;retryAt=0;if(retryTimer!==null)clearTimeout(retryTimer);retryTimer=null;
    for(const kind of ['Patient','Caregiver']){for(const suffix of ['First','Last','Code'])$('maintenance'+kind+suffix).value='';clearChoice(kind);peopleOffsets[kind.toLowerCase()]=null;}
    $('maintenancePayer').replaceChildren(option('','All payers / contracts'));payerLabel();$('maintenanceSearchKind').value='all';showKind();$('maintenancePayerFilters').open=false;$('maintenanceReferences').open=false;clearReferences(); message('');controls();
  }
  function option(value,text){const node=document.createElement('option');node.value=value;node.textContent=text;return node;}
  function clearChoice(kind){$('maintenance'+kind+'Choice').replaceChildren(option('',kind==='Patient'?'All patients / members':'All caregivers'));$('maintenance'+kind+'Choice').value='';}
  function showKind(){for(const title of ['Patient','Caregiver'])$('maintenance'+title+'Fields').hidden=$('maintenanceSearchKind').value!==title.toLowerCase();}
  function changeKind(){for(const title of ['Patient','Caregiver']){for(const field of ['First','Last','Code'])$('maintenance'+title+field).value='';clearChoice(title);peopleOffsets[title.toLowerCase()]=null;}cursor=query=null;showKind();controls();message('Search method selected. Choose Search HHA visits to apply it.');}
  function payerLabel(){const summary=$('maintenancePayerFilters').querySelector?.('summary');if(summary)summary.textContent='Payer filter'+($('maintenancePayer').value?' · selected':'');}
  function clearReferences(){$('maintenanceReferenceRows').replaceChildren();$('maintenanceReferenceStatus').textContent='';}
  function check(ticket){if(ticket!==epoch||!active())throw new Error('context_changed');}
  async function api(path,ticket,body){check(ticket);let expired=false,timer;
    const requestController=controller;
    const work=async()=>{const response=await window.primetimeApiFetch('/primetime/api/maintenance'+path,{signal:requestController?.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await response.json();if(expired)throw new Error('request_timed_out');check(ticket);if(!response.ok){const error=new Error(value.error||'source_unavailable');error.retry=value.retryAfterSeconds;throw error;}if(value.ok!==true)throw new Error('invalid_source_response');return value;};
    try{return await Promise.race([work(),new Promise((resolve,reject)=>{timer=setTimeout(()=>{expired=true;requestController?.abort();reject(new Error('request_timed_out'));},45000);})]);}finally{clearTimeout(timer);}
  }
  async function action(work,statusTarget){if(!active()||busy)return;const ticket=epoch;busy=true;controller=new AbortController();controls();try{await work(ticket);}catch(error){if(ticket===epoch){
    let text=error.message==='read_not_owner_enabled'?'This HHA lookup is awaiting the office read permission. Current-day cached visits and office reviews remain available.':error.message==='request_timed_out'?'The source read timed out. Loaded visits remain selectable; retry the search.':error.message==='maintenance_search_changed_restart'?'HHA results or office settings changed. Start a new search to avoid mixing source pages.':error.message==='choose_matching_patient'?'Find and select the matching patient/member before searching visits.':error.message==='choose_matching_caregiver'?'Find and select the matching caregiver before searching visits.':error.message==='invalid_dates'?'Enter valid From and To service dates, in order, within 366 inclusive days.':'The source request was not confirmed. Your loaded visits remain available.';
    if(Number.isFinite(error.retry)&&error.retry>0){const delay=Math.min(error.retry,3600);retryAt=Date.now()+delay*1000;text=`HHA reads are paused. Retry after ${delay} seconds. Loaded visits and office reviews remain available.`;retryTimer=setTimeout(()=>{retryTimer=null;if(ticket===epoch)controls();},delay*1000);}
    message(text);if(statusTarget)$(statusTarget).textContent=text;document.dispatchEvent(new CustomEvent('primetime-maintenance-search-error',{detail:text}));
  }}finally{if(ticket===epoch){busy=false;controller=null;controls();}}}
  function personBody(kind){const title=kind==='patient'?'Patient':'Caregiver';return{kind,firstName:$('maintenance'+title+'First').value.trim(),lastName:$('maintenance'+title+'Last').value.trim(),code:$('maintenance'+title+'Code').value.trim()};}
  function capabilities(){if(!active())return;void action(async ticket=>{const value=await api('/capabilities',ticket);if(!Array.isArray(value.enabledReads))throw new Error('invalid_source_response');grants=value.enabledReads;officeTimezone=value.officeTimezone;document.dispatchEvent(new CustomEvent('primetime-maintenance-capabilities',{detail:value}));if(grants.length<5)message('Some name, payer or reason lookups await the office read permissions. Date-range source reads and existing reviews remain available.');});}
  async function find(kind,ticket,more=false){const title=kind==='patient'?'Patient':'Caregiver',body=personBody(kind);message('Searching HHA '+(kind==='patient'?'patient/member':'caregiver')+' profiles and checking office membership…');
    const value=await api('/people',ticket,{...body,offset:more?peopleOffsets[kind]||0:0});
    if(value.kind!==kind||!Array.isArray(value.items)||value.items.length>5||value.items.some(item=>typeof item.id!=='string'||!/^\d+$/.test(item.id)))throw new Error('invalid_source_response');
    const choice=$('maintenance'+title+'Choice');if(!more)clearChoice(title);
    for(const item of value.items)choice.append(option(item.id,`${item.lastName||''}, ${item.firstName||''} · ${item.code||item.id}`));
    if(!more&&value.items.length===1)choice.value=value.items[0].id;
    peopleOffsets[kind]=value.nextOffset;message(`${value.items.length} office-checked ${kind} profiles on this page.${value.nextOffset!==null?' More matching profiles are available.':''}${value.truncated?' HHA search was truncated; narrow the name/code.':''} Choose the correct profile.`);
  }
  function parameters(){const from=$('maintenanceDate').value,to=$('maintenanceDateTo').value;
    const valid=day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
    if(!valid(from)||!valid(to)||to<from||Date.parse(to)-Date.parse(from)>365*86400000)throw new Error('invalid_dates');
    const kind=$('maintenanceSearchKind').value;if(!['all','patient','caregiver'].includes(kind))throw new Error('invalid_search_kind');
    const patientId=kind==='patient'?$('maintenancePatientChoice').value:'',caregiverId=kind==='caregiver'?$('maintenanceCaregiverChoice').value:'';
    if(kind==='patient'&&!patientId)throw new Error('choose_matching_patient');
    if(kind==='caregiver'&&!caregiverId)throw new Error('choose_matching_caregiver');
    return{from,to,...(patientId?{patientId}:{}),...(caregiverId?{caregiverId}:{}),...($('maintenancePayer').value?{contractId:$('maintenancePayer').value}:{})};
  }
  async function search(ticket,next=false){const chosen=parameters();if(next&&JSON.stringify(chosen)!==JSON.stringify(query))throw new Error('maintenance_search_changed_restart');
    if(!next){cursor=null;query=chosen;document.dispatchEvent(new Event('primetime-maintenance-search-started'));controls();}
    message(`Reading HHA visits from ${chosen.from} through ${chosen.to}…`);
    const value=await api('/search',ticket,{...chosen,...(next&&cursor?{cursor}:{})});
    if(value.source!=='hhaexchange'||value.scope?.from!==chosen.from||value.scope?.to!==chosen.to||!Array.isArray(value.items)||typeof value.checkedThrough!=='number'||typeof value.totalIds!=='number'||value.nextCursor!==null&&typeof value.nextCursor!=='string')throw new Error('invalid_source_response');
    cursor=value.nextCursor;document.dispatchEvent(new CustomEvent('primetime-maintenance-results',{detail:value}));
    message(`${value.checkedThrough} of ${value.totalIds} returned source IDs checked.${cursor?' More source pages remain; continue to read them.':' Source-page reading finished.'}${value.truncated?' Discovery was truncated; narrow the search.':''}`);
    if(value.retryAfterSeconds){retryAt=Date.now()+value.retryAfterSeconds*1000;retryTimer=setTimeout(()=>{retryTimer=null;if(ticket===epoch)controls();},value.retryAfterSeconds*1000);message(`Source progress saved. Continue after ${value.retryAfterSeconds} seconds; loaded visits are usable now.`);}
  }
  for(const kind of ['patient','caregiver']){const title=kind==='patient'?'Patient':'Caregiver';$('maintenanceFind'+title).addEventListener('click',()=>action(ticket=>find(kind,ticket)));$('maintenance'+title+'More').addEventListener('click',()=>action(ticket=>find(kind,ticket,true)));
    for(const suffix of ['First','Last','Code'])$('maintenance'+title+suffix).addEventListener('input',()=>{clearChoice(title);peopleOffsets[kind]=null;controls();});
  }
  $('maintenanceLoadPayers').addEventListener('click',()=>action(async ticket=>{const value=await api('/contracts',ticket);if(!Array.isArray(value.items)||value.items.length>200)throw new Error('invalid_source_response');$('maintenancePayer').replaceChildren(option('','All payers / contracts'),...value.items.map(item=>option(item.id,`${item.name||'Unnamed contract'} · ${item.id}`)));message(`${value.items.length} HHA office contracts loaded.${value.truncated?' The source list was truncated.':''}`);}));
  $('maintenanceSearchKind').addEventListener('change',changeKind);
  $('maintenancePayer').addEventListener('change',payerLabel);
  $('maintenanceReferenceCatalog').addEventListener('change',clearReferences);
  $('maintenanceReadReferences').addEventListener('click',()=>action(async ticket=>{clearReferences();$('maintenanceReferenceStatus').textContent='Reading HHA reference codes…';const catalog=$('maintenanceReferenceCatalog').value,value=await api('/reference-codes?catalog='+encodeURIComponent(catalog),ticket);if(value.catalog!==catalog||value.scope!=='agency_reference'||value.supportsConfirmation!==false||!Array.isArray(value.items)||value.items.length>200)throw new Error('invalid_source_response');
    $('maintenanceReferenceStatus').textContent=`${value.items.length} source codes · ${value.operation} · fetched ${value.fetchedAt}.${value.truncated?' Partial list.':''} Reference only; not approved for a selected visit.`;
    for(const item of value.items){const card=document.createElement('details'),summary=document.createElement('summary'),description=document.createElement('p'),status=document.createElement('p');summary.textContent=`${item.id} · ${item.label||'No source label'}`;description.textContent=item.description||'No description supplied.';status.textContent=`Source status: ${item.status??'not supplied'} · Note required: ${item.noteRequired??'not supplied'} · Minimum characters: ${item.minimumNoteCharacters??'not supplied'}`;card.append(summary,description,status);$('maintenanceReferenceRows').append(card);}
  },'maintenanceReferenceStatus'));
  $('maintenanceSearchSource').addEventListener('click',()=>action(ticket=>search(ticket)));
  $('maintenanceContinueSearch').addEventListener('click',()=>action(ticket=>search(ticket,true)));
  $('maintenanceDateTo').value=$('maintenanceDate').value;
  $('maintenanceDateTo').addEventListener('change',()=>{cursor=null;query=null;controls();message('Dates changed. Choose Search HHA visits.');});
  $('maintenanceDate').addEventListener('change',()=>{cursor=null;query=null;controls();message('Dates changed. Choose Search HHA visits.');});
  $('maintenanceResetSearch').addEventListener('click',()=>{resetPrivate();$('maintenanceDateTo').value=$('maintenanceDate').value;message('Filters reset. Choose Search HHA visits.');});
  document.addEventListener('primetime-ready',()=>{ready=true;resetPrivate();if(!$('maintenanceDateTo').value)$('maintenanceDateTo').value=$('maintenanceDate').value;capabilities();});
  document.addEventListener('primetime-signed-out',()=>{ready=false;resetPrivate();});
  document.addEventListener('primetime-data-mode-changed',resetPrivate);
  document.addEventListener('primetime-view-changed',()=>{resetPrivate();capabilities();});
  $('maintenanceRefresh').addEventListener('click',capabilities);
  document.addEventListener('primetime-maintenance-refresh',event=>{const resume=query!==null;epoch++;controller?.abort();controller=null;busy=false;cursor=null;query=null;controls();if(resume&&active()){event.detail.handled=true;void action(ticket=>search(ticket));}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetPrivate();else controls();});
  function selectPerson(item){if(!active())return false;if(busy){message('Finish or reset the current source read before changing the selected person.');return false;}if(!['patient','caregiver'].includes(item?.kind)||typeof item.id!=='string'||!/^\d+$/.test(item.id))return;const title=item.kind==='patient'?'Patient':'Caregiver';$('maintenanceSearchKind').value=item.kind;changeKind();for(const[field,key]of [['First','firstName'],['Last','lastName'],['Code','code']])$('maintenance'+title+field).value=item[key]||'';const choice=$('maintenance'+title+'Choice');choice.replaceChildren(option('','All '+item.kind+'s'),option(item.id,`${item.lastName||item.kind}, ${item.firstName||''} · ${item.code||item.id}`));choice.value=item.id;cursor=null;query=null;controls();message('Source person selected. Choose the From/To dates and Search HHA visits.');$('maintenanceDate').focus?.();return true;}
  document.addEventListener('primetime-maintenance-select-person',event=>selectPerson(event.detail));
  document.addEventListener('primetime-maintenance-read-patient-day',event=>{if(Date.now()<retryAt){message('Wait for the source retry interval before reading fresh visits.');return;}if(!selectPerson(event.detail))return;$('maintenanceDate').value=$('maintenanceDateTo').value=event.detail.date;$('maintenancePayer').value='';$('maintenanceFilter').value='all';$('maintenanceSearch').value='';payerLabel();void action(ticket=>search(ticket));});
  for(const control of document.querySelectorAll?.('[data-maintenance-person]')||[])control.addEventListener('click',()=>{$('maintenanceSearchKind').value=control.dataset.maintenancePerson;changeKind();$('maintenance'+(control.dataset.maintenancePerson==='patient'?'Patient':'Caregiver')+'Fields').scrollIntoView?.({block:'center'});});
  showKind();controls();
})();
