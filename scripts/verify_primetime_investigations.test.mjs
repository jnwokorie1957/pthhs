import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const now = Date.parse('2026-10-15T16:45:00Z');
class FixtureDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const tick = () => new Promise(resolve => setImmediate(resolve));
const pending = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const record = (id, changes = {}) => ({ id, revision: 1, title: `Synthetic ${id}`, visitId: '77', status: 'open', assignee: '', followUpAt: null, events: [{ actor: 'synthetic-reviewer', at: '2026-10-01T12:00:00Z', action: 'open', note: 'Synthetic history' }], ...changes });
const text = node => [node.textContent || '', ...(node.children || []).map(text)].join(' ');
const descendants = node => [node, ...(node.children || []).flatMap(descendants)];

async function harness(readQueue) {
  const elements = new Map(), events = new Map(), calls = [];
  const node = (id = '') => ({ id, children: [], handlers: new Map(), options: [], value: '', hidden: id === 'appShell', dataset: {}, textContent: '',
    classList: { add() {}, remove() {}, toggle() {} }, addEventListener(event, handler) { this.handlers.set(event, handler); },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, querySelectorAll() { return []; },
    querySelector() { return null; }, closest() { return { hidden: false }; }, reset() {}, focus() { this.focused = true; }, setAttribute() {} });
  const get = id => { if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); };
  const mode = { live: true, active: true, approved: true };
  get('openInvestigationWorkflow').dataset.workflow = 'investigations';
  const document = { getElementById: get, querySelectorAll: selector => selector === '[data-workflow]' ? [get('openInvestigationWorkflow')] : [], createElement: () => node(), createTextNode: text => ({ textContent: text }), addEventListener(event, handler) { events.set(event, handler); } };
  const window = { primetimeDataMode: { isLive: () => mode.live, isActive: () => mode.active }, async primetimeApiFetch(path, options) {
    calls.push({ path, options });
    const data = path.endsWith('/settings') ? { settings: { revision: 1, officeId: '12', enabledReads: [], policyReference: '' }, dataApproved: mode.approved, supportedReads: [] }
      : await readQueue(path, options);
    return { ok: data.ok !== false, json: async () => ({ ok: true, ...data }) };
  } };
  const isolatedMode = window.primetimeDataMode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/data-source.js', import.meta.url), 'utf8'), { document, window, Event, Date: FixtureDate });
  window.primetimeDataMode = isolatedMode;
  vm.runInNewContext(readFileSync(new URL('../public/primetime/workspace.js', import.meta.url), 'utf8'), { document, window, URLSearchParams, Date: FixtureDate, console });
  const emit = async event => { events.get(event)?.(); await tick(); await tick(); };
  const fire = async control => { control.handlers.get('click')?.({}); await tick(); await tick(); };
  await emit('primetime-ready');
  return { get, calls, mode, emit, fire, load: () => fire(get('loadInvestigations')),
    summary: () => get('investigationSummary').textContent,
    list: () => text(get('investigationList')),
    buttons: label => descendants(get('investigationList')).filter(node => node.textContent === label),
    async filter(id, value) { get(id).value = value; get(id).handlers.get('change')(); await tick(); }
  };
}

test('investigation filters compose over loaded rows while counts retain the denominator and timezone boundaries', async () => {
  const rows = [
    record('past', { assignee: 'reviewer', followUpAt: '2026-10-15T10:44:59-06:00' }),
    record('future', { status: 'in_progress', followUpAt: '2026-10-15T18:00:00+01:00' }),
    record('resolved', { status: 'resolved', followUpAt: '2026-10-01T12:00:00Z' }),
    record('missing', { assignee: '  ' }),
    record('invalid', { assignee: 'reviewer', followUpAt: '2026-02-30T12:00:00Z' }),
    record('boundary', { status: 'in_progress', assignee: 'reviewer', followUpAt: '2026-10-15T16:45:00Z' })
  ];
  const app = await harness(() => ({ investigations: rows, nextCursor: null })); await app.load();
  assert.match(app.summary(), /Showing 6 of 6 loaded records · Active 5 · Overdue 1 · Active unassigned 2/);
  assert.match(app.list(), /2026-10-15T10:44:59-06:00 \(overdue\)/);
  assert.match(app.list(), /Synthetic invalid.*Unknown \/ not supplied/);
  const before = app.calls.length;
  await app.filter('investigationFollowUpFilter', 'upcoming'); assert.match(app.summary(), /Showing 2 of 6/);
  await app.filter('investigationFollowUpFilter', 'overdue'); assert.match(app.summary(), /Showing 1 of 6/);
  assert.doesNotMatch(app.list(), /Synthetic resolved/);
  await app.filter('investigationFollowUpFilter', 'unknown'); assert.match(app.summary(), /Showing 2 of 6/);
  await app.filter('investigationStatusFilter', 'active'); await app.filter('investigationAssignmentFilter', 'unassigned');
  assert.match(app.summary(), /Showing 1 of 6/); assert.match(app.list(), /Synthetic missing/); assert.doesNotMatch(app.list(), /Synthetic invalid/);
  assert.equal(app.calls.length, before, 'filtering must not fetch, write, notify or grant access');
});

