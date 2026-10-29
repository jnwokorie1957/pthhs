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
        actualHours: null, scheduleDurationHours: null, scheduleDurationMinutes: null,
        detailReason: detailReasons[item.error] || 'Source detail could not be verified' };
      const result = Object.fromEntries(['id', 'patientId', 'caregiverId', 'scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd', 'state'].map(key => [key, value(item[key])]));
      for (const key of ['actualHours', 'scheduleDurationHours', 'scheduleDurationMinutes']) {
        if (item[key] !== null && item[key] !== undefined && (typeof item[key] !== 'string' || item[key].length > 128)) throw new Error('invalid_visit_preview');
        result[key] = item[key] ?? null;
      }
      return result;
    });
    let discovery = null, page = null;
    if (live && payload.discovery !== undefined) {
      const candidate = payload.discovery;
      if (!candidate || !Number.isSafeInteger(candidate.selectedCount) || candidate.selectedCount < items.length
        || typeof candidate.truncated !== 'boolean' || typeof candidate.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.fingerprint)) throw new Error('invalid_visit_preview');
      discovery = { selectedCount: candidate.selectedCount, truncated: candidate.truncated };
    }
    if (live && payload.page !== undefined) {
      const candidate = payload.page;
      if (!candidate || !discovery || !Number.isSafeInteger(candidate.offset) || candidate.offset < 0
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
  function normalizePatientProfile(payload, expected) {
    if (!payload || payload.ok !== true || payload.operation !== 'GetPatientDemographics' || payload.source !== 'hhaexchange'
      || payload.validation !== 'source_unvalidated' || payload.interpretation !== 'patient_source_unvalidated' || payload.truncated !== false
      || payload.timezone !== 'source_values_unconverted' || !Array.isArray(payload.records) || payload.records.length !== 1
      || typeof payload.fetchedAt !== 'string' || !Number.isFinite(Date.parse(payload.fetchedAt)) || payload.membershipCheckedAt !== payload.fetchedAt
      || !expected || !['visitId', 'patientId', 'officeId'].every(key => payload.scope?.[key] === expected[key])) throw new Error('invalid_patient_profile');
    const record = payload.records[0];
    if (!record || record.PatientID !== expected.patientId || record.OfficeID !== expected.officeId) throw new Error('invalid_patient_profile');
    const fields = ['PatientID', 'OfficeID', 'FirstName', 'LastName', 'PatientStatusName', 'AdmissionID', 'PayerID', 'PayerName', 'LastModifiedDate'];
    if (fields.some(key => record[key] !== null && record[key] !== undefined && (typeof record[key] !== 'string' || record[key].length > 1000))) throw new Error('invalid_patient_profile');
    return { fields: Object.fromEntries(fields.map(key => [key, record[key] || null])), fetchedAt: payload.fetchedAt };
  }
  const relatedFields = {
    caregiver: ['ID', 'FirstName', 'LastName', 'CaregiverCode', 'Status/Name', 'TimeZone', 'LastModifiedDate'],
    billing: ['ID', 'VisitDate', 'Patient/ID', 'Caregiver/ID', ...['PrimaryBillTo', 'SecondaryBillTo'].flatMap(prefix => ['Contract/ID', 'IsBilled', 'BilledRate', 'BilledMinutes', 'BilledAmount'].map(key => prefix + '/' + key))]
  };
  function normalizeVisitContext(payload, expected) {
    const caregiver = expected?.kind === 'caregiver', kind = caregiver ? 'caregiver' : 'billing';
    if (!expected || !['caregiver', 'billing'].includes(expected.kind) || !payload || payload.ok !== true
      || payload.operation !== (caregiver ? 'GetCaregiverDemographics' : 'GetVisitBillInfoV2') || payload.source !== 'hhaexchange'
      || payload.validation !== 'source_unvalidated' || payload.timezone !== 'source_values_unconverted' || payload.truncated !== false
      || payload.interpretation !== (caregiver ? 'caregiver_profile_unvalidated' : 'billing_source_unvalidated') || !Array.isArray(payload.records) || payload.records.length !== 1
      || !['fetchedAt', 'membershipCheckedAt'].every(key => typeof payload[key] === 'string' && Number.isFinite(Date.parse(payload[key])))
      || Date.parse(payload.membershipCheckedAt) > Date.parse(payload.fetchedAt)
      || !['visitId', 'patientId', 'officeId', ...(caregiver ? ['caregiverId'] : [])].every(key => payload.scope?.[key] === expected[key])) throw new Error('invalid_visit_context');
    const record = payload.records[0];
    if (!record || record.ID !== (caregiver ? expected.caregiverId : expected.visitId) || (!caregiver && record['Patient/ID'] !== expected.patientId)) throw new Error('invalid_visit_context');
    if (caregiver) {
      let offices; try { offices = JSON.parse(record.OfficeIDs); } catch { /* rejected below */ }
      if (!Array.isArray(offices) || !offices.length || offices.length > 200 || offices.some(id => typeof id !== 'string' || !/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647)
        || new Set(offices).size !== offices.length || !offices.includes(expected.officeId)) throw new Error('invalid_visit_context');
    }
    if (relatedFields[kind].some(key => record[key] !== null && record[key] !== undefined && (typeof record[key] !== 'string' || record[key].length > 1000))) throw new Error('invalid_visit_context');
    return { fields: Object.fromEntries(relatedFields[kind].map(key => [key, record[key] || null])), fetchedAt: payload.fetchedAt, membershipCheckedAt: payload.membershipCheckedAt };
  }
  window.primetimeDashboardModel = Object.freeze({ filterExceptions, normalizeVisitPreview, sourceEvidence, sourceInterval, normalizePatientProfile, normalizeVisitContext });
  if (typeof document === 'undefined') return;
  const controller = window.primetimeDataMode;
  const fixtures = window.primetimeDemoData;
  if (!controller || !fixtures) return;
  const get = id => document.getElementById(id);
  const hosts = ['dashboardOverviewMetrics', 'dashboardOverviewExceptions', 'dashboardCoverage', 'dashboardAlerts', 'dashboardTimeline', 'dashboardEvidenceChart',
    'dashboardExceptions', 'dashboardVisitMetrics', 'dashboardVisitRows', 'dashboardPatients', 'dashboardPatientProfile', 'dashboardMessages', 'dashboardStaffing', 'dashboardCaregiverProfile',
    'dashboardBillingMetrics', 'dashboardBillingPipeline', 'dashboardBillingFacts'];
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
  let clearPageFetchAge = () => {};
  let sourceClearable = false;
  const feedInstalled = get('apiFeedControl')?.dataset.enabled === 'true';
  let feedEnabled = feedInstalled;
  let feedTimer = null;
  let feedAbort = null;
  let feedReceipt = null;
  let feedPolling = false;
  let patientAbort = null, patientRequest = 0, patientRetryAt = 0;
  let clearPatientFetchAge = () => {};
  const relatedRequests = Object.fromEntries(['caregiver', 'billing'].map(kind => [kind, { abort: null, sequence: 0, retryAt: 0, clearAge: () => {} }]));
  function stopFeedTimer() { if (feedTimer !== null) clearTimeout(feedTimer); feedTimer = null; }
  function cancelFeedRead() { feedAbort?.abort(); feedAbort = null; feedPolling = false; }
  function feedControls(message) {
    if (!feedInstalled) return;
    get('apiFeedControl').hidden = !ready || !controller.isLive();
    get('apiFeedToggle').disabled = !ready || !controller.isLive();
    text('apiFeedToggle', feedEnabled ? 'Pause live feed' : 'Resume live feed');
    text('apiFeedStatus', message || (feedEnabled
      ? 'Automatic HHA API feed enabled. The server updates the first source page every minute; this page checks every minute.'
      : 'Live feed display paused. The server continues updating. Resume to read its latest page.'));
    renderDateContext();
  }
  function currentOfficeDay() {
    if (!metadata?.settings?.officeTimezone) return null;
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: metadata.settings.officeTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
    } catch { return null; }
  }
  function feedDay() { return Boolean(dateInput?.value && dateInput.value === currentOfficeDay()); }
  function canReturnToday() {
    return feedInstalled && ready && controller.isLive() && metadata?.dataApproved === true
      && metadata.panels?.visits?.available === true && typeof metadata.settings?.officeId === 'string'
      && /^[1-9]\d{0,9}$/.test(metadata.settings.officeId) && Boolean(currentOfficeDay());
  }
  function renderDateContext() {
    const control = get('apiFeedToday'), description = get('apiFeedDateContext');
    if (control) control.disabled = !canReturnToday();
    if (!description) return;
    const day = currentOfficeDay(), selected = dateInput?.value || 'not selected';
    const message = !canReturnToday() ? 'Office date navigation is unavailable until live source access and the office timezone are checked.'
      : dateChosen ? `Selected date: ${selected} · stays fixed. Office today: ${day} (${metadata.settings.officeTimezone}).`
      : selected === day ? `Following office today: ${day} (${metadata.settings.officeTimezone}).`
      : `Following office today when updates resume. Displayed date: ${selected}. Office today: ${day} (${metadata.settings.officeTimezone}).`;
    if (description.textContent !== message) description.textContent = message;
  }
  function pauseForSourceFocus() {
    if (!document.activeElement?.closest?.('#dashboardVisitRows, #dashboardTimeline, #dashboardEvidenceChart, #dashboardPatients, #dashboardPatientProfile, #exceptionSearch, #dashboardStaffing, #dashboardCaregiverProfile, #dashboardBillingPipeline, #dashboardBillingFacts')) return false;
    pauseFeed('Live feed display paused while working with source records. The server continues updating; Resume reads its latest page.');
    return true;
  }
  function scheduleFeed() {
    stopFeedTimer();
    if (!feedInstalled || !ready || !controller.isLive() || !feedEnabled) { feedControls(); return; }
    if (document.visibilityState === 'hidden') { feedControls('Dashboard checks paused while hidden. The server API feed continues every minute.'); return; }
    if (metadata && !feedDay() && (dateChosen || !currentOfficeDay())) { feedControls('The automatic API feed covers the current office day. Historical dates use Read source now.'); return; }
    feedTimer = setTimeout(() => { feedTimer = null; void pollFeed(); }, 60_000);
  }
  function pauseFeed(message) {
    feedEnabled = false; stopFeedTimer(); cancelFeedRead();
    feedControls(message);
  }
  async function pollFeed() {
    if (!feedEnabled || !ready || !controller.isLive() || document.visibilityState === 'hidden' || feedPolling) return;
    if (pauseForSourceFocus()) return;
    if (get('dashboardOverviewRefresh')?.disabled) { scheduleFeed(); return; }
    if (!metadata) { await loadMetadata(); return; }
    const officeDay = currentOfficeDay();
    if (!dateChosen && officeDay && dateInput.value !== officeDay) {
      // The untouched default follows the office calendar, never the device's zone.
      // Clear yesterday's evidence and cursors before asking for today's feed.
      invalidateSourceContext();
      abort?.abort(); abort = null;
      resetPaging();
      const detail = 'The office day changed. Reading the new day; prior-day source evidence has been removed.';
      liveOverviewState('Loading current office day', detail);
      unavailable('dashboardVisitRows', 'Loading current office day', detail);
      text('dashboardVisitMetadata', ''); text('dashboardVisitCompleteness', '');
      text('dashboardVisitStatus', detail);
      text('dashboardVisitScope', `Office: ${metadata.settings.officeId} · Date: ${officeDay} · Timezone: ${metadata.settings.officeTimezone}`);
      text('dataModeBadge', 'Live · loading'); text('environmentDetails', 'Loading current office day');
      sourceClearControls(true);
      dateInput.value = officeDay;
      if (get('dashboardOverviewDate')) get('dashboardOverviewDate').value = officeDay;
    }
    if (!feedDay()) { scheduleFeed(); return; }
    stopFeedTimer(); feedPolling = true;
    const captured = context(), request = new AbortController(); feedAbort = request;
    feedControls('Checking the server-updated HHA API feed…');
    try {
      const query = new URLSearchParams({ officeId: metadata.settings.officeId, date: dateInput.value });
      const response = await window.primetimeApiFetch('/primetime/api/views/feed?' + query, { signal: request.signal });
      const payload = await response.json();
      if (!current(captured) || !feedEnabled || request.signal.aborted) return;
      if (document.visibilityState === 'hidden' || pauseForSourceFocus() || !feedDay()) return;
      const checked = window.primetimeSourceTime.timestampInstant(payload.feed?.checkedAt);
      const fetched = window.primetimeSourceTime.timestampInstant(payload.fetchedAt);
      if (!response.ok || payload.feed?.kind !== 'scheduled_api' || payload.feed?.background !== true
        || payload.feed?.intervalSeconds !== 60 || payload.feed?.maxAgeSeconds !== 180 || payload.feed?.coverage !== 'first_source_page'
        || payload.feed?.persistedImport !== false || checked === null || fetched === null || checked < fetched || checked - fetched > 180_000
        || payload.page?.offset !== 0) throw new Error('feed_unavailable');
      // Validate even an unchanged receipt; never trust an old page on an error.
      normalizeVisitPreview(payload, { mode: 'live', date: dateInput.value, officeId: metadata.settings.officeId });
      if (payload.fetchedAt !== feedReceipt) {
        invalidateSourceContext(true);
        resetPaging();
        showVisitPreview(payload, { mode: 'live', date: dateInput.value, officeId: metadata.settings.officeId });
        nextPageButton(Boolean(nextCursor));
        feedReceipt = payload.fetchedAt;
      }
      text('dashboardVisitMetadata', `Source: HHAeXchange API · fetched: ${payload.fetchedAt} · server updates every minute · first source page only · source unvalidated · not a manual capture or persisted visit import.`);
      feedControls(`Connected to HHA API · latest fetch ${payload.fetchedAt} · server updates every minute · first source page, up to ten details. No web scraping.`);
    } catch {
      if (!current(captured) || !feedEnabled || request.signal.aborted) return;
      if (document.visibilityState === 'hidden' || pauseForSourceFocus() || !feedDay()) return;
      invalidateSourceContext(); abort?.abort(); abort = null; metadata = null;
      resetPaging(); sourceClearControls(false); refreshDisabled(!ready);
      liveOverviewState('Live API feed temporarily unavailable', 'The next automatic check will retry. Old source values have been removed.');
      unavailable('dashboardVisitRows', 'Live API feed temporarily unavailable', 'Retrying automatically; no example values are substituted.');
      text('dashboardVisitMetadata', ''); text('dashboardVisitCompleteness', '');
      text('dashboardVisitScope', 'Source access will be checked on the next read.');
      text('dataModeBadge', 'Live · feed unavailable'); text('environmentDetails', 'API feed update unavailable');
      text('dashboardVisitStatus', 'API feed update unavailable. Automatic retry in one minute.');
      feedControls('API feed update unavailable. Retrying in one minute; old source values are cleared.');
      scheduleFeed();
    } finally {
      if (feedAbort === request) { feedPolling = false; feedAbort = null; scheduleFeed(); }
    }
  }
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
  function sourceClearControls(clearable) {
    sourceClearable = clearable;
    ['dashboardOverviewClear', 'dashboardVisitClear'].forEach(id => {
      if (get(id)) { get(id).hidden = !controller.isLive(); get(id).disabled = !clearable || !ready || !controller.isLive(); }
    });
  }
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
    ['dashboardOverviewMetrics', 'dashboardVisitMetrics', 'dashboardOverviewExceptions', 'dashboardCoverage', 'dashboardAlerts', 'dashboardTimeline', 'dashboardEvidenceChart', 'dashboardExceptions', 'dashboardStaffing', 'dashboardPatients', 'dashboardPatientProfile', 'dashboardCaregiverProfile', 'dashboardBillingPipeline', 'dashboardBillingFacts'].forEach(id => unavailable(id, title, detail));
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
    const sourceNote = () => node('p', `HHA API source page · ${view.scope.date} · fetched ${view.fetchedAt || 'time not supplied'}. The selected page follows Overview / Visit Preview; it is not the full office.`, 'source-metadata');
    const sourceField = (item, key) => item.state === 'unavailable' ? 'Detail unavailable' : item[key] || 'Not supplied by HHA';
    const unavailableDetail = item => 'Detail unavailable: ' + item.detailReason;
    replace('dashboardExceptions', sourceNote(), table(['Visit', 'Patient', 'Caregiver', 'Actual start', 'Actual end', 'EVV start', 'EVV end', 'Source detail'],
      view.items.map(item => [item.id, ...['patientId', 'caregiverId', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd'].map(key => sourceField(item, key)),
        item.state === 'unavailable' ? unavailableDetail(item) : 'Source detail returned · unvalidated']), 'exceptionTable'),
      node('p', 'These are source clock fields. Missing values are not automatically late, missed or classified exceptions.', 'source-metadata'));
    if (get('exceptionSearch')) get('exceptionSearch').disabled = false;
    if (get('priorityFilter')) { get('priorityFilter').value = 'all'; get('priorityFilter').disabled = true; }
    filterSourceExceptions();
    const relatedContext = context();
    replace('dashboardStaffing', sourceNote(), table(['Visit', 'Caregiver reference', 'Scheduled start', 'Scheduled end', 'Assignment field', 'Source profile'],
      view.items.map(item => [item.id, ...['caregiverId', 'scheduledStart', 'scheduledEnd'].map(key => sourceField(item, key)),
        item.state === 'unavailable' ? unavailableDetail(item) : item.caregiverId ? 'Caregiver reference supplied' : 'Caregiver reference not supplied', () => relatedSourceControl('caregiver', view, item, relatedContext)]), 'sourceStaffingTable'),
      node('p', 'Assignments shown by HHA do not establish staff eligibility, availability, open-shift completeness or permission to reassign care.', 'source-metadata'));
    replace('dashboardCaregiverProfile', node('p', metadata?.panels?.caregiverProfile?.available ? 'Choose View caregiver profile to read fresh source fields and current office membership.' : 'GetCaregiverDemographics is not enabled for this source context. Review read controls in Settings.'));
    replace('dashboardBillingPipeline', sourceNote(), table(['Visit', 'Patient reference', 'Source detail', 'Current billing read'], view.items.map(item => [item.id, sourceField(item, 'patientId'),
      item.state === 'unavailable' ? unavailableDetail(item) : 'Source visit returned · billing fields not yet read', () => relatedSourceControl('billing', view, item, relatedContext)]), 'sourceBillingTable'),
      node('p', 'Per-visit billed flags, rates, minutes and amounts come from GetVisitBillInfoV2. These are not collected cash, payer adjudication or an accounts-receivable ledger.', 'source-metadata'));
    replace('dashboardBillingFacts', node('p', metadata?.panels?.billingFacts?.available ? 'Choose Read billing facts for a current identity-checked source read.' : 'GetVisitBillInfoV2 is not enabled for this source context. Review read controls in Settings.'));
    renderSourcePatients(view, sourceNote());
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
      values.forEach((value, index) => {
        const cell = node('td');
        if (['sourceVisitTable', 'sourceStaffingTable', 'sourceBillingTable'].includes(id)) cell.setAttribute('data-label', headers[index]);
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
  function filterSourceExceptions() {
    const term = (get('exceptionSearch')?.value || '').trim().toLowerCase();
    for (const row of get('dashboardExceptions')?.querySelectorAll('tbody tr') || []) row.hidden = !!term && !row.textContent.toLowerCase().includes(term);
  }
  function renderExceptions() {
    if (controller.isLive()) { filterSourceExceptions(); return; }
    const model = fixtures.dashboard(dateInput?.value || localDay());
    const rows = filterExceptions(model.exceptions, get('exceptionSearch')?.value, get('priorityFilter')?.value);
    replace('dashboardExceptions', table(['Visit', 'Example exception', 'Scheduled start', 'Scheduled end', 'Example visibility', 'Example priority'],
      rows.map(item => [item.id, item.issue, item.scheduledStart, item.scheduledEnd, item.visibility, item.priority]), 'exceptionTable'));
  }
  function invalidateSourceContext(fromFeed = false) {
    stopFeedTimer();
    if (!fromFeed) cancelFeedRead();
    feedReceipt = null;
    clearPageFetchAge();
    patientAbort?.abort(); patientAbort = null; patientRequest++;
    clearPatientFetchAge(); replace('dashboardPatientProfile');
    for (const [kind, state] of Object.entries(relatedRequests)) {
      state.abort?.abort(); state.abort = null; state.sequence++; state.clearAge();
      replace(kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts');
    }
    serial += 1;
    document.dispatchEvent(new Event('primetime-source-context-cleared'));
  }
  function clearSource() {
    feedControls();
    sourceClearControls(false);
    invalidateSourceContext();
    abort?.abort();
    abort = null;
    metadata = null;
    resetPaging();
    demoOffset = 0;
    if (controller.isLive()) {
      text('dataModeBadge', ready ? 'Live · access not checked' : 'Live · sign in required');
      text('environmentDetails', ready ? 'Source access not checked' : 'Sign in required');
    }
    hosts.forEach(id => replace(id));
    text('dashboardVisitStatus', 'Live visit preview unavailable until source access is checked.');
    text('dashboardVisitMetadata', '');
    text('dashboardVisitCompleteness', '');
    text('dashboardVisitScope', 'Office not configured');
    nextPageButton(false);
    refreshDisabled(!ready);
    document.querySelectorAll('[data-demo-badge]').forEach(badge => { badge.textContent = ''; badge.hidden = true; });
    renderDateContext();
  }
  function clearLoadedPage() {
    if (!ready || !controller.isLive() || !sourceClearable) return false;
    pauseFeed('Live feed display paused because the source page was cleared. Resume live feed to reconnect.');
    invalidateSourceContext();
    abort?.abort(); abort = null; metadata = null;
    resetPaging(); sourceClearControls(false);
    const detail = 'No current source page is loaded. Read source now checks access and loads the selected day. Saved calendar imports remain stored separately.';
    liveOverviewState('Source page cleared', detail);
    unavailable('dashboardVisitRows', 'Source page cleared', detail);
    text('dashboardVisitStatus', 'Source page cleared from both live views. Choose Read source now to load a source page.');
    text('dashboardVisitMetadata', ''); text('dashboardVisitCompleteness', '');
    text('dashboardVisitScope', 'No source page loaded. Office access will be checked on the next read.');
    text('dataModeBadge', 'Live · no source page');
    text('environmentDetails', 'No source page loaded');
    refreshDisabled(!ready);
    renderDateContext();
    return true;
  }
  function renderMode() {
    clearSource();
    feedControls();
    const live = controller.isLive();
    const date = dateInput?.value || localDay();
    const demo = !live;
    text('dashboardEvidenceTitle', demo ? 'Example EVV exception queue' : 'EVV source evidence');
    text('dashboardCoverageTitle', demo ? 'Example coverage' : 'Caregiver assignment evidence');
    text('dashboardAlertsTitle', demo ? 'Example manager inbox' : 'Source evidence gaps');
    text('staffingEvidenceTitle', demo ? 'Example open shifts' : 'Visit assignment evidence');
    text('evvPanelTitle', demo ? 'Example EVV exceptions' : 'EVV source clock evidence');
    ['dashboardOverviewRefresh', 'dashboardVisitRefresh'].forEach(id => text(id, demo ? 'Refresh examples' : 'Read source now'));
    if (get('demoDataToggle')) get('demoDataToggle').checked = demo;
    text('demoToggleState', demo ? 'On' : 'Off');
    text('dataModeBadge', demo ? 'Demo · synthetic' : 'Live · validation pending');
    if (get('dataModeBadge')) get('dataModeBadge').className = 'data-mode-badge ' + (demo ? 'demo' : 'live');
    text('environmentMode', demo ? 'Demo data' : 'Live source preview');
    text('environmentDetails', demo ? 'Synthetic preview records' : 'Source validation pending');
    text('dashboardModeNotice', demo
      ? 'Demo data is on. All preview records are synthetic; messages and HHA changes are disabled.'
      : feedInstalled ? 'Live HHA API mode. The server refreshes the current office day’s first source page every minute. Charts describe only this bounded page. Read source now and paging remain available; saved captures are separate.'
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
    unavailable('dashboardPatients', 'Current patient source is paused', 'Switch Demo data off to read real patients from the selected visit page.');
    replace('dashboardPatientProfile');
    replace('dashboardCaregiverProfile'); replace('dashboardBillingFacts');
    const pipeline = node('div', null, 'pipeline');
    [['Scheduled', hours(model.billing.projectedMinutes)], ['Completed', hours(model.billing.completedMinutes)], ['Ready', hours(model.billing.readyMinutes)], ['Submitted', 'Unavailable'], ['Paid', 'Unavailable']].forEach(([label, value]) => { const stage = node('div'); stage.append(node('span', label), node('strong', value)); pipeline.append(stage); });
    replace('dashboardBillingPipeline', pipeline);
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
    const pair = (start, end) => `${start || 'Not supplied by HHA'}\n${end || 'Not supplied by HHA'}`;
    const captured = context();
    const { sourceScheduleHours, sourceActualHours } = window.primetimeSourceTime;
    const detailCells = item => item.state === 'unavailable' ? Array(5).fill('Detail unavailable') : [
      pair(item.scheduledStart, item.scheduledEnd), pair(item.actualStart, item.actualEnd), pair(item.evvStart, item.evvEnd),
      view.mode === 'demo' ? 'Synthetic example' : sourceScheduleHours(item.scheduleDurationHours, item.scheduleDurationMinutes, null, item.scheduledStart, item.scheduledEnd),
      view.mode === 'demo' ? 'Synthetic example' : sourceActualHours(item.actualHours, null, item.actualStart, item.actualEnd)];
    replace('dashboardVisitRows', table(['Visit', 'Patient ID', 'Caregiver ID', 'Scheduled start / end', 'Actual start / end', 'EVV start / end', 'Expected hours (HHA)', 'Actual hours (HHA)', 'Evidence state', 'Source records'],
      view.items.map(item => [item.id, item.patientId, item.caregiverId, ...detailCells(item),
        item.state === 'unavailable' ? 'Detail unavailable: ' + item.detailReason : view.mode === 'demo' ? 'Synthetic example' : 'Source unvalidated', view.mode === 'demo' ? 'Synthetic record' : () => sourceRecordTools(view, item, captured)]), 'sourceVisitTable'));
    text('dashboardVisitStatus', view.mode === 'demo' ? 'Synthetic visit examples. No source request was made.' : view.state === 'partial' ? 'Partial source page returned. More pages, truncated search results or unavailable details are disclosed below.' : view.state === 'empty' ? 'No visit identifiers returned for this query. Complete office coverage is not established.' : 'Live HHA source page returned. Source fields are shown separately; operational classifications are pending.');
    text('dashboardVisitScope', `Office: ${view.scope.officeId || 'Unavailable'} · Date: ${view.scope.date} · Timezone: ${view.scope.timezone || 'Unconfigured'}`);
    text('dashboardVisitMetadata', view.mode === 'demo' ? 'Source: synthetic examples · values are not patient records.' : `Source: HHAeXchange · fetched: ${view.fetchedAt || 'Unavailable'} · source unvalidated · on-demand read, not a persisted visit import · source time values shown without conversion. Source clock spans are written-time arithmetic, not elapsed, payable or billable time.`);
    const pageScope = view.page && view.discovery ? `Showing source IDs ${view.items.length ? view.page.offset + 1 : 0}–${view.page.offset + view.items.length} of ${view.discovery.selectedCount} returned by search. ` : `${view.items.length} source record(s) on this page. `;
    text('dashboardVisitCompleteness', view.mode === 'demo' ? 'Example page only.' : `${pageScope}Charts use this page only. Office totals are unknown; complete office coverage is not established. Read limits: received search IDs retained; 10 details per page and a 25-second detail-read budget.${view.truncated ? ' Source identifier results were truncated.' : ''}`);
    nextPageButton(Boolean(nextCursor));
    previousPageButton(view.mode === 'demo' ? demoOffset > 0 : pagePosition > 0);
    pageFetchAge(view, captured);
  }
  function pageFetchAge(view, captured) {
    clearPageFetchAge();
    if (view.mode !== 'live') return;
    const nodes = ['dashboardOverviewFetchAge', 'dashboardVisitFetchAge'].map(get).filter(Boolean);
    const { timestampInstant, watchFetchAge } = window.primetimeSourceTime;
    const fetched = timestampInstant(view.fetchedAt);
    if (!nodes.length) return;
    clearPageFetchAge = watchFetchAge(fetched,
      () => current(captured) && controller.isLive() && dateInput?.value === view.scope.date && metadata?.settings?.officeId === view.scope.officeId,
      value => nodes.forEach(item => { item.hidden = false; if (item.textContent !== value) item.textContent = value; }),
      () => nodes.forEach(item => { item.hidden = true; item.textContent = ''; }));
  }
  function context() { return { generation: controller.getGeneration(), mode: controller.getMode(), session, serial }; }
  function relatedSourceControl(kind, view, item, captured) {
    if (item.state === 'unavailable' || !item.patientId || (kind === 'caregiver' && !item.caregiverId)) return node('span', 'Source identity unavailable');
    const control = node('button', kind === 'caregiver' ? 'View caregiver profile' : 'Read billing facts', 'btn secondary'); control.type = 'button';
    const availability = metadata?.panels?.[kind === 'caregiver' ? 'caregiverProfile' : 'billingFacts'];
    control.disabled = availability?.available !== true;
    if (control.disabled) control.title = 'Required HHA read is not enabled for this context. Review Settings.';
    control.addEventListener('click', () => { if (!control.disabled) void loadVisitContext(kind, view, item, captured); }); return control;
  }
  async function loadVisitContext(kind, view, item, captured) {
    if (!current(captured) || !controller.isLive() || metadata?.settings?.officeId !== view.scope.officeId) return;
    const state = relatedRequests[kind], host = kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts';
    if (Date.now() < state.retryAt) { replace(host, node('p', `Source read limit reached. Retry in ${Math.ceil((state.retryAt - Date.now()) / 1000)} seconds.`)); return; }
    pauseFeed('Live feed display paused for source record review. Resume live feed to return to the latest visit page.');
    state.abort?.abort(); state.clearAge();
    const request = new AbortController(), sequence = ++state.sequence; state.abort = request;
    const scope = { kind, visitId: item.id, patientId: item.patientId, officeId: view.scope.officeId, ...(kind === 'caregiver' ? { caregiverId: item.caregiverId } : {}) };
    const active = () => current(captured) && state.sequence === sequence && !request.signal.aborted;
    replace(host, node('p', 'Reading current source fields and verifying visit, patient and office…'));
    try {
      const response = await window.primetimeApiFetch('/primetime/api/workspace/visit-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scope), signal: request.signal });
      const payload = await response.json(); if (!active()) return;
      if (!response.ok) {
        if (response.status === 429 && Number.isSafeInteger(payload.retryAfterSeconds) && payload.retryAfterSeconds > 0 && payload.retryAfterSeconds <= 600) {
          state.retryAt = Date.now() + payload.retryAfterSeconds * 1000; throw new Error(`Source read limit reached. Retry in ${payload.retryAfterSeconds} seconds.`);
        }
        throw new Error(({ visit_context_source_empty: kind === 'caregiver' ? 'This read returned no caregiver profile. Staff availability and eligibility remain unknown. Retry from the source page.' : 'This read returned no billing record. This does not establish zero charges, payment or an AR balance. Retry from the source page.',
          read_not_owner_enabled: 'The required source read is not enabled. Reload the page and review Settings.', caregiver_office_mismatch: 'The caregiver’s current office membership could not be verified.',
          visit_caregiver_changed_restart: 'The visit’s current caregiver changed. Reload the source page.', billing_visit_patient_mismatch: 'The billing source did not match the selected visit and patient.',
          billing_source_changed_restart: 'Visit and billing source details differ. Reload the source page before retrying.', office_policy_changed_restart: 'Office preferences changed. Reload the source page.',
          operational_data_release_not_approved: 'Source records are locked pending operational data release.' })[payload.error] || 'The source request could not be verified. Retry from the source page.');
      }
      const checked = normalizeVisitContext(payload, scope), age = node('p', null, 'source-metadata');
      const labels = { ID: kind === 'caregiver' ? 'Caregiver ID' : 'Visit ID', FirstName: 'First name', LastName: 'Last name', CaregiverCode: 'Caregiver reference code', 'Status/Name': 'Status (source)', TimeZone: 'Timezone (source)', LastModifiedDate: 'Last modified (source)', VisitDate: 'Visit date (source)', 'Patient/ID': 'Patient ID', 'Caregiver/ID': 'Caregiver ID' };
      const label = key => labels[key] || key.replace('PrimaryBillTo/', 'Primary · ').replace('SecondaryBillTo/', 'Secondary · ').replace('Contract/ID', 'Contract ID').replace('IsBilled', 'Is billed (source)').replace('BilledRate', 'Billed rate (source)').replace('BilledMinutes', 'Billed minutes (source)').replace('BilledAmount', 'Billed amount (source)');
      const caregiverId = kind === 'billing' ? checked.fields['Caregiver/ID'] : checked.fields.ID;
      const currentItem = { ...item, caregiverId: typeof caregiverId === 'string' && /^[1-9]\d{0,9}$/.test(caregiverId) && Number(caregiverId) <= 2147483647 ? caregiverId : null };
      replace(host, node('p', `HHA ${payload.operation} · fetched ${checked.fetchedAt} · patient office checked ${checked.membershipCheckedAt}. Independent source reads; source values remain unvalidated.`, 'source-metadata'), age,
        node('p', kind === 'caregiver' ? 'Current office membership is checked from CaregiverOffices/Office/OfficeID. This profile does not establish qualification, eligibility or availability.' : 'Visit, patient, caregiver and source visit date matched current visit evidence. Billed source fields do not establish cash received, billable approval or a complete ledger.', 'source-metadata'),
        table(['Source field', 'Source value'], Object.entries(checked.fields).map(([key, value]) => [label(key), value || 'Not supplied by HHA'])), sourceRecordTools(view, currentItem, captured, active));
      state.clearAge = window.primetimeSourceTime.watchFetchAge(window.primetimeSourceTime.timestampInstant(checked.fetchedAt), active, value => { age.textContent = value; }, () => { age.textContent = ''; });
    } catch (error) { if (active()) replace(host, node('p', error.message === 'invalid_visit_context' ? 'The source response could not be verified. Reload the source page.' : error.message)); }
    finally { if (state.abort === request) state.abort = null; }
  }
  function renderSourcePatients(view, sourceNote) {
    const captured = context(), grouped = new Map();
    for (const item of view.items) {
      if (item.state === 'unavailable' || typeof item.patientId !== 'string' || !/^[1-9]\d{0,9}$/.test(item.patientId)) continue;
      const group = grouped.get(item.patientId);
      if (group) group.visits++;
      else grouped.set(item.patientId, { item, visits: 1 });
    }
    replace('dashboardPatients', sourceNote, table(['Patient reference', 'Visits on this page', 'Current source details'],
      [...grouped.values()].map(({ item, visits }) => [item.patientId, visits, () => {
        const control = node('button', 'View current profile', 'btn secondary'); control.type = 'button';
        control.addEventListener('click', () => { void loadPatientProfile(view, item, captured); }); return control;
      }])), node('p', 'Only patients from readable visits on the selected page are listed. Choose a visit date or another source page in Overview to change this list.', 'source-metadata'));
    replace('dashboardPatientProfile', node('p', 'Choose View current profile to read fresh HHA patient fields. Saved calendar captures remain separate.'));
  }
  async function loadPatientProfile(view, item, captured) {
    if (!current(captured) || !controller.isLive() || metadata?.settings?.officeId !== view.scope.officeId) return;
    if (Date.now() < patientRetryAt) {
      replace('dashboardPatientProfile', node('p', `Source read limit reached. Retry in ${Math.ceil((patientRetryAt - Date.now()) / 1000)} seconds.`)); return;
    }
    pauseFeed('Live feed display paused for current patient review. Resume live feed to return to the latest visit page.');
    patientAbort?.abort(); clearPatientFetchAge();
    const request = new AbortController(), sequence = ++patientRequest; patientAbort = request;
    const scope = { visitId: item.id, patientId: item.patientId, officeId: view.scope.officeId };
    replace('dashboardPatientProfile', node('p', 'Reading current HHA patient fields and checking visit / patient / office membership…'));
    const active = () => current(captured) && sequence === patientRequest && !request.signal.aborted;
    try {
      const response = await window.primetimeApiFetch('/primetime/api/workspace/visit-patient', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scope), signal: request.signal
      });
      const payload = await response.json();
      if (!active()) return;
      if (!response.ok) {
        if (response.status === 429 && Number.isSafeInteger(payload.retryAfterSeconds) && payload.retryAfterSeconds > 0 && payload.retryAfterSeconds <= 600) {
          patientRetryAt = Date.now() + payload.retryAfterSeconds * 1000;
          throw new Error(`Source read limit reached. Retry in ${payload.retryAfterSeconds} seconds.`);
        }
        throw new Error(({ read_not_owner_enabled: 'The required patient source read is not enabled in owner controls.',
          operational_data_release_not_approved: 'Patient source access is locked pending operational data release.',
          office_policy_changed_restart: 'Office preferences changed. Reload the source page before retrying.',
          visit_patient_mismatch: 'The current visit no longer matches this patient. Reload the source page.',
          patient_office_mismatch: 'Current patient office membership could not be verified.' })[payload.error] || 'Current patient source read could not be completed. Retry from the source page.');
      }
      const profile = normalizePatientProfile(payload, scope);
      const labels = { PatientID: 'Patient ID', OfficeID: 'Office ID', FirstName: 'First name', LastName: 'Last name', PatientStatusName: 'Patient status (source)', AdmissionID: 'Admission reference', PayerID: 'Payer reference', PayerName: 'Payer name (source)', LastModifiedDate: 'Last modified (source)' };
      const receipt = node('p', `HHA GetPatientDemographics · fetched ${profile.fetchedAt} · current visit / patient / office checked. Source fields are unvalidated; this does not establish coverage or clinical acceptance.`, 'source-metadata');
      const age = node('p', null, 'source-metadata');
      replace('dashboardPatientProfile', receipt, age, table(['Source field', 'Source value'], Object.entries(profile.fields).map(([key, value]) => [labels[key], value || 'Not supplied by HHA'])), sourceRecordTools(view, item, captured, active));
      clearPatientFetchAge = window.primetimeSourceTime.watchFetchAge(window.primetimeSourceTime.timestampInstant(profile.fetchedAt), active,
        value => { age.textContent = value; }, () => { age.textContent = ''; });
    } catch (error) {
      if (active()) replace('dashboardPatientProfile', node('p', error.message === 'invalid_patient_profile' ? 'Patient source response could not be verified. Reload the source page before retrying.' : error.message));
    } finally { if (patientAbort === request) patientAbort = null; }
  }
  function sourceRecordTools(view, item, captured, active = () => true) {
    const tools = node('div', null, 'source-record-tools');
    if (view.mode !== 'live' || item.state === 'unavailable') return tools;
    for (const [kind, id] of [['patient', item.patientId], ['caregiver', item.caregiverId], ['visit', item.id], ['patient-history', item.patientId], ['patient-authorizations', item.patientId], ['patient-care-plans', item.patientId], ['patient-documents', item.patientId]]) {
      if (typeof id !== 'string' || !/^[1-9]\d{0,9}$/.test(id)) continue;
      const label = kind === 'patient-history' ? 'Saved calendar history' : kind === 'patient-authorizations' ? 'Open patient authorizations'
        : kind === 'patient-care-plans' ? 'Find patient care plans' : kind === 'patient-documents' ? 'Find patient documents' : `Open ${kind} read`;
      const control = node('button', label, 'btn secondary'); control.type = 'button';
      control.addEventListener('click', () => {
        if (!active() || !current(captured) || !controller.isLive() || metadata?.settings?.officeId !== view.scope.officeId) return;
        if (feedInstalled) pauseFeed('Live feed display paused for record review. Resume live feed when ready to return to the latest page.');
        document.dispatchEvent(new CustomEvent('primetime-source-record-selected', { detail: { kind, id, officeId: view.scope.officeId } }));
      });
      tools.append(control);
    }
    if (!tools.children.length) return tools;
    const menu = node('details', null, 'source-record-menu');
    menu.append(node('summary', 'Open records', 'btn secondary'), tools);
    return menu;
  }
  function current(captured) { return ready && captured.generation === controller.getGeneration() && captured.mode === controller.getMode() && captured.session === session && captured.serial === serial; }
  function blockedMessage(reason) {
    return ({ operational_data_release_not_approved: 'Live source access has not been approved.', office_timezone_not_configured: 'The owner must configure an office and office timezone.', visit_reads_not_owner_enabled: 'Required visit reads have not been enabled by the owner.', vendor_contract_blocked: 'The vendor contract for this read requires review.' })[reason] || 'Live visit source access is unavailable. Review owner controls and deployment approval.';
  }
  async function loadMetadata() {
    if (!ready || !controller.isLive()) return;
    invalidateSourceContext();
    abort?.abort();
    const captured = context();
    abort = new AbortController();
    sourceClearControls(true);
    refreshDisabled(true);
    liveOverviewState('Checking live source access', 'Loading the selected office settings and enabled HHA reads…');
    text('dataModeBadge', 'Live · checking access');
    text('environmentDetails', 'Checking HHA source access');
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
      renderDateContext();
      if (payload.dataApproved !== true || payload.panels?.visits?.available !== true) {
        const detail = blockedMessage(payload.panels?.visits?.blockedReason);
        text('dataModeBadge', 'Live · unavailable');
        text('environmentDetails', 'HHA visit source access unavailable');
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
      text('dataModeBadge', 'Live · unavailable');
      text('environmentDetails', 'Source access status unavailable');
    } finally {
      if (current(captured)) { refreshDisabled(false); scheduleFeed(); }
    }
  }
  async function loadVisits(cursor = null, trail = [null], position = 0) {
    if (!ready || !controller.isLive()) return;
    if (metadata?.dataApproved !== true || metadata?.panels?.visits?.available !== true) { await loadMetadata(); return; }
    invalidateSourceContext();
    abort?.abort();
    abort = new AbortController();
    const captured = context();
    const date = dateInput?.value || '';
    sourceClearControls(true);
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
      text('dataModeBadge', 'Live · date required');
      text('environmentDetails', 'Choose a service date');
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
          text('dataModeBadge', response.status === 409 ? 'Live · refresh required' : 'Live · unavailable');
          text('environmentDetails', response.status === 409 ? 'Source scope or evidence changed' : 'HHA visit source access unavailable');
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
      if (current(captured)) { refreshDisabled(false); scheduleFeed(); }
    }
  }
  get('demoDataToggle')?.addEventListener('change', event => controller.setMode(event.target.checked ? 'demo' : 'live'));
  get('exceptionSearch')?.addEventListener('input', renderExceptions);
  get('priorityFilter')?.addEventListener('change', renderExceptions);
  dateInput?.addEventListener('change', () => {
    dateChosen = true;
    if (get('dashboardOverviewDate')) get('dashboardOverviewDate').value = dateInput.value;
    renderDateContext();
    if (controller.isLive()) void loadVisits(); else { demoOffset = 0; renderMode(); }
  });
  get('dashboardOverviewDate')?.addEventListener('change', () => {
    dateChosen = true;
    if (dateInput) dateInput.value = get('dashboardOverviewDate').value;
    renderDateContext();
    if (controller.isLive()) void loadVisits(); else { demoOffset = 0; renderMode(); }
  });
  const refresh = () => {
    if (controller.isLive()) { clearSource(); void loadMetadata(); } else { demoOffset = 0; showVisitPreview(fixtures.visitPage(dateInput.value), { mode: 'demo', date: dateInput.value }); }
  };
  get('dashboardVisitRefresh')?.addEventListener('click', refresh);
  get('dashboardOverviewRefresh')?.addEventListener('click', refresh);
  for (const [clear, read] of [['dashboardOverviewClear', 'dashboardOverviewRefresh'], ['dashboardVisitClear', 'dashboardVisitRefresh']]) {
    get(clear)?.addEventListener('click', () => { if (clearLoadedPage()) get(read)?.focus(); });
  }
  const advancePage = () => {
    if (!nextCursor) return;
    if (feedInstalled) pauseFeed('Live feed display paused for source paging. Resume returns to the current day’s first source page.');
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
  get('apiFeedToggle')?.addEventListener('click', () => {
    if (!ready || !controller.isLive()) return;
    if (feedEnabled) pauseFeed();
    else { feedEnabled = true; feedControls(); void pollFeed(); }
  });
  get('apiFeedToday')?.addEventListener('click', () => {
    if (!canReturnToday()) { renderDateContext(); return; }
    const day = currentOfficeDay();
    invalidateSourceContext(); abort?.abort(); abort = null;
    resetPaging(); dateChosen = false;
    dateInput.value = day;
    if (get('dashboardOverviewDate')) get('dashboardOverviewDate').value = day;
    const detail = 'Reading office today. Previous source page values have been cleared.';
    liveOverviewState('Loading office today', detail);
    unavailable('dashboardVisitRows', 'Loading office today', detail);
    text('dashboardVisitMetadata', ''); text('dashboardVisitCompleteness', '');
    text('dashboardVisitStatus', detail);
    text('dashboardVisitScope', `Office: ${metadata.settings.officeId} · Date: ${day} · Timezone: ${metadata.settings.officeTimezone}`);
    text('dataModeBadge', 'Live · loading'); text('environmentDetails', 'Loading office today');
    sourceClearControls(true); refreshDisabled(false);
    feedEnabled = true; feedControls();
    get('apiFeedToday')?.focus();
    void pollFeed();
  });
  document.addEventListener('visibilitychange', () => {
    stopFeedTimer();
    if (document.visibilityState === 'hidden') { cancelFeedRead(); feedControls('Dashboard checks paused while hidden. The server API feed continues every minute.'); }
    else if (feedEnabled && ready && controller.isLive()) void pollFeed();
  });
  document.addEventListener('primetime-data-mode-changed', () => { renderMode(); if (ready && controller.isLive()) void loadMetadata(); });
  document.addEventListener('primetime-ready', () => { ready = true; session += 1; renderMode(); if (controller.isLive()) void loadMetadata(); });
  document.addEventListener('primetime-signed-out', () => { ready = false; session += 1; clearSource(); if (!controller.isLive()) renderMode(); });
  renderMode();
})();
