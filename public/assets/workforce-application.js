(() => {
  const panel = document.getElementById('caregiver-summary');
  if (!panel) return;
  const fields = document.getElementById('application-fields');
  const message = document.getElementById('application-message');
  const form = document.getElementById('caregiver-application');
  const signaturePanel = document.getElementById('application-signature');
  const documentMessage = document.getElementById('document-message');
  const documentForm = document.getElementById('private-document-form');
  const documentsPanel = document.getElementById('private-documents'), officialForms = document.getElementById('official-forms');
  const rolePanel = document.getElementById('job-description-step'), policyPanel = document.getElementById('policy-reading-step');
  let packet, record = null, answers = {}, sections = [], step = 0, generation = 0;
  let documentItems = [], addressEnabled = false, detachAddress = () => {};
  let version = 0, savedVersion = -1, saveQueue = Promise.resolve(), timer, documentsEnabled = false;
  const uploadKinds = {identity: 'Photo ID', social_security: 'Social Security card', insurance_card: 'Health insurance card', direct_deposit: 'Direct deposit form'};
  let uploading = false, navigating = false;
  function scrollStep(){const top=panel.querySelector('.application-heading');top?.scrollIntoView({block:'start',behavior:'instant'});const heading=top?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  async function move(task){if(navigating)return;navigating=true;const seq=generation;panel.setAttribute('aria-busy','true');try{await task(seq);}catch(error){if(seq===generation)showError(error);}finally{navigating=false;panel.removeAttribute('aria-busy');}}
  let reviewNavigation = false;
  const completionSummary = document.createElement('section'), reviewNote = document.createElement('p'), marked = new WeakMap();
  completionSummary.id = 'application-completion-summary'; completionSummary.className = 'completion-summary';
  completionSummary.setAttribute('aria-label', 'Missing required application fields');
  reviewNote.className = 'review-navigation-note'; reviewNote.hidden = true;
  document.querySelector('.application-content').prepend(reviewNote, completionSummary);
  function paintMissing(target, issues, heading = 'Required fields still needed') {
    issues=issues.filter((issue,index)=>issues.findIndex(other=>other.controlId===issue.controlId)===index);
    for (const control of marked.get(target) || []) { control.classList.remove('required-missing'); control.removeAttribute('aria-invalid'); }
    const controls = new Set();
    for (const issue of issues) for (const id of issue.controlIds || [issue.controlId]) { const control = document.getElementById(id); if (control) { control.classList.add('required-missing'); control.setAttribute('aria-invalid','true'); controls.add(control); } }
    marked.set(target,controls); target.replaceChildren(); target.hidden = !issues.length;
    if(issues.length){const details=document.createElement('details');details.append(text('summary',heading+' ('+issues.length+')'));const list=document.createElement('ul');for(const issue of issues){const item=document.createElement('li'),button=text('button',issue.label);button.type='button';button.onclick=()=>issue.activate?issue.activate():focusMissing(issue.controlId);item.append(button);list.append(item);}details.append(list);target.append(details);}
  }
  window.WorkforceReview = { freeNavigation: () => reviewNavigation, paintMissing, flush: saveNavigation, formReturned: (label,signed) => {step=sections.indexOf("Tax & employment forms");render();message.textContent=label+(signed?" submitted. Continue your application below.":" saved. Continue your application below.");document.getElementById("portal-form-status").textContent=message.textContent;scrollStep();} };
  const fieldControl = source => {const id=source.replace('page_21','page_20');return id === 'jobDescriptionRead' ? 'job-description-read' : id === 'terms_page_17' ? 'application-terms_page_17' : 'application-' + id.replace('terms_page_', 'read_page_');};
  function focusMissing(id) {
    const control = document.getElementById(id);
    if (id === 'application-terms_page_17' && !control) {
      const title = document.querySelector('[aria-controls="policy-document-17"]');
      title?.scrollIntoView({block:'center',behavior:'smooth'}); title?.focus({preventScroll:true});
    } else if (control?.disabled || control?.closest('[hidden]')) {
      const title = control.closest('.packet-reading-card')?.querySelector('button');
      title?.scrollIntoView({block:'center',behavior:'smooth'}); title?.focus({preventScroll:true});
    } else { control?.scrollIntoView({block:'center',behavior:'smooth'}); control?.focus({preventScroll:true}); }
  }
  function refreshCompleteness() {
    if (!packet || record?.state === 'submitted') { completionSummary.hidden = true; return; }
    const missing = packet.fields.filter(f => f.required && !answers[f.id]?.trim() && (f.id === 'terms_page_17' || !f.id.startsWith('terms_page_') || answers[f.id.replace('terms_page_', 'read_page_')] === 'Read')).map(field => ({
      label: /read_page_(20|21)$/.test(field.id)?'Read the combined HHSC payment rates, approvals, claims & resources':field.label, section: field.section, controlId: fieldControl(field.id),
      activate: async () => { try { const next = sections.indexOf(field.section); if (next > step) validateStep(); await saveNavigation(); step = next; render(); focusMissing(fieldControl(field.id)); } catch(error) { showError(error); } }
    }));
    for (const kind of requiredDocuments()) missing.push({ label: kind === 'identity' ? 'Photo ID upload' : 'Social Security card upload', section: 'Documents', controlId: kind + '-choose', activate: async () => { try { const next = sections.indexOf('Documents'); if (next > step) validateStep(); await saveNavigation(); step = next; render(); document.getElementById(kind + '-choose').focus(); } catch(error) { showError(error); } } });
    if (step === sections.length) for (const [id,label] of [['release-read','Read the past-employment release'],['electronic-consent','Choose electronic signing'],['application-signature-name','Your electronic signature']]) {
      const control = document.getElementById(id); if (control.type === 'checkbox' ? !control.checked : !control.value.trim()) missing.push({label,section:'Review & submit',controlId:id});
    }
    const current = missing.filter(f => f.section === sections[step] || step === sections.length);
    paintMissing(completionSummary,current,'Missing required fields in this section');
  }
  async function saveNavigation() {
    try { if (sections[step] === 'Tax & employment forms') await window.WorkforceForms.flush(); await save(); }
    catch (error) { if (!reviewNavigation) throw error; message.textContent = 'Review preview: continuing without saving invalid entries. ' + error.message; }
  }
  for (const event of ['input','change']) panel.addEventListener(event, () => queueMicrotask(refreshCompleteness));
  function requiredDocuments() {
    return ['identity', 'social_security'].filter(kind => !documentItems.some(d => d.kind === kind && ['pending_review', 'pending_security_review'].includes(d.state)));
  }
  function renderDocumentChecklist() {
    queueMicrotask(refreshCompleteness);
    const list = document.getElementById('required-document-checklist'); list.replaceChildren();
    for (const [kind, label] of [['identity', 'Photo ID *'], ['social_security', 'Social Security card *']]) {
      const received = !requiredDocuments().includes(kind);
      list.append(text('li', label + (received ? ' — received, review pending' : ' — required')));
    }
  }
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  function clearImage(kind) {
    for (const key of kind ? [kind] : Object.keys(uploadKinds)) {

      for (const suffix of ['file']) document.getElementById(key + '-' + suffix).value = '';
      document.getElementById(key + '-selection').textContent = 'No file selected';

    }
  }
  async function loadDocuments() {
    const sequence = generation;
    if (!documentsEnabled) return;
    try {
      const data = await workforceApi('/application/documents');
      if (sequence !== generation) return;
      documentItems = data.items; renderDocumentChecklist();
      document.getElementById('private-document-list').replaceChildren();
      for (const kind of Object.keys(uploadKinds)) {
        const matches = data.items.filter(item => item.kind === kind).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        const doc = matches.find(item => ['pending_review', 'pending_security_review'].includes(item.state));
        const view = document.getElementById(kind + '-view'); view.hidden = !doc || doc.state !== 'pending_review';
        if (doc) document.getElementById(kind + '-selection').textContent = doc.state === 'pending_security_review' ? 'Uploaded — security review pending' : 'Uploaded';
        else if (matches[0]?.state === 'security_rejected') document.getElementById(kind + '-selection').textContent = 'This PDF did not pass security review. Upload a replacement.';
        view.onclick = async () => { try { const sequence = generation, blob = await workforceApi('/application/documents/' + encodeURIComponent(doc.id), undefined, true); if (sequence === generation) window.WorkforceCamera.view(blob, uploadKinds[kind]); } catch (error) { documentMessage.textContent = error.message; } };
      }
    } catch (error) { if (sequence === generation) documentMessage.textContent = error.message; }
  }
  function save() {
    const sequence = generation;
    saveQueue = saveQueue.catch(() => undefined).then(async () => {
      if (sequence !== generation || !packet || record?.state === 'submitted' || savedVersion === version) return;
      const currentVersion = version, snapshot = { ...answers };
      message.textContent = 'Saving securely…';
      const response = await workforceApi('/application', { revision: record?.revision ?? 0, answers: snapshot });
      if (sequence !== generation) return;
      record = response.application; savedVersion = currentVersion;
      message.textContent = 'Saved securely. You can return using the same account.';
      if (version !== currentVersion) { clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1200); }
    });
    return saveQueue;
  }
  function showError(error) { message.textContent = error.code==='minimum_age_required'?'You must be at least 18 years old to submit a caregiver application. Check your date of birth.':error.message; message.scrollIntoView?.({block:'nearest',behavior:'instant'}); }
  function validateAge(){if(!WorkforceContract.isAdult(answers.birthDate||'')){focusMissing('application-birthDate');throw Error('You must be at least 18 years old to submit a caregiver application. Check your date of birth. You can save a draft.');}}
  function validateStep() {
    if (reviewNavigation) return;
    if (sections[step] === 'Documents' && (uploading || requiredDocuments().length)) {
      focusMissing((requiredDocuments()[0] || 'identity') + '-choose');
      throw Error('Upload your Photo ID and Social Security card before continuing.');
    }
    if(sections[step]==='Contact information')validateAge();
    if(sections[step]==='Availability & eligibility'&&answers.conviction==='Yes'&&!answers.convictionDetails?.trim()){focusMissing('application-convictionDetails');throw Error('Complete the conviction explanation before continuing.');}
    const invalid=[...fields.querySelectorAll('input,select,textarea')].find(input=>!input.checkValidity());
    if(invalid){focusMissing(invalid.id);throw Error(invalid.validationMessage||'Check the highlighted field before continuing.');}
    const missing = packet.fields.find(f => f.section === sections[step] && f.required && !answers[f.id]?.trim());
    if (!missing) return;
    const id = fieldControl(missing.id);
    focusMissing(id);
    document.getElementById(id)?.setAttribute('aria-invalid', 'true');
    throw Error('Complete ' + missing.label + ' before continuing. You can still save this draft.');
  }
  function renderRoleDescription() {
    const target = document.getElementById('job-description-text'), source = packet.jobDescription; target.replaceChildren();
    target.append(text('h3', source.title), text('p', source.introduction));
    for (const [heading, items] of [['Qualifications', source.qualifications], ['Duties and responsibilities', source.duties], ['Physical/Mental/Essential Function of the Job', source.essentialFunctions]]) {
      target.append(text('h3', heading)); const list = document.createElement('ol');
      for (const item of items) list.append(text('li', item)); target.append(list);
    }
    target.append(text('h3', 'Acknowledgments in the paper packet'), text('blockquote', source.initialAcknowledgment),
      text('p', 'Employee signature/date and supervisor signature/date are separate.'), text('blockquote', source.discussionAcknowledgment),
      text('p', 'The revised/discussed acknowledgment and its employee/supervisor signatures are completed with the office when that discussion occurs.'));
    document.getElementById('job-description-read').checked = answers.jobDescriptionRead === 'Yes';
    document.getElementById('job-description-read').disabled = record?.state === 'submitted';
    document.getElementById('job-description-questions').value = answers.jobDescriptionQuestions || '';
    document.getElementById('job-description-questions').readOnly = record?.state === 'submitted';
  }
  function renderReview() {
    const signature=document.getElementById('application-signature-name');signature.value=[answers.firstName,answers.lastName].filter(Boolean).join(' ');signature.readOnly=true;signature.style.fontFamily='PortalSignature, cursive';
    document.getElementById('packet-notice').textContent = packet.notice;
    document.getElementById('reference-release-text').textContent = packet.referenceRelease.text;
    const review = document.getElementById('application-review'); review.replaceChildren();
    for (const section of sections) {
      const details = document.createElement('details'); details.append(text('summary', section));
      const dl = document.createElement('dl');
      for (const field of packet.fields.filter(f => f.section === section)) {
        const answer = answers[field.id] || '';
        dl.append(text('dt', field.label), text('dd', ['ssn', 'birthDate'].includes(field.id) ? (answer ? 'Provided securely' : 'Not entered') : answer || 'Not entered'));
      }
      details.append(dl); review.append(details);
    }
  }
  function render(pushHistory=false) {
    queueMicrotask(refreshCompleteness); if(pushHistory)queueMicrotask(scrollStep);
    detachAddress(); window.WorkforceCamera.clear(); window.WorkforceReadings.clear();
    const submitted = record?.state === 'submitted';
    document.getElementById('application-status-badge').textContent = submitted ? 'Submitted for review' : 'Draft';
    const nav = document.getElementById('application-steps'); nav.replaceChildren();
    const groupFor = label => label.includes('role') ? '1 · Role & requirements' : ['Contact information','Emergency contact'].includes(label) ? '2 · About you' : label.includes('Availability') ? '3 · Availability & qualifications' : ['Education','Work experience','References'].includes(label) ? '4 · Experience & references' : label==='Review & submit' ? '6 · Review & submit' : '5 · Acknowledgments & documents';
    let previousGroup='';
    const currentLabel=sections[step]||'Review & submit';
    document.getElementById('application-progress').textContent=groupFor(currentLabel)+' — '+currentLabel+' ▾';
    window.WorkforceNavigation?.step(currentLabel,pushHistory);
    [...sections, 'Review & submit'].forEach((label, i) => {
      const group=groupFor(label);if(group!==previousGroup){nav.append(text('div',group));nav.lastChild.className='application-group';previousGroup=group;}
      const button = text('button', label); button.type = 'button';
      const required=packet.fields.filter(f=>f.section===label&&f.required);
      const state=text('span',submitted?'Submitted':i===step?'In progress':label==='Documents'?(requiredDocuments().length?'Uploads needed':'Received'):label==='Tax & employment forms'?'Open forms':label==='Review & submit'?'Review when ready':!required.length?'Optional':required.every(f=>answers[f.id]?.trim())?'Complete':'Not complete');state.className='application-step-state';button.dataset.section=label;button.append(state);
      if (step === i) button.setAttribute('aria-current', 'step');
      button.onclick = () => move(async seq => { if (i > step) validateStep(); await saveNavigation(); if(seq!==generation)return;window.WorkforceForms.clear();step = i; render(true); nav.classList.remove('is-expanded');document.getElementById('application-progress').setAttribute('aria-expanded','false'); });
      nav.append(button);
    });
    fields.replaceChildren();
    const documentsStep = sections[step] === 'Documents', formsStep = sections[step] === 'Tax & employment forms', roleStep = sections[step] === 'PAS attendant role', policyStep = sections[step] === 'Policies & acknowledgments';
    form.hidden = submitted || step === sections.length || documentsStep || formsStep || roleStep || policyStep;
    rolePanel.hidden = !roleStep; policyPanel.hidden = !policyStep;
    if (policyStep) window.WorkforceReadings.render(policyPanel, packet.readings, answers, (id, value) => { answers[id] = value; version++; queueMicrotask(refreshCompleteness); clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500); }, submitted);
    documentsPanel.hidden = !documentsStep;
    officialForms.hidden = !formsStep;
    document.getElementById('application-navigation').hidden = submitted;
    document.getElementById('application-next').hidden = step === sections.length;
    document.getElementById('application-back').disabled = step === 0;
    signaturePanel.hidden = submitted || step !== sections.length;
    if (submitted) {
      if (roleStep) renderRoleDescription();
      fields.append(text('p', 'Your application has been sent to the office. Employment, screening and onboarding approval are separate.'));
      message.textContent = 'Submitted ' + new Date(record.submittedAt).toLocaleString() + '. Contact the office if a correction is needed.';
      return;
    }
    if (step === sections.length) { renderReview(); return; }
    if (roleStep) { renderRoleDescription(); return; }
    if (documentsStep) { renderDocumentChecklist(); return; }
    if (formsStep || policyStep) return;
    fields.append(text('h3', sections[step]));
    if (sections[step] === 'Availability & eligibility') fields.append(text('p', packet.convictionNotice));
    const grid = document.createElement('div'); grid.className = 'application-grid';
    for (const field of packet.fields.filter(f => f.section === sections[step])) {
      const label = document.createElement('label'); label.className = 'application-label';
      label.append(text('span', field.label + (field.required ? ' *' : '')));
      const input = document.createElement(field.type === 'textarea' ? 'textarea' : field.type === 'choice' ? 'select' : 'input');
      input.name = field.id; input.id = 'application-' + field.id.replace('terms_page_', 'read_page_');
      input.setAttribute('aria-required', String(field.required));input.required=Boolean(field.required);if(field.id==='birthDate'){input.max=WorkforceContract.adultCutoff();label.append(text('small','Applicants must be at least 18 years old.'));}
      if (field.type === 'choice') {
        const placeholder = text('option', 'Select an answer'); placeholder.value = ''; input.append(placeholder);
        for (const option of field.options) { const node = text('option', field.id === 'weeklyHours' ? option + ' hours' : option); node.value = option; input.append(node); }
      } else {
        if (field.type !== 'textarea') input.type = field.type === 'ssn' ? 'password' : field.type;
        input.maxLength = field.maxLength;
        input.autocomplete = ['ssn', 'birthDate'].includes(field.id) ? 'off' : field.id === 'firstName' ? 'given-name' : field.id === 'lastName' ? 'family-name' : field.id === 'email' ? 'email' : 'off';
        if (field.type === 'ssn') { input.inputMode = 'numeric'; input.placeholder = '123-45-6789'; }
        if (field.id.endsWith('_completed')) input.placeholder = 'MM/YYYY or YYYY';
        const addressAutocomplete = { street: 'address-line1', unit: 'address-line2', city: 'address-level2', state: 'address-level1', zip: 'postal-code' };
        if (addressAutocomplete[field.id]) input.autocomplete = addressAutocomplete[field.id];
      }
      input.value = answers[field.id] || '';
      if (field.type === 'tel') { input.value = WorkforceContract.formatPhone(input.value); input.inputMode = 'tel'; input.placeholder = '(713) 555-1234'; }
      if (field.type === 'ssn') {
        const mask = () => { const digits = (answers[field.id] || '').replace(/\D/g, ''); input.type = digits.length === 9 ? 'text' : 'password'; input.value = digits.length === 9 ? '***-**-' + digits.slice(-4) : answers[field.id] || ''; };
        input.addEventListener('focus', () => { input.type = 'password'; input.value = answers[field.id] || ''; input.select(); });
        input.addEventListener('blur', mask); mask();
        label.append(text('small', 'Only the last four digits remain visible after you leave this field.'));
      }
      input.addEventListener('input', () => {
        if (field.type === 'tel') WorkforceContract.formatPhoneInput(input);
        answers[field.id] = input.value; version++; message.textContent = 'Unsaved changes…';
        if (field.id === 'weeklyHours') updateHoursNotice();
        clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500);
      });
      label.append(input); grid.append(label);
    }
    fields.append(grid, text('p', '* Minimum submission fields. The office may request additional information. You can save an incomplete draft.'));
    const street = document.getElementById('application-street');
    if (street) detachAddress = window.WorkforceAddress.attach(street, address => {
      for (const key of ['street', 'city', 'state', 'zip']) { answers[key] = address[key]; const control = document.getElementById('application-' + key); if (control) control.value = address[key]; }
      version++; clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500);
    }, addressEnabled);
    if (sections[step] === 'Availability & eligibility') { const notice = text('p', ''); notice.id = 'hours-office-notice'; notice.className = 'hours-review-notice'; notice.setAttribute('role', 'status'); fields.append(notice); updateHoursNotice(); }
    document.getElementById('application-back').disabled = step === 0;
  }
  function updateHoursNotice() {
    const notice = document.getElementById('hours-office-notice');
    if (notice) { notice.hidden = answers.weeklyHours !== '40'; notice.textContent = '40 hours selected — office review required. Primetime schedules up to 40 hours per week and does not schedule overtime. Record all hours worked and contact the office if your hours may exceed 40.'; }
  }
  document.addEventListener('workforce-session-cleared', () => {
    reviewNavigation = false; reviewNote.hidden = true; completionSummary.hidden = true;
    generation++; clearTimeout(timer); detachAddress(); window.WorkforceReadings.clear(); window.WorkforceForms.clear(); policyPanel.hidden = true; clearImage(); packet = null; record = null; answers = {}; documentItems = [];
    fields.replaceChildren(); document.getElementById('application-review').replaceChildren();
    document.getElementById('private-document-list').replaceChildren();
    document.getElementById('application-signature-name').value = '';
    document.getElementById('release-read').checked = false; document.getElementById('electronic-consent').checked = false;
    panel.hidden = true; document.getElementById('portal-release-notice').hidden = true; documentsEnabled = false; saveQueue = Promise.resolve(); documentsPanel.hidden = true; officialForms.hidden = true; rolePanel.hidden = true;
  });
  document.addEventListener('workforce-caregiver-session', async event => {
    reviewNavigation = WorkforceContract.reviewNavigationAllowed(location.hostname,event.detail.previewNavigation);
    reviewNote.hidden = !reviewNavigation; reviewNote.textContent = 'Review preview: browse every section freely. Missing fields are highlighted; live applicants must complete required information.';
    const sequence = ++generation; panel.hidden = false; document.getElementById('portal-release-notice').hidden = true; message.textContent = 'Loading your application…';
    documentsEnabled = event.detail.documentsEnabled === true; documentForm.hidden = !documentsEnabled;
    addressEnabled = event.detail.addressLookupEnabled === true;
    documentMessage.textContent = documentsEnabled ? 'Uploads are stored encrypted. After submission and security review, completed documents are sent to the authorized office recipient.' : 'ID and Social Security card collection is closed until security and retention controls are verified.';
    try {
      const [schemaResponse, saved] = await Promise.all([fetch('/caregiver/workforce-api/application/packet', { cache: 'no-store' }), workforceApi('/application')]);
      if (!schemaResponse.ok) throw Error('The application packet is unavailable.');
      const schema = await schemaResponse.json(); if (sequence !== generation) return;
      packet = schema.packet; record = saved.application; answers = { ...(record?.answers || {}) };
      if (!record && !answers.applicationDate) {
        const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        const value = type => parts.find(p=>p.type===type).value; answers.applicationDate = value('year') + '-' + value('month') + '-' + value('day');
      }
      if (record && record.packetVersion !== packet.version) throw Error('The office must review the application version before you continue.');
      version = 0; savedVersion = record ? 0 : -1; step = 0; sections = [...new Set(packet.fields.map(f => f.section)), 'Documents', 'Tax & employment forms'];
      const inventory = document.getElementById('packet-inventory'); inventory.replaceChildren();
      const stageLabels = { application: 'Application', hr: 'The office completes this', onboarding: 'The office will guide you during onboarding', payroll: 'Secure payroll onboarding', employment: 'After employment begins' };
      for (const item of schema.inventory) inventory.append(text('li', item.title + ' — ' + stageLabels[item.stage]));
      const selected = WorkforceContract.selectedId(location.search);
      document.getElementById('selected-opportunity').textContent = event.detail.selectedOpportunity ? 'Applying for personal care attendant · ' + event.detail.selectedOpportunity.location + ' · ' + event.detail.selectedOpportunity.weeklyHours + ' hours/week. Your interest is recorded; complete your application below.' : selected ? 'Selected position reference: ' + selected : '';
      message.textContent = record ? 'Your saved application is ready.' : 'Read the PAS attendant role, then complete Contact information. Progress saves securely after you make changes.';
      const desired=event.detail.navigation?.section||window.WorkforceNavigation?.resume();if(desired==='Review & submit')step=sections.length;else if(sections.includes(desired))step=sections.indexOf(desired);
      render(); await loadDocuments();
      if(['i9','w4','new_hire','cch'].includes(event.detail.navigation?.form))await window.WorkforceForms.open(event.detail.navigation.form,{...answers});
    } catch (error) { if (sequence === generation) { showError(error); fields.replaceChildren(); form.hidden = true; signaturePanel.hidden = true; } }
  });
  document.getElementById('application-progress').onclick=()=>{const nav=document.getElementById('application-steps');const open=nav.classList.toggle('is-expanded');document.getElementById('application-progress').setAttribute('aria-expanded',String(open));};
  document.getElementById('application-save').onclick = async () => {try{await saveNavigation();await window.WorkforceNavigation.navigate('home');}catch(error){showError(error);}};
  for (const [id, direction] of [['application-back', -1], ['application-next', 1]]) document.getElementById(id).onclick = async () => {
    await move(async seq=>{if(direction>0)validateStep();await saveNavigation();if(seq!==generation)return;window.WorkforceForms.clear();step=Math.max(0,Math.min(sections.length,step+direction));render(true);});
  };
  form.addEventListener('submit', e => { e.preventDefault(); save().catch(showError); });
  document.getElementById('application-submit').onclick = async () => {
    const sequence = generation, button = document.getElementById('application-submit'); if(button.disabled)return;button.disabled = true;
    try {
      const missing = packet.fields.find(f => f.required && !answers[f.id]?.trim());
      if (missing) { step = sections.indexOf(missing.section); render(); focusMissing(fieldControl(missing.id)); throw Error('Complete ' + missing.label + ' before submitting.'); }
      validateAge();await save();
      await loadDocuments();
      // The server checks required receipts and trusted office exceptions together.
      // A local checklist must not override an approved alternative arrangement.
      const result = await workforceApi('/application/submit', { revision: record.revision, signature: {
        name: document.getElementById('application-signature-name').value,
        electronicConsent: document.getElementById('electronic-consent').checked, documentRead: document.getElementById('release-read').checked
      } });
      if (sequence === generation) { record = result.application; render();scrollStep(); }
    } catch (error) {
      if (sequence === generation) {
        if (error.code === 'cch_signature_required') {
          step = sections.indexOf('Tax & employment forms');
          render();
          document.getElementById('complete-cch').focus();
        }
        showError(error);
      }
    } finally { button.disabled = false; }
  };
  async function choose(kind, file) {
    if (uploading || !documentsEnabled || !file) return;
    const status = document.getElementById(kind + '-selection');
    if ((!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) && !/\.(pdf|jpe?g|png)$/i.test(file.name)) || file.size > 8 * 1024 * 1024) { status.textContent = 'Choose a PDF, JPEG or PNG no larger than 8 MB.'; return; }
    const sequence = generation; uploading = true; status.textContent = 'Uploading…';
    for (const button of documentForm.querySelectorAll('button')) button.disabled = true;
    try {
      await save();
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      if (sequence !== generation) return;
      await workforceApi('/application/documents', { kind, base64 });
      if (sequence === generation) { clearImage(kind); status.textContent = 'Uploaded'; await loadDocuments(); }
    } catch (error) { if (sequence === generation) status.textContent = 'Upload failed. Choose the file or take the photo again. ' + error.message; }
    finally { uploading = false; for (const button of documentForm.querySelectorAll('button')) button.disabled = false; }
  }
  for (const kind of Object.keys(uploadKinds)) {
    document.getElementById(kind + '-choose').onclick = () => document.getElementById(kind + '-file').click();
    document.getElementById(kind + '-file').addEventListener('change', event => { const file = event.target.files?.[0]; event.target.value = ''; choose(kind, file); });
    document.getElementById(kind + '-take-photo').onclick = async () => {
      const sequence = generation, file = await window.WorkforceCamera.capture('Photograph your ' + uploadKinds[kind]);
      if (sequence === generation && sections[step] === 'Documents') await choose(kind, file);
    };
    document.getElementById(kind + '-upload-form').addEventListener('submit', event => event.preventDefault());
  }
  for (const kind of ['i9', 'w4', 'new_hire', 'cch']) document.getElementById('complete-' + kind).onclick = async () => { try { await saveNavigation(); await window.WorkforceForms.open(kind, {...answers}); } catch (error) { showError(error); } };
  document.getElementById('job-description-read').addEventListener('change', event => {
    answers.jobDescriptionRead = event.target.checked ? 'Yes' : ''; version++; clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500);
  });
  document.getElementById('job-description-questions').addEventListener('input', event => {
    answers.jobDescriptionQuestions = event.target.value; version++; clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500);
  });
})();
