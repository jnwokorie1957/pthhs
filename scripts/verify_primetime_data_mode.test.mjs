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
    getElementById: element, createElement: () => node(), createElementNS: () => node(), createTextNode: text => ({ textContent: text }),
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
    window, document, element, calls, events, auth, context,
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
  assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-1048/);
  await app.click('dashboardVisitNext');
  assert.match(nodeText(app.element('dashboardVisitRows')), /DEMO-V-1058/);
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
