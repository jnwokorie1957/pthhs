(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function button(title,action){const b=node('button',title,'btn-secondary');b.type='button';b.onclick=action;return b;}
 function notice(){const p=node('p');p.setAttribute('role','status');return p;}
 const roleNames={staff:'Office representative',member:'Member or representative',caregiver:'Caregiver'};
 function pending(record){
  if(!record?.data)return record?.pendingSigners||[];
  const data=record.data;
  return (data.requiredSigners||[]).filter(role=>!data.signatures?.some(s=>s.role===role)).map(role=>({
   role,pages:[...new Set((data.signatureFields||[]).filter(f=>f.role===role).map(f=>f.page+1))].sort((a,b)=>a-b)
  }));
 }
 window.WorkforceFormWorkflow={mount(target,{office,current,open,editorContext}){
  let client=null,caregiver=null,type='admissions',templates=null,epoch=0,busy=false,position=0,queue=[],packetId=null;
  let retryLibrary=null,savedPackets=[],next=null,packetRead=0,navigation=0,plan=null;
  const selection=new Set(),shell=node('section',undefined,'form-workflow'),banner=node('div',undefined,'form-workflow-intro');
  banner.append(node('h2','Prepare client forms'),node('p','Choose a client, select the paperwork, then review each document with its signers.'));
  const clientArea=node('section',undefined,'form-client-step'),chosen=node('div'),status=notice();
  const choices=node('section',undefined,'form-choice-step'),types=node('div',undefined,'form-type-grid'),content=node('div');
  const careArea=node('details'),careChosen=node('p'),packet=node('section',undefined,'form-packet-progress'),savedArea=node('section');
  function namePicker(kind,labelText,placeholder,onEdit,onChoose){
   const area=node('form',undefined,'office-toolbar'),label=node('label',labelText),input=node('input'),matches=node('div'),feedback=notice();
   let timer,version=0;
   input.type='search';input.placeholder=placeholder;input.autocomplete='off';input.maxLength=60;label.append(input);
   function clear(){clearTimeout(timer);version++;matches.replaceChildren();feedback.textContent='';}
   async function lookup(after){
    clearTimeout(timer);if(!current())return;
    const request=++version,context=epoch,name=input.value.trim(),valid=()=>current()&&epoch===context&&version===request;
    matches.replaceChildren();if(name.length<2){feedback.textContent='Type at least two letters.';return;}
    feedback.textContent='Searching HHA…';
    try{
     const isClient=kind==='client';
     const result=await workforceApi(isClient?'/staff/clients/search':'/staff/field-visits/names',isClient?{name,...(after?{after}:{})}:{office,kind,name});
     if(!valid())return;
     const rows=result.items.filter(row=>!isClient||row.office===office).sort((a,b)=>a.name.localeCompare(b.name));
     for(const row of rows)matches.append(button(row.name+(row.memberId||row.id?' · '+(row.memberId||row.id):''),()=>{
      if(!valid())return;clear();input.value='';onChoose(row);
     }));
     if(result.next)matches.append(button('More matches',()=>valid()&&lookup(result.next)));
     feedback.textContent=rows.length?'Choose the matching '+kind+'.':'No verified match on this page.';
     if(result.hasMore||result.truncated||result.next)feedback.textContent+=' Type more of the name to narrow the results.';
    }catch(e){if(valid())feedback.textContent='HHA search could not finish. '+e.message;}
   }
   input.oninput=()=>{clear();onEdit();if(input.value.trim().length<2){feedback.textContent='Type at least two letters.';return;}
    const context=epoch,request=version;feedback.textContent='Searching HHA…';
    timer=setTimeout(()=>{if(current()&&context===epoch&&request===version)lookup();},300);
   };
   area.onsubmit=e=>{e.preventDefault();lookup();};area.append(label,button('Find '+kind,()=>lookup()),matches,feedback);
   return {area,input,clear};
  }
  const clients=namePicker('client','Find client / member by name','Type the first or last name',()=>{},chooseClient);
  const caregivers=namePicker('caregiver','Caregiver / employee name','First or last name',()=>changeCaregiver(null),changeCaregiver);
  function resetPacket(){navigation++;queue=[];packetId=plan=null;position=0;renderQueue();}
  function changeCaregiver(row){
   const interrupted=busy||queue.length;epoch++;caregiver=row;resetPacket();careChosen.textContent=row?'Selected caregiver: '+row.name:'';
   if(interrupted)status.textContent='Caregiver changed. Prepare the forms for the current selection.';
  }
  function changeClient(){epoch++;packetRead++;client=caregiver=null;resetPacket();selection.clear();savedPackets=[];next=null;
   clients.clear();caregivers.clear();clients.input.value=caregivers.input.value='';chosen.replaceChildren();careChosen.textContent=status.textContent='';
   clients.area.hidden=false;render();clients.input.focus();}
  function chooseClient(row){
   if(!current()||row.office!==office)return;changeClient();client=row;clients.area.hidden=true;
   chosen.append(node('strong',row.name),node('p','Agency member ID: '+row.memberId+' · Office '+office),button('Change client',changeClient));
   render();loadPackets();
  }
  clientArea.append(node('h3','1. Choose the client'),clients.area,chosen,button('Start supervisory visit by caregiver',()=>{if(current())open(null,{kind:'orientation',requiredSigners:['member','caregiver','staff'],fields:{},pages:[]});}));
  careArea.append(node('summary','Caregiver / employee (when needed)'),caregivers.area,careChosen);
  const typeButtons=[];
  for(const [key,title,description] of [['admissions','Admission documents','Select forms for the admission packet'],['orientation','Attendant / supervisory visit','Client and caregiver'],['assessment','Client assessment','Needs Assessment Questionnaire, Task and Hour Guide'],['survey','Client satisfaction survey','Client feedback']]){
   const b=button('',()=>{if(busy||!current())return;caregivers.clear();navigation++;type=key;render();});
   b.className='form-type-card';b.append(node('strong',title),node('span',description));types.append(b);typeButtons.push([key,b]);
  }
  choices.append(node('h3','2. Choose the forms'),types,careArea,content,status);
  async function loadPackets(more=false){
   if(!client||!current())return;const member=client,request=++packetRead;
   try{
    const result=await workforceApi('/staff/admission-packets/search',{office,memberId:member.memberId,...(more&&next?{after:next}:{})});
    if(!current()||client!==member||request!==packetRead)return;
    const rows=result.items.filter(row=>Array.isArray(row.items));savedPackets=more?[...savedPackets,...rows]:rows;next=result.next;renderSaved();
   }catch(e){if(current()&&client===member&&request===packetRead)savedArea.replaceChildren(node('p','Saved packets could not be loaded. '+e.message),button('Retry saved packets',()=>loadPackets()));}
  }
  async function resume(id){
   if(busy||!current())return;const request=++navigation,context=epoch;
   try{
    const saved=await workforceApi('/staff/admission-packets/'+id);
    if(!current()||epoch!==context||navigation!==request)return;
    packetId=saved.id;plan=null;queue=saved.items.map(item=>({id:item.id,title:item.title,record:item}));
    position=Math.max(0,queue.findIndex(row=>row.record.state!=='signed'));renderQueue();packet.scrollIntoView({block:'start'});
    if(!saved.completed)await go(position);
   }catch(e){if(current()&&epoch===context)status.textContent=e.message;}
  }
  function renderSaved(){
   savedArea.replaceChildren();if(!client)return;if(savedPackets.length)savedArea.append(node('h3','Saved admission packets'));
   for(const row of savedPackets){const card=node('article',undefined,row.completed?'form-completed':'office-record');
    card.append(node('strong',row.completed?'Completed admission packet':row.items.filter(i=>i.state==='signed').length+' of '+row.items.length+' forms complete'),
     node('p',new Date(row.createdAt).toLocaleDateString()),button(row.completed?'View completed packet':'Resume packet',()=>resume(row.id)));savedArea.append(card);}
   if(next)savedArea.append(button('Load more saved packets',()=>loadPackets(true)));
  }
  async function exportPacket(){
   const id=packetId,context=epoch,valid=()=>current()&&context===epoch&&packetId===id;
   try{const blob=await workforceApi('/staff/admission-packets/'+id+'/pdf',undefined,true);if(!valid())return;
    const target=node('div');packet.append(target);await window.WorkforcePrivatePdf.show(target,blob,'completed-admission-packet.pdf',valid,{completed:true,allowExport:true,title:'Completed admission packet'});
   }catch(e){if(valid())status.textContent=e.message;}
  }
  function shareControls(){
   const box=node('section'),actions=node('div',undefined,'office-record-actions'),feedback=notice();
   box.append(node('h4','Share a completed copy'),node('p','When the member or caregiver requests a copy, open a message and choose their address or phone number.'),actions,feedback);
   const id=packetId,context=epoch,valid=()=>current()&&context===epoch&&packetId===id;
   for(const [channel,title] of [['email','Email packet'],['sms','Text packet']])actions.append(button(title,async()=>{
    try{const {prepareMessage}=await import('/primetime/admission-share.mjs');if(valid())await prepareMessage({channel,id,actions,feedback,valid});}catch(e){if(valid())feedback.textContent=e.message;}
   }));return box;
  }
  function renderQueue(){
   packet.replaceChildren();packet.hidden=!queue.length;if(!queue.length)return;
   packet.append(node('h3','3. Review & sign'),node('p',queue.filter(row=>row.record.state==='signed').length+' of '+queue.length+' forms fully signed'));
   const list=node('ol',undefined,'form-packet-documents');
   queue.forEach((row,index)=>{const done=row.record.state==='signed',entry=node('li',undefined,done?'form-completed':'');
    entry.append(button(row.title,()=>go(index)),node('span',done?'Completed — fully signed':'Awaiting signatures',done?'form-completed-status':'office-badge'));
    for(const {role,pages} of pending(row.record))entry.append(node('p',roleNames[role]+(pages.length?' · '+(pages.length===1?'page ':'pages ')+pages.join(', '):'')+' · signature needed'));
    list.append(entry);
   });packet.append(list);
   if(packetId&&queue.every(row=>row.record.state==='signed')){
    packet.append(node('p','Admission packet completed — all selected documents are fully signed.','form-completed-status'),button('Download / print completed packet',exportPacket),shareControls());
   }else{
    const nav=node('div',undefined,'office-record-actions'),prev=button('Previous document',()=>go(position-1)),next=button('Next document',()=>go(position+1));
    prev.disabled=position===0;next.disabled=position===queue.length-1;nav.append(prev,button('Open current document',()=>go(position)),next);packet.append(nav);
   }
  }
  async function go(index){
   if(busy||!current()||index<0||index>=queue.length)return;const context=epoch,request=++navigation,editor=editorContext?.(),row=queue[index];
   try{const record=await workforceApi('/staff/field-visits/'+row.id);if(!current()||context!==epoch||request!==navigation||editor!==editorContext?.()||row!==queue[index])return;
    position=index;row.record=record;renderQueue();open(record);
   }catch(e){if(current()&&context===epoch&&request===navigation)status.textContent=e.message;}
  }
  function admissionChoices(){
   content.append(node('h4','Admission paperwork for '+client.name),node('p','Select admission packet checks the standard forms in this office. Attendant Information is optional. Adjust the list, then prepare the selected documents to create drafts and open the first one.'));
   if(retryLibrary){content.append(node('p','The office admission library could not be loaded.'),button('Retry admission library',()=>retryLibrary()));return;}
   if(!templates?.length){content.append(node('p',templates?'No admission forms are available. Open Manage admission form templates below to add reviewed blank forms.':'Loading the office admission library…'));return;}
   const selectionBox=node('div',undefined,'form-document-options'),count=notice(),checks=[];
   const sync=()=>{selection.clear();for(const c of checks)if(c.checked)selection.add(c.value);count.textContent=selection.size+' of '+templates.length+' forms selected.';prepare.disabled=busy||!selection.size;};
   const prepare=button('Prepare selected documents',async()=>{sync();if(!selection.size||busy||!current())return;
    const context=epoch,member=client,worker=caregiver,editor=editorContext?.(),ids=[...selection],valid=()=>current()&&context===epoch;
    if(ids.length>20){status.textContent='Choose up to 20 documents per packet.';return;}
    busy=true;prepare.disabled=true;for(const c of checks)c.disabled=true;status.textContent='Checking the selected forms…';
    try{
     const key=JSON.stringify([member.memberId,worker?.id,worker?.name,ids]);
     if(!plan||plan.key!==key)plan={key,id:crypto.randomUUID(),rows:ids.map(template=>({template,id:crypto.randomUUID()}))};
     const attempt=plan;
     for(const row of attempt.rows){
      if(!row.form){const form=await workforceApi('/staff/admission-templates/'+row.template);if(!valid())return;if(form.office!==office)throw Error('The form belongs to a different office.');row.form=form;}
     }
     const needsWorker=attempt.rows.find(row=>row.form.requiredSigners.includes('caregiver'));
     if(needsWorker&&!worker){careArea.open=true;caregivers.input.focus();throw Error('Choose the caregiver for '+needsWorker.form.title+', or uncheck that form.');}
     packetId=null;queue=[];position=0;renderQueue();
     for(const [i,row] of attempt.rows.entries()){
      if(!valid())return;status.textContent='Preparing '+(i+1)+' of '+ids.length+' · '+row.form.title;
      const form=row.form;
      if(!row.record){
       const data={office,kind:'upload',clientName:member.name,memberId:member.memberId,caregiverName:worker?.name||'',visitDate:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),fields:{title:form.title},pages:form.pages,textFields:form.textFields,signatureFields:form.signatureFields,requiredSigners:form.requiredSigners,templateId:form.id};
       try{row.record=await workforceApi('/staff/field-visits/'+row.id,{revision:0,data});}
       catch(e){if(e.code!=='revision_conflict'||!valid())throw e;row.record=await workforceApi('/staff/field-visits/'+row.id);if(row.record.data?.templateId!==form.id||row.record.data?.memberId!==member.memberId||row.record.data?.office!==office)throw e;}
      }
      if(!valid())return;queue.push({id:row.id,title:form.title,record:row.record});
     }
     await workforceApi('/staff/admission-packets/'+attempt.id,{office,clientName:member.name,memberId:member.memberId,documentIds:queue.map(row=>row.id)});
     if(!valid())return;packetId=attempt.id;loadPackets();renderQueue();status.textContent=queue.length+' documents ready for review.';if(editor===editorContext?.())open(queue[0].record);
    }catch(e){if(valid()){renderQueue();status.textContent=e.message+(queue.length&&!packetId?' Retry preparation to finish this packet.':'');}}
    finally{busy=false;for(const c of checks)c.disabled=false;prepare.disabled=!selection.size;if(!valid()&&current())render();}
   });
   for(const row of templates){const label=node('label'),check=node('input');check.type='checkbox';check.value=row.id;check.checked=selection.has(row.id);check.onchange=sync;
    label.append(check,node('span',row.title),node('small',row.pageCount+' '+(row.pageCount===1?'page':'pages')));checks.push(check);selectionBox.append(label);}
   const toggle=standard=>{if(busy)return;checks.forEach((check,i)=>{check.checked=standard&&!/attendant information/i.test(templates[i].title);});sync();};
   content.append(button('Select admission packet',()=>toggle(true)),button('Clear selection',()=>toggle(false)),selectionBox,count,prepare);sync();
  }
  function render(){
   renderSaved();choices.hidden=!client;content.replaceChildren();renderQueue();if(!client)return;
   for(const [key,b]of typeButtons)b.setAttribute('aria-pressed',String(key===type));careArea.hidden=!['admissions','orientation'].includes(type);careArea.open=type==='orientation'||Boolean(caregivers.input.value);
   if(type==='admissions')admissionChoices();
   else content.append(button('Prepare '+(type==='orientation'?'supervisory visit':type==='assessment'?'assessment':'survey'),()=>{
    if(type==='orientation'&&!caregiver){careArea.open=true;caregivers.input.focus();status.textContent='Choose the caregiver for this supervisory visit.';return;}
    open(null,{kind:type,clientName:client.name,memberId:client.memberId,caregiverName:type==='orientation'?caregiver.name:'',...(type==='orientation'&&caregiver.id?{hhaCaregiverId:caregiver.id}:{}),requiredSigners:type==='orientation'?['member','caregiver','staff']:['member','staff'],pages:[],fields:{}});
   }));
  }
  shell.append(banner,clientArea,choices,packet,savedArea);target.append(shell);render();
  document.addEventListener('workforce-session-cleared',()=>{epoch++;clients.clear();caregivers.clear();client=caregiver=plan=packetId=null;queue=[];savedPackets=[];templates=null;selection.clear();shell.replaceChildren();},{once:true});
  return {contains:id=>queue.some(row=>row.id===id),reviewPacket(){renderQueue();packet.scrollIntoView({block:'start'});packet.tabIndex=-1;packet.focus();},libraryFailed(retry){if(current()){retryLibrary=retry;render();}},setTemplates(rows){if(current()){retryLibrary=null;templates=rows;render();}},selectClient:chooseClient,recordChanged(record){
   const row=queue.find(r=>r.id===record.id);if(!row)return;const completed=row.record.state!=='signed'&&record.state==='signed';row.record=record;
   if(plan){const prepared=plan.rows.find(r=>r.id===record.id);if(prepared)prepared.record=record;}
   renderQueue();if(completed){loadPackets();if(queue[position]?.id===record.id&&position+1<queue.length)Promise.resolve().then(()=>go(position+1));}
  },focus(){shell.scrollIntoView({block:'start'});}};
 }};
})();
