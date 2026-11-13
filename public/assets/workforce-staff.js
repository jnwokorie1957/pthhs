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
    window.WorkforceManagement?.show('opportunities');document.getElementById('staff-editor-panel').open=true;document.getElementById('staff-editor-title').textContent=o?'Edit opportunity':'New opportunity';
    form.reset(); form.elements.id.value = o?.id || ''; form.elements.revision.value = o?.revision || 0;
    for (const key of ['office', 'internalReference', 'internalNotes']) if (o) form.elements[key].value = o[key];
    for (const key of ['location', 'recruitingZip', 'weeklyHours', 'schedule', 'type']) if (o) form.elements[key].value = o.public[key];
    for (const box of form.querySelectorAll('[name=assistance]')) box.checked = !!o?.public.assistance.includes(box.value);
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
      const details = document.createElement('p');details.textContent=[o.public.recruitingZip?'ZIP '+o.public.recruitingZip:'Broad recruiting area',o.public.weeklyHours+' hours / week',({weekdays:'Weekdays',weekends:'Weekends',flexible:'Flexible schedule'})[o.public.schedule],o.public.assistance.map(need=>need.replaceAll('_',' ')).join(', ')].join(' · ');
      const meta=document.createElement('p');meta.className='manager-record-meta';meta.textContent='Office: '+o.office+' · Revision '+o.revision+(o.internalReference?' · Ref. '+o.internalReference:'');
      card.append(heading,details,meta);
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
        schedule: f.get('schedule'), type: f.get('type'), assistance: f.getAll('assistance') } };
    try {
      const saved = await workforceApi('/staff/opportunities', { ...(f.get('id') ? { id: f.get('id') } : {}), revision: Number(f.get('revision')), data });
      if (sequence === generation) { edit(saved); message('Draft saved. Privacy review is required before publication.'); await refresh(); }
    } catch (error) { if (sequence === generation) message(error.message); }
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
