(() => {
  'use strict';
  function filterExceptions(items, term = '', priority = 'all') {
    const search = term.trim().toLowerCase();
    return items.filter(item => (!search || `${item.id} ${item.issue}`.toLowerCase().includes(search)) && (priority === 'all' || item.priority === priority));
  }
  function normalizeVisitPreview(payload, expected) {
    const live = expected.mode === 'live';
    if (!payload || payload.ok !== true || payload.mode !== expected.mode || !Array.isArray(payload.items) || payload.items.length > 10
      || payload.scope?.date !== expected.date || (expected.officeId && payload.scope.officeId !== expected.officeId)
      || (live && (payload.source !== 'hhaexchange' || payload.validation !== 'source_unvalidated' || payload.totals !== null))
      || (!live && (payload.source !== 'synthetic' || payload.validation !== 'synthetic'))
      || !['ready', 'empty', 'partial'].includes(payload.state)) throw new Error('invalid_visit_preview');
    const value = field => typeof field === 'string' && field !== '' ? field : null;
    const items = payload.items.map(item => {
      if (!item || typeof item.id !== 'string' || (live ? !/^[1-9]\d{0,9}$/.test(item.id) : !item.id.startsWith('DEMO-'))
        || (live && !['source_unvalidated', 'unavailable'].includes(item.state))) throw new Error('invalid_visit_preview');
      return Object.fromEntries(['id', 'patientId', 'caregiverId', 'scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd', 'state'].map(key => [key, value(item[key])]));
    });
    return { mode: expected.mode, state: payload.state, scope: payload.scope, fetchedAt: value(payload.fetchedAt), items,
      nextCursor: typeof payload.nextCursor === 'string' && payload.nextCursor ? payload.nextCursor : null,
      truncated: payload.completeness?.truncated === true, totals: null };
  }
  window.primetimeDashboardModel = Object.freeze({ filterExceptions, normalizeVisitPreview });
  if (typeof document === 'undefined') return;
  const controller = window.primetimeDataMode;
  const fixtures = window.primetimeDemoData;
  if (!controller || !fixtures) return;
  const get = id => document.getElementById(id);
  const hosts = ['dashboardOverviewMetrics', 'dashboardOverviewExceptions', 'dashboardCoverage', 'dashboardAlerts',
    'dashboardExceptions', 'dashboardVisitMetrics', 'dashboardVisitRows', 'dashboardMessages', 'dashboardStaffing',
    'dashboardBillingMetrics', 'dashboardBillingPipeline', 'dashboardAudit', 'dashboardSettings'];
  const dateInput = get('dashboardVisitDate');
  let ready = false;
  let session = 0;
  let serial = 0;
  let abort;
  let metadata = null;
  let nextCursor = null;
  let demoOffset = 0;
  let dateChosen = false;
  const localDay = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  if (dateInput) dateInput.value = localDay();
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }
  function text(id, value) { const element = get(id); if (element) element.textContent = value; }
  function replace(id, ...children) { get(id)?.replaceChildren(...children); }
  function unavailable(id, title, detail) {
    const box = node('div', null, 'dashboard-unavailable');
    box.append(node('strong', title), node('p', detail));
    replace(id, box);
  }
  function metrics(id, entries, demo) {
    replace(id, ...entries.map(([label, value, detail]) => {
      const card = node('article', null, 'metric-card');
      card.append(node('span', label));
      if (demo) card.append(node('strong', value), node('small', detail || 'Synthetic example'));
      else card.append(node('p', 'Unavailable', 'metric-unavailable'), node('small', 'Source and policy validation pending'));
      return card;
    }));
  }
  function table(headers, rows, id) {
    const wrap = node('div', null, 'table-wrap');
    const element = node('table');
    if (id) element.id = id;
    const head = node('thead'); const heading = node('tr');
    headers.forEach(header => heading.append(node('th', header)));
    head.append(heading); element.append(head);
    const body = node('tbody');
    for (const values of rows) {
      const row = node('tr');
      values.forEach(value => row.append(node('td', value === null || value === undefined || value === '' ? 'Unavailable' : value)));
      body.append(row);
    }
    if (!rows.length) { const row = node('tr'); const cell = node('td', 'No records in this preview.'); cell.colSpan = headers.length; row.append(cell); body.append(row); }
    element.append(body); wrap.append(element); return wrap;
  }
  const hours = minutes => (minutes / 60).toFixed(1) + 'h';
  function renderExceptions() {
    if (controller.isLive()) return;
    const model = fixtures.dashboard(dateInput?.value || localDay());
    const rows = filterExceptions(model.exceptions, get('exceptionSearch')?.value, get('priorityFilter')?.value);
    replace('dashboardExceptions', table(['Visit', 'Example exception', 'Scheduled start', 'Scheduled end', 'Example visibility', 'Example priority'],
      rows.map(item => [item.id, item.issue, item.scheduledStart, item.scheduledEnd, item.visibility, item.priority]), 'exceptionTable'));
  }
  function clearSource() {
    serial += 1;
    abort?.abort();
    abort = null;
    metadata = null;
    nextCursor = null;
    demoOffset = 0;
    hosts.forEach(id => replace(id));
    text('dashboardVisitStatus', 'Live visit preview unavailable until source access is checked.');
    text('dashboardVisitMetadata', '');
    text('dashboardVisitCompleteness', '');
    text('dashboardVisitScope', 'Office not configured');
    if (get('dashboardVisitNext')) get('dashboardVisitNext').hidden = true;
    if (get('dashboardVisitRefresh')) get('dashboardVisitRefresh').disabled = !ready;
    document.querySelectorAll('[data-demo-badge]').forEach(badge => { badge.textContent = ''; badge.hidden = true; });
  }
  function renderMode() {
    clearSource();
    const live = controller.isLive();
    const date = dateInput?.value || localDay();
    const demo = !live;
    if (get('demoDataToggle')) get('demoDataToggle').checked = demo;
    text('demoToggleState', demo ? 'On' : 'Off');
    text('dataModeBadge', demo ? 'Demo · synthetic' : 'Live · validation pending');
    if (get('dataModeBadge')) get('dataModeBadge').className = 'data-mode-badge ' + (demo ? 'demo' : 'live');
    text('environmentMode', demo ? 'Demo data' : 'Live source preview');
    text('environmentDetails', demo ? 'Synthetic preview records' : 'Source validation pending');
    text('dashboardModeNotice', demo
      ? 'Demo data is on. All preview records are synthetic; messages and HHA changes are disabled.'
      : 'Demo data is off. Source previews require approved access. Unavailable panels show no example values; operational totals and policy classifications remain pending.');
    ['exceptionSearch', 'priorityFilter'].forEach(id => { if (get(id)) get(id).disabled = live; });
    text('dashboardReadiness', demo ? 'This preview uses synthetic records. Turn Demo data off to check live source availability.' : 'Source previews do not establish validated imports, complete counts, EVV exceptions, staffing eligibility or billable hours.');
    const model = fixtures.dashboard(date);
    metrics('dashboardOverviewMetrics', [
      ['Scheduled visits', model.visits.length], ['EVV exceptions', model.exceptions.length, `${model.highPriority} example high priority`],
      ['Clocked in now', model.counts.in_progress], ['Scheduled hours', hours(model.billing.projectedMinutes), 'Synthetic selected day']
    ], demo);
    metrics('dashboardVisitMetrics', [['In progress', model.counts.in_progress], ['Starting soon', model.counts.starting_soon], ['Late / missing', model.counts.late_missing], ['Completed', model.counts.completed]], demo);
    metrics('dashboardBillingMetrics', [['Completed hours', hours(model.billing.completedMinutes)], ['Example billing-ready', hours(model.billing.readyMinutes)], ['Example blocked hours', hours(model.billing.blockedMinutes)], ['Scheduled this day', hours(model.billing.projectedMinutes)]], demo);
    if (live) {
      unavailable('dashboardOverviewExceptions', 'EVV queue unavailable', 'Validated exception rules and complete source evidence are required.');
      unavailable('dashboardExceptions', 'EVV exceptions unavailable', 'The visit source preview keeps original values separate and does not classify exceptions.');
      unavailable('dashboardCoverage', 'Coverage unavailable', 'Validated schedules and availability are required.');
      unavailable('dashboardAlerts', 'Manager inbox unavailable', 'Alert evaluation and delivery are not active.');
      unavailable('dashboardMessages', 'Messages unavailable', 'No live message feed or delivery channel is connected.');
      unavailable('dashboardStaffing', 'Open shifts unavailable', 'No staffing eligibility or assignment is inferred from the visit preview.');
      unavailable('dashboardBillingPipeline', 'Billing pipeline unavailable', 'No billing-ready totals, claims or payments are inferred.');
      unavailable('dashboardAudit', 'Dashboard audit feed unavailable', 'Use Operational tools to request persisted audit history.');
      unavailable('dashboardSettings', 'Settings preview unavailable', 'Use authenticated owner controls in Operational tools to review current preferences.');
      unavailable('dashboardVisitRows', 'Visit preview unavailable', ready ? 'Checking source access…' : 'Sign in with an approved administrator account.');
      return;
    }
    document.querySelectorAll('[data-demo-badge]').forEach(badge => {
      badge.textContent = String(badge.dataset.demoBadge === 'exceptions' ? model.exceptions.length : model.alerts.length);
      badge.hidden = false;
    });
    replace('dashboardOverviewExceptions', table(['Visit', 'Example exception', 'Scheduled start', 'Priority'], model.exceptions.slice(0, 3).map(item => [item.id, item.issue, item.scheduledStart, item.priority])));
    const coverage = node('div');
    const stat = node('div', null, 'coverage-stat'); stat.append(node('strong', model.coverage.todayOpen), node('span', 'example open shifts')); coverage.append(stat);
    const progress = node('div', null, 'progress-row'); progress.append(node('p', `Today covered: ${model.coverage.todayPercent}% · synthetic`));
    const bar = node('progress'); bar.value = model.coverage.todayPercent; bar.max = 100; bar.setAttribute('aria-label', 'Example coverage'); progress.append(bar); coverage.append(progress);
    const mini = node('div', null, 'mini-list');
    [['Tomorrow', `${model.coverage.tomorrowOpen} open`], ['Next 7 days', `${model.coverage.weekOpen} open`], ['Availability conflicts', model.coverage.conflicts]].forEach(([label, value]) => { const row = node('div'); row.append(node('span', label), node('strong', value)); mini.append(row); });
    coverage.append(mini); replace('dashboardCoverage', coverage);
    const alerts = node('div', null, 'alert-list');
    model.alerts.forEach(alert => { const row = node('article'); row.append(node('span', null, 'alert-dot ' + alert.tone)); const detail = node('div'); detail.append(node('strong', alert.title), node('p', alert.detail), node('small', `${alert.minutesAgo} min ago · example`)); row.append(detail); alerts.append(row); });
    replace('dashboardAlerts', alerts);
    replace('dashboardMessages', ...model.rules.map(rule => { const card = node('article', null, 'panel'); card.append(node('span', rule.audience, 'rule-tag ' + rule.tone), node('h3', rule.title), node('p', rule.detail), node('small', rule.channel)); return card; }));
    replace('dashboardStaffing', table(['Example shift', 'Service', 'Day', 'Window', 'Example matches'], model.coverage.shifts.map(shift => [shift.id, shift.service, shift.dayOffset ? `In ${shift.dayOffset} day(s)` : 'Selected day', shift.window, `${shift.eligible.length} example candidates`])));
    const pipeline = node('div', null, 'pipeline');
    [['Scheduled', hours(model.billing.projectedMinutes)], ['Completed', hours(model.billing.completedMinutes)], ['Ready', hours(model.billing.readyMinutes)], ['Submitted', 'Unavailable'], ['Paid', 'Unavailable']].forEach(([label, value]) => { const stage = node('div'); stage.append(node('span', label), node('strong', value)); pipeline.append(stage); });
    replace('dashboardBillingPipeline', pipeline);
    replace('dashboardAudit', table(['Time', 'Actor', 'Example action', 'Object', 'Result'], model.audit.map(item => [item.time, item.actor, item.action, item.object, item.result])));
    replace('dashboardSettings', ...model.settings.map(setting => { const card = node('section', null, 'panel'); card.append(node('h3', setting.title), node('p', setting.detail), node('small', 'Synthetic configuration example')); return card; }));
    renderExceptions();
    showVisitPreview(fixtures.visitPage(date), { mode: 'demo', date });
  }
  function showVisitPreview(payload, expected) {
    const view = normalizeVisitPreview(payload, expected);
    nextCursor = view.nextCursor;
    const pair = (start, end) => `${start || 'Unavailable'}\n${end || 'Unavailable'}`;
    replace('dashboardVisitRows', table(['Visit', 'Patient ID', 'Caregiver ID', 'Scheduled start / end', 'Actual start / end', 'EVV start / end', 'Evidence state'],
      view.items.map(item => [item.id, item.patientId, item.caregiverId, pair(item.scheduledStart, item.scheduledEnd), pair(item.actualStart, item.actualEnd), pair(item.evvStart, item.evvEnd), item.state === 'unavailable' ? 'Detail unavailable' : view.mode === 'demo' ? 'Synthetic example' : 'Source unvalidated'])));
    text('dashboardVisitStatus', view.mode === 'demo' ? 'Synthetic visit examples. No source request was made.' : view.state === 'partial' ? 'Partial source preview. Some visit details are unavailable.' : view.state === 'empty' ? 'No visit identifiers returned for this query. Complete office coverage is not established.' : 'Source preview returned. Source interpretation is pending.');
    text('dashboardVisitScope', `Office: ${view.scope.officeId || 'Unavailable'} · Date: ${view.scope.date} · Timezone: ${view.scope.timezone || 'Unconfigured'}`);
    text('dashboardVisitMetadata', view.mode === 'demo' ? 'Source: synthetic examples · values are not patient records.' : `Source: HHAeXchange · fetched: ${view.fetchedAt || 'Unavailable'} · source unvalidated · source time values shown without conversion.`);
    text('dashboardVisitCompleteness', view.mode === 'demo' ? 'Example page only.' : `Bounded preview only. Completeness is not established; no totals are calculated.${view.truncated ? ' Source identifier results were truncated.' : ''}`);
    if (get('dashboardVisitNext')) { get('dashboardVisitNext').hidden = !nextCursor; get('dashboardVisitNext').disabled = false; }
  }
  function context() { return { generation: controller.getGeneration(), mode: controller.getMode(), session, serial }; }
  function current(captured) { return ready && captured.generation === controller.getGeneration() && captured.mode === controller.getMode() && captured.session === session && captured.serial === serial; }
  function blockedMessage(reason) {
    return ({ operational_data_release_not_approved: 'Live source access has not been approved.', office_timezone_not_configured: 'The owner must configure an office and office timezone.', visit_reads_not_owner_enabled: 'Required visit reads have not been enabled by the owner.', vendor_contract_blocked: 'The vendor contract for this read requires review.' })[reason] || 'Live visit source access is unavailable. Review owner controls and deployment approval.';
  }
  async function loadMetadata() {
    if (!ready || !controller.isLive()) return;
    serial += 1;
    abort?.abort();
    const captured = context();
    abort = new AbortController();
    if (get('dashboardVisitRefresh')) get('dashboardVisitRefresh').disabled = true;
    try {
      const response = await window.primetimeApiFetch('/primetime/api/data/status', { signal: abort.signal });
      if (!current(captured)) return;
      const payload = await response.json();
      if (!current(captured)) return;
      if (!response.ok || payload?.ok !== true || payload.mode !== 'live') throw new Error('data_status_unavailable');
      metadata = payload;
      const settings = payload.settings || {};
      if (!dateChosen && settings.officeTimezone && dateInput) {
        try { const parts = new Intl.DateTimeFormat('en', { timeZone: settings.officeTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); dateInput.value = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-'); } catch { /* A user-selected date remains available. */ }
      }
      text('dashboardVisitScope', `Office: ${settings.officeId || 'Unconfigured'} · Timezone: ${settings.officeTimezone || 'Unconfigured'}`);
      if (payload.dataApproved !== true || payload.panels?.visits?.available !== true) {
        const detail = blockedMessage(payload.panels?.visits?.blockedReason);
        unavailable('dashboardVisitRows', 'Visit preview unavailable', detail);
        text('dashboardVisitStatus', detail);
        if (get('dashboardVisitRefresh')) get('dashboardVisitRefresh').disabled = false;
        return;
      }
      await loadVisits();
    } catch {
      if (!current(captured)) return;
      unavailable('dashboardVisitRows', 'Visit preview unavailable', 'Source access status could not be loaded. Refresh to retry.');
      text('dashboardVisitStatus', 'Source access status unavailable. No example values are shown.');
    } finally {
      if (current(captured) && get('dashboardVisitRefresh')) get('dashboardVisitRefresh').disabled = false;
    }
  }
  async function loadVisits(cursor = null) {
    if (!ready || !controller.isLive()) return;
    if (metadata?.dataApproved !== true || metadata?.panels?.visits?.available !== true) { await loadMetadata(); return; }
    serial += 1;
    abort?.abort();
    abort = new AbortController();
    const captured = context();
    const date = dateInput?.value || '';
    nextCursor = null;
    unavailable('dashboardVisitRows', 'Loading visit preview', 'Previous page values have been cleared.');
    text('dashboardVisitMetadata', '');
    text('dashboardVisitCompleteness', '');
    text('dashboardVisitStatus', 'Loading a bounded visit source preview…');
    if (get('dashboardVisitNext')) get('dashboardVisitNext').hidden = true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      text('dashboardVisitStatus', 'Choose a service date.');
      unavailable('dashboardVisitRows', 'Service date required', 'Choose a service date to preview source visits.');
      if (get('dashboardVisitRefresh')) get('dashboardVisitRefresh').disabled = false;
      return;
    }
    if (get('dashboardVisitRefresh')) get('dashboardVisitRefresh').disabled = true;
    try {
      const query = new URLSearchParams({ date, limit: '10' });
      if (cursor) query.set('cursor', cursor);
      const response = await window.primetimeApiFetch('/primetime/api/views/visits?' + query, { signal: abort.signal });
      if (!current(captured)) return;
      const payload = await response.json();
      if (!current(captured)) return;
      if (!response.ok) {
        if (response.status === 409 || response.status === 423) {
          metadata = null;
          const detail = response.status === 409 ? 'Source scope or visit evidence changed. Refresh to check access and restart from the first page.' : blockedMessage(payload?.error);
          unavailable('dashboardVisitRows', 'Visit preview unavailable', detail);
          text('dashboardVisitStatus', detail);
          return;
        }
        throw new Error('visit_preview_unavailable');
      }
      showVisitPreview(payload, { mode: 'live', date, officeId: metadata.settings?.officeId });
    } catch {
      if (!current(captured)) return;
      unavailable('dashboardVisitRows', 'Visit preview unavailable', 'The source request failed or its response could not be verified. Refresh to retry.');
      text('dashboardVisitStatus', 'Visit source preview unavailable. No example values are shown.');
    } finally {
      if (current(captured) && get('dashboardVisitRefresh')) get('dashboardVisitRefresh').disabled = false;
    }
  }
  get('demoDataToggle')?.addEventListener('change', event => controller.setMode(event.target.checked ? 'demo' : 'live'));
  get('exceptionSearch')?.addEventListener('input', renderExceptions);
  get('priorityFilter')?.addEventListener('change', renderExceptions);
  dateInput?.addEventListener('change', () => {
    dateChosen = true;
    if (controller.isLive()) void loadVisits(); else { demoOffset = 0; renderMode(); }
  });
  get('dashboardVisitRefresh')?.addEventListener('click', () => {
    if (controller.isLive()) void loadVisits(); else { demoOffset = 0; showVisitPreview(fixtures.visitPage(dateInput.value), { mode: 'demo', date: dateInput.value }); }
  });
  get('dashboardVisitNext')?.addEventListener('click', () => {
    if (!nextCursor) return;
    if (controller.isLive()) void loadVisits(nextCursor);
    else { demoOffset = Number(nextCursor); showVisitPreview(fixtures.visitPage(dateInput.value, demoOffset), { mode: 'demo', date: dateInput.value }); }
  });
  document.addEventListener('primetime-data-mode-changed', () => { renderMode(); if (ready && controller.isLive()) void loadMetadata(); });
  document.addEventListener('primetime-ready', () => { ready = true; session += 1; renderMode(); if (controller.isLive()) void loadMetadata(); });
  document.addEventListener('primetime-signed-out', () => { ready = false; session += 1; clearSource(); if (!controller.isLive()) renderMode(); });
  renderMode();
})();
