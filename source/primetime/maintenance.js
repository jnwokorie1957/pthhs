(() => {
  const panel = document.getElementById('maintenanceWorkspace');
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const labels = { in_review: 'In review', needs_attention: 'Needs attention', awaiting_hha_action: 'Awaiting HHA action', office_review_complete: 'Office review complete',
    administrator: 'Administrator', office_staff: 'Office staff queue', supervisor: 'Supervisor queue', office_manager: 'Office manager queue',
    investigate: 'Investigate source evidence', review_existing_calls: 'Review selected actual call events', review_confirmation: 'Review confirmation in HHA' };
  let ready = window.primetimeDataMode?.isActive?.() === true, generation = 0, busy = false, abort = null;
  let day = null, cases = new Map(), cursor = null, selected = null, limit = 40, report = false, downloadUrl = null;
  let sourceRetryAt = 0, cooldownTimer = null;
  const active = () => ready && window.primetimeDataMode?.isLive?.() === true && panel.classList.contains('is-active') && !document.hidden;
  const message = text => { $('maintenanceStatus').textContent = text; };
  const validId = value => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647;
  function el(tag, text = '', className = '') { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
  function button(text, action) { const node = el('button', text, 'btn secondary'); node.type = 'button'; node.addEventListener('click', action); return node; }
  function time(value) { return value || 'Not supplied by HHA'; }
  function checked(ticket) { if (ticket !== generation || !active()) throw new Error('context_changed'); }
  function controls() {
    const remaining = Math.max(0, sourceRetryAt - Date.now());
    for (const node of panel.querySelectorAll('button,input,select,textarea')) {
      const sourceRead = node.dataset.sourceRead === 'true';
      node.disabled = !active() || busy || node.dataset.locked === 'true' || sourceRead && remaining > 0;
      if (sourceRead) node.textContent = remaining ? `Read caregiver calls · wait ${Math.ceil(remaining / 1000)}s` : 'Read caregiver calls';
    }
    if (remaining && active() && cooldownTimer === null) {
      const ticket = generation;
      cooldownTimer = setTimeout(() => { cooldownTimer = null; if (ticket === generation) controls(); }, Math.min(remaining, 1000));
    }
  }
  function revoke() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
  function clear(note = 'Open this workspace with live data enabled to review visits.') {
    generation++; abort?.abort(); abort = null; busy = false; revoke(); day = null; cases.clear(); cursor = null; selected = null; limit = 40;
    if (cooldownTimer !== null) clearTimeout(cooldownTimer); cooldownTimer = null;
    for (const id of ['maintenanceList', 'maintenanceMetrics', 'maintenanceReportRows']) $(id).replaceChildren();
    $('maintenanceDetail').replaceChildren(el('h3', 'Choose a visit'), el('p', 'Open a source visit to inspect times and start an office case.'));
    $('maintenanceReceipt').textContent = ''; $('maintenanceSearch').value = '';
    $('maintenanceMoreCases').hidden = $('maintenanceMoreVisits').hidden = true;
    message(note); controls();
  }
  async function request(path, ticket, body) {
    checked(ticket);
    const response = await window.primetimeApiFetch('/primetime/api' + path, { signal: abort.signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const value = await response.json(); checked(ticket);
    if (!response.ok) {
      const error = new Error(value.error || 'maintenance_unavailable'); error.retry = value.retryAfterSeconds;
      if ([401, 403].includes(response.status)) { clear('Source access was refused. Refresh after checking your session and office permissions.'); }
      throw error;
    }
    if (value.ok !== true) throw new Error('invalid_maintenance_response');
    return value;
  }
  const errors = {
    revision_conflict: 'This case changed or the previous save may have succeeded. Refresh the workspace to retrieve the saved revision before retrying.',
    maintenance_source_stale: 'The background source feed is stale. Wait for its next successful collection, then refresh this workspace before saving.',
    maintenance_source_changed_refresh: 'The source visit was refreshed after you opened it. Refresh this workspace and inspect the latest evidence before saving.',
    maintenance_source_unavailable: 'A current office-checked source visit is required. Refresh the source feed before saving.',
    maintenance_note_required: 'Enter a review note explaining the evidence, proposed action or next staff step.',
    call_selection_not_in_evidence: 'Selected calls no longer match the saved evidence. Read caregiver calls and review your selection again.',
    invalid_call_selection: 'For an existing-call proposal, select at least one actual timed source event. Other proposals must have no selected calls.',
    call_subject_mismatch: 'HHA returned call records with different subjects. These records cannot be displayed or used.',
    office_policy_changed_restart: 'Office settings or release permissions changed. Refresh before continuing.',
    maintenance_history_limit: 'This case has reached its retained event limit. Ask the administrator to review the case history.'
  };
  async function action(task) {
    if (!active() || busy) return;
    const ticket = generation; busy = true; abort = new AbortController(); controls();
    try { await task(ticket); }
    catch (error) { if (ticket === generation) {
      if (Number.isFinite(error.retry) && error.retry > 0) sourceRetryAt = Date.now() + Math.min(error.retry, 3600) * 1000;
      message(errors[error.message] || (error.retry ? `Source requests are paused. Retry after at least ${error.retry} seconds. Office notes and reports remain available.` : 'The request was not confirmed. Refresh before retrying. No HHA change was submitted.'));
    } }
    finally { if (ticket === generation) { busy = false; abort = null; controls(); } }
  }
  function verifyDay(value) {
    if (value.source !== 'hhaexchange' || value.mode !== 'live' || value.scope?.date !== $('maintenanceDate').value || !validId(value.scope.officeId)
      || !Array.isArray(value.items) || value.items.length > 10000 || value.officeDayCache?.kind !== 'scheduled_office_day_api'
      || new Set(value.items.map(row => row.id)).size !== value.items.length
      || value.items.some(row => !validId(row.id) || !['source_unvalidated', 'unavailable'].includes(row.state))) throw new Error('invalid_maintenance_response');
    return value;
  }
  function verifyCase(item) {
    if (!item || !validId(item.visitId) || item.officeId !== day.scope.officeId || item.date !== day.scope.date || !Number.isSafeInteger(item.revision) || item.revision < 1
      || !Object.hasOwn(labels, item.status) || !['in_review', 'needs_attention', 'awaiting_hha_action', 'office_review_complete'].includes(item.status)
      || !['administrator', 'office_staff', 'supervisor', 'office_manager'].includes(item.queue) || item.hhaSubmission !== 'not_submitted'
      || !Array.isArray(item.events) || item.events.length > 150 || item.source?.id !== item.visitId
      || item.calls && (!Array.isArray(item.calls.records) || item.calls.records.length > 200 || item.calls.visitLink !== 'not_supplied_by_source')) throw new Error('invalid_maintenance_response');
    return item;
  }
  function casePage(value) {
    if (value.scope?.officeId !== day.scope.officeId || value.scope?.date !== day.scope.date || value.hhaWritesEnabled !== false || !Array.isArray(value.items) || value.items.length > 100
      || value.nextCursor !== null && (typeof value.nextCursor !== 'string' || value.nextCursor.length > 400)) throw new Error('invalid_maintenance_response');
    const rows = value.items.map(verifyCase);
    for (const row of rows) { const prior = cases.get(row.visitId); if (!prior || prior.revision <= row.revision) cases.set(row.visitId, row); }
    cursor = value.nextCursor;
  }
  async function load(ticket) {
    const date = $('maintenanceDate').value;
    message('Reading the protected office-day feed and saved office cases…');
    const value = await request('/views/office-day?date=' + encodeURIComponent(date), ticket);
    day = verifyDay(value); cases.clear();
    casePage(await request('/maintenance/cases?date=' + encodeURIComponent(date), ticket));
    render(); detail();
    message(`${day.items.length.toLocaleString()} source visits loaded. ${cases.size} saved office cases loaded${cursor ? '; more cases are available' : ''}. Select a visit to review.`);
  }
  const gaps = row => row.state !== 'unavailable' && (!row.evvStart || !row.evvEnd);
  function render() {
    if (!day) return;
    const cache = day.officeDayCache;
    $('maintenanceReceipt').textContent = `Office ${day.scope.officeId} · ${day.scope.date} · Background HHA API feed, checked ${new Date(cache.checkedAt).toLocaleString()}. `
      + `${cache.complete ? 'All returned visit IDs collected.' : 'Collection is partial; counts reflect loaded records.'} ${cache.stale ? 'Feed is stale; saves are blocked.' : ''} `
      + `Source generation started ${cache.startedAt || 'not yet'}; completed ${cache.completedAt || 'pending'}. Times retain source values. Saved office cases are separate from HHA.`;
    const saved = [...cases.values()];
    $('maintenanceMetrics').replaceChildren(...[
      [day.items.length, 'Source visits loaded'], [day.items.filter(gaps).length, 'Missing EVV fields · not a diagnosis'],
      [saved.filter(row => row.status !== 'office_review_complete').length, 'Open office cases loaded'],
      [saved.filter(row => row.status === 'awaiting_hha_action').length, 'Awaiting HHA action · loaded cases']
    ].map(([number, label]) => { const box = el('div', '', 'maintenance-metric'); box.append(el('strong', Number(number).toLocaleString()), el('span', label)); return box; }));
    const search = $('maintenanceSearch').value.trim().toLowerCase(), filter = $('maintenanceFilter').value;
    const rows = day.items.filter(row => {
      const item = cases.get(row.id);
      return (!search || [row.id, row.patientId, row.caregiverId].some(value => value?.toLowerCase().includes(search)))
        && (filter === 'all' || filter === 'gaps' && gaps(row) || filter === 'cases' && item || item?.status === filter);
    });
    $('maintenanceList').replaceChildren(el('p', `${rows.length.toLocaleString()} matching visits · showing ${Math.min(limit, rows.length)}`, 'maintenance-help'));
    for (const row of rows.slice(0, limit)) {
      const item = cases.get(row.id), node = el('button', '', 'maintenance-row'); node.type = 'button'; node.setAttribute('aria-pressed', String(selected === row.id));
      node.append(el('strong', `Visit ${row.id}`), el('small', `Patient ${row.patientId || 'not read'} · Caregiver ${row.caregiverId || 'not read'}`),
        el('small', `${time(row.scheduledStart)} → ${time(row.scheduledEnd)}`),
        el('span', item ? labels[item.status] : row.state === 'unavailable' ? 'Source read failed' : gaps(row) ? 'EVV fields to inspect' : 'Source times returned',
          'maintenance-pill' + (item?.status === 'office_review_complete' ? ' complete' : gaps(row) ? ' attention' : '')));
      node.addEventListener('click', () => { if (!busy) { selected = row.id; render(); detail(); $('maintenanceDetail').scrollIntoView?.({ block: 'start', behavior: 'smooth' }); } });
      $('maintenanceList').append(node);
    }
    if (!rows.length) $('maintenanceList').append(el('p', cache.known ? 'No loaded source visits match these filters.' : 'The source collector has not returned this day yet. Refresh after collection progresses.', 'maintenance-empty'));
    $('maintenanceMoreVisits').hidden = rows.length <= limit; $('maintenanceMoreCases').hidden = !cursor;
    renderReport(); controls();
  }
  function selectField(id, title, values, current) {
    const label = el('label', title), node = el('select'); node.id = id;
    for (const value of values) { const option = el('option', labels[value]); option.value = value; node.append(option); }
    node.value = current; label.append(node); return label;
  }
  function detail() {
    const host = $('maintenanceDetail'), row = day?.items.find(item => item.id === selected), item = cases.get(selected);
    host.replaceChildren();
    if (!row) { host.append(el('h3', 'Choose a visit'), el('p', 'Select a source visit to inspect its evidence and start an office case.')); return; }
    host.append(el('h3', `Visit ${row.id}`), el('p', `Patient ${row.patientId || 'not read'} · Caregiver ${row.caregiverId || 'not read'} · ${day.scope.date}`, 'maintenance-subjects'));
    const times = el('div', '', 'maintenance-times');
    for (const [title, start, end] of [['Scheduled', row.scheduledStart, row.scheduledEnd], ['Actual', row.actualStart, row.actualEnd], ['EVV', row.evvStart, row.evvEnd]]) {
      const box = el('div', '', 'maintenance-time'); box.append(el('h4', title));
      for (const [label, value] of [['Start', start], ['End', end]]) { const p = el('p', time(value)); p.prepend(el('span', label)); box.append(p); }
      times.append(box);
    }
    host.append(times, el('p', `Visit fetched ${row.detailFetchedAt || 'not available'}; office membership checked ${row.officeCheckedAt || 'not available'}. Missing fields do not prove a missed visit.`, 'maintenance-help'));
    if (item && ['patientId', 'caregiverId', 'scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd'].some(key => item.source[key] !== row[key])) {
      host.append(el('p', 'Source facts changed since this office review. Reinspect the current times and call evidence before saving a new proposal. The case history retains earlier receipts.', 'maintenance-boundary'));
    }
    if (row.state === 'unavailable' || !row.patientId || !row.caregiverId) { host.append(el('p', 'This source read did not establish a usable visit context. Refresh the feed before opening an office case.')); return; }
    const callSection = el('div', '', 'maintenance-section'); callSection.append(el('h4', 'Caregiver calls & attempts'), el('p', 'Actual HHA call records for this patient, caregiver and day. The API does not establish their exact visit link or a complete attempt history. Call type and status are shown as source codes; a supported reason-code catalog is still pending.'));
    const callButton = button('Read caregiver calls', () => action(async ticket => {
      message('Checking current visit, patient, office and caregiver before reading actual calls…');
      const value = await request('/maintenance/calls', ticket, { date: day.scope.date, visitId: row.id, revision: cases.get(row.id).revision });
      if (value.hhaWritesEnabled !== false) throw new Error('invalid_maintenance_response');
      cases.set(row.id, verifyCase(value.item)); render(); detail();
      message(`Call evidence saved. ${value.item.calls.records.length} source events returned. Exact visit links and complete attempt history remain unproved.`);
    }));
    callButton.dataset.locked = String(!item); callButton.dataset.sourceRead = 'true'; callSection.append(callButton);
    if (!item) callSection.append(el('p', 'Save an office review below first to retain a private case and its call evidence.'));
    if (item?.calls) {
      callSection.append(el('p', `Call feed fetched ${item.calls.fetchedAt}. ${item.calls.truncated ? 'Partial response.' : 'Bounded response; not complete history.'}`));
      if (!item.calls.records.length) callSection.append(el('p', 'No source events returned in this scoped read. This does not establish that no attempts occurred.'));
      for (const call of item.calls.records) {
        const label = el('label', '', 'maintenance-call'), check = el('input'); check.type = 'checkbox'; check.value = call.CallDashboardID; check.dataset.call = 'true';
        check.checked = item.proposal?.selectedCallIds.includes(call.CallDashboardID) || false;
        check.dataset.locked = String(!call.CallTime || call.CallTime === day.scope.date);
        const copy = el('span', `Call ${call.CallDashboardID} · ${time(call.CallTime)}`); copy.append(el('small', `Source type: ${call.CallType ?? 'not supplied'} · Source status: ${call.CallStatus ?? 'not supplied'}. Visit linkage not established.`));
        label.append(check, copy); callSection.append(label);
      }
    }
    host.append(callSection);
    const form = el('form', '', 'maintenance-section'); form.id = 'maintenanceCaseForm'; form.append(el('h4', item ? `Office case · revision ${item.revision}` : 'Start an office case'));
    const grid = el('div', '', 'maintenance-form-grid');
    grid.append(selectField('maintenanceCaseState', 'Office case status', ['in_review', 'needs_attention', 'awaiting_hha_action', 'office_review_complete'], item?.status || 'in_review'),
      selectField('maintenanceCaseQueue', 'Follow-up queue', ['administrator', 'office_staff', 'supervisor', 'office_manager'], item?.queue || 'administrator'));
    const followLabel = el('label', 'Follow up at · this device time'), follow = el('input'); follow.type = 'datetime-local'; follow.id = 'maintenanceFollowUp';
    if (item?.followUpAt) { const stamp = new Date(item.followUpAt); follow.value = new Date(stamp.getTime() - stamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    followLabel.append(follow); grid.append(followLabel, selectField('maintenanceProposal', 'Proposed next action', ['investigate', 'review_existing_calls', 'review_confirmation'], item?.proposal?.kind || 'investigate')); form.append(grid);
    const noteLabel = el('label', 'Review note, reason and next staff step'), note = el('textarea'); note.id = 'maintenanceNote'; note.required = true; note.maxLength = 2000;
    note.placeholder = 'Describe the evidence, what needs review, and the next step. This note does not submit an HHA reason code.'; noteLabel.append(note); form.append(noteLabel,
      el('p', 'Queues organize work; they do not grant staff account access. “Office review complete” closes this local review only. A selected-call proposal never creates or changes a clock event.', 'maintenance-help'));
    const save = el('button', 'Save office review', 'btn primary'); save.type = 'submit'; save.dataset.locked = String(day.officeDayCache.stale); form.append(save);
    form.addEventListener('submit', event => {
      event.preventDefault(); void action(async ticket => {
        const proposalKind = $('maintenanceProposal').value;
        const selectedCallIds = proposalKind === 'review_existing_calls' ? [...callSection.querySelectorAll('input')].filter(node => node.checked).map(node => node.value) : [];
        const value = await request('/maintenance/save', ticket, { date: day.scope.date, visitId: row.id, sourceReceipt: row.detailFetchedAt, revision: cases.get(row.id)?.revision || 0,
          status: $('maintenanceCaseState').value, queue: $('maintenanceCaseQueue').value, followUpAt: follow.value ? new Date(follow.value).toISOString() : null,
          note: note.value, proposalKind, selectedCallIds });
        if (value.hhaWritesEnabled !== false) throw new Error('invalid_maintenance_response');
        cases.set(row.id, verifyCase(value.item)); render(); detail(); message('Office review saved with its source receipt and audit history. No HHA confirmation or clock change was submitted.');
      });
    });
    host.append(form);
    if (item) {
      const history = el('details', '', 'maintenance-section'); history.append(el('summary', `Case history · ${item.events.length} events`)); const list = el('ol', '', 'maintenance-history');
      for (const event of [...item.events].reverse()) list.append(el('li', `${new Date(event.at).toLocaleString()} · ${event.actor} · ${event.action.replaceAll('_', ' ')} · ${labels[event.status]} · ${labels[event.queue]}. ${event.note}`));
      history.append(list); host.append(history);
    }
    controls();
  }
  function reportText() {
    const rows = [...cases.values()];
    return ['PRIMETIME OFFICE MAINTENANCE REPORT', `Office ${day.scope.officeId} | Service day ${day.scope.date} | Generated ${new Date().toISOString()}`,
      `${rows.length} loaded cases. ${cursor ? 'Additional case pages remain; report is partial.' : 'All case pages requested in this session have been loaded; cases may change concurrently.'}`,
      'HHA changes submitted by this workspace: 0. Office reviews and proposals are not HHA confirmations.', '', ...rows.flatMap(item => [
        `Visit ${item.visitId} | Patient ${item.source.patientId} | Caregiver ${item.source.caregiverId}`,
        `${labels[item.status]} | ${labels[item.queue]} | Follow-up ${item.followUpAt || 'not set'} | Revision ${item.revision}`,
        `Next action: ${labels[item.proposal?.kind] || 'Review refreshed evidence'} | Selected source calls: ${item.proposal?.selectedCallIds.join(', ') || 'none'}`,
        `Latest note: ${item.events.at(-1)?.note || 'none'}`, `Source visit fetched: ${item.source.detailFetchedAt}; office checked: ${item.source.officeCheckedAt}`,
        `Calls fetched: ${item.calls?.fetchedAt || 'not read'}; exact visit linkage not established.`, ''])].join('\n');
  }
  function renderReport() {
    const host = $('maintenanceReportRows'); host.replaceChildren();
    host.append(el('p', `${cases.size} loaded cases. ${cursor ? 'More case pages remain; this report is partial.' : 'All requested case pages are loaded. Cases can change concurrently.'}`, 'maintenance-help'));
    if (!cases.size) host.append(el('p', 'Save an office review from the visit queue to include it in the staff report.', 'maintenance-empty'));
    for (const item of cases.values()) {
      const box = el('div', '', 'maintenance-report-card'); box.append(el('strong', `Visit ${item.visitId} · ${labels[item.status]}`),
        el('p', `${labels[item.queue]} · Follow-up ${item.followUpAt ? new Date(item.followUpAt).toLocaleString() : 'not set'}`),
        el('p', item.events.at(-1)?.note || ''), el('p', `Proposed action: ${labels[item.proposal?.kind] || 'Review refreshed call evidence'}. HHA submission: not submitted.`));
      box.append(button('Open office case', () => { selected = item.visitId; report = false; showTab(); render(); detail(); })); host.append(box);
    }
  }
  function showTab() { $('maintenanceQueue').hidden = report; $('maintenanceReport').hidden = !report; $('maintenanceQueueTab').setAttribute('aria-pressed', String(!report)); $('maintenanceReportTab').setAttribute('aria-pressed', String(report)); }
  function restart() { clear(); if (active()) void action(load); }
  $('maintenanceDate').value = $('dashboardOverviewDate')?.value || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  $('maintenanceDate').addEventListener('change', restart);
  $('maintenanceRefresh').addEventListener('click', restart);
  for (const id of ['maintenanceSearch', 'maintenanceFilter']) $(id).addEventListener(id.endsWith('Search') ? 'input' : 'change', () => { limit = 40; render(); });
  $('maintenanceMoreVisits').addEventListener('click', () => { limit += 40; render(); });
  $('maintenanceMoreCases').addEventListener('click', () => action(async ticket => {
    casePage(await request('/maintenance/cases?date=' + encodeURIComponent(day.scope.date) + '&cursor=' + encodeURIComponent(cursor), ticket)); render(); detail(); message(`${cases.size} saved office cases loaded${cursor ? '; more pages remain' : ''}.`);
  }));
  $('maintenanceQueueTab').addEventListener('click', () => { report = false; showTab(); });
  $('maintenanceReportTab').addEventListener('click', () => { report = true; showTab(); renderReport(); });
  $('maintenanceExport').addEventListener('click', () => {
    if (!active() || !day || busy) return; revoke(); downloadUrl = URL.createObjectURL(new Blob([reportText()], { type: 'text/plain;charset=utf-8' }));
    const link = el('a'); link.href = downloadUrl; link.download = `primetime-office-maintenance-${day.scope.date}.txt`; document.body.append(link); link.click(); link.remove();
    message('Private staff report downloaded. It describes office reviews and unsubmitted proposals.');
  });
  document.addEventListener('primetime-ready', () => { ready = true; restart(); });
  document.addEventListener('primetime-signed-out', () => { ready = false; clear('Sign in to open visit maintenance.'); });
  document.addEventListener('primetime-data-mode-changed', restart);
  // This workspace owns its date and server-checked office context. Preview page
  // refreshes must not discard its draft; its own session/mode/date events do.
  document.addEventListener('primetime-view-changed', event => { if (event.detail?.view === 'maintenance') restart(); else clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear('Workspace paused while this tab is hidden. Refresh to resume.'); else if (active()) restart(); });
  controls();
})();
