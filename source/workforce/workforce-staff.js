(() => {
  let actor = null, items = [], generation = 0, read = 0, listData = null;
  const area = document.getElementById('staff-workspace');
  const list = document.getElementById('staff-opportunities');
  const form = document.getElementById('staff-editor');
  const invites = document.getElementById('staff-invite-form');
  const inviteStatus = document.getElementById('staff-invite-status');
  const grantStatus = document.getElementById('staff-grant-status');
  const status = document.getElementById('session-status');
  const can = p => actor?.grant.permissions.includes('opportunities.' + p);
  const message = s => { status.textContent = s; };
  async function refresh() {
    if(!can('read'))return;
    const sequence = generation, request = ++read;
    updateList({state:'loading'});
    try {
      const data = await workforceApi('/staff/opportunities');
      if (sequence !== generation || request !== read) return;
      updateList(data);
    } catch (error) { if (sequence === generation && request === read) updateList({state:'unavailable'}); }
  }
  function updateList(data) {
    listData = data; items = data.items || []; render();
    document.dispatchEvent(new CustomEvent('workforce-opportunities-updated', {detail:data}));
  }
  function edit(o) {
    if(!can('edit'))return;document.getElementById('staff-editor-message').textContent='';
    window.WorkforceManagement?.show('opportunities');document.getElementById('staff-editor-panel').open=true;document.getElementById('staff-editor-title').textContent=o?'Edit opportunity':'New opportunity';
    form.reset(); form.elements.id.value = o?.id || ''; form.elements.revision.value = o?.revision || 0;
    for (const key of ['office', 'internalReference', 'internalNotes']) if (o) form.elements[key].value = o[key];
    for (const key of ['location', 'recruitingZip', 'weeklyHours', 'schedule', 'type', 'duration', 'serviceType', 'pets']) if (o) form.elements[key].value = o.public[key] || '';
    for (const box of form.querySelectorAll('[name=assistance]')) {box.checked = !!o?.public.assistance.includes(box.value);if(box.closest('[data-legacy-task]'))box.parentElement.hidden=!box.checked;}
    for(const box of form.querySelectorAll('[name=shifts]'))box.checked=!!o?.public.shifts?.includes(box.value);
    window.WorkforceOverlay?.open('staff-editor-panel',{title:o?'Edit opportunity':'New opportunity'});
  }
  const centralTime = value => Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-US', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago'}).format(new Date(value)) + ' Central'
    : 'Date unavailable';
  const responses = {accepted:'Accepted', declined:'Declined', pending:'Awaiting response'};
  function caregiverSelection(panel, opening, applicant, result, path, current) {
    const action = document.createElement('div');
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    panel.append(action, feedback);
    const button = (label, onclick) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'btn-secondary';
      element.textContent = label;
      element.onclick = onclick;
      return element;
    };
    const selected = () => {
      action.replaceChildren();
      feedback.textContent = 'Awaiting response. The notification is available in the caregiver’s portal.';
    };
    if (result.response) {
      feedback.textContent = 'Caregiver response: ' + responses[result.response] + ' · ' + centralTime(result.respondedAt);
      return;
    }
    if (result.selection === 'selected') { selected(); return; }
    if (result.selection === 'another_selected') {
      feedback.textContent = 'A caregiver has already been selected for this opening.';
      return;
    }
    if (!result.canSelect) return;
    const start = button('Select caregiver', () => {
      feedback.textContent = 'Send a portal notification to ' + (applicant.name || 'this caregiver') + ' for ' + opening.public.location + '?';
      action.replaceChildren(confirm, cancel);
      confirm.focus();
    });
    const cancel = button('Cancel', () => {
      feedback.textContent = '';
      action.replaceChildren(start);
      start.focus();
    });
    const confirm = button('Confirm selection and notify', async () => {
      if (confirm.disabled || !current()) return;
      confirm.disabled = cancel.disabled = true;
      try {
        const receipt = await workforceApi(path + '/select', {revision: opening.revision});
        if (!current()) return;
        if (receipt.selected !== true) throw Error('The selection could not be confirmed. Try again.');
        selected();
      } catch (error) {
        if (current()) {
          feedback.textContent = error.message;
          confirm.disabled = cancel.disabled = false;
        }
      }
    });
    confirm.className = 'manager-primary';
    action.append(start);
  }
  async function openRecruitingProfile(opening, applicant) {
    const sequence = generation;
    const panel = document.createElement('section');
    panel.className = 'office-hiring-profile';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = 'Loading caregiver profile…';
    panel.append(status);
    window.WorkforceOverlay.open(panel, {title: applicant.name || 'Caregiver profile'});
    const path = '/staff/opportunities/' + encodeURIComponent(opening.id) + '/caregiver-applicants/' + encodeURIComponent(applicant.id);
    const current = () => sequence === generation && panel.isConnected;
    try {
      const result = await workforceApi(path);
      if (!current()) return;
      const details = document.createElement('dl');
      const add = (label, value) => {
        const term = document.createElement('dt');
        term.textContent = label;
        const definition = document.createElement('dd');
        definition.textContent = value || 'Not on file';
        details.append(term, definition);
      };
      add('Opportunity', opening.public.location);
      add('HHA caregiver ID', result.caregiverId);
      add('Applied', centralTime(result.createdAt));
      if (result.profile) {
        const {status, disciplines, location, email, phone, fetchedAt} = result.profile;
        add('HHA status', status);
        add('Disciplines', disciplines.join(', '));
        add('City and state', location);
        add('Email', email);
        add('Phone', phone);
        add('HHA profile last checked', centralTime(fetchedAt));
      }
      status.textContent = result.profile ? '' : 'Basic profile details aren’t available from the office’s HHA sync yet.';
      panel.prepend(details);
      caregiverSelection(panel, opening, applicant, result, path, current);
    } catch (error) {
      if (sequence === generation && panel.isConnected) status.textContent = error.message;
    }
  }
  function caregiverApplicants(opening) {
    const panel = document.createElement('details');
    panel.className = 'office-hiring-profile';
    const summary = document.createElement('summary');
    summary.textContent = 'Existing caregiver applications';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const applicants = document.createElement('ul');
    const more = document.createElement('button');
    more.type = 'button';
    more.hidden = true;
    more.textContent = 'Load more';
    panel.append(summary, status, applicants, more);
    const sequence = generation;
    let cursor = null, loaded = false, pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      more.disabled = true;
      status.textContent = 'Loading caregiver applications…';
      try {
        const path = '/staff/opportunities/' + encodeURIComponent(opening.id) + '/caregiver-applicants';
        const page = await workforceApi(path + (cursor ? '?after=' + encodeURIComponent(cursor) : ''));
        if (sequence !== generation || !panel.isConnected) return;
        for (const entry of page.items) {
          const row = document.createElement('li');
          const name = entry.name || 'Caregiver name unavailable';
          if (entry.id) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = name;
            button.setAttribute('aria-label', 'Review caregiver profile for ' + name);
            button.onclick = () => openRecruitingProfile(opening, entry);
            row.append(button);
          } else row.textContent = name;
          row.append(' · HHA ' + entry.caregiverId + ' · ' + centralTime(entry.createdAt));
          if (responses[entry.response]) row.append(' · ' + responses[entry.response]);
          applicants.append(row);
        }
        cursor = page.next;
        loaded = true;
        more.hidden = !cursor;
        status.textContent = applicants.childElementCount ? '' : 'No existing caregivers have applied.';
      } catch (error) {
        if (sequence === generation && panel.isConnected) status.textContent = error.message + ' Close and reopen to retry.';
      } finally {
        pending = false;
        more.disabled = false;
      }
    }
    panel.ontoggle = () => { if (panel.open && !loaded) void load(); };
    more.onclick = load;
    return panel;
  }
  function render() {
    list.replaceChildren();
    const coverage = document.getElementById('staff-coverage');
    coverage.textContent = actor ? WorkforceContract.listCoverage(listData, actor.grant.offices.length, 'Opportunities') : '';
    if (!Array.isArray(listData?.items)) return;
    const query=document.getElementById('staff-search').value.trim().toLowerCase(),state=document.getElementById('staff-filter').value;
    const filtered=items.filter(item=>(!state||item.state===state)&&(!query||[item.public.location,item.public.recruitingZip,item.internalReference].join(' ').toLowerCase().includes(query)));
    coverage.textContent = 'Showing ' + filtered.length + ' of ' + items.length + ' loaded opportunities. ' + coverage.textContent;
    if(!filtered.length){const empty=document.createElement('div');empty.className='manager-empty';const title=document.createElement('h3');title.textContent=items.length?'No matching opportunities':'Your next opportunity starts here';const text=document.createElement('p');text.textContent=items.length?'Try another area or status.':'Create an opening, then send it through privacy review before publishing.';empty.append(title,text);list.append(empty);}
    for (const o of filtered) {
      const card = document.createElement('article'),heading=document.createElement('div');heading.className='manager-opportunity-heading';
      const title = document.createElement('h3');title.textContent=o.public.location;
      const badge=document.createElement('span');badge.className='manager-status manager-status-'+o.state;badge.textContent={review:'In review',draft:'Draft',published:'Published',approved:'Approved',closed:'Closed',archived:'Archived'}[o.state]||o.state;
      heading.append(title,badge);
      const details = document.createElement('p');details.textContent=[o.public.recruitingZip?'ZIP '+o.public.recruitingZip:'Broad recruiting area',o.public.weeklyHours+' hours / week',({weekdays:'Weekdays',weekends:'Weekends',flexible:'Flexible schedule'})[o.public.schedule]].join(' · ');
      const meta=document.createElement('p');meta.className='manager-record-meta';meta.textContent='Office: '+o.office+' · Revision '+o.revision+(o.internalReference?' · Ref. '+o.internalReference:'');
      const care=document.createElement('p');care.textContent=WorkforceOpportunityFields.details(o.public);const tasks=document.createElement('p');tasks.textContent='Tasks: '+o.public.assistance.map(k=>WorkforceOpportunityFields.tasks[k]||k).join(', ');card.append(heading,details,care,tasks,meta);const provenance=document.createElement('p');provenance.className='manager-record-meta';const who=id=>listData.people?.[id]||id||'Not recorded on this older record',when=value=>value?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'long',timeZone:'America/Chicago'}).format(new Date(value)):'Date unavailable';provenance.textContent='Created by '+who(o.createdBy)+(o.createdAt?' · '+when(o.createdAt):'')+' | Last changed by '+who(o.updatedBy)+' · '+when(o.updatedAt)+(o.publishedBy?' | Last published by '+who(o.publishedBy)+' · '+when(o.publishedAt):'');card.append(provenance);const history=document.createElement('button');history.type='button';history.textContent='View change history';history.onclick=()=>{window.WorkforceManagement.show('activity');window.WorkforceDirectoryHistory?.filterOpportunity(o.id);};card.append(history);
      if (can('edit') && o.state !== 'archived') {
        const button = document.createElement('button'); button.textContent = 'Edit'; button.onclick = () => edit(o); card.append(button);
      }
      const steps = { draft: ['submit', 'close'], review: ['approve', 'close'], approved: ['publish', 'close'], published: ['close'], closed: ['archive'], archived: [] };
      for (const action of steps[o.state] || []) {
        const permission = action === 'approve' ? 'review' : action === 'publish' ? 'publish' : 'edit';
        if (!can(permission)) continue;
        let privacy = null;
        if (action === 'approve') {
          const label = document.createElement('label'); privacy = document.createElement('input'); privacy.type = 'checkbox';
          label.append(privacy, document.createTextNode(' I reviewed the complete public combination, approved recruiting geography and identification risk. No patient details are exposed.')); card.append(label);
        }
        const button = document.createElement('button');
        button.textContent = { submit: 'Submit for Review', approve: 'Approve Privacy Review', publish: 'Publish', close: 'Close / Filled', archive: 'Archive' }[action];
        button.onclick = async () => {
          const sequence = generation; button.disabled = true;
          try {
            await workforceApi('/staff/opportunities', { id: o.id, revision: o.revision, action, privacyConfirmed: privacy?.checked === true });
            if (sequence === generation) await refresh();
          } catch (error) { if (sequence === generation) message(error.message); }
          finally { button.disabled = false; }
        };
        card.append(button);
      }
      const matchingSequence=generation;window.WorkforceMatching?.openingButton(card,o,{current:()=>matchingSequence===generation});
      if (actor.grant.permissions.includes('applicants.review') && (o.publishedBy || ['published', 'closed', 'archived'].includes(o.state))) card.append(caregiverApplicants(o));
      list.append(card);
    }
  }
  document.addEventListener('workforce-session-cleared', () => {
    generation++; read++; actor = null; items = []; listData = null; list.replaceChildren(); document.getElementById('staff-coverage').textContent=''; form.reset();document.getElementById('staff-search').value='';document.getElementById('staff-filter').value='';document.getElementById('staff-editor-panel').open=false;area.hidden = true;
    invites.reset();
    inviteStatus.textContent = grantStatus.textContent = '';
  });
  document.addEventListener('workforce-session', e => {
    generation++; actor = e.detail; area.hidden = false;
    form.hidden = !can('edit'); document.getElementById('staff-new').hidden = !can('edit');
    document.getElementById('staff-grants').hidden = !(actor.grant.role === 'owner' && actor.grant.permissions.includes('staff.manage'));
    const officeOptions = () => actor.grant.offices.map(id => {
      const option = document.createElement('option'); option.value = id; option.textContent = id; return option;
    });
    form.elements.office.replaceChildren(...officeOptions());
    invites.elements.office.replaceChildren(...officeOptions());
    refresh();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const sequence = generation, f = new FormData(form);
    const data = { office: f.get('office'), internalReference: f.get('internalReference'), internalNotes: f.get('internalNotes'),
      public: { location: f.get('location'), recruitingZip: f.get('recruitingZip'), weeklyHours: Number(f.get('weeklyHours')),
        schedule: f.get('schedule'), type: f.get('type'), assistance: f.getAll('assistance'),serviceType:f.get('serviceType'),pets:f.get('pets'),duration:f.get('duration'),shifts:f.getAll('shifts') } };
    if(!data.public.assistance.length||!data.public.shifts.length){document.getElementById('staff-editor-message').textContent='Choose at least one care task and one shift.';return;}
    try {
      const saved = await workforceApi('/staff/opportunities', { ...(f.get('id') ? { id: f.get('id') } : {}), revision: Number(f.get('revision')), data });
      if (sequence === generation) { edit(saved); document.getElementById('staff-editor-message').textContent='Draft saved. Privacy review is required before publication.'; await refresh(); }
    } catch (error) { if (sequence === generation) document.getElementById('staff-editor-message').textContent=error.message; }
  });
  window.WorkforceRecruiting={refresh};document.getElementById('staff-search').addEventListener('input',render);document.getElementById('staff-filter').addEventListener('change',render);
  document.getElementById('staff-refresh').onclick = refresh;
  document.getElementById('staff-new').onclick = () => edit(null);
  let invitationBusy = false;
  async function sendInvitation() {
    if (invitationBusy || !actor) return;
    if (!invites.elements.email.reportValidity()) return;
    const sequence = generation;
    const data = new FormData(invites), email = data.get('email');
    const permissions = data.getAll('permissions');
    if (!permissions.length) {
      inviteStatus.textContent = 'Choose at least one permission.';
      return;
    }
    const submit = invites.querySelector('[type="submit"]');
    invitationBusy = submit.disabled = true;
    inviteStatus.textContent = 'Preparing invitation…';
    try {
      const invite = await workforceApi('/staff/invitations', {email, grant: {
        active: true, role: data.get('role'), offices: [data.get('office')], permissions
      }});
      if (sequence !== generation) return;
      try {
        await window.WorkforceSendStaffInvitation(invite);
        if (sequence === generation) inviteStatus.textContent = 'Invitation email requested for ' + invite.email + '. The link expires after 24 hours.';
      } catch {
        if (sequence === generation) inviteStatus.textContent = 'Invitation saved. The email could not be sent. Select Send invitation to retry.';
      }
    } catch (error) {
      if (sequence === generation) inviteStatus.textContent = error.message;
    } finally {
      invitationBusy = submit.disabled = false;
    }
  }
  invites.addEventListener('submit', e => { e.preventDefault(); return sendInvitation(); });
  document.getElementById('staff-grant-form').addEventListener('submit', async e => {
    e.preventDefault(); const sequence = generation, f = new FormData(e.target);
    try {
      await workforceApi('/staff/grant', { uid: f.get('uid'), grant: { role: f.get('role'), active: f.has('active'),
        offices: f.get('offices').split(',').map(s => s.trim()), permissions: f.getAll('permissions') } });
      if (sequence === generation) grantStatus.textContent = 'Staff access saved.';
    } catch (error) { if (sequence === generation) grantStatus.textContent = error.message; }
  });
})();