test('empty filtered pages keep older-page loading and deduplicate overlapping record revisions', async () => {
  const app = await harness(path => path.includes('cursor=older')
    ? { investigations: [record('first', { revision: 0 }), record('second', { revision: 2, status: 'resolved', assignee: 'reviewer' })], nextCursor: null }
    : { investigations: [record('first')], nextCursor: 'older' });
  await app.load(); await app.filter('investigationStatusFilter', 'resolved');
  assert.match(app.list(), /No loaded investigations match/); assert.equal(app.buttons('Load older investigations').length, 1);
  await app.fire(app.buttons('Load older investigations')[0]);
  assert.match(app.summary(), /Showing 1 of 2 loaded/); assert.equal(app.buttons('Load older investigations').length, 0);
  assert.equal(app.buttons('Update investigation').length, 1);
  await app.fire(app.buttons('Update investigation')[0]);
  assert.equal(app.get('investigationId').value, 'second'); assert.equal(app.get('investigationRevision').value, 2);
  assert.equal(app.get('investigationNote').value, '', 'updates require a new note and retain the source revision');
  await app.filter('investigationStatusFilter', 'all');
  await app.fire(app.buttons('Update investigation')[0]); assert.equal(app.get('investigationRevision').value, 1, 'an older overlapping revision cannot replace a newer loaded record');
});

test('refresh clears rows/cursor and fences an earlier page and its detached update controls', async () => {
  const older = pending(); let refresh = false;
  const app = await harness(path => path.includes('cursor=older') ? older.promise : { investigations: [record(refresh ? 'fresh' : 'original')], nextCursor: refresh ? null : 'older' });
  await app.load(); const oldUpdate = app.buttons('Update investigation')[0];
  await app.fire(app.buttons('Load older investigations')[0]);
  refresh = true; await app.load();
  older.resolve({ investigations: [record('late')], nextCursor: 'wrong' }); await tick(); await tick();
  assert.match(app.list(), /Synthetic fresh/); assert.doesNotMatch(app.list(), /Synthetic original|Synthetic late/);
  assert.equal(app.buttons('Load older investigations').length, 0);
  app.get('investigationId').value = 'keep'; await app.fire(oldUpdate); assert.equal(app.get('investigationId').value, 'keep');
  assert.equal(app.calls.filter(call => call.path.includes('/investigations')).at(-1).path.endsWith('/investigations'), true);
});

for (const change of ['sign-out', 'demo', 'office-policy', 'release-locked']) {
  test(`late investigation responses cannot restore records after ${change}`, async () => {
    const wait = pending(); const app = await harness(() => wait.promise); await app.load();
    if (change === 'sign-out') { app.mode.active = false; await app.emit('primetime-signed-out'); }
    else if (change === 'demo') { app.mode.live = false; await app.emit('primetime-data-mode-changed'); }
    else if (change === 'office-policy') await app.emit('primetime-data-mode-changed');
    else { app.mode.approved = false; await app.fire(app.get('reloadWorkspace')); }
    wait.resolve({ investigations: [record('stale')], nextCursor: 'stale' }); await tick(); await tick();
    assert.equal(app.get('investigationList').children.length, 0);
    assert.equal(app.summary(), 'Load queue to review saved investigations.');
    for (const id of ['investigationStatusFilter', 'investigationAssignmentFilter', 'investigationFollowUpFilter']) assert.equal(app.get(id).value, 'all');
    assert.ok(app.calls.every(call => !call.options?.method || call.options.method === 'GET'));
  });
}

test('failed refresh clears previous records and invalid legacy follow-up dates remain unknown', async () => {
  let fail = false;
  const app = await harness(() => fail ? { ok: false, error: 'synthetic_unavailable' } : { investigations: [record('bad-month', { followUpAt: '2026-99-99T00:00:00Z' }), record('no-offset', { followUpAt: '2026-10-01T10:00:00' })], nextCursor: null });
  await app.load(); assert.match(app.summary(), /Overdue 0/);
  await app.filter('investigationFollowUpFilter', 'unknown'); assert.match(app.summary(), /Showing 2 of 2/);
  fail = true; await app.load(); assert.equal(app.get('investigationList').children.length, 0);
  assert.match(app.summary(), /Queue unavailable/);
});

test('the investigation workflow focuses its review filters and performs only a protected queue read', async () => {
  const app = await harness(() => ({ investigations: [], nextCursor: null }));
  await app.fire(app.get('openInvestigationWorkflow'));
  assert.equal(app.get('investigationStatusFilter').focused, true);
  assert.match(app.summary(), /Showing 0 of 0 loaded records/);
  assert.equal(app.calls.filter(call => call.path.endsWith('/investigations')).length, 1);
  assert.ok(app.calls.every(call => !call.options?.method || call.options.method === 'GET'));
});
