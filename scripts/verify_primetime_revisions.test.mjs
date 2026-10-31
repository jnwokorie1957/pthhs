import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const asset = name => readFileSync(new URL(`../public/primetime/${name}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));
const scope = { officeId: '123', date: '2026-10-11', timezone: 'America/Chicago', revision: 1 };
const status = { ok: true, mode: 'live', officeId: '123', dataApproved: true, sourceWritesEnabled: false, capabilities: { diagnosis: true, records: true, monitoring: false, sms: false, notificationRecords: true }, sourceAcceptance: { version: 'accepted-v1', reference: 'Owner acceptance', validUntil: '2026-11-11T00:00:00Z' }, earlyReminderConfigured: false, blockedReason: null };
function visits(date = scope.date) {
  const visitScope = { ...scope, date };
  return { ok: true, mode: 'live', source: 'hhaexchange', scope: visitScope, evaluatedAt: '2026-10-11T15:00:00Z', discovery: 'a'.repeat(64), nextOffset: null, completeness: { complete: false, truncated: false }, items: [{
    evidence: { visitId: '55', scope: visitScope, state: 'ready', patientId: '77', caregiverId: '44', reasons: [], raw: { ScheduleStartTime: 'Original source start', EVVEndTime: null }, provenance: { operation: 'GetVisitInfoV3', fetchedAt: '2026-10-11T15:00:00Z', acceptanceVersion: 'v1', sourceRevision: 'b'.repeat(64) }, times: { scheduledStart: { raw: date + 'T08:00:00-05:00', iso: date + 'T13:00:00Z' }, scheduledEnd: { raw: date + 'T12:00:00-05:00', iso: date + 'T17:00:00Z' }, actualStart: null, actualEnd: null, evvStart: null, evvEnd: null } },
    diagnosis: { visitId: '55', scope: visitScope, state: 'ready', verification: 'blocked', sourceMutationPermitted: false, metrics: { scheduledMinutes: 240, actualMinutes: null, evvMinutes: null, varianceMinutes: null }, issues: [{ id: 'missing', kind: 'no_punches', level: 'blocker', summary: 'Missing punches', nextAction: 'Review the device codes.', reasonCodeCandidates: ['110A'], suggestedNote: 'Review this suggestion.', facts: { scheduledMinutes: 240 } }] }
  }] };
}
const page = items => ({ ok: true, mode: 'live', source: 'primetime', items, nextCursor: null });
const exception = { id: 'ex-1', officeId: '123', revision: 1, visitId: '55', diagnosis: 'Missing punches', state: 'open', followUpAt: null, assignee: 'Supervisor', hhaVerification: 'not_established' };
function pure() {
  const window = {};
  vm.runInNewContext(asset('data-source.js'), { window, document: { getElementById: () => null, addEventListener() {} } });
  vm.runInNewContext(asset('revisions.js'), { window, URLSearchParams }); return window.primetimeRevisionModel;
}

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

function withReceipt() {
  const value = visits(), evidence = value.items[0].evidence;
  evidence.verification = 'verified';
  evidence.verificationReceipt = { state: 'ready', verification: 'verified', scope: { ...scope }, visitId: evidence.visitId, sourceRevision: evidence.provenance.sourceRevision,
    acceptanceVersion: 'receipt-v1', verifiedAt: { iso: '2026-10-11T14:00:00Z' }, reasons: [], receipt: { verifiedBy: '<b>Source reviewer</b>', verifiedDate: '2026-10-11T14:00:00Z', verifiedTime: '14:00', supervisorName: 'Source supervisor', notes: 'Source receipt only' } };
  return value;
}
function withMemberContext() {
  const value = visits();
  const period = { rawStartDate: '2026-01-01', rawEndDate: '2026-12-31', startDate: '2026-01-01', endDate: '2026-12-31', relation: 'within_recorded_period' };
  value.items[0].memberContext = { scope: { ...scope }, patientId: '77', visitId: '55', authorizationWindow: { state: 'ready', relation: 'matched', contractId: '12', serviceCodeId: '13', authorizationIds: ['14'], approval: 'not_established', limitsValidation: 'not_validated', reason: 'recorded_service_contract_period_present_limits_unvalidated' },
    recordedEligibility: { state: 'ready', payerVerified: false, medicaid: { ...period }, managedCare: { ...period } }, completeness: { deferred: false } };
  value.items[0].overlapCoverage = { complete: false, dates: ['2026-10-11', '2026-10-10', '2026-10-12'], discoveredCount: 12, observedCount: 2, reasons: ['details_pending'] };
  return value;
}
test('member joins and overlap progress preserve uncertainty and reject foreign or fabricated approval claims', () => {
  const model = pure(), normalized = model.normalizeVisits(withMemberContext(), { ...scope, offset: 0 });
  assert.equal(normalized.items[0].memberContext.authorization.relation, 'matched');
  assert.equal(normalized.items[0].overlapCoverage.complete, false);
  for (const mutate of [value => value.items[0].memberContext.patientId = '999', value => value.items[0].memberContext.scope.officeId = '999', value => value.items[0].memberContext.authorizationWindow.approval = 'approved',
    value => value.items[0].memberContext.recordedEligibility.payerVerified = true, value => value.items[0].overlapCoverage.observedCount = 13, value => value.items[0].overlapCoverage.dates = ['2026-10-11', '2026-10-09', '2026-10-12']]) {
    const value = withMemberContext(); mutate(value); assert.throws(() => model.normalizeVisits(value, { ...scope, offset: 0 }));
  }
});
test('visit details explain source periods and partial overlap coverage without claiming payer approval', async () => {
  const app = harness(path => path.includes('/visits?') ? { ok: true, json: async () => {
    const value = withMemberContext(), date = app.element('revisionDate').value;
    value.scope.date = date; value.items[0].evidence.scope.date = date; value.items[0].diagnosis.scope.date = date; value.items[0].memberContext.scope.date = date;
    value.items[0].overlapCoverage.dates = [date, new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10), new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)]; return value;
  } } : null);
  await app.openLive(); const text = app.text('revisionDetail');
  for (const expected of ['Authorization and coverage dates', 'limits still need verification', '2026-01-01', 'do not confirm current payer eligibility', '2 of 12 discovered visits', 'Partial; additional checks remain']) assert.ok(text.includes(expected));
  assert.ok(!app.calls.some(call => call.options.method === 'POST'));
});
test('a scoped source receipt stays separate from overall verification and rejects unrelated receipt evidence', () => {
  const model = pure(), value = withReceipt(), normalized = model.normalizeVisits(value, { ...scope, offset: 0 });
  assert.equal(normalized.items[0].diagnosis.verification, 'blocked');
  assert.equal(normalized.items[0].evidence.verificationReceipt.state, 'ready');
  for (const edit of [{ visitId: '56' }, { sourceRevision: 'c'.repeat(64) }, { scope: { ...scope, officeId: '999' } }, { verifiedAt: null }]) {
    const changed = withReceipt(); Object.assign(changed.items[0].evidence.verificationReceipt, edit);
    assert.throws(() => model.normalizeVisits(changed, { ...scope, offset: 0 }));
  }
});

test('receipt details display source text safely without a green or source-write claim', async () => {
  const app = harness(path => path.includes('/visits?') ? { ok: true, json: async () => { const value = withReceipt(), date = app.element('revisionDate').value;
    value.scope.date = date; value.items[0].evidence.scope.date = date; value.items[0].diagnosis.scope.date = date; value.items[0].evidence.verificationReceipt.scope.date = date; return value; } } : null);
  await app.openLive(); const text = app.text('revisionDetail');
  for (const expected of ['HHA verification receipt', 'Accepted source receipt', '<b>Source reviewer</b>', 'does not resolve the other visit checks']) assert.ok(text.includes(expected));
  assert.ok(!app.descendants(app.element('revisionDetail')).some(item => item.innerHTML));
  assert.ok(!app.calls.some(call => call.options.method === 'POST'));
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
  let now = Date.now();
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
  const window = { sessionStorage: { getItem() { return 'demo'; }, setItem() {}, removeItem() {} } };
  window.primetimeApiFetch = async (path, options = {}) => {
    calls.push({ path, options });
    const customResponse = await custom?.(path, options);
    if (customResponse) return customResponse;
    const url = new URL(path, 'https://fixture.test');
    const payload = url.pathname.endsWith('/status') ? status : url.pathname.endsWith('/visits') ? visits(url.searchParams.get('date')) : url.pathname.endsWith('/exceptions') ? page([exception]) : options.method === 'POST' ? { ok: true, mode: 'live', source: 'primetime', ...exception, revision: 2 } : page([]);
    return { ok: true, json: async () => clone(payload) };
  };
  const context = vm.createContext({ window, document, Event, URLSearchParams, AbortController, Date: class extends Date { static now() { return now; } }, crypto: { randomUUID: () => 'new-fixture-id' }, console });
  vm.runInContext(asset('data-source.js'), context); vm.runInContext(asset('demo-data.js'), context); vm.runInContext(asset('revisions.js'), context);
  const emit = (type, detail) => { const event = new Event(type); event.detail = detail; document.dispatchEvent(event); };
  return { element, window, calls, descendants, emit, advance(ms) { now += ms; },
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

test('unaccepted review shows returned HHA times and durations without accepting diagnosis or substituting EVV/pay hours', async () => {
  const app = harness(path => {
    if (!path.includes('/visits?')) return null;
    const payload = visits(new URL(path, 'https://fixture.test').searchParams.get('date'));
    const { evidence, diagnosis } = payload.items[0];
    evidence.state = 'unaccepted'; evidence.provenance.acceptanceVersion = null;
    evidence.patientId = null; evidence.caregiverId = null;
    for (const key of Object.keys(evidence.times)) evidence.times[key] = null;
    evidence.raw = { ScheduleStartTime: '2026-10-11 08:00', ScheduleEndTime: '2026-10-11 12:15', VisitStartTime: '2026-10-11 08:05', VisitEndTime: null,
      EVVStartTime: '2026-10-11 08:06', EVVEndTime: '2026-10-11 12:10', 'ScheduleDuration/ScheduleDurationHours': '4', 'ScheduleDuration/ScheduleDurationMinutes': '15', ActualHours: '0.00', PayHours: '99.00' };
    diagnosis.state = 'unknown'; diagnosis.verification = 'unknown';
    for (const key of Object.keys(diagnosis.metrics)) diagnosis.metrics[key] = null;
    return { ok: true, json: async () => payload };
  });
  await app.openLive();
  assert.match(app.text('revisionVisits'), /2026-10-11 08:00/);
  assert.match(app.text('revisionVisits'), /4 h 15 min · HHA/);
  assert.match(app.text('revisionVisits'), /2026-10-11 08:05 → Unavailable/);
  assert.match(app.text('revisionVisits'), /0\.00 h · HHA/);
  assert.doesNotMatch(app.text('revisionVisits'), /99\.00|Verified/);
  assert.match(app.text('revisionDetail'), /These values do not mark a visit verified or billable/);
  assert.equal(app.calls.some(call => call.options.method === 'POST'), false);
  const before = app.text('revisionVisits');
  app.window.primetimeDataMode.setMode('demo');
  assert.doesNotMatch(app.text('revisionVisits'), /0\.00 h · HHA/);
  assert.match(before, /Unknown evidence/);
});

test('review can show scheduled clock span when HHA omits duration fields while diagnosis stays unknown', async () => {
  const app = harness(path => {
    if (!path.includes('/visits?')) return null;
    const payload = visits(new URL(path, 'https://fixture.test').searchParams.get('date'));
    const { evidence, diagnosis } = payload.items[0];
    evidence.state = 'unaccepted'; evidence.provenance.acceptanceVersion = null;
    evidence.raw = { ScheduleStartTime: '2026-10-11 08:00', ScheduleEndTime: '2026-10-11 12:15', VisitStartTime: '2026-10-11 08:05', VisitEndTime: null };
    for (const key of Object.keys(evidence.times)) evidence.times[key] = null;
    diagnosis.state = 'unknown'; diagnosis.verification = 'unknown';
    for (const key of Object.keys(diagnosis.metrics)) diagnosis.metrics[key] = null;
    return { ok: true, json: async () => payload };
  });
  await app.openLive();
  assert.match(app.text('revisionVisits'), /4\.25 h · source clock span/);
  assert.match(app.text('revisionVisits'), /Actual hours\s+Not supplied by HHA/);
  assert.match(app.text('revisionVisits'), /Unknown evidence/);
});
test('unread review details do not claim HHA omitted times or hours, including when selection changes', async () => {
  for (const state of ['unavailable', 'failed', 'incomplete']) {
    const app = harness(path => {
      if (!path.includes('/visits?')) return null;
      const payload = visits(new URL(path, 'https://fixture.test').searchParams.get('date'));
      const readable = clone(payload.items[0]);
      readable.evidence.visitId = '56'; readable.diagnosis.visitId = '56';
      const { evidence, diagnosis } = payload.items[0];
      Object.assign(evidence, { state, patientId: null, caregiverId: null, raw: null, provenance: null, reasons: ['visit_source_read_failed'] });
      for (const key of Object.keys(evidence.times)) evidence.times[key] = null;
      diagnosis.state = 'unknown'; diagnosis.verification = 'unknown'; diagnosis.issues = [];
      for (const key of Object.keys(diagnosis.metrics)) diagnosis.metrics[key] = null;
      payload.items.push(readable);
      return { ok: true, json: async () => payload };
    });
    await app.openLive();
    const card = app.element('revisionVisits').children[0];
    const facts = app.descendants(card).find(element => element.tag === 'dl');
    assert.deepEqual(facts.children.filter(element => element.tag === 'dd').map(element => element.textContent), Array(4).fill('Source detail unavailable'));
    assert.doesNotMatch(card.textContent, /Not supplied by HHA|Unknown evidence|Original source start/);
    assert.doesNotMatch(app.text('revisionDetail'), /Original source values|Not supplied by HHA|HHA times and duration fields are displayed/);
    assert.match(app.text('revisionDetail'), /Time and duration fields could not be read/);
    assert.match(app.text('revisionDetail'), /visit source read failed/);
    const next = app.descendants(app.element('revisionVisits')).find(element => element['aria-label'] === 'Review details for visit 2');
    for (const handler of next.handlers.get('click') || []) await handler();
    assert.match(app.text('revisionDetail'), /4\.00 h/);
    assert.match(app.text('revisionDetail'), /Actual duration\s+Not supplied by HHA/);
    assert.doesNotMatch(app.text('revisionDetail'), /Time and duration fields could not be read|Source detail unavailable/);
    assert.equal(app.calls.some(call => call.options.method === 'POST'), false);
  }
});

test('a returned source record stays readable when its normalization fails or interpretation is pending', async () => {
  for (const state of ['failed', 'incomplete', 'stale', 'unaccepted']) {
    const app = harness(path => {
      if (!path.includes('/visits?')) return null;
      const payload = visits(new URL(path, 'https://fixture.test').searchParams.get('date'));
      const { evidence, diagnosis } = payload.items[0];
      evidence.state = state;
      evidence.raw = { ScheduleStartTime: 'original unconverted start', ScheduleEndTime: null, VisitStartTime: 'original actual', VisitEndTime: null,
        'ScheduleDuration/ScheduleDurationHours': '0', 'ScheduleDuration/ScheduleDurationMinutes': '0', ActualHours: '0.00' };
      for (const key of Object.keys(evidence.times)) evidence.times[key] = null;
      diagnosis.state = 'unknown'; diagnosis.verification = 'unknown'; diagnosis.issues = [];
      for (const key of Object.keys(diagnosis.metrics)) diagnosis.metrics[key] = null;
      return { ok: true, json: async () => payload };
    });
    await app.openLive();
    assert.match(app.text('revisionVisits'), /original unconverted start → Unavailable/);
    assert.match(app.text('revisionVisits'), /0 h 0 min · HHA/);
    assert.match(app.text('revisionVisits'), /0\.00 h · HHA/);
    assert.match(app.text('revisionDetail'), /Original source values · interpretation pending/);
    assert.doesNotMatch(app.text('revisionVisits'), /Source detail unavailable|Verified/);
    assert.equal(app.calls.some(call => call.options.method === 'POST'), false);
  }
});

test('an unapproved Live status prevents all protected data reads', async () => {
  const app = harness(path => path.endsWith('/status') ? { ok: true, json: async () => ({ ...clone(status), dataApproved: false, capabilities: { diagnosis: false, records: false, monitoring: false, sms: false }, blockedReason: 'operational_data_release_not_approved' }) } : null);
  await app.openLive(); assert.equal(app.calls.length, 1); assert.ok(app.text('revisionStatus').includes('not been approved')); assert.ok(!app.text('revisionVisits').includes('DEMO-'));
});
test('Live reads run only in the selected panel; source text never becomes HTML', async () => {
  const payload = visits(new Date().toLocaleDateString('en-CA')); payload.items[0].diagnosis.issues[0].summary = '<img src=x onerror=alert(1)>';
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
  if (transition === 'date') { app.element('revisionDate').value = new Date(Date.parse(oldDate + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10); await app.change('revisionDate'); }
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

test('a deferred later page retries the same offset and discovery instead of skipping visits or restarting', async () => {
  let nextAttempts = 0;
  const app = harness(path => {
    if (!path.includes('/visits?')) return null;
    const query = new URLSearchParams(path.split('?')[1]);
    if (query.get('offset') === '10') {
      nextAttempts++;
      if (nextAttempts === 1) return { ok: false, json: async () => ({ ok: false, error: 'revision_batch_time_budget_deferred' }) };
      assert.equal(query.get('discovery'), 'a'.repeat(64));
      const value = visits(query.get('date')); value.items[0].evidence.visitId = '56'; value.items[0].diagnosis.visitId = '56';
      return { ok: true, json: async () => value };
    }
    const value = visits(query.get('date')); value.nextOffset = 10;
    return { ok: true, json: async () => value };
  });
  await app.openLive(); const date = app.element('revisionDate').value;
  await app.click('revisionNext');
  assert.ok(app.text('revisionVisits').includes('Wait 60 seconds')); assert.equal(app.text('revisionNext'), 'Retry visits');
  assert.ok(!app.text('revisionDetail').includes('55')); assert.equal(app.element('revisionNext').hidden, false);
  app.advance(60000); await app.click('revisionNext');
  assert.equal(nextAttempts, 2); assert.equal(app.element('revisionDate').value, date); assert.ok(app.text('revisionDetail').includes('56'));
  assert.equal(app.element('revisionNext').hidden, true);
});

test('zero-progress first pages can retry offset zero and mode changes discard the retry', async () => {
  let attempts = 0;
  const app = harness(path => {
    if (!path.includes('/visits?')) return null;
    attempts++; assert.equal(new URLSearchParams(path.split('?')[1]).get('offset'), '0');
    return attempts === 1 ? { ok: false, json: async () => ({ ok: false, error: 'revision_batch_time_budget_deferred' }) } : { ok: true, json: async () => visits(app.element('revisionDate').value) };
  });
  await app.openLive(); assert.equal(app.text('revisionNext'), 'Retry visits');
  app.advance(60000); await app.click('revisionNext'); assert.equal(attempts, 2); assert.ok(app.text('revisionDetail').includes('55'));
  app.window.primetimeDataMode.setMode('demo'); const before = app.calls.length;
  await app.click('revisionNext'); assert.equal(app.calls.length, before); assert.ok(app.text('revisionDetail').includes('DEMO-V-'));
});

test('notification history is not requested without the server capability, while visits still load five at a time', async () => {
  for (const capability of [false, undefined]) {
    const app = harness(path => path.endsWith('/status') ? { ok: true, json: async () => ({ ...clone(status), capabilities: { ...status.capabilities, notificationRecords: capability } }) } : null);
    await app.openLive();
    assert.equal(app.calls.some(call => call.path.includes('/notifications')), false);
    assert.match(app.text('revisionNotifications'), /not enabled/); assert.match(app.text('revisionPageCount'), /on this page/);
    assert.equal(new URL(app.calls.find(call => call.path.includes('/visits?')).path, 'https://fixture.test').searchParams.get('limit'), '5');
  }
});

test('source throttling offers a scoped retry and prevents repeated reads before the server delay expires', async () => {
  let attempts = 0;
  const app = harness(path => {
    if (!path.includes('/visits?')) return null;
    if (++attempts === 1) return { ok: false, status: 429, json: async () => ({ ok: false, error: 'read_budget_exhausted_retry_next_minute', retryAfterSeconds: 20 }) };
    return { ok: true, json: async () => visits(new URL(path, 'https://fixture.test').searchParams.get('date')) };
  });
  await app.openLive(); assert.match(app.text('revisionVisits'), /Wait 20 seconds/); assert.equal(app.text('revisionNext'), 'Retry visits');
  await app.click('revisionNext'); assert.equal(attempts, 1);
  app.advance(20000); await app.click('revisionNext'); assert.equal(attempts, 2); assert.match(app.text('revisionDetail'), /55/);
});

test('a partial throttled page remains visible and its next request resumes at the first deferred ID', async () => {
  let attempts = 0;
  const app = harness(path => {
    if (!path.includes('/visits?')) return null;
    const query = new URL(path, 'https://fixture.test').searchParams, result = visits(query.get('date'));
    if (++attempts === 1) { result.nextOffset = 1; result.completeness.deferredCount = 4; result.retryAfterSeconds = 30; }
    else { assert.equal(query.get('offset'), '1'); assert.equal(query.get('discovery'), 'a'.repeat(64)); }
    return { ok: true, json: async () => result };
  });
  await app.openLive(); const before = app.text('revisionVisits'); await app.click('revisionNext');
  assert.equal(attempts, 1); assert.equal(app.text('revisionVisits'), before); assert.match(app.text('revisionCompleteness'), /current page remains visible/);
  app.advance(30000); await app.click('revisionNext'); assert.equal(attempts, 2);
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

test('overdue supervisor delivery explains the next office action without implying receipt or resending', async () => {
  const app = harness(path => path.endsWith('/notifications') ? { ok: true, json: async () => page([{ id: 'c'.repeat(64), officeId: '123', revision: 1, visitId: '55', rule: 'supervisor_overage', state: 'accepted', plannedSendAt: '2026-10-11T15:00:00Z', deadlineAt: '2026-10-12T15:00:00Z', acknowledgement: null,
    attention: { deliveryTarget: 'overdue', reason: 'delivery_overdue', needsReview: true, officeAcknowledged: false, nextAction: 'Review the existing attempt and contact the supervisor through the approved office process.' } }]) } : null);
  await app.openLive();
  const text = app.text('revisionNotifications');
  for (const expected of ['Office review needed', 'Delivery target: overdue', 'Review the existing attempt', 'Supervisor delivery target', 'Provider accepted · delivery unconfirmed']) assert.ok(text.includes(expected));
  assert.ok(!text.includes('Delivery confirmed'));
  assert.ok(!app.calls.some(call => call.options.method === 'POST'));
});

test('malformed server delivery guidance cannot become an actionable office record', () => {
  const model = pure();
  const record = { id: 'c'.repeat(64), officeId: '123', revision: 1, visitId: '55', rule: 'supervisor_overlap', state: 'unknown', deadlineAt: null, plannedSendAt: null, acknowledgement: null,
    attention: { deliveryTarget: 'unknown', reason: 'delivery_unknown', needsReview: true, officeAcknowledged: false, nextAction: 'Reconcile the existing receipt.' } };
  assert.equal(model.normalizeRecords(page([record]), 'notifications', '123').items[0].attention.needsReview, true);
  for (const edit of [{ deliveryTarget: 'delivered' }, { reason: 'resend' }, { needsReview: 'yes' }, { nextAction: 'x'.repeat(1001) }, { officeAcknowledged: 1 }]) assert.throws(() => model.normalizeRecords(page([{ ...record, attention: { ...record.attention, ...edit } }]), 'notifications', '123'));
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

test('Demo review paging never reuses prior-page selection or performs source requests', async () => {
  const app=harness(); app.emit('primetime-ready'); app.emit('primetime-view-changed', {view:'revisions'});
  assert.ok(app.text('revisionDetail').includes('DEMO-V-1048'));
  await app.click('revisionNext');
  assert.ok(app.text('revisionDetail').includes('DEMO-V-1058'));
  assert.ok(!app.text('revisionDetail').includes('DEMO-V-1048'));
  for(let i=0;i<3;i++) await app.click('revisionNext');
  assert.equal(app.element('revisionNext').hidden,true);
  assert.equal(app.calls.length,0);
});
