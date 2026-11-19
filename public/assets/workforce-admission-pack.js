(()=>{
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function parse(text){
  const pack=JSON.parse(text);
  if(pack?.format!=='pthhs-admission-pack-v1'||!Array.isArray(pack.forms)||!pack.forms.length||pack.forms.length>20)throw Error('Choose a prepared admission pack with 1–20 forms.');
  let pages=0;const forms=pack.forms.map(row=>{
   if(typeof row?.title!=='string'||!row.title.trim()||row.title.length>160||!Array.isArray(row.pages)||!row.pages.length||row.pages.length>12||row.pages.some(p=>typeof p!=='string'||p.length>3_000_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(p))||!Array.isArray(row.requiredSigners)||!row.requiredSigners.includes('staff')||row.requiredSigners.some(role=>!['member','caregiver','staff'].includes(role))||!Array.isArray(row.signatureFields)||!Array.isArray(row.textFields))throw Error('A form in this pack is incomplete. Ask the office to prepare it again.');
   pages+=row.pages.length;return {title:row.title,pages:row.pages,requiredSigners:row.requiredSigners,signatureFields:row.signatureFields,textFields:row.textFields};
  });if(pages>60)throw Error('Choose a pack with no more than 60 pages.');return forms;
 }
 window.WorkforceAdmissionPack={parse,mount(target,{office,current,reload}){
  let rows=[],epoch=0,busy=false,refreshed=false;const section=node('details'),form=node('form'),list=node('div'),status=node('p');section.append(node('summary','Import prepared admission forms'));form.className='office-review-fields';status.setAttribute('role','status');
  const fileLabel=node('label','Prepared admission pack (.json)'),file=node('input');file.type='file';file.accept='application/json,.json';file.required=true;fileLabel.append(file);
  const checkLabel=node('label','I reviewed every page. These are blank forms with no previous client information.'),check=node('input');check.type='checkbox';check.required=true;checkLabel.prepend(check);
  const submit=node('button','Add reviewed forms');submit.type='submit';submit.className='manager-primary';submit.disabled=true;
  const saved=row=>['added','existing'].includes(row.outcome);
  const counts=()=>{const count=outcome=>rows.filter(row=>row.outcome===outcome).length,adding=count('adding');return count('added')+' added; '+count('existing')+' already present; '+count('failed')+' failed; '+count('ready')+' not attempted'+(adding?'; '+adding+' adding':'')+'.';};
  function controls(){const done=rows.length&&rows.every(saved);file.disabled=check.disabled=busy;submit.disabled=busy||!rows.length||Boolean(done&&refreshed);submit.textContent=done?'Refresh library':rows.some(row=>row.outcome!=='ready')?'Retry remaining forms':'Add reviewed forms';}
  file.onchange=async()=>{if(busy)return;const token=++epoch;rows=[];refreshed=false;check.checked=false;controls();list.replaceChildren();status.textContent='Reading admission pack…';try{const selected=file.files?.[0];if(!selected||selected.size>24_000_000)throw Error('Choose a prepared pack smaller than 24 MB.');const forms=parse(await selected.text());if(token!==epoch||!current())return;
   rows=forms.map(data=>({data,outcome:'ready'}));for(const row of rows){const item=node('details');item.append(node('summary',row.data.title+' · '+row.data.pages.length+' pages'));const fields=node('p',row.data.signatureFields.length+' signature locations · '+row.data.textFields.length+' information fields');item.append(fields);item.ontoggle=()=>{if(!item.open||item.childElementCount>2)return;for(const[index,encoded]of row.data.pages.entries()){const img=node('img');img.src='data:image/jpeg;base64,'+encoded;img.alt=row.data.title+', blank page '+(index+1);img.style.maxWidth='100%';img.loading='lazy';item.append(img);}};list.append(item);row.status=node('p','Ready to add');list.append(row.status);}status.textContent=rows.length+' forms ready. Expand each title to review every page before adding them.';controls();
  }catch(e){if(token===epoch&&current())status.textContent=e.message;}};
  form.onsubmit=async event=>{event.preventDefault();if(busy||!current()||!form.reportValidity()||!rows.length)return;const token=epoch,active=()=>token===epoch&&current();busy=true;controls();try{
   for(const row of rows){if(!active())return;if(saved(row))continue;row.outcome='adding';row.status.textContent='Adding securely…';status.textContent='Adding forms to this office’s library. '+counts();try{await workforceApi('/staff/admission-templates',{office,...row.data,blankTemplateConfirmed:true});if(!active())return;row.outcome='added';row.status.textContent='Added securely';}catch(e){if(!active())return;if(e.code==='admission_template_exists'){row.outcome='existing';row.status.textContent='Already in this office’s library';}else{row.outcome='failed';row.status.textContent=e.message;throw e;}}}
   status.textContent='Refreshing the admission library. '+counts();const result=await reload();if(!active())return;if(result===false)throw Error('The library could not be refreshed.');refreshed=true;status.textContent='Library refreshed. '+counts()+' Choose Use this form to prepare a client copy.';
  }catch(e){if(active())status.textContent=rows.every(saved)?'Library refresh failed: '+e.message+' Saved forms are kept. Refresh library to try again. '+counts():'Import stopped: '+e.message+' '+counts()+' Saved forms are kept. Retry remaining forms to continue.';}finally{busy=false;if(active())controls();}};
  form.append(fileLabel,list,checkLabel,submit,status);section.append(form);target.append(section);
  document.addEventListener('workforce-session-cleared',()=>{epoch++;rows=[];file.value='';list.replaceChildren();status.textContent='';submit.disabled=true;},{once:true});
 }};
})();
