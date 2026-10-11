import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const asset = name => readFileSync(new URL(`../public/primetime/${name}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));
const scope = { officeId: '123', date: '2026-10-11', timezone: 'America/Chicago', revision: 1 };
const status = { ok: true, mode: 'live', officeId: '123', dataApproved: true, sourceWritesEnabled: false, capabilities: { diagnosis: true, records: true, monitoring: false, sms: false }, sourceAcceptance: { version: 'accepted-v1', reference: 'Owner acceptance', validUntil: '2026-11-11T00:00:00Z' }, earlyReminderConfigured: false, blockedReason: null };
function visits(date = scope.date) {
  const visitScope = { ...scope, date };
  return { ok: true, mode: 'live', source: 'hhaexchange', scope: visitScope, evaluatedAt: '2026-10-11T15:00:00Z', discovery: 'a'.repeat(64), nextOffset: null, completeness: { complete: false, truncated: false }, items: [{
    evidence: { visitId: '55', scope: visitScope, state: 'ready', patientId: '77', caregiverId: '44', reasons: [], raw: { ScheduleStartTime: 'Original source start', EVVEndTime: null }, provenance: { operation: 'GetVisitInfoV3', fetchedAt: '2026-10-11T15:00:00Z', acceptanceVersion: 'v1', sourceRevision: 'b'.repeat(64) }, times: { scheduledStart: { raw: date + 'T08:00:00-05:00', iso: date + 'T13:00:00Z' }, scheduledEnd: { raw: date + 'T12:00:00-05:00', iso: date + 'T17:00:00Z' }, actualStart: null, actualEnd: null, evvStart: null, evvEnd: null } },
    diagnosis: { visitId: '55', scope: visitScope, state: 'ready', verification: 'blocked', sourceMutationPermitted: false, metrics: { scheduledMinutes: 240, actualMinutes: null, evvMinutes: null, varianceMinutes: null }, issues: [{ id: 'missing', kind: 'no_punches', level: 'blocker', summary: 'Missing punches', nextAction: 'Review the device codes.', reasonCodeCandidates: ['110A'], suggestedNote: 'Review this suggestion.', facts: { scheduledMinutes: 240 } }] }
  }] };
}
const page = items => ({ ok: true, mode: 'live', source: 'primetime', items, nextCursor: null });
const exception = { id: 'ex-1', officeId: '123', revision: 1, visitId: '55', diagnosis: 'Missing punches', state: 'open', followUpAt: null, assignee: 'Supervisor', hhaVerification: 'not_established' };
function pure() { const window = {}; vm.runInNewContext(asset('revisions.js'), { window, URLSearchParams }); return window.primetimeRevisionModel; }

test('readable clock labels retain office timezone and cross-date context without guessing live offsets', () => {
  const clock = pure().formatClock, options = { timezone: 'America/Chicago', serviceDate: '2026-10-11' };
  assert.equal(clock({ raw: 'source original', iso: '2026-10-11T13:00:00Z' }, options), '8:00 AM CDT');
  assert.equal(clock({ raw: 'source original', iso: '2026-10-12T06:00:00Z' }, options), 'Oct 12 · 1:00 AM CDT');
  assert.equal(clock({ raw: '2026-10-11T08:00:00', iso: null }, options), '2026-10-11T08:00:00');
  assert.equal(clock({ raw: '2026-10-11T08:00:00', iso: null }, { ...options, synthetic: true }), '8:00 AM');
  assert.equal(clock(null, options), 'Unavailable');
  assert.equal(clock({ raw: 'original', iso: '2026-11-01T07:30:00Z' }, { ...options, serviceDate: '2026-11-01' }), '1:30 AM CST');
});

test('visit normalization keeps scope, source times and separate durations without a verified inference', () => {
  const result = pure().normalizeVisits(visits(), { ...scope, offset: 0 });
  assert.equal(result.items[0].diagnosis.verification, 'blocked');
  assert.equal(result.items[0].diagnosis.metrics.scheduledMinutes, 240);
  assert.equal(result.items[0].diagnosis.metrics.actualMinutes, null);
  assert.equal(result.items[0].evidence.rawTimes.ScheduleStartTime, 'Original source start');
  assert.equal(result.items[0].evidence.provenance.sourceRevision, 'b'.repeat(64));
  assert.equal(result.items[0].diagnosis.issues[0].reasonCodeCandidates[0], '110A');
  assert.equal(result.items[0].evidence.raw, undefined);
});
test('visit normalization rejects wrong scopes, synthetic identifiers, unsafe claims and oversized pages', () => {
  const model = pure();
  const mutations = [v => v.mode = 'demo', v => v.source = 'synthetic', v => v.scope.officeId = '999', v => v.scope.date = '2026-10-10',
    v => v.items[0].evidence.scope.officeId = '999', v => v.items[0].diagnosis.visitId = '999', v => v.items[0].evidence.visitId = 'DEMO-V-1',
    v => v.items[0].diagnosis.sourceMutationPermitted = true, v => { v.items[0].evidence.state = 'unaccepted'; v.items[0].diagnosis.verification = 'verified'; },
    v => v.items = Array(11).fill(v.items[0]), v => v.items.push(clone(v.items[0])), v => v.completeness.complete = true, v => v.nextOffset = 0,
    v => v.items[0].diagnosis.issues[0].reasonCodeCandidates = ['invented']];
  for (const mutate of mutations) { const value = clone(visits()); mutate(value); assert.throws(() => model.normalizeVisits(value, { ...scope, offset: 0 })); }
});
test('search and severity use only the current page and preserve multiple issues', () => {
  const model = pure(), normalized = model.normalizeVisits(visits(), { ...scope, offset: 0 });
  assert.equal(model.filterVisits(normalized.items, 'device codes', 'blocker').length, 1);
  assert.equal(model.filterVisits(normalized.items, '77', 'attention').length, 1);
  assert.equal(model.filterVisits(normalized.items, '', 'verified').length, 0);
  assert.equal(model.filterVisits(normalized.items, '', 'unknown').length, 0);
  assert.equal(model.filterVisits(normalized.items, 'unrelated', 'all').length, 0);
});
test('recurrence has no universal default and initial orientation remains one-time', () => {
  const model = pure();
  const fields = { type: 'supervisory_visit', subjectKind: 'member', subjectId: '77', program: 'Program', service: 'PAS', assignedSupervisor: 'Supervisor', ruleReference: 'Program rule', cadenceMonths: '', anchorMode: 'fixed_due_date', anchorDate: '2024-01-31', effectiveFrom: '2024-01-01', effectiveUntil: '', note: 'Reviewed configuration' };
  assert.equal(model.requirementInput(fields, '123', 'req-1').cadenceMonths, null);
  assert.equal(model.requirementInput({ ...fields, cadenceMonths: '6' }, '123', 'req-1').cadenceMonths, 6);
  assert.equal(model.requirementInput({ ...fields, type: 'initial_orientation', cadenceMonths: '6' }, '123', 'req-1').cadenceMonths, null);
  for (const edit of [{ cadenceMonths: '1.5' }, { cadenceMonths: '121' }, { anchorDate: '2023-02-29' }, { subjectId: 'DEMO-P-1' }]) assert.throws(() => model.requirementInput({ ...fields, ...edit }, '123', 'req-1'));
});
test('persisted records reject foreign office, synthetic IDs and HHA verification claims', () => {
  const model = pure();
  assert.equal(model.normalizeRecords(page([exception]), 'exceptions', '123').items[0].revision, 1);
  for (const edit of [{ officeId: '999' }, { id: 'DEMO-ex-1' }, { visitId: 'DEMO-V-1' }, { hhaVerification: 'verified' }, { revision: 0 }]) assert.throws(() => model.normalizeRecords(page([{ ...exception, ...edit }]), 'exceptions', '123'));
});

function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function harness(custom) {
  const elements = new Map(), listeners = new Map(), calls = [];
  function node(tag = 'div') {
    const classes = new Set();
    const item = { tag, children: [], handlers: new Map(), value: '', disabled: false, hidden: false, className: '', ownText: '',
      classList: { contains: name => classes.has(name), add: name => classes.add(name) },
      append(...children) { this.children.push(...children); if (this.tag === 'select' && !this.value) this.value = this.children[0]?.value || ''; },
      replaceChildren(...children) { this.children = children; this.ownText = ''; }, setAttribute(name, value) { this[name] = value; },
      addEventListener(type, fn) { const list = this.handlers.get(type) || []; list.push(fn); this.handlers.set(type, list); },
      querySelector(selector) { return descendants(this).find(child => selector === '.revision-form-message' && child.className === 'revision-form-message') || null; },
      reset() { for (const field of this.elements) field.value = ''; }
    };
    Object.defineProperty(item, 'textContent', { get() { return this.ownText + this.children.map(child => child.textContent || '').join(' '); }, set(value) { this.ownText = String(value); this.children = []; } });
    Object.defineProperty(item, 'elements', { get() { return descendants(this).filter(child => ['input', 'select', 'textarea', 'button'].includes(child.tag)); } });
    return item;
  }
  function descendants(item) { return item.children.flatMap(child => [child, ...descendants(child)]); }
  const element = id => { if (!elements.has(id)) elements.set(id, node(id === 'revisionRequirementForm' ? 'form' : 'div')); return elements.get(id); };
  const document = { getElementById: element, createElement: node, addEventListener(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); }, dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); return true; } };
  const window = { sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
  window.primetimeApiFetch = async (path, options = {}) => {
    calls.push({ path, options });
    const customResponse = await custom?.(path, options);
    if (customResponse) return customResponse;
    const url = new URL(path, 'https://fixture.test');
    const payload = url.pathname.endsWith('/status') ? status : url.pathname.endsWith('/visits') ? visits(url.searchParams.get('date')) : url.pathname.endsWith('/exceptions') ? page([exception]) : options.method === 'POST' ? { ok: true, mode: 'live', source: 'primetime', ...exception, revision: 2 } : page([]);
    return { ok: true, json: async () => clone(payload) };
  };
  const context = vm.createContext({ window, document, Event, URLSearchParams, AbortController, crypto: { randomUUID: () => 'new-fixture-id' }, console });
  vm.runInContext(asset('data-source.js'), context); vm.runInContext(asset('demo-data.js'), context); vm.runInContext(asset('revisions.js'), context);
  const emit = (type, detail) => { const event = new Event(type); event.detail = detail; document.dispatchEvent(event); };
  return { element, window, calls, descendants, emit,
    async openLive() { emit('primetime-ready'); window.primetimeDataMode.setMode('live'); emit('primetime-view-changed', { view: 'revisions' }); await tick(); await tick(); },
    async click(id) { for (const fn of element(id).handlers.get('click') || []) await fn({ currentTarget: element(id), preventDefault() {} }); },
    async submit(form) { for (const fn of form.handlers.get('submit') || []) await fn({ currentTarget: form, preventDefault() {} }); },
    async change(id) { for (const fn of element(id).handlers.get('change') || []) await fn({ currentTarget: element(id) }); },
    text(id) { return element(id).textContent; }
  };
}
test('Demo uses shared fixtures without any API request and clears immediately in Live', async () => {
  const app = harness(); app.emit('primetime-ready'); app.emit('primetime-view-changed', { view: 'revisions' });
  assert.ok(app.text('revisionDetail').includes('DEMO-V-')); assert.equal(app.calls.length, 0);
  app.window.primetimeDataMode.setMode('live');
  assert.ok(!app.text('revisionDetail').includes('DEMO-')); assert.ok(!app.text('revisionVisits').includes('Synthetic'));
  await tick(); await tick(); assert.ok(app.text('revisionDetail').includes('55')); assert.ok(app.text('revisionDetail').includes('4.00 h'));
});
test('an unapproved Live status prevents all protected data reads', async () => {
  const app = harness(path => path.endsWith('/status') ? { ok: true, json: async () => ({ ...clone(status), dataApproved: false, capabilities: { diagnosis: false, records: false, monitoring: false, sms: false }, blockedReason: 'operational_data_release_not_approved' }) } : null);
  await app.openLive(); assert.equal(app.calls.length, 1); assert.ok(app.text('revisionStatus').includes('not been approved')); assert.ok(!app.text('revisionVisits').includes('DEMO-'));
});
test('Live reads run only in the selected panel; source text never becomes HTML', async () => {
  const payload = visits(); payload.items[0].diagnosis.issues[0].summary = '<img src=x onerror=alert(1)>';
  const app = harness(path => path.includes('/visits?') ? { ok: true, json: async () => payload } : null);
  app.emit('primetime-ready'); app.window.primetimeDataMode.setMode('live'); await tick(); assert.equal(app.calls.length, 0);
  app.emit('primetime-view-changed', { view: 'revisions' }); await tick(); await tick();
  assert.ok(app.text('revisionDetail').includes('<img src=x onerror=alert(1)>'));
  assert.equal(app.descendants(app.element('revisionDetail')).filter(item => item.tag === 'img').length, 0);
  assert.ok(app.text('revisionDetail').includes('Suggestions requiring human review'));
});
for (const transition of ['demo', 'signed-out', 'date', 'away']) test(`pending source response cannot repaint after ${transition}`, async () => {
  const wait = deferred(); const app = harness(path => path.includes('/visits?') ? { ok: true, json: () => wait.promise } : null);
  await app.openLive(); const oldDate = app.element('revisionDate').value;
  if (transition === 'demo') app.window.primetimeDataMode.setMode('demo');
  if (transition === 'signed-out') app.emit('primetime-signed-out');
  if (transition === 'date') { app.element('revisionDate').value = '2026-10-12'; await app.change('revisionDate'); }
  if (transition === 'away') app.emit('primetime-view-changed', { view: 'overview' });
  wait.resolve(visits(oldDate)); await tick(); await tick();
  assert.ok(!app.text('revisionDetail').includes('Original source start'));
  if (transition === 'demo') assert.ok(app.text('revisionDetail').includes('DEMO-V-'));
});
test('exception review requires an inline note and sends only scoped versioned office review', async () => {
  const app = harness(); await app.openLive();
  const form = app.descendants(app.element('revisionExceptions')).find(item => item.tag === 'form');
  await app.submit(form); assert.equal(app.calls.filter(call => call.options.method === 'POST').length, 0);
  form.elements.find(item => item.tag === 'textarea').value = 'Reviewed the original evidence with the supervisor.';
  form.elements.find(item => item.tag === 'select').value = 'resolve'; await app.submit(form);
  const writes = app.calls.filter(call => call.options.method === 'POST'); assert.equal(writes.length, 1);
  assert.ok(writes[0].path.endsWith('/exceptions/review'));
  assert.deepEqual(JSON.parse(writes[0].options.body), { id: 'ex-1', revision: 1, officeId: '123', action: 'resolve', note: 'Reviewed the original evidence with the supervisor.' });
  assert.ok(!writes[0].options.body.includes('sourceValidation'));
});
test('failed Live reads show unavailable rather than falling back to samples', async () => {
  const app = harness(path => path.includes('/visits?') ? { ok: false, json: async () => ({ ok: false, error: 'source_unavailable' }) } : null);
  await app.openLive(); assert.ok(app.text('revisionVisits').includes('could not be completed')); assert.ok(!app.text('revisionDetail').includes('DEMO-')); assert.equal(app.element('revisionNext').hidden, true);
});

test('next visits preserve date and discovery and replace the bounded page', async () => {
  const app = harness(path => {
    if (!path.includes('/visits?')) return null;
    const url = new URL(path, 'https://fixture.test'), payload = visits(url.searchParams.get('date'));
    if (url.searchParams.get('offset') === '0') payload.nextOffset = 10;
    else { payload.items[0].evidence.visitId = '56'; payload.items[0].diagnosis.visitId = '56'; }
    return { ok: true, json: async () => payload };
  });
  await app.openLive(); assert.equal(app.element('revisionNext').hidden, false); const date = app.element('revisionDate').value;
  await app.click('revisionNext');
  const request = new URL(app.calls.filter(call => call.path.includes('/visits?')).at(-1).path, 'https://fixture.test');
  assert.equal(request.searchParams.get('date'), date); assert.equal(request.searchParams.get('offset'), '10'); assert.equal(request.searchParams.get('discovery'), 'a'.repeat(64));
  assert.ok(app.text('revisionDetail').includes('56')); assert.equal(app.element('revisionNext').hidden, true);
});

test('record paging keeps opaque cursors and only eligible office-review actions', async () => {
  const app = harness(path => {
    if (!path.includes('/exceptions')) return null;
    const url = new URL(path, 'https://fixture.test');
    return { ok: true, json: async () => ({ ...page([{ ...exception, state: url.searchParams.has('cursor') ? 'in_review' : 'open' }]), nextCursor: url.searchParams.has('cursor') ? null : 'opaque/+==' }) };
  });
  await app.openLive(); await app.click('revisionExceptionsNext');
  const request = new URL(app.calls.filter(call => call.path.includes('/exceptions')).at(-1).path, 'https://fixture.test');
  assert.equal(request.searchParams.get('cursor'), 'opaque/+==');
  const select = app.descendants(app.element('revisionExceptions')).find(item => item.tag === 'select');
  assert.deepEqual(select.children.map(option => option.value), ['resolve']);
});

test('a changed approval or source policy clears every persisted area and creation controls', async () => {
  const app = harness(path => path.includes('/visits?') ? { ok: false, json: async () => ({ ok: false, error: 'revision_policy_changed_restart' }) } : null);
  await app.openLive();
  assert.ok(app.text('revisionStatus').includes('Refresh to start again'));
  for (const id of ['revisionVisits', 'revisionDetail', 'revisionExceptions', 'revisionRequirements', 'revisionNotifications']) assert.ok(app.text(id).includes('Access or source scope changed'));
  assert.equal(app.element('revisionCreateRequirement').hidden, true);
});

test('provider acceptance is displayed separately from delivery and office acknowledgement', async () => {
  const app = harness(path => path.endsWith('/notifications') ? { ok: true, json: async () => page([{ id: 'c'.repeat(64), officeId: '123', revision: 1, visitId: '55', rule: 'missing_clock_out', state: 'accepted', plannedSendAt: '2026-10-11T15:00:00Z', deadlineAt: null, acknowledgement: null }]) } : null);
  await app.openLive(); assert.ok(app.text('revisionNotifications').includes('Provider accepted · delivery unconfirmed'));
  assert.ok(app.text('revisionNotifications').includes('Acknowledge office alert'));
  assert.ok(!app.text('revisionNotifications').includes('Delivery confirmed'));
});

test('a late office-review response cannot restore records after switching to Demo', async () => {
  const wait = deferred();
  const app = harness((_path, options) => options.method === 'POST' ? { ok: true, json: () => wait.promise } : null);
  await app.openLive(); const form = app.descendants(app.element('revisionExceptions')).find(item => item.tag === 'form');
  form.elements.find(item => item.tag === 'textarea').value = 'Reviewed source evidence.';
  const save = app.submit(form); await tick(); app.window.primetimeDataMode.setMode('demo');
  wait.resolve({ ok: true, mode: 'live', source: 'primetime', ...exception, revision: 2 }); await save;
  assert.ok(app.text('revisionDetail').includes('DEMO-V-')); assert.ok(!app.text('revisionExceptions').includes('Missing punches'));
});
