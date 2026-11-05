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
  const rolePanel = document.getElementById('job-description-step');
  let packet, record = null, answers = {}, sections = [], step = 0, generation = 0;
  let documentItems = [], addressEnabled = false, detachAddress = () => {};
  let version = 0, savedVersion = -1, saveQueue = Promise.resolve(), timer, documentsEnabled = false;
  let selectedFile = null, previewUrl = null, uploading = false;
  function requiredDocuments() {
    return ['identity', 'social_security'].filter(kind => !documentItems.some(d => d.kind === kind && ['pending_review', 'pending_security_review'].includes(d.state)));
  }
  function renderDocumentChecklist() {
    const list = document.getElementById('required-document-checklist'); list.replaceChildren();
    for (const [kind, label] of [['identity', 'Photo ID *'], ['social_security', 'Social Security card *']]) {
      const received = !requiredDocuments().includes(kind);
      list.append(text('li', label + (received ? ' — received, review pending' : ' — required')));
    }
  }
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null; selectedFile = null;
    const preview = document.getElementById('document-preview'); preview.removeAttribute('src'); preview.hidden = true;
    document.getElementById('document-file').value = ''; document.getElementById('document-camera').value = '';
  }
  async function download(path, filename) {
    const sequence = generation;
    try {
      const blob = await workforceApi(path, undefined, true);
      if (sequence !== generation) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { if (sequence === generation) documentMessage.textContent = error.message; }
  }
  async function loadDocuments() {
    const sequence = generation;
    if (!documentsEnabled) return;
    try {
      const data = await workforceApi('/application/documents');
      if (sequence !== generation) return;
      documentItems = data.items; renderDocumentChecklist();
      const list = document.getElementById('private-document-list'); list.replaceChildren();
      if (!data.items.length) list.append(text('p', 'Your private folder has no uploaded documents yet.'));
      for (const doc of data.items) {
        const card = document.createElement('article'); card.className = 'document-receipt';
        const names = { identity: 'Photo ID', social_security: 'Social Security card', employment_authorization: 'Employment-authorization document', i9: 'Form I-9', w4: 'Form W-4' };
        card.append(text('h3', names[doc.kind] || 'Private document'), text('p', doc.state === 'pending_security_review' ? 'PDF received · security review pending. The original PDF is private and is not opened here.' : doc.state === 'pending_review' ? 'Uploaded · awaiting HR review. This is not a verified eligibility result.' : 'Upload not confirmed · contact HR before retrying.'));
        if (doc.state === 'pending_review') {
          const button = text('button', 'Download my document'); button.type = 'button';
          button.onclick = () => download('/application/documents/' + encodeURIComponent(doc.id), doc.contentType === 'application/pdf' ? 'private-document.pdf' : 'private-document.jpg'); card.append(button);
        }
        list.append(card);
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
  function showError(error) { message.textContent = error.message; }
  function renderRoleDescription() {
    const target = document.getElementById('job-description-text'), source = packet.jobDescription; target.replaceChildren();
    target.append(text('h3', source.title), text('p', source.introduction));
    for (const [heading, items] of [['Qualifications', source.qualifications], ['Duties and responsibilities', source.duties], ['Physical/Mental/Essential Function of the Job', source.essentialFunctions]]) {
      target.append(text('h3', heading)); const list = document.createElement('ol');
      for (const item of items) list.append(text('li', item)); target.append(list);
    }
    target.append(text('h3', 'Acknowledgments in the paper packet'), text('blockquote', source.initialAcknowledgment),
      text('p', 'Employee signature/date and supervisor signature/date are separate.'), text('blockquote', source.discussionAcknowledgment),
      text('p', 'The revised/discussed acknowledgment and its employee/supervisor signatures are completed with HR when that discussion occurs.'));
    document.getElementById('job-description-read').checked = answers.jobDescriptionRead === 'Yes';
    document.getElementById('job-description-read').disabled = record?.state === 'submitted';
    document.getElementById('job-description-questions').value = answers.jobDescriptionQuestions || '';
    document.getElementById('job-description-questions').readOnly = record?.state === 'submitted';
  }
  function renderReview() {
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
  function render() {
    detachAddress();
    const submitted = record?.state === 'submitted';
    document.getElementById('application-status-badge').textContent = submitted ? 'Submitted for HR review' : 'Draft';
    const nav = document.getElementById('application-steps'); nav.replaceChildren();
    [...sections, 'Review & submit'].forEach((label, i) => {
      const button = text('button', (i + 1) + '. ' + label); button.type = 'button';
      if (step === i) button.setAttribute('aria-current', 'step');
      button.onclick = async () => { try { await save(); step = i; render(); } catch (error) { showError(error); } };
      nav.append(button);
    });
    fields.replaceChildren();
    const documentsStep = sections[step] === 'Documents', formsStep = sections[step] === 'Tax & employment forms', roleStep = sections[step] === 'PAS attendant role';
    form.hidden = submitted || step === sections.length || documentsStep || formsStep || roleStep;
    rolePanel.hidden = !roleStep;
    documentsPanel.hidden = !documentsStep;
    officialForms.hidden = !formsStep;
    document.getElementById('application-navigation').hidden = submitted;
    document.getElementById('application-next').hidden = step === sections.length;
    document.getElementById('application-back').disabled = step === 0;
    signaturePanel.hidden = submitted || step !== sections.length;
    if (submitted) {
      if (roleStep) renderRoleDescription();
      fields.append(text('p', 'Your application has been sent to HR. Employment, screening and onboarding approval are separate.'));
      message.textContent = 'Submitted ' + new Date(record.submittedAt).toLocaleString() + '. Contact HR if a correction is needed.';
      return;
    }
    if (step === sections.length) { renderReview(); return; }
    if (roleStep) { renderRoleDescription(); return; }
    if (documentsStep) { renderDocumentChecklist(); return; }
    if (formsStep) return;
    fields.append(text('h3', sections[step]));
    if (sections[step] === 'Availability & eligibility') fields.append(text('p', packet.convictionNotice));
    const grid = document.createElement('div'); grid.className = 'application-grid';
    for (const field of packet.fields.filter(f => f.section === sections[step])) {
      const label = document.createElement('label'); label.className = 'application-label';
      label.append(text('span', field.label + (field.required ? ' *' : '')));
      const input = document.createElement(field.type === 'textarea' ? 'textarea' : field.type === 'choice' ? 'select' : 'input');
      input.name = field.id; input.id = 'application-' + field.id;
      input.setAttribute('aria-required', String(field.required));
      if (field.type === 'choice') {
        const placeholder = text('option', 'Select an answer'); placeholder.value = ''; input.append(placeholder);
        for (const option of field.options) { const node = text('option', field.id === 'weeklyHours' ? option + ' hours' + (option === '40' ? ' — office review required' : '') : option); node.value = option; input.append(node); }
      } else {
        if (field.type !== 'textarea') input.type = field.type === 'ssn' ? 'password' : field.type;
        input.maxLength = field.maxLength;
        input.autocomplete = ['ssn', 'birthDate'].includes(field.id) ? 'off' : field.id === 'name' ? 'name' : field.id === 'email' ? 'email' : 'off';
        if (field.type === 'ssn') { input.inputMode = 'numeric'; input.placeholder = '123-45-6789'; }
        if (field.id.endsWith('_completed')) input.placeholder = 'MM/YYYY or YYYY';
        const addressAutocomplete = { street: 'address-line1', unit: 'address-line2', city: 'address-level2', state: 'address-level1', zip: 'postal-code' };
        if (addressAutocomplete[field.id]) input.autocomplete = addressAutocomplete[field.id];
      }
      input.value = answers[field.id] || '';
      input.addEventListener('input', () => {
        answers[field.id] = input.value; version++; message.textContent = 'Unsaved changes…';
        if (field.id === 'weeklyHours') updateHoursNotice();
        clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500);
      });
      label.append(input); grid.append(label);
    }
    fields.append(grid, text('p', '* Minimum submission fields. HR may request additional information. You can save an incomplete draft.'));
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
    if (notice) { notice.hidden = answers.weeklyHours !== '40'; notice.textContent = '40 hours selected — office review required. Primetime does not ordinarily schedule 40-hour weeks. This preference does not approve a schedule or overtime.'; }
  }
  document.addEventListener('workforce-session-cleared', () => {
    generation++; clearTimeout(timer); detachAddress(); clearImage(); packet = null; record = null; answers = {}; documentItems = [];
    fields.replaceChildren(); document.getElementById('application-review').replaceChildren();
    document.getElementById('private-document-list').replaceChildren();
    document.getElementById('application-signature-name').value = '';
    document.getElementById('release-read').checked = false; document.getElementById('electronic-consent').checked = false;
    panel.hidden = true; document.getElementById('portal-release-notice').hidden = false; documentsEnabled = false; saveQueue = Promise.resolve(); documentsPanel.hidden = true; officialForms.hidden = true; rolePanel.hidden = true;
  });
  document.addEventListener('workforce-caregiver-session', async event => {
    const sequence = ++generation; panel.hidden = false; document.getElementById('portal-release-notice').hidden = true; message.textContent = 'Loading your application…';
    documentsEnabled = event.detail.documentsEnabled === true; documentForm.hidden = !documentsEnabled;
    addressEnabled = event.detail.addressLookupEnabled === true;
    documentMessage.textContent = documentsEnabled ? 'Documents are private and are not emailed or published.' : 'ID and Social Security card collection is closed until security and retention controls are verified.';
    try {
      const [schemaResponse, saved] = await Promise.all([fetch('/caregiver/workforce-api/application/packet', { cache: 'no-store' }), workforceApi('/application')]);
      if (!schemaResponse.ok) throw Error('The application packet is unavailable.');
      const schema = await schemaResponse.json(); if (sequence !== generation) return;
      packet = schema.packet; record = saved.application; answers = { ...(record?.answers || {}) };
      if (record && record.packetVersion !== packet.version) throw Error('HR must review the application version before you continue.');
      version = 0; savedVersion = record ? 0 : -1; step = 0; sections = [...new Set(packet.fields.map(f => f.section)), 'Documents', 'Tax & employment forms'];
      const inventory = document.getElementById('packet-inventory'); inventory.replaceChildren();
      const stageLabels = { application: 'Application', hr: 'Office / HR completes this', onboarding: 'HR will guide you during onboarding', payroll: 'Secure payroll onboarding', employment: 'After employment begins' };
      for (const item of schema.inventory) inventory.append(text('li', item.title + ' — ' + stageLabels[item.stage]));
      const selected = WorkforceContract.selectedId(location.search);
      document.getElementById('selected-opportunity').textContent = selected ? 'Selected opportunity: ' + selected + '. HR reviews your application before any assignment. Interest submission will be handled separately.' : '';
      message.textContent = record ? 'Your saved application is ready.' : 'Read the PAS attendant role, then complete Contact information. Progress saves securely after you make changes.';
      render(); await loadDocuments();
    } catch (error) { if (sequence === generation) { showError(error); fields.replaceChildren(); form.hidden = true; signaturePanel.hidden = true; } }
  });
  document.getElementById('application-save').onclick = () => save().catch(showError);
  for (const [id, direction] of [['application-back', -1], ['application-next', 1]]) document.getElementById(id).onclick = async () => {
    try { await save(); step = Math.max(0, Math.min(sections.length, step + direction)); render(); } catch (error) { showError(error); }
  };
  form.addEventListener('submit', e => { e.preventDefault(); save().catch(showError); });
  document.getElementById('application-submit').onclick = async () => {
    const sequence = generation, button = document.getElementById('application-submit'); button.disabled = true;
    try {
      const missing = packet.fields.find(f => f.required && !answers[f.id]?.trim());
      if (missing) { step = sections.indexOf(missing.section); render(); document.getElementById(missing.id === 'jobDescriptionRead' ? 'job-description-read' : 'application-' + missing.id)?.focus(); throw Error('Complete ' + missing.label + ' before submitting.'); }
      await save();
      await loadDocuments();
      // The server checks required receipts and trusted HR exceptions together.
      // A local checklist must not override an approved alternative arrangement.
      const result = await workforceApi('/application/submit', { revision: record.revision, signature: {
        name: document.getElementById('application-signature-name').value,
        electronicConsent: document.getElementById('electronic-consent').checked, documentRead: document.getElementById('release-read').checked
      } });
      if (sequence === generation) { record = result.application; render(); }
    } catch (error) { if (sequence === generation) showError(error); }
    finally { button.disabled = false; }
  };
  function choose(file) {
    clearImage();
    if (!file) return;
    if ((!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) && !/\.(pdf|jpe?g|png)$/i.test(file.name)) || file.size > 8 * 1024 * 1024) { documentMessage.textContent = 'Choose a PDF, JPEG or PNG no larger than 8 MB.'; return; }
    selectedFile = file;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) { documentMessage.textContent = 'PDF selected. It will be received privately for security review when you select Upload securely.'; return; }
    previewUrl = URL.createObjectURL(file);
    const preview = document.getElementById('document-preview'); preview.src = previewUrl; preview.hidden = false;
    documentMessage.textContent = 'Check the image, then select Upload securely. It has not been uploaded yet.';
  }
  for (const id of ['document-file', 'document-camera']) document.getElementById(id).addEventListener('change', event => choose(event.target.files?.[0]));
  document.getElementById('document-clear').onclick = clearImage;
  documentForm.addEventListener('submit', async e => {
    e.preventDefault(); if (uploading || !documentsEnabled) return;
    if (!selectedFile) { documentMessage.textContent = 'Choose an image or take a photo first.'; return; }
    const sequence = generation; uploading = true; document.getElementById('document-upload').disabled = true;
    try {
      await save();
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(selectedFile); });
      if (sequence !== generation) return;
      await workforceApi('/application/documents', { kind: document.getElementById('private-document-kind').value, base64 });
      if (sequence === generation) { clearImage(); documentMessage.textContent = 'Received securely. Security/HR verification is still pending.'; await loadDocuments(); }
    } catch (error) { if (sequence === generation) documentMessage.textContent = error.message; }
    finally { uploading = false; document.getElementById('document-upload').disabled = false; }
  });
  for (const kind of ['i9', 'w4']) document.getElementById('return-' + kind).onclick = async () => {
    try { await save(); step = sections.indexOf('Documents'); render(); document.getElementById('private-document-kind').value = kind; } catch (error) { showError(error); }
  };
  document.getElementById('job-description-read').addEventListener('change', event => {
    answers.jobDescriptionRead = event.target.checked ? 'Yes' : ''; version++; clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500);
  });
  document.getElementById('job-description-questions').addEventListener('input', event => {
    answers.jobDescriptionQuestions = event.target.value; version++; clearTimeout(timer); timer = setTimeout(() => save().catch(showError), 1500);
  });
})();
