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
  let rows=[],epoch=0,busy=false;const section=node('details'),form=node('form'),list=node('div'),status=node('p');section.append(node('summary','Import prepared admission forms'));form.className='office-review-fields';status.setAttribute('role','status');
  const fileLabel=node('label','Prepared admission pack (.json)'),file=node('input');file.type='file';file.accept='application/json,.json';file.required=true;fileLabel.append(file);
  const checkLabel=node('label','I reviewed every page. These are blank forms with no previous client information.'),check=node('input');check.type='checkbox';check.required=true;checkLabel.prepend(check);
  const submit=node('button','Add reviewed forms');submit.type='submit';submit.className='manager-primary';submit.disabled=true;
  file.onchange=async()=>{if(busy)return;const token=++epoch;rows=[];check.checked=false;submit.disabled=true;list.replaceChildren();status.textContent='Reading admission pack…';try{const selected=file.files?.[0];if(!selected||selected.size>24_000_000)throw Error('Choose a prepared pack smaller than 24 MB.');const forms=parse(await selected.text());if(token!==epoch||!current())return;
   rows=forms.map(data=>({data,saved:false}));for(const row of rows){const item=node('details');item.append(node('summary',row.data.title+' · '+row.data.pages.length+' pages'));const fields=node('p',row.data.signatureFields.length+' signature locations · '+row.data.textFields.length+' information fields');item.append(fields);item.ontoggle=()=>{if(!item.open||item.childElementCount>2)return;for(const[index,encoded]of row.data.pages.entries()){const img=node('img');img.src='data:image/jpeg;base64,'+encoded;img.alt=row.data.title+', blank page '+(index+1);img.style.maxWidth='100%';img.loading='lazy';item.append(img);}};list.append(item);row.status=node('p','Ready to add');list.append(row.status);}status.textContent=rows.length+' forms ready. Expand each title to review every page before adding them.';submit.disabled=false;
  }catch(e){if(token===epoch&&current())status.textContent=e.message;}};
  form.onsubmit=async event=>{event.preventDefault();if(busy||!current()||!form.reportValidity()||!rows.length)return;const token=epoch;busy=true;file.disabled=check.disabled=submit.disabled=true;try{
   for(const row of rows){if(token!==epoch||!current())return;if(row.saved)continue;row.status.textContent='Adding securely…';try{await workforceApi('/staff/admission-templates',{office,...row.data,blankTemplateConfirmed:true});if(token!==epoch||!current())return;row.saved=true;row.status.textContent='Added securely';}catch(e){if(token!==epoch||!current())return;if(e.code==='admission_template_exists'){row.saved=true;row.status.textContent='Already in this office’s library';}else{row.status.textContent=e.message;throw e;}}}
   await reload();if(current())status.textContent='All '+rows.length+' forms are in the admission library. Choose Use this form to prepare a client copy.';
  }catch(e){if(current())status.textContent='Import stopped: '+e.message+' Completed forms are kept. Retry to continue.';}finally{busy=false;if(current()){file.disabled=check.disabled=false;submit.disabled=rows.every(row=>row.saved);}}};
  form.append(fileLabel,list,checkLabel,submit,status);section.append(form);target.append(section);
  document.addEventListener('workforce-session-cleared',()=>{epoch++;rows=[];file.value='';list.replaceChildren();status.textContent='';submit.disabled=true;},{once:true});
 }};
})();
