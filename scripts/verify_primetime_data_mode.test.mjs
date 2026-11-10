import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const asset = name => readFileSync(new URL(`../public/primetime/${name}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const sourcePath = '/primetime/api/workspace/read';
const sourceRequest = { method: 'POST', body: JSON.stringify({ operation: 'GetVisitInfoV3', id: '123' }) };

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class DetailEvent extends Event {
  constructor(type, options = {}) { super(type, options); this.detail = options.detail; }
}

function response(payload = { ok: true }) {
  return {
    ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/json' }),
    async json() { return payload; },
    async text() { return JSON.stringify(payload); },
    async arrayBuffer() { return new TextEncoder().encode(JSON.stringify(payload)).buffer; },
    async bytes() { return new TextEncoder().encode(JSON.stringify(payload)); },
    async blob() { return new Blob([JSON.stringify(payload)]); },
    async formData() { return payload; },
    clone() { return response(payload); }
  };
}

function harness({ includeApp = true, storedDataMode = 'demo', metadata, fetchSource = () => response({ ok: true, records: [{ ID: '123', PatientID: 'LIVE-ONLY' }] }) } = {}) {
  const elements = new Map(), listeners = new Map(), calls = [], events = [];
  const intervals = new Map(); let intervalId = 0;
  function node(id = '') {
    const classes = new Set();
    const item = {
      id, children: [], handlers: new Map(), options: [], dataset: {}, value: '', checked: false,
      hidden: id === 'appShell', disabled: false, textContent: '',
      classList: { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
      addEventListener(type, fn) { const handlers = this.handlers.get(type) || []; handlers.push(fn); this.handlers.set(type, handlers); },
      append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
      querySelectorAll() { return []; }, querySelector() { return null; },
      closest(selector = '') { return selector.startsWith('#dashboardVisitRows') ? null : { hidden: false }; },
      setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
      focus() { document.activeElement = this; }, reset() { this.value = ''; }, remove() {}
    };
    return item;
  }
  function element(id) {
    if (id === 'capabilityRows') return null;
    if (!elements.has(id)) elements.set(id, node(id));
    return elements.get(id);
  }
  const modeButtons = ['demo', 'live'].map(mode => { const item = node(); item.dataset.dataMode = mode; item.dataset.mode = mode; return item; });
  const demoBadges = ['exceptions', 'alerts'].map(kind => { const item = element(`fixture-${kind}-badge`); item.dataset.demoBadge = kind; return item; });
  const document = {
    body: node('body'), documentElement: node('documentElement'), activeElement: null,
    getElementById: element, createElement: tag => Object.assign(node(), { tagName: tag.toUpperCase() }), createElementNS: () => node(), createTextNode: text => ({ textContent: text }),
    querySelectorAll(selector) { return selector === '[data-demo-badge]' ? demoBadges : selector === '[data-data-mode]' || selector === '[data-mode]' ? modeButtons : []; },
    addEventListener(type, fn) { const handlers = listeners.get(type) || []; handlers.push(fn); listeners.set(type, handlers); },
    dispatchEvent(event) { events.push(event); for (const fn of listeners.get(event.type) || []) fn(event); return true; }
  };
  document.activeElement = document.body;
  const auth = {
    currentUser: null,
    onAuthStateChanged(callback) { this.callback = callback; },
    isSignInWithEmailLink() { return false; },
    async setPersistence() {},
    async signOut() { this.currentUser = null; await this.callback?.(null); }
  };
  const storage = new Map();
  const sessionStorage = new Map(storedDataMode ? [['primetime.dataMode', storedDataMode]] : []);
  const location = { hash: '', href: 'https://pthhs.net/primetime', origin: 'https://pthhs.net' };
  const window = {
    firebase: { auth: Object.assign(() => auth, { Auth: { Persistence: { SESSION: 'session' } } }) },
    innerWidth: 1200, location,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    sessionStorage: { getItem: key => sessionStorage.get(key) || null, setItem: (key, value) => sessionStorage.set(key, value), removeItem: key => sessionStorage.delete(key) },
    confirm: () => true
  };
  const context = vm.createContext({
    document, window, location, Headers, URL, URLSearchParams, Event, CustomEvent: DetailEvent, AbortController,
    Blob, TextEncoder, console, setTimeout, clearTimeout, crypto: { randomUUID: () => 'fixture-proposal' },
    setInterval(callback, delay) { const id = ++intervalId; intervals.set(id, { callback, delay }); return id; },
    clearInterval(id) { intervals.delete(id); },
    history: { replaceState(_state, _title, url) { location.href = new URL(url, location.href).href; } },
    fetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.endsWith('/session')) return response({ ok: true, roles: ['admin'], email: 'fixture@example.test' });
      if (path.endsWith('/data/status')) return response(metadata || { ok: true, mode: 'live', dataApproved: false, operationalDataApproved: false, state: 'locked' });
      if (path.endsWith('/status')) return response({ ok: true, service: 'primetime-admin-api' });
      return fetchSource(path, options);
    }
  });
  vm.runInContext(asset('data-source.js'), context);
  if (includeApp) vm.runInContext(asset('primetime.js'), context);
  return {
    window, document, element, calls, events, auth, context, intervals,
    dispatch(type) { document.dispatchEvent(new Event(type)); },
    async click(id) { for (const fn of element(id).handlers.get('click') || []) await fn(new Event('click')); },
    async signIn() {
      const user = { uid: 'approved-fixture', email: 'fixture@example.test', getIdToken: async () => 'fixture-token' };
      auth.currentUser = user;
      await auth.callback(user);
      await tick();
      assert.equal(element('appShell').hidden, false, 'fixture administrator must reach the app');
      return user;
    },
    async live() { await window.primetimeDataMode.setMode('live'); await tick(); assert.equal(window.primetimeDataMode.getMode(), 'live'); }
  };
}

test('mode controller defaults to Live and sign-out invalidates source generation', async () => {
  const app = harness({ includeApp: false, storedDataMode: null });
  const mode = app.window.primetimeDataMode;
  assert.equal(mode.getMode(), 'live');
  assert.equal(mode.isLive(), true);
  app.dispatch('primetime-ready');
  await app.live();
  const liveGeneration = mode.getGeneration();
  app.dispatch('primetime-signed-out');
  assert.equal(mode.getMode(), 'live');
  assert.equal(mode.isLive(), true);
  assert.ok(mode.getGeneration() > liveGeneration);
  const changed = app.events.filter(event => event.type === 'primetime-data-mode-changed').at(-1);
  assert.equal(changed.detail.mode, 'live');
  assert.equal(changed.detail.generation, mode.getGeneration());
});

test('an invalid source mode cannot alter the current selection or generation', () => {
  const app = harness({ includeApp: false });
  const mode = app.window.primetimeDataMode;
  const before = mode.getGeneration();
  assert.throws(() => mode.setMode('automatic'));
  assert.equal(mode.getMode(), 'demo');
  assert.equal(mode.getGeneration(), before);
});

test('selecting Live cannot bypass administrator session acceptance', async () => {
  const app = harness();
  app.auth.currentUser = { uid: 'not-approved-yet', getIdToken: async () => 'fixture-token' };
  app.window.primetimeDataMode.setMode('live');
  await assert.rejects(app.window.primetimeApiFetch(sourcePath, sourceRequest));
  assert.equal(app.calls.length, 0);
});

test('Demo sign-in and integration refresh make zero source requests', async () => {
  const app = harness();
  await app.signIn();
  await app.click('refreshIntegration');
  await tick();
  assert.equal(app.window.primetimeDataMode.getMode(), 'demo');
  assert.equal(app.calls.filter(call => !/^\/primetime\/api\/(session|status|data\/status)$/.test(call.path)).length, 0);
});

test('Demo blocks source reads, writes and path lookalikes before fetch', async () => {
  const app = harness();
  await app.signIn();
  const paths = [
    ['/primetime/api/hha/health', {}], ['/primetime/api/integration/health', {}],
    [sourcePath, sourceRequest], ['/primetime/api/workspace/settings', {}],
    ['/primetime/api/workspace/settings', { method: 'POST' }],
    ['/primetime/api/session', { method: 'POST' }], ['/primetime/api/status', { method: 'DELETE' }],
    ['/primetime/api/data/status', { method: 'POST' }], ['/primetime/api/data/status/other', {}],
    ['/primetime/api/status-other', {}], ['/primetime/api/session/other', {}]
  ];
  const before = app.calls.length;
  for (const [path, options] of paths) await assert.rejects(app.window.primetimeApiFetch(path, options));
  assert.equal(app.calls.length, before, 'blocked requests must never reach fetch');
});

test('Demo permits only the exact non-source GET routes', async () => {
  const app = harness();
  await app.signIn();
  for (const path of ['/primetime/api/session', '/primetime/api/status', '/primetime/api/data/status']) {
    const before = app.calls.length;
    const result = await app.window.primetimeApiFetch(path, { method: 'GET' });
    assert.equal((await result.json()).ok, true);
    assert.equal(app.calls.length, before + 1);
    const call = app.calls.at(-1);
    assert.equal(call.options.headers.get('Authorization'), 'Bearer fixture-token');
    assert.equal(call.options.cache, 'no-store');
  }
});

test('Live token resolution cannot dispatch after switching to Demo and back', async () => {
  const app = harness();
  const user = await app.signIn();
  await app.live();
  const token = deferred();
  user.getIdToken = () => token.promise;
  const before = app.calls.filter(call => call.path === sourcePath).length;
  const pending = app.window.primetimeApiFetch(sourcePath, sourceRequest);
  const rejected = assert.rejects(pending);
  app.window.primetimeDataMode.setMode('demo');
  app.window.primetimeDataMode.setMode('live');
  token.resolve('obsolete-token');
  await rejected;
  assert.equal(app.calls.filter(call => call.path === sourcePath).length, before);
});

test('a delayed Live fetch cannot return data after a mode switch even if transport ignores abort', async () => {
  const network = deferred();
  const app = harness({ fetchSource: path => path === sourcePath ? network.promise : response({ ok: true }) });
  await app.signIn();
  await app.live();
  const pending = app.window.primetimeApiFetch(sourcePath, sourceRequest);
  const rejected = assert.rejects(pending);
  await tick();
  const call = app.calls.findLast(call => call.path === sourcePath);
  assert.equal(call.options.signal.aborted, false);
  assert.equal(call.options.headers.get('X-Primetime-Data-Mode'), 'live');
  app.window.primetimeDataMode.setMode('demo');
  assert.equal(call.options.signal.aborted, true, 'the network request must also be cancelled');
  network.resolve(response({ ok: true, records: [{ ID: 'LIVE-ONLY' }] }));
  await rejected;
});

for (const method of ['json', 'text', 'arrayBuffer', 'bytes', 'blob', 'formData']) {
  test(`a Live ${method} body read cannot return data after a mode switch`, async () => {
    const body = deferred();
    const wire = response({ ok: true });
    wire[method] = () => body.promise;
    const app = harness({ fetchSource: path => path === sourcePath ? wire : response({ ok: true }) });
    await app.signIn();
    await app.live();
    const result = await app.window.primetimeApiFetch(sourcePath, sourceRequest);
    const pending = result[method]();
    const rejected = assert.rejects(pending);
    app.window.primetimeDataMode.setMode('demo');
    body.resolve(method === 'json' ? { ok: true, records: [{ ID: 'LIVE-ONLY' }] } : 'LIVE-ONLY');
    await rejected;
  });
}

test('a body read started after switching mode cannot consume the obsolete response', async () => {
  let consumed = 0;
  const wire = response({ ok: true });
  wire.json = async () => { consumed += 1; return { records: [{ ID: 'LIVE-ONLY' }] }; };
  const app = harness({ fetchSource: path => path === sourcePath ? wire : response({ ok: true }) });
  await app.signIn();
  await app.live();
  const result = await app.window.primetimeApiFetch(sourcePath, sourceRequest);
  app.window.primetimeDataMode.setMode('demo');
  await assert.rejects(result.json());
  assert.equal(consumed, 0);
});

test('cloning a response cannot bypass the Live body mode fence', async () => {
  const app = harness();
  await app.signIn();
  await app.live();
  const result = await app.window.primetimeApiFetch(sourcePath, sourceRequest);
  const copy = result.clone();
  app.window.primetimeDataMode.setMode('demo');
  await assert.rejects(copy.json());
});

test('the global response API does not expose an unfenced raw body stream', async () => {
  const wire = response({ ok: true });
  wire.body = { getReader() { return { async read() { return { done: false, value: 'LIVE-ONLY' }; } }; } };
  const app = harness({ fetchSource: path => path === sourcePath ? wire : response({ ok: true }) });
  await app.signIn();
  await app.live();
  const result = await app.window.primetimeApiFetch(sourcePath, sourceRequest);
  assert.throws(() => result.body, /api_response_stream_not_supported/);
});

test('sign-out resets to Live and rejects a pending source response body', async () => {
  const body = deferred(), wire = response({ ok: true });
  wire.json = () => body.promise;
  const app = harness({ fetchSource: path => path === sourcePath ? wire : response({ ok: true }) });
  await app.signIn();
  await app.live();
  const result = await app.window.primetimeApiFetch(sourcePath, sourceRequest);
  const rejected = assert.rejects(result.json());
  await app.auth.signOut();
  assert.equal(app.window.primetimeDataMode.getMode(), 'live');
  assert.equal(app.element('appShell').hidden, true);
  body.resolve({ ok: true, records: [{ ID: 'LIVE-ONLY' }] });
  await rejected;
});

test('a Live source failure stays a failure without replacing it with sample records', async () => {
  const app = harness({ fetchSource: path => { if (path === sourcePath) throw new Error('synthetic transport failure'); return response({ ok: true }); } });
  await app.signIn();
  await app.live();
  await assert.rejects(app.window.primetimeApiFetch(sourcePath, sourceRequest));
  assert.equal(app.window.primetimeDataMode.getMode(), 'live', 'failure must not silently switch the selected source');
});

test('Demo workbench stays inert and rejects manual source-form requests', async () => {
  const app = harness();
  vm.runInContext(asset('workspace.js'), app.context);
  await app.signIn();
  const before = app.calls.length;
  assert.equal(app.element('operationalWorkspace').inert, true);
  assert.equal(app.element('reloadWorkspace').disabled, true);
  await app.click('reloadWorkspace');
  for (const fn of app.element('readForm').handlers.get('submit') || []) await fn(new Event('submit'));
  await tick();
  assert.equal(app.calls.length, before);
  assert.equal(app.element('readResults').children.length, 0);
});

test('a pending attachment cannot submit after switching Demo and back to Live', async () => {
  let reader;
  const settings = {
    settings: { revision: 1, officeId: '123', officeTimezone: 'America/Chicago', policyReference: 'synthetic-review', enabledReads: [] },
    dataApproved: true, supportedReads: [], readInputs: {}, documentCreationWrites: ['AddPatientDocument']
  };
  const app = harness({ fetchSource: path => response(path.endsWith('/settings') ? { ok: true, ...settings } : { ok: true, changes: [] }) });
  app.context.FileReader = class { readAsDataURL() { reader = this; } };
  vm.runInContext(asset('workspace.js'), app.context);
  await app.signIn();
  await app.live();
  app.element('documentCreationFile').files = [{ name: 'synthetic.txt', size: 3 }];
  for (const fn of app.element('documentCreationForm').handlers.get('submit') || []) await fn(new Event('submit'));
  assert.ok(reader, 'the synthetic file read must be pending before switching');
  app.window.primetimeDataMode.setMode('demo');
  app.window.primetimeDataMode.setMode('live');
  await tick();
  reader.result = 'data:application/octet-stream;base64,bmV3';
  reader.onload();
  await tick();
  assert.equal(app.calls.filter(call => call.path.endsWith('/document-creations/prepare')).length, 0);
  assert.equal(app.element('documentCreationChanges').children.length, 0);
});

test('Demo dashboard totals and exceptions describe the same deterministic synthetic records', () => {
  const app = harness({ includeApp: false });
  vm.runInContext(asset('demo-data.js'), app.context);
  const date = '2026-10-10';
  const model = app.window.primetimeDemoData.dashboard(date);
  assert.equal(model.mode, 'demo');
  assert.equal(model.date, date);
  assert.equal(model.visits.length, 42);
  assert.equal(new Set(model.visits.map(item => item.id)).size, model.visits.length);
  for (const visit of model.visits) {
    for (const id of [visit.id, visit.patientId, visit.caregiverId].filter(value => value !== null)) assert.match(id, /^DEMO-/);
    assert.equal(visit.state, 'synthetic');
    assert.ok(visit.scheduledStart.startsWith(date));
  }
  for (const [state, count] of Object.entries(model.counts)) {
    assert.equal(count, model.visits.filter(item => item.demoActivity === state).length);
  }
  assert.equal(Object.values(model.counts).reduce((sum, count) => sum + count, 0), model.visits.length);
  assert.equal(model.exceptions.length, model.visits.filter(item => item.issue).length);
  assert.equal(model.exceptions.length, 8);
  assert.equal(model.highPriority, model.exceptions.filter(item => item.priority === 'high').length);
  assert.equal(model.highPriority, 3);
  assert.equal(model.coverage.weekOpen, model.coverage.shifts.length);
  assert.equal(model.coverage.todayOpen, model.coverage.shifts.filter(item => item.dayOffset === 0).length);
  assert.equal(model.coverage.tomorrowOpen, model.coverage.shifts.filter(item => item.dayOffset === 1).length);
  assert.equal(model.coverage.todayOpen, model.visits.filter(item => item.caregiverId === null).length);
  assert.equal(model.billing.completedMinutes, model.visits.filter(item => item.demoActivity === 'completed').reduce((sum, item) => sum + item.scheduledMinutes, 0));
  assert.equal(model.billing.projectedMinutes, model.visits.reduce((sum, item) => sum + item.scheduledMinutes, 0));
  assert.equal(model.billing.completedMinutes, model.billing.readyMinutes + model.billing.blockedMinutes);
  assert.ok(model.billing.projectedMinutes >= model.billing.completedMinutes);
  assert.equal(JSON.stringify(app.window.primetimeDemoData.dashboard(date)), JSON.stringify(model));
  assert.equal(app.calls.length, 0, 'fixture derivation must never fetch source data');
});

test('Demo visit paging stays bounded and covers each synthetic visit exactly once', () => {
  const app = harness({ includeApp: false });
  vm.runInContext(asset('demo-data.js'), app.context);
  const date = '2026-10-10', ids = [];
  let offset = 0;
  for (;;) {
    const page = app.window.primetimeDemoData.visitPage(date, offset);
    assert.equal(page.mode, 'demo');
    assert.equal(page.source, 'synthetic');
    assert.equal(page.scope.date, date);
    assert.equal(page.totals, null, 'a preview page must not masquerade as a complete aggregate');
    assert.ok(page.items.length <= 10);
    ids.push(...page.items.map(item => item.id));
    if (page.nextCursor === null) break;
    assert.ok(Number(page.nextCursor) > offset);
    offset = Number(page.nextCursor);
  }
  assert.equal(ids.length, 42);
  assert.equal(new Set(ids).size, 42);
  assert.equal(app.window.primetimeDemoData.visitPage(date, 0, 999).items.length, 10);
  assert.equal(app.calls.length, 0);
});

function livePreview(date) {
  return {
    ok: true, mode: 'live', source: 'hhaexchange', state: 'ready', validation: 'source_unvalidated',
    scope: { officeId: '123', date, timezone: 'America/Chicago' }, fetchedAt: '2026-10-10T08:00:00Z',
    items: [{ id: '900001', patientId: '5', caregiverId: '6', scheduledStart: `${date}T08:00:00`, scheduledEnd: `${date}T12:00:00`, actualStart: null, actualEnd: null, evvStart: null, evvEnd: null, state: 'source_unvalidated', privateExtra: 'must be stripped' }],
    nextCursor: null, completeness: { complete: false, truncated: false }, totals: null
  };
}

function dashboardModel() {
  const window = {};
  vm.runInNewContext(asset('data-source.js'), { window, document: { getElementById: () => null, addEventListener() {} } });
  vm.runInNewContext(asset('demo-data.js'), { window });
  vm.runInNewContext(asset('dashboard.js'), { window });
  return window;
}

test('HHA source hours preserve zero, empty and missing components separately from accepted calculated durations', () => {
  const { sourceActualHours: actual, sourceScheduleHours: schedule } = dashboardModel().primetimeSourceTime;
  assert.equal(actual('0.00', 240), '0.00 h · HHA');
  assert.equal(actual('4:15'), '4:15 · HHA');
  assert.equal(actual(''), 'Empty HHA ActualHours');
  assert.equal(actual(null), 'Not supplied by HHA');
  assert.equal(actual(null, 240), 'Not supplied by HHA');
  assert.equal(schedule('4', '15'), '4 h 15 min · HHA');
  assert.equal(schedule('0', '0'), '0 h 0 min · HHA');
  assert.equal(schedule(null, '30'), 'h not supplied 30 min · HHA');
  assert.equal(schedule('', '0'), 'empty h 0 min · HHA');
  assert.equal(schedule(undefined, null), 'Not supplied by HHA');
});

test('rounded source hours preserve supplied values and never fall back to schedules, clocks or calculations', () => {
  const rounded = dashboardModel().primetimeSourceTime.sourceRoundedActualHours;
  assert.equal(rounded('0.00'), '0.00 h · HHA');
  assert.equal(rounded('4.25'), '4.25 h · HHA');
  assert.equal(rounded('4:15'), '4:15 · HHA');
  assert.equal(rounded(''), 'Empty HHA ActualHoursRounded');
  assert.equal(rounded(null, 240, '2026-10-10 08:00', '2026-10-10 12:00'), 'Not supplied by HHA');
  assert.equal(rounded(undefined), 'Not supplied by HHA');
});

test('schedule spans stay labelled while missing HHA actual hours never borrow a recorded span', () => {
  const { sourceClockSpan: span, sourceActualHours: actual, sourceScheduleHours: schedule } = dashboardModel().primetimeSourceTime;
  const start = '2026-10-10 08:00', end = '2026-10-10 12:15';
  assert.equal(span(start, end), 255);
  assert.equal(schedule(null, null, null, start, end), '4.25 h · source clock span');
  assert.equal(actual(null, null, start, end), 'Not supplied by HHA');
  assert.equal(actual('0.00', null, start, end), '0.00 h · HHA');
  assert.equal(span('2026-10-10 23:00', '2026-10-11 02:00'), 180);
  assert.equal(actual(null, null, start, null), 'Not supplied by HHA');
  for (const [a, b] of [[end, start], [start, '2026-10-10 07:00'], ['08:00', '12:00'], ['2026-02-30 08:00', '2026-02-30 12:00'],
    ['2026-11-01T01:30:00-05:00', '2026-11-01T03:30:00-06:00'], ['0001-01-01 08:00', end], [start, '2026-10-13 12:00']]) assert.equal(span(a, b), null);
});

test('HHA actual hours and the independent written-clock span remain separate for missing, empty and zero values', () => {
  const { sourceActualHours, sourceRecordedClockSpan } = dashboardModel().primetimeSourceTime;
  const start = '2026-10-24 08:00', end = '2026-10-24 12:00';
  assert.equal(sourceActualHours(null, 240, start, end), 'Not supplied by HHA');
  assert.equal(sourceActualHours('', 240, start, end), 'Empty HHA ActualHours');
  assert.equal(sourceActualHours('0.00', 240, start, end), '0.00 h · HHA');
  assert.equal(sourceRecordedClockSpan(start, end), 'Recorded clock span: 4.00 h · written times');
  for (const pair of [[start, null], [null, end], [end, start], ['2026-11-01T01:00:00-05:00', '2026-11-01T02:00:00-06:00']]) assert.equal(sourceRecordedClockSpan(...pair), '');
});

test('preview keeps recorded span beside its clock pair and preserves a missing HHA actual-hour cell', async () => {
  const app = connectedWorkspace({ preview: date => {
    const page = livePreview(date);
    Object.assign(page.items[0], { actualStart: date + ' 08:00', actualEnd: date + ' 12:00', actualHours: null, actualHoursRounded: null });
    return page;
  } });
  await app.signIn(); await tick(); await tick();
  const cells = descendants(app.element('dashboardVisitRows'));
  const rawHours = cells.find(e => e['data-label'] === 'Actual hours (HHA)');
  const clocks = cells.find(e => e['data-label'] === 'Actual start / end');
  assert.equal(nodeText(rawHours).trim(), 'Not supplied by HHA');
  assert.match(nodeText(clocks), /Recorded clock span: 4\.00 h · written times/);
  assert.doesNotMatch(nodeText(rawHours), /4\.00|calculated|clock span/);
  assert.equal(app.calls.some(c => c.options?.method === 'POST'), false);
});

test('preview retains returned HHA duration fields and strips them from unavailable details', () => {
  const model = dashboardModel().primetimeDashboardModel, date = '2026-10-10';
  const payload = { ok: true, mode: 'live', source: 'hhaexchange', state: 'ready', scope: { officeId: '123', date }, validation: 'source_unvalidated', totals: null, items: [
    { id: '77', state: 'source_unvalidated', actualHours: '0.00', actualHoursRounded: '0.25', scheduleDurationHours: '4', scheduleDurationMinutes: '15' }
  ] };
  const expected = { mode: 'live', officeId: '123', date };
  const result = model.normalizeVisitPreview(payload, expected).items[0];
  assert.equal(result.actualHoursRounded, '0.25'); assert.equal(result.actualHours, '0.00'); assert.equal(result.scheduleDurationHours, '4'); assert.equal(result.scheduleDurationMinutes, '15');
  payload.items[0].state = 'unavailable';
  assert.equal(model.normalizeVisitPreview(payload, expected).items[0].actualHours, null);
  assert.equal(model.normalizeVisitPreview(payload, expected).items[0].actualHoursRounded, null);
  assert.equal(model.normalizeVisitPreview(payload, expected).items[0].scheduleDurationHours, null);
  payload.items[0].state = 'source_unvalidated';
  for (const value of [4, 'x'.repeat(129)]) { payload.items[0].actualHoursRounded = value; assert.throws(() => model.normalizeVisitPreview(payload, expected)); }
  payload.items[0].actualHoursRounded = null; payload.items[0].actualHours = 4;
  assert.throws(() => model.normalizeVisitPreview(payload, expected));
});

test('visit preview distinguishes an empty clock field from an absent one', async () => {
  const app = connectedWorkspace({ preview: date => {
    const page = livePreview(date);
    Object.assign(page.items[0], { actualStart: date + ' 08:00', actualEnd: '', evvStart: null, evvEnd: '' });
    return page;
  } });
  await app.signIn(); await tick(); await tick();
  const cells = descendants(app.element('dashboardVisitRows'));
  const actual = nodeText(cells.find(e => e['data-label'] === 'Actual start / end'));
  const evv = nodeText(cells.find(e => e['data-label'] === 'EVV start / end'));
  assert.match(actual, /08:00\s+Empty HHA clock field/);
  assert.doesNotMatch(actual, /Recorded clock span/);
  assert.match(evv, /Not supplied by HHA\s+Empty HHA clock field/);
});

test('visit receipts remain distinct from search, validate explicitly and disappear with unavailable details', () => {
  const model = dashboardModel().primetimeDashboardModel, date = '2026-10-10';
  const page = livePreview(date), expected = { mode: 'live', date, officeId: '123' };
  Object.assign(page.items[0], { detailFetchedAt: '2026-10-10T08:01:00Z', officeCheckedAt: '2026-10-10T08:02:00Z' });
  let item = model.normalizeVisitPreview(page, expected).items[0];
  assert.equal(item.detailFetchedAt, page.items[0].detailFetchedAt); assert.equal(item.officeCheckedAt, page.items[0].officeCheckedAt);
  assert.notEqual(item.detailFetchedAt, page.fetchedAt);
  for (const key of ['detailFetchedAt', 'officeCheckedAt']) {
    const original = page.items[0][key];
    for (const value of [7, '', '2026-10-10', '2026-02-30T08:00:00Z', 'not-a-receipt']) {
      page.items[0][key] = value; assert.throws(() => model.normalizeVisitPreview(page, expected));
    }
    delete page.items[0][key]; assert.equal(model.normalizeVisitPreview(page, expected).items[0][key], null);
    page.items[0][key] = original;
  }
  page.items[0].state = 'unavailable';
  item = model.normalizeVisitPreview(page, expected).items[0];
  assert.equal(item.detailFetchedAt, null); assert.equal(item.officeCheckedAt, null);
});

test('record disclosures show detail/office read receipts without another source request and clear them in Demo', async () => {
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => {
    if (!path.startsWith('/primetime/api/views/visits?')) return response({ ok: true });
    const page = livePreview(new URL(path, 'https://fixture.test').searchParams.get('date'));
    Object.assign(page.items[0], { detailFetchedAt: '2026-10-10T08:01:00Z', officeCheckedAt: '2026-10-10T08:02:00Z' }); return response(page);
  } });
  installDashboard(app); await app.signIn(); await tick(); await tick();
  assert.match(nodeText(app.element('dashboardVisitRows')), /Detail read: 2026-10-10T08:01:00Z/);
  assert.match(nodeText(app.element('dashboardVisitRows')), /Office check: 2026-10-10T08:02:00Z/);
  assert.equal(app.calls.some(call => call.path.startsWith('/primetime/api/workspace/read')), false);
  app.window.primetimeDataMode.setMode('demo');
  assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /2026-10-10T08:0[12]:00Z/);
});

test('dashboard preview rejects wrong mode, source, date and scope without inventing records or totals', () => {
  const window = dashboardModel(), expected = { mode: 'live', date: '2026-10-10', officeId: '123' };
  const valid = livePreview(expected.date);
  const normalized = window.primetimeDashboardModel.normalizeVisitPreview(valid, expected);
  assert.equal(normalized.items[0].id, '900001');
  assert.equal('privateExtra' in normalized.items[0], false);
  assert.equal(normalized.items[0].evvStart, null);
  assert.equal(normalized.totals, null);
  for (const changed of [
    { ok: false }, { mode: 'demo' }, { source: 'synthetic' }, { validation: 'validated' }, { totals: { completed: 42 } },
    { scope: { ...valid.scope, date: '2026-10-11' } }, { scope: { ...valid.scope, officeId: '999' } },
    { items: [{ ...valid.items[0], id: 'DEMO-V-1048' }] }, { items: [{ ...valid.items[0], state: 'completed' }] },
    { items: Array.from({ length: 11 }, (_, index) => ({ ...valid.items[0], id: String(900001 + index) })) }
  ]) assert.throws(() => window.primetimeDashboardModel.normalizeVisitPreview({ ...valid, ...changed }, expected));
  assert.throws(() => window.primetimeDashboardModel.normalizeVisitPreview(window.primetimeDemoData.visitPage(expected.date), expected));
  const empty = window.primetimeDashboardModel.normalizeVisitPreview({ ...valid, state: 'empty', items: [] }, expected);
  assert.equal(empty.items.length, 0, 'empty Live results must not be replaced with examples');
  assert.equal(empty.totals, null);
});

test('exception filtering applies search and priority to the same fixture queue without changing its totals', () => {
  const window = dashboardModel(), items = window.primetimeDemoData.dashboard('2026-10-10').exceptions;
  const high = window.primetimeDashboardModel.filterExceptions(items, '', 'high');
  assert.equal(high.length, 3);
  assert.ok(high.every(item => item.priority === 'high'));
  const clock = window.primetimeDashboardModel.filterExceptions(items, ' CLOCK-OUT ', 'high');
  assert.equal(clock.length, items.filter(item => item.issue.toLowerCase().includes('clock-out') && item.priority === 'high').length);
  assert.equal(window.primetimeDashboardModel.filterExceptions(items, 'no matching fixture', 'all').length, 0);
  assert.equal(items.length, 8);
});

function installDashboard(app) {
  app.element('priorityFilter').value = 'all';
  vm.runInContext(asset('demo-data.js'), app.context);
  vm.runInContext(asset('dashboard.js'), app.context);
}
function nodeText(node) { return [node.textContent || '', ...node.children.map(child => child.children ? nodeText(child) : child.textContent || '')].join(' '); }

function analyticsReport(site='pthhs',days=28){
  const current={screenPageViews:7203,sessions:20,activeUsers:12,engagementRate:0.5,averageSessionDuration:75};
  const shift=n=>new Date(Date.parse('2026-10-31T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const coverage=Object.fromEntries([['summary',2],['trend',2],['pages',1],['channels',1],['events',2]].map(([key,n])=>[key,{returnedRows:n,totalRows:n,limited:false,emptyReason:null}]));
  return {ok:true,contractVersion:2,site,days,name:site==='pthhs'?'PTHHS':'Ride Primetime',propertyId:site==='pthhs'?'546711548':'561765914',current,previous:{...current,screenPageViews:6000},coverage,
    periods:{asOfDate:'2026-10-31',current:{startDate:shift(-days),endDate:shift(-1)},previous:{startDate:shift(-days*2),endDate:shift(-days-1)}},
    trend:[{date:'20261030',screenPageViews:9,sessions:3},{date:'20261028',screenPageViews:7,sessions:2}],
    pages:[{pagePath:'/synthetic-public-page',screenPageViews:11,activeUsers:8}],channels:[{sessionDefaultChannelGroup:'Direct',sessions:10,activeUsers:8}],
    events:[{eventName:'phone_click',eventCount:2},{eventName:'email_click',eventCount:3}],realtime:4,realtimePageViews:8,realtimeError:null,dataQuality:null,timeZone:'America/Chicago',
    today:{date:'2026-10-31',pageViews:17,updatedAt:'2026-10-31T18:00:00.000Z',error:null,warning:null},
    realtimeStreamId:site==='pthhs'?'16244033088':'16244067646',realtimeUpdatedAt:'2026-10-31T18:00:00.000Z',updatedAt:'2026-10-31T18:00:00.000Z',periodNote:'Synthetic report period; source dates only.'};
}
async function analyticsApp(read=()=>response(analyticsReport())){
  const app=harness({storedDataMode:null,fetchSource:read});
  const clock=deviceClock(app,'2026-10-31T18:00:00Z');
  app.document.hidden=false;await app.signIn();
  app.element('websiteAnalytics').classList.add('is-active');app.element('waSite').value='pthhs';app.element('waSite').selectedIndex=0;
  app.element('waSite').options=[{text:'PTHHS · pthhs.net'},{text:'Ride Primetime · rideprimetime.net'}];app.element('waDays').value='28';
  vm.runInContext(asset('analytics.js'),app.context);await tick();await tick();return {...app,clock};
}

function liveCounter(site='pthhs',count=3,updatedAt='2026-10-31T18:00:00.000Z'){
  return {ok:true,site,count,visitors:1,presenceWindowSeconds:60,timeZone:'America/Chicago',date:'2026-10-31',startedAt:'2026-10-31T17:00:00.000Z',updatedAt};
}
async function counterApp(read=()=>response(liveCounter())){
  const app=await analyticsApp(path=>path.includes('/website-live-views?')?read(path):response(analyticsReport()));
  vm.runInContext(asset('live-views.js'),app.context);await tick();await tick();
  app.liveTick=()=>{for(const {callback,delay}of app.intervals.values())if(delay===5000)callback();};return app;
}
test('first-party day count refreshes independently every five seconds and keeps the GA4 processed total separate',async()=>{
  let count=3;const app=await counterApp(()=>response(liveCounter('pthhs',count)));
  assert.equal(app.element('waToday').textContent,'3');assert.match(app.element('waTodayNote').textContent,/first partial day.*every 5 seconds/);
  assert.match(app.element('waGoogleToday').textContent,/17/);count=4;app.liveTick();await tick();await tick();
  assert.equal(app.element('waToday').textContent,'4');assert.match(app.element('waGoogleToday').textContent,/17/);
  await app.click('waRefresh');await tick();await tick();assert.equal(app.element('waToday').textContent,'4');
});

test('first-party active visitors increase and decrease independently of the GA4 thirty-minute count',async()=>{
  let visitors=0;const app=await counterApp(()=>response({...liveCounter(),visitors}));
  assert.equal(app.element('waLive').textContent,'0');assert.equal(app.element('waGoogleLive').textContent,'4');
  visitors=1;app.liveTick();await tick();await tick();assert.equal(app.element('waLive').textContent,'1');
  visitors=0;app.liveTick();await tick();await tick();assert.equal(app.element('waLive').textContent,'0');
  assert.match(app.element('waLiveNote').textContent,/browser sessions.*last 60 seconds.*every 5 seconds/);
  assert.equal(app.element('waGoogleLive').textContent,'4');app.dispatch('primetime-signed-out');assert.equal(app.element('waLive').textContent,'—');
});
test('live counter preserves actual zero, distinguishes not started and clears malformed or failed facts',async()=>{
  for(const state of ['zero','waiting','negative','wrongsite','wrongdate','stale','failure']){
    const app=await counterApp(()=>{if(state==='failure')throw new Error('PRIVATE');const d=liveCounter('pthhs',0);
      if(state==='waiting'){d.count=null;d.startedAt=null;}if(state==='negative')d.count=-1;if(state==='wrongsite')d.site='rideprimetime';
      if(state==='wrongdate')d.date='2026-10-30';if(state==='stale')d.updatedAt='2026-10-31T17:59:00.000Z';return response(d);
    });assert.equal(app.element('waToday').textContent,state==='zero'?'0':state==='waiting'?'Waiting':'Unavailable');
    assert.doesNotMatch(app.element('waTodayNote').textContent,/PRIVATE/);
  }
});
test('site change and sign-out fence late daily counts, with no hidden or Demo polling',async()=>{
  let hold=false;const pending=deferred(),app=await counterApp(path=>hold?pending.promise:response(liveCounter(new URL(path,'https://fixture.test').searchParams.get('site'))));
  hold=true;app.liveTick();await tick();app.element('waSite').value='rideprimetime';app.element('waSite').selectedIndex=1;
  hold=false;for(const fn of app.element('waSite').handlers.get('change')||[])fn();await tick();await tick();
  pending.resolve(response(liveCounter('pthhs',99)));await tick();await tick();assert.equal(app.element('waToday').textContent,'3');
  app.document.hidden=true;app.dispatch('visibilitychange');const before=app.calls.length;app.liveTick();await tick();assert.equal(app.calls.length,before);assert.equal(app.element('waToday').textContent,'—');
  app.document.hidden=false;app.dispatch('visibilitychange');await tick();await tick();
  await app.window.primetimeDataMode.setMode('demo');const demo=app.calls.length;app.liveTick();await tick();assert.equal(app.calls.length,demo);
  app.dispatch('primetime-signed-out');assert.equal(app.element('waToday').textContent,'—');
});
test('analytics clears prior facts at refresh start and keeps failures distinct from zero',async()=>{
  let next=null;const app=await analyticsApp(()=>next?next.promise:response(analyticsReport()));
  assert.match(nodeText(app.element('waMetrics')),/7,203/);assert.equal(app.element('waGoogleLive').textContent,'4');
  assert.match(app.element('waGoogleToday').textContent,/processed today.*17/);assert.equal(app.element('waRecentViews').textContent,'8');
  next=deferred();await app.click('waRefresh');
  assert.doesNotMatch(nodeText(app.element('waMetrics')),/7,203/);assert.equal(app.element('waGoogleLive').textContent,'—');assert.equal(app.element('waUpdated').textContent,'');
  assert.equal(app.element('waGoogleToday').textContent,'');assert.equal(app.element('waRecentViews').textContent,'—');
  next.resolve({...response({ok:false,error:'analytics_access_pending',message:'PRIVATE-UPSTREAM-ERROR'}),ok:false,status:503});await tick();await tick();
  assert.match(app.element('waStatus').textContent,/reporting access still needs/);assert.doesNotMatch(app.element('waStatus').textContent,/PRIVATE/);
  assert.equal(app.element('waStatus').classList.contains('wa-error'),true);assert.equal(app.element('waRefresh').disabled,false);
  for(const id of ['waPages','waChannels','waDaily'])assert.equal(app.element(id).children.length,0);
});
test('analytics validates whole numeric, identity, date and receipt shapes before rendering',async()=>{
  const changes=[d=>delete d.current.sessions,d=>d.current.sessions='20',d=>d.current.sessions=-1,d=>d.current.sessions=1.5,d=>d.current.averageSessionDuration=Infinity,
    d=>d.current.engagementRate=1.1,d=>d.previous=null,d=>d.site='rideprimetime',d=>d.propertyId='561765914',d=>d.days=7,d=>d.updatedAt=null,
    d=>d.updatedAt='2026-10-31T17:57:59.000Z',d=>d.updatedAt='2026-10-31T18:01:01.000Z',d=>d.timeZone='Invalid/Timezone',d=>d.trend[0].date='20260230',
    d=>d.trend.push({...d.trend[0]}),d=>d.pages[0].activeUsers=null,d=>d.channels[0].sessions=NaN,d=>d.events.push({...d.events[0]}),d=>delete d.realtime,
    d=>{d.realtime=null;d.realtimeError=null;},d=>d.events=[{eventName:'phone_click',eventCount:Number.MAX_SAFE_INTEGER},{eventName:'email_click',eventCount:1}]];
  for(const change of changes){let invalid=false;const app=await analyticsApp(()=>{const d=analyticsReport();if(invalid)change(d);return response(d);});
    invalid=true;await app.click('waRefresh');await tick();await tick();
    assert.equal(app.element('waStatus').classList.contains('wa-error'),true,String(change));
    assert.match(app.element('waStatus').textContent,/could not be verified/);assert.equal(app.element('waGoogleLive').textContent,'—');
    assert.doesNotMatch(nodeText(app.element('waMetrics')),/7,203|NaN|Infinity/);assert.equal(app.element('waUpdated').textContent,'');
  }
});

test('current-day and rolling page views show their own date and receipt, preserve zero and reject crossed dates',async()=>{
  for(const state of ['views','zero','pending','failed']){
    const app=await analyticsApp(()=>{const d=analyticsReport();
      if(state==='zero'){d.today.pageViews=0;d.realtimePageViews=0;}
      if(state==='pending'||state==='failed'){d.today.pageViews=null;d.today.error='No current-day source rows yet.';if(state==='failed')d.today.updatedAt=null;}
      return response(d);
    });
    assert.match(app.element('waGoogleToday').textContent,new RegExp('processed today.*'+(state==='zero'?'0':state==='pending'||state==='failed'?'Pending':'17')));
    assert.equal(app.element('waRecentViews').textContent,state==='zero'?'0':'8');
    assert.match(app.element('waGoogleToday').textContent,/America\/Chicago.*may lag/);
    assert.match(app.element('waRecentNote').textContent,/last 30 minutes.*checked/);
    assert.match(app.element('waNote').textContent,/First-party live counts/);
  }
  for(const change of [d=>d.today.date='2026-10-30',d=>d.today.pageViews=-1,d=>d.today.pageViews='17',d=>d.today.updatedAt=null,d=>delete d.realtimePageViews,d=>d.realtimePageViews=1.5]){
    const app=await analyticsApp(()=>{const d=analyticsReport();change(d);return response(d);});
    assert.equal(app.element('waGoogleToday').textContent,'');assert.equal(app.element('waRecentViews').textContent,'—');assert.match(app.element('waStatus').textContent,/could not be verified/);
  }
});
test('analytics plots source dates without invented zero days or lines across missing dates',async()=>{
  const app=await analyticsApp();const daily=nodeText(app.element('waDaily'));
  assert.ok(daily.indexOf('10/28/2026')<daily.indexOf('10/30/2026'));assert.doesNotMatch(daily,/10\/29\/2026/);
  const svg=app.element('waChart').children[0];const paths=svg.children.filter(n=>n.d!==undefined);
  assert.equal(paths.length,2);assert.ok(paths.every(n=>(n.d.match(/M/g)||[]).length===2&&!n.d.includes('L')));
  assert.match(nodeText(app.element('waMetrics')),/50.0%|1m 15s/);assert.match(nodeText(app.element('waMetrics')),/Reported phone & email clicks 5/);
});
test('analytics preserves real zeros and distinguishes missing realtime from a zero count',async()=>{
  for(const realtime of [0,null]){const app=await analyticsApp(()=>{const d=analyticsReport();for(const item of [d.current,d.previous])for(const key of Object.keys(item))item[key]=0;
    Object.assign(d,{trend:[],pages:[],channels:[],events:[],realtime,realtimeError:realtime===null?'Unavailable at source':null});for(const key of ['trend','pages','channels','events'])d.coverage[key]={returnedRows:0,totalRows:0,limited:false,emptyReason:null};return response(d);});
    assert.equal(app.element('waStatus').classList.contains('wa-error'),false);assert.equal(app.element('waGoogleLive').textContent,realtime===0?'0':'Unavailable');
    assert.match(nodeText(app.element('waChart')),/No daily source rows/);assert.match(nodeText(app.element('waDaily')),/No source rows/);
    assert.match(nodeText(app.element('waMetrics')),/0.0%/);assert.match(app.element('waUpdated').textContent,/Updated/);
  }
});
test('analytics source-empty summaries do not become zero and missing comparison does not erase current facts',async()=>{
  for(const emptyCurrent of [true,false]){
    const app=await analyticsApp(()=>{const d=analyticsReport();d.previous=null;if(emptyCurrent)d.current=null;
      d.coverage.summary={returnedRows:emptyCurrent?0:1,totalRows:emptyCurrent?0:1,limited:false,emptyReason:emptyCurrent?'NO_DATA':null};
      d.dataQuality=emptyCurrent?'Summary empty: NO_DATA':'No comparison summary row returned.';return response(d);});
    assert.equal(app.element('waStatus').classList.contains('wa-error'),false);
    const cards=nodeText(app.element('waMetrics'));
    if(emptyCurrent){assert.match(cards,/No summary row returned/);assert.doesNotMatch(cards,/Page views 0|Sessions 0|0.0%/);}else{assert.match(cards,/7,203/);assert.match(cards,/Comparison not returned/);}
    assert.match(app.element('waStatus').textContent,/2026-10-03 to 2026-10-30.*2026-09-05 to 2026-10-02/);
  }
});
test('analytics missing contact rows remain unavailable; explicit contact zero and source-quality warnings remain visible',async()=>{
  for(const supplied of [false,true]){
    const app=await analyticsApp(()=>{const d=analyticsReport();d.events=supplied?[{eventName:'phone_click',eventCount:0}]:[];
      d.coverage.events={returnedRows:d.events.length,totalRows:d.events.length,limited:false,emptyReason:null};
      d.coverage.pages.totalRows=20;d.coverage.pages.limited=true;d.dataQuality='Pages: 1 of 20 source rows returned. Pages uses sampled source data.';return response(d);});
    assert.match(nodeText(app.element('waMetrics')),supplied?/Reported phone & email clicks 0/:/No contact event rows returned/);
    assert.match(app.element('waStatus').textContent,/1 of 20.*sampled/);assert.match(nodeText(app.element('waPages')),/synthetic-public-page/);
  }
});
test('analytics rejects wrong periods, stream or coverage instead of rendering mismatched live facts',async()=>{
  for(const change of [d=>delete d.contractVersion,d=>d.periods.current.endDate='2026-11-01',d=>d.realtimeStreamId='999',
    d=>d.coverage.pages.returnedRows=0,d=>d.coverage.summary.totalRows=1,d=>d.trend[0].date='20261101',d=>d.realtimeUpdatedAt='2026-10-31T17:59:59.000Z',d=>d.periods=analyticsReport('pthhs',7).periods]){
    const app=await analyticsApp(()=>{const d=analyticsReport();change(d);return response(d);});
    assert.equal(app.element('waStatus').classList.contains('wa-error'),true);assert.doesNotMatch(nodeText(app.element('waMetrics')),/7,203/);assert.equal(app.element('waGoogleLive').textContent,'—');
  }
});
test('analytics distinguishes connected empty realtime rows from a failed source and explicit zero',async()=>{
  for(const state of ['empty','failed','zero']){
    const app=await analyticsApp(()=>{const d=analyticsReport();d.realtime=state==='zero'?0:null;d.realtimeError=state==='empty'?'No realtime source rows returned.':state==='failed'?'Google realtime request timed out.':null;
      d.realtimeDiagnostic=state==='empty'?{category:'empty_result',httpStatus:null,shape:null}:null;return response(d);});
    assert.equal(app.element('waStatus').classList.contains('wa-error'),false);assert.match(nodeText(app.element('waMetrics')),/7,203/);
    assert.equal(app.element('waGoogleLive').textContent,state==='empty'?'No source rows':state==='zero'?'0':'Unavailable');
  }
});
test('analytics expires retained facts without making hidden source requests',async()=>{
  const app=await analyticsApp(),count=app.calls.filter(c=>c.path.includes('/website-analytics?')).length;app.document.hidden=true;
  app.clock.set('2026-10-31T18:02:01Z');app.clock.run();
  assert.equal(app.calls.filter(c=>c.path.includes('/website-analytics?')).length,count);
  assert.equal(app.element('waGoogleLive').textContent,'—');assert.equal(app.element('waUpdated').textContent,'');assert.match(app.element('waStatus').textContent,/freshness/);
  assert.doesNotMatch(nodeText(app.element('waMetrics')),/7,203/);
});
test('analytics context changes and sign-out fence late source facts and errors',async()=>{
  for(const boundary of ['site','days','view','signout']){
    let next=null;const app=await analyticsApp(()=>next?next.promise:response(analyticsReport()));next=deferred();await app.click('waRefresh');
    if(boundary==='site'){app.element('waSite').value='rideprimetime';app.element('waSite').selectedIndex=1;for(const fn of app.element('waSite').handlers.get('change')||[])fn(new Event('change'));}
    if(boundary==='days'){app.element('waDays').value='7';for(const fn of app.element('waDays').handlers.get('change')||[])fn(new Event('change'));}
    if(boundary==='view'){app.element('websiteAnalytics').classList.remove('is-active');app.document.dispatchEvent(new DetailEvent('primetime-view-changed',{detail:{view:'overview'}}));}
    if(boundary==='signout'){app.auth.currentUser=null;app.dispatch('primetime-signed-out');}
    next.resolve(response(analyticsReport()));await tick();await tick();
    assert.doesNotMatch(nodeText(app.element('waMetrics')),/7,203/);assert.equal(app.element('waUpdated').textContent,'');assert.equal(app.element('waGoogleLive').textContent,'—');
  }
});
test('late analytics success or failure cannot overwrite a newer website report',async()=>{
  for(const outcome of ['success','error']){
    let hold=false;const pending=deferred();
    const app=await analyticsApp(path=>{const key=new URL(path,'https://fixture.test').searchParams.get('site');
      if(hold&&key==='pthhs')return pending.promise;
      const data=analyticsReport(key);if(key==='rideprimetime')data.current.screenPageViews=4321;return response(data);
    });
    hold=true;await app.click('waRefresh');await tick();app.element('waSite').value='rideprimetime';app.element('waSite').selectedIndex=1;
    for(const fn of app.element('waSite').handlers.get('change')||[])fn(new Event('change'));await tick();await tick();
    assert.match(nodeText(app.element('waMetrics')),/4,321/);
    if(outcome==='success')pending.resolve(response(analyticsReport()));else pending.reject(new Error('PRIVATE-LATE-ERROR'));
    await tick();await tick();assert.match(nodeText(app.element('waMetrics')),/4,321/);assert.doesNotMatch(nodeText(app.element('waMetrics')),/7,203/);
    assert.doesNotMatch(app.element('waStatus').textContent,/PRIVATE|could not be verified/);assert.equal(app.element('waRefresh').disabled,false);
  }
});
test('Demo clears analytics facts and pending bodies and prevents source reads until Live resumes',async()=>{
  let hold=false;const pending=deferred(),app=await analyticsApp(()=>hold?pending.promise:response(analyticsReport()));
  hold=true;await app.click('waRefresh');await tick();const count=app.calls.filter(c=>c.path.includes('/website-analytics?')).length;
  await app.window.primetimeDataMode.setMode('demo');await tick();assert.equal(app.element('waRefresh').disabled,true);
  pending.resolve(response(analyticsReport()));await tick();await tick();assert.doesNotMatch(nodeText(app.element('waMetrics')),/7,203/);
  await app.click('waRefresh');app.clock.run();assert.equal(app.calls.filter(c=>c.path.includes('/website-analytics?')).length,count);
  assert.match(app.element('waStatus').textContent,/paused in Demo/);
  hold=false;await app.window.primetimeDataMode.setMode('live');await tick();await tick();
  assert.match(nodeText(app.element('waMetrics')),/7,203/);assert.equal(app.element('waRefresh').disabled,false);
});
const liveMetadata = { ok: true, mode: 'live', dataApproved: true, settings: { officeId: '123', officeTimezone: 'America/Chicago' }, panels: { visits: { available: true } } };

function scheduledFeedPage(path, overrides = {}) {
  const page = numberedSourcePage(path);
  return { ...page, feed: { kind: 'scheduled_api', background: true, intervalSeconds: 60, maxAgeSeconds: 180,
    checkedAt: page.fetchedAt, persistedImport: false, coverage: 'first_source_page' }, ...overrides };
}
async function apiFeedFixture(read = path => response(scheduledFeedPage(path)), initialClock) {
  const app = harness({ storedDataMode: null, metadata: liveMetadata,
    fetchSource: path => path.includes('/views/feed?') ? read(path) : response(numberedSourcePage(path)) });
  const timers = new Map(); let timerId = 10000;
  app.context.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
  app.context.clearTimeout = id => timers.delete(id);
  app.element('apiFeedControl').dataset.enabled = 'true';
  const clock = initialClock ? deviceClock(app, initialClock) : null;
  installDashboard(app); await app.signIn(); await tick(); await tick();
  return { ...app, timers, clock, async runFeed() {
    const next = [...timers].find(([, item]) => item.delay === 60000);
    assert.ok(next, 'one minute feed check must be scheduled'); timers.delete(next[0]); next[1].fn(); await tick(); await tick(); await tick();
  } };
}

test('automatic API feed reads the server cache, validates receipts and updates both source views with paging intact', async () => {
  const app = await apiFeedFixture();
  await app.runFeed();
  assert.equal(app.calls.filter(call => call.path.includes('/views/feed?')).length, 1);
  assert.match(app.element('apiFeedStatus').textContent, /Connected to HHA API/);
  assert.match(app.element('dashboardVisitMetadata').textContent, /server updates every minute/);
  assert.match(nodeText(app.element('dashboardVisitRows')), /900001/);
  assert.equal(app.element('dashboardOverviewNext').hidden, false);
  assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 1);
  await app.click('apiFeedToggle');
  assert.match(app.element('apiFeedStatus').textContent, /paused/);
  assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 0);
});
test('feed errors and invalid/future/expired receipts clear prior evidence and schedule a bounded retry', async () => {
  for (const mode of ['error', 'expired', 'future', 'wrong_marker']) {
    const app = await apiFeedFixture(path => {
      const page = scheduledFeedPage(path);
      if (mode === 'error') return { ...response({ ok: false }), ok: false, status: 503 };
      if (mode === 'expired') page.feed.checkedAt = new Date(Date.parse(page.fetchedAt) + 181000).toISOString();
      if (mode === 'future') page.feed.checkedAt = new Date(Date.parse(page.fetchedAt) - 1000).toISOString();
      if (mode === 'wrong_marker') page.feed.kind = 'manual_snapshot';
      return response(page);
    });
    await app.runFeed();
    assert.match(app.element('apiFeedStatus').textContent, /Retrying in one minute/);
    assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /900001/);
    assert.equal(app.element('dashboardOverviewMetadata').textContent, '');
    assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 1);
  }
});
test('clear during a pending feed check fences its late success and leaves automatic display updates paused', async () => {
  const late = deferred(); let path;
  const app = await apiFeedFixture(value => { path = value; return late.promise; });
  await app.runFeed();
  assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 0, 'no overlapping poll');
  await app.click('dashboardOverviewClear');
  late.resolve(response(scheduledFeedPage(path))); await tick(); await tick();
  assert.equal(app.element('dataModeBadge').textContent, 'Live · no source page');
  assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /900001/);
  assert.equal(app.element('apiFeedToggle').textContent, 'Resume live feed');
  assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 0);
});
test('source paging pauses automatic display replacement and explicit resume returns to the feed first page', async () => {
  const app = await apiFeedFixture(); await app.runFeed();
  await app.click('dashboardOverviewNext'); await tick(); await tick();
  assert.match(nodeText(app.element('dashboardVisitRows')), /900002/);
  assert.equal(app.element('apiFeedToggle').textContent, 'Resume live feed');
  assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 0);
  await app.click('apiFeedToggle'); await tick(); await tick();
  assert.match(nodeText(app.element('dashboardVisitRows')), /900001/);
  assert.equal(app.element('dashboardOverviewPrevious').hidden, true);
});
test('hidden, signed-out and Demo contexts stop dashboard polling without changing server permissions', async () => {
  const app = await apiFeedFixture();
  app.document.visibilityState = 'hidden'; app.dispatch('visibilitychange');
  assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 0);
  assert.match(app.element('apiFeedStatus').textContent, /server API feed continues/);
  app.document.visibilityState = 'visible'; app.dispatch('visibilitychange'); await tick(); await tick();
  assert.match(app.element('apiFeedStatus').textContent, /Connected/);
  app.window.primetimeDataMode.setMode('demo'); await tick();
  assert.equal(app.element('apiFeedControl').hidden, true);
  assert.equal([...app.timers.values()].filter(t => t.delay === 60000).length, 0);
  await app.auth.signOut(); await tick();
  assert.equal(app.element('apiFeedToggle').disabled, true);
});
test('automatic source replacement pauses when keyboard focus is working inside source evidence', async () => {
  const app = await apiFeedFixture();
  app.document.activeElement = { closest: () => app.element('dashboardVisitRows') };
  await app.runFeed();
  assert.equal(app.calls.filter(call => call.path.includes('/views/feed?')).length, 0);
  assert.match(app.element('apiFeedStatus').textContent, /paused while working with source records/);
  assert.equal(app.element('apiFeedToggle').textContent, 'Resume live feed');
  assert.match(nodeText(app.element('dashboardVisitRows')), /900001/);
});

const sourceLabels = app => [app.element('dataModeBadge').textContent, app.element('environmentDetails').textContent];
async function loadedLabelFixture() {
  const app = harness({ storedDataMode:null, metadata:liveMetadata, fetchSource:path => response(numberedSourcePage(path)) });
  installDashboard(app); await app.signIn(); await tick(); await tick();
  assert.deepEqual(sourceLabels(app), ['Live · HHA source', 'Live HHA visit source returned']);
  return app;
}
test('source labels replace prior success after access failure, malformed status or blocked access and recover on retry', async () => {
  for (const result of ['failure', 'malformed', 'blocked']) {
    const app = await loadedLabelFixture(), original = app.window.primetimeApiFetch;
    const before = app.calls.filter(c => c.path.includes('/views/visits?')).length;
    app.window.primetimeApiFetch = async (path, options) => {
      if (!path.endsWith('/data/status')) return original(path, options);
      if (result === 'failure') throw new Error('synthetic access failure');
      return response(result === 'malformed' ? {ok:true,mode:'wrong'} : {...liveMetadata,dataApproved:false});
    };
    await app.click('dashboardVisitRefresh'); await tick(); await tick();
    assert.deepEqual(sourceLabels(app), ['Live · unavailable', result === 'blocked' ? 'HHA visit source access unavailable' : 'Source access status unavailable']);
    assert.equal(app.calls.filter(c => c.path.includes('/views/visits?')).length, before);
    assert.equal(app.element('dashboardVisitMetadata').textContent, '');
    app.window.primetimeApiFetch = original;
    await app.click('dashboardVisitRefresh'); await tick(); await tick();
    assert.deepEqual(sourceLabels(app), ['Live · HHA source', 'Live HHA visit source returned']);
  }
});
test('invalid service date leaves terminal labels and issues no visit request', async () => {
  const app = await loadedLabelFixture(), count = app.calls.length;
  app.element('dashboardVisitDate').value = '';
  for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change'));
  assert.deepEqual(sourceLabels(app), ['Live · date required', 'Choose a service date']);
  assert.equal(app.calls.length, count);
  assert.equal(app.element('dashboardVisitMetadata').textContent, '');
});
test('409 and 423 visit responses replace loading labels and explicit retry restores source labels', async () => {
  for (const status of [409,423]) {
    const app = await loadedLabelFixture(), original = app.window.primetimeApiFetch;
    app.window.primetimeApiFetch = async () => ({...response({ok:false,error:'visit_reads_not_owner_enabled'}),ok:false,status});
    await app.click('dashboardVisitNext'); await tick(); await tick();
    assert.deepEqual(sourceLabels(app), status === 409 ? ['Live · refresh required', 'Source scope or evidence changed'] : ['Live · unavailable', 'HHA visit source access unavailable']);
    assert.equal(app.element('dashboardVisitMetadata').textContent, '');
    app.window.primetimeApiFetch = original;
    await app.click('dashboardOverviewRefresh'); await tick(); await tick();
    assert.deepEqual(sourceLabels(app), ['Live · HHA source', 'Live HHA visit source returned']);
  }
});
test('pending metadata labels describe access checking and stale failure cannot overwrite a newer successful read', async () => {
  const app = await loadedLabelFixture(), original = app.window.primetimeApiFetch, pending = deferred();
  app.window.primetimeApiFetch = path => path.endsWith('/data/status') ? pending.promise : original(path);
  await app.click('dashboardOverviewRefresh'); await tick();
  assert.deepEqual(sourceLabels(app), ['Live · checking access', 'Checking HHA source access']);
  app.window.primetimeApiFetch = original;
  await app.click('dashboardOverviewRefresh'); await tick(); await tick();
  pending.reject(new Error('obsolete status')); await tick(); await tick();
  assert.deepEqual(sourceLabels(app), ['Live · HHA source', 'Live HHA visit source returned']);
});
test('late metadata and terminal visit responses cannot replace Demo labels', async () => {
  for (const kind of ['metadata','visit']) {
    const app = await loadedLabelFixture(), pending = deferred();
    app.window.primetimeApiFetch = () => pending.promise;
    await app.click(kind === 'metadata' ? 'dashboardOverviewRefresh' : 'dashboardVisitNext'); await tick();
    app.window.primetimeDataMode.setMode('demo');
    pending.resolve(kind === 'metadata' ? response({...liveMetadata,dataApproved:false}) : {...response({ok:false}),ok:false,status:409});
    await tick(); await tick();
    assert.deepEqual(sourceLabels(app), ['Demo · synthetic', 'Synthetic preview records']);
    assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-/);
  }
});

test('the same dashboard hosts clear Demo values in Live and show source failures without samples', async () => {
  const app = harness({ metadata: liveMetadata, fetchSource: path => {
    const result = response({ ok: false, error: 'synthetic source failure' });
    result.ok = false; result.status = 503; return result;
  } });
  installDashboard(app);
  await app.signIn();
  const rows = app.element('dashboardVisitRows'), metrics = app.element('dashboardOverviewMetrics');
  assert.match(nodeText(rows), /DEMO-V-/);
  assert.equal(app.element('fixture-exceptions-badge').textContent, '8');
  app.window.primetimeDataMode.setMode('live');
  assert.equal(nodeText(rows).includes('DEMO-'), false, 'mode switch must clear old rows synchronously');
  const sourceHosts = ['dashboardOverviewMetrics', 'dashboardOverviewExceptions', 'dashboardCoverage', 'dashboardAlerts',
    'dashboardExceptions', 'dashboardVisitMetrics', 'dashboardVisitRows', 'dashboardMessages', 'dashboardStaffing',
    'dashboardBillingMetrics', 'dashboardBillingPipeline', 'dashboardAudit', 'dashboardSettings'];
  const allLiveText = sourceHosts.map(id => nodeText(app.element(id))).join(' ');
  const examples = app.window.primetimeDemoData.dashboard(app.element('dashboardVisitDate').value);
  for (const value of ['DEMO-', examples.rules[0].detail, examples.audit[0].actor, examples.settings[0].detail,
    `${(examples.billing.projectedMinutes / 60).toFixed(1)}h`]) assert.equal(allLiveText.includes(value), false, `Live must clear sample value: ${value}`);
  assert.equal(app.element('fixture-exceptions-badge').hidden, true);
  assert.equal(app.element('fixture-alerts-badge').hidden, true);
  await tick(); await tick();
  assert.ok(app.calls.some(call => call.path.startsWith('/primetime/api/views/visits?')));
  assert.equal(nodeText(rows).includes('DEMO-'), false);
  assert.match(nodeText(rows), /unavailable/i);
  assert.match(nodeText(metrics), /unavailable/i);
  app.window.primetimeDataMode.setMode('demo');
  assert.equal(app.element('dashboardVisitRows'), rows, 'source switching must keep the dashboard layout');
  assert.match(nodeText(rows), /DEMO-V-/);
});

test('a stale Live dashboard request cannot repaint Demo with source records', async () => {
  const pending = deferred();
  let sourceDate;
  const app = harness({ metadata: liveMetadata, fetchSource: path => {
    if (path.startsWith('/primetime/api/views/visits?')) {
      sourceDate = new URL(path, 'https://pthhs.net').searchParams.get('date');
      return pending.promise;
    }
    return response({ ok: true });
  } });
  installDashboard(app);
  await app.signIn();
  await app.live();
  assert.ok(sourceDate, 'a real Live preview request must be pending');
  app.window.primetimeDataMode.setMode('demo');
  const rows = app.element('dashboardVisitRows');
  assert.match(nodeText(rows), /DEMO-V-/);
  pending.resolve(response(livePreview(sourceDate)));
  await tick(); await tick();
  assert.match(nodeText(rows), /DEMO-V-/);
  assert.equal(nodeText(rows).includes('900001'), false);
});

for (const changed of [{ officeId: '456', officeTimezone: 'America/Chicago', revision: 2 }, { officeId: '123', officeTimezone: 'America/Chicago', revision: 2 }]) {
  test(`office/policy change fences pending bodies and clears integration status ${JSON.stringify(changed)}`, async () => {
    const body = deferred(), wire = response(); wire.json = () => body.promise;
    const app = harness({ fetchSource: path => path === sourcePath ? wire : response() });
    await app.signIn(); await app.live();
    const mode = app.window.primetimeDataMode;
    mode.observeScope({ officeId: '123', officeTimezone: 'America/Chicago', revision: 1 });
    const result = await app.window.primetimeApiFetch(sourcePath, sourceRequest);
    const pending = result.json(), rejected = assert.rejects(pending, /data_mode_changed/);
    app.element('integrationSyncDetails').textContent = 'OLD-OFFICE-HISTORY';
    app.element('hhaConnectionStatus').textContent = 'OLD-REACHABLE';
    mode.observeScope(changed);
    assert.equal(app.element('integrationSyncDetails').textContent.includes('OLD-OFFICE'), false);
    assert.equal(app.element('hhaConnectionStatus').textContent.includes('OLD-REACHABLE'), false);
    body.resolve({ records: [{ ID: 'OLD-OFFICE' }] }); await rejected;
  });
}

test('Demo visit pages advance, finish and restart without source calls', async () => {
  const app = harness(); installDashboard(app); await app.signIn();
  assert.equal(app.element('dashboardOverviewPrevious').hidden, true);
  assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-1048/);
  await app.click('dashboardVisitNext');
  assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-1058/);
  assert.equal(app.element('dashboardOverviewPrevious').hidden, false);
  await app.click('dashboardOverviewPrevious');
  assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-1048/);
  assert.equal(app.element('dashboardVisitPrevious').hidden, true);
  await app.click('dashboardOverviewNext');
  for (let i=0;i<3;i++) await app.click('dashboardVisitNext');
  assert.equal(app.element('dashboardVisitNext').hidden, true);
  await app.click('dashboardVisitRefresh');
  assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-1048/);
  assert.equal(app.calls.filter(call => !call.path.endsWith('/session')).length, 0);
});

test('live evidence excludes unavailable detail fields and never classifies visit completion', () => {
  const model = dashboardModel().primetimeDashboardModel, payload = livePreview('2026-10-10');
  payload.state = 'partial';
  payload.items[0].actualStart = '2026-10-10T08:04:00';
  payload.items.push({ ...payload.items[0], id: '900002', state: 'unavailable', actualEnd: '2026-10-10T12:00:00', evvEnd: 'source string' });
  const view = model.normalizeVisitPreview(payload, { mode: 'live', date: '2026-10-10', officeId: '123' });
  assert.equal(view.items[1].actualStart, null);
  const evidence = model.sourceEvidence(view.items);
  assert.equal(evidence.records, 2); assert.equal(evidence.readable, 1); assert.equal(evidence.unavailable, 1);
  assert.equal(evidence.assigned, 1); assert.equal(evidence.actualStartOnly, 1); assert.equal(evidence.actualPairs, 0); assert.equal(evidence.evvPairs, 0);
  for (const field of ['completed', 'late', 'clockedInNow', 'coveragePercent', 'billableHours']) assert.equal(field in evidence, false);
  assert.throws(() => model.normalizeVisitPreview({ ...payload, items: [payload.items[0], payload.items[0]] }, { mode: 'live', date: '2026-10-10' }));
});

function deferredVisitPage(date, wait = 37) {
  const page = livePreview(date); page.state = 'partial';
  page.items.push({ id: '900002', state: 'unavailable', error: 'vendor_backoff_active' });
  page.discovery = { fingerprint: 'a'.repeat(64), selectedCount: 3, truncated: false };
  page.page = { offset: 0, selectedCount: 2, returnedCount: 1, unavailableCount: 1, nextOffset: 2 };
  page.nextCursor = 'next-after-deferred';
  page.retry = { cursor: 'retry-first-deferred', offset: 1, afterSeconds: wait, reason: 'read_limit' };
  return page;
}

test('deferred retry metadata can target only an unavailable row inside the verified page', () => {
  const model = dashboardModel().primetimeDashboardModel, date = '2026-10-10', page = deferredVisitPage(date);
  const expected = { mode: 'live', officeId: '123', date };
  assert.equal(model.normalizeVisitPreview(page, expected).retry.offset, 1);
  for (const changed of [{offset:0},{offset:2},{offset:-1},{cursor:'https://foreign.test'},{cursor:''},{afterSeconds:601},{afterSeconds:-1},{reason:'source_gate'}]) {
    assert.throws(()=>model.normalizeVisitPreview({...page,retry:{...page.retry,...changed}},expected),/invalid_visit_retry/);
  }
  assert.throws(()=>model.normalizeVisitPreview({...page,page:undefined},expected),/invalid_visit_retry/);
});

test('deferred reads honor source delay, resume at the skipped detail and preserve previous-page navigation', async () => {
  const app = harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>{
    const query=new URL(path,'https://fixture.test').searchParams,date=query.get('date');
    if(!query.has('cursor'))return response(deferredVisitPage(date));
    assert.equal(query.get('cursor'),'retry-first-deferred');
    const page=livePreview(date);page.items[0].id='900002';
    page.discovery={fingerprint:'a'.repeat(64),selectedCount:3,truncated:false};
    page.page={offset:1,selectedCount:1,returnedCount:1,unavailableCount:0,nextOffset:null};return response(page);
  }});
  const clock=deviceClock(app,'2026-10-10T12:00:00Z');installDashboard(app);await app.signIn();await tick();await tick();
  for(const id of ['dashboardOverviewRetry','dashboardVisitRetry','dashboardEvvRetry']){assert.equal(app.element(id).hidden,false);assert.equal(app.element(id).disabled,true);await app.click(id);}
  const initial=app.calls.filter(c=>c.path.includes('/views/visits?')).length;
  await app.click('dashboardOverviewRefresh');assert.equal(app.calls.filter(c=>c.path.includes('/views/visits?')).length,initial);
  assert.match(app.element('dashboardEvvRetryStatus').textContent,/37 seconds/);
  clock.set('2026-10-10T12:00:37Z');clock.run();
  assert.equal(app.element('dashboardEvvRetry').disabled,false);
  await app.click('dashboardEvvRetry');await tick();await tick();
  assert.equal(app.calls.filter(c=>c.path.includes('/views/visits?')).length,initial+1);
  assert.match(nodeText(app.element('dashboardExceptions')),/900002/);assert.doesNotMatch(nodeText(app.element('dashboardExceptions')),/900001/);
  assert.equal(app.element('dashboardEvvRetry').hidden,true);assert.equal(app.element('dashboardOverviewPrevious').hidden,false);
  await app.click('dashboardOverviewPrevious');await tick();await tick();
  assert.match(nodeText(app.element('dashboardExceptions')),/900001/);assert.equal(app.element('dashboardOverviewPrevious').hidden,true);
});

test('HTTP quota while resuming retains that exact cursor and never starts over silently', async () => {
  let attempts=0;
  const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>{
    const query=new URL(path,'https://fixture.test').searchParams,date=query.get('date');
    if(!query.has('cursor'))return response(deferredVisitPage(date,0));
    assert.equal(query.get('cursor'),'retry-first-deferred');
    if(++attempts===1)return {...response({ok:false,error:'vendor_backoff_active',retryAfterSeconds:21}),ok:false,status:429};
    const page=livePreview(date);page.items[0].id='900002';return response(page);
  }});
  const clock=deviceClock(app,'2026-10-10T12:00:00Z');installDashboard(app);await app.signIn();await tick();await tick();
  await app.click('dashboardVisitRetry');await tick();await tick();
  assert.match(app.element('dashboardVisitStatus').textContent,/selected page is retained/);assert.equal(app.element('dashboardVisitRetry').disabled,true);
  assert.doesNotMatch(nodeText(app.element('dashboardExceptions')),/900001/);
  await app.click('dashboardVisitRetry');assert.equal(attempts,1);
  clock.set('2026-10-10T12:00:21Z');clock.run();await app.click('dashboardVisitRetry');await tick();await tick();
  assert.equal(attempts,2);assert.match(nodeText(app.element('dashboardExceptions')),/900002/);
});

test('changing date during a source delay clears old facts and retry scope without another source dispatch', async () => {
  const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>response(deferredVisitPage(new URL(path,'https://fixture.test').searchParams.get('date')))});
  const clock=deviceClock(app,'2026-10-10T12:00:00Z');installDashboard(app);await app.signIn();await tick();await tick();
  const count=app.calls.filter(c=>c.path.includes('/views/visits?')).length;
  app.element('dashboardOverviewDate').value='2026-10-09';
  for(const fn of app.element('dashboardOverviewDate').handlers.get('change')||[])fn(new Event('change'));
  await tick();assert.doesNotMatch(nodeText(app.element('dashboardExceptions')),/900001/);
  assert.equal(app.element('dashboardEvvRetry').hidden,true);
  await app.click('dashboardEvvRetry');assert.equal(app.calls.filter(c=>c.path.includes('/views/visits?')).length,count);
  clock.set('2026-10-10T12:00:37Z');clock.run();await app.click('dashboardOverviewRefresh');await tick();await tick();
  assert.equal(new URL(app.calls.filter(c=>c.path.includes('/views/visits?')).at(-1).path,'https://fixture.test').searchParams.get('date'),'2026-10-09');
  await app.window.primetimeDataMode.setMode('demo');await tick();
  assert.equal(app.element('dashboardEvvRetry').hidden,true);assert.equal(app.element('dashboardEvvRetryStatus').hidden,true);
});

for (const [status, title] of [[429, 'Read rate limited (HTTP 429)'], [503, 'Source temporarily unavailable (HTTP 503)']]) {
  test(`source preview HTTP ${status} identifies the delay while retaining its guarded retry`, async () => {
    let attempts = 0; const paths = [];
    const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => {
      if (!path.includes('/views/visits?')) return response({ ok: true });
      paths.push(path);
      if (++attempts === 1) return { ...response({ ok: false, retryAfterSeconds: 7, error: 'PRIVATE_SOURCE_REASON', message: 'PRIVATE_VENDOR_DETAIL' }), ok: false, status };
      return response(livePreview(new URL(path, 'https://fixture.test').searchParams.get('date')));
    } });
    const clock = deviceClock(app, '2026-10-10T12:00:00Z');
    installDashboard(app); await app.signIn(); await tick(); await tick();
    assert.ok(nodeText(app.element('dashboardVisitRows')).includes(title));
    assert.ok(app.element('dashboardVisitStatus').textContent.includes(title));
    assert.match(app.element('dashboardVisitStatus').textContent, /selected page is retained for retry/);
    assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /PRIVATE_SOURCE_REASON|PRIVATE_VENDOR_DETAIL/);
    assert.equal(app.element('dashboardVisitRetry').disabled, true);
    assert.equal(app.element('dashboardVisitRefresh').disabled, true);
    assert.match(app.element('dashboardVisitRetryStatus').textContent, /7 seconds/);
    await app.click('dashboardVisitRetry');
    assert.equal(attempts, 1, 'the label must not add a request or bypass the delay');
    clock.set('2026-10-10T12:00:07Z'); clock.run();
    await app.click('dashboardVisitRetry'); await tick(); await tick();
    assert.equal(attempts, 2);
    assert.equal(paths[1], paths[0], 'retry keeps the exact date, office and cursor');
    assert.match(nodeText(app.element('dashboardVisitRows')), /Source unvalidated/);
  });
}

test('returned missing clock fields alone never advertise a deferred-source retry', async () => {
  const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>response(livePreview(new URL(path,'https://fixture.test').searchParams.get('date')))});
  installDashboard(app);await app.signIn();await tick();await tick();
  assert.match(nodeText(app.element('dashboardExceptions')),/Not supplied by HHA/);
  assert.equal(app.element('dashboardEvvRetry').hidden,true);assert.equal(app.element('dashboardOverviewRetry').hidden,true);
});

test('source-clock timeline refuses cross-day, reversed, absent and mixed-offset intervals', () => {
  const interval = dashboardModel().primetimeDashboardModel.sourceInterval, date = '2026-10-10';
  const valid = interval(date + 'T06:00:00', date + 'T12:00:00', date);
  assert.equal(valid.left, 25); assert.equal(valid.width, 25);
  // HHA Enterprise v3.30 GetVisitInfoV3 documents YYYY-MM-DD HH:MM.
  const documented = interval(date + ' 06:00', date + ' 12:00', date);
  assert.equal(documented.left, 25); assert.equal(documented.width, 25);
  for (const [start, end] of [[null, null], [date + 'T23:00:00', '2026-10-11T02:00:00'], [date + 'T12:00:00', date + 'T06:00:00'],
    [date + 'T08:00:00Z', date + 'T10:00:00-05:00'], ['0001-01-01T00:00:00', date + 'T10:00:00'], [date + 'T25:00:00', date + 'T26:00:00']]) assert.equal(interval(start, end, date), null);
});

test('dashboard visualizations preserve the deployed CSP without inline styles', () => {
  const script = asset('dashboard.js'), config = readFileSync(new URL('../firebase.json', import.meta.url), 'utf8');
  assert.match(config, /style-src 'self'/);
  assert.doesNotMatch(script, /setAttribute\(['"]style['"]|\.style\s*[.[]/);
  assert.match(script, /createElementNS\(['"]http:\/\/www\.w3\.org\/2000\/svg['"]/);
});

test('live default renders source counts, timeline, EVV and assignment evidence for the same page', async () => {
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => {
    const date = new URL(path, 'https://fixture.test').searchParams.get('date'), payload = livePreview(date);
    payload.discovery = { fingerprint: 'a'.repeat(64), selectedCount: 1601, truncated: false };
    payload.page = { offset: 0, selectedCount: 1, returnedCount: 1, unavailableCount: 0, nextOffset: 1 };
    payload.state = 'partial'; payload.nextCursor = 'next-page';
    return response(payload);
  } });
  installDashboard(app); await app.signIn(); await tick(); await tick();
  assert.equal(app.window.primetimeDataMode.getMode(), 'live');
  assert.equal(app.element('demoDataToggle').checked, false);
  for (const id of ['dashboardTimeline', 'dashboardOverviewExceptions']) assert.match(nodeText(app.element(id)), /900001/);
  assert.match(nodeText(app.element('dashboardOverviewMetrics')), /1601/);
  assert.match(nodeText(app.element('dashboardOverviewMetrics')), /All returned IDs.*selected office and day/);
  assert.match(nodeText(app.element('dashboardCoverage')), /1 \/ 1/);
  for (const id of ['dashboardExceptions', 'dashboardStaffing']) {
    assert.match(nodeText(app.element(id)), /900001/);
    assert.match(nodeText(app.element(id)), /HHA API source page/);
    assert.match(nodeText(app.element(id)), /not the full office/);
    assert.doesNotMatch(nodeText(app.element(id)), /DEMO-|Open shifts unavailable|EVV exceptions unavailable/);
  }
  assert.match(nodeText(app.element('dashboardExceptions')), /not automatically late/);
  assert.match(nodeText(app.element('dashboardStaffing')), /do not establish staff eligibility/);
  assert.equal(app.element('exceptionSearch').disabled, false);
  assert.equal(app.element('priorityFilter').disabled, true);
  assert.match(nodeText(app.element('dashboardEvidenceChart')), /EVV start/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /1 \/ 1601.*checked/);
  assert.match(app.element('dashboardOverviewScope').textContent, /Office: 123.*Date:.*America\/Chicago/);
  assert.equal(app.element('dashboardOverviewDate').value, app.element('dashboardVisitDate').value);
  assert.equal(app.element('dashboardOverviewNext').hidden, false);
  assert.equal(app.element('dashboardVisitNext').hidden, false);
  assert.equal(nodeText(app.element('dashboardOverviewMetrics')).includes('DEMO'), false);
});

test('Preview, EVV and staffing distinguish unavailable details from absent fields and supplied zero hours', async () => {
  let sourceRequests = 0;
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => {
    if (!path.startsWith('/primetime/api/views/visits?')) return response({ ok: true });
    sourceRequests += 1;
    const date = new URL(path, 'https://fixture.test').searchParams.get('date'), payload = livePreview(date);
    payload.state = 'partial';
    payload.items[0].caregiverId = null;
    payload.items[0].actualStart = `${date}T08:04:00`;
    Object.assign(payload.items[0], { actualHours: '0.00', scheduleDurationHours: '0', scheduleDurationMinutes: '0' });
    payload.items.push({ ...payload.items[0], id: '900002', state: 'unavailable', error: 'read_budget_exhausted_retry_next_minute',
      caregiverId: 'UNVERIFIED-CAREGIVER', actualEnd: 'UNVERIFIED-CLOCK', evvEnd: 'UNVERIFIED-EVV' });
    return response(payload);
  } });
  installDashboard(app); await app.signIn(); await tick(); await tick();
  const rows = id => app.element(id).children.find(child => child.className === 'table-wrap')
    .children[0].children.find(child => child.tagName === 'TBODY').children;
  for (const id of ['dashboardVisitRows', 'dashboardExceptions', 'dashboardStaffing']) {
    const [returned, unavailable] = rows(id).map(nodeText);
    assert.match(returned, /900001/);
    assert.match(returned, /Not supplied by HHA/);
    assert.match(unavailable, /900002/);
    assert.match(unavailable, /Detail unavailable: Shared read limit reached/);
    assert.doesNotMatch(unavailable, /Not supplied by HHA|UNVERIFIED-|08:04:00|08:00:00|12:00:00/);
  }
  assert.deepEqual(rows('dashboardVisitRows')[1].children.slice(3, 8).map(nodeText), Array(5).fill('Detail unavailable'));
  assert.match(nodeText(rows('dashboardVisitRows')[0]), /0 h 0 min · HHA/);
  assert.match(nodeText(rows('dashboardVisitRows')[0]), /0.00 h · HHA/);
  assert.match(nodeText(rows('dashboardExceptions')[0]), /08:04:00/);
  assert.match(nodeText(rows('dashboardExceptions')[0]), /Source detail returned/);
  assert.match(nodeText(rows('dashboardStaffing')[0]), /Caregiver reference not supplied/);
  assert.equal(sourceRequests, 1, 'both panels reuse the selected visit page without additional source reads');
});

test('source-page navigation clears old overview charts immediately and an empty page shows zero records', async () => {
  const pending = deferred(); let request = 0;
  const app = harness({ metadata: liveMetadata, fetchSource: path => {
    const date = new URL(path, 'https://fixture.test').searchParams.get('date'); request += 1;
    if (request > 1) return pending.promise;
    const payload = livePreview(date); payload.nextCursor = 'next-page'; payload.state = 'partial'; return response(payload);
  } });
  installDashboard(app); await app.signIn(); await app.live(); await tick();
  assert.match(nodeText(app.element('dashboardTimeline')), /900001/);
  await app.click('dashboardOverviewNext');
  assert.equal(nodeText(app.element('dashboardTimeline')).includes('900001'), false);
  assert.match(nodeText(app.element('dashboardOverviewMetrics')), /Loading live visits/);
  const empty = livePreview(app.element('dashboardVisitDate').value); empty.items = []; empty.state = 'empty';
  pending.resolve(response(empty)); await tick(); await tick();
  assert.match(nodeText(app.element('dashboardOverviewMetrics')), /0 \/ 0/);
  assert.match(nodeText(app.element('dashboardTimeline')), /No source visits/);
  assert.match(app.element('dashboardOverviewStatus').textContent, /0 of 0 visits checked/);
  assert.equal(app.element('dashboardOverviewNext').hidden, true);
});

test('overview date change is shared with Visits and clears source records before the next response', async () => {
  const pending = deferred(); let request = 0;
  const app = harness({ metadata: liveMetadata, fetchSource: path => {
    if (++request > 1) return pending.promise;
    return response(livePreview(new URL(path, 'https://fixture.test').searchParams.get('date')));
  } });
  installDashboard(app); await app.signIn(); await app.live(); await tick();
  app.element('dashboardOverviewDate').value = '2026-10-09';
  for (const fn of app.element('dashboardOverviewDate').handlers.get('change') || []) fn(new Event('change'));
  assert.equal(app.element('dashboardVisitDate').value, '2026-10-09');
  assert.equal(nodeText(app.element('dashboardTimeline')).includes('900001'), false);
  pending.resolve(response(livePreview('2026-10-09'))); await tick(); await tick();
  assert.match(app.element('dashboardOverviewScope').textContent, /2026-10-09/);
  assert.match(nodeText(app.element('dashboardTimeline')), /2026-10-09T08:00:00/);
});

test('source read controls and persisted import history describe separate actions', () => {
  const html = asset('index.html');
  for (const id of ['dashboardOverviewRefresh', 'dashboardVisitRefresh']) {
    assert.match(html, new RegExp(`id=(?:"${id}"|${id})[^>]*>${id === 'dashboardOverviewRefresh' ? 'Read entire day' : 'Read source now'}</button>`));
  }
  assert.doesNotMatch(html, /id=(?:"dashboardOverviewNext"|dashboardOverviewNext)[\s>]/);
  assert.match(html, /Persisted import history/);
  assert.match(html, /Check connection and history/);
  assert.match(html, /CSV upload and starting (?:an import are not available|imports are unavailable)/);
});

for (const state of ['ready', 'partial', 'empty']) {
  test(`on-demand ${state} source pages retain unknown totals and do not advance import history`, async () => {
    const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => {
      if (path.endsWith('/integration/health')) return response({ ok: true, sync: { state: 'never_synced', lastSuccessfulAt: null, processedCount: 0, deadLetterCount: 0 } });
      if (!path.startsWith('/primetime/api/views/visits?')) return response({ ok: true });
      const payload = livePreview(new URL(path, 'https://fixture.test').searchParams.get('date'));
      payload.state = state;
      if (state === 'partial') payload.completeness.truncated = true;
      if (state === 'empty') { payload.items = []; payload.fetchedAt = null; }
      return response(payload);
    } });
    installDashboard(app); await app.signIn(); await tick(); await tick();
    const history = app.element('integrationSyncDetails').textContent;
    assert.match(history, /No successful import recorded/);
    assert.match(history, /on-demand source pages do not import visits or advance this history/);
    for (const id of ['dashboardOverviewRefresh', 'dashboardVisitRefresh']) {
      assert.equal(app.element(id).textContent, id === 'dashboardOverviewRefresh' ? 'Read entire day' : 'Read source now');
      await app.click(id); await tick(); await tick();
    }
    assert.equal(app.element('integrationSyncDetails').textContent, history);
    for (const prefix of ['dashboardVisit']) {
      assert.match(app.element(prefix + 'Metadata').textContent, /on-demand read, not a persisted visit import/);
      assert.match(app.element(prefix + 'Metadata').textContent, /source unvalidated/);
      assert.match(app.element(prefix + 'Metadata').textContent, state === 'empty' ? /fetched: Unavailable/ : /fetched: 2026-10-10T08:00:00Z/);
      assert.match(app.element(prefix + 'Completeness').textContent, /Office totals are unknown/);
      assert.match(app.element(prefix + 'Completeness').textContent, /received search IDs retained; 10 details per page and a 25-second detail-read budget/);
      if (state === 'partial') assert.match(app.element(prefix + 'Completeness').textContent, /results were truncated/);
      assert.equal(app.element(prefix + 'Next').hidden, true, 'no next cursor must not imply a complete office dataset');
    }
    assert.match(app.element('dashboardModeNotice').textContent, /does not save a visit import or start background synchronization/);
    assert.ok(app.calls.filter(call => call.path.startsWith('/primetime/api/views/visits?')).length >= 3);
    assert.ok(app.calls.every(call => !call.options.method || call.options.method === 'GET'), 'source refresh must not dispatch an import or other mutation');
    app.window.primetimeDataMode.setMode('demo');
    for (const id of ['dashboardOverviewRefresh', 'dashboardVisitRefresh']) assert.equal(app.element(id).textContent, 'Refresh examples');
    assert.doesNotMatch(app.element('dashboardVisitMetadata').textContent, /on-demand read/);
  });
}

function numberedSourcePage(path) {
  const query = new URL(path, 'https://fixture.test').searchParams, cursor = query.get('cursor');
  const index = cursor === 'page-three' ? 2 : cursor === 'page-two' ? 1 : 0;
  const payload = livePreview(query.get('date'));
  payload.items[0].id = String(900001 + index);
  payload.discovery = { fingerprint: 'a'.repeat(64), selectedCount: 3, truncated: false };
  payload.page = { offset: index, selectedCount: 1, returnedCount: 1, unavailableCount: 0, nextOffset: index < 2 ? index + 1 : null };
  payload.nextCursor = index === 0 ? 'page-two' : index === 1 ? 'page-three' : null;
  payload.state = 'partial';
  return payload;
}

function cachedOfficeDay(path, count = 23) {
  const date = new URL(path, 'https://fixture.test').searchParams.get('date'), base = livePreview(date), receipt = base.fetchedAt;
  return { ...base, discovery: { selectedCount: count, truncated: false },
    items: Array.from({ length: count }, (_, i) => ({ ...base.items[0], id: String(900001 + i), detailFetchedAt: receipt, officeCheckedAt: receipt })),
    officeDayCache: { kind: 'scheduled_office_day_api', persistedImport: false, background: true, known: true, done: true, complete: true,
      startedAt: receipt, latestSearchAt: receipt, completedAt: receipt, checkedAt: receipt, updatedAt: receipt, stale: false, error: null,
      progress: { checked: count, total: count, retryAt: null, refreshing: false } } };
}
async function cachedOfficeFixture(read = path => response(cachedOfficeDay(path)), preview) {
  const app = harness({ storedDataMode: null, metadata: { ...liveMetadata, panels: { ...liveMetadata.panels, officeDay: { available: true } } },
    fetchSource: path => path.includes('/views/office-day?') ? read(path) : preview ? preview(path) : response(numberedSourcePage(path)) });
  const timers = new Map(); let sequence = 0;
  app.context.setTimeout = (fn, delay) => { const id = ++sequence; timers.set(id, { fn, delay }); return id; };
  app.context.clearTimeout = id => timers.delete(id);
  app.element('officeDayOverview').classList.add('is-active'); app.element('apiFeedControl').dataset.enabled = 'true';
  installDashboard(app); await app.signIn(); await tick(); await tick(); await tick();
  return { ...app, timers };
}
test('server office-day view displays all 642 rows and charts from one protected cache read, independently of preview paging', async () => {
  const app = await cachedOfficeFixture(path => response(cachedOfficeDay(path, 642)));
  assert.equal(app.calls.filter(c => c.path.includes('/views/office-day?')).length, 1);
  assert.equal(app.calls.filter(c => c.path.includes('/views/visits?')).length, 1, 'no browser source continuation');
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /642 \/ 642.*0 unavailable/);
  assert.match(nodeText(app.element('dashboardEvidenceChart')), /Scheduled start 642 \/ 642/);
  assert.match(nodeText(app.element('dashboardCoverage')), /642 \/ 642/);
  assert.match(nodeText(app.element('dashboardTimeline')), /900642/);
  const totals = nodeText(app.element('dashboardOverviewMetrics'));
  await app.click('dashboardVisitNext'); await tick(); await tick();
  assert.equal(nodeText(app.element('dashboardOverviewMetrics')), totals);
  assert.equal(app.calls.filter(c => c.path.includes('/views/office-day?')).length, 1);
});
test('server collection is queued truthfully and is readable during the preview quota delay', async () => {
  let queued = true;
  const app = await cachedOfficeFixture(path => {
    const p = cachedOfficeDay(path, queued ? 0 : 23);
    if (queued) { p.state = 'partial'; p.fetchedAt = null; p.discovery.selectedCount = null;
      Object.assign(p.officeDayCache, { known: false, done: false, complete: false, startedAt: null, latestSearchAt: null, completedAt: null });
      p.officeDayCache.progress.total = null; }
    return response(p);
  }, () => ({ ...response({ ok: false, retryAfterSeconds: 60 }), ok: false, status: 429 }));
  assert.match(app.element('dashboardOverviewStatus').textContent, /collection queued/);
  assert.doesNotMatch(nodeText(app.element('dashboardOverviewMetrics')), /0 \/ 0/);
  assert.equal(app.element('dashboardOverviewRefresh').disabled, false);
  queued = false; await app.click('dashboardOverviewRefresh'); await tick(); await tick();
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /23 \/ 23/);
  assert.equal(app.calls.filter(c => c.path.includes('/views/visits?')).length, 1);
});
test('completed server result stays whole during background refresh and is labelled cached on delay', async () => {
  let fail = false;
  const app = await cachedOfficeFixture(path => {
    if (fail) return { ...response({ ok: false }), ok: false, status: 503 };
    const p = cachedOfficeDay(path); p.officeDayCache.stale = true;
    p.officeDayCache.error = 'hha_source_temporarily_unavailable';
    p.officeDayCache.progress = { checked: 10, total: 23, retryAt: '2026-10-10T08:01:00Z', refreshing: true }; return response(p);
  });
  assert.match(app.element('dashboardOverviewStatus').textContent, /Cached result.*Next refresh: 10 of 23/);
  assert.match(app.element('dashboardOverviewStatus').textContent, /HHA source temporarily unavailable.*Next background attempt after/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /23 \/ 23/);
  fail = true; await app.click('dashboardOverviewRefresh'); await tick();
  assert.match(app.element('dashboardOverviewStatus').textContent, /update unavailable.*cached/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /23 \/ 23/);
});
test('office-day cache discloses a first-read delay before any clock totals exist', async () => {
  const retryAt = '2026-10-10T08:01:00Z';
  const app = await cachedOfficeFixture(path => {
    const p = cachedOfficeDay(path, 0);
    p.state = 'partial';
    p.fetchedAt = null;
    p.discovery.selectedCount = null;
    Object.assign(p.officeDayCache, { known: false, done: false, complete: false, stale: true,
      startedAt: null, latestSearchAt: null, completedAt: null, updatedAt: null, error: 'vendor_backoff_active',
      progress: { checked: 0, total: null, retryAt, refreshing: false } });
    return response(p);
  });
  assert.match(app.element('dashboardOverviewStatus').textContent, /Vendor retry delay recorded/);
  assert.match(app.element('dashboardOverviewStatus').textContent, /Next background attempt after 2026-10-10T08:01:00Z/);
  assert.doesNotMatch(nodeText(app.element('dashboardOverviewMetrics')), /0 \/ 0|queued/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /not known/);
  assert.equal(app.calls.filter(c => c.path.includes('/views/visits?')).length, 1);
});
test('late cached day cannot repaint a changed date, Demo, hidden view or signed-out session', async () => {
  for (const action of ['date', 'demo', 'signout', 'hidden', 'leave']) {
    const late = deferred(); let held = true;
    const app = await cachedOfficeFixture(path => held ? late.promise : response(cachedOfficeDay(path)));
    const path = app.calls.find(c => c.path.includes('/views/office-day?')).path;
    if (action === 'date') { app.element('dashboardVisitDate').value = '2026-10-11'; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(); }
    if (action === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (action === 'signout') await app.auth.signOut();
    if (action === 'hidden') { app.document.visibilityState = 'hidden'; app.dispatch('visibilitychange'); }
    if (action === 'leave') { app.element('officeDayOverview').classList.remove('is-active'); app.document.dispatchEvent(new DetailEvent('primetime-view-changed', { detail: { view: 'visits' } })); }
    held = false; late.resolve(response(cachedOfficeDay(path, 642))); await tick(); await tick();
    assert.doesNotMatch(app.element('dashboardOverviewCompleteness').textContent, /642 \/ 642/, action);
  }
});
test('a corrupt or access-revoked cache clears prior office evidence', async () => {
  for (const code of ['duplicate', 'scope', 'receipt', 'approval']) {
    let corrupt = false;
    const app = await cachedOfficeFixture(path => {
      const p = cachedOfficeDay(path);
      if (corrupt) {
        if (code === 'approval') return { ...response({ ok: false }), ok: false, status: 423 };
        if (code === 'duplicate') p.items[1].id = p.items[0].id;
        if (code === 'scope') p.scope.officeId = '999';
        if (code === 'receipt') p.items[0].detailFetchedAt = null;
      }
      return response(p);
    });
    assert.match(app.element('dashboardOverviewCompleteness').textContent, /23 \/ 23/);
    corrupt = true; await app.click('dashboardOverviewRefresh'); await tick(); await tick();
    assert.doesNotMatch(nodeText(app.element('dashboardTimeline')), /900023/);
    assert.equal(app.element('dashboardOverviewCompleteness').textContent, '');
  }
});
test('Overview automatic checks use only the office-day cache and disclose full-day batch coverage', async () => {
  let reads = 0;
  const app = await cachedOfficeFixture(path => { reads++; return response(cachedOfficeDay(path, reads === 1 ? 23 : 24)); },
    path => path.includes('/views/feed?') ? assert.fail('Overview must not depend on the first-page feed') : response(numberedSourcePage(path)));
  assert.match(app.element('apiFeedStatus').textContent, /all returned visits.*quota-limited batches/);
  const timer = [...app.timers].find(([, t]) => t.delay === 60000);
  assert.ok(timer); assert.equal(app.timers.size, 1, 'one non-overlapping minute check');
  app.timers.delete(timer[0]); timer[1].fn(); await tick(); await tick(); await tick();
  assert.equal(reads, 2);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /24 \/ 24/);
  assert.equal(app.calls.filter(c => c.path.includes('/views/visits?')).length, 1);
  assert.match(app.element('apiFeedStatus').textContent, /all returned visits/);
  await app.click('apiFeedToggle');
  assert.equal(app.timers.size, 0);
  await app.click('apiFeedToggle'); await tick(); await tick();
  assert.equal(reads, 3); assert.equal(app.timers.size, 1);
});
async function officeDayFixture(read = path => response(numberedSourcePage(path))) {
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: read });
  app.element('officeDayOverview').classList.add('is-active');
  installDashboard(app); await app.signIn(); await tick(); await tick(); await tick();
  return app;
}
test('active Overview reads all office-day batches while Visit Preview stays paged', async () => {
  const app = await officeDayFixture();
  assert.equal(app.calls.filter(c => c.path.includes('/views/visits?')).length, 3);
  assert.match(app.element('dashboardOverviewStatus').textContent, /read complete/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /3 \/ 3.*0 unavailable/);
  for (const id of ['900001', '900002', '900003']) assert.match(nodeText(app.element('dashboardTimeline')), new RegExp(id));
  assert.match(nodeText(app.element('dashboardCoverage')), /3 \/ 3/);
  assert.match(nodeText(app.element('dashboardEvidenceChart')), /Scheduled start 3 \/ 3/);
  assert.match(nodeText(app.element('dashboardVisitRows')), /900001/);
  assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /900002|900003/);
  const totals = nodeText(app.element('dashboardOverviewMetrics'));
  await app.click('dashboardVisitNext'); await tick(); await tick();
  assert.equal(nodeText(app.element('dashboardOverviewMetrics')), totals);
  assert.match(nodeText(app.element('dashboardVisitRows')), /900002/);
});
test('date change fences a pending office-day batch and clears prior totals immediately', async () => {
  const late = deferred(); let hold = true;
  const app = await officeDayFixture(path => new URL(path, 'https://fixture.test').searchParams.has('cursor') && hold ? late.promise : response(numberedSourcePage(path)));
  const oldDate = app.element('dashboardVisitDate').value;
  app.element('dashboardOverviewDate').value = '2026-10-24';
  hold = false;
  for (const fn of app.element('dashboardOverviewDate').handlers.get('change')) fn(new Event('change'));
  assert.doesNotMatch(nodeText(app.element('dashboardOverviewMetrics')), /checked; failed reads/);
  await tick(); await tick(); await tick();
  const latest = app.element('dashboardOverviewMetadata').textContent;
  late.resolve(response(numberedSourcePage('/primetime/api/views/visits?date=' + oldDate + '&cursor=page-two')));
  await tick(); await tick();
  assert.equal(app.element('dashboardOverviewMetadata').textContent, latest);
  assert.match(latest, /2026-10-24/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /3 \/ 3/);
});
test('same-scope refresh retains the last complete day with an explicit refresh label until new collection finishes', async () => {
  const pending = deferred(); let hold = false;
  const app = await officeDayFixture(path => hold && new URL(path, 'https://fixture.test').searchParams.has('cursor') ? pending.promise : response(numberedSourcePage(path)));
  const totals = nodeText(app.element('dashboardOverviewMetrics')), receipt = app.element('dashboardOverviewMetadata').textContent;
  hold = true;
  app.document.dispatchEvent(new DetailEvent('primetime-view-changed', { detail: { view: 'overview' } }));
  await tick(); await tick();
  assert.equal(nodeText(app.element('dashboardOverviewMetrics')), totals);
  assert.equal(app.element('dashboardOverviewMetadata').textContent, receipt);
  assert.match(app.element('dashboardOverviewStatus').textContent, /Refreshing office day.*last completed read/);
  for (const id of ['900001', '900002', '900003']) assert.match(nodeText(app.element('dashboardTimeline')), new RegExp(id));
  hold = false;
  pending.resolve(response(numberedSourcePage('/primetime/api/views/visits?date=' + app.element('dashboardVisitDate').value + '&cursor=page-two')));
  await tick(); await tick(); await tick();
  assert.match(app.element('dashboardOverviewStatus').textContent, /read complete/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /3 \/ 3/);
});
test('Demo, sign-out and clear cannot be repainted by a late office-day detail batch', async () => {
  for (const action of ['demo', 'signout', 'clear']) {
    const late = deferred();
    const app = await officeDayFixture(path => new URL(path, 'https://fixture.test').searchParams.has('cursor') ? late.promise : response(numberedSourcePage(path)));
    const date = app.element('dashboardVisitDate').value;
    if (action === 'demo') await app.window.primetimeDataMode.setMode('demo');
    if (action === 'signout') app.dispatch('primetime-signed-out');
    if (action === 'clear') await app.click('dashboardOverviewClear');
    const before = nodeText(app.element('dashboardOverviewMetrics'));
    late.resolve(response(numberedSourcePage('/primetime/api/views/visits?date=' + date + '&cursor=page-two')));
    await tick(); await tick();
    assert.equal(nodeText(app.element('dashboardOverviewMetrics')), before, action);
    assert.doesNotMatch(nodeText(app.element('dashboardTimeline')), /900002/, action);
  }
});
test('failed office-day continuation cannot leave complete totals or a success receipt', async () => {
  const app = await officeDayFixture(path => new URL(path, 'https://fixture.test').searchParams.has('cursor') ? { ...response({ ok: false }), ok: false, status: 409 } : response(numberedSourcePage(path)));
  assert.match(app.element('dashboardOverviewStatus').textContent, /could not finish/);
  assert.equal(app.element('dashboardOverviewMetadata').textContent, '');
  assert.match(nodeText(app.element('dashboardOverviewMetrics')), /incomplete/);
  assert.equal(app.element('dashboardOverviewRefresh').disabled, false);
});
test('office-day HTTP quota waits for the specified delay and resumes the same continuation', async () => {
  let limited = true; const timers = new Map(), cursors = [];
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => {
    if (!path.includes('/views/visits?')) return response({ ok: true });
    const cursor = new URL(path, 'https://fixture.test').searchParams.get('cursor'); cursors.push(cursor);
    if (cursor && limited) { limited = false; return { ...response({ ok: false, retryAfterSeconds: 7 }), ok: false, status: 429 }; }
    return response(numberedSourcePage(path));
  } });
  app.context.setTimeout = (fn, delay) => { const id = timers.size + 1; timers.set(id, { fn, delay }); return id; };
  app.context.clearTimeout = id => timers.delete(id);
  app.element('officeDayOverview').classList.add('is-active');
  installDashboard(app); await app.signIn(); await tick(); await tick();
  assert.match(app.element('dashboardOverviewStatus').textContent, /waiting 7s/);
  assert.equal(app.element('dashboardOverviewRefresh').disabled, true);
  const timer = [...timers.values()].find(v => v.delay === 7000); assert.ok(timer); timer.fn();
  await tick(); await tick(); await tick();
  assert.deepEqual(cursors, [null, 'page-two', 'page-two', 'page-three']);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /3 \/ 3/);
  assert.match(app.element('dashboardOverviewStatus').textContent, /read complete/);
});

for (const status of [429, 503]) for (const retained of [false, true]) {
  test(`office-day ${status} quota labels ${retained ? 'retained complete' : 'first partial'} charts without changing evidence`, async () => {
    const timers = new Map(), quota = deferred(); let limit = !retained;
    const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => {
      if (!path.includes('/views/visits?')) return response({ ok: true });
      if (limit && new URL(path, 'https://fixture.test').searchParams.has('cursor')) return quota.promise;
      return response(numberedSourcePage(path));
    } });
    app.context.setTimeout = (fn, delay) => { const id = timers.size + 1; timers.set(id, { fn, delay }); return id; };
    app.context.clearTimeout = id => timers.delete(id);
    app.element('officeDayOverview').classList.add('is-active');
    installDashboard(app); await app.signIn(); await tick(); await tick(); await tick();
    if (retained) {
      assert.match(app.element('dashboardOverviewStatus').textContent, /read complete/);
      limit = true;
      app.document.dispatchEvent(new DetailEvent('primetime-view-changed', { detail: { view: 'overview' } }));
      await tick(); await tick();
    }
    const ids = ['dashboardOverviewMetrics','dashboardTimeline','dashboardEvidenceChart','dashboardCoverage','dashboardOverviewMetadata','dashboardOverviewCompleteness'];
    const evidence = () => ids.map(id => nodeText(app.element(id)));
    const before = evidence();
    quota.resolve({ ...response({ ok: false, retryAfterSeconds: 7 }), ok: false, status });
    await tick(); await tick();
    const label = app.element('dashboardOverviewStatus').textContent;
    assert.match(label, /waiting 7s/);
    assert.match(label, retained ? /Charts retain the last completed read and its fetch range/ : /Collected charts remain partial/);
    if (retained) assert.doesNotMatch(label, /remain partial/);
    assert.deepEqual(evidence(), before);
    assert.equal(app.element('dashboardOverviewRefresh').disabled, true);
    const timer = [...timers.values()].find(v => v.delay === 7000); assert.ok(timer);
    limit = false; timer.fn(); await tick(); await tick(); await tick();
    assert.match(app.element('dashboardOverviewStatus').textContent, /read complete/);
    assert.match(app.element('dashboardOverviewCompleteness').textContent, /3 \/ 3/);
  });
}
for (const status of [429, 503]) test(`stale office-day ${status} quota response cannot repaint after sign-out`, async () => {
  const quota = deferred();
  const app = await officeDayFixture(path => new URL(path, 'https://fixture.test').searchParams.has('cursor') ? quota.promise : response(numberedSourcePage(path)));
  app.dispatch('primetime-signed-out');
  const before = nodeText(app.element('dashboardOverviewStatus')), calls = app.calls.length;
  quota.resolve({ ...response({ ok: false, retryAfterSeconds: 7 }), ok: false, status });
  await tick(); await tick();
  assert.equal(nodeText(app.element('dashboardOverviewStatus')), before);
  assert.equal(app.calls.length, calls);
});

test('Live previous-page navigation reuses scoped source cursors across both dashboard views', async () => {
  const seen = [];
  const app = harness({ metadata: liveMetadata, fetchSource: path => { seen.push(new URL(path, 'https://fixture.test').searchParams.get('cursor')); return response(numberedSourcePage(path)); } });
  installDashboard(app); await app.signIn(); await app.live(); await tick();
  assert.equal(app.element('dashboardOverviewPrevious').hidden, true);
  for (const control of ['dashboardOverviewNext', 'dashboardVisitNext']) { await app.click(control); await tick(); await tick(); }
  assert.match(nodeText(app.element('dashboardTimeline')), /900003/);
  assert.equal(app.element('dashboardOverviewNext').hidden, true);
  assert.equal(app.element('dashboardOverviewPrevious').hidden, false);
  await app.click('dashboardOverviewPrevious'); await tick(); await tick();
  assert.match(nodeText(app.element('dashboardVisitRows')), /900002/);
  assert.match(app.element('dashboardVisitCompleteness').textContent, /2–2 of 3/);
  await app.click('dashboardVisitPrevious'); await tick(); await tick();
  assert.match(nodeText(app.element('dashboardTimeline')), /900001/);
  assert.equal(app.element('dashboardVisitPrevious').hidden, true);
  assert.equal(app.element('dashboardOverviewPrevious').hidden, true);
  assert.deepEqual(seen, [null, 'page-two', 'page-three', 'page-two', null]);
  assert.ok(app.calls.every(call => !call.options.method || call.options.method === 'GET'));
});

test('source navigation history clears on date and mode changes and cannot be restored by a late response', async () => {
  const pending = deferred(); let hold = false;
  const app = harness({ metadata: liveMetadata, fetchSource: path => hold ? pending.promise : response(numberedSourcePage(path)) });
  installDashboard(app); await app.signIn(); await app.live(); await tick();
  await app.click('dashboardVisitNext'); await tick(); await tick();
  assert.equal(app.element('dashboardVisitPrevious').hidden, false);
  app.element('dashboardOverviewDate').value = '2026-10-09';
  for (const fn of app.element('dashboardOverviewDate').handlers.get('change')) fn(new Event('change'));
  assert.equal(app.element('dashboardVisitPrevious').hidden, true);
  await tick(); await tick();
  const latest = app.calls.filter(call => call.path.includes('/views/visits?')).at(-1);
  assert.equal(new URL(latest.path, 'https://fixture.test').searchParams.has('cursor'), false);
  await app.click('dashboardVisitNext'); await tick(); await tick();
  hold = true; await app.click('dashboardOverviewNext');
  assert.equal(app.element('dashboardOverviewPrevious').hidden, true, 'pending pages cannot navigate with the old trail');
  app.window.primetimeDataMode.setMode('demo');
  pending.resolve(response(numberedSourcePage('/primetime/api/views/visits?date=2026-10-09&cursor=page-three')));
  await tick(); await tick();
  assert.equal(app.element('dashboardVisitPrevious').hidden, true);
  assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-1048/);
  assert.equal(nodeText(app.element('dashboardTimeline')).includes('900003'), false);
});

test('failed paging discards cursor history and refresh starts from the first source page', async () => {
  let fail = false;
  const app = harness({ metadata: liveMetadata, fetchSource: path => {
    if (!fail) return response(numberedSourcePage(path));
    const result = response({ ok: false, error: 'unavailable' }); result.ok = false; result.status = 503; return result;
  } });
  installDashboard(app); await app.signIn(); await app.live(); await tick();
  await app.click('dashboardVisitNext'); await tick(); await tick();
  fail = true; await app.click('dashboardVisitNext'); await tick(); await tick();
  assert.equal(app.element('dashboardVisitPrevious').hidden, true);
  assert.equal(app.element('dashboardVisitNext').hidden, true);
  const calls = app.calls.length; await app.click('dashboardVisitPrevious');
  assert.equal(app.calls.length, calls);
  fail = false; await app.click('dashboardOverviewRefresh'); await tick(); await tick();
  const latest = app.calls.filter(call => call.path.includes('/views/visits?')).at(-1);
  assert.equal(new URL(latest.path, 'https://fixture.test').searchParams.has('cursor'), false);
  assert.equal(app.element('dashboardOverviewPrevious').hidden, true);
  assert.match(nodeText(app.element('dashboardTimeline')), /900001/);
});

function descendants(node) { return [node, ...node.children.flatMap(child => child.children ? descendants(child) : [])]; }
function recordButtons(app, host = 'dashboardTimeline') { return descendants(app.element(host)).filter(node => /^Open (patient|caregiver|visit) read$/.test(node.textContent)); }
async function clickNode(node) { for (const callback of node.handlers.get('click') || []) await callback(new Event('click')); }
const currentProfilePayload = (scope, fields = {}) => ({ ok: true, operation: 'GetPatientDemographics', source: 'hhaexchange', validation: 'source_unvalidated', interpretation: 'patient_source_unvalidated', timezone: 'source_values_unconverted', truncated: false,
  fetchedAt: '2026-10-24T16:00:00Z', membershipCheckedAt: '2026-10-24T16:00:00Z', scope, records: [{ PatientID: scope.patientId, OfficeID: scope.officeId, FirstName: 'Synthetic profile', LastName: null, ...fields }] });
const currentProfileButtons = app => descendants(app.element('dashboardPatients')).filter(item => item.textContent === 'View current profile');
async function currentProfileFixture(read, preview = livePreview) {
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: (path, options) => {
    if (path.includes('/views/visits?')) return response(preview(new URL(path, 'https://fixture.test').searchParams.get('date')));
    if (path.endsWith('/workspace/visit-patient')) return read(JSON.parse(options.body), options);
    return response({ ok: true });
  } });
  installDashboard(app); await app.signIn(); await tick(); await tick(); return app;
}

test('current patient workbench groups readable source patients and fetches exact office-checked profiles on demand', async () => {
  const app = await currentProfileFixture(scope => response(currentProfilePayload(scope, { PayerName: '<script>source text only</script>' })), date => {
    const page = livePreview(date); page.state = 'partial'; page.items.push({ ...page.items[0], id: '900002' }, { id: '900003', patientId: '7', state: 'unavailable' }); return page;
  });
  assert.equal(currentProfileButtons(app).length, 1); assert.match(nodeText(app.element('dashboardPatients')), /not the full office/);
  assert.equal(app.calls.filter(c => c.path.endsWith('/workspace/visit-patient')).length, 0);
  await clickNode(currentProfileButtons(app)[0]); await tick(); await tick();
  assert.deepEqual(JSON.parse(app.calls.find(c => c.path.endsWith('/workspace/visit-patient')).options.body), { visitId: '900001', patientId: '5', officeId: '123' });
  const text = nodeText(app.element('dashboardPatientProfile'));
  assert.match(text, /Synthetic profile/); assert.match(text, /Not supplied by HHA/); assert.match(text, /current visit \/ patient \/ office checked/);
  assert.match(text, /<script>source text only<\/script>/); assert.equal(descendants(app.element('dashboardPatientProfile')).some(n => n.tagName === 'SCRIPT'), false);
  assert.match(text, /Open records/); assert.match(text, /2026-10-24T16:00:00Z/);
});

test('patient profile projection rejects wrong operation, identity, source, membership receipt and malformed fields', () => {
  const normalize = dashboardModel().primetimeDashboardModel.normalizePatientProfile, scope = { visitId: '900001', patientId: '5', officeId: '123' };
  assert.equal(normalize(currentProfilePayload(scope), scope).fields.LastName, null);
  for (const changes of [{ operation: 'GetVisitInfoV3' }, { source: 'synthetic' }, { truncated: true }, { membershipCheckedAt: '2026-10-23T00:00:00Z' },
    { fetchedAt: 'bad', membershipCheckedAt: 'bad' }, { scope: { ...scope, visitId: '900002' } }, { records: [] },
    { records: [{ PatientID: '5', OfficeID: '999' }] }, { records: [{ PatientID: '5', OfficeID: '123', FirstName: {} }] }]) {
    assert.throws(() => normalize({ ...currentProfilePayload(scope), ...changes }, scope), /invalid_patient_profile/);
  }
});

test('patient source requests and detached controls cannot outlive Clear, mode, date or session changes', async () => {
  for (const change of ['clear', 'demo', 'date', 'session']) {
    const late = deferred(); const app = await currentProfileFixture(() => late.promise), old = currentProfileButtons(app)[0];
    await clickNode(old); await tick();
    if (change === 'clear') await app.click('dashboardVisitClear');
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'date') { app.element('dashboardVisitDate').value = '2026-10-23'; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'session') app.dispatch('primetime-signed-out');
    late.resolve(response(currentProfilePayload({ visitId: '900001', patientId: '5', officeId: '123' }, { FirstName: 'Must not return after context change' })));
    await tick(); await tick(); assert.doesNotMatch(nodeText(app.element('dashboardPatientProfile')), /Must not return after context change/, change);
    const calls = app.calls.length; await clickNode(old); await tick(); assert.equal(app.calls.length, calls, change);
  }
});

test('patient profile record actions belong only to the latest profile request', async () => {
  for (const selection of ['same', 'different']) for (const outcome of ['success', 'failure']) {
    let pending = false, requestedScope;
    const late = deferred();
    const app = await currentProfileFixture(scope => {
      requestedScope = scope;
      return pending ? late.promise : response(currentProfilePayload(scope));
    }, date => {
      const page = livePreview(date);
      page.items.push({ ...page.items[0], id: '900002', patientId: '7', caregiverId: '8' });
      return page;
    });
    const selectors = currentProfileButtons(app);
    await clickNode(selectors[0]); await tick(); await tick();
    const old = descendants(app.element('dashboardPatientProfile')).filter(node => (node.handlers.get('click') || []).length);
    assert.equal(old.length, 7);
    await clickNode(old.find(node => node.textContent === 'Open patient read'));
    assert.equal(app.events.filter(event => event.type === 'primetime-source-record-selected').at(-1).detail.id, '5');
    pending = true;
    await clickNode(selectors[selection === 'same' ? 0 : 1]); await tick();
    const assertOldActionsHeld = async () => {
      const before = app.events.filter(event => event.type === 'primetime-source-record-selected').length, calls = app.calls.length;
      for (const control of old) await clickNode(control);
      assert.equal(app.events.filter(event => event.type === 'primetime-source-record-selected').length, before, `${selection}/${outcome}: superseded profile cannot select a record`);
      assert.equal(app.calls.length, calls, 'stale controls cannot dispatch a source request');
    };
    await assertOldActionsHeld();
    if (outcome === 'failure') late.reject(new Error('synthetic profile failure'));
    else late.resolve(response(currentProfilePayload(requestedScope)));
    await tick(); await tick(); await assertOldActionsHeld();
    if (outcome === 'success') {
      const current = descendants(app.element('dashboardPatientProfile')).find(node => node.textContent === 'Open patient read');
      await clickNode(current);
      assert.equal(app.events.filter(event => event.type === 'primetime-source-record-selected').at(-1).detail.id, selection === 'same' ? '5' : '7');
    } else assert.equal(recordButtons(app, 'dashboardPatientProfile').length, 0);
    assert.equal(app.calls.filter(call => call.path.endsWith('/workspace/visit-patient')).length, 2);
  }
});

test('patient source errors remove old fields and a quota cooldown blocks repeated dispatch', async () => {
  let limited = false;
  const app = await currentProfileFixture(scope => limited ? { ...response({ ok: false, error: 'read_budget_exhausted', retryAfterSeconds: 60 }), ok: false, status: 429 } : response(currentProfilePayload(scope)));
  await clickNode(currentProfileButtons(app)[0]); await tick(); await tick(); assert.match(nodeText(app.element('dashboardPatientProfile')), /Synthetic profile/);
  limited = true; await clickNode(currentProfileButtons(app)[0]); await tick(); await tick();
  assert.doesNotMatch(nodeText(app.element('dashboardPatientProfile')), /Synthetic profile/); assert.match(nodeText(app.element('dashboardPatientProfile')), /Retry in 60 seconds/);
  const calls = app.calls.length; await clickNode(currentProfileButtons(app)[0]); await tick(); assert.equal(app.calls.length, calls);
});

test('live EVV search filters the connected table on input without making another source read', async () => {
  const app = await currentProfileFixture(scope => response(currentProfilePayload(scope))), rows = [{ textContent: 'visit-alpha caregiver-one', hidden: false }, { textContent: 'visit-beta caregiver-two', hidden: false }];
  app.element('dashboardExceptions').querySelectorAll = () => rows;
  const calls = app.calls.length; app.element('exceptionSearch').value = 'caregiver-two';
  for (const fn of app.element('exceptionSearch').handlers.get('input')) fn(new Event('input'));
  assert.equal(rows[0].hidden, true); assert.equal(rows[1].hidden, false); assert.equal(app.calls.length, calls);
  app.element('exceptionSearch').value = ''; for (const fn of app.element('exceptionSearch').handlers.get('input')) fn(new Event('input'));
  assert.equal(rows.every(row => !row.hidden), true);
});

const callEventsPayload = (scope, records) => ({ ok: true, operation: 'GetCallDashBoardData', source: 'hhaexchange', validation: 'source_unvalidated', timezone: 'source_values_unconverted',
  interpretation: 'call_events_unvalidated', relationship: 'same_patient_caregiver_day_only', visitLink: 'not_supplied_by_source', completeness: 'bounded_response_not_complete_history', truncated: false,
  fetchedAt: '2026-10-31T16:00:00Z', membershipCheckedAt: '2026-10-31T15:59:59Z', scope, state: records?.length === 0 ? 'empty' : 'ready',
  records: records || [{ CallDashboardID: '91', 'Patient/ID': scope.patientId, 'Caregiver/ID': scope.caregiverId, CallTime: scope.date + ' 09:00', CallType: 'TYPE_FROM_SOURCE', CallStatus: 'STATUS_FROM_SOURCE', privateExtra: 'MUST_NOT_RENDER' }] });
async function callEventsFixture(read, available = true, preview = livePreview) {
  const metadata = { ...liveMetadata, panels: { ...liveMetadata.panels, callEvents: { available } } };
  const app = harness({ storedDataMode: null, metadata, fetchSource: (path, options) => path.includes('/views/visits?') ? response(preview(new URL(path, 'https://fixture.test').searchParams.get('date')))
    : path.endsWith('/workspace/visit-calls') ? read(JSON.parse(options.body), options) : response({ ok: true }) });
  installDashboard(app); await app.signIn(); await tick(); await tick(); return app;
}
const callEventButtons = app => descendants(app.element('dashboardExceptions')).filter(n => n.textContent === 'Read call events');
test('call evidence retains distinct office/read receipts and rejects ambiguous calendar timestamps', () => {
  const scope = { visitId: '900001', patientId: '5', caregiverId: '6', officeId: '123', date: '2026-10-24' };
  const model = dashboardModel().primetimeDashboardModel, payload = callEventsPayload(scope, []);
  const checked = model.normalizeCallEvents(payload, scope);
  assert.equal(checked.membershipCheckedAt, payload.membershipCheckedAt);
  assert.notEqual(checked.membershipCheckedAt, checked.fetchedAt);
  for (const field of ['membershipCheckedAt', 'fetchedAt']) for (const value of ['2026-10-31', '2026-10-31T15:59:59', '2026-02-31T15:59:59Z', 'October 31, 2026', '', null]) {
    assert.throws(() => model.normalizeCallEvents({ ...payload, [field]: value }, scope), /invalid_call_events/);
  }
});
test('empty call queries show selection context, filters and independent receipts without implying a visit link', async () => {
  const app = await callEventsFixture(input => response(callEventsPayload(input, [])));
  await clickNode(callEventButtons(app)[0]); await tick(); await tick();
  const text = nodeText(app.element('dashboardCallEvents'));
  assert.match(text, /Selected visit context: 900001/);
  assert.match(text, /Query filters: patient 5 · caregiver 6 · office 123/);
  assert.match(text, /Call read: 2026-10-31T16:00:00Z · Office check: 2026-10-31T15:59:59Z/);
  assert.match(text, /Separate read receipts/); assert.match(text, /No visit ID is supplied/);
  assert.match(text, /No source call events returned/);
  assert.equal(app.calls.filter(c => c.path.endsWith('/workspace/visit-calls')).length, 1);
  await app.click('dashboardVisitClear');
  assert.doesNotMatch(nodeText(app.element('dashboardCallEvents')), /Selected visit context:|Query filters:|Office check:/);
});
test('same-day call query selection stays distinct from equal event IDs and stale query responses', async () => {
  const pending = [], originalPage = date => {
    const p = livePreview(date); p.items.push({ ...p.items[0], id: '900002' }); return p;
  };
  const app = await callEventsFixture(input => { const task = deferred(); pending.push({ input, task }); return task.promise; }, true, originalPage);
  const before = nodeText(app.element('dashboardExceptions')), chart = nodeText(app.element('dashboardEvidenceChart'));
  const buttons = callEventButtons(app); assert.equal(buttons.length, 2);
  await clickNode(buttons[0]); await tick(); await clickNode(buttons[1]); await tick();
  const payload = callEventsPayload(pending[1].input); payload.records[0].CallDashboardID = '900002';
  pending[1].task.resolve(response(payload)); await tick(); await tick();
  pending[0].task.resolve(response(callEventsPayload(pending[0].input))); await tick(); await tick();
  const text = nodeText(app.element('dashboardCallEvents'));
  assert.match(text, /Selected visit context: 900002/); assert.doesNotMatch(text, /Selected visit context: 900001/);
  assert.match(text, /No visit ID is supplied/); assert.match(text, /complete history is not established/);
  assert.equal(nodeText(app.element('dashboardExceptions')), before); assert.equal(nodeText(app.element('dashboardEvidenceChart')), chart);
});
test('raw-call source is gated before dispatch and never grants its own read control', async () => {
  const app = await callEventsFixture(() => { throw new Error('gated source dispatched'); }, false), before = app.calls.length;
  assert.equal(callEventButtons(app).length, 1); assert.equal(callEventButtons(app)[0].disabled, true); await clickNode(callEventButtons(app)[0]);
  assert.equal(app.calls.length, before); assert.match(nodeText(app.element('dashboardCallEvents')), /GetCallDashBoardData is not enabled/);
});
test('raw-call panel uses exact scope and keeps raw event fields separate from visit clocks and counts', async () => {
  const app = await callEventsFixture(input => response(callEventsPayload(input))), original = nodeText(app.element('dashboardExceptions')), chart = nodeText(app.element('dashboardEvidenceChart'));
  await clickNode(callEventButtons(app)[0]); await tick(); await tick();
  const call = app.calls.find(c => c.path.endsWith('/workspace/visit-calls')), input = JSON.parse(call.options.body);
  assert.deepEqual(input, { visitId: '900001', patientId: '5', caregiverId: '6', officeId: '123', date: app.element('dashboardVisitDate').value });
  const text = nodeText(app.element('dashboardCallEvents')); assert.match(text, /TYPE_FROM_SOURCE/); assert.match(text, /STATUS_FROM_SOURCE/); assert.match(text, /No visit ID is supplied/);
  assert.match(text, /complete history is not established/); assert.doesNotMatch(text, /MUST_NOT_RENDER/); assert.equal(nodeText(app.element('dashboardExceptions')), original); assert.equal(nodeText(app.element('dashboardEvidenceChart')), chart);
});
test('call model rejects guessed visit linkage, foreign scope/subjects and duplicate event IDs', () => {
  const scope = { visitId: '900001', patientId: '5', caregiverId: '6', officeId: '123', date: '2026-10-24' }, model = dashboardModel().primetimeDashboardModel;
  const valid = callEventsPayload(scope); assert.equal(model.normalizeCallEvents(valid, scope).records[0].privateExtra, undefined);
  for (const changes of [{ visitLink: 'matched' }, { scope: { ...scope, date: '2026-10-23' } }, { source: 'synthetic' }, { state: 'empty' }, { records: [valid.records[0], valid.records[0]] },
    { records: [{ ...valid.records[0], 'Patient/ID': '99' }] }, { records: [{ ...valid.records[0], CallDashboardID: '0' }] }]) assert.throws(() => model.normalizeCallEvents({ ...valid, ...changes }, scope), /invalid_call_events/);
  assert.equal(model.normalizeCallEvents(callEventsPayload(scope, []), scope).state, 'empty');
});
test('empty raw-call responses stay distinct from failed reads and never become zero visit hours', async () => {
  const app = await callEventsFixture(input => response(callEventsPayload(input, []))); await clickNode(callEventButtons(app)[0]); await tick(); await tick();
  const text = nodeText(app.element('dashboardCallEvents')); assert.match(text, /No source call events returned/); assert.match(text, /does not prove/);
  const sourceFacts = descendants(app.element('dashboardCallEvents')).filter(n => !n.textContent?.startsWith('Approximate fetch age:')).map(n => n.textContent || '').join(' ');
  assert.doesNotMatch(sourceFacts, /zero hours|0 h|verified visit/i);
});
test('call reads and detached buttons cannot outlive date/Clear/Demo/session context; quotas prevent repeat dispatch', async () => {
  for (const change of ['date', 'clear', 'demo', 'session']) {
    const late = deferred(); let input; const app = await callEventsFixture(value => { input = value; return late.promise; }), old = callEventButtons(app)[0];
    await clickNode(old); await tick();
    if (change === 'date') { app.element('dashboardVisitDate').value = '2026-10-23'; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'clear') await app.click('dashboardVisitClear');
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'session') app.dispatch('primetime-signed-out');
    late.resolve(response(callEventsPayload(input))); await tick(); await tick(); assert.doesNotMatch(nodeText(app.element('dashboardCallEvents')), /TYPE_FROM_SOURCE/);
    const count = app.calls.length; await clickNode(old); await tick(); assert.equal(app.calls.length, count);
  }
  const limited = await callEventsFixture(() => ({ ...response({ ok: false, retryAfterSeconds: 60 }), ok: false, status: 429 }));
  await clickNode(callEventButtons(limited)[0]); await tick(); await tick(); const count = limited.calls.length;
  assert.match(nodeText(limited.element('dashboardCallEvents')), /Retry in 60 seconds/); await clickNode(callEventButtons(limited)[0]); await tick(); assert.equal(limited.calls.length, count);
});

const relatedPayload = ({ kind, ...scope }, fields = {}) => ({ ok: true, source: 'hhaexchange', validation: 'source_unvalidated', timezone: 'source_values_unconverted', truncated: false,
  operation: kind === 'caregiver' ? 'GetCaregiverDemographics' : 'GetVisitBillInfoV2', interpretation: kind === 'caregiver' ? 'caregiver_profile_unvalidated' : 'billing_source_unvalidated',
  fetchedAt: '2026-10-24T16:00:00Z', membershipCheckedAt: '2026-10-24T15:59:59Z', scope,
  records: [{ ID: kind === 'caregiver' ? scope.caregiverId : scope.visitId, ...(kind === 'caregiver' ? { FirstName: 'Synthetic caregiver', OfficeIDs: JSON.stringify([scope.officeId]) } : { 'Patient/ID': scope.patientId, 'PrimaryBillTo/BilledAmount': '0', 'SecondaryBillTo/BilledMinutes': null }), ...fields }] });
async function relatedFixture(read, available = true) {
  const metadata = { ...liveMetadata, panels: { ...liveMetadata.panels, caregiverProfile: { available }, billingFacts: { available } } };
  const app = harness({ storedDataMode: null, metadata, fetchSource: (path, options) => path.includes('/views/visits?') ? response(livePreview(new URL(path, 'https://fixture.test').searchParams.get('date')))
    : path.endsWith('/workspace/visit-context') ? read(JSON.parse(options.body), options) : response({ ok: true }) });
  installDashboard(app); await app.signIn(); await tick(); await tick(); return app;
}
const relatedButton = (app, kind) => descendants(app.element(kind === 'caregiver' ? 'dashboardStaffing' : 'dashboardBillingPipeline')).find(n => n.textContent === (kind === 'caregiver' ? 'View caregiver profile' : 'Read billing facts'));
test('legacy billing requires explicit fallback provenance and retains the exact source scope', () => {
  const normalize = dashboardModel().primetimeDashboardModel.normalizeVisitContext;
  const input = { kind: 'billing', visitId: '900001', patientId: '5', officeId: '123' };
  const payload = { ...relatedPayload(input, { 'PrimaryBillTo/BilledRate': '' }), operation: 'GetVisitBillInfo', billingFallbackFrom: 'GetVisitBillInfoV2' };
  assert.equal(normalize(payload, input).fields['PrimaryBillTo/BilledAmount'], '0');
  assert.equal(normalize(payload, input).fields['PrimaryBillTo/BilledRate'], '');
  for (const change of [{ billingFallbackFrom: undefined }, { billingFallbackFrom: 'GetVisitInfoV3' }, { operation: 'GetVisitBillInfoV2' },
    { scope: { ...payload.scope, patientId: '99' } }, { records: [{ ...payload.records[0], ID: '99' }] }]) {
    assert.throws(() => normalize({ ...payload, ...change }, input), /invalid_visit_context/);
  }
});
test('legacy billing labels its actual method and empty V2 provenance, and clears old results', async () => {
  for (const change of ['clear', 'date', 'demo', 'session']) {
    const app = await relatedFixture(input => response({ ...relatedPayload(input, { 'PrimaryBillTo/BilledRate': '' }), operation: 'GetVisitBillInfo', billingFallbackFrom: 'GetVisitBillInfoV2' }));
    await clickNode(relatedButton(app, 'billing')); await tick(); await tick();
    const host = app.element('dashboardBillingFacts');
    assert.match(nodeText(host), /HHA GetVisitBillInfo after empty GetVisitBillInfoV2/);
    assert.match(nodeText(host), /Billed amount \(source\) 0/);
    assert.match(nodeText(host), /Billed rate \(source\) Empty source value/);
    if (change === 'clear') await app.click('dashboardVisitClear');
    if (change === 'date') { app.element('dashboardVisitDate').value = '2026-10-23'; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'session') app.dispatch('primetime-signed-out');
    await tick(); await tick(); assert.doesNotMatch(nodeText(host), /HHA GetVisitBillInfo|Billed amount \(source\) 0/);
  }
});
test('caregiver employment disciplines retain a bounded string list independently of qualification', () => {
  const normalize = dashboardModel().primetimeDashboardModel.normalizeVisitContext;
  const input = { kind: 'caregiver', visitId: '900001', patientId: '5', officeId: '123', caregiverId: '6' };
  for (const values of [null, undefined, '[]', '["SOURCE_DISCIPLINE", ""]']) {
    const result = normalize(relatedPayload(input, { EmploymentDisciplines: values }), input);
    assert.deepEqual(Array.from(result.employmentDisciplines ?? []), values == null ? [] : JSON.parse(values));
    assert.equal(result.fields.EmploymentDisciplines, values ?? null);
  }
  for (const values of ['bad', '{}', '[null]', '[1]', '[{}]', JSON.stringify(Array(201).fill('A')), 'x'.repeat(1001)]) {
    assert.throws(() => normalize(relatedPayload(input, { EmploymentDisciplines: values }), input), /invalid_visit_context/);
  }
});

test('Staffing shows source employment disciplines without extra reads and clears them with the source context', async () => {
  for (const change of ['clear', 'date', 'demo', 'session']) {
    const app = await relatedFixture(input => response(relatedPayload(input, { EmploymentDisciplines: '["SOURCE_DISCIPLINE", ""]' })));
    await clickNode(relatedButton(app, 'caregiver')); await tick(); await tick();
    const text = nodeText(app.element('dashboardCaregiverProfile'));
    assert.match(text, /Employment disciplines \(source\).*SOURCE_DISCIPLINE.*Empty source value/);
    assert.match(text, /does not establish qualification, eligibility or availability/);
    assert.equal(app.calls.filter(c => c.path.endsWith('/workspace/visit-context')).length, 1);
    if (change === 'clear') await app.click('dashboardVisitClear');
    if (change === 'date') { app.element('dashboardVisitDate').value = '2026-10-23'; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'session') app.dispatch('primetime-signed-out');
    await tick(); await tick();
    assert.doesNotMatch(nodeText(app.element('dashboardCaregiverProfile')), /SOURCE_DISCIPLINE/);
  }
});
test('Staffing keeps an unproved discipline list separate from a genuinely empty list and empty item', async () => {
  for (const [value, label] of [[null, 'Source list unavailable'], ['[]', 'No values returned'], ['[""]', 'Empty source value']]) {
    const app = await relatedFixture(input => response(relatedPayload(input, { EmploymentDisciplines: value })));
    await clickNode(relatedButton(app, 'caregiver')); await tick(); await tick();
    const host = app.element('dashboardCaregiverProfile');
    const row = descendants(host).find(n => n.tagName === 'TR' && nodeText(n).includes('Employment disciplines (source)'));
    assert.ok(row); assert.match(nodeText(row), new RegExp(label));
    assert.match(nodeText(host), /Synthetic caregiver/);
    assert.equal(app.calls.filter(c => c.path.endsWith('/workspace/visit-context')).length, 1);
  }
});
test('visit billed amount preserves exact supplied strings and rejects malformed values without borrowing other fields', () => {
  const normalize = dashboardModel().primetimeDashboardModel.normalizeVisitPreview, date = '2026-10-10';
  for (const amount of ['0', '0.00', '17.30', '-2.50', '', null, undefined]) {
    const page = livePreview(date); page.items[0].billedAmount = amount;
    assert.equal(normalize(page, { mode: 'live', date, officeId: '123' }).items[0].billedAmount, amount ?? null);
  }
  for (const amount of [0, false, {}, [], 'x'.repeat(129)]) {
    const page = livePreview(date); page.items[0].billedAmount = amount;
    assert.throws(() => normalize(page, { mode: 'live', date, officeId: '123' }), /invalid_visit_preview/);
  }
  const failed = livePreview(date); failed.items[0] = { ...failed.items[0], state: 'unavailable', billedAmount: 'PRIVATE_UNVERIFIED_AMOUNT' };
  assert.equal(normalize(failed, { mode: 'live', date, officeId: '123' }).items[0].billedAmount, null);
});

test('visit billed amount appears in Billing from the verified visit page and clears with source context', async () => {
  for (const change of ['clear', 'date', 'demo', 'session']) {
    const app = await currentProfileFixture(() => { throw new Error('No extra read for visit amount'); }, date => {
      const page = livePreview(date); page.items[0].billedAmount = '17.30';
      page.items.push({ ...page.items[0], id: '900002', billedAmount: '0.00' }, { ...page.items[0], id: '900003', billedAmount: null },
        { ...page.items[0], id: '900004', state: 'unavailable', billedAmount: 'PRIVATE_UNVERIFIED_AMOUNT', error: 'vendor_backoff_active' });
      return page;
    });
    const before = nodeText(app.element('dashboardBillingPipeline'));
    assert.match(before, /Visit billed amount/); assert.match(before, /17\.30/); assert.match(before, /0\.00/);
    assert.match(before, /Not supplied by HHA/); assert.match(before, /Detail unavailable: Vendor retry delay recorded/);
    assert.match(before, /GetVisitInfoV3 BilledAmount/); assert.match(before, /GetVisitBillInfoV2/);
    assert.doesNotMatch(before, /PRIVATE_UNVERIFIED_AMOUNT/);
    assert.equal(app.calls.filter(c => /visit-context|visit-patient/.test(c.path)).length, 0);
    if (change === 'clear') await app.click('dashboardVisitClear');
    if (change === 'date') { app.element('dashboardVisitDate').value = ''; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'session') app.dispatch('primetime-signed-out');
    await tick(); await tick(); assert.doesNotMatch(nodeText(app.element('dashboardBillingPipeline')), /17\.30|0\.00|PRIVATE_UNVERIFIED_AMOUNT/, change);
  }
});

test('Staffing and Billing fetch guarded source context on demand and preserve zero and missing fields', async () => {
  const app = await relatedFixture(input => response(relatedPayload(input)));
  for (const kind of ['caregiver', 'billing']) {
    assert.equal(relatedButton(app, kind).disabled, false); await clickNode(relatedButton(app, kind)); await tick(); await tick();
    const call = app.calls.filter(c => c.path.endsWith('/workspace/visit-context')).at(-1);
    assert.deepEqual(JSON.parse(call.options.body), { kind, visitId: '900001', patientId: '5', officeId: '123', ...(kind === 'caregiver' ? { caregiverId: '6' } : {}) });
    const text = nodeText(app.element(kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts'));
    assert.match(text, /fetched 2026-10-24T16:00:00Z/); assert.match(text, /Not supplied by HHA/); assert.match(text, /Open records/);
    assert.match(text, kind === 'caregiver' ? /Synthetic caregiver/ : /Billed amount \(source\) 0/);
    assert.doesNotMatch(text, /collected\s+\$|eligible candidate|billing-ready total/i);
  }
});
test('disabled related reads are explicit and do not dispatch through the main tabs', async () => {
  const app = await relatedFixture(() => { throw new Error('disabled read dispatched'); }, false), calls = app.calls.length;
  for (const kind of ['caregiver', 'billing']) { assert.equal(relatedButton(app, kind).disabled, true); await clickNode(relatedButton(app, kind)); }
  assert.equal(app.calls.length, calls); assert.match(nodeText(app.element('dashboardBillingFacts')), /GetVisitBillInfoV2 is not enabled/);
  assert.match(nodeText(app.element('dashboardCaregiverProfile')), /GetCaregiverDemographics is not enabled/);
});
test('related source projection rejects foreign identities, office lists and invalid receipts', () => {
  const normalize = dashboardModel().primetimeDashboardModel.normalizeVisitContext;
  for (const kind of ['caregiver', 'billing']) {
    const input = { kind, visitId: '900001', patientId: '5', officeId: '123', ...(kind === 'caregiver' ? { caregiverId: '6' } : {}) }, valid = relatedPayload(input);
    assert.ok(normalize(valid, input).fields);
    for (const changes of [{ scope: { ...valid.scope, officeId: '999' } }, { records: [] }, { operation: 'GetPatientDemographics' }, { truncated: true }, { membershipCheckedAt: '2026-10-24T16:01:00Z' },
      { records: [{ ...valid.records[0], ID: '999' }] }, { records: [{ ...valid.records[0], ...(kind === 'caregiver' ? { OfficeIDs: '["999"]' } : { 'Patient/ID': '999' }) }] }]) {
      assert.throws(() => normalize({ ...valid, ...changes }, input), /invalid_visit_context/);
    }
  }
});
test('pending related reads and detached controls are fenced after date, Clear, Demo and session changes', async () => {
  for (const kind of ['caregiver', 'billing']) for (const change of ['clear', 'date', 'demo', 'session']) {
    const late = deferred(); let input; const app = await relatedFixture(value => { input = value; return late.promise; }), old = relatedButton(app, kind);
    await clickNode(old); await tick();
    if (change === 'clear') await app.click('dashboardVisitClear');
    if (change === 'date') { app.element('dashboardVisitDate').value = '2026-10-23'; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'session') app.dispatch('primetime-signed-out');
    late.resolve(response(relatedPayload(input, kind === 'caregiver' ? { FirstName: 'Late private context' } : { 'PrimaryBillTo/BilledAmount': '999999999' })));
    await tick(); await tick(); assert.doesNotMatch(nodeText(app.element(kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts')), /Late private context|999999999/);
    const calls = app.calls.length; await clickNode(old); await tick(); assert.equal(app.calls.length, calls);
  }
});
test('related source failures replace prior facts and respect the real quota delay', async () => {
  for (const kind of ['caregiver', 'billing']) {
    let limited = false; const app = await relatedFixture(input => limited ? { ...response({ ok: false, error: 'vendor_backoff_active', retryAfterSeconds: 60 }), ok: false, status: 429 } : response(relatedPayload(input)));
    await clickNode(relatedButton(app, kind)); await tick(); await tick(); limited = true; await clickNode(relatedButton(app, kind)); await tick(); await tick();
    const text = nodeText(app.element(kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts')); assert.match(text, /Retry in 60 seconds/); assert.doesNotMatch(text, /fetched|Synthetic caregiver/);
    const calls = app.calls.length; await clickNode(relatedButton(app, kind)); await tick(); assert.equal(app.calls.length, calls);
  }
});

test('an explicit empty related read replaces prior facts without a zero balance or source actions', async () => {
  for (const kind of ['caregiver', 'billing']) {
    let empty = false;
    const app = await relatedFixture(input => empty
      ? { ...response({ ok: false, error: 'visit_context_source_empty' }), ok: false, status: 409 }
      : response(relatedPayload(input)));
    await clickNode(relatedButton(app, kind)); await tick(); await tick();
    const host = app.element(kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts');
    assert.match(nodeText(host), /fetched/);
    empty = true; await clickNode(relatedButton(app, kind)); await tick(); await tick();
    const text = nodeText(host);
    assert.match(text, kind === 'caregiver' ? /This read returned no caregiver profile/ : /This read returned no billing record/);
    assert.match(text, kind === 'caregiver' ? /availability and eligibility remain unknown/ : /does not establish zero charges, payment or an AR balance/);
    assert.doesNotMatch(text, /fetched|Synthetic caregiver|Billed amount \(source\) 0|Not supplied by HHA|Open records/);
    assert.equal(descendants(host).filter(n => n.tagName === 'BUTTON').length, 0);
  }
});

function connectedWorkspace({ dataApproved = true, enabledReads = ['GetPatientDemographics', 'GetVisitInfoV3'], preview = livePreview, read = (_path, options) => response({ ok: true, operation: JSON.parse(options.body).operation, fetchedAt: '2026-10-10T08:00:00Z', records: [] }), history = () => response({ ok: true, items: [], nextCursor: null, source: 'manual_snapshot' }), authorizations = () => response({ ok: false, error: 'read_not_owner_enabled' }), patientVisit = () => response({ ok: false, error: 'read_not_owner_enabled' }) } = {}) {
  const settings = { revision: 1, officeId: '123', officeTimezone: 'America/Chicago', policyReference: '', enabledReads };
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: (path, options) => {
    if (path.endsWith('/settings')) return response({ ok: true, settings, dataApproved, supportedReads: [], readInputs: {
      GetPatientDemographics: ['id'], GetCaregiverDemographics: ['id'], GetVisitInfoV3: ['id'], SearchPatientAuthorizations: ['patientId'], GetPatientAuthorizationInfo: ['patientId', 'id'],
      SearchPatientPOC: ['patientId'], SearchPatientDocument: ['patientId', 'documentTypeId', 'id', 'date']
    } });
    if (path.includes('/views/visits?')) return response(preview(new URL(path, 'https://fixture.test').searchParams.get('date')));
    if (path.endsWith('/workspace/read')) return read(path, options);
    if (path.includes('/workspace/manual-snapshots')) return history(path, options);
    if (path.endsWith('/workspace/patient-authorizations')) return authorizations(path, options);
    if (path.endsWith('/workspace/patient-visit')) return patientVisit(path, options);
    return response({ ok: true });
  } });
  // Model the shared source form's real DOM ownership and control reset. Moving
  // it out of the operational root must not bypass disabling or duplicate it.
  const home = app.element('fixtureReadHome'), inline = app.element('patientAuthorizationHost');
  const form = app.element('readForm'), results = app.element('readResults');
  for (const host of [home, inline]) host.append = function (...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node);
      node.parentElement = this; this.children.push(node);
    }
  };
  home.append(form, results);
  const inputs = ['readId', 'readPatient', 'readOperation', 'readDate'].map(app.element);
  form.querySelectorAll = () => inputs;
  form.reset = () => { inputs.forEach(input => { input.value = ''; }); };
  app.element('operationalWorkspace').querySelectorAll = selector => selector === 'form' && form.parentElement === home ? [form] : [];
  const operationLabel = app.element('fixtureOperationLabel');
  app.element('readOperation').closest = () => operationLabel;
  installDashboard(app); vm.runInContext(asset('workspace.js'), app.context);
  return app;
}

const patientDiscoveryButtons = (app, host = 'dashboardTimeline') => descendants(app.element(host)).filter(node => ['Find patient care plans','Find patient documents'].includes(node.textContent));

test('care-plan and document shortcuts prepare exact patient discovery with visible-input focus and no request', async () => {
  const app=connectedWorkspace({enabledReads:['GetPatientDemographics','GetVisitInfoV3','SearchPatientPOC','SearchPatientDocument'],preview:date=>{
    const page=livePreview(date);page.items[0].name='Same synthetic patient';page.items.push({...page.items[0],id:'900002',patientId:'7'});return page;
  }});await app.signIn();await tick();await tick();
  for(const host of ['dashboardTimeline','dashboardVisitRows']) {
    const controls=patientDiscoveryButtons(app,host);assert.equal(controls.length,4);
    for(const [index,operation,patient] of [[0,'SearchPatientPOC','5'],[1,'SearchPatientDocument','5'],[2,'SearchPatientPOC','7'],[3,'SearchPatientDocument','7']]) {
      for(const id of ['readId','readPatient','readCaregiver','readContract','readDate','readTerm','readDocumentType'])app.element(id).value='stale';
      app.element('readResults').append({textContent:'prior subject results'});const calls=app.calls.length;
      await clickNode(controls[index]);
      assert.equal(app.element('readOperation').value,operation);assert.equal(app.element('readPatient').value,patient);assert.equal(app.element('readOffice').value,'123');
      for(const id of ['readId','readCaregiver','readContract','readDate','readTerm','readDocumentType'])assert.equal(app.element(id).value,'',id);
      assert.equal(app.element('readResults').children.length,0);assert.equal(app.document.activeElement,app.element('readPatient'));
      assert.equal(app.calls.length,calls,'selection must not fetch, download, import or enable anything');assert.match(app.element('workspaceMessage').textContent,/Choose Read source records/);
    }
  }
});

test('patient discovery shortcuts omit malformed or unavailable identities and never appear for Demo records', async () => {
  for(const patientId of [null,'','0','01','bad-id','99999999999']) {
    const app=connectedWorkspace({preview:date=>{const page=livePreview(date);page.items[0].patientId=patientId;page.items.push({id:'900002',patientId:'8',state:'unavailable'});return page;}});
    await app.signIn();await tick();await tick();
    for(const host of ['dashboardTimeline','dashboardVisitRows'])assert.equal(patientDiscoveryButtons(app,host).length,0);
    app.window.primetimeDataMode.setMode('demo');for(const host of ['dashboardTimeline','dashboardVisitRows'])assert.equal(patientDiscoveryButtons(app,host).length,0);
  }
});

test('new patient discovery selections retain owner entitlement, release and office gates', async () => {
  const app=connectedWorkspace();await app.signIn();await tick();await tick();
  for(const control of patientDiscoveryButtons(app)){const calls=app.calls.length;await clickNode(control);assert.equal(app.calls.length,calls);assert.match(app.element('workspaceMessage').textContent,/requires owner enablement/);}
  for(const kind of ['patient-care-plans','patient-documents']) {
    app.element('readPatient').value='unchanged';const calls=app.calls.length;
    app.document.dispatchEvent(new DetailEvent('primetime-source-record-selected',{detail:{kind,id:'5',officeId:'999'}}));
    assert.equal(app.element('readPatient').value,'unchanged');assert.equal(app.calls.length,calls);
    app.document.dispatchEvent(new DetailEvent('primetime-source-record-selected',{detail:{kind,id:'bad',officeId:'123'}}));assert.equal(app.element('readPatient').value,'unchanged');
  }
  const locked=connectedWorkspace({dataApproved:false});await locked.signIn();await tick();await tick();locked.element('readPatient').value='unchanged';
  const lockedControls=patientDiscoveryButtons(locked);assert.equal(lockedControls.length,2);
  for(const control of lockedControls){await clickNode(control);assert.equal(locked.element('readPatient').value,'unchanged');}
});

test('detached patient discovery controls cannot reuse refreshed, paged, dated, office, policy, mode or session context', async () => {
  for(const change of ['refresh','next','previous','date','office','policy','demo','session']) {
    const app=connectedWorkspace({preview:date=>({...livePreview(date),nextCursor:'next-page',state:'partial'})});await app.signIn();await tick();await tick();
    if(change==='previous'){await app.click('dashboardVisitNext');await tick();await tick();}
    const old=[...patientDiscoveryButtons(app),...patientDiscoveryButtons(app,'dashboardVisitRows')];assert.equal(old.length,4,change);
    if(change==='refresh')await app.click('dashboardOverviewRefresh');
    if(change==='next')await app.click('dashboardVisitNext');if(change==='previous')await app.click('dashboardVisitPrevious');
    if(change==='date'){app.element('dashboardOverviewDate').value='2026-10-09';for(const fn of app.element('dashboardOverviewDate').handlers.get('change'))fn(new Event('change'));}
    if(change==='office'||change==='policy')app.window.primetimeDataMode.observeScope({revision:2,officeId:change==='office'?'999':'123',officeTimezone:'America/Chicago'});
    if(change==='demo')app.window.primetimeDataMode.setMode('demo');if(change==='session')app.dispatch('primetime-signed-out');
    for(const phase of ['pending','settled']) {
      if(phase==='settled'){await tick();await tick();}
      const calls=app.calls.length,events=app.events.filter(e=>e.type==='primetime-source-record-selected').length;
      // Dispatch synchronously so an independent in-flight refresh is not counted as a shortcut request.
      for(const control of old)for(const callback of control.handlers.get('click')||[])callback(new Event('click'));
      assert.equal(app.calls.length,calls,change+' '+phase);assert.equal(app.events.filter(e=>e.type==='primetime-source-record-selected').length,events,change+' '+phase);
    }
  }
});

test('live visit shortcuts select exact patient, caregiver and visit reads without fetching or granting access', async () => {
  const app = connectedWorkspace(); await app.signIn(); await tick(); await tick();
  for (const host of ['dashboardTimeline', 'dashboardVisitRows']) {
    const controls = recordButtons(app, host);
    assert.equal(controls.length, 3);
    for (const [index, operation, id] of [[0, 'GetPatientDemographics', '5'], [1, 'GetCaregiverDemographics', '6'], [2, 'GetVisitInfoV3', '900001']]) {
      for (const field of ['readId', 'readPatient', 'readCaregiver', 'readContract', 'readDate']) app.element(field).value = 'stale';
      app.element('readResults').append({ textContent: 'prior subject facts' });
      const before = app.calls.length;
      await clickNode(controls[index]);
      assert.equal(app.calls.length, before, 'selection must not fetch, write or enable any read');
      assert.equal(app.element('readOperation').value, operation);
      assert.equal(app.element('readId').value, id); assert.equal(app.element('readOffice').value, '123');
      assert.equal(app.element('readPatient').value, index === 0 ? '5' : '');
      assert.equal(app.element('readCaregiver').value, index === 1 ? '6' : '');
      assert.equal(app.element('readContract').value, ''); assert.equal(app.element('readDate').value, '');
      assert.equal(app.element('readResults').children.length, 0);
      assert.equal(app.element('pageTitle').textContent, 'Advanced tools');
      assert.equal(app.document.activeElement, app.element('readId'));
      assert.match(app.element('workspaceMessage').textContent, index === 1 ? /requires owner enablement/ : /Choose Read source records/);
    }
  }
  for (const callback of app.element('readForm').handlers.get('submit')) callback({ preventDefault() {} });
  await tick();
  const reads = app.calls.filter(call => call.path.endsWith('/workspace/read'));
  assert.equal(reads.length, 1); assert.deepEqual(JSON.parse(reads[0].options.body), { operation: 'GetVisitInfoV3', id: '900001' });
});

test('unavailable details, invalid source IDs and Demo examples have no source record shortcuts', async () => {
  const app = connectedWorkspace({ preview: date => {
    const payload = livePreview(date);
    payload.items.push({ id: '900002', patientId: '77', caregiverId: '88', state: 'unavailable' });
    payload.items[0].patientId = '<script>'; payload.items[0].caregiverId = '0';
    return payload;
  } });
  await app.signIn(); await tick(); await tick();
  assert.deepEqual(recordButtons(app).map(node => node.textContent), ['Open visit read']);
  assert.deepEqual(recordButtons(app, 'dashboardVisitRows').map(node => node.textContent), ['Open visit read']);
  assert.equal(descendants(app.element('dashboardTimeline')).some(node => node.textContent === 'Saved calendar history'), false);
  assert.equal(descendants(app.element('dashboardVisitRows')).some(node => node.textContent === 'Saved calendar history'), false);
  app.window.primetimeDataMode.setMode('demo');
  assert.equal(recordButtons(app).length, 0); assert.equal(recordButtons(app, 'dashboardVisitRows').length, 0);
  assert.equal(descendants(app.element('dashboardTimeline')).some(node => node.textContent === 'Saved calendar history'), false);
});

test('detached record shortcuts cannot reuse old date, office, mode or session context', async () => {
  const app = connectedWorkspace(); await app.signIn(); await tick(); await tick();
  const old = recordButtons(app)[0];
  app.element('dashboardOverviewDate').value = '2026-10-09';
  for (const callback of app.element('dashboardOverviewDate').handlers.get('change')) callback(new Event('change'));
  await clickNode(old);
  assert.equal(app.events.filter(event => event.type === 'primetime-source-record-selected').length, 0);
  await tick(); await tick();
  const beforeScope = recordButtons(app)[0];
  app.window.primetimeDataMode.observeScope({ revision: 2, officeId: '999', officeTimezone: 'America/Chicago' });
  await clickNode(beforeScope);
  assert.equal(app.events.filter(event => event.type === 'primetime-source-record-selected').length, 0);
  await tick(); await tick();
  const beforeMode = recordButtons(app)[0]; app.window.primetimeDataMode.setMode('demo');
  await clickNode(beforeMode);
  assert.equal(app.events.filter(event => event.type === 'primetime-source-record-selected').length, 0);
  await app.live(); await tick(); await tick();
  const beforeSignOut = recordButtons(app)[0]; app.dispatch('primetime-signed-out');
  await clickNode(beforeSignOut);
  assert.equal(app.events.filter(event => event.type === 'primetime-source-record-selected').length, 0);
});

test('workspace rejects mismatched offices, malformed record kinds and locked access', async () => {
  for (const dataApproved of [true, false]) {
    const app = connectedWorkspace({ dataApproved }); await app.signIn(); await tick(); await tick();
    app.element('readId').value = 'keep';
    const selections = [{ kind: 'patient', id: '5', officeId: '999' }, { kind: '__proto__', id: '5', officeId: '123' }, { kind: 'visit', id: 'bad', officeId: '123' }];
    if (!dataApproved) selections.push({ kind: 'patient', id: '5', officeId: '123' });
    for (const detail of selections) app.document.dispatchEvent(new DetailEvent('primetime-source-record-selected', { detail }));
    assert.equal(app.element('readId').value, 'keep');
    assert.equal(app.events.filter(event => event.type === 'primetime-workbench-selected').length, 0);
    assert.equal(app.calls.some(call => call.path.endsWith('/workspace/read')), false);
  }
});

const historyButtons = (app, host = 'dashboardTimeline') => descendants(app.element(host)).filter(node => node.textContent === 'Saved calendar history');
const historyRows = (patientId = '5') => ({ ok: true, source: 'manual_snapshot', nextCursor: 'older', items: [{ id: 'a'.repeat(64), patientId, patientLabel: 'Synthetic saved patient', period: '2026-09', capturedAt: '2026-10-01T10:00:00.000Z', visitCount: 3, authorizationCount: 1 }] });
const historySnapshot = () => ({ ...historyRows().items[0], officeId: '123', updatedAt: '2026-10-01T10:01:00.000Z', authorizations: { columns: ['Source'], rows: [{ cells: ['Synthetic authorization'] }] }, visits: [
  { id: '11', date: '2026-09-01', text: 'Synthetic visit one' }, { id: '12', date: '2026-09-01', text: 'Synthetic visit two' }, { id: '13', date: '2026-09-02', text: 'Synthetic visit three' }
] });
const historyReads = app => app.calls.filter(call => call.path.includes('/workspace/manual-snapshots'));

test('live patient history shortcuts load exact protected history from both source views using GET only', async () => {
  const app = connectedWorkspace({ history: () => response(historyRows()) }); await app.signIn(); await tick(); await tick();
  for (const host of ['dashboardTimeline', 'dashboardVisitRows']) {
    app.element('manualPatientId').value = '99'; app.element('manualSnapshotPayload').value = 'prior capture';
    app.element('manualSnapshotDetails').append({ textContent: 'prior patient' });
    await clickNode(historyButtons(app, host)[0]); await tick(); await tick();
    assert.equal(app.element('manualPatientId').value, '5'); assert.equal(app.element('manualSnapshotPayload').value, '');
    assert.equal(app.element('manualSnapshotDetails').children.length, 0);
    assert.equal(app.element('pageTitle').textContent, 'Patient workbench');
    assert.equal(app.document.activeElement, app.element('manualPatientId'));
    assert.match(nodeText(app.element('manualSnapshotList')), /3 visit tiles.*1 authorization rows.*captured 2026-10-01/);
    assert.equal(new URL(historyReads(app).at(-1).path, 'https://fixture.test').searchParams.get('patientId'), '5');
  }
  assert.equal(historyReads(app).length, 2);
  assert.ok(historyReads(app).every(call => !call.options.method || call.options.method === 'GET'));
  assert.equal(app.window.primetimeDataMode.isLive(), true);
});

test('saved history opens dated manual evidence and its chart without replacing live source rows', async () => {
  const app = connectedWorkspace({ history: path => response(new URL(path, 'https://fixture.test').searchParams.has('id') ? { ok: true, snapshot: historySnapshot() } : historyRows()) });
  await app.signIn(); await tick(); await tick();
  const liveRows = nodeText(app.element('dashboardVisitRows'));
  await clickNode(historyButtons(app)[0]); await tick(); await tick();
  await clickNode(descendants(app.element('manualSnapshotList')).find(node => node.textContent === 'Open 2026-09 snapshot')); await tick(); await tick();
  const detail = nodeText(app.element('manualSnapshotDetails'));
  assert.match(detail, /Manual snapshot · source interpretation pending/);
  assert.match(detail, /Captured 2026-10-01T10:00:00.000Z · imported 2026-10-01T10:01:00.000Z/);
  assert.deepEqual(descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'PROGRESS').map(node => node.value), [2, 1]);
  assert.match(app.element('manualSnapshotStatus').textContent, /Saved manual snapshot loaded.*Use live reads/);
  assert.equal(nodeText(app.element('dashboardVisitRows')), liveRows);
});

test('a changed source page clears selected history and fences late responses and detached shortcuts', async () => {
  const pending = deferred();
  const app = connectedWorkspace({ history: () => pending.promise }); await app.signIn(); await tick(); await tick();
  const oldShortcut = historyButtons(app)[0];
  await clickNode(oldShortcut); await tick();
  app.element('dashboardOverviewDate').value = '2026-10-09';
  for (const fn of app.element('dashboardOverviewDate').handlers.get('change')) fn(new Event('change'));
  const count = historyReads(app).length;
  await clickNode(oldShortcut); pending.resolve(response(historyRows())); await tick(); await tick();
  assert.equal(historyReads(app).length, count);
  assert.equal(app.element('manualPatientId').value, '');
  assert.equal(app.element('manualSnapshotList').children.length, 0);
  assert.equal(app.element('manualSnapshotDetails').children.length, 0);
  assert.match(app.element('manualSnapshotStatus').textContent, /Live source context changed/);
});

test('cross-patient selection fences late errors and detached saved-version and pagination buttons', async () => {
  const late = deferred(); let hold = false;
  const app = connectedWorkspace({ history: () => hold ? late.promise : response(historyRows()) }); await app.signIn(); await tick(); await tick();
  await clickNode(historyButtons(app)[0]); await tick(); await tick();
  const controls = descendants(app.element('manualSnapshotList'));
  const open = controls.find(node => node.textContent === 'Open 2026-09 snapshot'), older = controls.find(node => node.textContent === 'Older imports');
  hold = true; const opening = clickNode(open); await tick();
  app.element('manualPatientId').value = '6';
  for (const fn of app.element('manualPatientId').handlers.get('input')) fn(new Event('input'));
  const count = historyReads(app).length;
  await clickNode(open); await clickNode(older);
  late.resolve(response({ ok: false, error: 'snapshot_not_found' })); await opening; await tick(); await tick();
  assert.equal(historyReads(app).length, count, 'detached controls must not issue a read for a different patient');
  assert.equal(app.element('manualPatientId').value, '6');
  assert.equal(app.element('manualSnapshotList').children.length, 0); assert.equal(app.element('manualSnapshotDetails').children.length, 0);
  assert.equal(app.element('manualSnapshotStatus').textContent, 'Enter a patient ID to load protected imports.');
});

test('lost history access clears previously loaded evidence and stays distinct from an empty history', async () => {
  let allowed = true;
  const app = connectedWorkspace({ history: () => response(allowed ? historyRows() : { ok: false, error: 'patient_office_mismatch' }) }); await app.signIn(); await tick(); await tick();
  await clickNode(historyButtons(app)[0]); await tick(); await tick();
  assert.ok(app.element('manualSnapshotList').children.length);
  allowed = false; await clickNode(historyButtons(app)[0]); await tick(); await tick();
  assert.equal(app.element('manualSnapshotList').children.length, 0); assert.equal(app.element('manualSnapshotDetails').children.length, 0);
  assert.match(app.element('manualSnapshotStatus').textContent, /patient office mismatch/);
  assert.doesNotMatch(app.element('manualSnapshotStatus').textContent, /No calendar snapshots/);
  assert.ok(historyReads(app).every(call => !call.options.method || call.options.method === 'GET'));
});

test('history selection rejects foreign offices, malformed IDs, locked access and stale mode/session contexts', async () => {
  for (const dataApproved of [true, false]) {
    const app = connectedWorkspace({ dataApproved }); await app.signIn(); await tick(); await tick();
    const old = historyButtons(app)[0];
    for (const detail of [{ kind: 'patient-history', id: '5', officeId: '999' }, { kind: 'patient-history', id: 'bad', officeId: '123' }, ...(!dataApproved ? [{ kind: 'patient-history', id: '5', officeId: '123' }] : [])]) app.document.dispatchEvent(new DetailEvent('primetime-source-record-selected', { detail }));
    assert.equal(historyReads(app).length, 0);
    app.window.primetimeDataMode.setMode('demo'); await clickNode(old);
    assert.equal(historyReads(app).length, 0);
    await app.live(); await tick(); await tick();
    const beforeSignOut = historyButtons(app)[0]; app.dispatch('primetime-signed-out'); await clickNode(beforeSignOut);
    assert.equal(historyReads(app).length, 0);
  }
});

const currentVisitButtons = app => descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'BUTTON' && node.textContent.startsWith('Read current visit '));
const currentVisitCalls = app => app.calls.filter(call => call.path.endsWith('/workspace/patient-visit'));
const currentVisitSource = (input, changes = {}) => ({ ok: true, operation: 'GetVisitInfoV3', source: 'hhaexchange', interpretation: 'visit_source_unvalidated',
  scope: input, fetchedAt: '2026-10-16T14:00:00.000Z', membershipCheckedAt: '2026-10-16T14:00:01.000Z', truncated: false,
  records: [{ ID: input.visitId, 'Patient/ID': input.patientId, EVVStartTime: null, ActualHours: '0', BilledAmount: '' }], ...changes });
async function openSavedHistory(app) {
  await app.signIn(); await tick(); await tick();
  await clickNode(historyButtons(app)[0]); await tick(); await tick();
  await clickNode(descendants(app.element('manualSnapshotList')).find(node => node.textContent === 'Open 2026-09 snapshot')); await tick(); await tick();
}
const savedHistory = snapshot => path => response(new URL(path, 'https://fixture.test').searchParams.has('id') ? { ok: true, snapshot: snapshot || historySnapshot() } : historyRows());

test('saved calendar rows explicitly read current scoped visits and retain immutable manual facts', async () => {
  const snapshot = historySnapshot(), before = JSON.stringify(snapshot);
  const app = connectedWorkspace({ history: savedHistory(snapshot), patientVisit: (_path, options) => response(currentVisitSource(JSON.parse(options.body))) });
  await openSavedHistory(app); assert.equal(currentVisitCalls(app).length, 0);
  assert.equal(currentVisitButtons(app).length, 3);
  const chartBefore = descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'PROGRESS').map(node => node.value);
  await clickNode(currentVisitButtons(app)[0]); await tick(); await tick();
  assert.deepEqual(JSON.parse(currentVisitCalls(app)[0].options.body), { visitId: '11', patientId: '5', officeId: '123' });
  assert.equal(currentVisitCalls(app)[0].options.method, 'POST');
  const text = nodeText(app.element('manualSnapshotDetails'));
  assert.match(text, /Manual snapshot · source interpretation pending/); assert.match(text, /Current HHA visit evidence/);
  assert.match(text, /fetched 2026-10-16.*patient office checked 2026-10-16/); assert.match(text, /saved capture from 2026-10-01.*unchanged/);
  assert.match(text, /Not supplied \/ unknown/); assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'PROGRESS').map(node => node.value), chartBefore);
});

test('invalid, duplicate, foreign-scope or owner-disabled saved visits have no actionable shortcut', async () => {
  for (const mode of ['ids', 'patient', 'office', 'permissions']) {
    const snapshot = historySnapshot();
    if (mode === 'ids') snapshot.visits = [{ ...snapshot.visits[0], id: 'bad' }, { ...snapshot.visits[1], id: '12' }, { ...snapshot.visits[2], id: '12' }];
    if (mode === 'patient') snapshot.patientId = '99';
    if (mode === 'office') snapshot.officeId = '999';
    const app = connectedWorkspace({ history: savedHistory(snapshot), ...(mode === 'permissions' ? { enabledReads: ['GetPatientDemographics'] } : {}) });
    await openSavedHistory(app); assert.equal(currentVisitButtons(app).length, 0); assert.equal(currentVisitCalls(app).length, 0);
  }
});

test('detached saved-visit controls cannot read after another saved version, patient, mode or session', async () => {
  for (const mode of ['version', 'patient', 'office', 'demo', 'session']) {
    const app = connectedWorkspace({ history: savedHistory() }); await openSavedHistory(app);
    const old = currentVisitButtons(app)[0];
    if (mode === 'version') { await clickNode(descendants(app.element('manualSnapshotList')).find(node => node.textContent === 'Open 2026-09 snapshot')); await tick(); await tick(); }
    if (mode === 'patient') { app.element('manualPatientId').value = '99'; for (const fn of app.element('manualPatientId').handlers.get('input')) fn(new Event('input')); }
    if (mode === 'office') app.window.primetimeDataMode.observeScope({ revision: 2, officeId: '999', officeTimezone: 'America/Chicago' });
    if (mode === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (mode === 'session') app.dispatch('primetime-signed-out');
    await clickNode(old); await tick(); assert.equal(currentVisitCalls(app).length, 0, mode);
  }
});

test('late saved-visit successes and errors cannot repaint a changed patient or saved version', async () => {
  for (const change of ['patient', 'version']) for (const fail of [true, false]) {
    const pending = deferred();
    const app = connectedWorkspace({ history: savedHistory(), patientVisit: () => pending.promise }); await openSavedHistory(app);
    const reading = clickNode(currentVisitButtons(app)[0]); await tick();
    if (change === 'patient') { app.element('manualPatientId').value = '99'; for (const fn of app.element('manualPatientId').handlers.get('input')) fn(new Event('input')); }
    else { await clickNode(descendants(app.element('manualSnapshotList')).find(node => node.textContent === 'Open 2026-09 snapshot')); await tick(); await tick(); }
    const status = app.element('manualSnapshotStatus').textContent;
    pending.resolve(response(fail ? { ok: false, error: 'patient_office_mismatch' } : currentVisitSource({ visitId: '11', patientId: '5', officeId: '123' })));
    await reading; await tick(); await tick();
    assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
    assert.equal(app.element('manualSnapshotStatus').textContent, status);
  }
});

test('only the latest requested saved visit may show current evidence', async () => {
  const pending = [deferred(), deferred()]; let offset = 0;
  const app = connectedWorkspace({ history: savedHistory(), patientVisit: () => pending[offset++].promise }); await openSavedHistory(app);
  const buttons = currentVisitButtons(app), first = clickNode(buttons[0]); await tick(); const second = clickNode(buttons[1]); await tick();
  pending[1].resolve(response(currentVisitSource({ visitId: '12', patientId: '5', officeId: '123' }))); await second; await tick();
  pending[0].resolve(response(currentVisitSource({ visitId: '11', patientId: '5', officeId: '123' }))); await first; await tick();
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Visit 12 · fetched/);
  assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')), /Visit 11 · fetched/);
});

test('failed or mismatched current reads clear current evidence and retain saved source facts', async () => {
  for (const change of [{ ok: false, error: 'patient_office_mismatch' }, { scope: { visitId: '11', patientId: '99', officeId: '123' } }]) {
    let fail = false;
    const app = connectedWorkspace({ history: savedHistory(), patientVisit: (_path, options) => response(currentVisitSource(JSON.parse(options.body), fail ? change : {})) });
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    assert.match(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
    fail = true; await clickNode(currentVisitButtons(app)[0]); await tick(); await tick();
    assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
    assert.match(nodeText(app.element('manualSnapshotDetails')), /Synthetic visit one/);
    assert.match(app.element('manualSnapshotStatus').textContent, /patient office mismatch|could not be verified/);
  }
});

const savedFilterControls = app => {
  const fieldset = descendants(app.element('manualSnapshotDetails')).find(node => node.tagName === 'FIELDSET');
  return { inputs: descendants(fieldset).filter(node => node.tagName === 'INPUT'), reset: descendants(fieldset).find(node => node.tagName === 'BUTTON') };
};
const savedTableRows = app => descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'TBODY').at(-1).children;
function inputSavedFilter(input, value) { input.value = value; for (const fn of input.handlers.get('input') || []) fn(new Event('input')); }

test('saved filters compose locally with exact IDs, clear reset and full capture/chart preservation', async () => {
  const snapshot = historySnapshot(), original = JSON.stringify(snapshot);
  const app = connectedWorkspace({ history: savedHistory(snapshot) }); await openSavedHistory(app);
  const { inputs: [date, id, text], reset } = savedFilterControls(app), calls = app.calls.length;
  const chart = () => descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'PROGRESS').map(node => node.value);
  const fullChart = chart();
  inputSavedFilter(date, '2026-09-01'); assert.equal(savedTableRows(app).length, 2);
  inputSavedFilter(id, ' 12 '); assert.equal(savedTableRows(app).length, 1);
  inputSavedFilter(text, 'TWO'); assert.equal(savedTableRows(app).length, 1);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Showing 1–1 of 1 matched saved visit tiles · 3 loaded in this capture/);
  assert.match(app.element('manualSnapshotStatus').textContent, /chart above still shows all 3 saved tiles/);
  inputSavedFilter(text, 'one'); assert.equal(savedTableRows(app).length, 0);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /No saved visit tiles match these filters/);
  assert.deepEqual(chart(), fullChart); assert.equal(JSON.stringify(snapshot), original);
  await clickNode(reset); assert.equal(savedTableRows(app).length, 3);
  assert.deepEqual([date.value,id.value,text.value], ['', '', '']); assert.equal(app.document.activeElement, date);
  assert.equal(app.calls.length, calls, 'filtering and reset must not issue source/storage requests');
  assert.deepEqual(chart(), fullChart); assert.equal(JSON.stringify(snapshot), original);
});

test('exact saved IDs and literal source search distinguish no match from no saved data', async () => {
  const app = connectedWorkspace({ history: savedHistory() }); await openSavedHistory(app);
  const { inputs: [date, id, text] } = savedFilterControls(app);
  for (const value of ['1','0','not-an-id']) { inputSavedFilter(id, value); assert.equal(savedTableRows(app).length, 0); }
  inputSavedFilter(id, ''); inputSavedFilter(text, '.*'); assert.equal(savedTableRows(app).length, 0);
  inputSavedFilter(text, 'SYNTHETIC VISIT'); assert.equal(savedTableRows(app).length, 3);
  inputSavedFilter(date, '2026-10-01'); assert.equal(savedTableRows(app).length, 0);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Showing 0 of 0 matched saved visit tiles · 3 loaded/);
  assert.doesNotMatch(app.element('manualSnapshotStatus').textContent, /No calendar snapshots saved/);
  assert.equal(currentVisitCalls(app).length, 0);
});

test('filter changes clear current evidence and fence late results, failures and detached row actions', async () => {
  for (const failure of [false,true]) {
    const pending = deferred(); let wait = false;
    const app = connectedWorkspace({ history: savedHistory(), patientVisit: (_path, options) => wait ? pending.promise : response(currentVisitSource(JSON.parse(options.body))) });
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    assert.match(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
    const old = currentVisitButtons(app)[0]; wait = true; const reading = clickNode(old); await tick();
    const { inputs: [,id] } = savedFilterControls(app); inputSavedFilter(id, '12');
    const count = currentVisitCalls(app).length, status = app.element('manualSnapshotStatus').textContent;
    await clickNode(old); assert.equal(currentVisitCalls(app).length, count);
    pending.resolve(response(failure ? { ok:false,error:'patient_office_mismatch' } : currentVisitSource({ visitId:'11',patientId:'5',officeId:'123' })));
    await reading; await tick();
    assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
    assert.equal(app.element('manualSnapshotStatus').textContent, status);
    assert.equal(savedTableRows(app).length, 1);
  }
});

test('detached filters cannot alter another version, patient, office, mode or session', async () => {
  for (const mode of ['version','patient','office','demo','session']) {
    const app = connectedWorkspace({ history: savedHistory() }); await openSavedHistory(app);
    const { inputs: [date], reset } = savedFilterControls(app);
    if (mode === 'version') { await clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot')); await tick(); await tick(); }
    if (mode === 'patient') { app.element('manualPatientId').value='99'; for(const fn of app.element('manualPatientId').handlers.get('input')) fn(new Event('input')); }
    if (mode === 'office') app.window.primetimeDataMode.observeScope({revision:2,officeId:'999',officeTimezone:'America/Chicago'});
    if (mode === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (mode === 'session') app.dispatch('primetime-signed-out');
    await tick(); const before=nodeText(app.element('manualSnapshotDetails')), status=app.element('manualSnapshotStatus').textContent, calls=app.calls.length;
    inputSavedFilter(date,'2026-09-02'); await clickNode(reset); await tick();
    assert.equal(nodeText(app.element('manualSnapshotDetails')),before,mode); assert.equal(app.element('manualSnapshotStatus').textContent,status,mode);
    assert.equal(app.calls.length,calls,mode);
  }
});

test('filtering does not make duplicate IDs actionable or enable a closed current read', async () => {
  for (const disabled of [false,true]) {
    const snapshot=historySnapshot(); if(!disabled) { snapshot.visits[1].id='11'; snapshot.visits[1].date='2026-09-02'; }
    const app=connectedWorkspace({history:savedHistory(snapshot),...(disabled?{enabledReads:['GetPatientDemographics']}:{})});
    await openSavedHistory(app); const {inputs:[date,id]}=savedFilterControls(app);
    inputSavedFilter(id,'11'); inputSavedFilter(date,'2026-09-01');
    assert.equal(currentVisitButtons(app).length,0); assert.equal(currentVisitCalls(app).length,0);
  }
});

test('filtered rows keep exact current-read identity and version changes reset local filters', async () => {
  const app=connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>response(currentVisitSource(JSON.parse(options.body)))});
  await openSavedHistory(app); const {inputs:[,id]}=savedFilterControls(app); inputSavedFilter(id,'12');
  await clickNode(currentVisitButtons(app)[0]); await tick();
  assert.deepEqual(JSON.parse(currentVisitCalls(app)[0].options.body),{visitId:'12',patientId:'5',officeId:'123'});
  assert.match(nodeText(app.element('manualSnapshotDetails')),/Visit 12 · fetched/);
  await clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot')); await tick(); await tick();
  assert.deepEqual(savedFilterControls(app).inputs.map(input=>input.value),['','','']); assert.equal(savedTableRows(app).length,3);
  assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')),/Current HHA visit evidence/);
});

test('detached filter callbacks cannot cancel an in-flight saved-version load', async () => {
  const pending=deferred(); let hold=false;
  const app=connectedWorkspace({history:path=>new URL(path,'https://fixture.test').searchParams.has('id')&&hold?pending.promise:savedHistory()(path)});
  await openSavedHistory(app); const {inputs:[date],reset}=savedFilterControls(app); hold=true;
  const opening=clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot')); await tick();
  inputSavedFilter(date,'2026-09-02'); await clickNode(reset);
  pending.resolve(response({ok:true,snapshot:historySnapshot()})); await opening; await tick();
  assert.equal(savedTableRows(app).length,3); assert.deepEqual(savedFilterControls(app).inputs.map(input=>input.value),['','','']);
  assert.match(app.element('manualSnapshotStatus').textContent,/Saved manual snapshot loaded/);
});

const savedPageControls = app => {
  const nav = descendants(app.element('manualSnapshotDetails')).find(node => node.tagName === 'NAV');
  return { previous: nav.children[0], next: nav.children[1], summary: nav.children[2] };
};
const savedCells = app => savedTableRows(app).map(row => row.children.slice(0, 3).map(cell => cell.textContent));
const pagedSavedSnapshot = (count = 23) => ({ ...historySnapshot(), visits: Array.from({ length: count }, (_, index) => ({
  id: String(100 + index), date: index % 2 ? '2026-09-02' : '2026-09-01', text: `Synthetic paged visit ${index + 1} ${index % 2 ? 'ODD' : 'EVEN'}`
})) });

test('saved pages retain all ordered source cells, full charts and provenance without extra reads', async () => {
  const snapshot = pagedSavedSnapshot(), original = JSON.stringify(snapshot), app = connectedWorkspace({ history: savedHistory(snapshot) });
  await openSavedHistory(app); const calls = app.calls.length;
  const chart = () => descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'PROGRESS').map(node => node.value);
  const fullChart = chart(), first = savedCells(app), collected = [...first];
  assert.equal(first.length, 10); assert.equal(savedPageControls(app).previous.disabled, true);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Showing 1–10 of 23 matched saved visit tiles · 23 loaded/);
  await clickNode(savedPageControls(app).next); collected.push(...savedCells(app));
  assert.equal(savedTableRows(app).length, 10); assert.match(savedPageControls(app).summary.textContent, /Page 2 of 3/);
  assert.equal(app.document.activeElement.textContent.startsWith('Showing 11–20'), true);
  await clickNode(savedPageControls(app).next); collected.push(...savedCells(app));
  assert.equal(savedTableRows(app).length, 3); assert.equal(savedPageControls(app).next.disabled, true);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Showing 21–23 of 23 matched saved visit tiles/);
  assert.deepEqual(collected, snapshot.visits.map(visit => [visit.date, visit.id, visit.text]));
  await clickNode(savedPageControls(app).next); assert.equal(savedTableRows(app).length, 3);
  await clickNode(savedPageControls(app).previous); await clickNode(savedPageControls(app).previous);
  assert.deepEqual(savedCells(app), first); await clickNode(savedPageControls(app).previous); assert.deepEqual(savedCells(app), first);
  assert.deepEqual(chart(), fullChart); assert.equal(chart().reduce((a,b) => a + b, 0), 23);
  assert.equal(JSON.stringify(snapshot), original); assert.equal(app.calls.length, calls);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Captured 2026-10-01/);
});

test('saved pagination resets for composed filters, empty matches and clear without changing the loaded denominator', async () => {
  const app = connectedWorkspace({ history: savedHistory(pagedSavedSnapshot()) }); await openSavedHistory(app);
  await clickNode(savedPageControls(app).next);
  const { inputs: [,id,text], reset } = savedFilterControls(app);
  inputSavedFilter(text, 'EVEN'); assert.match(savedPageControls(app).summary.textContent, /Page 1 of 2/);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Showing 1–10 of 12 matched saved visit tiles · 23 loaded/);
  await clickNode(savedPageControls(app).next); assert.equal(savedTableRows(app).length, 2);
  inputSavedFilter(id, '122'); assert.equal(savedTableRows(app).length, 1); assert.match(savedPageControls(app).summary.textContent, /Page 1 of 1/);
  inputSavedFilter(text, 'ODD'); assert.equal(savedTableRows(app).length, 0);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Showing 0 of 0 matched saved visit tiles · 23 loaded/);
  assert.equal(savedPageControls(app).previous.disabled, true); assert.equal(savedPageControls(app).next.disabled, true);
  assert.match(nodeText(app.element('manualSnapshotDetails')), /chart above still shows all 23 saved tiles/);
  await clickNode(reset); assert.equal(savedTableRows(app).length, 10); assert.match(savedPageControls(app).summary.textContent, /Page 1 of 3/);
  assert.deepEqual(savedFilterControls(app).inputs.map(input => input.value), ['', '', '']);
});

test('saved pagination boundaries handle exact page sizes and a final single row', async () => {
  for (const count of [1,10,11]) {
    const app = connectedWorkspace({ history: savedHistory(pagedSavedSnapshot(count)) }); await openSavedHistory(app);
    assert.equal(savedTableRows(app).length, Math.min(10,count)); assert.equal(savedPageControls(app).next.disabled, count <= 10);
    if (count === 11) { await clickNode(savedPageControls(app).next); assert.equal(savedTableRows(app).length, 1); assert.match(nodeText(app.element('manualSnapshotDetails')), /Showing 11–11 of 11 matched/); }
  }
});

test('saved page changes clear current evidence and fence late successes, errors and detached controls', async () => {
  for (const failure of [false,true]) {
    const pending = deferred(); let wait = false;
    const app = connectedWorkspace({ history: savedHistory(pagedSavedSnapshot()), patientVisit: (_path, options) => wait ? pending.promise : response(currentVisitSource(JSON.parse(options.body))) });
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    assert.match(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
    const oldRow = currentVisitButtons(app)[0], oldPage = savedPageControls(app).next;
    wait = true; const reading = clickNode(oldRow); await tick(); await clickNode(oldPage);
    const calls = app.calls.length, status = app.element('manualSnapshotStatus').textContent, cells = savedCells(app);
    await clickNode(oldRow); await clickNode(oldPage); assert.equal(app.calls.length, calls); assert.deepEqual(savedCells(app), cells);
    pending.resolve(response(failure ? {ok:false,error:'patient_office_mismatch'} : currentVisitSource({visitId:'100',patientId:'5',officeId:'123'})));
    await reading; await tick(); assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
    assert.equal(app.element('manualSnapshotStatus').textContent, status); assert.match(savedPageControls(app).summary.textContent, /Page 2 of 3/);
  }
});

test('detached saved page controls cannot alter a different version, patient, office, mode or session', async () => {
  for (const mode of ['version','patient','office','demo','session','filter']) {
    const app = connectedWorkspace({ history: savedHistory(pagedSavedSnapshot()) }); await openSavedHistory(app);
    const old = savedPageControls(app).next;
    if (mode === 'version') { await clickNode(descendants(app.element('manualSnapshotList')).find(node => node.textContent === 'Open 2026-09 snapshot')); await tick(); }
    if (mode === 'patient') { app.element('manualPatientId').value = '99'; for (const fn of app.element('manualPatientId').handlers.get('input')) fn(new Event('input')); }
    if (mode === 'office') app.window.primetimeDataMode.observeScope({revision:2,officeId:'999',officeTimezone:'America/Chicago'});
    if (mode === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (mode === 'session') app.dispatch('primetime-signed-out');
    if (mode === 'filter') inputSavedFilter(savedFilterControls(app).inputs[1], '100');
    await tick(); const before = nodeText(app.element('manualSnapshotDetails')), status = app.element('manualSnapshotStatus').textContent, calls = app.calls.length;
    await clickNode(old); assert.equal(nodeText(app.element('manualSnapshotDetails')), before, mode);
    assert.equal(app.element('manualSnapshotStatus').textContent, status, mode); assert.equal(app.calls.length, calls, mode);
  }
});

test('detached page controls cannot cancel a saved-version load and reopening starts at page one', async () => {
  const pending = deferred(); let hold = false;
  const app = connectedWorkspace({ history: path => new URL(path,'https://fixture.test').searchParams.has('id') && hold ? pending.promise : savedHistory(pagedSavedSnapshot())(path) });
  await openSavedHistory(app); await clickNode(savedPageControls(app).next); const old = savedPageControls(app).next; hold = true;
  const opening = clickNode(descendants(app.element('manualSnapshotList')).find(node => node.textContent === 'Open 2026-09 snapshot')); await tick();
  await clickNode(old); pending.resolve(response({ok:true,snapshot:pagedSavedSnapshot(11)})); await opening; await tick();
  assert.match(savedPageControls(app).summary.textContent, /Page 1 of 2/); assert.equal(savedTableRows(app).length, 10);
  assert.match(app.element('manualSnapshotStatus').textContent, /Saved manual snapshot loaded/);
});

test('duplicate source IDs on different saved pages never become actionable', async () => {
  const snapshot = pagedSavedSnapshot(); snapshot.visits[20].id = snapshot.visits[0].id;
  const app = connectedWorkspace({ history: savedHistory(snapshot) }); await openSavedHistory(app);
  assert.equal(currentVisitButtons(app).some(node => node.textContent === 'Read current visit 100'), false);
  await clickNode(savedPageControls(app).next); await clickNode(savedPageControls(app).next);
  assert.equal(currentVisitButtons(app).some(node => node.textContent === 'Read current visit 100'), false);
  inputSavedFilter(savedFilterControls(app).inputs[2], 'visit 21 '); assert.equal(savedTableRows(app).length, 1);
  assert.equal(currentVisitButtons(app).length, 0); assert.equal(currentVisitCalls(app).length, 0);
});

test('a later saved page reads the exact selected visit and navigating clears its current evidence', async () => {
  const app = connectedWorkspace({ history: savedHistory(pagedSavedSnapshot()), patientVisit: (_path,options) => response(currentVisitSource(JSON.parse(options.body))) });
  await openSavedHistory(app); await clickNode(savedPageControls(app).next);
  await clickNode(currentVisitButtons(app)[0]); await tick();
  assert.deepEqual(JSON.parse(currentVisitCalls(app)[0].options.body), {visitId:'110',patientId:'5',officeId:'123'});
  assert.match(nodeText(app.element('manualSnapshotDetails')), /Visit 110 · fetched/);
  await clickNode(savedPageControls(app).previous); assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')), /Current HHA visit evidence/);
  assert.match(savedPageControls(app).summary.textContent, /Page 1 of 3/);
});

const savedDayButtons = app => descendants(app.element('manualSnapshotDetails')).filter(node => node.className === 'snapshot-day-filter');
const savedDay = (app,date) => savedDayButtons(app).find(node => node.textContent === date);

test('saved chart days filter and toggle locally while retaining full counts, source facts and provenance', async () => {
  const snapshot=pagedSavedSnapshot(), original=JSON.stringify(snapshot), app=connectedWorkspace({history:savedHistory(snapshot)});
  await openSavedHistory(app); const calls=app.calls.length, first=savedCells(app);
  const bars=()=>descendants(app.element('manualSnapshotDetails')).filter(node=>node.tagName==='PROGRESS').map(node=>[node.value,node.max]);
  const fullChart=bars(); await clickNode(savedPageControls(app).next);
  const day=savedDay(app,'2026-09-01'); assert.equal(day.type,'button'); assert.equal(day['aria-controls'],'manualSavedVisitRows');
  await clickNode(day); assert.equal(savedFilterControls(app).inputs[0].value,'2026-09-01');
  assert.equal(day['aria-pressed'],'true'); assert.equal(savedDay(app,'2026-09-02')['aria-pressed'],'false');
  assert.match(savedPageControls(app).summary.textContent,/Page 1 of 2/);
  assert.match(nodeText(app.element('manualSnapshotDetails')),/Showing 1–10 of 12 matched saved visit tiles · 23 loaded/);
  assert.deepEqual(savedCells(app),snapshot.visits.filter(v=>v.date==='2026-09-01').slice(0,10).map(v=>[v.date,v.id,v.text]));
  await clickNode(day); assert.equal(day['aria-pressed'],'false'); assert.equal(savedFilterControls(app).inputs[0].value,'');
  assert.deepEqual(savedCells(app),first); assert.deepEqual(bars(),fullChart); assert.equal(JSON.stringify(snapshot),original);
  assert.equal(app.calls.length,calls,'chart selection/toggle must not request source/storage');
});

test('chart selection composes with other filters and manual date/reset keeps selected-day feedback accurate', async () => {
  const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot())}); await openSavedHistory(app);
  const {inputs:[date,id,text],reset}=savedFilterControls(app);
  inputSavedFilter(id,'100'); inputSavedFilter(text,'EVEN'); await clickNode(savedDay(app,'2026-09-02'));
  assert.equal(savedTableRows(app).length,0); assert.deepEqual([date.value,id.value,text.value],['2026-09-02','100','EVEN']);
  assert.match(app.element('manualSnapshotStatus').textContent,/Saved date filter: 2026-09-02/);
  await clickNode(savedDay(app,'2026-09-02')); assert.equal(savedTableRows(app).length,1);
  assert.deepEqual([date.value,id.value,text.value],['','100','EVEN']);
  inputSavedFilter(date,'2026-09-01'); assert.equal(savedDay(app,'2026-09-01')['aria-pressed'],'true');
  inputSavedFilter(date,'2026-09-03'); assert.ok(savedDayButtons(app).every(node=>node['aria-pressed']==='false'));
  assert.equal(savedTableRows(app).length,0); assert.match(app.element('manualSnapshotStatus').textContent,/Saved date filter: 2026-09-03/);
  await clickNode(reset); assert.ok(savedDayButtons(app).every(node=>node['aria-pressed']==='false'));
  assert.match(nodeText(app.element('manualSnapshotDetails')),/Saved date filter: all dates/);
  assert.equal(app.document.activeElement,date); assert.equal(savedTableRows(app).length,10);
});

test('chart selection clears current evidence and fences late success/errors plus detached row/page controls', async () => {
  for(const failure of [false,true]) {
    const pending=deferred(); let wait=false;
    const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot()),patientVisit:(_path,options)=>wait?pending.promise:response(currentVisitSource(JSON.parse(options.body)))});
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    assert.match(nodeText(app.element('manualSnapshotDetails')),/Current HHA visit evidence/);
    const oldRow=currentVisitButtons(app)[0], oldPage=savedPageControls(app).next;
    wait=true; const reading=clickNode(oldRow); await tick(); await clickNode(savedDay(app,'2026-09-02'));
    const cells=savedCells(app),calls=app.calls.length,status=app.element('manualSnapshotStatus').textContent;
    await clickNode(oldRow); await clickNode(oldPage); assert.equal(app.calls.length,calls); assert.deepEqual(savedCells(app),cells);
    pending.resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:currentVisitSource({visitId:'100',patientId:'5',officeId:'123'})));
    await reading; await tick(); assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')),/Current HHA visit evidence/);
    assert.equal(app.element('manualSnapshotStatus').textContent,status);
  }
});

test('detached chart controls cannot change another saved version, patient, office, policy, mode or session', async () => {
  for(const mode of ['version','patient','office','policy','demo','session']) {
    const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot())}); await openSavedHistory(app);
    const old=savedDay(app,'2026-09-02');
    if(mode==='version') {await clickNode(descendants(app.element('manualSnapshotList')).find(node=>node.textContent==='Open 2026-09 snapshot')); await tick();}
    if(mode==='patient') {app.element('manualPatientId').value='99';for(const fn of app.element('manualPatientId').handlers.get('input'))fn(new Event('input'));}
    if(mode==='office'||mode==='policy')app.window.primetimeDataMode.observeScope({revision:2,officeId:mode==='office'?'999':'123',officeTimezone:'America/Chicago'});
    if(mode==='demo')app.window.primetimeDataMode.setMode('demo'); if(mode==='session')app.dispatch('primetime-signed-out');
    await tick(); const before=nodeText(app.element('manualSnapshotDetails')),status=app.element('manualSnapshotStatus').textContent,calls=app.calls.length;
    await clickNode(old); assert.equal(nodeText(app.element('manualSnapshotDetails')),before,mode);
    assert.equal(app.element('manualSnapshotStatus').textContent,status,mode); assert.equal(app.calls.length,calls,mode);
  }
});

test('detached chart controls cannot cancel a pending saved-version load and selected dates reset on reopen', async () => {
  const pending=deferred(); let hold=false;
  const app=connectedWorkspace({history:path=>new URL(path,'https://fixture.test').searchParams.has('id')&&hold?pending.promise:savedHistory(pagedSavedSnapshot())(path)});
  await openSavedHistory(app); const old=savedDay(app,'2026-09-02'); await clickNode(old); hold=true;
  const opening=clickNode(descendants(app.element('manualSnapshotList')).find(node=>node.textContent==='Open 2026-09 snapshot')); await tick();
  await clickNode(old); pending.resolve(response({ok:true,snapshot:pagedSavedSnapshot()})); await opening; await tick();
  assert.equal(savedFilterControls(app).inputs[0].value,''); assert.ok(savedDayButtons(app).every(node=>node['aria-pressed']==='false'));
  assert.match(savedPageControls(app).summary.textContent,/Page 1 of 3/); assert.match(app.element('manualSnapshotStatus').textContent,/Saved manual snapshot loaded/);
});

test('chart selection cannot make globally duplicate saved IDs actionable or enable disabled current reads', async () => {
  for(const disabled of [false,true]) {
    const snapshot=pagedSavedSnapshot(); if(!disabled)snapshot.visits[1].id='100';
    const app=connectedWorkspace({history:savedHistory(snapshot),...(disabled?{enabledReads:['GetPatientDemographics']}:{})}); await openSavedHistory(app);
    inputSavedFilter(savedFilterControls(app).inputs[1],'100'); await clickNode(savedDay(app,'2026-09-01'));
    assert.equal(savedTableRows(app).length,1); assert.equal(currentVisitButtons(app).length,0); assert.equal(currentVisitCalls(app).length,0);
  }
});

test('chart-filtered current reads retain exact identity and chart controls stay usable after local paging', async () => {
  const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot()),patientVisit:(_path,options)=>response(currentVisitSource(JSON.parse(options.body)))});
  await openSavedHistory(app); const day=savedDay(app,'2026-09-01'); await clickNode(day); await clickNode(savedPageControls(app).next);
  await clickNode(currentVisitButtons(app)[0]); await tick();
  assert.deepEqual(JSON.parse(currentVisitCalls(app)[0].options.body),{visitId:'120',patientId:'5',officeId:'123'});
  await clickNode(day); assert.equal(day['aria-pressed'],'false'); assert.doesNotMatch(nodeText(app.element('manualSnapshotDetails')),/Current HHA visit evidence/);
  assert.match(savedPageControls(app).summary.textContent,/Page 1 of 3/);
});

const currentCaregiverButtons = app => descendants(app.element('manualSnapshotDetails')).filter(node => node.tagName === 'BUTTON' && node.textContent === 'Open caregiver read');
const currentCaregiverSource = (input, caregiverId, changes = {}) => {
  const data = currentVisitSource(input);
  return { ...data, records: [{ ...data.records[0], 'Caregiver/ID': caregiverId }], ...changes };
};

test('verified current caregiver selection prepares an exact existing read without changing or fetching source evidence', async () => {
  const snapshot = historySnapshot(), original = JSON.stringify(snapshot);
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'GetVisitInfoV3', 'GetCaregiverDemographics'],
    history: savedHistory(snapshot), patientVisit: (_path, options) => response(currentCaregiverSource(JSON.parse(options.body), '61')) });
  await openSavedHistory(app);
  assert.equal(currentCaregiverButtons(app).length, 0, 'a saved caregiver label alone provides no action');
  await clickNode(currentVisitButtons(app)[0]); await tick();
  const before = nodeText(app.element('manualSnapshotDetails')), calls = app.calls.length;
  for (const id of ['readId', 'readPatient', 'readCaregiver', 'readContract', 'readDate']) app.element(id).value = 'old';
  app.element('readResults').append({textContent:'prior subject'});
  await clickNode(currentCaregiverButtons(app)[0]);
  assert.equal(app.calls.length, calls, 'selection must not fetch, write, enable a read or persist a preference');
  assert.deepEqual(JSON.parse(JSON.stringify(app.events.filter(e => e.type === 'primetime-source-record-selected').at(-1).detail)), {kind:'caregiver',id:'61',officeId:'123'});
  assert.equal(app.element('readOperation').value, 'GetCaregiverDemographics'); assert.equal(app.element('readId').value, '61');
  assert.equal(app.element('readCaregiver').value, '61'); assert.equal(app.element('readOffice').value, '123');
  for (const id of ['readPatient','readContract','readDate']) assert.equal(app.element(id).value, '');
  assert.equal(app.element('readResults').children.length, 0); assert.equal(app.document.activeElement, app.element('readId'));
  assert.equal(app.element('pageTitle').textContent, 'Advanced tools');
  assert.match(app.element('workspaceMessage').textContent, /source evidence.*Choose Read source records/);
  assert.equal(nodeText(app.element('manualSnapshotDetails')), before); assert.equal(JSON.stringify(snapshot), original);
  for (const fn of app.element('readForm').handlers.get('submit')) fn({preventDefault(){}});
  await tick(); await tick();
  assert.deepEqual(JSON.parse(app.calls.filter(c => c.path.endsWith('/workspace/read')).at(-1).options.body), {operation:'GetCaregiverDemographics',id:'61'});
});

test('current caregiver actions require a bounded exact returned string ID and retain unknown states', async () => {
  for (const id of [undefined, null, '', '0', '-1', '01', '61x', '<script>', '2147483648', '99999999999', 61]) {
    const app = connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),id))});
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    assert.equal(currentCaregiverButtons(app).length,0,String(id));
    assert.match(nodeText(app.element('manualSnapshotDetails')),/Current source caregiver ID unavailable/);
    assert.equal(app.calls.some(c=>c.path.endsWith('/workspace/read')),false);
  }
  const app = connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),'2147483647'))});
  await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick(); await clickNode(currentCaregiverButtons(app)[0]);
  assert.equal(app.element('readId').value,'2147483647');
});

test('current caregiver selection retains the owner read gate and does not imply permission', async () => {
  const app=connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),'61'))});
  await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
  const count=app.calls.length; await clickNode(currentCaregiverButtons(app)[0]);
  assert.equal(app.calls.length,count); assert.equal(app.element('readId').value,'61');
  assert.match(app.element('workspaceMessage').textContent,/requires owner enablement after entitlement review/);
  assert.equal(app.calls.some(c=>c.path.endsWith('/workspace/read')||c.path.endsWith('/workspace/settings')&&c.options.method==='POST'),false);
});

test('a same-visit refresh immediately invalidates the former caregiver action through pending, failure and reassignment', async () => {
  for(const failure of [false,true]) {
    const pending=deferred(); let hold=false;
    const app=connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>hold?pending.promise:response(currentCaregiverSource(JSON.parse(options.body),'61'))});
    await openSavedHistory(app); const visit=currentVisitButtons(app)[0]; await clickNode(visit); await tick();
    const old=currentCaregiverButtons(app)[0]; hold=true; const reading=clickNode(visit); await tick();
    assert.equal(currentCaregiverButtons(app).length,0); const calls=app.calls.length,events=app.events.length;
    await clickNode(old); assert.equal(app.calls.length,calls); assert.equal(app.events.length,events);
    pending.resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'62')));
    await reading; await tick();
    const after=app.events.length; await clickNode(old); assert.equal(app.events.length,after);
    if(failure) {assert.equal(currentCaregiverButtons(app).length,0); assert.match(app.element('manualSnapshotStatus').textContent,/patient office mismatch/);}
    else {await clickNode(currentCaregiverButtons(app)[0]); assert.equal(app.element('readId').value,'62');}
  }
});

test('detached current caregiver actions cannot survive saved filters, paging, patient/version, source, office/policy or session changes', async () => {
  for(const change of ['day','date','id','text','clear','page','version','patient','source','office','policy','demo','session']) {
    const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot()),patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),'61'))});
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    const old=currentCaregiverButtons(app)[0], controls=savedFilterControls(app);
    if(change==='day') await clickNode(savedDay(app,'2026-09-02'));
    if(change==='date') inputSavedFilter(controls.inputs[0],'2026-09-02');
    if(change==='id') inputSavedFilter(controls.inputs[1],'101');
    if(change==='text') inputSavedFilter(controls.inputs[2],'not present');
    if(change==='clear') await clickNode(controls.reset);
    if(change==='page') await clickNode(savedPageControls(app).next);
    if(change==='version') await clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot'));
    if(change==='patient') {app.element('manualPatientId').value='99';for(const fn of app.element('manualPatientId').handlers.get('input'))fn(new Event('input'));}
    if(change==='source') {app.element('dashboardOverviewDate').value='2026-10-09';for(const fn of app.element('dashboardOverviewDate').handlers.get('change'))fn(new Event('change'));}
    if(change==='office'||change==='policy')app.window.primetimeDataMode.observeScope({revision:2,officeId:change==='office'?'999':'123',officeTimezone:'America/Chicago'});
    if(change==='demo')app.window.primetimeDataMode.setMode('demo'); if(change==='session')app.dispatch('primetime-signed-out');
    await tick(); await tick();
    const before={calls:app.calls.length,events:app.events.length,id:app.element('readId').value,message:app.element('workspaceMessage').textContent,page:app.element('pageTitle').textContent};
    await clickNode(old); assert.deepEqual({calls:app.calls.length,events:app.events.length,id:app.element('readId').value,message:app.element('workspaceMessage').textContent,page:app.element('pageTitle').textContent},before,change);
    assert.equal(currentCaregiverButtons(app).length,0,change);
  }
});

test('unverified current visit responses never expose a caregiver action', async () => {
  for(const changes of [
    {operation:'GetVisitInfoV2'}, {source:'manual_snapshot'}, {interpretation:'validated'}, {truncated:true},
    {scope:{visitId:'11',patientId:'99',officeId:'123'}},
    {records:[{ID:'12','Patient/ID':'5','Caregiver/ID':'61'}]},
    {records:[{ID:'11','Patient/ID':'99','Caregiver/ID':'61'}]},
    {records:[{ID:'11','Patient/ID':'5','Caregiver/ID':'61'},{ID:'11','Patient/ID':'5','Caregiver/ID':'62'}]}
  ]) {
    const app=connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),'61',changes))});
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    assert.equal(currentCaregiverButtons(app).length,0); assert.match(app.element('manualSnapshotStatus').textContent,/could not be verified/);
  }
});

test('only the latest same-visit request can provide a caregiver action after late success or error', async () => {
  for(const failure of [false,true]) {
    const pending=[deferred(),deferred()]; let index=0;
    const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>pending[index++].promise});
    await openSavedHistory(app); const visit=currentVisitButtons(app)[0];
    const first=clickNode(visit); await tick(); const second=clickNode(visit); await tick();
    pending[1].resolve(response(currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'62'))); await second; await tick();
    const control=currentCaregiverButtons(app)[0],text=nodeText(app.element('manualSnapshotDetails')),status=app.element('manualSnapshotStatus').textContent;
    pending[0].resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61')));
    await first; await tick();
    assert.equal(currentCaregiverButtons(app)[0],control); assert.equal(nodeText(app.element('manualSnapshotDetails')),text); assert.equal(app.element('manualSnapshotStatus').textContent,status);
    await clickNode(control); assert.equal(app.element('readId').value,'62');
  }
});

test('a detached caregiver action cannot interrupt a pending saved-version load', async () => {
  const pending=deferred(); let hold=false;
  const app=connectedWorkspace({history:path=>hold&&new URL(path,'https://fixture.test').searchParams.has('id')?pending.promise:savedHistory()(path),
    patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),'61'))});
  await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
  const old=currentCaregiverButtons(app)[0]; hold=true;
  const opening=clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot')); await tick();
  const calls=app.calls.length,events=app.events.length; await clickNode(old);
  assert.equal(app.calls.length,calls); assert.equal(app.events.length,events);
  pending.resolve(response({ok:true,snapshot:historySnapshot()})); await opening; await tick();
  assert.equal(currentCaregiverButtons(app).length,0); assert.match(app.element('manualSnapshotStatus').textContent,/Saved manual snapshot loaded/);
});

const currentSourceGroups = app => descendants(app.element('manualSnapshotDetails')).filter(node => node.className === 'current-visit-group');
const groupSourceValues = group => descendants(group).filter(node => node.tagName === 'DD').map(node => node.textContent);
const currentRawFields = app => {
  const dl=descendants(app.element('manualSnapshotDetails')).find(node=>node.className==='current-visit-fields');
  return dl ? Object.fromEntries(dl.children.filter(node=>node.tagName==='DT').map((node,index)=>[node.textContent,dl.children[index*2+1].textContent])) : {};
};

test('current source groups map exact pairs with accessible sections and retain all raw fields and saved evidence', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');
  Object.assign(data.records[0],{ScheduleStartTime:'2300',ScheduleEndTime:'0100',VisitStartTime:'2026-11-01T01:17:00-05:00',VisitEndTime:'2026-11-01T01:12:00-06:00',EVVStartTime:'source EVV start',EVVEndTime:'source EVV end',TimeZone:'America/Chicago',ExtraSourceField:'retained'});
  const original=JSON.stringify(data), app=connectedWorkspace({history:savedHistory(),patientVisit:()=>response(data)});
  await openSavedHistory(app); assert.equal(currentSourceGroups(app).length,0);
  const cells=savedCells(app), chart=descendants(app.element('manualSnapshotDetails')).filter(n=>n.tagName==='PROGRESS').map(n=>n.value);
  await clickNode(currentVisitButtons(app)[0]); await tick();
  const groups=currentSourceGroups(app);
  assert.deepEqual(groups.map(g=>g.children[0].textContent),['Schedule','Actual','EVV']);
  assert.deepEqual(groups.map(groupSourceValues),[['2300','0100'],['2026-11-01T01:17:00-05:00','2026-11-01T01:12:00-06:00'],['source EVV start','source EVV end']]);
  for(const group of groups) {
    assert.equal(group.tagName,'SECTION'); assert.equal(group.children[0].tagName,'H4');
    assert.equal(group['aria-labelledby'],group.children[0].id); assert.ok(group.children[0].id);
    assert.deepEqual(descendants(group).filter(n=>n.tagName==='DT').map(n=>n.textContent),['Start','End']);
  }
  assert.deepEqual(currentRawFields(app),Object.fromEntries(Object.entries(data.records[0]).map(([k,v])=>[k,v===null?'Not supplied / unknown':v===''?'Empty source value':String(v)])));
  assert.match(nodeText(app.element('manualSnapshotDetails')),/Source timezone: America\/Chicago\. No time conversion is applied/);
  assert.match(nodeText(app.element('manualSnapshotDetails')),/All returned source fields/);
  assert.deepEqual(savedCells(app),cells); assert.deepEqual(descendants(app.element('manualSnapshotDetails')).filter(n=>n.tagName==='PROGRESS').map(n=>n.value),chart);
  assert.equal(JSON.stringify(data),original); assert.equal(currentVisitCalls(app).length,1);
  assert.equal(app.calls.some(c=>c.path.endsWith('/workspace/read')),false);
  assert.equal(currentCaregiverButtons(app).length,1);
});

test('current source groups distinguish absent/null, empty, whitespace and numeric/string zero without inventing raw keys', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');
  Object.assign(data.records[0],{ScheduleStartTime:null,ScheduleEndTime:'',VisitStartTime:0,VisitEndTime:'0',EVVStartTime:'  ',TimeZone:''});
  delete data.records[0].EVVEndTime;
  const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>response(data)});
  await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
  assert.deepEqual(currentSourceGroups(app).map(groupSourceValues),[['Not supplied / unknown','Empty source value'],['0','0'],['  ','Not supplied / unknown']]);
  const raw=currentRawFields(app); assert.equal(raw.ScheduleStartTime,'Not supplied / unknown'); assert.equal(raw.ScheduleEndTime,'Empty source value');
  assert.equal(raw.VisitStartTime,'0'); assert.equal(raw.VisitEndTime,'0'); assert.equal(raw.EVVStartTime,'  '); assert.equal(Object.hasOwn(raw,'EVVEndTime'),false);
  assert.equal(raw.TimeZone,'Empty source value');
  assert.match(nodeText(app.element('manualSnapshotDetails')),/Source timezone: Empty source value/);
});

test('source groups preserve unparseable and markup-like values and unknown timezone without conversion or status inference', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');
  Object.assign(data.records[0],{ScheduleStartTime:'<img src=x onerror=alert(1)>',ScheduleEndTime:'overnight source text',VisitStartTime:'not a parsed date',VisitEndTime:'',EVVStartTime:'0',EVVEndTime:null});
  const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>response(data)});
  await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
  assert.deepEqual(currentSourceGroups(app).map(groupSourceValues),[['<img src=x onerror=alert(1)>','overnight source text'],['not a parsed date','Empty source value'],['0','Not supplied / unknown']]);
  assert.equal(currentRawFields(app).ScheduleStartTime,'<img src=x onerror=alert(1)>');
  assert.equal(descendants(app.element('manualSnapshotDetails')).some(n=>n.tagName==='IMG'),false);
  assert.match(nodeText(app.element('manualSnapshotDetails')),/Source timezone: Not supplied \/ unknown/);
  assert.ok(currentSourceGroups(app).every(g=>descendants(g).filter(n=>n.tagName==='DD').length===2));
});

test('a current-visit refresh removes source groups while pending and only restores a successful current response', async () => {
  for(const failure of [false,true]) {
    const pending=deferred(); let hold=false;
    const source=(input,value)=>{const data=currentCaregiverSource(input,'61');data.records[0].VisitStartTime=value;return data;};
    const app=connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>hold?pending.promise:response(source(JSON.parse(options.body),'original raw time'))});
    await openSavedHistory(app); const visit=currentVisitButtons(app)[0]; await clickNode(visit); await tick();
    assert.equal(currentSourceGroups(app).length,3); hold=true; const reading=clickNode(visit); await tick();
    assert.equal(currentSourceGroups(app).length,0); assert.deepEqual(currentRawFields(app),{});
    pending.resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:source({visitId:'11',patientId:'5',officeId:'123'},'refreshed raw time')));
    await reading; await tick();
    if(failure) {assert.equal(currentSourceGroups(app).length,0); assert.deepEqual(currentRawFields(app),{});}
    else {assert.equal(groupSourceValues(currentSourceGroups(app)[1])[0],'refreshed raw time'); assert.equal(currentCaregiverButtons(app).length,1);}
  }
});

test('source groups and raw fields cannot return from a late read after saved or live context changes', async () => {
  for(const change of ['day','page','version','patient','source','office','policy','demo','session']) for(const failure of [false,true]) {
    const pending=deferred();
    const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot()),patientVisit:()=>pending.promise});
    await openSavedHistory(app); const reading=clickNode(currentVisitButtons(app)[0]); await tick();
    if(change==='day')await clickNode(savedDay(app,'2026-09-02'));
    if(change==='page')await clickNode(savedPageControls(app).next);
    if(change==='version')await clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot'));
    if(change==='patient'){app.element('manualPatientId').value='99';for(const fn of app.element('manualPatientId').handlers.get('input'))fn(new Event('input'));}
    if(change==='source'){app.element('dashboardOverviewDate').value='2026-10-09';for(const fn of app.element('dashboardOverviewDate').handlers.get('change'))fn(new Event('change'));}
    if(change==='office'||change==='policy')app.window.primetimeDataMode.observeScope({revision:2,officeId:change==='office'?'999':'123',officeTimezone:'America/Chicago'});
    if(change==='demo')app.window.primetimeDataMode.setMode('demo');if(change==='session')app.dispatch('primetime-signed-out');
    await tick();await tick();const status=app.element('manualSnapshotStatus').textContent;
    pending.resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:currentCaregiverSource({visitId:'100',patientId:'5',officeId:'123'},'61')));
    await reading;await tick();
    assert.equal(currentSourceGroups(app).length,0,change);assert.deepEqual(currentRawFields(app),{},change);assert.equal(app.element('manualSnapshotStatus').textContent,status,change);
  }
});

test('out-of-order current responses cannot replace the latest grouped or raw source values', async () => {
  for(const failure of [false,true]) {
    const pending=[deferred(),deferred()];let index=0;
    const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>pending[index++].promise});
    await openSavedHistory(app);const visit=currentVisitButtons(app)[0],first=clickNode(visit);await tick();const second=clickNode(visit);await tick();
    const source=value=>{const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');data.records[0].ScheduleStartTime=value;return data;};
    pending[1].resolve(response(source('latest source value')));await second;await tick();
    const raw=currentRawFields(app),groups=currentSourceGroups(app).map(groupSourceValues);
    pending[0].resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:source('older source value')));await first;await tick();
    assert.deepEqual(currentRawFields(app),raw);assert.deepEqual(currentSourceGroups(app).map(groupSourceValues),groups);
    assert.equal(groups[0][0],'latest source value');
  }
});

const currentRawDisclosures = app => descendants(app.element('manualSnapshotDetails')).filter(n=>n.className==='current-source-fields');

test('current raw evidence uses a closed native disclosure with exact returned-field count and values', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');
  Object.assign(data.records[0],{ExtraSourceField:'retained',ZeroSourceField:0,EmptySourceField:'',UnknownSourceField:null});
  const original=JSON.stringify(data),app=connectedWorkspace({history:savedHistory(),patientVisit:()=>response(data)});
  await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();
  const details=currentRawDisclosures(app)[0],summary=details.children[0];
  assert.equal(details.tagName,'DETAILS');assert.notEqual(details.open,true);
  assert.equal(summary.tagName,'SUMMARY');assert.equal(summary.textContent,'All returned source fields ('+Object.keys(data.records[0]).length+')');
  assert.equal(details.children[1].className,'current-visit-fields');
  assert.equal(Object.keys(currentRawFields(app)).length,Object.keys(data.records[0]).length);
  assert.equal(currentRawFields(app).ExtraSourceField,'retained');assert.equal(currentRawFields(app).ZeroSourceField,'0');
  assert.equal(currentRawFields(app).EmptySourceField,'Empty source value');assert.equal(currentRawFields(app).UnknownSourceField,'Not supplied / unknown');
  assert.equal(JSON.stringify(data),original);assert.equal(currentSourceGroups(app).length,3);
  assert.equal(currentVisitCalls(app).length,1);assert.equal(app.calls.some(c=>c.path.endsWith('/workspace/read')),false);
});

test('caregiver navigation precedes the raw disclosure and retains explicit selection and unknown states', async () => {
  for(const caregiver of ['61',null]) {
    const app=connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),caregiver))});
    await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();
    const details=currentRawDisclosures(app)[0],panel=descendants(app.element('manualSnapshotDetails')).find(n=>n.children?.includes(details));
    const navigation=caregiver?currentCaregiverButtons(app)[0]:panel.children.find(n=>n.textContent==='Current source caregiver ID unavailable.');
    assert.ok(panel.children.indexOf(navigation)<panel.children.indexOf(details));
    if(caregiver) {
      const count=app.calls.length;await clickNode(navigation);assert.equal(app.calls.length,count);
      assert.equal(app.element('readId').value,'61');assert.equal(app.document.activeElement,app.element('readId'));
      assert.match(app.element('workspaceMessage').textContent,/requires owner enablement/);
    } else assert.equal(currentCaregiverButtons(app).length,0);
    assert.notEqual(details.open,true);
  }
});

test('refresh clears expanded raw evidence while pending and resets a successful disclosure and its count', async () => {
  for(const failure of [false,true]) {
    const pending=deferred();let hold=false;
    const app=connectedWorkspace({history:savedHistory(),patientVisit:(_path,options)=>hold?pending.promise:response(currentCaregiverSource(JSON.parse(options.body),'61'))});
    await openSavedHistory(app);const visit=currentVisitButtons(app)[0];await clickNode(visit);await tick();
    const old=currentRawDisclosures(app)[0];old.open=true;hold=true;
    const reading=clickNode(visit);await tick();assert.equal(currentRawDisclosures(app).length,0);
    const fresh=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');Object.assign(fresh.records[0],{NewField:'new source value',AnotherField:''});
    pending.resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:fresh));await reading;await tick();
    if(failure)assert.equal(currentRawDisclosures(app).length,0);
    else {
      const current=currentRawDisclosures(app)[0];assert.notEqual(current,old);assert.notEqual(current.open,true);
      assert.equal(current.children[0].textContent,'All returned source fields ('+Object.keys(fresh.records[0]).length+')');
      assert.equal(currentRawFields(app).NewField,'new source value');assert.equal(currentRawFields(app).AnotherField,'Empty source value');
    }
  }
});

test('expanded current disclosures and their source navigation cannot survive scope changes', async () => {
  for(const change of ['filter','page','version','patient','office','policy','demo','session']) {
    const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot()),patientVisit:(_path,options)=>response(currentCaregiverSource(JSON.parse(options.body),'61'))});
    await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();
    const old=currentRawDisclosures(app)[0],navigation=currentCaregiverButtons(app)[0];old.open=true;
    if(change==='filter')inputSavedFilter(savedFilterControls(app).inputs[2],'not present');
    if(change==='page')await clickNode(savedPageControls(app).next);
    if(change==='version')await clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot'));
    if(change==='patient'){app.element('manualPatientId').value='99';for(const fn of app.element('manualPatientId').handlers.get('input'))fn(new Event('input'));}
    if(change==='office'||change==='policy')app.window.primetimeDataMode.observeScope({revision:2,officeId:change==='office'?'999':'123',officeTimezone:'America/Chicago'});
    if(change==='demo')app.window.primetimeDataMode.setMode('demo');if(change==='session')app.dispatch('primetime-signed-out');
    await tick();await tick();assert.equal(currentRawDisclosures(app).length,0,change);
    const calls=app.calls.length,events=app.events.length,id=app.element('readId').value;await clickNode(navigation);
    assert.equal(app.calls.length,calls,change);assert.equal(app.events.length,events,change);assert.equal(app.element('readId').value,id,change);
  }
});

const currentFetchAges = app => descendants(app.element('manualSnapshotDetails')).filter(n=>n.className==='source-metadata current-fetch-age' && !n.hidden);
function deviceClock(app, initial) {
  const clock = { now: Date.parse(initial) };
  app.context.Date = class extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  };
  return { set(value) { clock.now = typeof value === 'number' ? value : Date.parse(value); }, run() { for(const {callback} of [...app.intervals.values()])callback(); } };
}

// Isolate the current-visit timer; live-page timer ownership is tested separately below.
const currentAgeWorkspace = options => connectedWorkspace({ preview: date => ({ ...livePreview(date), fetchedAt: null }), ...options });

test('current fetch age advances locally with explicit device-clock scope and unchanged source evidence', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');data.fetchedAt='2026-10-19T18:18:00-05:00';
  const original=JSON.stringify(data),app=currentAgeWorkspace({history:savedHistory(),patientVisit:()=>response(data)});
  const clock=deviceClock(app,'2026-10-19T23:18:30Z');await openSavedHistory(app);
  const cells=savedCells(app);await clickNode(currentVisitButtons(app)[0]);await tick();
  const age=currentFetchAges(app)[0],raw=currentRawFields(app),focus=app.document.activeElement;
  assert.match(age.textContent,/Approximate fetch age: less than 1 min/);assert.equal(age['aria-live'],'off');assert.equal(age.role,undefined);
  assert.match(age.textContent,/Uses this device clock.*locally each minute.*do not fetch source records/);
  assert.match(nodeText(app.element('manualSnapshotDetails')),/fetched 2026-10-19T18:18:00-05:00/);
  assert.equal(app.intervals.size,1);assert.equal([...app.intervals.values()][0].delay,60_000);
  const calls=app.calls.length,events=app.events.length,status=app.element('manualSnapshotStatus').textContent;
  let writes=0;app.window.localStorage.setItem=app.window.sessionStorage.setItem=()=>{writes++;};
  for(const [now,expected] of [['2026-10-19T23:19:00Z','1 min'],['2026-10-20T00:19:00Z','1 h 1 min'],['2026-10-21T01:20:00Z','1 d 2 h 2 min']]) {
    clock.set(now);clock.run();assert.ok(age.textContent.startsWith('Approximate fetch age: '+expected+'.'));
  }
  assert.equal(app.calls.length,calls);assert.equal(app.events.length,events);assert.equal(writes,0);
  assert.equal(app.document.activeElement,focus);assert.equal(app.element('manualSnapshotStatus').textContent,status);
  assert.deepEqual(savedCells(app),cells);assert.deepEqual(currentRawFields(app),raw);assert.equal(JSON.stringify(data),original);
  assert.notEqual(currentRawDisclosures(app)[0].open,true);
});

test('missing, malformed and ambiguous fetch timestamps stay unknown without a timer or source-time substitution', async () => {
  for(const fetchedAt of [undefined,null,'','not a timestamp','2026-10-19T23:18:00','2026-02-31T23:18:00Z',0]) {
    const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');data.fetchedAt=fetchedAt;
    data.records[0].ScheduleStartTime='2026-10-19T23:18:00Z';
    const app=currentAgeWorkspace({history:savedHistory(),patientVisit:()=>response(data)});deviceClock(app,'2026-10-19T23:19:00Z');
    await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();
    assert.match(currentFetchAges(app)[0].textContent,/unavailable \(missing or invalid fetch timestamp\)/);
    assert.equal(app.intervals.size,0);assert.equal(currentRawFields(app).ScheduleStartTime,'2026-10-19T23:18:00Z');
    assert.equal(currentVisitCalls(app).length,1);
  }
});

test('future fetches and invalid or changed device clocks are explicit and recover without refetching', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');data.fetchedAt='2026-10-19T23:18:00Z';
  const app=currentAgeWorkspace({history:savedHistory(),patientVisit:()=>response(data)}),clock=deviceClock(app,'2026-10-19T23:17:59Z');
  await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();const age=currentFetchAges(app)[0],calls=app.calls.length;
  assert.match(age.textContent,/unavailable \(fetch timestamp is ahead of this device clock\)/);
  clock.set(NaN);clock.run();assert.match(age.textContent,/unavailable \(invalid device clock\)/);
  clock.set('2026-10-19T23:18:00Z');clock.run();assert.match(age.textContent,/less than 1 min/);
  clock.set('2026-10-19T23:20:00Z');clock.run();assert.match(age.textContent,/fetch age: 2 min/);
  clock.set('2026-10-19T23:17:00Z');clock.run();assert.match(age.textContent,/ahead of this device clock/);
  assert.equal(app.calls.length,calls);assert.equal(app.intervals.size,1);
});

test('pending and failed current refreshes cancel the age timer and a success owns a new timer', async () => {
  for(const failure of [false,true]) {
    const pending=deferred();let hold=false;
    const source=at=>({...currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61'),fetchedAt:at});
    const app=currentAgeWorkspace({history:savedHistory(),patientVisit:()=>hold?pending.promise:response(source('2026-10-19T23:18:00Z'))});
    const clock=deviceClock(app,'2026-10-19T23:20:00Z');await openSavedHistory(app);const visit=currentVisitButtons(app)[0];
    await clickNode(visit);await tick();const old=currentFetchAges(app)[0],lateTick=[...app.intervals.values()][0].callback;hold=true;
    const reading=clickNode(visit);await tick();assert.equal(currentFetchAges(app).length,0);assert.equal(app.intervals.size,0);assert.equal(old.hidden,true);
    const text=old.textContent;clock.set('2026-10-19T23:21:00Z');lateTick();assert.equal(old.textContent,text);
    pending.resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:source('2026-10-19T23:20:00Z')));await reading;await tick();
    if(failure){assert.equal(currentFetchAges(app).length,0);assert.equal(app.intervals.size,0);}
    else {const fresh=currentFetchAges(app)[0];assert.notEqual(fresh,old);assert.match(fresh.textContent,/fetch age: 1 min/);assert.equal(app.intervals.size,1);lateTick();assert.equal(app.intervals.size,1);}
  }
});

test('fetch-age timers and detached ticks clear across all saved and live context changes', async () => {
  for(const change of ['filter','page','version','patient','source','office','policy','demo','session','history','import']) {
    const app=currentAgeWorkspace({history:savedHistory(pagedSavedSnapshot()),patientVisit:(_path,options)=>response({...currentCaregiverSource(JSON.parse(options.body),'61'),fetchedAt:'2026-10-19T23:18:00Z'})});
    const clock=deviceClock(app,'2026-10-19T23:20:00Z');await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();
    const old=currentFetchAges(app)[0],lateTick=[...app.intervals.values()][0].callback;
    if(change==='filter')inputSavedFilter(savedFilterControls(app).inputs[2],'not present');
    if(change==='page')await clickNode(savedPageControls(app).next);
    if(change==='version')await clickNode(descendants(app.element('manualSnapshotList')).find(n=>n.textContent==='Open 2026-09 snapshot'));
    if(change==='patient'){app.element('manualPatientId').value='99';for(const fn of app.element('manualPatientId').handlers.get('input'))fn(new Event('input'));}
    if(change==='source'){app.element('dashboardOverviewDate').value='2026-10-09';for(const fn of app.element('dashboardOverviewDate').handlers.get('change'))fn(new Event('change'));}
    if(change==='office'||change==='policy')app.window.primetimeDataMode.observeScope({revision:2,officeId:change==='office'?'999':'123',officeTimezone:'America/Chicago'});
    if(change==='demo')app.window.primetimeDataMode.setMode('demo');if(change==='session')app.dispatch('primetime-signed-out');
    if(change==='history')for(const fn of app.element('manualPatientForm').handlers.get('submit'))fn(new Event('submit'));
    if(change==='import'){app.element('manualSnapshotPayload').value='invalid fixture JSON';for(const fn of app.element('manualSnapshotForm').handlers.get('submit'))fn(new Event('submit'));}
    await tick();await tick();assert.equal(currentFetchAges(app).length,0,change);assert.equal(app.intervals.size,0,change);assert.equal(old.hidden,true,change);
    const calls=app.calls.length,events=app.events.length,status=app.element('manualSnapshotStatus').textContent,text=old.textContent;
    clock.set('2026-10-19T23:22:00Z');lateTick();assert.equal(old.textContent,text,change);assert.equal(app.calls.length,calls,change);assert.equal(app.events.length,events,change);assert.equal(app.element('manualSnapshotStatus').textContent,status,change);
  }
});

test('late same-visit success or error cannot replace or cancel the latest fetch-age timer', async () => {
  for(const failure of [false,true]) {
    const pending=[deferred(),deferred()];let index=0;
    const app=currentAgeWorkspace({history:savedHistory(),patientVisit:()=>pending[index++].promise}),clock=deviceClock(app,'2026-10-19T23:20:00Z');
    await openSavedHistory(app);const visit=currentVisitButtons(app)[0],first=clickNode(visit);await tick();const second=clickNode(visit);await tick();
    const source=at=>({...currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61'),fetchedAt:at});
    pending[1].resolve(response(source('2026-10-19T23:19:00Z')));await second;await tick();const latest=currentFetchAges(app)[0];
    assert.match(latest.textContent,/fetch age: 1 min/);assert.equal(app.intervals.size,1);
    pending[0].resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:source('2026-10-19T23:18:00Z')));await first;await tick();
    assert.equal(currentFetchAges(app)[0],latest);assert.equal(app.intervals.size,1);
    clock.set('2026-10-19T23:21:00Z');clock.run();assert.match(latest.textContent,/fetch age: 2 min/);
  }
});

// Overview reports a whole-scan receipt range; this clock belongs to Visit Preview.
const pageAgeNodes = app => ['dashboardVisitFetchAge'].map(app.element);
function assertPageAgeCleared(app) {
  for (const node of pageAgeNodes(app)) { assert.equal(node.hidden, true); assert.equal(node.textContent, ''); }
}
const agedPage = path => ({ ...numberedSourcePage(path), fetchedAt: '2026-10-19T18:18:00-05:00' });

function automaticAges(app, enabled) {
  const control = app.element('automaticAgeUpdates');
  control.checked = enabled;
  for (const handler of control.handlers.get('change') || []) handler({ target: control });
}

test('shared age control pauses both evidence clocks and resumes original receipts without requests, storage or focus changes', async () => {
  const app = connectedWorkspace({ preview: date => ({ ...livePreview(date), fetchedAt: '2026-10-19T23:18:00Z' }),
    history: savedHistory(), patientVisit: () => response({ ...currentCaregiverSource({ visitId:'11', patientId:'5', officeId:'123' }, '61'), fetchedAt: '2026-10-19T23:19:00Z' }) });
  const clock = deviceClock(app, '2026-10-19T23:20:00Z');
  await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
  const ages = [...pageAgeNodes(app), ...currentFetchAges(app)], raw = currentRawFields(app), saved = savedCells(app);
  const receipt = app.element('dashboardVisitMetadata').textContent, calls = app.calls.length;
  let storage = 0;
  for (const target of [app.window.localStorage, app.window.sessionStorage])
    for (const method of ['getItem', 'setItem', 'removeItem']) target[method] = () => { storage++; };
  const control = app.element('automaticAgeUpdates'); control.focus();
  const detached = [...app.intervals.values()].map(x => x.callback);
  automaticAges(app, false);
  assert.equal(app.intervals.size, 0);
  for (const age of ages) assert.match(age.textContent, /age updates paused/);
  const paused = ages.map(x => x.textContent);
  clock.set('2026-10-19T23:25:00Z'); detached.forEach(fn => fn()); clock.run();
  assert.deepEqual(ages.map(x => x.textContent), paused);
  for (let i = 0; i < 4; i++) {
    automaticAges(app, true); automaticAges(app, true);
    assert.equal(app.intervals.size, 2);
    detached.forEach(fn => fn());
    assert.match(ages[0].textContent, /fetch age: 7 min/);
    assert.match(ages[1].textContent, /fetch age: 6 min/);
    automaticAges(app, false); automaticAges(app, false);
    assert.equal(app.intervals.size, 0);
  }
  assert.equal(app.calls.length, calls); assert.equal(storage, 0);
  assert.equal(app.document.activeElement, control);
  assert.deepEqual(currentRawFields(app), raw); assert.deepEqual(savedCells(app), saved);
  assert.equal(app.element('dashboardVisitMetadata').textContent, receipt);
  automaticAges(app, true);
  clock.set('2026-10-19T23:27:00Z');
  detached.forEach(fn => fn());
  assert.match(ages[0].textContent, /fetch age: 7 min/);
  clock.run();
  assert.match(ages[0].textContent, /fetch age: 9 min/);
  inputSavedFilter(savedFilterControls(app).inputs[2], 'not present');
  assert.equal(currentFetchAges(app).length, 0); assert.equal(app.intervals.size, 1);
});

test('new page and current-visit reads while paused show an initial age without restarting timers', async () => {
  const app = connectedWorkspace({ preview: date => ({ ...livePreview(date), fetchedAt: '2026-10-19T23:18:00Z' }),
    history: savedHistory(), patientVisit: () => response({ ...currentCaregiverSource({ visitId:'11', patientId:'5', officeId:'123' }, '61'), fetchedAt: '2026-10-19T23:19:00Z' }) });
  const clock = deviceClock(app, '2026-10-19T23:20:00Z');
  await openSavedHistory(app); automaticAges(app, false);
  await clickNode(currentVisitButtons(app)[0]); await tick();
  assert.match(currentFetchAges(app)[0].textContent, /fetch age: 1 min.*paused/);
  clock.set('2026-10-19T23:23:00Z');
  await clickNode(currentVisitButtons(app)[0]); await tick();
  assert.match(currentFetchAges(app)[0].textContent, /fetch age: 4 min.*paused/);
  await app.click('dashboardVisitRefresh'); await tick(); await tick();
  assert.equal(app.intervals.size, 0);
  for (const age of pageAgeNodes(app)) assert.match(age.textContent, /fetch age: 5 min.*paused/);
  automaticAges(app, true); assert.equal(app.intervals.size, 1);
});

test('paused live ages clear immediately on clearing, date, office, policy, mode and session changes', async () => {
  for (const change of ['clear', 'date', 'office', 'policy', 'demo', 'session']) {
    const app = harness({ storedDataMode:null, metadata:liveMetadata, fetchSource:path => response(agedPage(path)) });
    const clock = deviceClock(app, '2026-10-19T23:20:00Z');
    installDashboard(app); await app.signIn(); await tick(); await tick();
    app.window.primetimeDataMode.observeScope({ revision:1, officeId:'123', officeTimezone:'America/Chicago' });
    const late = [...app.intervals.values()][0].callback;
    automaticAges(app, false);
    if (change === 'clear') await app.click('dashboardOverviewClear');
    if (change === 'date') { app.element('dashboardOverviewDate').value = '2026-10-09'; for (const fn of app.element('dashboardOverviewDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'office' || change === 'policy') app.window.primetimeDataMode.observeScope({ revision:2, officeId:change === 'office' ? '999' : '123', officeTimezone:'America/Chicago' });
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'session') app.dispatch('primetime-signed-out');
    assertPageAgeCleared(app); assert.equal(app.intervals.size, 0);
    const calls = app.calls.length;
    clock.set('2026-10-19T23:25:00Z'); late();
    assertPageAgeCleared(app); assert.equal(app.calls.length, calls);
  }
});

test('paused current evidence clears on saved navigation and cannot be restored by resuming or detached ticks', async () => {
  for (const change of ['filter', 'page', 'version', 'patient', 'office', 'policy', 'session']) {
    const app = currentAgeWorkspace({ history:savedHistory(pagedSavedSnapshot()), patientVisit:(_path, options) => response({ ...currentCaregiverSource(JSON.parse(options.body), '61'), fetchedAt:'2026-10-19T23:18:00Z' }) });
    deviceClock(app, '2026-10-19T23:20:00Z');
    await openSavedHistory(app); await clickNode(currentVisitButtons(app)[0]); await tick();
    const old = currentFetchAges(app)[0], late = [...app.intervals.values()][0].callback;
    automaticAges(app, false);
    if (change === 'filter') inputSavedFilter(savedFilterControls(app).inputs[2], 'not present');
    if (change === 'page') await clickNode(savedPageControls(app).next);
    if (change === 'version') await clickNode(descendants(app.element('manualSnapshotList')).find(n => n.textContent === 'Open 2026-09 snapshot'));
    if (change === 'patient') { app.element('manualPatientId').value = '99'; for (const fn of app.element('manualPatientId').handlers.get('input')) fn(new Event('input')); }
    if (change === 'office' || change === 'policy') app.window.primetimeDataMode.observeScope({ revision:2, officeId:change === 'office' ? '999' : '123', officeTimezone:'America/Chicago' });
    if (change === 'session') app.dispatch('primetime-signed-out');
    assert.equal(old.hidden, true, change);
    automaticAges(app, true); late();
    assert.equal(currentFetchAges(app).length, 0); assert.equal(app.intervals.size, 0);
  }
});

test('paused unknown and future receipts retain explicit clock semantics and resume without a source-time substitute', async () => {
  for (const receipt of [null, 'invalid', '2026-02-30T00:00:00Z', '2026-10-19T23:30:00Z']) {
    const app = harness({ storedDataMode:null, metadata:liveMetadata, fetchSource:path => response({ ...agedPage(path), fetchedAt:receipt }) });
    const clock = deviceClock(app, '2026-10-19T23:20:00Z');
    installDashboard(app); await app.signIn(); await tick(); await tick();
    automaticAges(app, false); const held = pageAgeNodes(app)[0].textContent, calls = app.calls.length;
    assert.match(held, /unavailable.*paused/);
    clock.set('2026-10-19T23:32:00Z'); clock.run();
    assert.equal(pageAgeNodes(app)[0].textContent, held);
    automaticAges(app, true);
    assert.match(pageAgeNodes(app)[0].textContent, receipt === '2026-10-19T23:30:00Z' ? /fetch age: 2 min/ : /missing or invalid/);
    if (receipt === '2026-10-19T23:30:00Z') {
      clock.set(NaN); clock.run(); automaticAges(app, false);
      assert.match(pageAgeNodes(app)[0].textContent, /invalid device clock.*paused/);
      clock.set('2026-10-19T23:33:00Z'); automaticAges(app, true);
      assert.match(pageAgeNodes(app)[0].textContent, /fetch age: 3 min/);
    } else assert.equal(app.intervals.size, 0);
    assert.equal(app.calls.length, calls);
  }
});

test('age control is session-only, hidden in Demo, and rejects signed-out or Demo activation', async () => {
  const app = harness({ storedDataMode:null });
  assert.equal(app.element('fetchAgeControl').hidden, true);
  automaticAges(app, false); assert.equal(app.element('automaticAgeUpdates').checked, true);
  await app.signIn(); automaticAges(app, false);
  assert.equal(app.element('fetchAgeControl').hidden, false);
  app.window.primetimeDataMode.setMode('demo');
  assert.equal(app.element('fetchAgeControl').hidden, true);
  automaticAges(app, true); assert.equal(app.element('automaticAgeUpdates').checked, false);
  app.window.primetimeDataMode.setMode('live');
  assert.equal(app.element('automaticAgeUpdates').checked, false);
  app.dispatch('primetime-signed-out');
  assert.equal(app.element('automaticAgeUpdates').checked, true);
  assert.equal(app.element('automaticAgeUpdates').disabled, true);
  assert.equal(harness({ storedDataMode:null }).element('automaticAgeUpdates').checked, true);
});

test('Visit Preview age and Overview scan receipts remain separate without changing facts or focus', async () => {
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: path => response(agedPage(path)) });
  const clock = deviceClock(app, '2026-10-19T23:18:30Z');
  installDashboard(app); await app.signIn(); await tick(); await tick();
  const ages = pageAgeNodes(app), raw = app.element('dashboardVisitMetadata').textContent;
  for (const age of ages) { assert.equal(age.hidden, false); assert.match(age.textContent, /fetch age: less than 1 min/); }
  assert.match(raw, /fetched: 2026-10-19T18:18:00-05:00/);
  assert.match(app.element('dashboardOverviewMetadata').textContent, /searches 2026-10-19T18:18:00-05:00.*not an atomic snapshot/);
  assert.equal(app.intervals.size, 1); assert.equal([...app.intervals.values()][0].delay, 60_000);
  const evidenceIds = ['dashboardVisitRows','dashboardTimeline','dashboardEvidenceChart','dashboardCoverage','dashboardOverviewMetrics','dashboardVisitCompleteness','dashboardVisitScope'];
  const evidence = evidenceIds.map(id => nodeText(app.element(id)));
  const calls = app.calls.length, events = app.events.length, status = app.element('dashboardVisitStatus').textContent;
  app.element('dashboardVisitRefresh').focus(); let writes = 0;
  app.window.localStorage.setItem = app.window.sessionStorage.setItem = () => { writes++; };
  for (const [now, expected] of [['2026-10-19T23:19:00Z','1 min'],['2026-10-20T00:19:00Z','1 h 1 min'],['2026-10-21T01:20:00Z','1 d 2 h 2 min']]) {
    clock.set(now); clock.run();
    assert.match(ages[0].textContent, new RegExp('fetch age: ' + expected + '\\.'));
  }
  assert.equal(app.calls.length,calls); assert.equal(app.events.length,events); assert.equal(writes,0);
  assert.equal(app.document.activeElement,app.element('dashboardVisitRefresh')); assert.equal(app.element('dashboardVisitStatus').textContent,status);
  assert.equal(app.element('dashboardVisitMetadata').textContent,raw); assert.deepEqual(evidenceIds.map(id=>nodeText(app.element(id))),evidence);
  const html = asset('index.html');
  for (const id of ['dashboardOverviewFetchAge','dashboardVisitFetchAge']) assert.match(html,new RegExp(`id=(?:"${id}"|${id})[^>]*aria-live=(?:"off"|off)[^>]*hidden`));
});

test('live-page absent, malformed, impossible or ambiguous receipts never borrow source times or start timers', async () => {
  for (const receipt of [undefined,null,'','invalid','2026-10-19T23:18:00','2026-02-31T23:18:00Z',0]) {
    const app = harness({ storedDataMode:null, metadata:liveMetadata, fetchSource:path=>response({...agedPage(path),fetchedAt:receipt}) });
    deviceClock(app,'2026-10-19T23:19:00Z'); installDashboard(app); await app.signIn(); await tick(); await tick();
    for (const age of pageAgeNodes(app)) { assert.equal(age.hidden,false); assert.match(age.textContent,/unavailable \(missing or invalid fetch timestamp\)/); }
    assert.equal(app.intervals.size,0); assert.match(nodeText(app.element('dashboardVisitRows')),/T08:00:00/);
  }
});

test('live-page future and invalid device clocks recover and move backwards without source reads', async () => {
  const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>response(agedPage(path))});
  const clock=deviceClock(app,'2026-10-19T23:17:59Z');installDashboard(app);await app.signIn();await tick();await tick();
  const calls=app.calls.length;
  for(const [now,pattern] of [[NaN,/invalid device clock/],['2026-10-19T23:18:00Z',/less than 1 min/],['2026-10-19T23:20:00Z',/fetch age: 2 min/],['2026-10-19T23:17:00Z',/ahead of this device clock/]]) {
    clock.set(now);clock.run();for(const age of pageAgeNodes(app))assert.match(age.textContent,pattern);
  }
  assert.equal(app.calls.length,calls);assert.equal(app.intervals.size,1);
});

test('page, refresh and date transitions cancel both age displays immediately and detached ticks cannot cancel their replacement', async () => {
  for(const control of ['dashboardOverviewNext','dashboardVisitNext','dashboardOverviewPrevious','dashboardVisitPrevious','dashboardOverviewRefresh','dashboardVisitRefresh','dashboardOverviewDate','dashboardVisitDate']) {
    const pending=deferred();let hold=false,pendingPath;
    const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>{if(hold){pendingPath=path;return pending.promise;}return response(agedPage(path));}});
    const clock=deviceClock(app,'2026-10-19T23:20:00Z');installDashboard(app);await app.signIn();await tick();await tick();
    if(control.includes('Previous')){await app.click('dashboardVisitNext');await tick();await tick();}
    const late=[...app.intervals.values()][0].callback;hold=true;
    if(control.endsWith('Date')){app.element(control).value='2026-10-09';for(const fn of app.element(control).handlers.get('change'))fn(new Event('change'));}
    else await app.click(control);
    assertPageAgeCleared(app);assert.equal(app.intervals.size,0,control);late();assertPageAgeCleared(app);
    await tick();await tick();pending.resolve(response({...agedPage(pendingPath),fetchedAt:'2026-10-19T23:19:00Z'}));await tick();await tick();
    assert.equal(app.intervals.size,1,control);for(const age of pageAgeNodes(app))assert.match(age.textContent,/fetch age: 1 min/);
    late();assert.equal(app.intervals.size,1,control);clock.set('2026-10-19T23:21:00Z');clock.run();for(const age of pageAgeNodes(app))assert.match(age.textContent,/fetch age: 2 min/);
  }
});

test('failed, blocked, scope-conflict and unverifiable page reads leave age cleared', async () => {
  for(const status of [503,409,423,'malformed']) {
    let fail=false;
    const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>{if(!fail)return response(agedPage(path));const result=response(status==='malformed'?{ok:true,mode:'wrong'}:{ok:false,error:'visit_reads_not_owner_enabled'});result.status=status;result.ok=status==='malformed';return result;}});
    deviceClock(app,'2026-10-19T23:20:00Z');installDashboard(app);await app.signIn();await tick();await tick();
    const late=[...app.intervals.values()][0].callback;fail=true;await app.click('dashboardOverviewNext');await tick();await tick();
    assertPageAgeCleared(app);assert.equal(app.intervals.size,0);late();assertPageAgeCleared(app);
  }
});

test('mode, session, office and policy changes stop page ages before new reads and reject detached updates', async () => {
  for(const change of ['demo','session','office','policy']) {
    const pending=deferred();let hold=false;
    const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>hold?pending.promise:response(agedPage(path))});
    const clock=deviceClock(app,'2026-10-19T23:20:00Z');installDashboard(app);await app.signIn();await tick();await tick();
    app.window.primetimeDataMode.observeScope({revision:1,officeId:'123',officeTimezone:'America/Chicago'});
    const late=[...app.intervals.values()][0].callback;hold=true;
    if(change==='demo')app.window.primetimeDataMode.setMode('demo');
    else if(change==='session')app.dispatch('primetime-signed-out');
    else app.window.primetimeDataMode.observeScope({revision:2,officeId:change==='office'?'999':'123',officeTimezone:'America/Chicago'});
    assertPageAgeCleared(app);assert.equal(app.intervals.size,0);const calls=app.calls.length;
    clock.set('2026-10-19T23:22:00Z');late();assertPageAgeCleared(app);assert.equal(app.calls.length,calls);
  }
});

test('late page success and error cannot replace the latest receipt or timer', async () => {
  for(const failure of [false,true]) {
    const pending=[deferred(),deferred()];let hold=false,index=0;const paths=[];
    const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>{if(!hold)return response(agedPage(path));paths.push(path);return pending[index++].promise;}});
    deviceClock(app,'2026-10-19T23:20:00Z');installDashboard(app);await app.signIn();await tick();await tick();hold=true;
    for(const day of ['2026-10-09','2026-10-08']){app.element('dashboardOverviewDate').value=day;for(const fn of app.element('dashboardOverviewDate').handlers.get('change'))fn(new Event('change'));await tick();}
    pending[1].resolve(response({...agedPage(paths[1]),fetchedAt:'2026-10-19T23:19:00Z'}));await tick();await tick();
    const copy=pageAgeNodes(app)[0].textContent,metadata=app.element('dashboardVisitMetadata').textContent;
    if(failure)pending[0].reject(new Error('old request failed'));else pending[0].resolve(response(agedPage(paths[0])));
    await tick();await tick();assert.equal(app.intervals.size,1);assert.equal(pageAgeNodes(app)[0].textContent,copy);assert.equal(app.element('dashboardVisitMetadata').textContent,metadata);
  }
});

test('page and current-visit timers have independent lifetimes over saved filtering', async () => {
  const app=connectedWorkspace({preview:date=>({...livePreview(date),fetchedAt:'2026-10-19T23:18:00Z'}),history:savedHistory(),patientVisit:()=>response({...currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61'),fetchedAt:'2026-10-19T23:19:00Z'})});
  const clock=deviceClock(app,'2026-10-19T23:20:00Z');await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();
  assert.equal(app.intervals.size,2);const pageText=pageAgeNodes(app)[0].textContent;
  inputSavedFilter(savedFilterControls(app).inputs[2],'not present');assert.equal(currentFetchAges(app).length,0);assert.equal(app.intervals.size,1);
  assert.equal(pageAgeNodes(app)[0].textContent,pageText);clock.set('2026-10-19T23:21:00Z');clock.run();for(const age of pageAgeNodes(app))assert.match(age.textContent,/fetch age: 3 min/);
});

function assertSourcePageCleared(app) {
  assertPageAgeCleared(app);
  for(const id of ['dashboardVisitMetadata','dashboardOverviewMetadata','dashboardVisitCompleteness','dashboardOverviewCompleteness'])assert.equal(app.element(id).textContent,'',id);
  for(const id of ['dashboardVisitRows','dashboardOverviewMetrics','dashboardVisitMetrics','dashboardOverviewExceptions','dashboardCoverage','dashboardAlerts','dashboardTimeline','dashboardEvidenceChart']) {
    assert.match(nodeText(app.element(id)),/Source page cleared/);assert.doesNotMatch(nodeText(app.element(id)),/900001|900002|DEMO-V-/);
  }
  assert.equal(descendants(app.element('dashboardEvidenceChart')).filter(n=>n.tagName==='PROGRESS').length,0);
  for(const prefix of ['dashboardOverview','dashboardVisit']){assert.equal(app.element(prefix+'Clear').disabled,true);assert.equal(app.element(prefix+'Refresh').disabled,false);assert.equal(app.element(prefix+'Next').hidden,true);assert.equal(app.element(prefix+'Previous').hidden,true);}
  assert.match(app.element('dashboardVisitScope').textContent,/No source page loaded/);
  assert.equal(app.element('dataModeBadge').textContent,'Live · no source page');
}

test('explicit clear removes both source views and timers without fetching, changing mode/date or deleting saved data', async () => {
  for(const prefix of ['dashboardOverview','dashboardVisit']) {
    const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>response(agedPage(path))});
    const clock=deviceClock(app,'2026-10-19T23:20:00Z');installDashboard(app);await app.signIn();await tick();await tick();
    const lateTick=[...app.intervals.values()][0].callback,date=app.element('dashboardVisitDate').value,calls=app.calls.length;
    let writes=0;app.window.localStorage.setItem=app.window.sessionStorage.setItem=()=>{writes++;};
    await app.click(prefix+'Clear');assertSourcePageCleared(app);assert.equal(app.intervals.size,0);assert.equal(app.calls.length,calls);assert.equal(writes,0);
    assert.equal(app.window.primetimeDataMode.getMode(),'live');assert.equal(app.element('dashboardVisitDate').value,date);assert.equal(app.element('dashboardOverviewDate').value,date);
    assert.equal(app.document.activeElement,app.element(prefix+'Refresh'));assert.match(nodeText(app.element('dashboardVisitRows')),/Saved calendar imports remain stored separately/);
    const events=app.events.length;clock.set('2026-10-19T23:22:00Z');lateTick();await app.click(prefix+'Clear');
    assert.equal(app.events.length,events);assert.equal(app.calls.length,calls);assertSourcePageCleared(app);
  }
  const html=asset('index.html');for(const prefix of ['dashboardOverview','dashboardVisit'])assert.match(html,new RegExp(`id=(?:"${prefix}Clear"|${prefix}Clear)[^>]*type=(?:"button"|button)[^>]*disabled>Clear source ${prefix === 'dashboardOverview' ? 'data' : 'page'}</button>`));
});

test('clearing a pending page fences its late success/error and leaves an explicit new read in charge', async () => {
  for(const failure of [false,true]) {
    const pending=deferred();let hold=false;
    const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>hold?pending.promise:response(agedPage(path))});
    deviceClock(app,'2026-10-19T23:20:00Z');installDashboard(app);await app.signIn();await tick();await tick();
    await app.click('dashboardVisitNext');await tick();await tick();
    const oldTick=[...app.intervals.values()][0].callback;hold=true;await app.click('dashboardOverviewNext');await tick();
    assert.equal(app.element('dashboardOverviewClear').disabled,false);const calls=app.calls.length;await app.click('dashboardOverviewClear');assertSourcePageCleared(app);
    if(failure)pending.reject(new Error('old source failed'));else pending.resolve(response(agedPage('/primetime/api/views/visits?date='+app.element('dashboardVisitDate').value+'&cursor=page-three')));
    await tick();await tick();assertSourcePageCleared(app);assert.equal(app.calls.length,calls);assert.equal(app.intervals.size,0);
    hold=false;await app.click('dashboardOverviewRefresh');await tick();await tick();
    assert.match(nodeText(app.element('dashboardVisitRows')),/900001/);assert.equal(app.intervals.size,1);oldTick();assert.equal(app.intervals.size,1);
  }
});

test('a pending access-status body cannot start a source read or restore controls after clear', async () => {
  const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>response(agedPage(path))});
  deviceClock(app,'2026-10-19T23:20:00Z');installDashboard(app);await app.signIn();await tick();await tick();
  const body=deferred(),wire=response(liveMetadata),original=app.window.primetimeApiFetch;wire.json=()=>body.promise;let hold=true;
  app.window.primetimeApiFetch=(path,options)=>hold&&path.endsWith('/data/status')?Promise.resolve(wire):original(path,options);
  await app.click('dashboardVisitRefresh');await tick();assert.equal(app.element('dashboardVisitClear').disabled,false);
  await app.click('dashboardVisitClear');const calls=app.calls.length;body.resolve(liveMetadata);await tick();await tick();
  assertSourcePageCleared(app);assert.equal(app.calls.length,calls);assert.equal(app.intervals.size,0);
  hold=false;await app.click('dashboardVisitRefresh');await tick();await tick();assert.equal(app.element('dashboardVisitClear').disabled,false);assert.equal(app.intervals.size,1);
});

test('clear drops cursor history and detached navigation; explicit reread checks access and restarts the first page', async () => {
  const app=connectedWorkspace({preview:date=>({...livePreview(date),nextCursor:'next-page',state:'partial'})});await app.signIn();await tick();await tick();
  await app.click('dashboardVisitNext');await tick();await tick();const old=[...recordButtons(app),...patientDiscoveryButtons(app),...descendants(app.element('dashboardTimeline')).filter(n=>n.textContent==='Saved calendar history')];
  await app.click('dashboardVisitClear');assertSourcePageCleared(app);const calls=app.calls.length,events=app.events.filter(e=>e.type==='primetime-source-record-selected').length;
  for(const button of old)await clickNode(button);await app.click('dashboardVisitPrevious');await app.click('dashboardOverviewNext');
  assert.equal(app.calls.length,calls);assert.equal(app.events.filter(e=>e.type==='primetime-source-record-selected').length,events);
  const metadataCalls=app.calls.filter(c=>c.path.endsWith('/data/status')).length;
  await app.click('dashboardVisitRefresh');await tick();await tick();
  assert.equal(app.calls.filter(c=>c.path.endsWith('/data/status')).length,metadataCalls+1);
  const query=new URL(app.calls.filter(c=>c.path.includes('/views/visits?')).at(-1).path,'https://fixture.test').searchParams;
  assert.equal(query.has('cursor'),false);assert.equal(app.element('dashboardVisitPrevious').hidden,true);assert.equal(app.element('dashboardVisitClear').disabled,false);
});

test('clearing source context can clear source-linked history display without changing the saved capture or issuing a write', async () => {
  const snapshot=pagedSavedSnapshot(),unchanged=JSON.stringify(snapshot),app=connectedWorkspace({history:savedHistory(snapshot)});
  await openSavedHistory(app);assert.ok(savedCells(app).length);const calls=app.calls.length;
  await app.click('dashboardOverviewClear');assertSourcePageCleared(app);assert.equal(app.calls.length,calls);assert.equal(JSON.stringify(snapshot),unchanged);
  assert.equal(app.element('manualPatientId').value,'');assert.equal(app.element('manualSnapshotDetails').children.length,0);
  assert.match(app.element('manualSnapshotStatus').textContent,/Live source context changed/);
});

test('source clear is disabled when signed out or already cleared and hidden in Demo without changing examples', async () => {
  const app=harness({storedDataMode:null,metadata:liveMetadata,fetchSource:path=>response(agedPage(path))});installDashboard(app);
  for(const prefix of ['dashboardOverview','dashboardVisit'])assert.equal(app.element(prefix+'Clear').disabled,true);
  const initialCalls=app.calls.length;await app.click('dashboardVisitClear');assert.equal(app.calls.length,initialCalls);
  await app.signIn();await tick();await tick();assert.equal(app.element('dashboardVisitClear').disabled,false);
  app.window.primetimeDataMode.setMode('demo');const demo=nodeText(app.element('dashboardVisitRows')),calls=app.calls.length;
  for(const prefix of ['dashboardOverview','dashboardVisit']){assert.equal(app.element(prefix+'Clear').hidden,true);assert.equal(app.element(prefix+'Clear').disabled,true);await app.click(prefix+'Clear');}
  assert.equal(nodeText(app.element('dashboardVisitRows')),demo);assert.equal(app.calls.length,calls);
  app.dispatch('primetime-signed-out');assert.equal(app.element('dashboardVisitClear').disabled,true);const signedOutCalls=app.calls.length;await app.click('dashboardOverviewClear');assert.equal(app.calls.length,signedOutCalls);
});

const authorizationButtons = (app, host = 'dashboardTimeline') => descendants(app.element(host)).filter(node => node.textContent === 'Open patient authorizations');
const detailButtons = app => descendants(app.element('readResults')).filter(node => node.textContent === 'Select authorization detail');
const authorizationCalls = app => app.calls.filter(call => call.path.endsWith('/workspace/patient-authorizations'));
const authSource = (input, changes = {}) => ({ ok: true, operation: input.operation, scope: { officeId: input.officeId, patientId: input.patientId }, source: 'hhaexchange', interpretation: 'authorization_limits_unvalidated', fetchedAt: '2026-10-15T19:16:00.000Z', truncated: true, records: [
  { ID: '71', ContractID: '81', ContractName: 'Same synthetic name', StartDate: '2026-10-01', StopDate: '2026-10-31' },
  { ID: '72', ContractID: '82', ContractName: 'Same synthetic name', StartDate: '2026-10-01', StopDate: '2026-10-31' }
], ...changes });
async function submitRead(app) { for (const fn of app.element('readForm').handlers.get('submit')) fn({ preventDefault() {} }); await tick(); await tick(); }
test('operational read errors show only a valid server 429 delay, clear old facts and never retry automatically', async () => {
  for (const [status, retryAfterSeconds, shown] of [[429, 17, true], [429, 86400, true], [429, 0, false], [429, -1, false], [429, '17', false], [429, 1.5, false], [429, Infinity, false], [423, 17, false]]) {
    const app = connectedWorkspace({ read: () => ({ ...response({ ok: false, error: 'vendor_backoff_active', retryAfterSeconds }), ok: false, status }) });
    await app.signIn(); await tick(); await tick();
    app.element('readOperation').value = 'GetVisitInfoV3'; app.element('readId').value = '900001'; app.element('readResults').append({ textContent: 'private-stale-facts' });
    await submitRead(app);
    const message = app.element('workspaceMessage').textContent;
    assert.equal(message.includes('Retry in '), shown);
    if (shown) assert.match(message, new RegExp(`Retry in ${retryAfterSeconds} seconds`));
    assert.doesNotMatch(nodeText(app.element('readResults')), /private-stale-facts/);
    assert.equal(app.calls.filter(call => call.path.endsWith('/workspace/read')).length, 1);
  }
});
async function startAuthorizationRead(app, host) { await clickNode(authorizationButtons(app, host)[0]); await submitRead(app); }

test('patient authorization selection opens one scoped reader in Patients and returns general reads to Advanced tools', async () => {
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'] }); await app.signIn(); await tick(); await tick();
  const before = app.calls.length;
  await clickNode(authorizationButtons(app)[0]);
  assert.equal(app.element('readForm').parentElement, app.element('patientAuthorizationHost'));
  assert.equal(app.element('readResults').parentElement, app.element('patientAuthorizationHost'));
  assert.equal(app.element('fixtureReadHome').children.length, 0);
  assert.match(app.window.location.href, /#patients$/);
  assert.equal(app.element('readPatient').value, '5');
  assert.equal(app.element('readPatient').readOnly, true); assert.equal(app.element('readId').readOnly, true);
  assert.equal(app.element('fixtureOperationLabel').hidden, true);
  assert.equal(app.document.activeElement, app.element('readPatient'));
  assert.match(app.element('patientAuthorizationMessage').textContent, /Choose Read source records/);
  assert.equal(app.calls.length, before);
  app.document.dispatchEvent(new DetailEvent('primetime-view-changed', { detail: { view: 'workbench' } }));
  assert.equal(app.element('readForm').parentElement, app.element('fixtureReadHome'));
  assert.equal(app.element('readPatient').readOnly, false); assert.equal(app.element('fixtureOperationLabel').hidden, false);
  assert.equal(app.calls.length, before);
});
test('returning an inline source reader keeps the form and results inside its folded tool body',async()=>{
 const app=connectedWorkspace({enabledReads:['GetPatientDemographics','SearchPatientAuthorizations']});await app.signIn();await tick();await tick();
 const home=app.element('fixtureReadHome'),body=app.element('fixtureDisclosureBody');body.append=home.append;home.append(body);home.querySelector=selector=>selector===':scope > .workspace-disclosure > .workspace-disclosure-body'?body:null;
 await clickNode(authorizationButtons(app)[0]);assert.equal(app.element('readForm').parentElement,app.element('patientAuthorizationHost'));
 app.document.dispatchEvent(new DetailEvent('primetime-view-changed',{detail:{view:'workbench'}}));assert.equal(app.element('readForm').parentElement,body);assert.equal(app.element('readResults').parentElement,body);assert.equal(home.children.includes(app.element('readForm')),false);
});

test('inline authorization failures and exact contract selection remain visible without legacy ambiguous shortcuts', async () => {
  let fail = false;
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations', 'GetPatientAuthorizationInfo'], authorizations: (_path, options) => fail
    ? { ...response({ ok: false, error: 'patient_office_mismatch' }), ok: false, status: 403 }
    : response(authSource(JSON.parse(options.body))) });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  assert.equal(descendants(app.element('readResults')).filter(n => n.textContent === 'Inspect authorization units').length, 0);
  await clickNode(detailButtons(app)[0]);
  fail = true; await submitRead(app);
  assert.deepEqual(JSON.parse(authorizationCalls(app).at(-1).options.body), { operation: 'GetPatientAuthorizationInfo', patientId: '5', id: '71', officeId: '123', contractId: '81' });
  assert.match(app.element('patientAuthorizationMessage').textContent, /patient office mismatch/);
  assert.equal(app.element('readResults').children.length, 0);
});

test('changing the selected patient clears inline authorization evidence and fences its late response', async () => {
  const late = deferred();
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'], authorizations: () => late.promise });
  await app.signIn(); await tick(); await tick();
  await clickNode(authorizationButtons(app)[0]);
  const pending = submitRead(app); await tick();
  app.document.dispatchEvent(new DetailEvent('primetime-patient-profile-selected', { detail: { patientId: '7', officeId: '123' } }));
  late.resolve(response(authSource({ operation: 'SearchPatientAuthorizations', patientId: '5', officeId: '123' })));
  await pending; await tick();
  assert.equal(app.element('readResults').children.length, 0);
  assert.equal(app.element('readPatient').value, '');
  assert.equal(app.element('readForm').parentElement, app.element('fixtureReadHome'));
  assert.doesNotMatch(app.element('patientAuthorizationMessage').textContent, /fetched|Working|Patient 5/);
});

test('authorization scope survives visit-date context changes but Demo and sign-out clear and disable the shared reader', async () => {
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'], authorizations: (_path, options) => response(authSource(JSON.parse(options.body))) });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  assert.equal(app.element('readForm').parentElement, app.element('patientAuthorizationHost'));
  const before = authorizationCalls(app).length, shown = nodeText(app.element('readResults'));
  app.document.dispatchEvent(new DetailEvent('primetime-source-context-cleared', { detail: { date: '2026-10-11' } }));
  assert.equal(nodeText(app.element('readResults')), shown);
  assert.equal(authorizationCalls(app).length, before);
  app.window.primetimeDataMode.setMode('demo'); await tick();
  assert.equal(app.element('readForm').parentElement, app.element('fixtureReadHome'));
  assert.equal(app.element('readResults').children.length, 0);
  assert.equal(app.element('readPatient').disabled, true);
  assert.equal(app.element('readPatient').value, '');
  assert.equal(app.element('readId').readOnly, false);
  app.dispatch('primetime-signed-out');
  assert.equal(app.element('readPatient').disabled, true);
  assert.equal(app.element('readResults').children.length, 0);
});

test('inline authorization receipts remain independent and malformed fetch timestamps cannot expose source facts', async () => {
  let receipt = '2026-10-15T19:16:00.000Z';
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations', 'GetPatientAuthorizationInfo'], authorizations: (_path, options) => {
    const input = JSON.parse(options.body);
    return response(authSource(input, { fetchedAt: receipt, ...(input.operation === 'GetPatientAuthorizationInfo' ? { truncated: false, records: [{ AuthorizationID: input.id, 'Patient/ID': input.patientId, 'Contract/ID': input.contractId, MaxUnits: '0' }] } : {}) }));
  } });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  await clickNode(detailButtons(app)[0]); receipt = '2026-10-15T19:17:00.000Z'; await submitRead(app);
  const shown = nodeText(app.element('readResults'));
  assert.match(shown, /Discovery read: 2026-10-15T19:16:00.000Z/);
  assert.match(shown, /fetched 2026-10-15T19:17:00.000Z/);
  assert.match(shown, /MaxUnits 0/); assert.match(shown, /limits remain unvalidated/);
  for (receipt of ['2026-10-15', '2026-02-30T12:00:00Z', '2026-10-15T19:18:00']) {
    await submitRead(app);
    assert.equal(app.element('readResults').children.length, 0);
    assert.match(app.element('patientAuthorizationMessage').textContent, /context could not be verified/);
  }
});

test('unrelated workspace activity cannot relabel an inline authorization read', async () => {
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'], authorizations: (_path, options) => response(authSource(JSON.parse(options.body))) });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  const source = nodeText(app.element('readResults')), status = app.element('patientAuthorizationMessage').textContent;
  await app.click('reloadWorkspace'); await tick();
  assert.equal(nodeText(app.element('readResults')), source);
  assert.equal(app.element('patientAuthorizationMessage').textContent, status);
  assert.equal(authorizationCalls(app).length, 1);
});

test('both live source views select exact patient authorization discovery without fetching or granting reads', async () => {
  const app = connectedWorkspace(); await app.signIn(); await tick(); await tick();
  for (const host of ['dashboardTimeline', 'dashboardVisitRows']) {
    const before = app.calls.length;
    await clickNode(authorizationButtons(app, host)[0]);
    assert.equal(app.calls.length, before); assert.equal(app.element('readOperation').value, 'SearchPatientAuthorizations');
    assert.equal(app.element('readPatient').value, '5'); assert.equal(app.element('readOffice').value, '123');
    assert.match(app.element('workspaceMessage').textContent, /requires owner enablement/);
  }
  app.window.primetimeDataMode.setMode('demo');
  assert.equal(authorizationButtons(app).length, 0);
});

test('authorization discovery retains same-name IDs, source dates, freshness and explicit truncation', async () => {
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'], authorizations: (_path, options) => response(authSource(JSON.parse(options.body))) });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  assert.deepEqual(JSON.parse(authorizationCalls(app)[0].options.body), { operation: 'SearchPatientAuthorizations', patientId: '5', officeId: '123' });
  const shown = nodeText(app.element('readResults'));
  assert.match(shown, /2 authorization discovery row\(s\) returned · truncated; not a complete list/);
  assert.match(shown, /2026-10-15T19:16:00.000Z/); assert.match(shown, /2026-10-01/); assert.match(shown, /usage basis and limits remain unvalidated/);
  assert.equal(detailButtons(app).length, 2);
  const before = authorizationCalls(app).length;
  await clickNode(detailButtons(app)[1]);
  assert.equal(app.element('readOperation').value, 'GetPatientAuthorizationInfo'); assert.equal(app.element('readId').value, '72');
  assert.equal(app.element('readPatient').value, '5'); assert.equal(app.element('readResults').children.length, 0);
  assert.equal(authorizationCalls(app).length, before, 'detail selection cannot auto-fetch or enable its gate');
  assert.match(app.element('workspaceMessage').textContent, /requires owner enablement/);
});

test('explicit detail read sends the selected source contract and preserves raw unavailable, blank, zero and negative values', async () => {
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations', 'GetPatientAuthorizationInfo'], authorizations: (_path, options) => {
    const input = JSON.parse(options.body);
    return response(authSource(input, input.operation === 'GetPatientAuthorizationInfo' ? { truncated: false, records: [{ AuthorizationID: input.id, 'Patient/ID': input.patientId, 'Contract/ID': input.contractId, MaxUnits: '0', RemainingUnits: '--', BankedHours: '', WeeklyMaxAuthorization: '-1' }] } : {}));
  } });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  await clickNode(detailButtons(app)[1]); await submitRead(app);
  assert.deepEqual(JSON.parse(authorizationCalls(app)[1].options.body), { operation: 'GetPatientAuthorizationInfo', patientId: '5', id: '72', officeId: '123', contractId: '82' });
  const values = descendants(app.element('readResults')).filter(node => node.tagName === 'DD').map(node => node.textContent);
  for (const value of ['0', '--', '', '-1']) assert.ok(values.includes(value));
  assert.match(nodeText(app.element('readResults')), /Raw authorization detail fields/);
  assert.doesNotMatch(nodeText(app.element('readResults')), /Utilization:/);
});

test('input changes fence late authorization results/errors and detached detail selectors', async () => {
  for (const fail of [false, true]) {
    const late = deferred(); let hold = false;
    const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'], authorizations: (_path, options) => hold ? late.promise : response(authSource(JSON.parse(options.body))) });
    await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
    const old = detailButtons(app)[0]; hold = true; await submitRead(app);
    app.element('readPatient').value = '6'; for (const fn of app.element('readPatient').handlers.get('input')) fn(new Event('input'));
    const count = authorizationCalls(app).length; await clickNode(old);
    late.resolve(response(fail ? { ok: false, error: 'patient_office_mismatch' } : authSource({ operation: 'SearchPatientAuthorizations', patientId: '5', officeId: '123' })));
    await tick(); await tick();
    assert.equal(authorizationCalls(app).length, count); assert.equal(app.element('readPatient').value, '6');
    assert.equal(app.element('readResults').children.length, 0); assert.doesNotMatch(app.element('workspaceMessage').textContent, /patient office mismatch/);
  }
});

test('ambiguous or invalid authorization identities have no actionable detail selection', async () => {
  const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'], authorizations: (_path, options) => response(authSource(JSON.parse(options.body), { records: [
    { ID: '71', ContractID: '81' }, { ID: '71', ContractID: '82' }, { ID: '<script>', ContractID: '83' }, { ID: '72', ContractID: '' }
  ] })) });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  assert.equal(detailButtons(app).length, 0); assert.match(nodeText(app.element('readResults')), /identity is missing, invalid or ambiguous/);
});

test('empty authorization evidence, denied access and unverifiable context remain distinct', async () => {
  for (const mode of ['empty', 'denied', 'wrong_scope']) {
    const app = connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations'], authorizations: (_path, options) => {
      const input = JSON.parse(options.body);
      return response(mode === 'denied' ? { ok: false, error: 'patient_office_mismatch' } : authSource(input, { records: [], truncated: false, ...(mode === 'wrong_scope' ? { scope: { patientId: '99', officeId: '123' } } : {}) }));
    } });
    await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
    if (mode === 'empty') { assert.match(nodeText(app.element('readResults')), /0 authorization discovery row/); assert.match(nodeText(app.element('readResults')), /not a zero census or a zero balance/); }
    else { assert.equal(app.element('readResults').children.length, 0); assert.match(app.element('workspaceMessage').textContent, mode === 'denied' ? /patient office mismatch/ : /could not be verified/); }
  }
});


test('focus acquired during a feed request preserves evidence on late success and failure until explicit resume', async () => {
  for (const failure of [false, true]) {
    const late = deferred(); let path, held = true;
    const app = await apiFeedFixture(value => { path = value; return held ? late.promise : response(scheduledFeedPage(value)); });
    const rows = app.element('dashboardVisitRows').children.slice(), receipt = app.element('dashboardVisitMetadata').textContent;
    await app.runFeed();
    const focused = { closest: () => app.element('dashboardVisitRows') }; app.document.activeElement = focused;
    if (failure) late.reject(new Error('synthetic failure')); else late.resolve(response(scheduledFeedPage(path)));
    await tick(); await tick();
    assert.deepEqual(app.element('dashboardVisitRows').children, rows);
    assert.equal(app.element('dashboardVisitMetadata').textContent, receipt);
    assert.equal(app.document.activeElement, focused);
    assert.equal(app.element('apiFeedToggle').textContent, 'Resume live feed');
    assert.equal(app.timers.size, 0);
    held = false; app.document.activeElement = app.element('apiFeedToggle');
    await app.click('apiFeedToggle'); await tick(); await tick();
    assert.match(app.element('apiFeedStatus').textContent, /Connected/);
  }
});

test('EVV search focus pauses automatic reads before dispatch without losing the query or rows', async () => {
  const app = await apiFeedFixture();
  const search = app.element('exceptionSearch');
  search.closest = selector => selector.split(',').map(value => value.trim()).includes('#exceptionSearch') ? search : null;
  search.value = '900001'; search.focus();
  const rows = app.element('dashboardExceptions').children.slice(), calls = app.calls.length;
  await app.runFeed();
  assert.equal(app.calls.length, calls);
  assert.deepEqual(app.element('dashboardExceptions').children, rows);
  assert.equal(search.value, '900001');
  assert.equal(app.document.activeElement, search);
  assert.equal(app.element('apiFeedToggle').textContent, 'Resume live feed');
});

test('EVV focus acquired during a feed read preserves evidence on success and failure until resume', async () => {
  for (const failure of [false, true]) {
    const late = deferred(); let path, held = true;
    const app = await apiFeedFixture(value => { path = value; return held ? late.promise : response(scheduledFeedPage(value)); });
    const rows = app.element('dashboardExceptions').children.slice();
    await app.runFeed();
    const search = app.element('exceptionSearch');
    search.closest = selector => selector.split(',').map(value => value.trim()).includes('#exceptionSearch') ? search : null;
    search.value = '900001'; search.focus();
    if (failure) late.reject(new Error('synthetic feed failure')); else late.resolve(response(scheduledFeedPage(path)));
    await tick(); await tick();
    assert.deepEqual(app.element('dashboardExceptions').children, rows);
    assert.equal(search.value, '900001');
    assert.equal(app.document.activeElement, search);
    assert.equal(app.element('apiFeedToggle').textContent, 'Resume live feed');
    assert.equal(app.timers.size, 0);
    held = false; app.document.activeElement = app.element('apiFeedToggle');
    await app.click('apiFeedToggle'); await tick(); await tick();
    assert.match(app.element('apiFeedStatus').textContent, /Connected/);
    assert.equal(search.value, '900001');
  }
});

test('untouched default follows Chicago midnight including DST dates without losing the feed timer', async () => {
  for (const [before, after, day] of [['2026-10-21T04:59:59Z','2026-10-21T05:00:01Z','2026-10-21'], ['2026-11-02T05:59:59Z','2026-11-02T06:00:01Z','2026-11-02']]) {
    const app = await apiFeedFixture(undefined, before);
    app.clock.set(after); await app.runFeed();
    assert.equal(app.element('dashboardVisitDate').value, day);
    assert.equal(app.element('dashboardOverviewDate').value, day);
    assert.ok(app.calls.filter(c => c.path.includes('/views/feed?')).every(c => new URL(c.path, 'https://synthetic.test').searchParams.get('date') === day));
    assert.match(app.element('apiFeedStatus').textContent, /Connected/);
    assert.equal(app.element('dashboardVisitPrevious').hidden, true);
    await app.runFeed();
    assert.equal(app.calls.filter(c => c.path.includes('/views/feed?')).length, 2);
  }
});

test('explicit date selections stay fixed across office midnight', async () => {
  for (const day of ['2026-10-19', '2026-10-20']) {
    const app = await apiFeedFixture(undefined, '2026-10-21T04:59:59Z');
    app.element('dashboardVisitDate').value = day;
    for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change'));
    await tick(); await tick();
    app.clock.set('2026-10-21T05:00:01Z');
    app.document.visibilityState = 'visible'; app.dispatch('visibilitychange'); await tick(); await tick();
    assert.equal(app.element('dashboardVisitDate').value, day);
    assert.equal(app.element('dashboardOverviewDate').value, day);
    assert.equal(app.calls.filter(c => c.path.includes('/views/feed?')).length, 0);
    assert.match(app.element('apiFeedStatus').textContent, /Historical dates/);
  }
});

test('a pending yesterday response cannot replace evidence after midnight and the next check uses today', async () => {
  const late = deferred(); let path, held = true;
  const app = await apiFeedFixture(value => { path = value; return held ? late.promise : response(scheduledFeedPage(value)); }, '2026-10-21T04:59:59Z');
  const rows = app.element('dashboardVisitRows').children.slice();
  await app.runFeed(); app.clock.set('2026-10-21T05:00:01Z');
  late.resolve(response(scheduledFeedPage(path))); await tick(); await tick();
  assert.deepEqual(app.element('dashboardVisitRows').children, rows);
  held = false; await app.runFeed();
  assert.equal(app.element('dashboardVisitDate').value, '2026-10-21');
  assert.match(app.element('apiFeedStatus').textContent, /Connected/);
});


test('midnight rollover waits for visibility and source focus release without making hidden requests', async () => {
  const app = await apiFeedFixture(undefined, '2026-10-21T04:59:59Z');
  app.document.visibilityState = 'hidden'; app.dispatch('visibilitychange');
  app.clock.set('2026-10-21T05:00:01Z');
  assert.equal(app.timers.size, 0);
  assert.equal(app.calls.filter(c => c.path.includes('/views/feed?')).length, 0);
  app.document.activeElement = { closest: () => app.element('dashboardTimeline') };
  app.document.visibilityState = 'visible'; app.dispatch('visibilitychange'); await tick(); await tick();
  assert.equal(app.element('dashboardVisitDate').value, '2026-10-20');
  assert.equal(app.calls.filter(c => c.path.includes('/views/feed?')).length, 0);
  app.document.activeElement = app.element('apiFeedToggle');
  await app.click('apiFeedToggle'); await tick(); await tick();
  assert.equal(app.element('dashboardVisitDate').value, '2026-10-21');
  assert.match(app.element('apiFeedStatus').textContent, /Connected/);
});


test('midnight clears only prior-day source evidence and preserves unrelated panels and Clear controls', async () => {
  const late = deferred(); let path;
  const app = await apiFeedFixture(value => { path = value; return late.promise; }, '2026-10-21T04:59:59Z');
  const panels = ['dashboardMessages', 'dashboardBillingMetrics', 'dashboardAudit', 'dashboardSettings'];
  const original = panels.map(id => app.element(id).children.slice());
  app.clock.set('2026-10-21T05:00:01Z'); await app.runFeed();
  for (const id of ['dashboardVisitRows', 'dashboardTimeline', 'dashboardEvidenceChart', 'dashboardExceptions', 'dashboardStaffing', 'dashboardCaregiverProfile', 'dashboardBillingPipeline', 'dashboardBillingFacts']) {
    assert.doesNotMatch(nodeText(app.element(id)), /900001/);
    assert.match(nodeText(app.element(id)), /Loading current office day/);
  }
  for (const id of ['dashboardOverviewClear', 'dashboardVisitClear']) assert.equal(app.element(id).disabled, false);
  panels.forEach((id, i) => assert.deepEqual(app.element(id).children, original[i], id));
  late.resolve(response(scheduledFeedPage(path))); await tick(); await tick();
  for (const id of ['dashboardOverviewClear', 'dashboardVisitClear']) assert.equal(app.element(id).disabled, false);
  panels.forEach((id, i) => assert.deepEqual(app.element(id).children, original[i], id));
  await app.click('dashboardVisitClear'); assertSourcePageCleared(app);
});

test('Clear during midnight rollover fences late success and failure without restoring source evidence', async () => {
  for (const failure of [false, true]) {
    const late = deferred(); let path;
    const app = await apiFeedFixture(value => { path = value; return late.promise; }, '2026-10-21T04:59:59Z');
    app.clock.set('2026-10-21T05:00:01Z'); await app.runFeed();
    assert.equal(app.element('dashboardOverviewClear').disabled, false);
    await app.click('dashboardOverviewClear'); assertSourcePageCleared(app);
    if (failure) late.reject(new Error('synthetic')); else late.resolve(response(scheduledFeedPage(path)));
    await tick(); await tick(); assertSourcePageCleared(app);
    assert.equal(app.timers.size, 0);
  }
});

test('office-today navigation distinguishes explicit dates, resumes the cache and preserves unrelated panels', async () => {
  const app = await apiFeedFixture(undefined, '2026-10-21T01:00:00Z');
  assert.match(app.element('apiFeedDateContext').textContent, /Following office today: 2026-10-20/);
  app.element('dashboardOverviewDate').value = '2026-10-19';
  for (const fn of app.element('dashboardOverviewDate').handlers.get('change')) fn(new Event('change'));
  await tick(); await tick();
  assert.match(app.element('apiFeedDateContext').textContent, /Selected date: 2026-10-19.*stays fixed/);
  await app.click('apiFeedToggle');
  const panels = ['dashboardMessages','dashboardBillingMetrics','dashboardAudit','dashboardSettings'];
  const original = panels.map(id => app.element(id).children.slice());
  const before = app.calls.length;
  await app.click('apiFeedToday'); await tick(); await tick();
  assert.equal(app.element('dashboardOverviewDate').value, '2026-10-20');
  assert.equal(app.element('dashboardVisitDate').value, '2026-10-20');
  assert.match(app.element('apiFeedDateContext').textContent, /Following office today: 2026-10-20.*America\/Chicago/);
  assert.equal(app.document.activeElement, app.element('apiFeedToday'));
  assert.equal(app.element('apiFeedToggle').textContent, 'Pause live feed');
  assert.equal(app.element('dashboardVisitPrevious').hidden, true);
  assert.ok(app.calls.slice(before).every(call => call.path.includes('/views/feed?')));
  assert.equal(app.calls.length - before, 1, 'explicit return reads only the existing cache');
  panels.forEach((id,i) => assert.deepEqual(app.element(id).children, original[i], id));
});

test('returning today fences a pending historical read without clearing unrelated work or accepting its late result', async () => {
  for (const failure of [false,true]) {
    const app = await apiFeedFixture(undefined, '2026-10-21T01:00:00Z');
    const old = deferred(), latest = deferred(), original = app.window.primetimeApiFetch; let oldPath, feedPath;
    app.window.primetimeApiFetch = path => {
      if (path.includes('/views/visits?')) { oldPath = path; return old.promise; }
      if (path.includes('/views/feed?')) { feedPath = path; return latest.promise; }
      return original(path);
    };
    app.element('dashboardVisitDate').value = '2026-10-19';
    for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change'));
    await tick(); const unrelated = app.element('dashboardMessages').children.slice();
    await app.click('apiFeedToday');
    assert.equal(app.element('dashboardVisitMetadata').textContent, '');
    assert.match(nodeText(app.element('dashboardVisitRows')), /Loading office today/);
    assert.deepEqual(app.element('dashboardMessages').children, unrelated);
    if (failure) old.reject(new Error('obsolete historical failure')); else old.resolve(response(numberedSourcePage(oldPath)));
    await tick(); await tick();
    assert.match(nodeText(app.element('dashboardVisitRows')), /Loading office today/);
    latest.resolve(response(scheduledFeedPage(feedPath))); await tick(); await tick();
    assert.match(app.element('apiFeedStatus').textContent, /Connected/);
    assert.equal(app.element('dashboardVisitDate').value, '2026-10-20');
    assert.match(nodeText(app.element('dashboardVisitRows')), /900001/);
  }
});

test('an obsolete feed completion cannot release a newer return-today request or schedule over its timer', async () => {
  for (const failure of [false,true]) {
    const old = deferred(), latest = deferred(); let oldPath, newPath, count = 0;
    const app = await apiFeedFixture(path => { if (++count === 1) { oldPath = path; return old.promise; } newPath = path; return latest.promise; });
    await app.runFeed(); await app.click('apiFeedToday'); await tick();
    assert.equal(count, 2, 'return starts a current request even when the aborted adapter has not settled');
    if (failure) old.reject(new Error('obsolete feed failure')); else old.resolve(response(scheduledFeedPage(oldPath)));
    await tick(); await tick();
    assert.equal(app.timers.size, 0, 'old completion must not schedule a check over the current request');
    assert.match(nodeText(app.element('dashboardVisitRows')), /Loading office today/);
    latest.resolve(response(scheduledFeedPage(newPath))); await tick(); await tick();
    assert.match(app.element('apiFeedStatus').textContent, /Connected/);
    assert.equal([...app.timers.values()].filter(timer => timer.delay === 60000).length, 1);
  }
});

test('return today restores the office-calendar default across daylight and standard-time midnights', async () => {
  for (const [before,after,day] of [['2026-10-21T04:59:59Z','2026-10-21T05:00:01Z','2026-10-21'],['2026-11-02T05:59:59Z','2026-11-02T06:00:01Z','2026-11-02']]) {
    const app = await apiFeedFixture(undefined, before);
    app.element('dashboardVisitDate').value = '2026-10-18';
    for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change'));
    await tick(); await tick(); await app.click('apiFeedToday'); await tick(); await tick();
    app.clock.set(after); await app.runFeed();
    assert.equal(app.element('dashboardVisitDate').value, day);
    assert.match(app.element('apiFeedDateContext').textContent, new RegExp(`Following office today: ${day}`));
    assert.match(app.element('apiFeedStatus').textContent, /Connected/);
  }
});

test('today navigation cannot dispatch through missing timezone, owner denial, Demo or signed-out controls', async () => {
  for (const change of ['timezone','invalid-zone','office','owner','reads','demo','session']) {
    const app = await apiFeedFixture();
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    else if (change === 'session') app.dispatch('primetime-signed-out');
    else {
      const original = app.window.primetimeApiFetch;
      const changed = structuredClone(liveMetadata);
      if (change === 'timezone') changed.settings.officeTimezone = '';
      if (change === 'invalid-zone') changed.settings.officeTimezone = 'Unavailable/Timezone';
      if (change === 'office') changed.settings.officeId = '';
      if (change === 'owner') changed.dataApproved = false;
      if (change === 'reads') changed.panels.visits.available = false;
      app.window.primetimeApiFetch = path => path.endsWith('/data/status') ? response(changed) : original(path);
      await app.click('dashboardOverviewRefresh');
    }
    await tick(); await tick();
    assert.equal(app.element('apiFeedToday').disabled, true, change);
    const calls = app.calls.length, date = app.element('dashboardVisitDate').value;
    await app.click('apiFeedToday'); await tick();
    assert.equal(app.calls.length, calls, change);
    assert.equal(app.element('dashboardVisitDate').value, date, change);
  }
});

test('clearing or changing scope during return today prevents late cache evidence and leaves the current state in charge', async () => {
  for (const change of ['clear','office','policy','demo','session']) {
    const pending = deferred(); let path;
    const app = await apiFeedFixture(value => { path = value; return pending.promise; });
    app.window.primetimeDataMode.observeScope({...liveMetadata.settings,revision:1});
    await app.click('apiFeedToday');
    if (change === 'clear') await app.click('dashboardOverviewClear');
    if (change === 'office' || change === 'policy') app.window.primetimeDataMode.observeScope({officeId:change === 'office'?'999':'123',officeTimezone:'America/Chicago',revision:2});
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'session') app.dispatch('primetime-signed-out');
    for (let i = 0; i < 6; i++) await tick();
    const status = app.element('dashboardVisitStatus').textContent;
    const obsolete = scheduledFeedPage(path); obsolete.items[0].id = '999999';
    pending.resolve(response(obsolete)); await tick(); await tick();
    assert.equal(app.element('dashboardVisitStatus').textContent, status, change);
    assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /999999/, change);
    if (change === 'clear') assertSourcePageCleared(app);
    if (change === 'demo') assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-/);
    if (change === 'session') assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /900001/);
  }
});

test('a failed return today clears source evidence and retries without removing unrelated panels', async () => {
  for (const failure of ['error','expired']) {
    const app = await apiFeedFixture(path => {
      if (failure === 'error') return {...response({ok:false}),ok:false,status:503};
      const page = scheduledFeedPage(path); page.feed.checkedAt = new Date(Date.parse(page.fetchedAt)+181000).toISOString();
      return response(page);
    });
    const panels = ['dashboardMessages','dashboardBillingMetrics','dashboardAudit','dashboardSettings'];
    const original = panels.map(id => app.element(id).children.slice());
    await app.click('apiFeedToday'); await tick(); await tick();
    assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /900001/);
    assert.equal(app.element('dashboardVisitMetadata').textContent, '');
    assert.equal(app.element('apiFeedToday').disabled, true);
    assert.match(app.element('apiFeedDateContext').textContent, /unavailable/);
    assert.equal([...app.timers.values()].filter(timer => timer.delay === 60000).length, 1);
    panels.forEach((id,i) => assert.deepEqual(app.element(id).children, original[i], id));
  }
});

test('explicit pause holds EVV and Staffing after focus leaves across late success and failure', async () => {
 for(const failed of [false,true]) {
  const late=deferred();let route,held=true;
  const fresh = p => { const value=scheduledFeedPage(p); value.fetchedAt='2026-10-10T08:01:00Z'; value.feed.checkedAt=value.fetchedAt; value.items[0].id='900009'; return value; };
  const app=await apiFeedFixture(p=>{route=p;return held?late.promise:response(fresh(p));});
  app.element('exceptionSearch').value='900001';
  const ids=['dashboardExceptions','dashboardStaffing','dashboardEvidenceChart'];
  const before=ids.map(id=>app.element(id).children.slice()),receipt=app.element('dashboardVisitMetadata').textContent;
  const oldTimer=[...app.timers.values()].find(t=>t.delay===60000).fn;
  await app.runFeed();await app.click('apiFeedToggle');
  const outside=app.element('unrelatedNavigation');outside.closest=()=>null;outside.focus();
  app.dispatch('primetime-view-changed',{view:'settings'});
  const changed=fresh(route);
  if(failed)late.reject(new Error('synthetic failed update'));else late.resolve(response(changed));
  await tick();await tick();const calls=app.calls.length;oldTimer();await tick();
  ids.forEach((id,i)=>assert.deepEqual(app.element(id).children,before[i]));
  assert.equal(app.element('dashboardVisitMetadata').textContent,receipt);
  assert.equal(app.element('exceptionSearch').value,'900001');assert.equal(app.document.activeElement,outside);
  assert.equal(app.calls.length,calls);assert.equal(app.timers.size,0);
  assert.match(app.element('apiFeedStatus').textContent,/paused/);
  held=false;await app.click('apiFeedToggle');await tick();await tick();
  assert.match(app.element('apiFeedStatus').textContent,/Connected/);
  assert.match(app.element('dashboardVisitMetadata').textContent,/2026-10-10T08:01:00Z.*first source page/);
  for(const id of ['dashboardExceptions','dashboardStaffing']) { assert.match(nodeText(app.element(id)),/900009/); assert.match(nodeText(app.element(id)),/not the full office/); }
  assert.equal(app.element('exceptionSearch').value,'900001');
 }
});
test('age pause is independent from row feed pause', async()=>{
 const app=await apiFeedFixture();
 app.element('automaticAgeUpdates').checked=false; for(const fn of app.element('automaticAgeUpdates').handlers.get('change'))fn({target:app.element('automaticAgeUpdates')});
 await app.runFeed();assert.equal(app.calls.filter(c=>c.path.includes('/views/feed?')).length,1);
 assert.equal(app.element('apiFeedToggle').textContent,'Pause live feed');
});
test('clear and revocation still remove paused EVV and Staffing evidence',async()=>{
 for(const change of ['clear','signout','office']){
  const app=await apiFeedFixture();app.window.primetimeDataMode.observeScope({revision:1,officeId:'123',officeTimezone:'America/Chicago'});await app.click('apiFeedToggle');
  if(change==='clear')await app.click('dashboardVisitClear');
  else if(change==='signout')app.dispatch('primetime-signed-out');
  else app.window.primetimeDataMode.observeScope({revision:2,officeId:'999',officeTimezone:'America/Chicago'});
  for(const id of ['dashboardExceptions','dashboardStaffing'])assert.doesNotMatch(nodeText(app.element(id)),/900001/,change+' '+id);
 }
});


test('billing record navigation uses fresh caregiver identity rather than the selected page identity', async () => {
 for (const id of ['7', '6', null, undefined, '', '0', 'invalid', '2147483648']) {
  const app = await relatedFixture(input => response(relatedPayload(input, { 'Caregiver/ID': id, VisitDate: '2026-10-24' })));
  await clickNode(relatedButton(app, 'billing')); await tick(); await tick();
  const host = app.element('dashboardBillingFacts'), controls = descendants(host);
  const caregiver = controls.find(n => n.textContent === 'Open caregiver read');
  if (id === '7' || id === '6') {
   assert.ok(caregiver); await clickNode(caregiver);
   assert.equal(app.events.filter(e => e.type === 'primetime-source-record-selected').at(-1).detail.id, id);
  } else assert.equal(caregiver, undefined, 'missing or invalid fresh identity never falls back to page caregiver');
  const patient = controls.find(n => n.textContent === 'Open patient read');
  await clickNode(patient);
  assert.equal(app.events.filter(e => e.type === 'primetime-source-record-selected').at(-1).detail.id, '5');
 }
});

test('related record navigation is fenced when its receipt is superseded or context cleared', async () => {
 for (const kind of ['billing', 'caregiver']) for (const outcome of ['success', 'failure', 'clear', 'demo', 'session']) {
  let pending = false, input; const late = deferred();
  const app = await relatedFixture(value => { input = value; return pending ? late.promise : response(relatedPayload(value, kind === 'billing' ? { 'Caregiver/ID': '7' } : {})); });
  await clickNode(relatedButton(app, kind)); await tick(); await tick();
  const host = app.element(kind === 'billing' ? 'dashboardBillingFacts' : 'dashboardCaregiverProfile');
  const old = descendants(host).filter(n => (n.handlers.get('click') || []).length);
  assert.ok(old.length);
  pending = true; await clickNode(relatedButton(app, kind)); await tick();
  const assertHeld = async () => {
   const before = app.events.filter(e => e.type === 'primetime-source-record-selected').length;
   for (const control of old) await clickNode(control);
   assert.equal(app.events.filter(e => e.type === 'primetime-source-record-selected').length, before);
  };
  await assertHeld();
  if (outcome === 'clear') await app.click('dashboardVisitClear');
  if (outcome === 'demo') app.window.primetimeDataMode.setMode('demo');
  if (outcome === 'session') app.dispatch('primetime-signed-out');
  if (outcome === 'failure') late.reject(new Error('synthetic failure'));
  else late.resolve(response(relatedPayload(input, kind === 'billing' ? { 'Caregiver/ID': '8' } : {})));
  await tick(); await tick(); await assertHeld();
  if (outcome === 'success') {
   const currentLink = descendants(host).find(n => n.textContent === 'Open caregiver read');
   await clickNode(currentLink);
   assert.equal(app.events.filter(e => e.type === 'primetime-source-record-selected').at(-1).detail.id, kind === 'billing' ? '8' : '6');
  }
 }
});

test('preview carries literal EVV source types beside independent clocks and clears them with context', async () => {
  const model = dashboardModel().primetimeDashboardModel, date = '2026-10-10', expected = { mode: 'live', officeId: '123', date };
  const payload = livePreview(date); Object.assign(payload.items[0], { evvInType: '0', evvOutType: '', evvEnd: '', actualHours: '' });
  let row = model.normalizeVisitPreview(payload, expected).items[0];
  assert.equal(row.evvInType, '0'); assert.equal(row.evvOutType, ''); assert.equal(row.evvEnd, ''); assert.equal(row.actualHours, '');
  assert.equal(model.sourceEvidence([row]).evvPairs, 0);
  payload.items[0].state = 'unavailable';
  row = model.normalizeVisitPreview(payload, expected).items[0];
  assert.equal(row.evvInType, null); assert.equal(row.evvOutType, null); assert.equal(row.evvEnd, null);
  payload.items[0].state = 'source_unvalidated';
  for (const bad of [7, {}, 'x'.repeat(129)]) { payload.items[0].evvInType = bad; assert.throws(() => model.normalizeVisitPreview(payload, expected)); }
  const app = connectedWorkspace({ preview: day => { const p = livePreview(day); Object.assign(p.items[0], { evvInType: '<literal-type>', evvOutType: '', evvEnd: null, actualHours: '' }); return p; } });
  await app.signIn(); await tick(); await tick();
  const shown = nodeText(app.element('dashboardVisitRows'));
  assert.match(shown, /EVV types in \/ out \(source\): <literal-type> \/ Empty/);
  assert.match(shown, /Event status unknown/); assert.match(shown, /Empty HHA ActualHours/);
  app.window.primetimeDataMode.setMode('demo');
  assert.doesNotMatch(nodeText(app.element('dashboardVisitRows')), /<literal-type>|EVV types in/);
});

const authorizationBack = app => descendants(app.element('readForm')).find(n => n.tagName === 'BUTTON' && n.textContent === 'Back to fetched authorizations');
function returningAuthorizations(options = {}) {
  return connectedWorkspace({ enabledReads: ['GetPatientDemographics', 'SearchPatientAuthorizations', 'GetPatientAuthorizationInfo'], authorizations: (_path, request) => {
    const input = JSON.parse(request.body);
    if (options.read) return options.read(input);
    return response(authSource(input, input.operation === 'GetPatientAuthorizationInfo' ? { truncated: false, records: [{ AuthorizationID: input.id, 'Patient/ID': input.patientId, 'Contract/ID': input.contractId, MaxUnits: '0' }] } : {}));
  } });
}
test('fetched authorization list returns without another source request and retains exact contract selectors', async () => {
  const app = returningAuthorizations(); await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  const list = nodeText(app.element('readResults')), first = detailButtons(app)[0];
  await clickNode(first);
  assert.ok(authorizationBack(app), 'a return action must be available after selecting a detail');
  assert.equal(authorizationBack(app).hidden, false);
  await submitRead(app); const calls = authorizationCalls(app).length;
  await clickNode(authorizationBack(app));
  assert.equal(authorizationCalls(app).length, calls);
  assert.equal(nodeText(app.element('readResults')), list);
  assert.equal(app.element('readOperation').value, 'SearchPatientAuthorizations');
  assert.equal(authorizationBack(app).hidden, true);
  assert.match(app.element('patientAuthorizationMessage').textContent, /previously fetched.*refresh/i);
  await clickNode(detailButtons(app)[1]); await submitRead(app);
  assert.deepEqual(JSON.parse(authorizationCalls(app).at(-1).options.body), { operation: 'GetPatientAuthorizationInfo', patientId: '5', id: '72', officeId: '123', contractId: '82' });
  assert.match(nodeText(app.element('readResults')), /Discovery read: 2026-10-15T19:16:00.000Z/);
});
test('returning to fetched authorizations fences a late detail and preserves independent visit-date scope', async () => {
  const late = deferred();
  const app = returningAuthorizations({ read: input => input.operation === 'GetPatientAuthorizationInfo' ? late.promise : response(authSource(input)) });
  await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
  const list = nodeText(app.element('readResults'));
  await clickNode(detailButtons(app)[0]); await submitRead(app);
  assert.ok(authorizationBack(app));
  await clickNode(authorizationBack(app));
  app.document.dispatchEvent(new DetailEvent('primetime-source-context-cleared', { detail: { date: '2026-10-11' } }));
  late.resolve(response({ ok: false, error: 'patient_office_mismatch' })); await tick(); await tick();
  assert.equal(nodeText(app.element('readResults')), list);
  assert.equal(app.element('readOperation').value, 'SearchPatientAuthorizations');
  assert.doesNotMatch(app.element('patientAuthorizationMessage').textContent, /mismatch/);
  await clickNode(detailButtons(app)[1]);
  assert.equal(app.element('readId').value, '72');
});
test('retained authorization lists and detached return actions cannot cross input, profile, office or session changes', async () => {
  for (const change of ['input', 'profile_general', 'office', 'demo', 'signout', 'failed_detail', 'malformed_detail', 'refresh', 'workflow']) {
    const app = returningAuthorizations({ read: input => response(input.operation === 'GetPatientAuthorizationInfo'
      ? change === 'malformed_detail' ? { ...authSource(input), fetchedAt: 'invalid' } : { ok: false, error: 'patient_office_mismatch' } : authSource(input)) });
    await app.signIn(); await tick(); await tick(); await startAuthorizationRead(app);
    const oldSelect = detailButtons(app)[0]; await clickNode(oldSelect);
    const back = authorizationBack(app); assert.ok(back, change);
    if (change === 'input') { app.element('readPatient').value = '6'; for (const fn of app.element('readPatient').handlers.get('input')) fn(new Event('input')); }
    if (change === 'profile_general') {
      app.document.dispatchEvent(new DetailEvent('primetime-view-changed', { detail: { view: 'workbench' } }));
      app.document.dispatchEvent(new DetailEvent('primetime-patient-profile-selected', { detail: { patientId: '6', officeId: '123' } }));
    }
    if (change === 'office') app.window.primetimeDataMode.observeScope({ revision: 2, officeId: '999', officeTimezone: 'America/Chicago' });
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'signout') app.dispatch('primetime-signed-out');
    if (['failed_detail', 'malformed_detail'].includes(change)) await submitRead(app);
    if (change === 'refresh') { await clickNode(back); await submitRead(app); }
    if (change === 'workflow') { app.element('readOperation').value = 'GetPatientDemographics'; for (const fn of app.element('readOperation').handlers.get('change')) fn(new Event('change')); }
    await tick(); await tick(); const before = nodeText(app.element('readResults')), calls = authorizationCalls(app).length;
    await clickNode(back); await clickNode(oldSelect);
    assert.equal(nodeText(app.element('readResults')), before, change);
    assert.equal(authorizationCalls(app).length, calls, change);
    assert.equal(back.hidden, true, change);
  }
});

test('patient read status announces progress and success separately from returned private fields without moving focus', async () => {
  const pending = deferred();
  const app = await currentProfileFixture(() => pending.promise);
  const control = currentProfileButtons(app)[0]; control.focus(); await clickNode(control);
  assert.match(app.element('dashboardPatientProfileStatus').textContent, /Reading/);
  pending.resolve(response(currentProfilePayload({visitId:'900001',patientId:'5',officeId:'123'})));
  await tick(); await tick();
  const status = app.element('dashboardPatientProfileStatus').textContent;
  assert.match(status, /profile returned/i); assert.doesNotMatch(status, /Synthetic profile|900001|16:00/);
  assert.match(nodeText(app.element('dashboardPatientProfile')), /Synthetic profile/);
  assert.equal(app.document.activeElement, control);
  assert.equal(app.calls.filter(c=>c.path.endsWith('/workspace/visit-patient')).length,1);
  const html = readFileSync(new URL('../source/primetime/index.html', import.meta.url),'utf8');
  for (const id of ['dashboardPatientProfile','dashboardCallEvents']) {
    assert.match(html,new RegExp('<p[^>]*id="'+id+'Status"[^>]*role="status"'));
    const container = html.match(new RegExp('<div[^>]*id="'+id+'"[^>]*>'))?.[0];
    assert.ok(container); assert.doesNotMatch(container,/role="status"|aria-live/);
  }
});

test('call read status distinguishes records, successful empty and refusal without announcing raw event fields', async () => {
  for (const outcome of ['records','empty','refusal']) {
    const pending=deferred(), app=await callEventsFixture(()=>pending.promise);
    const control=callEventButtons(app)[0];control.focus();await clickNode(control);await tick();
    assert.match(app.element('dashboardCallEventsStatus').textContent,/Reading/);
    const scope=JSON.parse(app.calls.find(c=>c.path.endsWith('/workspace/visit-calls')).options.body);
    const result=outcome==='refusal'?response({ok:false,error:'call_subject_mismatch'}):response(callEventsPayload(scope,outcome==='empty'?[]:undefined));
    if(outcome==='refusal'){result.ok=false;result.status=409;}
    pending.resolve(result);await tick();await tick();
    const status=app.element('dashboardCallEventsStatus').textContent;
    assert.match(status,outcome==='refusal'?/mismatch/i:new RegExp((outcome==='empty'?'0':'1')+' call event'));
    assert.doesNotMatch(status,/900001|TYPE_FROM_SOURCE|STATUS_FROM_SOURCE|16:00/);
    assert.equal(app.document.activeElement,control);
    assert.equal(app.calls.filter(c=>c.path.endsWith('/workspace/visit-calls')).length,1);
    assert.match(nodeText(app.element('dashboardCallEvents')),outcome==='refusal'?/mismatch/:outcome==='empty'?/No source call events/:/TYPE_FROM_SOURCE/);
  }
});

test('source status clears with its records and cannot be restored by a late patient or call read', async () => {
  for (const kind of ['patient','calls']) for (const change of ['clear','demo','signout']) {
    const pending=deferred();let scope;
    const app=kind==='patient'?await currentProfileFixture(input=>{scope=input;return pending.promise;}):await callEventsFixture(input=>{scope=input;return pending.promise;});
    const host=kind==='patient'?'dashboardPatientProfile':'dashboardCallEvents';
    await clickNode((kind==='patient'?currentProfileButtons(app):callEventButtons(app))[0]);await tick();
    assert.match(app.element(host+'Status').textContent,/Reading/);
    if(change==='clear')await app.click('dashboardVisitClear');
    if(change==='demo')app.window.primetimeDataMode.setMode('demo');
    if(change==='signout')app.dispatch('primetime-signed-out');
    await tick();const before=app.element(host+'Status').textContent;
    assert.doesNotMatch(before,/Reading/);
    pending.resolve(response(kind==='patient'?currentProfilePayload(scope):callEventsPayload(scope)));
    await tick();await tick();
    assert.equal(app.element(host+'Status').textContent,before,kind+'/'+change);
    assert.doesNotMatch(nodeText(app.element(host)),/Synthetic profile|TYPE_FROM_SOURCE/);
  }
});

test('staff and billing statuses report read progress and success without announcing source fields or moving focus', async () => {
  for (const kind of ['caregiver', 'billing']) {
    const pending = deferred(); let scope;
    const app = await relatedFixture(input => { scope = input; return pending.promise; });
    const host = kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts';
    const control = relatedButton(app, kind); control.focus(); await clickNode(control); await tick();
    assert.match(app.element(host + 'Status').textContent, /Reading current source/);
    pending.resolve(response(relatedPayload(scope))); await tick(); await tick();
    const status = app.element(host + 'Status').textContent;
    assert.match(status, /Source record returned/);
    assert.doesNotMatch(status, /Synthetic caregiver|900001|Billed amount|2026-10-24/);
    assert.match(nodeText(app.element(host)), kind === 'caregiver' ? /Synthetic caregiver/ : /Billed amount \(source\) 0/);
    assert.match(nodeText(app.element(host)), /HHA Get.*fetched.*patient office checked/);
    assert.ok(descendants(app.element(host)).some(n => n.textContent === 'Open visit read'));
    assert.equal(app.document.activeElement, control);
    assert.equal(app.calls.filter(c => c.path.endsWith('/workspace/visit-context')).length, 1);
    const html = readFileSync(new URL('../source/primetime/index.html', import.meta.url), 'utf8');
    assert.match(html, new RegExp('<p[^>]*id="' + host + 'Status"[^>]*role="status"[^>]*aria-live="polite"'));
    const container = html.match(new RegExp('<div[^>]*id="' + host + '"[^>]*>'))?.[0];
    assert.ok(container); assert.doesNotMatch(container, /role="status"|aria-live/);
  }
});

test('staff and billing statuses distinguish empty source, identity refusal and cooldown after replacing old facts', async () => {
  for (const kind of ['caregiver', 'billing']) for (const outcome of ['empty', 'refusal', 'quota']) {
    const pending = deferred(); let first = true;
    const app = await relatedFixture(input => { if (first) { first = false; return response(relatedPayload(input)); } return pending.promise; });
    const host = kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts';
    const control = relatedButton(app, kind); await clickNode(control); await tick(); await tick();
    assert.ok(descendants(app.element(host)).some(n => n.tagName === 'TABLE'));
    control.focus(); await clickNode(control); await tick();
    assert.match(app.element(host + 'Status').textContent, /Reading current source/);
    assert.ok(!descendants(app.element(host)).some(n => n.tagName === 'TABLE'));
    const error = outcome === 'empty' ? 'visit_context_source_empty' : kind === 'caregiver' ? 'caregiver_office_mismatch' : 'billing_visit_patient_mismatch';
    const result = response({ ok: false, error, ...(outcome === 'quota' ? { retryAfterSeconds: 60 } : {}) });
    result.ok = false; result.status = outcome === 'quota' ? 429 : 409;
    pending.resolve(result); await tick(); await tick();
    const status = app.element(host + 'Status').textContent;
    assert.match(status, outcome === 'empty' ? /This read returned no/ : outcome === 'quota' ? /Retry in 60 seconds/ : /could not be verified|did not match/);
    assert.doesNotMatch(status, /Synthetic caregiver|900001|Billed amount/);
    assert.ok(!descendants(app.element(host)).some(n => n.tagName === 'TABLE'));
    assert.equal(app.document.activeElement, control);
    const calls = app.calls.filter(c => c.path.endsWith('/workspace/visit-context')).length;
    assert.equal(calls, 2);
    if (outcome === 'quota') { await clickNode(control); await tick(); assert.equal(app.calls.filter(c => c.path.endsWith('/workspace/visit-context')).length, calls); }
  }
});

test('staff and billing statuses cannot restore old source messages after a late response crosses a context boundary', async () => {
  for (const kind of ['caregiver', 'billing']) for (const change of ['clear', 'date', 'demo', 'office', 'session']) {
    const pending = deferred(); let scope;
    const app = await relatedFixture(input => { scope = input; return pending.promise; });
    if (change === 'office') app.window.primetimeDataMode.observeScope({ revision: 1, officeId: '123', officeTimezone: 'America/Chicago' });
    const host = kind === 'caregiver' ? 'dashboardCaregiverProfile' : 'dashboardBillingFacts';
    await clickNode(relatedButton(app, kind)); await tick();
    assert.match(app.element(host + 'Status').textContent, /Reading current source/);
    if (change === 'clear') await app.click('dashboardVisitClear');
    if (change === 'date') { app.element('dashboardVisitDate').value = '2026-10-23'; for (const fn of app.element('dashboardVisitDate').handlers.get('change')) fn(new Event('change')); }
    if (change === 'demo') app.window.primetimeDataMode.setMode('demo');
    if (change === 'office') app.window.primetimeDataMode.observeScope({ revision: 2, officeId: '999', officeTimezone: 'America/Chicago' });
    if (change === 'session') app.dispatch('primetime-signed-out');
    await tick(); await tick(); const before = app.element(host + 'Status').textContent;
    assert.doesNotMatch(before, /Reading current source/, kind + '/' + change);
    pending.resolve(response(relatedPayload(scope))); await tick(); await tick();
    assert.equal(app.element(host + 'Status').textContent, before, kind + '/' + change);
    assert.doesNotMatch(nodeText(app.element(host)), /Synthetic caregiver|Billed amount \(source\) 0/);
    assert.equal(app.calls.filter(c => c.path.endsWith('/workspace/visit-context')).length, 1);
  }
});
