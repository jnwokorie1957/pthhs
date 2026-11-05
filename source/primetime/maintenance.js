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
  let searchMode = null, selectionTicket = 0, caseKnown = new Set(), reasonPermission = null, casePageComplete = false;
  const serviceDate = row => row?.serviceDate || day?.scope.date;
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
      if(node.dataset.searchOwner==='true')continue;
      const sourceRead = node.dataset.sourceRead === 'true';
      const browse = node.dataset.browse === 'true' || node.classList?.contains('maintenance-row') || node.classList?.contains('maintenance-metric') || node.id === 'maintenanceRefresh';
      node.disabled = !active() || busy && !browse || node.dataset.locked === 'true' || sourceRead && remaining > 0;
      if (sourceRead) node.textContent = (node.dataset.sourceLabel || 'Read caregiver calls') + (remaining ? ` · wait ${Math.ceil(remaining / 1000)}s` : '');
    }
    if (remaining && active() && cooldownTimer === null) {
      const ticket = generation;
      cooldownTimer = setTimeout(() => { cooldownTimer = null; if (ticket === generation) controls(); }, Math.min(remaining, 1000));
    }
  }
  function revoke() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
  function clear(note = 'Open this workspace with live data enabled to review visits.') {
    generation++; abort?.abort(); abort = null; busy = false; revoke(); day = null; cases.clear(); cursor = null; selected = null; limit = 40;
    searchMode = null; casePageComplete = false; selectionTicket++; caseKnown.clear(); $('maintenanceQueue').classList.remove('has-selection');
    if (cooldownTimer !== null) clearTimeout(cooldownTimer); cooldownTimer = null;
    for (const id of ['maintenanceList', 'maintenanceMetrics', 'maintenanceReportRows']) $(id).replaceChildren();
    $('maintenanceDetail').replaceChildren(el('h3', 'Choose a visit'), el('p', 'Open a source visit to inspect times and start an office case.'));
    $('maintenanceReceipt').textContent = ''; $('maintenanceSearch').value = '';
    $('maintenanceMoreCases').hidden = $('maintenanceMoreVisits').hidden = true;
    message(note); controls();
  }
  async function request(path, ticket, body) {
    checked(ticket);
    const signal = abort?.signal; let expired = false, timer;
    const task = async () => {
    const response = await window.primetimeApiFetch('/primetime/api' + path, { signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const value = await response.json(); if (expired) throw new Error('request_timed_out'); checked(ticket);
    if (!response.ok) {
      const error = new Error(value.error || 'maintenance_unavailable'); error.retry = value.retryAfterSeconds;
      if ([401, 403].includes(response.status)) { clear('Source access was refused. Refresh after checking your session and office permissions.'); }
      throw error;
    }
    if (value.ok !== true) throw new Error('invalid_maintenance_response');
    return value;
    };
    try { return await Promise.race([task(), new Promise((resolve, reject) => { timer = setTimeout(() => { expired = true; reject(new Error('request_timed_out')); }, path.startsWith('/views/office-day') ? 20000 : 45000); })]); }
    finally { clearTimeout(timer); }
  }
  const errors = {
    request_timed_out: 'The read did not finish in time. Loaded visits remain selectable. Refresh to retry; for a save, retrieve the latest case before retrying.',
    read_not_owner_enabled: 'This HHA read has not been enabled for the office yet. Existing visit reviews remain available.',
    reason_selection_not_in_fresh_source: 'Reload the HHA reason/action choices and select both again before staging this review.',
    select_reason_and_action: 'Select both a source reason and its matching action, or leave both empty.',
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
    if (!item || !validId(item.visitId) || item.officeId !== day.scope.officeId || (searchMode ? item.date < searchMode.from || item.date > searchMode.to : item.date !== day.scope.date) || !Number.isSafeInteger(item.revision) || item.revision < 1
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
    casePageComplete = cursor === null;
  }
  async function load(ticket) {
    const date = $('maintenanceDate').value;
    message('Reading the protected office-day feed and saved office cases…');
    const value = await request('/views/office-day?date=' + encodeURIComponent(date), ticket);
    day = verifyDay(value); cases.clear();
    render();
    casePage(await request('/maintenance/cases?date=' + encodeURIComponent(date), ticket));
    render(); detail();
    message(`${day.items.length.toLocaleString()} source visits loaded. ${cases.size} saved office cases loaded${cursor ? '; more cases are available' : ''}. Select a visit to review.`);
  }
  const gaps = row => row.state !== 'unavailable' && (!row.evvStart || !row.evvEnd);
  function render() {
    if (!day) return;
    const cache = searchMode ? { known: true, complete: searchMode.complete, stale: false, checkedAt: searchMode.checkedAt, startedAt: searchMode.fetchedAt, completedAt: searchMode.complete ? searchMode.checkedAt : null } : day.officeDayCache;
    $('maintenanceReceipt').textContent = searchMode ? `Office ${day.scope.officeId} · ${searchMode.from} through ${searchMode.to} · Direct HHA API search. ${searchMode.checkedThrough} of ${searchMode.totalIds} returned IDs checked; ${day.items.length} matching readable visits loaded. ${searchMode.complete ? 'Source pages checked.' : 'More source reads remain.'} ${searchMode.truncated ? 'HHA discovery was truncated; narrow the search.' : ''} ${searchMode.unknownPayers ? `${searchMode.unknownPayers} visits had no bill-to contract evidence.` : ''} Source fetched ${searchMode.fetchedAt}.` : `Office ${day.scope.officeId} · ${day.scope.date} · Background HHA API feed, checked ${new Date(cache.checkedAt).toLocaleString()}. `
      + `${cache.complete ? 'All returned visit IDs collected.' : 'Collection is partial; counts reflect loaded records.'} ${cache.stale ? 'Feed is stale; saves are blocked.' : ''} `
      + `Source generation started ${cache.startedAt || 'not yet'}; completed ${cache.completedAt || 'pending'}. Times retain source values. Saved office cases are separate from HHA.`;
    const saved = [...cases.values()];
    $('maintenanceMetrics').replaceChildren(...[
      [day.items.length, 'Source visits loaded'], [day.items.filter(gaps).length, 'Missing EVV fields · not a diagnosis'],
      [saved.filter(row => row.status !== 'office_review_complete').length, 'Open office cases loaded'],
      [saved.filter(row => row.status === 'awaiting_hha_action').length, 'Awaiting HHA action · loaded cases']
    ].map(([number, label], index) => { const box = el('button', '', 'maintenance-metric'); box.type = 'button';box.setAttribute('aria-pressed',String($('maintenanceFilter').value===['all','gaps','cases','awaiting_hha_action'][index])); box.append(el('strong', Number(number).toLocaleString()), el('span', label)); box.addEventListener('click', () => { $('maintenanceFilter').value = ['all','gaps','cases','awaiting_hha_action'][index]; report = false; showTab(); render(); $('maintenanceList').scrollIntoView?.({block:'start'}); }); return box; }));
    const search = $('maintenanceSearch').value.trim().toLowerCase(), filter = $('maintenanceFilter').value;
    const filterSummary=$('maintenanceLoadedFilters')?.querySelector?.('summary');if(filterSummary)filterSummary.textContent='Filter loaded visits'+(filter==='all'&&!search?'':' · active');
    const rows = day.items.filter(row => {
      const item = cases.get(row.id);
      return (!search || [row.id, row.patientId, row.caregiverId].some(value => value?.toLowerCase().includes(search)))
        && (filter === 'all' || filter === 'gaps' && gaps(row) || filter === 'cases' && item || item?.status === filter);
    });
    $('maintenanceList').replaceChildren(el('p', `${rows.length.toLocaleString()} matching visits · showing ${Math.min(limit, rows.length)}`, 'maintenance-help'));
    for (const row of rows.slice(0, limit)) {
      const item = cases.get(row.id), node = el('button', '', 'maintenance-row'); node.type = 'button'; node.setAttribute('aria-pressed', String(selected === row.id));
      const person = (last, first, id) => last || first ? `${last || ''}${last && first ? ', ' : ''}${first || ''} · ${id}` : id || 'not read';
      node.append(el('strong', `${serviceDate(row)} · Visit ${row.id}`), el('small', `Patient: ${person(row.patientLastName,row.patientFirstName,row.patientId)} · Caregiver: ${person(row.caregiverLastName,row.caregiverFirstName,row.caregiverId)}`),
        el('small', `${time(row.scheduledStart)} → ${time(row.scheduledEnd)}`),
        el('span', item ? labels[item.status] : row.state === 'unavailable' ? 'Source read failed' : gaps(row) ? 'EVV fields to inspect' : 'Source times returned',
          'maintenance-pill' + (item?.status === 'office_review_complete' ? ' complete' : gaps(row) ? ' attention' : '')), el('small','Open visit →'));
      node.addEventListener('click', () => { void openVisit(row); });
      $('maintenanceList').append(node);
    }
    if (!rows.length) $('maintenanceList').append(el('p', searchMode&&searchMode.checkedThrough<searchMode.totalIds ? 'No readable matches yet. Continue source search to check the remaining visit IDs.' : cache.known ? 'No loaded source visits match these filters.' : 'The source collector has not returned this day yet. Refresh after collection progresses.', 'maintenance-empty'));
    $('maintenanceMoreVisits').hidden = rows.length <= limit; $('maintenanceMoreCases').hidden = !cursor;
    renderReport(); controls();
  }
  async function openVisit(row) {
    selected = row.id; const ticket = generation, chosen = ++selectionTicket; $('maintenanceQueue').classList.add('has-selection');
    render(); detail(); $('maintenanceDetail').scrollIntoView?.({ block: 'start' });
    if (caseKnown.has(row.id)) return;
    try {
      const value = await request('/maintenance/case', ticket, { date: serviceDate(row), visitId: row.id });
      if (chosen !== selectionTicket) return;
      if (value.item) { if (value.item.visitId !== row.id || value.item.date !== serviceDate(row)) throw new Error('invalid_maintenance_response'); cases.set(row.id, verifyCase(value.item)); } else cases.delete(row.id);
      caseKnown.add(row.id); render(); detail();
    } catch (error) { if (ticket === generation && chosen === selectionTicket) message(errors[error.message] || 'This case could not be loaded. Refresh before saving.'); }
  }
  function selectField(id, title, values, current) {
    const label = el('label', title), node = el('select'); node.id = id;
    for (const value of values) { const option = el('option', labels[value]); option.value = value; node.append(option); }
    node.value = current; label.append(node); return label;
  }
  function detail() {
    const host = $('maintenanceDetail'), row = day?.items.find(item => item.id === selected), item = cases.get(selected);
    const expanded=new Set(host.dataset.visit===selected?[...host.querySelectorAll('details')].filter(node=>node.open).map(node=>node.dataset.section):[]);
    host.replaceChildren();
    host.dataset.visit=row?.id||'';
    const section=(key,title)=>{const node=el('details','','maintenance-section');node.dataset.section=key;node.open=expanded.has(key);node.append(el('summary',title));return node;};
    if (!row) { host.append(el('h3', 'Choose a visit'), el('p', 'Select a source visit to inspect its evidence and start an office case.')); return; }
    const back = button('← Back to visit queue', () => { selected = null; selectionTicket++; $('maintenanceQueue').classList.remove('has-selection'); render(); detail(); $('maintenanceList').scrollIntoView?.({block:'start'}); }); back.dataset.browse = 'true';
    host.append(back, el('h3', `Visit ${row.id}`), el('p', `Patient ${[row.patientLastName,row.patientFirstName].filter(Boolean).join(', ') || row.patientId || 'not read'} · Caregiver ${[row.caregiverLastName,row.caregiverFirstName].filter(Boolean).join(', ') || row.caregiverId || 'not read'} · ${serviceDate(row)}`, 'maintenance-subjects'));
    const relatedSearch=el('div','','maintenance-actions');
    if(row.patientId)relatedSearch.append(button("Use this patient in range search",()=>document.dispatchEvent(new CustomEvent('primetime-maintenance-select-person',{detail:{kind:'patient',id:row.patientId,firstName:row.patientFirstName,lastName:row.patientLastName,code:row.admissionId}}))));
    if(row.caregiverId)relatedSearch.append(button("Use this caregiver in range search",()=>document.dispatchEvent(new CustomEvent('primetime-maintenance-select-person',{detail:{kind:'caregiver',id:row.caregiverId,firstName:row.caregiverFirstName,lastName:row.caregiverLastName,code:row.caregiverCode}}))));
    host.append(relatedSearch);
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
    if (row.state === 'unavailable' || !row.patientId) { host.append(el('p', 'This source read did not establish a usable visit context. Refresh the feed before opening an office case.')); return; }
    const callSection = section('calls','Caregiver calls & attempts'); callSection.append(el('p', 'Actual HHA call records for this patient, caregiver and day. Exact visit links, complete history and the meaning of source type/status values remain unverified.'));
    async function ensureCase(ticket) {
      if (!caseKnown.has(row.id)) throw new Error('case_not_loaded');
      if (cases.has(row.id)) return;
      const value = await request('/maintenance/save', ticket, { date: serviceDate(row), visitId: row.id, sourceReceipt: row.detailFetchedAt, revision: 0, status: 'in_review', queue: 'administrator', followUpAt: null, note: 'Office source inspection requested. No visit issue determined and no HHA change submitted.', proposalKind: 'investigate', selectedCallIds: [] });
      cases.set(row.id, verifyCase(value.item)); render(); detail();
    }
    const callButton = button('Read caregiver calls', () => action(async ticket => {
      await ensureCase(ticket);
      message('Checking current visit, patient, office and caregiver before reading actual calls…');
      const value = await request('/maintenance/calls', ticket, { date: serviceDate(row), visitId: row.id, revision: cases.get(row.id).revision });
      if (value.hhaWritesEnabled !== false) throw new Error('invalid_maintenance_response');
      cases.set(row.id, verifyCase(value.item)); render(); detail();
      message(`Call evidence saved. ${value.item.calls.records.length} source events returned. Exact visit links and complete attempt history remain unproved.`);
    }));
    callButton.dataset.locked = String(!caseKnown.has(row.id) || !row.caregiverId); callButton.dataset.sourceRead = 'true'; callSection.append(callButton);
    if (!row.caregiverId) callSection.append(el('p', 'The source visit has no caregiver ID. Office follow-up is available; call inspection requires a source caregiver.'));
    if (!item) callSection.append(el('p', 'Reading calls starts an office review and retains its source evidence. It does not confirm a visit.'));
    if (item?.calls) {
      callSection.append(el('p', `Call feed fetched ${item.calls.fetchedAt}. ${item.calls.truncated ? 'Partial response.' : 'Bounded response; not complete history.'}`));
      if (!item.calls.records.length) callSection.append(el('p', 'No source events returned in this scoped read. This does not establish that no attempts occurred.'));
      for (const call of item.calls.records) {
        const label = el('label', '', 'maintenance-call'), check = el('input'); check.type = 'checkbox'; check.value = call.CallDashboardID; check.dataset.call = 'true';
        check.checked = item.proposal?.selectedCallIds.includes(call.CallDashboardID) || false;
        check.dataset.locked = String(!call.CallTime || call.CallTime === serviceDate(row));
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
    const reasonSection = el('div', '', 'maintenance-section'); reasonSection.append(el('h4','HHA reason, action taken & note'), el('p','Read the visit-scoped HHA choices, then stage a review. This does not submit or confirm the visit. Source status codes remain unvalidated.'));
    const readReasons = button('Load HHA reason / action codes', () => action(async ticket => {
      await ensureCase(ticket);
      const value = await request('/maintenance/reasons',ticket,{date:serviceDate(row),visitId:row.id,revision:cases.get(row.id).revision});
      cases.set(row.id,verifyCase(value.item)); render(); detail(); message(value.item.reasonCatalog?.reasons.length ? 'HHA reason/action choices retained for this visit. Select a matching pair and enter your note to stage the review. No HHA submission occurred.' : 'HHA returned no reason/action choices for this visit. No source code can be staged from this response.');
    }));
    readReasons.dataset.sourceRead = 'true'; readReasons.dataset.sourceLabel = 'Load HHA reason / action codes'; readReasons.dataset.locked = String(!caseKnown.has(row.id)||reasonPermission===false); reasonSection.append(readReasons);
    if(reasonPermission===false)reasonSection.append(el('p','The scoped reason/action read awaits the office permission. Other visit reviews remain available.'));
    const catalog = item?.reasonCatalog;
    if (catalog) {
      reasonSection.append(el('p',`Reason source fetched ${catalog.fetchedAt}. ${catalog.truncated ? 'Partial catalog returned.' : 'Source-returned choices.'}`));
      if(!catalog.reasons.length)reasonSection.append(el('p','HHA returned no reason/action choices for this visit. Keep the review note; use HHA for the source action until the applicable catalog and confirmation contract are available.','maintenance-empty'));
      const reasonLabel = el('label','Visit edit reason'), reason = el('select'); reason.id='maintenanceReason';
      const placeholder=el('option','Select source reason'); placeholder.value=''; reason.append(placeholder);
      for (const choice of catalog.reasons) { const opt=el('option',`${choice.id} · ${choice.name || 'No description'} · ${choice.status || 'status not supplied'}`); opt.value=choice.id; reason.append(opt); }
      reasonLabel.append(reason);
      const actionLabel=el('label','Action taken'), taken=el('select'); taken.id='maintenanceReasonAction'; actionLabel.append(taken);
      const updateActions=()=>{taken.replaceChildren(); const placeholder=el('option','Select matching source action'); placeholder.value=''; taken.append(placeholder); const chosen=catalog.reasons.find(choice=>choice.id===reason.value); for(const option of chosen?.actions || []){const opt=el('option',`${option.id} · ${option.name || 'No description'} · ${option.status || 'status not supplied'}`);opt.value=option.id;taken.append(opt);}};
      reason.value=item?.proposal?.reasonId || ''; updateActions(); taken.value=item?.proposal?.actionId || ''; reason.addEventListener('change',updateActions);
      const reasonGrid=el('div','','maintenance-form-grid');reasonGrid.append(reasonLabel,actionLabel);reasonSection.append(reasonGrid);
      if(!catalog.reasons.length)reasonSection.append(el('p','HHA returned no reason/action choices for this scoped request. No code is invented.'));
    }
    form.append(reasonSection);
    const submitHha=button('Submit to HHA — source action contract required',()=>{});submitHha.dataset.locked='true';form.append(el('p','HHA verification/confirmation submission remains unavailable until the supported source action and independent readback are established. Staging this review does not confirm the visit.','maintenance-help'),submitHha);
    const noteLabel = el('label', 'Review note, reason and next staff step'), note = el('textarea'); note.id = 'maintenanceNote'; note.required = true; note.maxLength = 2000;
    note.placeholder = 'Describe the evidence, what needs review, and the next step. This note does not submit an HHA reason code.'; noteLabel.append(note); form.append(noteLabel,
      el('p', 'Queues organize work; they do not grant staff account access. “Office review complete” closes this local review only. A selected-call proposal never creates or changes a clock event.', 'maintenance-help'));
    const save = el('button', 'Save office review', 'btn primary'); save.type = 'submit'; save.dataset.locked = String(!caseKnown.has(row.id) || !searchMode && day.officeDayCache.stale); form.append(save);
    form.addEventListener('submit', event => {
      event.preventDefault(); void action(async ticket => {
        const proposalKind = $('maintenanceProposal').value;
        const selectedCallIds = proposalKind === 'review_existing_calls' ? [...callSection.querySelectorAll('input')].filter(node => node.checked).map(node => node.value) : [];
        const value = await request('/maintenance/save', ticket, { date: serviceDate(row), visitId: row.id, sourceReceipt: row.detailFetchedAt, revision: cases.get(row.id)?.revision || 0,
          status: $('maintenanceCaseState').value, queue: $('maintenanceCaseQueue').value, followUpAt: follow.value ? new Date(follow.value).toISOString() : null,
          note: note.value, proposalKind, selectedCallIds, reasonId:$('maintenanceReason')?.value || null, actionId:$('maintenanceReasonAction')?.value || null });
        if (value.hhaWritesEnabled !== false) throw new Error('invalid_maintenance_response');
        cases.set(row.id, verifyCase(value.item)); render(); detail(); message('Office review saved with its source receipt and audit history. No HHA confirmation or clock change was submitted.');
      });
    });
    const review=section('review','Office review & next action');review.append(form);host.append(review);
    if (item) {
      const history = el('details', '', 'maintenance-section'); history.append(el('summary', `Case history · ${item.events.length} events`)); const list = el('ol', '', 'maintenance-history');
      for (const event of [...item.events].reverse()) list.append(el('li', `${new Date(event.at).toLocaleString()} · ${event.actor} · ${event.action.replaceAll('_', ' ')} · ${labels[event.status]} · ${labels[event.queue]}. ${event.note}`));
      history.append(list); host.append(history);
    }
    controls();
  }
  function reportText() {
    const rows = [...cases.values()];
    return ['PRIMETIME OFFICE MAINTENANCE REPORT', `Office ${day.scope.officeId} | Service dates ${searchMode ? `${searchMode.from} through ${searchMode.to}` : day.scope.date} | Generated ${new Date().toISOString()}`,
      ...(searchMode?['Range reports cover cases opened/loaded in this workspace session; they are not a complete office case census.']:[]),
      `${rows.length} loaded cases. ${casePageComplete && !searchMode ? 'All requested case pages are loaded; cases may change concurrently.' : 'Case list incomplete; report covers loaded/opened cases only.'}`,
      'HHA changes submitted by this workspace: 0. Office reviews and proposals are not HHA confirmations.', '', ...rows.flatMap(item => [
        `Visit ${item.visitId} | Service date ${item.date} | Patient ${item.source.patientId} | Caregiver ${item.source.caregiverId}`,
        `${labels[item.status]} | ${labels[item.queue]} | Follow-up ${item.followUpAt || 'not set'} | Revision ${item.revision}`,
        `Next action: ${labels[item.proposal?.kind] || 'Review refreshed evidence'} | Selected source calls: ${item.proposal?.selectedCallIds.join(', ') || 'none'}`,
        `Reason / action staged: ${item.proposal?.reasonId || 'none'} / ${item.proposal?.actionId || 'none'}`,
        `Latest note: ${item.events.at(-1)?.note || 'none'}`, `Source visit fetched: ${item.source.detailFetchedAt}; office checked: ${item.source.officeCheckedAt}`,
        `Calls fetched: ${item.calls?.fetchedAt || 'not read'}; exact visit linkage not established.`, ''])].join('\n');
  }
  function renderReport() {
    const host = $('maintenanceReportRows'); host.replaceChildren();
    host.append(el('p', `${cases.size} loaded cases. ${casePageComplete && !searchMode ? 'All requested case pages are loaded. Cases can change concurrently.' : 'Case list incomplete; report covers loaded/opened cases only.'}`, 'maintenance-help'));
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
  $('maintenanceDate').addEventListener('change', () => clear('Service dates changed. Choose Search HHA visits to read the selected range.'));
  $('maintenanceRefresh').addEventListener('click', () => { const detail = {handled:false}; document.dispatchEvent(new CustomEvent('primetime-maintenance-refresh',{detail})); if(!detail.handled)restart(); });
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
  document.addEventListener('primetime-maintenance-search-started',()=>clear('Searching HHA for the selected date range…'));
  document.addEventListener('primetime-maintenance-results',event=>{
    if(!active())return;
    const value=event.detail, from=$('maintenanceDate').value, to=$('maintenanceDateTo').value;
    if(value?.ok!==true||value.source!=='hhaexchange'||value.mode!=='live'||value.scope?.from!==from||value.scope?.to!==to||!validId(value.scope.officeId)||!Array.isArray(value.items)||value.items.some(row=>!validId(row.id)||typeof row.serviceDate!=='string'||row.serviceDate<from||row.serviceDate>to)) {message('Search response could not be verified. Search again.');return;}
    const previous=searchMode&&day?.scope.officeId===value.scope.officeId?day.items:[];
    const combined=new Map(previous.map(row=>[row.id,row]));for(const row of value.items)combined.set(row.id,row);
    searchMode={...value.scope,...value,unknownPayers:(searchMode?.unknownPayers||0)+value.unknownPayers,unavailableCount:(searchMode?.unavailableCount||0)+value.unavailable.length,unavailableCodes:[...new Set([...(searchMode?.unavailableCodes||[]),...value.unavailable.map(row=>row.error)])].slice(0,10)};
    searchMode.complete=value.complete&&searchMode.unknownPayers===0&&searchMode.unavailableCount===0;
    day={scope:{officeId:value.scope.officeId,date:from},items:[...combined.values()]};
    render(); detail(); message(`${day.items.length} matching readable source visits loaded. ${value.checkedThrough} of ${value.totalIds} source IDs checked.${value.nextCursor?' Continue source search for remaining visits.':''}${searchMode.unavailableCount?` ${searchMode.unavailableCount} source detail reads were unavailable (${searchMode.unavailableCodes.join(', ')}).`:''}`);
  });
  document.addEventListener('primetime-maintenance-search-error',event=>message(event.detail||'HHA search did not finish. Loaded visits remain available.'));
  document.addEventListener('primetime-maintenance-capabilities',event=>{if(day&&event.detail?.officeId!==day.scope.officeId){clear('Office context changed. Refresh to load its source data.');return;}const draft=$('maintenanceNote')?.value;reasonPermission=event.detail?.enabledReads?.includes('GetVisitEditReasonActionTaken')===true;if(day){detail();if(typeof draft==='string'&&$('maintenanceNote'))$('maintenanceNote').value=draft;}});
  document.addEventListener('primetime-signed-out', () => { ready = false; clear('Sign in to open visit maintenance.'); });
  document.addEventListener('primetime-data-mode-changed', restart);
  // This workspace owns its date and server-checked office context. Preview page
  // refreshes must not discard its draft; its own session/mode/date events do.
  document.addEventListener('primetime-view-changed', event => { if (event.detail?.view === 'maintenance') restart(); else clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear('Workspace paused while this tab is hidden. Refresh to resume.'); else if (active()) restart(); });
  controls();
})();
