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
      querySelectorAll() { return []; }, querySelector() { return null; }, closest() { return { hidden: false }; },
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
  vm.runInNewContext(asset('demo-data.js'), { window });
  vm.runInNewContext(asset('dashboard.js'), { window });
  return window;
}

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
const liveMetadata = { ok: true, mode: 'live', dataApproved: true, settings: { officeId: '123', officeTimezone: 'America/Chicago' }, panels: { visits: { available: true } } };

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
    payload.discovery = { fingerprint: 'a'.repeat(64), selectedCount: 23, truncated: false };
    payload.page = { offset: 0, selectedCount: 1, returnedCount: 1, unavailableCount: 0, nextOffset: 1 };
    payload.state = 'partial'; payload.nextCursor = 'next-page';
    return response(payload);
  } });
  installDashboard(app); await app.signIn(); await tick(); await tick();
  assert.equal(app.window.primetimeDataMode.getMode(), 'live');
  assert.equal(app.element('demoDataToggle').checked, false);
  for (const id of ['dashboardTimeline', 'dashboardOverviewExceptions']) assert.match(nodeText(app.element(id)), /900001/);
  assert.match(nodeText(app.element('dashboardOverviewMetrics')), /23/);
  assert.match(nodeText(app.element('dashboardOverviewMetrics')), /not an operational total/);
  assert.match(nodeText(app.element('dashboardCoverage')), /1 \/ 1/);
  assert.match(nodeText(app.element('dashboardEvidenceChart')), /EVV start/);
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /1–1 of 23/);
  assert.match(app.element('dashboardOverviewScope').textContent, /Office: 123.*Date:.*America\/Chicago/);
  assert.equal(app.element('dashboardOverviewDate').value, app.element('dashboardVisitDate').value);
  assert.equal(app.element('dashboardOverviewNext').hidden, false);
  assert.equal(app.element('dashboardVisitNext').hidden, false);
  assert.equal(nodeText(app.element('dashboardOverviewMetrics')).includes('DEMO'), false);
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
  assert.match(app.element('dashboardOverviewStatus').textContent, /No visit identifiers returned/);
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
    assert.match(html, new RegExp(`id="${id}"[^>]*>Read source now</button>`));
  }
  assert.match(html, /Persisted import history/);
  assert.match(html, /Check connection and history/);
  assert.match(html, /CSV upload and starting an import are not available/);
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
      assert.equal(app.element(id).textContent, 'Read source now');
      await app.click(id); await tick(); await tick();
    }
    assert.equal(app.element('integrationSyncDetails').textContent, history);
    for (const prefix of ['dashboardOverview', 'dashboardVisit']) {
      assert.match(app.element(prefix + 'Metadata').textContent, /on-demand read, not a persisted visit import/);
      assert.match(app.element(prefix + 'Metadata').textContent, /source unvalidated/);
      assert.match(app.element(prefix + 'Metadata').textContent, state === 'empty' ? /fetched: Unavailable/ : /fetched: 2026-10-10T08:00:00Z/);
      assert.match(app.element(prefix + 'Completeness').textContent, /Office totals are unknown/);
      assert.match(app.element(prefix + 'Completeness').textContent, /200 source IDs, 10 details per page and a 25-second detail-read budget/);
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
  assert.match(app.element('dashboardOverviewCompleteness').textContent, /2–2 of 3/);
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
function connectedWorkspace({ dataApproved = true, enabledReads = ['GetPatientDemographics', 'GetVisitInfoV3'], preview = livePreview, history = () => response({ ok: true, items: [], nextCursor: null, source: 'manual_snapshot' }), authorizations = () => response({ ok: false, error: 'read_not_owner_enabled' }), patientVisit = () => response({ ok: false, error: 'read_not_owner_enabled' }) } = {}) {
  const settings = { revision: 1, officeId: '123', officeTimezone: 'America/Chicago', policyReference: '', enabledReads };
  const app = harness({ storedDataMode: null, metadata: liveMetadata, fetchSource: (path, options) => {
    if (path.endsWith('/settings')) return response({ ok: true, settings, dataApproved, supportedReads: [], readInputs: {
      GetPatientDemographics: ['id'], GetCaregiverDemographics: ['id'], GetVisitInfoV3: ['id'], SearchPatientAuthorizations: ['patientId'], GetPatientAuthorizationInfo: ['patientId', 'id']
    } });
    if (path.includes('/views/visits?')) return response(preview(new URL(path, 'https://fixture.test').searchParams.get('date')));
    if (path.endsWith('/workspace/read')) return response({ ok: true, operation: JSON.parse(options.body).operation, fetchedAt: '2026-10-10T08:00:00Z', records: [] });
    if (path.includes('/workspace/manual-snapshots')) return history(path, options);
    if (path.endsWith('/workspace/patient-authorizations')) return authorizations(path, options);
    if (path.endsWith('/workspace/patient-visit')) return patientVisit(path, options);
    return response({ ok: true });
  } });
  installDashboard(app); vm.runInContext(asset('workspace.js'), app.context);
  return app;
}

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

test('current fetch age advances locally with explicit device-clock scope and unchanged source evidence', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');data.fetchedAt='2026-10-19T18:18:00-05:00';
  const original=JSON.stringify(data),app=connectedWorkspace({history:savedHistory(),patientVisit:()=>response(data)});
  const clock=deviceClock(app,'2026-10-19T23:18:30Z');await openSavedHistory(app);
  const cells=savedCells(app);await clickNode(currentVisitButtons(app)[0]);await tick();
  const age=currentFetchAges(app)[0],raw=currentRawFields(app),focus=app.document.activeElement;
  assert.match(age.textContent,/Approximate fetch age: less than 1 min/);assert.equal(age['aria-live'],'off');assert.equal(age.role,undefined);
  assert.match(age.textContent,/Uses this device clock.*locally each minute.*explicit read/);
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
    const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>response(data)});deviceClock(app,'2026-10-19T23:19:00Z');
    await openSavedHistory(app);await clickNode(currentVisitButtons(app)[0]);await tick();
    assert.match(currentFetchAges(app)[0].textContent,/unavailable \(missing or invalid fetch timestamp\)/);
    assert.equal(app.intervals.size,0);assert.equal(currentRawFields(app).ScheduleStartTime,'2026-10-19T23:18:00Z');
    assert.equal(currentVisitCalls(app).length,1);
  }
});

