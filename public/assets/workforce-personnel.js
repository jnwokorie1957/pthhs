(() => {
  const el = id => document.getElementById(id), panel = el('personnel-workspace');
  if (!panel) return;
  const status = el('personnel-message'), list = el('personnel-list'), detail = el('personnel-detail');
  const support = el('caregiver-account-support'), accountDetail = el('caregiver-account-detail'), results = el('caregiver-account-results'), accountMessage = el('caregiver-account-message');
  let generation = 0, applicationSelection = 0, accountSelection = 0, actor, packetPromise, searchTimer;
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
    const formsArea = section(target, 'Employment forms'), documentsArea = section(target, 'Identification documents');
    const base = '/staff/applications/' + encodeURIComponent(uid);
    await Promise.allSettled([...(Object.entries({i9:'Form I-9',w4:'Form W-4',new_hire:'Texas New Hire Report'}).map(async ([kind, title]) => {
      const row = node('div', undefined, 'caregiver-file-row'); row.append(node('h4', title)); formsArea.append(row);
      try { const result = await workforceApi(base + '/forms/' + kind); if (!current()) return; const form = result.form; row.append(node('p', form ? human(form.state) + ' · Updated ' + date(form.updatedAt) : 'Not started'));
        if (form) pdfButton(row, 'View / print ' + title, base + '/forms/' + kind + '/pdf', current, message);
      } catch { if (current()) row.append(node('p', 'Unavailable. Reopen the profile.')); }
    })), (async () => {
      try { const docs = await workforceApi(base + '/documents'); if (!current()) return;
        for (const [kind, title] of Object.entries({identity:'Photo ID',social_security:'Social Security card',employment_authorization:'Employment authorization document',i9:'Uploaded I-9',w4:'Uploaded W-4'})) {
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
  async function openApplication(uid) {
    const sequence = ++applicationSelection, session = generation, current = () => sequence === applicationSelection && session === generation;
    detail.replaceChildren(); status.textContent = 'Opening application…';
    try { await applicationProfile(uid, detail, current, status); if (current()) status.textContent = ''; }
    catch (error) { if (current()) status.textContent = error.message; }
  }
  async function openAccount(match) {
    const sequence = ++accountSelection, session = generation, current = () => sequence === accountSelection && session === generation;
    accountDetail.replaceChildren(); accountMessage.textContent = 'Opening profile…';
    try {
      if(match.source==='hhaexchange'){
        const record=await workforceApi('/staff/roster/'+encodeURIComponent(match.hhaId)+'/profile');if(!current())return;
        accountDetail.append(node('h2',name(record)));fields(section(accountDetail,'HHAeXchange profile'),[['Caregiver code',record.code],['Status',record.state],['Checked',date(record.fetchedAt)]]);accountMessage.textContent='';return;
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
      if (current()) accountMessage.textContent = '';
    } catch (error) { if (current()) accountMessage.textContent = error.message; }
  }
  el('personnel-refresh').onclick = async () => {
    const session = generation;
    try {
      const response = await workforceApi('/staff/applications'); if (session !== generation) return;
      list.replaceChildren(); document.dispatchEvent(new CustomEvent('workforce-applications-updated', {detail:response.items})); status.textContent = response.items.length + (response.items.length === 1 ? ' application' : ' applications') + ' in your assigned offices (up to 50 per office).';
      if (!response.items.length) list.append(node('div', 'No applications to review yet.', 'manager-empty'));
      for (const item of response.items) { const button = node('button', (item.displayName || 'Application #' + item.uid.slice(-6).toUpperCase()) + ' · ' + human(item.state)); button.type = 'button'; button.onclick = () => openApplication(item.uid); list.append(button); }
    } catch (error) { if (session === generation) status.textContent = error.message; }
  };
  async function search() {
    clearTimeout(searchTimer);
    const sequence = ++accountSelection, session = generation; results.replaceChildren(); accountDetail.replaceChildren(); accountMessage.textContent = 'Finding caregivers…';
    try {
      const response = await workforceApi('/staff/accounts/lookup', {name:el('caregiver-account-name').value.trim()}); if (session !== generation || sequence !== accountSelection) return;
      accountMessage.textContent = response.items.length ? (response.hasMore ? 'More matches found. Enter more letters to narrow your search.' : 'Select a caregiver to open their profile.') : 'No matching caregivers found.';
      if(response.hhaUnavailable)accountMessage.textContent+=' HHAeXchange is unavailable; portal matches only.';
      for (const match of response.items) { const button = node('button', [match.firstName, match.lastName].filter(Boolean).join(' ') + ' · ' + (match.source==='hhaexchange'?'HHAeXchange':human(match.state)), 'caregiver-search-result'); button.type = 'button'; button.onclick = () => openAccount(match); results.append(button); }
    } catch (error) { if (session === generation && sequence === accountSelection) accountMessage.textContent = error.message; }
  }
  el('caregiver-account-search').onsubmit = event => { event.preventDefault(); if(event.currentTarget.reportValidity())return search(); };
  el('caregiver-account-name').oninput = event => { clearTimeout(searchTimer); accountSelection++; results.replaceChildren(); accountDetail.replaceChildren(); accountMessage.textContent=''; if(el('caregiver-account-name').value.trim()&&!event.isComposing)searchTimer=setTimeout(search,300); };
  document.addEventListener('workforce-session-cleared', () => { clearTimeout(searchTimer); generation++; applicationSelection++; accountSelection++; actor = null; release(); panel.hidden = true; support.hidden = true; list.replaceChildren(); detail.replaceChildren(); accountDetail.replaceChildren(); results.replaceChildren(); status.textContent = ''; accountMessage.textContent = ''; el('caregiver-account-name').value = ''; });
  document.addEventListener('workforce-session', event => { generation++; actor = event.detail; panel.hidden = !can('applications.review'); support.hidden = !can('accounts.support'); });
})();
