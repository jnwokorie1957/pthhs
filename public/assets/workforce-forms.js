(() => {
  let employer={}, applicationData={}, confirmations={read:false,consent:false},signatureUi=null,appearance={style:'cursive'};
  let version=0,saveQueue=Promise.resolve(),busy=false,renderNumber=0,renderTask=null,libraryPromise=null,schemaPromise=null;
  const fullName=()=>[applicationData.firstName,applicationData.lastName].filter(Boolean).join(' ');
  const scrollTop=()=>{panel.scrollIntoView?.({block:'start',behavior:'instant'});panel.querySelector('button')?.focus({preventScroll:true});};
  async function action(task){if(busy)return;busy=true;const sequence=generation;panel.setAttribute('aria-busy','true');status('Working…');try{await task();}catch(error){if(sequence===generation)status(error.message,true);}finally{if(sequence===generation&&document.getElementById('portal-form-status').textContent==='Working…')status('Ready. Your saved entries are up to date.');busy=false;panel.removeAttribute('aria-busy');}}
  function returnToApplication(){if(!schema||!pdf)return;const label={i9:'I-9',w4:'W-4',new_hire:'Texas New Hire information',cch:'DPS CCH acknowledgment'}[kind],signed=record?.state==='submitted';clear();window.WorkforceNavigation?.set('application',{section:'Tax & employment forms'},true);window.WorkforceReview?.formReturned(label,signed);}

  let generation = 0, pdf = null, loadingTask = null, schema, kind, record = null, fields = {}, pageNumber = 1, dirty = false, ready = Promise.resolve();
  const panel = document.getElementById('portal-form-editor');
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; if(tag==='button')node.className='btn-secondary'; return node; };
  const signingDate = signedAt => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(signedAt));
  const status = (value,error=false) => {document.getElementById('portal-form-status').textContent=value;const local=document.getElementById('official-form-feedback');if(local){local.textContent=value;local.classList.toggle('error',error);}};
  async function saveNavigation() { try { await save(); } catch(error) { if (!window.WorkforceReview?.freeNavigation()) throw error; status('Review preview: continuing without saving invalid entries. ' + error.message); } }
  function refreshCompleteness() {
    const target=document.getElementById('official-form-completion');if(!target||!schema||!window.WorkforceReview)return [];
    const issues=[],exempt=kind==='w4'&&fields[schema.fields[15].id]===true;
    const add=(label,controlId,page=1)=>issues.push({label,controlId,activate:async()=>{try{if(page!==pageNumber){await saveNavigation();pageNumber=page;await renderPage();}const input=document.getElementById(controlId);input?.scrollIntoView({block:'center',behavior:'smooth'});input?.focus({preventScroll:true});}catch(e){status(e.message);}}});
    if(record?.state!=='submitted'){
      for(const [i,field]of schema.fields.entries()){
        if(!field.required||field.type==='checkbox'||(exempt&&kind==='w4'&&i>=5&&i<=14))continue;
        if(kind==='w4'&&i===3){const match=String(fields[field.id]||'').match(/^(.*),\s*([A-Z]{2})\s*,?\s*(\d{5}(?:-\d{4})?)$/);for(const [j,label]of ['City or town','State','ZIP code'].entries())if(!match?.[j+1]?.trim())add(label,'official-city-'+j);}
        else if(!String(fields[field.id]??'').trim())add(field.label,'official-'+i,field.page);
      }
      const group=kind==='i9'?schema.fields.filter(f=>/^CB_[1-4]$/.test(f.id)):kind==='w4'&&!exempt?schema.fields.slice(5,8):[];
      if(group.length&&!group.some(f=>fields[f.id]===true)){add(kind==='i9'?'Citizenship or immigration status — choose one':'Filing status — choose one','official-'+schema.fields.indexOf(group[0]));issues[issues.length-1].controlIds=group.map(f=>'official-'+schema.fields.indexOf(f));}
      for(const [id,label]of [['official-signature-name',kind==='new_hire'?'Your confirmation name':kind==='cch'?'Applicant signature':'Employee signature'],['official-form-read','Review the complete form before submitting'],['official-electronic-consent','Confirm electronic signing before submitting']]){const control=document.getElementById(id);if(control&&(control.type==='checkbox'?!control.checked:!control.value.trim()))add(label,id,pageNumber);}
    }
    const requireField=(id,label)=>{if(!String(fields[id]||'').trim())add(label,'official-'+schema.fields.findIndex(f=>f.id===id),1);};
    if(kind==='i9'&&record?.state!=='submitted'){
      if(fields.CB_3===true)requireField('3 A lawful permanent resident Enter USCIS or ANumber','USCIS / A-number for lawful permanent resident');
      if(fields.CB_4===true){requireField('Exp Date mmddyyyy','Employment authorization expiry or N/A when permitted');const ids=['USCIS ANumber','Form I94 Admission Number','Foreign Passport Number and Country of IssuanceRow1'];if(ids.filter(id=>String(fields[id]||'').trim()).length!==1)add('Enter exactly one USCIS number, I-94 number, or foreign passport and country','official-'+schema.fields.findIndex(f=>f.id===ids[0]),1);}
    }
    if(record?.state!=='submitted'){
      const ssnId=kind==='i9'?'US Social Security Number':kind==='new_hire'?'employeeSSN':kind==='w4'?schema.fields[4].id:null;
      if(ssnId&&fields[ssnId]&&!/^\d{3}-?\d{2}-?\d{4}$/.test(String(fields[ssnId])))add('Social Security number — enter all nine digits','official-'+schema.fields.findIndex(f=>f.id===ssnId),1);
      if(kind==='w4'&&!exempt)for(const field of schema.fields.slice(9,12))if(String(fields[field.id]??'').trim()&&!/^\d{1,9}(?:\.\d{1,2})?$/.test(String(fields[field.id])))add(field.label+' — enter an amount such as 0 or 100.00','official-'+schema.fields.indexOf(field),1);
    }
    window.WorkforceReview.paintMissing(target,issues,'Complete these items before signing');
    return issues;
  }
  for(const event of ['input','change'])panel.addEventListener(event,refreshCompleteness);
  function clear(){window.WorkforceNavigation?.formClosed();generation++;renderNumber++;renderTask?.cancel();renderTask=null;loadingTask?.destroy().catch(()=>{});loadingTask=null;pdf=null;schema=null;employer={};applicationData={};fields={};record=null;dirty=false;signatureUi=null;appearance={style:'cursive'};confirmations={read:false,consent:false};version=0;panel.replaceChildren();}
  function save(submit=false){
    const sequence=generation;
    saveQueue=saveQueue.catch(()=>undefined).then(async()=>{
      if(sequence!==generation||!schema||!pdf||record?.state==='submitted'||(!dirty&&!submit))return;
      const currentVersion=version,snapshot={...fields};
      if(submit&&kind==='i9'&&employer.offerAccepted!==true)throw Error('I-9 signing opens after the office records your accepted job offer. Save this draft and continue your application.');
      const result=await workforceApi('/application/forms/'+kind,{revision:record?.revision||0,fields:snapshot,submit,...(submit?{signature:{name:fullName(),electronicConsent:kind==='cch'||confirmations.consent,formRead:kind==='cch'||confirmations.read,appearance:signatureUi?.get()||appearance}}:{})});
      if(sequence!==generation)return;record=result.form;dirty=version!==currentVersion;
      if(kind==='cch'&&record.signature)employer.signingDate=signingDate(record.signature.signedAt);
      status(record.state==='submitted'?'Signed and submitted to the office.':dirty?'Saved. Your latest changes still need saving.':'Form draft saved securely.');
    });return saveQueue;
  }
  async function renderPage() {
    const sequence = generation,renderId=++renderNumber;if(signatureUi)appearance=signatureUi.snapshot();signatureUi=null;renderTask?.cancel();panel.replaceChildren();
    const feedback=document.createElement('p');feedback.id='official-form-feedback';feedback.className='form-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');panel.append(feedback);
    const bar=text('div','');bar.className='form-return-bar';bar.append(text('strong','My application / '+({i9:'I-9',w4:'W-4',new_hire:'Texas new-hire information',cch:'DPS CCH acknowledgment'}[kind])));const exit=text('button','Save & return to application');exit.type='button';exit.onclick=()=>action(async()=>{await saveNavigation();returnToApplication();});bar.append(exit);panel.append(bar);

    const completion=document.createElement('section');completion.id='official-form-completion';completion.hidden=true;completion.setAttribute('aria-label','Missing required form fields');panel.append(completion);
    const page = await pdf.getPage(pageNumber); if (sequence !== generation||renderId!==renderNumber) return;
    const nav = document.createElement('div'); nav.className = 'workforce-actions';
    for (const [label, direction] of [['Previous form page', -1], ['Next form page', 1]]) {
      const button = text('button', label); button.type = 'button'; button.disabled = pageNumber + direction < 1 || pageNumber + direction > pdf.numPages;
      button.onclick=()=>action(async()=>{await saveNavigation();pageNumber+=direction;await renderPage();scrollTop();}); nav.append(button);
    }
    nav.append(text('span', 'Page ' + pageNumber + ' of ' + pdf.numPages)); panel.append(nav);
    const viewport = page.getViewport({scale: 1.5}), canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height; canvas.className = 'official-form-canvas';
    canvas.setAttribute('aria-label', 'Official ' + kind.toUpperCase() + ' page ' + pageNumber); canvas.setAttribute('role', 'img'); const scroll=document.createElement('div');scroll.className='pdf-scroll';const stage=document.createElement('div');stage.className='pdf-stage';stage.append(canvas);scroll.append(stage);const guide=text('button','Switch between form and larger guided fields');guide.type='button';guide.onclick=()=>stage.classList.toggle('guided-entry');panel.append(guide,scroll);
    renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});try{await renderTask.promise;}catch(e){if(e.name==='RenderingCancelledException')return;throw e;}if(sequence!==generation||renderId!==renderNumber)return;
    const content=await page.getTextContent();if(sequence!==generation)return;
    const transcript = document.createElement('details'); transcript.append(text('summary','Read this form page as text'));
    transcript.append(text('p',content.items.map(item=>item.str||'').join(' '))); panel.append(transcript);
    window.WorkforceFormFields.render({target:stage,schema,kind,pageNumber,fields,employer,fullName:record?.signature?.name||fullName(),readOnly:record?.state==='submitted',onChange:(id,value)=>{
      fields[id]=value;dirty=true;version++;confirmations={read:false,consent:false};status('Form has unsaved changes. Save your draft before leaving.');
      for(const key of ['official-form-read','official-electronic-consent']){const check=document.getElementById(key);if(check)check.checked=false;}
      const group=kind==='i9'?schema.fields.filter(f=>/^CB_[1-4]$/.test(f.id)):kind==='w4'?schema.fields.slice(5,8):[];
      if(value===true&&group.some(f=>f.id===id))for(const other of group.filter(f=>f.id!==id)){fields[other.id]=false;const control=document.getElementById('official-'+schema.fields.indexOf(other));if(control)control.checked=false;}
      if(kind==='w4'&&id===schema.fields[15].id){for(let i=5;i<=14;i++){const f=schema.fields[i],control=document.getElementById('official-'+i);if(value===true)delete fields[f.id];if(control){control.disabled=value===true;if(value===true){control.value='';control.checked=false;}control.setAttribute('aria-required',String(value!==true&&f.required));const star=control.parentElement.querySelector('.pdf-required');if(star)star.hidden=value===true;}}}
    }});
    panel.append(text('p',kind==='cch'?'Complete Section 1. The office fills in Sections 2 and 3.':kind==='new_hire'?'Complete the employee boxes on this report and send them to the office. Employer information is filled automatically. The office confirms the actual date of hire, pay and reporting; this portal does not file the report with Texas.':'Required entries are marked *. Choose one status. For W-4 Step 3, enter 0 where an amount does not apply; follow the official exemption instructions if claiming exemption.'));
    const actions=document.createElement('div');actions.className='workforce-actions';
    const saveButton=text('button','Save form draft');saveButton.type='button';saveButton.disabled=record?.state==='submitted';saveButton.onclick=()=>action(async()=>{saveButton.disabled=true;try{await save();}finally{saveButton.disabled=false;}});actions.append(saveButton);
    const download=text('button','Download my saved form');download.type='button';download.disabled=!record;download.onclick=async()=>{try {await save();const blob=await workforceApi('/application/forms/'+kind+'/pdf',undefined,true),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='private-'+kind+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status(e.message);}};actions.append(download);panel.append(actions);
    if(record?.state!=='submitted'){
      if(kind==='cch') panel.append(text('p','By selecting Acknowledge, sign & submit, you acknowledge Section 1 and sign this form electronically.'));
      else panel.append(text('h3',kind==='new_hire'?'Review & confirm employee information':'Review, sign & submit this form'),text('p',kind==='i9'?'Complete all employee Section 1 fields and review the official attestation. Sign only after accepting a job offer. The employer and preparer/translator sign their own sections.':kind==='new_hire'?'Review both pages and confirm your employee information for the office. The office completes employer hire/pay details and the actual Texas filing.':'Review all five pages, your withholding selections and the Step 5 declaration before signing. Your signature is the final entry. Employer fields are completed by the office.'));
      if(kind!=='cch')for(const [id,label]of [['official-form-read','I have reviewed the complete official form and its declaration.'],['official-electronic-consent','I choose to sign this form electronically and submit it to Primetime.']]){const row=document.createElement('label');row.className='application-check';const input=document.createElement('input');input.type='checkbox';input.id=id;input.checked=id==='official-form-read'?confirmations.read:confirmations.consent;input.onchange=()=>{confirmations[id==='official-form-read'?'read':'consent']=input.checked;};row.append(input,text('span',label));panel.append(row);}
      if(!document.getElementById('official-signature-name')){const signature=document.createElement('label');signature.className='application-label';signature.append(text('span','Signing as')); const name=document.createElement('input');name.id='official-signature-name';name.readOnly=true;name.maxLength=250;name.value=[applicationData.firstName,applicationData.lastName].filter(Boolean).join(' ');signature.append(name);panel.append(signature);}
      signatureUi=window.WorkforceSignature.mount(panel,{name:fullName(),appearance,onChange:()=>{confirmations={read:false,consent:false};for(const id of ['official-form-read','official-electronic-consent']){const c=document.getElementById(id);if(c)c.checked=false;}}});
      if(kind==='i9'&&employer.offerAccepted!==true){const notice=text('p','I-9 signing opens after the office records your accepted job offer. You can save this draft and finish your application now. Employer and translator sections are completed separately.');notice.className='notice';panel.append(notice);const later=text('button','Save draft & continue application');later.type='button';later.onclick=()=>action(async()=>{await saveNavigation();returnToApplication();});panel.append(later);}
      else {const submit=text('button',kind==='cch'?'Acknowledge, sign & submit':kind==='new_hire'?'Confirm & send employee information':'Sign & submit '+(kind==='i9'?'I-9 employee section':'W-4'));submit.type='button';submit.className='btn-primary';submit.onclick=()=>action(async()=>{const missing=refreshCompleteness();if(missing.length){await missing[0].activate();status('Complete '+missing[0].label+' before submitting.',true);return;}submit.disabled=true;try{await save(true);returnToApplication();}catch(e){status(e.message,true);}finally{submit.disabled=false;}});panel.append(submit);}

    }
    if(record?.state==='submitted'){window.WorkforceSignature.mount(panel,{name:record.signature.name,appearance:record.signature.appearance||{style:'cursive'},readOnly:true});const done=text('button','Continue application');done.type='button';done.onclick=()=>returnToApplication();panel.append(done);}
    refreshCompleteness();
  }
  window.WorkforceForms={clear,flush:async()=>{await ready;await save();},open:async (selected,application={})=>{
    await saveNavigation(); clear(); const sequence=generation; kind=selected;applicationData={...application};pageNumber=1;window.WorkforceNavigation?.form(selected);status('Loading the official form…');
    ready=(async()=>{try {
      const [library,response,saved]=await Promise.all([libraryPromise??=import('/assets/form-viewer/pdf.mjs'),schemaPromise??=fetch('/assets/forms/schema.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Form definitions unavailable');return r.json();}).catch(e=>{schemaPromise=null;throw e;}),workforceApi('/application/forms/'+kind)]);
      if(sequence!==generation)return;const schemas=response;schema=schemas[kind];record=saved.form;employer={...(saved.employer||{})};fields={...(record?.fields||{})};
      if(kind==='cch'&&record?.signature)employer.signingDate=signingDate(record.signature.signedAt);
      if(!record){
        if(kind==='w4')schema.fields.slice(0,5).forEach((f,i)=>fields[f.id]=[application.firstName,application.lastName,[application.street,application.unit].filter(Boolean).join(' '),[application.city,application.state,application.zip].filter(Boolean).join(', '),application.ssn][i]||'');
        else if(kind==='new_hire'){const dob=application.birthDate?.split('-');Object.assign(fields,{firstName:application.firstName||'',middleName:application.middleName||'',lastName:application.lastName||'',address:[application.street,application.unit].filter(Boolean).join(' '),city:application.city||'',state:application.state||'',zip:application.zip||'',employeeSSN:application.ssn||'',birthDate:dob?.length===3?[dob[1],dob[2],dob[0]].join('/'):' '});}
        else if(kind==='cch')fields['Applicant Name Print']=[application.firstName,application.lastName].filter(Boolean).join(' ');
        else {const dob=application.birthDate?.split('-');Object.assign(fields,{'First Name Given Name':application.firstName||'','Last Name (Family Name)':application.lastName||'','Address Street Number and Name':application.street||'','Apt Number (if any)':application.unit||'','City or Town':application.city||'',State:application.state||'','ZIP Code':application.zip||'','Date of Birth mmddyyyy':dob?.length===3?[dob[1],dob[2],dob[0]].join('/'):'','US Social Security Number':application.ssn||'','Employees E-mail Address':application.email||'','Telephone Number':application.phone||''});}
      }
      library.GlobalWorkerOptions.workerSrc='/assets/form-viewer/pdf.worker.mjs';const task=library.getDocument({url:'/assets/forms/'+schema.file,isEvalSupported:false,enableXfa:false});loadingTask=task;pdf=await task.promise;
      if(sequence!==generation){task.destroy();return;}dirty=!record;await renderPage();scrollTop();status(record?.state==='submitted'?'Signed form submitted to the office.':'Complete the form here. Your entries stay in this portal; save your draft before leaving.');
    }catch(e){status('The form could not be opened. '+e.message);const back=text('button','Back to application');back.type='button';back.onclick=()=>returnToApplication();panel.replaceChildren(back);}})();await ready;
  }};
})();