test('future fetches and invalid or changed device clocks are explicit and recover without refetching', async () => {
  const data=currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61');data.fetchedAt='2026-10-19T23:18:00Z';
  const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>response(data)}),clock=deviceClock(app,'2026-10-19T23:17:59Z');
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
    const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>hold?pending.promise:response(source('2026-10-19T23:18:00Z'))});
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
    const app=connectedWorkspace({history:savedHistory(pagedSavedSnapshot()),patientVisit:(_path,options)=>response({...currentCaregiverSource(JSON.parse(options.body),'61'),fetchedAt:'2026-10-19T23:18:00Z'})});
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
    const app=connectedWorkspace({history:savedHistory(),patientVisit:()=>pending[index++].promise}),clock=deviceClock(app,'2026-10-19T23:20:00Z');
    await openSavedHistory(app);const visit=currentVisitButtons(app)[0],first=clickNode(visit);await tick();const second=clickNode(visit);await tick();
    const source=at=>({...currentCaregiverSource({visitId:'11',patientId:'5',officeId:'123'},'61'),fetchedAt:at});
    pending[1].resolve(response(source('2026-10-19T23:19:00Z')));await second;await tick();const latest=currentFetchAges(app)[0];
    assert.match(latest.textContent,/fetch age: 1 min/);assert.equal(app.intervals.size,1);
    pending[0].resolve(response(failure?{ok:false,error:'patient_office_mismatch'}:source('2026-10-19T23:18:00Z')));await first;await tick();
    assert.equal(currentFetchAges(app)[0],latest);assert.equal(app.intervals.size,1);
    clock.set('2026-10-19T23:21:00Z');clock.run();assert.match(latest.textContent,/fetch age: 2 min/);
  }
});

const authorizationButtons = (app, host = 'dashboardTimeline') => descendants(app.element(host)).filter(node => node.textContent === 'Open patient authorizations');
const detailButtons = app => descendants(app.element('readResults')).filter(node => node.textContent === 'Select authorization detail');
const authorizationCalls = app => app.calls.filter(call => call.path.endsWith('/workspace/patient-authorizations'));
const authSource = (input, changes = {}) => ({ ok: true, operation: input.operation, scope: { officeId: input.officeId, patientId: input.patientId }, source: 'hhaexchange', interpretation: 'authorization_limits_unvalidated', fetchedAt: '2026-10-15T19:16:00.000Z', truncated: true, records: [
  { ID: '71', ContractID: '81', ContractName: 'Same synthetic name', StartDate: '2026-10-01', StopDate: '2026-10-31' },
  { ID: '72', ContractID: '82', ContractName: 'Same synthetic name', StartDate: '2026-10-01', StopDate: '2026-10-31' }
], ...changes });
async function submitRead(app) { for (const fn of app.element('readForm').handlers.get('submit')) fn({ preventDefault() {} }); await tick(); await tick(); }
async function startAuthorizationRead(app, host) { await clickNode(authorizationButtons(app, host)[0]); await submitRead(app); }

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
