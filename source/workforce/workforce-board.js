(() => {
  const byId = id => document.getElementById(id);
  const node = (tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  };
  const schedule = key => ({weekdays: 'Weekdays', weekends: 'Weekends', flexible: 'Flexible schedule'})[key] || key;
  let api, openApplication, generation = 0, openings = [], dialog = null;
  let newApplicant = false, existingCaregiver = false;
  const applied = new Set();

  function clear() {
    generation++;
    openings = [];
    applied.clear();
    byId('job-list').replaceChildren();
    dialog?.close();
    dialog?.remove();
    dialog = null;
    byId('job-board').hidden = true;
  }

  async function showPosition(opening) {
    dialog?.close();
    dialog?.remove();
    const token = generation;
    const panel = dialog = document.createElement('dialog');
    panel.className = 'job-detail';
    panel.setAttribute('aria-labelledby', 'job-detail-title');
    const heading = node('h2', 'Personal care attendant');
    heading.id = 'job-detail-title';
    const close = node('button', 'Close');
    close.type = 'button';
    close.className = 'btn-secondary';
    close.onclick = () => panel.close();
    const apply = node('button', existingCaregiver ? 'Apply with my caregiver profile' : 'Apply for this position');
    apply.type = 'button';
    apply.className = 'btn-primary';
    apply.hidden = !newApplicant && !existingCaregiver;
    const status = node('p', '');
    status.setAttribute('role', 'status');
    const current = () => token === generation && dialog === panel && panel.open;
    const path = '/opportunities/' + encodeURIComponent(opening.id) + (existingCaregiver ? '/existing-interest' : '/interest');
    const sent = () => {
      applied.add(opening.id);
      apply.textContent = 'Application sent';
      apply.disabled = true;
      status.textContent = 'The office received your interest in this opening with your existing caregiver profile.';
    };
    apply.onclick = async () => {
      if (!current() || apply.disabled) return;
      apply.disabled = true;
      status.textContent = '';
      try {
        const result = await api(path, {});
        if (!current()) return;
        if (result.recorded !== true || result.opportunityId !== opening.id) throw Error('Application could not be confirmed. Try again.');
        if (existingCaregiver) sent();
        else { panel.close(); openApplication(opening); }
      } catch (error) {
        if (current()) {
          status.textContent = error.message;
          apply.disabled = false;
        }
      }
    };
    const tasks = document.createElement('ul');
    for (const key of opening.assistance) {
      tasks.append(node('li', window.WorkforceOpportunityFields.tasks[key] || key.replaceAll('_', ' ')));
    }
    panel.append(node('p', opening.location), heading, node('p', opening.weeklyHours + ' hours per week · ' + schedule(opening.schedule)),
      node('p', window.WorkforceOpportunityFields.details(opening)), node('h3', 'How you’ll help'), tasks,
      node('p', 'Support everyday activities in the home according to the authorized service plan. Duties and scheduling are confirmed with the office.'),
      node('p', 'An application or expression of interest does not guarantee employment or an assignment.'));
    if (existingCaregiver) panel.append(node('p', 'Use your existing caregiver profile to apply. The office will review your interest.'));
    panel.append(apply, close, status);
    document.body.append(panel);
    panel.showModal();
    if (!existingCaregiver) return;

    if (applied.has(opening.id)) { sent(); return; }
    apply.disabled = true;
    status.textContent = 'Checking application status…';
    try {
      const result = await api(path);
      if (!current()) return;
      if (result.recorded === true) { sent(); return; }
      status.textContent = '';
    } catch (error) {
      if (!current()) return;
      status.textContent = error.message;
      if (error.code === 'opportunity_unavailable') return;
    }
    apply.disabled = false;
  }

  function render() {
    const filters = Object.fromEntries(new FormData(byId('job-filters')));
    const matches = openings.filter(opening => WorkforceContract.matches(opening, filters));
    const list = byId('job-list');
    list.replaceChildren();
    byId('job-count').textContent = matches.length + ' ' + (matches.length === 1 ? 'opportunity' : 'opportunities');
    if (!matches.length) {
      const empty = document.createElement('article');
      empty.className = 'job-empty';
      empty.append(node('h3', openings.length ? 'No matches yet' : 'No openings listed right now'),
        node('p', openings.length ? 'Try another area, schedule or number of hours.' :
          newApplicant ? 'You can still complete a general application so the office can review your information.' :
            'Verified openings will appear here when they are published.' + (existingCaregiver ? '' : ' Online applications are not open yet.')));
      list.append(empty);
    }
    for (const opening of matches) {
      const card = document.createElement('article');
      card.className = 'job-card';
      const details = document.createElement('div');
      details.className = 'job-meta';
      details.append(node('span', window.WorkforceOpportunityFields.details(opening)), node('span', opening.weeklyHours + ' hours / week'), node('span', schedule(opening.schedule)));
      const view = node('button', 'View position');
      view.type = 'button';
      view.className = 'btn-secondary';
      view.onclick = () => showPosition(opening);
      card.append(node('p', opening.location), node('h3', 'Personal care attendant'), details,
        node('p', opening.recruitingZip ? 'Work area ' + opening.recruitingZip : 'Greater Houston service area'), view);
      list.append(card);
    }
  }

  byId('job-filters').addEventListener('input', render);
  byId('job-filters').addEventListener('submit', event => { event.preventDefault(); render(); });
  byId('job-filters-clear').onclick = () => { byId('job-filters').reset(); render(); };
  byId('job-general-application').onclick = () => openApplication?.();
  window.WorkforceBoard = {
    clear,
    async open(actor, request, apply) {
      clear();
      api = request;
      openApplication = apply;
      newApplicant = actor.applicationsEnabled !== false && actor.existingCaregiver !== true;
      existingCaregiver = actor.existingCaregiver === true && actor.existingOpportunityInterestEnabled === true;
      byId('job-general-application').hidden = !newApplicant;
      byId('job-board').hidden = false;
      byId('caregiver-summary').hidden = true;
      byId('portal-release-notice').hidden = true;
      byId('job-count').textContent = 'Loading opportunities…';
      byId('job-message').textContent = '';
      byId('job-preview-note').hidden = !WorkforceContract.reviewNavigationAllowed(location.hostname, actor.previewNavigation);
      const token = generation;
      try {
        const result = await api('/opportunities');
        if (token !== generation) return;
        if (!Array.isArray(result.items)) throw Error('Please try again.');
        openings = result.items;
        render();
        if (result.release === 'pending') byId('job-message').textContent = 'The office is preparing verified openings.' +
          (newApplicant ? ' General applications are available below.' : existingCaregiver ? '' : ' Online applications are not open yet.');
        const selected = WorkforceContract.selectedId(location.search);
        const opening = openings.find(item => item.id === selected);
        if (opening) void showPosition(opening);
        else if (selected) byId('job-message').textContent = 'That position is no longer listed. Browse the current opportunities below.';
      } catch (error) {
        if (token !== generation) return;
        byId('job-count').textContent = '';
        byId('job-message').textContent = 'Unable to load openings. ' + error.message;
        const retry = node('button', 'Try again');
        retry.type = 'button';
        retry.onclick = () => window.WorkforceBoard.open(actor, request, apply);
        byId('job-list').append(retry);
      }
    },
  };
})();
