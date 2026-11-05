import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../source/primetime/maintenance.js', import.meta.url), 'utf8');
const tick = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };
const date = '2026-11-05';
const row = { id: '15', patientId: '25', caregiverId: '35', state: 'source_unvalidated', scheduledStart: date + ' 09:00', scheduledEnd: date + ' 12:00',
  actualStart: date + ' 08:57', actualEnd: null, evvStart: date + ' 08:57', evvEnd: null, detailFetchedAt: date + 'T15:00:00Z', officeCheckedAt: date + 'T15:00:01Z' };
const day = { ok: true, mode: 'live', source: 'hhaexchange', scope: { officeId: '123', date }, items: [row], officeDayCache: { kind: 'scheduled_office_day_api', complete: true, known: true, stale: false, checkedAt: date + 'T15:01:00Z', startedAt: date + 'T15:00:00Z', completedAt: date + 'T15:00:01Z' } };
function fixture({ active = false, live = true, rows = [row] } = {}) {
  const ids = new Map();
  class Element extends EventTarget {
    children = []; textContent = ''; value = ''; disabled = false; dataset = {}; attributes = {}; checked = false;
    classList = { contains: name => name === 'is-active' && active };
    constructor(tag = '') { super(); this.tag = tag; }
    set id(value) { this._id = value; ids.set(value, this); } get id() { return this._id; }
    append(...children) { this.children.push(...children); } prepend(...children) { this.children.unshift(...children); }
    replaceChildren(...children) { this.children = children; this.textContent = ''; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(selector.split(',').includes(child.tag) ? [child] : []), ...child.querySelectorAll(selector)]); }
    setAttribute(name, value) { this.attributes[name] = value; } remove() {} scrollIntoView() {}
    click() { this.dispatchEvent(new Event('click')); }
  }
  for (const id of ['maintenanceWorkspace','maintenanceRefresh','maintenanceDate','maintenanceSearch','maintenanceFilter','maintenanceStatus','maintenanceReceipt','maintenanceMetrics','maintenanceQueueTab','maintenanceReportTab','maintenanceQueue','maintenanceList','maintenanceMoreVisits','maintenanceDetail','maintenanceReport','maintenanceExport','maintenanceReportRows','maintenanceMoreCases','dashboardOverviewDate']) ids.set(id, new Element());
  ids.get('dashboardOverviewDate').value = date; ids.get('maintenanceFilter').value = 'all';
  ids.get('maintenanceWorkspace').children.push(...[...ids.entries()].filter(([id]) => id !== 'maintenanceWorkspace').map(([,node]) => node));
  const document = new EventTarget(); document.hidden = false; document.getElementById = id => ids.get(id); document.createElement = tag => new Element(tag); document.body = new Element('body');
  const calls = []; let saved = null, exported = null, delayed = null;
  let handler = async (path, options) => {
    if (path.includes('/views/office-day')) return { ...day, items: structuredClone(rows) };
    if (path.includes('/maintenance/cases')) return { ok: true, scope: day.scope, items: saved ? [saved] : [], nextCursor: null, hhaWritesEnabled: false };
    const body = JSON.parse(options.body);
    if (path.endsWith('/maintenance/save')) {
      saved = { id: 'synthetic-case', officeId: '123', date, visitId: '15', revision: (saved?.revision || 0) + 1, status: body.status, queue: body.queue,
        followUpAt: body.followUpAt, source: row, hhaSubmission: 'not_submitted', calls: saved?.calls || null,
        proposal: { kind: body.proposalKind, selectedCallIds: body.selectedCallIds }, events: [...saved?.events || [], { at: date + 'T16:00:00Z', actor: 'synthetic-admin', action: 'office_review_updated', note: body.note, status: body.status, queue: body.queue }] };
      return { ok: true, item: saved, hhaWritesEnabled: false };
    }
    if (path.endsWith('/maintenance/calls')) { saved = { ...saved, revision: saved.revision + 1, proposal: null, calls: { fetchedAt: date + 'T16:01:00Z', truncated: false, visitLink: 'not_supplied_by_source', records: [{ CallDashboardID: '45', CallTime: date + ' 08:57', CallType: 'raw-type', CallStatus: 'raw-status' }] } }; return { ok: true, item: saved, hhaWritesEnabled: false }; }
    throw new Error('unexpected route');
  };
  vm.runInNewContext(source, { document, window: { primetimeDataMode: { isActive: () => active, isLive: () => live }, primetimeApiFetch: async (...args) => {
    calls.push(args); if (delayed) return delayed;
    const value = await handler(...args); return new Response(JSON.stringify(value), { status: value.status || 200 });
  } }, AbortController, Date, Intl, Map, Set, setTimeout, clearTimeout, URL: { createObjectURL(blob) { exported = blob; return 'blob:synthetic'; }, revokeObjectURL() {} }, Blob });
  const event = (id, name = 'click') => ids.get(id).dispatchEvent(new Event(name, { cancelable: true }));
  return { ids, calls, document, event, text(node) { return node.textContent + node.children.map(child => this.text(child)).join(' '); }, saved: () => saved, exported: () => exported,
    handler(value) { handler = value; }, delay(value) { delayed = value; }, enter() { active = true; document.dispatchEvent(Object.assign(new Event('primetime-view-changed'), { detail: { view: 'maintenance' } })); },
    ready() { active = true; document.dispatchEvent(new Event('primetime-ready')); }, demo() { live = false; document.dispatchEvent(new Event('primetime-data-mode-changed')); }, leave() { active = false; document.dispatchEvent(Object.assign(new Event('primetime-view-changed'), { detail: { view: 'overview' } })); } };
}
test('maintenance stays idle outside the live authenticated active workspace', async () => {
  const f = fixture(); await tick(); assert.equal(f.calls.length, 0); f.ready(); await tick(); assert.equal(f.calls.length, 2);
  f.demo(); await tick(); assert.equal(f.ids.get('maintenanceList').children.length, 0); assert.equal(f.calls.length, 2);
});
test('all returned source visits remain available beyond a visual page and filters use loaded evidence', async () => {
  const rows = Array.from({ length: 83 }, (_, i) => ({ ...row, id: String(i + 1) })); const f = fixture({ rows }); f.ready(); await tick();
  assert.match(f.text(f.ids.get('maintenanceList')), /83 matching visits.*showing 40/); f.event('maintenanceMoreVisits');
  assert.match(f.text(f.ids.get('maintenanceList')), /showing 80/); f.event('maintenanceMoreVisits'); assert.match(f.text(f.ids.get('maintenanceList')), /showing 83/);
  f.ids.get('maintenanceSearch').value = '83'; f.event('maintenanceSearch', 'input'); assert.equal(f.ids.get('maintenanceList').querySelectorAll('button').length, 1);
});
test('case save, actual-call receipt, selected-call proposal, report and durable reload work together', async () => {
  const f = fixture(); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click();
  f.ids.get('maintenanceNote').value = 'Synthetic inspection; source end absent. Review original call evidence.'; f.event('maintenanceCaseForm', 'submit'); await tick();
  assert.equal(f.saved().revision, 1); assert.equal(f.saved().hhaSubmission, 'not_submitted'); assert.match(f.ids.get('maintenanceStatus').textContent, /No HHA confirmation/);
  const readCalls = f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.textContent === 'Read caregiver calls'); readCalls.click(); await tick();
  const checkbox = f.ids.get('maintenanceDetail').querySelectorAll('input').find(node => node.dataset.call === 'true'); checkbox.checked = true;
  f.ids.get('maintenanceProposal').value = 'review_existing_calls'; f.ids.get('maintenanceCaseState').value = 'needs_attention'; f.ids.get('maintenanceCaseQueue').value = 'supervisor';
  f.ids.get('maintenanceNote').value = 'Synthetic supervisor follow-up; exact link remains unproved.'; f.event('maintenanceCaseForm', 'submit'); await tick();
  assert.deepEqual(f.saved().proposal.selectedCallIds, ['45']); assert.equal(f.saved().revision, 3);
  f.event('maintenanceReportTab'); assert.match(f.text(f.ids.get('maintenanceReportRows')), /supervisor follow-up/); f.event('maintenanceExport');
  assert.match(await f.exported().text(), /HHA changes submitted by this workspace: 0/); assert.match(await f.exported().text(), /Selected source calls: 45/);
  f.event('maintenanceRefresh'); await tick(); assert.match(f.text(f.ids.get('maintenanceList')), /Needs attention/);
  assert.ok(f.calls.every(([path]) => !/confirm|clock-in|execute/.test(path)));
});
test('private case notes, times, reports and in-flight responses clear on sign-out or navigation', async () => {
  const f = fixture(); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click();
  f.ids.get('maintenanceNote').value = 'Private synthetic draft'; f.document.dispatchEvent(new Event('primetime-signed-out'));
  assert.doesNotMatch(f.text(f.ids.get('maintenanceDetail')), /Private synthetic|08:57/); assert.equal(f.ids.get('maintenanceList').children.length, 0);
  const g = fixture(); let finish; g.delay(new Promise(resolve => { finish = resolve; })); g.ready(); await tick(); g.leave();
  finish(new Response(JSON.stringify(day))); await tick(); assert.equal(g.ids.get('maintenanceList').children.length, 0);
});
test('source errors and stale source receipts are shown without pretending missing clocks were recovered', async () => {
  const f = fixture(); f.handler(async path => path.includes('office-day') ? { ...day, officeDayCache: { ...day.officeDayCache, stale: true } } : { ok: true, scope: day.scope, items: [], nextCursor: null, hhaWritesEnabled: false });
  f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click();
  assert.match(f.ids.get('maintenanceReceipt').textContent, /Feed is stale/); assert.match(f.text(f.ids.get('maintenanceDetail')), /Not supplied by HHA/);
  const save = f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.textContent === 'Save office review'); assert.equal(save.disabled, true);
});
test('source backoff disables call retries while local office work remains available', async () => {
  const f = fixture(); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click();
  f.ids.get('maintenanceNote').value = 'Synthetic source review'; f.event('maintenanceCaseForm', 'submit'); await tick();
  f.handler(async () => ({ status: 429, ok: false, error: 'read_budget_exhausted_retry_next_minute', retryAfterSeconds: 25 }));
  f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.textContent === 'Read caregiver calls').click(); await tick();
  const read = f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.dataset.sourceRead === 'true');
  assert.equal(read.disabled, true); assert.match(read.textContent, /wait 25s/);
  assert.equal(f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.textContent === 'Save office review').disabled, false);
  f.leave();
});
