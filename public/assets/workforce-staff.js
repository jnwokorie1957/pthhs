(() => {
  let actor = null, items = [], generation = 0;
  const area = document.getElementById('staff-workspace');
  const list = document.getElementById('staff-opportunities');
  const form = document.getElementById('staff-editor');
  const status = document.getElementById('session-status');
  const can = p => actor?.grant.permissions.includes('opportunities.' + p);
  const message = s => { status.textContent = s; };
  async function refresh() {
    const sequence = generation;
    try {
      const data = await workforceApi('/staff/opportunities');
      if (sequence !== generation) return;
      items = data.items; render();
    } catch (error) { if (sequence === generation) message(error.message); }
  }
  function edit(o) {
    form.reset(); form.elements.id.value = o?.id || ''; form.elements.revision.value = o?.revision || 0;
    for (const key of ['office', 'internalReference', 'internalNotes']) if (o) form.elements[key].value = o[key];
    for (const key of ['location', 'recruitingZip', 'weeklyHours', 'schedule', 'type']) if (o) form.elements[key].value = o.public[key];
    for (const box of form.querySelectorAll('[name=assistance]')) box.checked = !!o?.public.assistance.includes(box.value);
  }
  function render() {
    list.replaceChildren();
    if (!items.length) list.textContent = 'No opportunities in your authorized offices.';
    for (const o of items) {
      const card = document.createElement('article');
      const title = document.createElement('h3'); title.textContent = o.public.location + ' · ' + o.state;
      const details = document.createElement('p');
      details.textContent = [o.office, o.public.recruitingZip ? 'Approved recruiting ZIP ' + o.public.recruitingZip : 'Broad area only',
        o.public.weeklyHours + ' hours/week', o.public.schedule, o.public.type, o.public.assistance.join(', '), 'revision ' + o.revision].join(' · ');
      card.append(title, details);
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
    generation++; actor = null; items = []; list.replaceChildren(); form.reset(); area.hidden = true;
  });
  document.addEventListener('workforce-session', e => {
    generation++; actor = e.detail; area.hidden = false;
    form.hidden = !can('edit'); document.getElementById('staff-new').hidden = !can('edit');
    document.getElementById('staff-grants').hidden = !(actor.grant.role === 'owner' && actor.grant.permissions.includes('staff.manage'));
    form.elements.office.replaceChildren(...actor.grant.offices.map(id => {
      const option = document.createElement('option'); option.value = id; option.textContent = id; return option;
    }));
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
  document.getElementById('staff-refresh').onclick = refresh;
  document.getElementById('staff-new').onclick = () => edit(null);
  document.getElementById('staff-grant-form').addEventListener('submit', async e => {
    e.preventDefault(); const sequence = generation, f = new FormData(e.target);
    try {
      await workforceApi('/staff/grant', { uid: f.get('uid'), grant: { role: f.get('role'), active: f.has('active'),
        offices: f.get('offices').split(',').map(s => s.trim()), permissions: f.getAll('permissions') } });
      if (sequence === generation) message('Staff access saved and audited.');
    } catch (error) { if (sequence === generation) message(error.message); }
  });
})();
