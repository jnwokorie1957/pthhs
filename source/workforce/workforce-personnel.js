(() => {
  const el = id => document.getElementById(id), panel = el('personnel-workspace');
  if (!panel) return;
  const status = el('personnel-message'), list = el('personnel-list'), detail = el('personnel-detail');
  const support = el('caregiver-account-support'), accountDetail = el('caregiver-account-detail'), results = el('caregiver-account-results'), accountMessage = el('caregiver-account-message');
  let generation = 0, applicationSelection = 0, accountSelection = 0, applicationRead = 0, applicationData = null, actor, packetPromise, searchTimer;
  const urls = new Set(), previews = new Set();
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const can = permission => actor?.grant.permissions.includes(permission);
  const date = value => { if (!value) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { const [year,month,day] = value.split('-'); return month + '/' + day + '/' + year; } const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-US', {timeZone:'America/Chicago', dateStyle:'medium', timeStyle:'short'}); };
  const human = value => String(value || '').replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
  const name = answers => [answers.firstName, answers.lastName].filter(Boolean).join(' ') || 'Caregiver profile';
  function release() { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); for (const preview of previews) { try { preview.close(); } catch {} } previews.clear(); }
  function section(target, title) { const block = node('section', undefined, 'caregiver-profile-section'); block.append(node('h3', title)); target.append(block); return block; }
  function fields(target, values) { const dl = node('dl', undefined, 'caregiver-profile-fields'); for (const [label, value] of values) { const group = node('div'); group.append(node('dt', label), node('dd', value || 'Not entered')); dl.append(group); } target.append(dl); }
  function pdfButton(target, title, path, current, message) {
    const button = node('button', title, 'btn-secondary'); button.type = 'button';
    button.onclick = async () => {
      const preview = window.open('about:blank', '_blank'); if (preview) { preview.opener = null; previews.add(preview); }
      button.disabled = true;
      try {
        const blob = await workforceApi(path, undefined, true);
        if (!current()) { preview?.close(); return; }
        const url = URL.createObjectURL(blob); urls.add(url);
        if (preview && !preview.closed) preview.location.replace(url);
        else { const link = node('a', 'Open PDF to view or print', 'caregiver-print-link'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; target.append(link); }
        message.textContent = '';
      } catch (error) { preview?.close(); if (current()) message.textContent = error.message; }
      finally { if (current()) button.disabled = false; }
    }; target.append(button);
  }
  async function applicationProfile(uid, target, current, message, showName = true) {
    const response = await workforceApi('/staff/applications/' + encodeURIComponent(uid));
    if (!current()) return;
    const application = response.application, a = application.answers;
    if (showName) { const head = node('div', undefined, 'caregiver-profile-heading'); head.append(node('h2', name(a)), node('span', human(application.state), 'manager-status manager-status-' + application.state)); target.append(head); }
    const contact = section(target, 'Contact information');
    fields(contact, [['Email', a.email], ['Phone number', a.phone], ['Alternate phone', a.alternatePhone], ['Street address', [a.street, a.unit].filter(Boolean).join(', ')], ['City / state / ZIP', [a.city, a.state, a.zip].filter(Boolean).join(', ')]]);
    fields(section(target, 'Emergency contact'), [['Name', a.emergencyName], ['Relationship', a.emergencyRelationship], ['Phone number', a.emergencyPhone]]);
    fields(section(target, 'Availability'), [['Preferred start date', date(a.availableDate)], ['Full time / part time', a.workTime], ['Preferred weekly hours', a.weeklyHours]]);
    const applicationArea = section(target, 'Employment application');
    if(response.hhaTransfer){
      const transfer=response.hhaTransfer,area=section(target,'HHA application transfer');
      const labels={queued:'Queued for automatic transfer',preparing:'Preparing application PDF',creating:'Checking applicant creation',created:'Applicant created — attaching application',attaching:'Checking PDF attachment',acknowledged:'Verifying the attached PDF',verified:'Application attached and verified',preview_only:'Practice application — not sent to HHA',review_required:'Office follow-up required',awaiting_connection:'Earlier submission — office review required'};
      const future=transfer.state==='queued'&&Date.parse(transfer.notBefore)>Date.now();
      fields(area,[['Status',future?'Scheduled for the January 1 launch':labels[transfer.state]||'Status unavailable'],['Created as','Applicant'],['HHA Applicant ID',transfer.caregiverId||'Not created'],['HHA application document ID',transfer.documentId||'Not attached'],['Verified',transfer.verifiedAt?date(transfer.verifiedAt):'Pending']]);
      if(transfer.state==='review_required'){
        const reasons={hha_required_applicant_fields_missing:'Required HHA profile information is missing.',applicant_phone_review_required:'A phone number needs correction.',existing_caregiver_review_required:'A matching caregiver may already exist in HHA. Check the existing profile.',portal_identity_changed:'The verified account email or account status changed.',applicant_creation_needs_reconciliation:'HHA has not confirmed the earlier profile request. Check HHA before taking another action.',application_attachment_needs_reconciliation:'The earlier PDF upload has not been confirmed. Check the applicant’s HHA documents.',application_pdf_readback_mismatch:'The attached PDF did not pass verification.',application_document_target_unverified:'The PDF attachment could not be verified on the expected applicant record.',applicant_identity_unverified:'The returned HHA profile does not match this application.'};
        area.append(node('p',reasons[transfer.reason]||'The transfer stopped for office review. It will not create or upload another copy automatically.'));
        if(can('documents.review')){const button=node('button','Recheck HHA transfer','btn-secondary');button.type='button';area.append(button);
          button.onclick=async()=>{button.disabled=true;try{await workforceApi('/staff/applications/'+encodeURIComponent(uid)+'/hha-transfer/recheck',{});if(current())message.textContent='Recheck queued. Reopen the profile after the next transfer check.';}catch(error){if(current())message.textContent=error.message;}finally{if(current())button.disabled=false;}};
        }
      }
    }
    fields(applicationArea, [['Status', human(application.state)], ['Last updated', date(application.updatedAt)], ['Signed by', application.signature?.name || 'Not signed']]);
    if (can('documents.review')) {
      const actions=node('div',undefined,'caregiver-print-actions');applicationArea.append(actions);
      pdfButton(actions, 'Print complete packet', '/staff/applications/' + encodeURIComponent(uid) + '/packet/pdf', current, message);
      pdfButton(actions, 'View / print application', '/staff/applications/' + encodeURIComponent(uid) + '/pdf', current, message);
    }
    const disclosure = node('details', undefined, 'caregiver-application-details'); disclosure.append(node('summary', 'Read application responses')); applicationArea.append(disclosure);
    try {
      packetPromise ||= workforceApi('/application/packet'); const metadata = await packetPromise;
      if (!current()) return;
      const grouped = new Map();
      for (const field of metadata.packet.fields) { if (!grouped.has(field.section)) grouped.set(field.section, []); const value = a[field.id]; grouped.get(field.section).push([field.label, field.id === 'ssn' ? (value ? '***-**-' + value.replace(/\D/g, '').slice(-4) : '') : field.id === 'birthDate' ? (value ? 'Supplied in private application' : '') : value]); }
      for (const [title, values] of grouped) fields(section(disclosure, title), values);
    } catch (error) { packetPromise = null; if (current()) disclosure.append(node('p', 'Could not load responses. Reopen the profile.')); }
    if (!current()) return;
    if (!can('documents.review')) { target.append(node('p', 'Private document access required.')); return; }
    const formsArea = section(target, 'Employment forms'), documentsArea = section(target, 'Private documents');
    const base = '/staff/applications/' + encodeURIComponent(uid);
    await Promise.allSettled([...(Object.entries({i9:'Form I-9',w4:'Form W-4',new_hire:'Texas New Hire Report',cch:'DPS CCH Verification Form'}).map(async ([kind, title]) => {
      const row = node('div', undefined, 'caregiver-file-row'); row.append(node('h4', title)); formsArea.append(row);
      try { const result = await workforceApi(base + '/forms/' + kind); if (!current()) return; const form = result.form; row.append(node('p', form ? human(form.state) + ' · Updated ' + date(form.updatedAt) : 'Not started'));
        if (form) pdfButton(row, 'View / print ' + title, base + '/forms/' + kind + '/pdf', current, message);
      } catch { if (current()) row.append(node('p', 'Unavailable. Reopen the profile.')); }
    })), (async () => {
      try { const docs = await workforceApi(base + '/documents'); if (!current()) return;
        if(docs.submissionEmail){const labels={queued:'Queued — waiting for processing or security review',building:'Preparing packet',dispatching:'Dispatch started — delivery not yet confirmed',accepted:'Accepted by Microsoft for delivery',unconfirmed:'Delivery uncertain — staff follow-up required',review_required:'Not sent — staff review required'};documentsArea.append(node('p','Application email to irab@pthhs.net: '+(labels[docs.submissionEmail.status]||'Status unavailable')+(docs.submissionEmail.summaryStatus==='accepted'?' — insurance-election summary accepted for delivery':'')+(docs.submissionEmail.reason==='packet_too_large'?' (packet exceeds the email size limit)':'')));}
        for (const [kind, title] of Object.entries({identity:'Photo ID',social_security:'Social Security card',insurance_card:'Health insurance card',direct_deposit:'Direct deposit form',employment_authorization:'Employment authorization document',i9:'Uploaded I-9',w4:'Uploaded W-4'})) {
          if (!['identity','social_security'].includes(kind) && !docs.items.some(doc => doc.kind === kind)) continue;
          const row = node('div', undefined, 'caregiver-file-row'); row.append(node('h4', title)); documentsArea.append(row); const matches = docs.items.filter(doc => doc.kind === kind);
          if (!matches.length) row.append(node('p', 'Not submitted'));
          for (const doc of matches) { row.append(node('p', human(doc.state) + ' · Uploaded ' + date(doc.createdAt)));
            if (doc.state === 'pending_review') pdfButton(row, 'View / print ' + title, base + '/documents/' + encodeURIComponent(doc.id) + '/print', current, message);
            else row.append(node('p', 'Security check pending.'));
          }
        }
      } catch { if (current()) documentsArea.append(node('p', 'Could not load documents. Reopen the profile.')); }
    })()]);
  }
  async function openApplication(uid, selectedTab="application", writeHistory=true) {
    if(!can("applications.review"))return;
    const sequence = ++applicationSelection, session = generation, current = () => sequence === applicationSelection && session === generation;
    detail.replaceChildren(); status.textContent = 'Opening application…';
    try { await applicationProfile(uid, detail, current, status); if (current()) {status.textContent = '';window.WorkforceRecordTabs?.decorate(detail,{view:'applications',id:uid,selected:selectedTab,writeHistory});} }
    catch (error) { if (current()) status.textContent = error.message; }
  }
  async function openAccount(match, selectedTab="employment", writeHistory=true) {
    if(!can("accounts.support"))return;
    const sequence = ++accountSelection, session = generation, current = () => sequence === accountSelection && session === generation;
    accountDetail.replaceChildren(); accountMessage.textContent = 'Opening profile…';
    try {
      if(match.source==='hhaexchange'){
        const data=await workforceApi('/staff/roster/'+encodeURIComponent(match.hhaId)+'/detail');if(!current())return;
        window.WorkforceHha.render(accountDetail,data,workforceApi,'/staff/roster/'+encodeURIComponent(match.hhaId)+'/files/',current);
        if(data.accessEnabled){const access=node('button','Send portal access link','btn-secondary');access.type='button';access.onclick=async()=>{access.disabled=true;try{await workforceApi('/staff/roster/'+encodeURIComponent(match.hhaId)+'/access',{});if(current())accountMessage.textContent='If the source email uniquely matches, a portal password link has been requested.';}catch(error){if(current())accountMessage.textContent=error.message;}finally{if(current())access.disabled=false;}};accountDetail.append(access);}
        accountMessage.textContent=data.savedProfile ? 'HHA unavailable. Details saved ' + date(data.profile.fetchedAt) + ' CT.' : '';
        await window.WorkforceCaregiverOffice?.augment(accountDetail,{source:'hhaexchange',id:match.hhaId,current});if(!current())return;
        window.WorkforceRecordTabs?.decorate(accountDetail,{view:'accounts',id:match.hhaId,source:'hhaexchange',selected:selectedTab,writeHistory});
        return;
      }
      const account = await workforceApi('/staff/accounts/' + encodeURIComponent(match.uid) + '/profile'); if (!current()) return;
      const heading = node('div', undefined, 'caregiver-profile-heading'); heading.append(node('h2', [match.firstName, match.lastName].filter(Boolean).join(' ')), node('span', human(account.state), 'manager-status manager-status-' + account.state)); accountDetail.append(heading);
      const accountArea = section(accountDetail, 'Account access');
      fields(accountArea, [['Account email', account.email], ['Account status', account.disabled ? 'Disabled' : 'Active'], ['Email verification', account.emailVerified ? 'Verified' : 'Not yet verified']]);
      if (!account.disabled && account.providers.includes('password')) {
        const send = node('button', 'Send password reset email', 'btn-secondary'); send.type = 'button';
        send.onclick = async () => { send.disabled = true; try { const result = await workforceApi('/staff/accounts/' + encodeURIComponent(account.uid) + '/reset', {}); if (!current()) return; await window.WorkforceSendPasswordReset(result.email); if (current()) accountMessage.textContent = 'Reset email requested for ' + account.email + '.'; } catch (error) { if (current()) { accountMessage.textContent = error.message; send.disabled = false; } } }; accountArea.append(send);
      } else if (!account.disabled) accountArea.append(node('p', 'Password recovery is managed by the sign-in provider.'));
      if(account.state==='not_started'){accountDetail.append(node('p','Application not started.'));}
      else if (can('applications.review')) await applicationProfile(match.uid, accountDetail, current, accountMessage, false);
      else accountDetail.append(node('p', 'Application review access required.'));
      if(current())await window.WorkforceCaregiverOffice?.augment(accountDetail,{source:'portal',id:match.uid,current});
      if (current()) {accountMessage.textContent = '';window.WorkforceRecordTabs?.decorate(accountDetail,{view:'accounts',id:match.uid,selected:selectedTab,writeHistory});}
    } catch (error) { if (current()) accountMessage.textContent = error.message; }
  }
  function renderApplications() {
    list.replaceChildren();
    if (!applicationData) return;
    const filter = el('personnel-filter').value, items = applicationData.items.filter(item => !filter || item.state === filter);
    el('personnel-coverage').textContent = 'Showing ' + items.length + ' of ' + applicationData.items.length + ' loaded applications. ' + WorkforceContract.listCoverage(applicationData, actor.grant.offices.length, 'Applications');
    if (!items.length) list.append(node('div', filter ? 'No matching applications in the loaded records.' : 'No applications in the loaded records.', 'manager-empty'));
    for (const item of items) { const button = node('button', (item.displayName || 'Application #' + item.uid.slice(-6).toUpperCase()) + ' · ' + human(item.state)); button.type = 'button'; button.onclick = () => openApplication(item.uid); list.append(button); }
  }
  function applicationState(data) {
    applicationData = Array.isArray(data.items) ? data : null;
    el('personnel-coverage').textContent = WorkforceContract.listCoverage(data, actor.grant.offices.length, 'Applications');
    renderApplications(); document.dispatchEvent(new CustomEvent('workforce-applications-updated', {detail:data}));
  }
  async function refreshApplications() {
    if (!can('applications.review')) return;
    const session = generation, read = ++applicationRead;
    applicationSelection++; detail.replaceChildren(); status.textContent = ''; applicationState({state:'loading'});
    try {
      const response = await workforceApi('/staff/applications'); if (session !== generation || read !== applicationRead) return;
      applicationState(response);
    } catch (error) { if (session === generation && read === applicationRead) applicationState({state:'unavailable'}); }
  }
  el('personnel-refresh').onclick = refreshApplications;
  el('personnel-filter').onchange = () => { applicationSelection++; detail.replaceChildren(); status.textContent = ''; renderApplications(); };
  const moreCaregivers = el('caregiver-roster-more');
  let nextCaregiverPage = null;
  async function search(after) {
    clearTimeout(searchTimer);
    const query = el('caregiver-account-name').value.trim();
    const sequence = ++accountSelection, session = generation;
    if (!after) { results.replaceChildren(); accountDetail.replaceChildren(); }
    if (!after) moreCaregivers.hidden = true;
    moreCaregivers.disabled = true;
    if (!query) {
      results.replaceChildren(); accountDetail.replaceChildren();
      nextCaregiverPage = null; moreCaregivers.hidden = true; moreCaregivers.disabled = false;
      accountMessage.textContent = 'Type a first or last name to find a caregiver.';
      return;
    }
    accountMessage.textContent = 'Finding caregivers…';
    try {
      const response = await workforceApi('/staff/accounts/lookup', {name:query});
      if (session !== generation || sequence !== accountSelection) return;
      nextCaregiverPage = query ? null : response.next;
      moreCaregivers.hidden = !nextCaregiverPage;
      if (query) {
        accountMessage.textContent = response.hasMore ? 'Enter more letters to narrow your search.'
          : response.items.length ? 'Select a caregiver to open their profile.' : 'No matching caregivers found.';
        if(response.hhaUnavailable)accountMessage.textContent+=response.hhaCached?' Live HHA lookup is busy. Showing synchronized HHA names and portal matches.':' HHAeXchange is unavailable; portal matches only.';
      } else {
        accountMessage.textContent = response.activeCount.toLocaleString() + ' active HHA caregivers available. '
          + (response.syncedAt ? 'Last sync: ' + date(response.syncedAt) + ' CT.' : 'First sync pending.')
          + (response.refreshFailed ? ' The latest refresh failed.' : response.refreshRunning ? ' Refresh in progress.' : '');
      }
      const {items} = response;
      if (query) items.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
      for (const match of items) {
        const displayName = [match.lastName, match.firstName].filter(Boolean).join(', ');
        const source = match.source === 'hhaexchange' ? 'HHAeXchange' : human(match.state);
        const button = node('button', displayName + ' · ' + source, 'caregiver-search-result');
        button.type = 'button'; button.onclick = () => openAccount(match); results.append(button);
      }
    } catch (error) { if (session === generation && sequence === accountSelection) accountMessage.textContent = error.message; }
    finally { if (session === generation) moreCaregivers.disabled = false; }
  }
  moreCaregivers.onclick = () => search(nextCaregiverPage);
  window.WorkforcePersonnel = {cancelRecordRequests:()=>{applicationSelection++;accountSelection++;},closeRecord:view=>{applicationSelection++;accountSelection++;(view==='applications'?detail:accountDetail).replaceChildren();},openRoute:async(view,params)=>{const id=params.get('record');if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id||''))return;if(view==='applications'&&can('applications.review'))return openApplication(id,params.get('tab')||'application',false);if(view==='accounts'&&can('accounts.support'))return openAccount(params.get('source')==='hhaexchange'?{source:'hhaexchange',hhaId:id}:{source:'portal',uid:id},params.get('tab')||'employment',false);},refresh:refreshApplications, browse:() => { if (can('accounts.support') && !results.childElementCount) search(); }};
  document.addEventListener('workforce-session-cleared', () => { moreCaregivers.hidden = true; nextCaregiverPage = null; });
  el('caregiver-account-search').onsubmit = event => { event.preventDefault(); if(event.currentTarget.reportValidity())return search(); };
  el('caregiver-account-name').oninput = event => { clearTimeout(searchTimer); accountSelection++; results.replaceChildren(); accountDetail.replaceChildren(); moreCaregivers.hidden=true; accountMessage.textContent=''; if(!event.isComposing)searchTimer=setTimeout(search,300); };

  let importJob=null;el('hha-roster-sync').onclick=async()=>{const session=generation,button=el('hha-roster-sync'),message=el('hha-roster-sync-message');button.disabled=true;try{for(;;){const result=await workforceApi('/staff/roster/sync',importJob?{jobId:importJob}:{});if(session!==generation)return;importJob=result.jobId;message.textContent='Checked '+result.processed+' of '+result.total+' HHA caregiver records.';if(result.complete){importJob=null;break;}if(result.deferred){message.textContent+=' Sync paused. Select Sync again to resume.';break;}}}catch(error){if(session===generation)message.textContent=error.message;}finally{if(session===generation)button.disabled=false;}};

  document.addEventListener('workforce-session-cleared', () => { el('hha-roster-sync').hidden=true;el('hha-roster-sync-message').textContent='';clearTimeout(searchTimer); generation++; applicationRead++; applicationSelection++; accountSelection++; actor = null; applicationData = null; release(); panel.hidden = true; support.hidden = true; list.replaceChildren(); detail.replaceChildren(); accountDetail.replaceChildren(); results.replaceChildren(); status.textContent = ''; accountMessage.textContent = ''; el('caregiver-account-name').value = ''; el('personnel-filter').value = ''; el('personnel-coverage').textContent = ''; });
  document.addEventListener('workforce-session', event => { el('hha-roster-sync').hidden=!(event.detail.grant.role==='owner'&&event.detail.grant.permissions.includes('staff.manage')&&event.detail.grant.permissions.includes('accounts.support'));generation++; actor = event.detail; panel.hidden = !can('applications.review'); support.hidden = !can('accounts.support'); refreshApplications();
    const linkedApplication = window.location?.hash?.match(/^#application=([a-zA-Z0-9_-]{1,128})$/);
    if (linkedApplication && can('applications.review') && can('documents.review')) {
      queueMicrotask(() => {
        if (actor === event.detail && window.WorkforceManagement.show('applications')) openApplication(linkedApplication[1]);
      });
    } });

})();
