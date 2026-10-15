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
    const value = field => typeof field === 'string' && field.trim() !== '' ? field : null;
    const detailReasons = {
      not_attempted_batch_time_budget: 'Page time limit reached; retry this page',
      not_attempted_after_batch_gate: 'Remaining details deferred after a source or read limit',
      read_budget_exhausted_retry_next_minute: 'Shared read limit reached; retry next minute',
      vendor_backoff_active: 'Vendor retry delay active',
      visit_patient_office_mismatch: 'Patient office could not be verified',
      visit_date_scope_mismatch: 'Source visit date differs from the selected day',
      visit_not_uniquely_returned: 'Source did not return one matching visit'
    };
    const ids = new Set();
    const items = payload.items.map(item => {
      if (!item || typeof item.id !== 'string' || (live ? !/^[1-9]\d{0,9}$/.test(item.id) : !item.id.startsWith('DEMO-'))
        || ids.has(item.id) || (live && !['source_unvalidated', 'unavailable'].includes(item.state))) throw new Error('invalid_visit_preview');
      ids.add(item.id);
      // Never count fields from a detail read the server could not verify.
      if (live && item.state === 'unavailable') return { id: item.id, state: 'unavailable', patientId: null, caregiverId: null,
        scheduledStart: null, scheduledEnd: null, actualStart: null, actualEnd: null, evvStart: null, evvEnd: null,
        detailReason: detailReasons[item.error] || 'Source detail could not be verified' };
      return Object.fromEntries(['id', 'patientId', 'caregiverId', 'scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd', 'state'].map(key => [key, value(item[key])]));
    });
    let discovery = null, page = null;
    if (live && payload.discovery !== undefined) {
      const candidate = payload.discovery;
      if (!candidate || !Number.isInteger(candidate.selectedCount) || candidate.selectedCount < items.length || candidate.selectedCount > 200
        || typeof candidate.truncated !== 'boolean' || typeof candidate.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.fingerprint)) throw new Error('invalid_visit_preview');
      discovery = { selectedCount: candidate.selectedCount, truncated: candidate.truncated };
    }
    if (live && payload.page !== undefined) {
      const candidate = payload.page;
      if (!candidate || !discovery || !Number.isInteger(candidate.offset) || candidate.offset < 0
        || candidate.returnedCount !== items.filter(item => item.state !== 'unavailable').length || candidate.selectedCount !== items.length
        || candidate.unavailableCount !== items.filter(item => item.state === 'unavailable').length
        || candidate.offset + items.length > discovery.selectedCount) throw new Error('invalid_visit_preview');
      page = { offset: candidate.offset, selectedCount: candidate.selectedCount };
    }
    return { mode: expected.mode, state: payload.state, scope: payload.scope, fetchedAt: value(payload.fetchedAt), items, discovery, page,
      nextCursor: typeof payload.nextCursor === 'string' && payload.nextCursor ? payload.nextCursor : null,
      truncated: payload.completeness?.truncated === true, totals: null };
  }
  function sourceEvidence(items) {
    const readable = items.filter(item => item.state !== 'unavailable');
    const count = predicate => readable.filter(predicate).length;
    return { records: items.length, readable: readable.length, unavailable: items.length - readable.length,
      assigned: count(item => Boolean(item.caregiverId)),
      schedulePairs: count(item => Boolean(item.scheduledStart && item.scheduledEnd)),
      actualPairs: count(item => Boolean(item.actualStart && item.actualEnd)),
      evvPairs: count(item => Boolean(item.evvStart && item.evvEnd)),
      actualStartOnly: count(item => Boolean(item.actualStart && !item.actualEnd)),
      evvStartOnly: count(item => Boolean(item.evvStart && !item.evvEnd)),
      fields: ['scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd'].map(key => ({ key, count: count(item => Boolean(item[key])) })) };
  }
  function sourceInterval(start, end, date) {
    // Position only same-day source wall times. No UTC conversion, duration,
    // lateness, completion or overnight assumptions are made here.
    const clock = value => {
      if (typeof value !== 'string') return null;
      const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)?$/);
      return match && match[1] === date ? { minute: Number(match[2]) * 60 + Number(match[3]), zone: match[4] || '' } : null;
    };
    const from = clock(start), to = clock(end);
    return from && to && from.zone === to.zone && to.minute > from.minute ? { left: from.minute / 14.4, width: (to.minute - from.minute) / 14.4 } : null;
  }
  window.primetimeDashboardModel = Object.freeze({ filterExceptions, normalizeVisitPreview, sourceEvidence, sourceInterval });
  if (typeof document === 'undefined') return;
  const controller = window.primetimeDataMode;
  const fixtures = window.primetimeDemoData;
  if (!controller || !fixtures) return;
  const get = id => document.getElementById(id);
  const hosts = ['dashboardOverviewMetrics', 'dashboardOverviewExceptions', 'dashboardCoverage', 'dashboardAlerts', 'dashboardTimeline', 'dashboardEvidenceChart',
    'dashboardExceptions', 'dashboardVisitMetrics', 'dashboardVisitRows', 'dashboardMessages', 'dashboardStaffing',
    'dashboardBillingMetrics', 'dashboardBillingPipeline', 'dashboardAudit', 'dashboardSettings'];
  const dateInput = get('dashboardVisitDate');
  let ready = false;
  let session = 0;
  let serial = 0;
  let abort;
  let metadata = null;
  let nextCursor = null;
  let pageTrail = [null];
  let pagePosition = 0;
  let demoOffset = 0;
  let dateChosen = false;
  const localDay = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  if (dateInput) dateInput.value = localDay();
  if (get('dashboardOverviewDate')) get('dashboardOverviewDate').value = dateInput?.value || localDay();
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }
  const overviewMirrors = { dashboardVisitStatus: 'dashboardOverviewStatus', dashboardVisitMetadata: 'dashboardOverviewMetadata', dashboardVisitScope: 'dashboardOverviewScope', dashboardVisitCompleteness: 'dashboardOverviewCompleteness' };
  function text(id, value) {
    const element = get(id); if (element) element.textContent = value;
    if (overviewMirrors[id] && get(overviewMirrors[id])) get(overviewMirrors[id]).textContent = value;
  }
  function refreshDisabled(disabled) { ['dashboardVisitRefresh', 'dashboardOverviewRefresh'].forEach(id => { if (get(id)) get(id).disabled = disabled; }); }
  function nextPageButton(visible) { ['dashboardVisitNext', 'dashboardOverviewNext'].forEach(id => { if (get(id)) { get(id).hidden = !visible; get(id).disabled = false; } }); }
  function previousPageButton(visible) { ['dashboardVisitPrevious', 'dashboardOverviewPrevious'].forEach(id => { if (get(id)) { get(id).hidden = !visible; get(id).disabled = false; } }); }
  function resetPaging() { nextCursor = null; pageTrail = [null]; pagePosition = 0; nextPageButton(false); previousPageButton(false); }
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
  function evidenceMetrics(id, entries) {
    replace(id, ...entries.map(([label, value, detail]) => {
      const card = node('article', null, 'metric-card');
      card.append(node('span', label), node('strong', value), node('small', detail));
      return card;
    }));
  }
  function liveOverviewState(title, detail) {
    ['dashboardOverviewMetrics', 'dashboardVisitMetrics', 'dashboardOverviewExceptions', 'dashboardCoverage', 'dashboardAlerts', 'dashboardTimeline', 'dashboardEvidenceChart'].forEach(id => unavailable(id, title, detail));
    text('dashboardReadiness', detail);
  }
  function renderTimeline(view) {
    const captured = context();
    const timeline = node('div', null, 'source-timeline');
    timeline.append(node('p', 'Source wall-clock positions, without timezone conversion. Bars require a valid same-day start and end; original values remain visible.'));
    const axis = node('div', null, 'source-timeline-axis');
    ['00:00', '06:00', '12:00', '18:00', '24:00'].forEach(label => axis.append(node('span', label)));
    timeline.append(axis);
    if (!view.items.length) timeline.append(node('p', 'No source visits returned for this page.'));
    for (const item of view.items) {
      const row = node('article', null, 'source-timeline-visit');
      row.append(node('h4', `Visit ${item.id} · Caregiver ${item.caregiverId || 'unavailable'}`));
      if (item.state === 'unavailable') row.append(node('p', 'Source detail unavailable. ' + item.detailReason));
      else for (const [label, from, to, tone] of [['Schedule', item.scheduledStart, item.scheduledEnd, 'scheduled'], ['Actual', item.actualStart, item.actualEnd, 'actual'], ['EVV', item.evvStart, item.evvEnd, 'evv']]) {
        const lane = node('div', null, 'source-timeline-lane');
        lane.append(node('strong', label));
        const track = node('div', null, 'source-timeline-track');
        const interval = sourceInterval(from, to, view.scope.date);
        if (interval) {
          const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          drawing.setAttribute('viewBox', '0 0 1440 19'); drawing.setAttribute('preserveAspectRatio', 'none');
          drawing.setAttribute('role', 'img'); drawing.setAttribute('aria-label', `${label}: ${from} to ${to}, source values`);
          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bar.setAttribute('x', String(interval.left * 14.4)); bar.setAttribute('y', '3');
          bar.setAttribute('width', String(interval.width * 14.4)); bar.setAttribute('height', '13'); bar.setAttribute('rx', '3');
          bar.setAttribute('class', 'source-timeline-bar ' + tone); drawing.append(bar);
          track.append(drawing);
        } else track.append(node('span', from || to ? 'See source values below' : 'Fields not supplied', 'source-timeline-no-bar'));
        lane.append(track, node('small', `${from || 'Not supplied'} → ${to || 'Not supplied'}`));
        row.append(lane);
      }
      row.append(sourceRecordTools(view, item, captured));
      timeline.append(row);
    }
    replace('dashboardTimeline', timeline);
  }
  function renderLiveOverview(view) {
    const evidence = sourceEvidence(view.items), denominator = `${evidence.readable} readable source details`;
    const sourceIds = view.discovery ? view.discovery.selectedCount : view.items.length;
    evidenceMetrics('dashboardOverviewMetrics', [
      [view.discovery ? 'Visit IDs returned by search' : 'Visits on this page', sourceIds, view.discovery?.truncated ? 'Search truncated · not an office total' : 'Source query only · not an operational total'],
      ['Readable details on this page', `${evidence.readable} / ${evidence.records}`, 'Failed detail reads stay unavailable'],
      ['Actual start / end fields supplied', `${evidence.actualPairs} / ${evidence.readable}`, 'Field presence · no completion decision'],
      ['EVV start / end fields supplied', `${evidence.evvPairs} / ${evidence.readable}`, 'Field presence · no EVV exception decision']
    ]);
    evidenceMetrics('dashboardVisitMetrics', [
      ['Schedule pairs supplied', evidence.schedulePairs, denominator], ['Actual pairs supplied', evidence.actualPairs, denominator],
      ['Actual start without end', evidence.actualStartOnly, 'Source field presence · not current status'], ['Detail unavailable', evidence.unavailable, 'Excluded from field and assignment counts']
    ]);
    renderTimeline(view);
    const chart = node('div', null, 'source-evidence-chart');
    const labels = ['Scheduled start', 'Scheduled end', 'Actual start', 'Actual end', 'EVV start', 'EVV end'];
    evidence.fields.forEach((field, index) => {
      const row = node('div'); const label = node('p');
      label.append(node('span', labels[index]), node('strong', `${field.count} / ${evidence.readable}`));
      const bar = node('progress'); bar.max = evidence.readable || 1; bar.value = field.count;
      bar.setAttribute('aria-label', `${labels[index]} supplied in ${field.count} of ${evidence.readable} readable details`);
      row.append(label, bar); chart.append(row);
    });
    chart.append(node('small', `${evidence.unavailable} unavailable detail(s) excluded. A supplied value is not an approved visit status.`));
    replace('dashboardEvidenceChart', chart);
    replace('dashboardOverviewExceptions', table(['Visit', 'EVV start (source)', 'EVV end (source)', 'Source field evidence'], view.items.map(item => [item.id, item.evvStart, item.evvEnd,
      item.state === 'unavailable' ? 'Detail unavailable: ' + item.detailReason : item.evvStart && item.evvEnd ? 'Both fields supplied' : item.evvStart || item.evvEnd ? 'One field supplied' : 'Neither field supplied'])));
    const coverage = node('div');
    const stat = node('div', null, 'coverage-stat'); stat.append(node('strong', `${evidence.assigned} / ${evidence.readable}`), node('span', 'caregiver IDs supplied')); coverage.append(stat);
    const bar = node('progress'); bar.max = evidence.readable || 1; bar.value = evidence.assigned; bar.setAttribute('aria-label', `${evidence.assigned} of ${evidence.readable} readable visits have a caregiver ID`);
    coverage.append(bar, node('p', `${evidence.readable - evidence.assigned} readable visit(s) have no caregiver ID. ${evidence.unavailable} detail(s) unavailable.`), node('small', 'Source assignment fields do not establish eligibility, availability or complete shift coverage.'));
    replace('dashboardCoverage', coverage);
    const gaps = node('div', null, 'mini-list');
    [['Detail reads unavailable', evidence.unavailable], ['Schedule pair absent', evidence.readable - evidence.schedulePairs], ['Actual pair absent', evidence.readable - evidence.actualPairs], ['EVV pair absent', evidence.readable - evidence.evvPairs]].forEach(([label, count]) => {
      const row = node('div'); row.append(node('span', label), node('strong', count)); gaps.append(row);
    });
    gaps.append(node('small', 'Missing fields describe source evidence only. No alerts have been sent; no late or missed visits are inferred.'));
    replace('dashboardAlerts', gaps);
    text('dataModeBadge', 'Live · HHA source');
    text('environmentDetails', 'Live HHA visit source returned');
    text('dashboardReadiness', `Authenticated HHAeXchange visit search returned for office ${view.scope.officeId} on ${view.scope.date}. Fetched ${view.fetchedAt || 'time unavailable'}. ${evidence.readable} readable detail(s), ${evidence.unavailable} unavailable. Policy classifications, office-wide coverage, billing and message delivery are not established by this source page.`);
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
      values.forEach(value => {
        const cell = node('td');
        if (typeof value === 'function') cell.append(value());
        else cell.textContent = value === null || value === undefined || value === '' ? 'Unavailable' : String(value);
        row.append(cell);
      });
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
    resetPaging();
    demoOffset = 0;
    hosts.forEach(id => replace(id));
    text('dashboardVisitStatus', 'Live visit preview unavailable until source access is checked.');
    text('dashboardVisitMetadata', '');
    text('dashboardVisitCompleteness', '');
    text('dashboardVisitScope', 'Office not configured');
    nextPageButton(false);
    refreshDisabled(!ready);
    document.querySelectorAll('[data-demo-badge]').forEach(badge => { badge.textContent = ''; badge.hidden = true; });
  }
  function renderMode() {
    clearSource();
    const live = controller.isLive();
    const date = dateInput?.value || localDay();
    const demo = !live;
    text('dashboardEvidenceTitle', demo ? 'Example EVV exception queue' : 'EVV source evidence');
    text('dashboardCoverageTitle', demo ? 'Example coverage' : 'Caregiver assignment evidence');
    text('dashboardAlertsTitle', demo ? 'Example manager inbox' : 'Source evidence gaps');
    ['dashboardOverviewRefresh', 'dashboardVisitRefresh'].forEach(id => text(id, demo ? 'Refresh examples' : 'Read source now'));
    if (get('demoDataToggle')) get('demoDataToggle').checked = demo;
    text('demoToggleState', demo ? 'On' : 'Off');
    text('dataModeBadge', demo ? 'Demo · synthetic' : 'Live · validation pending');
    if (get('dataModeBadge')) get('dataModeBadge').className = 'data-mode-badge ' + (demo ? 'demo' : 'live');
    text('environmentMode', demo ? 'Demo data' : 'Live source preview');
    text('environmentDetails', demo ? 'Synthetic preview records' : 'Source validation pending');
    text('dashboardModeNotice', demo
      ? 'Demo data is on. All preview records are synthetic; messages and HHA changes are disabled.'
      : 'Live HHA source mode. Read source now requests an on-demand source page; it does not save a visit import or start background synchronization. Charts describe this page only. Unavailable evidence is excluded from counts.');
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
      liveOverviewState(ready ? 'Loading live source' : 'Sign in required', ready ? 'Checking HHA visit access for the selected office and date…' : 'Sign in with an approved administrator account to load HHA visit data.');
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
    if (view.mode === 'live') renderLiveOverview(view);
    else {
      renderTimeline(view);
      unavailable('dashboardEvidenceChart', 'Synthetic example mode', 'All records in this mode are generated examples. Switch Demo data off to load live HHA evidence.');
    }
    const pair = (start, end) => `${start || 'Unavailable'}\n${end || 'Unavailable'}`;
    const captured = context();
    replace('dashboardVisitRows', table(['Visit', 'Patient ID', 'Caregiver ID', 'Scheduled start / end', 'Actual start / end', 'EVV start / end', 'Evidence state', 'Source records'],
      view.items.map(item => [item.id, item.patientId, item.caregiverId, pair(item.scheduledStart, item.scheduledEnd), pair(item.actualStart, item.actualEnd), pair(item.evvStart, item.evvEnd), item.state === 'unavailable' ? 'Detail unavailable: ' + item.detailReason : view.mode === 'demo' ? 'Synthetic example' : 'Source unvalidated', view.mode === 'demo' ? 'Synthetic record' : () => sourceRecordTools(view, item, captured)])));
    text('dashboardVisitStatus', view.mode === 'demo' ? 'Synthetic visit examples. No source request was made.' : view.state === 'partial' ? 'Partial source page returned. More pages, truncated search results or unavailable details are disclosed below.' : view.state === 'empty' ? 'No visit identifiers returned for this query. Complete office coverage is not established.' : 'Live HHA source page returned. Source fields are shown separately; operational classifications are pending.');
    text('dashboardVisitScope', `Office: ${view.scope.officeId || 'Unavailable'} · Date: ${view.scope.date} · Timezone: ${view.scope.timezone || 'Unconfigured'}`);
    text('dashboardVisitMetadata', view.mode === 'demo' ? 'Source: synthetic examples · values are not patient records.' : `Source: HHAeXchange · fetched: ${view.fetchedAt || 'Unavailable'} · source unvalidated · on-demand read, not a persisted visit import · source time values shown without conversion.`);
    const pageScope = view.page && view.discovery ? `Showing source IDs ${view.items.length ? view.page.offset + 1 : 0}–${view.page.offset + view.items.length} of ${view.discovery.selectedCount} returned by search. ` : `${view.items.length} source record(s) on this page. `;
    text('dashboardVisitCompleteness', view.mode === 'demo' ? 'Example page only.' : `${pageScope}Charts use this page only. Office totals are unknown; complete office coverage is not established. Read limits: up to 200 source IDs, 10 details per page and a 25-second detail-read budget.${view.truncated ? ' Source identifier results were truncated.' : ''}`);
    nextPageButton(Boolean(nextCursor));
    previousPageButton(view.mode === 'demo' ? demoOffset > 0 : pagePosition > 0);
  }
  function context() { return { generation: controller.getGeneration(), mode: controller.getMode(), session, serial }; }
  function sourceRecordTools(view, item, captured) {
    const tools = node('div', null, 'source-record-tools');
    if (view.mode !== 'live' || item.state === 'unavailable') return tools;
    for (const [kind, id] of [['patient', item.patientId], ['caregiver', item.caregiverId], ['visit', item.id]]) {
      if (typeof id !== 'string' || !/^[1-9]\d{0,9}$/.test(id)) continue;
      const control = node('button', `Open ${kind} read`, 'btn secondary'); control.type = 'button';
      control.addEventListener('click', () => {
        if (!current(captured) || !controller.isLive() || metadata?.settings?.officeId !== view.scope.officeId) return;
        document.dispatchEvent(new CustomEvent('primetime-source-record-selected', { detail: { kind, id, officeId: view.scope.officeId } }));
      });
      tools.append(control);
    }
    return tools;
  }
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
    refreshDisabled(true);
    liveOverviewState('Checking live source access', 'Loading the selected office settings and enabled HHA reads…');
    try {
      const response = await window.primetimeApiFetch('/primetime/api/data/status', { signal: abort.signal });
      if (!current(captured)) return;
      const payload = await response.json();
      if (!current(captured)) return;
      if (!response.ok || payload?.ok !== true || payload.mode !== 'live') throw new Error('data_status_unavailable');
      metadata = payload;
      const settings = payload.settings || {};
      if (controller.observeScope?.(settings)) return;
      if (!dateChosen && settings.officeTimezone && dateInput) {
        try { const parts = new Intl.DateTimeFormat('en', { timeZone: settings.officeTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); dateInput.value = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-'); if (get('dashboardOverviewDate')) get('dashboardOverviewDate').value = dateInput.value; } catch { /* A user-selected date remains available. */ }
      }
      text('dashboardVisitScope', `Office: ${settings.officeId || 'Unconfigured'} · Timezone: ${settings.officeTimezone || 'Unconfigured'}`);
      if (payload.dataApproved !== true || payload.panels?.visits?.available !== true) {
        const detail = blockedMessage(payload.panels?.visits?.blockedReason);
        unavailable('dashboardVisitRows', 'Visit preview unavailable', detail);
        liveOverviewState('Live visits unavailable', detail);
        text('dashboardVisitStatus', detail);
        refreshDisabled(false);
        return;
      }
      await loadVisits();
    } catch {
      if (!current(captured)) return;
      unavailable('dashboardVisitRows', 'Visit preview unavailable', 'Source access status could not be loaded. Refresh to retry.');
      liveOverviewState('Live visits unavailable', 'Source access status could not be loaded. Refresh to retry.');
      text('dashboardVisitStatus', 'Source access status unavailable. No example values are shown.');
    } finally {
      if (current(captured)) refreshDisabled(false);
    }
  }
  async function loadVisits(cursor = null, trail = [null], position = 0) {
    if (!ready || !controller.isLive()) return;
    if (metadata?.dataApproved !== true || metadata?.panels?.visits?.available !== true) { await loadMetadata(); return; }
    serial += 1;
    abort?.abort();
    abort = new AbortController();
    const captured = context();
    const date = dateInput?.value || '';
    resetPaging();
    unavailable('dashboardVisitRows', 'Loading visit preview', 'Previous page values have been cleared.');
    liveOverviewState('Loading live visits', 'Waiting for the selected source page. Previous page values have been cleared.');
    text('dataModeBadge', 'Live · loading');
    text('environmentDetails', 'Loading HHA source data');
    text('dashboardVisitMetadata', '');
    text('dashboardVisitCompleteness', '');
    text('dashboardVisitStatus', 'Loading a bounded visit source preview…');
    text('dashboardVisitScope', `Office: ${metadata.settings.officeId} · Date: ${date} · Timezone: ${metadata.settings.officeTimezone || 'Unconfigured'}`);
    nextPageButton(false);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      text('dashboardVisitStatus', 'Choose a service date.');
      unavailable('dashboardVisitRows', 'Service date required', 'Choose a service date to preview source visits.');
      liveOverviewState('Service date required', 'Choose a service date to load HHA source visits.');
      refreshDisabled(false);
      return;
    }
    refreshDisabled(true);
    try {
      const query = new URLSearchParams({ date, limit: '10', officeId: metadata.settings.officeId });
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
          liveOverviewState('Live visits unavailable', detail);
          text('dashboardVisitStatus', detail);
          return;
        }
        throw new Error('visit_preview_unavailable');
      }
      showVisitPreview(payload, { mode: 'live', date, officeId: metadata.settings?.officeId });
      pageTrail = trail;
      pagePosition = position;
      previousPageButton(pagePosition > 0);
    } catch {
      if (!current(captured)) return;
      resetPaging();
      unavailable('dashboardVisitRows', 'Visit preview unavailable', 'The source request failed or its response could not be verified. Refresh to retry.');
      liveOverviewState('Live visits unavailable', 'The HHA request failed or its response could not be verified. Refresh to retry.');
      text('dataModeBadge', 'Live · unavailable');
      text('environmentDetails', 'HHA visit source unavailable');
      text('dashboardVisitStatus', 'Visit source preview unavailable. No example values are shown.');
    } finally {
      if (current(captured)) refreshDisabled(false);
    }
  }
  get('demoDataToggle')?.addEventListener('change', event => controller.setMode(event.target.checked ? 'demo' : 'live'));
  get('exceptionSearch')?.addEventListener('input', renderExceptions);
  get('priorityFilter')?.addEventListener('change', renderExceptions);
  dateInput?.addEventListener('change', () => {
    dateChosen = true;
    if (get('dashboardOverviewDate')) get('dashboardOverviewDate').value = dateInput.value;
    if (controller.isLive()) void loadVisits(); else { demoOffset = 0; renderMode(); }
  });
  get('dashboardOverviewDate')?.addEventListener('change', () => {
    dateChosen = true;
    if (dateInput) dateInput.value = get('dashboardOverviewDate').value;
    if (controller.isLive()) void loadVisits(); else { demoOffset = 0; renderMode(); }
  });
  const refresh = () => {
    if (controller.isLive()) { clearSource(); void loadMetadata(); } else { demoOffset = 0; showVisitPreview(fixtures.visitPage(dateInput.value), { mode: 'demo', date: dateInput.value }); }
  };
  get('dashboardVisitRefresh')?.addEventListener('click', refresh);
  get('dashboardOverviewRefresh')?.addEventListener('click', refresh);
  const advancePage = () => {
    if (!nextCursor) return;
    if (controller.isLive()) void loadVisits(nextCursor, [...pageTrail.slice(0, pagePosition + 1), nextCursor], pagePosition + 1);
    else { demoOffset = Number(nextCursor); showVisitPreview(fixtures.visitPage(dateInput.value, demoOffset), { mode: 'demo', date: dateInput.value }); }
  };
  get('dashboardVisitNext')?.addEventListener('click', advancePage);
  get('dashboardOverviewNext')?.addEventListener('click', advancePage);
  const previousPage = () => {
    if (controller.isLive()) {
      if (pagePosition > 0) void loadVisits(pageTrail[pagePosition - 1], pageTrail.slice(0, pagePosition), pagePosition - 1);
    } else if (demoOffset > 0) {
      demoOffset = Math.max(0, demoOffset - 10);
      showVisitPreview(fixtures.visitPage(dateInput.value, demoOffset), { mode: 'demo', date: dateInput.value });
    }
  };
  get('dashboardVisitPrevious')?.addEventListener('click', previousPage);
  get('dashboardOverviewPrevious')?.addEventListener('click', previousPage);
  document.addEventListener('primetime-data-mode-changed', () => { renderMode(); if (ready && controller.isLive()) void loadMetadata(); });
  document.addEventListener('primetime-ready', () => { ready = true; session += 1; renderMode(); if (controller.isLive()) void loadMetadata(); });
  document.addEventListener('primetime-signed-out', () => { ready = false; session += 1; clearSource(); if (!controller.isLive()) renderMode(); });
  renderMode();
})();
