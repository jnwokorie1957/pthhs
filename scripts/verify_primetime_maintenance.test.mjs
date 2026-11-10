import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../source/primetime/maintenance.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../source/primetime/dashboard.js', import.meta.url), 'utf8');
const dashboardWindow = {};
vm.runInNewContext(dashboardSource, { window: dashboardWindow });
const tick = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };
const date = '2026-11-05';
const row = { id: '15', patientId: '25', caregiverId: '35', state: 'source_unvalidated', scheduledStart: date + ' 09:00', scheduledEnd: date + ' 12:00',
  actualStart: date + ' 08:57', actualEnd: null, evvStart: date + ' 08:57', evvEnd: null, detailFetchedAt: date + 'T15:00:00Z', officeCheckedAt: date + 'T15:00:01Z' };
const day = { ok: true, mode: 'live', source: 'hhaexchange', scope: { officeId: '123', date }, items: [row], officeDayCache: { kind: 'scheduled_office_day_api', complete: true, known: true, stale: false, checkedAt: date + 'T15:01:00Z', startedAt: date + 'T15:00:00Z', completedAt: date + 'T15:00:01Z' } };
function fixture({ active = false, live = true, rows = [row], fakeTimers = false } = {}) {
  const ids = new Map();
  const timers = new Map(); let nextTimer = 1;
  class Element extends EventTarget {
    children = []; textContent = ''; value = ''; disabled = false; dataset = {}; attributes = {}; checked = false;
    classList = { contains: name => name === 'is-active' ? active : (this.className || '').split(' ').includes(name), add: name => { this.className = (this.className || '') + ' ' + name; }, remove: name => { this.className = (this.className || '').split(' ').filter(value => value !== name).join(' '); } };
    constructor(tag = '') { super(); this.tag = tag; }
    set id(value) { this._id = value; ids.set(value, this); } get id() { return this._id; }
    append(...children) { this.children.push(...children); } prepend(...children) { this.children.unshift(...children); }
    replaceChildren(...children) { this.children = children; this.textContent = ''; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(selector.split(',').includes(child.tag) ? [child] : []), ...child.querySelectorAll(selector)]); }
    setAttribute(name, value) { this.attributes[name] = value; } remove() {} scrollIntoView() {}
    click() { this.dispatchEvent(new Event('click')); }
  }
  for (const id of ['maintenanceWorkspace','maintenanceRefresh','maintenanceDate','maintenanceDateTo','maintenanceSearch','maintenanceFilter','maintenanceStatus','maintenanceReceipt','maintenanceMetrics','maintenanceQueueTab','maintenanceReportTab','maintenanceQueue','maintenanceList','maintenanceMoreVisits','maintenanceDetail','maintenanceReport','maintenanceExport','maintenanceReportRows','maintenanceMoreCases','dashboardOverviewDate']) ids.set(id, new Element());
  ids.get('dashboardOverviewDate').value = date; ids.get('maintenanceFilter').value = 'all';
  ids.get('maintenanceWorkspace').children.push(...[...ids.entries()].filter(([id]) => id !== 'maintenanceWorkspace').map(([,node]) => node));
  const document = new EventTarget(); document.hidden = false; document.getElementById = id => ids.get(id); document.createElement = tag => new Element(tag); document.body = new Element('body');
  const calls = [], revoked = []; let saved = null, exported = null, delayed = null;
  let handler = async (path, options) => {
    if (path.includes('/views/office-day')) return { ...day, items: structuredClone(rows) };
    if (path.includes('/maintenance/cases')) return { ok: true, scope: day.scope, items: saved ? [saved] : [], nextCursor: null, hhaWritesEnabled: false };
    if (path.endsWith('/maintenance/case')) return { ok: true, item: saved, hhaWritesEnabled: false };
    const body = JSON.parse(options.body);
    if (path.endsWith('/maintenance/save')) {
      saved = { id: 'synthetic-case', officeId: '123', date: body.date, visitId: body.visitId, revision: (saved?.revision || 0) + 1, status: body.status, queue: body.queue,
        followUpAt: body.followUpAt, source: row, hhaSubmission: 'not_submitted', calls: saved?.calls || null,
        proposal: { kind: body.proposalKind, selectedCallIds: body.selectedCallIds }, events: [...saved?.events || [], { at: date + 'T16:00:00Z', actor: 'synthetic-admin', action: 'office_review_updated', note: body.note, status: body.status, queue: body.queue }] };
      return { ok: true, item: saved, hhaWritesEnabled: false };
    }
    if (path.endsWith('/maintenance/calls')) { saved = { ...saved, revision: saved.revision + 1, proposal: null, calls: { fetchedAt: date + 'T16:01:00Z', truncated: false, visitLink: 'not_supplied_by_source', records: [{ CallDashboardID: '45', CallTime: date + ' 08:57', CallType: 'raw-type', CallStatus: 'raw-status' }] } }; return { ok: true, item: saved, hhaWritesEnabled: false }; }
    if (path.endsWith('/maintenance/reasons')) { saved = {...saved, revision:saved.revision+1, reasonCatalog:{fetchedAt:date+'T16:00:00Z',truncated:false,reasons:[{id:'55',name:'Synthetic reason',status:'Source status',actions:[{id:'65',name:'Synthetic action',status:'Source status'}]}]}};return{ok:true,item:saved,hhaWritesEnabled:false}; }
    throw new Error('unexpected route');
  };
  vm.runInNewContext(source, { document, window: { primetimeDashboardModel: dashboardWindow.primetimeDashboardModel, primetimeDataMode: { isActive: () => active, isLive: () => live }, primetimeApiFetch: async (...args) => {
    calls.push(args); if (delayed) return delayed;
    const value = await handler(...args); return new Response(JSON.stringify(value), { status: value.status || 200 });
  } }, AbortController, CustomEvent, Date, Intl, Map, Set, setTimeout:fakeTimers ? (fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;} : setTimeout, clearTimeout:fakeTimers ? id=>timers.delete(id) : clearTimeout, URL: { createObjectURL(blob) { exported = blob; return 'blob:synthetic'; }, revokeObjectURL(url) { revoked.push(url); } }, Blob });
  const event = (id, name = 'click') => ids.get(id).dispatchEvent(new Event(name, { cancelable: true }));
  return { ids, calls, revoked, document, event, fireTimeouts(){for(const[id,timer]of [...timers]){timers.delete(id);timer.fn();}}, text(node) { return node.textContent + node.children.map(child => this.text(child)).join(' '); }, saved: () => saved, exported: () => exported,
    handler(value) { handler = value; }, delay(value) { delayed = value; }, enter() { active = true; document.dispatchEvent(Object.assign(new Event('primetime-view-changed'), { detail: { view: 'maintenance' } })); },
    ready() { active = true; document.dispatchEvent(new Event('primetime-ready')); }, demo() { live = false; document.dispatchEvent(new Event('primetime-data-mode-changed')); }, leave() { active = false; document.dispatchEvent(Object.assign(new Event('primetime-view-changed'), { detail: { view: 'overview' } })); } };
}

test('maintenance evidence distinguishes supplied and absent endpoints without accepting a schedule comparison', async () => {
  const f = fixture(); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  const evidence = f.text(f.ids.get('maintenanceEvidence'));
  assert.match(evidence, /HHA schedule fields: start supplied; end supplied/);
  assert.match(evidence, /Recorded visit fields: start supplied; end not supplied in this response/);
  assert.match(evidence, /EVV fields: start supplied; end not supplied in this response/);
  assert.match(evidence, /Schedule comparison: Not established in Primetime/);
  assert.match(evidence, /saved Calendar S \/ Schedule tab.*SuggestedScheduleTime/);
  assert.match(evidence, /comparison is unknown, stop.*owner.*continuing other dates/);
  assert.equal(f.ids.get('maintenanceNote').value, '');
  assert.ok(f.ids.get('maintenanceDetail').querySelectorAll('button').find(n => n.textContent.startsWith('Submit to HHA')).disabled);
  assert.ok(f.calls.every(([path]) => !/maintenance\/(save|calls|reasons)/.test(path)));
});

test('unavailable visit details remain unknown even when the row contains stale clock values', async () => {
  const f = fixture({ rows: [{ ...row, state: 'unavailable' }] }); f.ready(); await tick();
  f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  const detail = f.text(f.ids.get('maintenanceDetail'));
  assert.match(f.text(f.ids.get('maintenanceEvidence')), /Source detail could not be verified\. Clock presence is unknown/);
  assert.doesNotMatch(detail, /08:57|Not supplied by HHA|start supplied|end supplied/);
  assert.match(detail, /Source detail unavailable/);
  assert.equal(f.ids.get('maintenanceCaseForm'), undefined);
});

test('all six source endpoints still leave comparison and member verification unestablished', async () => {
  const f = fixture({ rows: [{ ...row, actualEnd: date + ' 12:00', evvEnd: date + ' 12:00' }] }); f.ready(); await tick();
  f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  const evidence = f.text(f.ids.get('maintenanceEvidence'));
  assert.equal((evidence.match(/start supplied; end supplied/g) || []).length, 3);
  assert.match(evidence, /Schedule comparison: Not established in Primetime/);
  assert.match(evidence, /Clock fields do not establish member verification/);
  assert.doesNotMatch(evidence, /within schedule|payable|billable|verified services delivered/i);
  assert.equal(f.ids.get('maintenanceNote').value, '');
  assert.ok(f.ids.get('maintenanceDetail').querySelectorAll('button').find(n => n.textContent.startsWith('Submit to HHA')).disabled);
});

test('protected report uses the saved case evidence while selected visit evidence uses the current feed', async () => {
  const current = { ...row, actualEnd: date + ' 12:00', evvEnd: date + ' 12:00' };
  const f = fixture({ rows: [current] }); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  f.ids.get('maintenanceNote').value = 'Synthetic source review'; f.event('maintenanceCaseForm', 'submit'); await tick();
  assert.match(f.text(f.ids.get('maintenanceEvidence')), /EVV fields: start supplied; end supplied/);
  f.event('maintenanceReportTab'); assert.match(f.text(f.ids.get('maintenanceReportRows')), /Saved case evidence.*EVV fields: start supplied; end not supplied in this response/);
  f.event('maintenanceExport'); const report = await f.exported().text();
  assert.match(report, /Saved case evidence/);
  assert.match(report, /Generated \d{4}-\d{2}-\d{2}T.*\nOffice .*Background HHA API cache/);
  assert.match(report, /1 loaded cases/);
  assert.match(report, /EVV fields: start supplied; end not supplied in this response/);
  assert.match(report, /Schedule comparison: Not established in Primetime/);
  assert.match(report, /HHA changes submitted by this workspace: 0/);
  f.document.dispatchEvent(new Event('primetime-signed-out'));
  assert.doesNotMatch(f.text(f.ids.get('maintenanceDetail')), /Evidence before source maintenance|start supplied/);
  assert.equal(f.ids.get('maintenanceReportRows').children.length, 0);
});
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
  const f = fixture(); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
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
  const f = fixture(); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  f.ids.get('maintenanceNote').value = 'Private synthetic draft'; f.document.dispatchEvent(new Event('primetime-signed-out'));
  assert.doesNotMatch(f.text(f.ids.get('maintenanceDetail')), /Private synthetic|08:57/); assert.equal(f.ids.get('maintenanceList').children.length, 0);
  const g = fixture(); let finish; g.delay(new Promise(resolve => { finish = resolve; })); g.ready(); await tick(); g.leave();
  finish(new Response(JSON.stringify(day))); await tick(); assert.equal(g.ids.get('maintenanceList').children.length, 0);
});
test('source errors and stale source receipts are shown without pretending missing clocks were recovered', async () => {
  const f = fixture(); f.handler(async path => path.includes('office-day') ? { ...day, officeDayCache: { ...day.officeDayCache, stale: true } } : { ok: true, scope: day.scope, items: [], nextCursor: null, hhaWritesEnabled: false });
  f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  assert.match(f.ids.get('maintenanceReceipt').textContent, /Feed is stale/); assert.match(f.text(f.ids.get('maintenanceDetail')), /Not supplied by HHA/);
  const save = f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.textContent === 'Save office review'); assert.equal(save.disabled, true);
});
test('source backoff disables call retries while local office work remains available', async () => {
  const f = fixture(); f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  f.ids.get('maintenanceNote').value = 'Synthetic source review'; f.event('maintenanceCaseForm', 'submit'); await tick();
  f.handler(async () => ({ status: 429, ok: false, error: 'read_budget_exhausted_retry_next_minute', retryAfterSeconds: 25 }));
  f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.textContent === 'Read caregiver calls').click(); await tick();
  const read = f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.dataset.sourceRead === 'true');
  assert.equal(read.disabled, true); assert.match(read.textContent, /wait 25s/);
  assert.equal(f.ids.get('maintenanceDetail').querySelectorAll('button').find(node => node.textContent === 'Save office review').disabled, false);
  f.leave();
});
test('a stalled case-page read leaves loaded visit rows clickable and times out instead of locking the workspace',async()=>{
 const f=fixture({fakeTimers:true});let finish;f.handler(async path=>path.includes('/views/office-day')?day:path.includes('/maintenance/cases')?new Promise(resolve=>{finish=resolve;}):{ok:true,item:null,hhaWritesEnabled:false});
 f.ready();await tick();const visit=f.ids.get('maintenanceList').querySelectorAll('button')[0];assert.equal(visit.disabled,false);visit.click();await tick();assert.ok(f.ids.get('maintenanceCaseForm'));
 f.fireTimeouts();await tick();assert.match(f.ids.get('maintenanceStatus').textContent,/did not finish in time/);assert.equal(f.ids.get('maintenanceRefresh').disabled,false);finish({ok:true,scope:day.scope,items:[],nextCursor:null,hhaWritesEnabled:false});await tick();f.leave();
});
test('range rows save under their actual service date and show patient/caregiver names',async()=>{
 const f=fixture();f.ready();await tick();f.ids.get('maintenanceDate').value='2026-10-23';f.ids.get('maintenanceDateTo').value=date;
 const sourceRow={...row,serviceDate:'2026-10-24',patientFirstName:'Synthetic',patientLastName:'Member',caregiverFirstName:'Synthetic',caregiverLastName:'Worker'};
 f.document.dispatchEvent(new Event('primetime-maintenance-search-started'));f.document.dispatchEvent(new CustomEvent('primetime-maintenance-results',{detail:{ok:true,source:'hhaexchange',mode:'live',scope:{officeId:'123',from:'2026-10-23',to:date},items:[sourceRow],unavailable:[],checkedThrough:1,totalIds:1,complete:true,unknownPayers:0,truncated:false,fetchedAt:date+'T16:00:00Z',checkedAt:date+'T16:00:01Z'}}));
 assert.match(f.text(f.ids.get('maintenanceList')),/Member, Synthetic/);f.ids.get('maintenanceList').querySelectorAll('button')[0].click();await tick();f.ids.get('maintenanceNote').value='Synthetic historical source review';f.event('maintenanceCaseForm','submit');await tick();
 const save=f.calls.find(([path])=>path.endsWith('/maintenance/save'));assert.equal(JSON.parse(save[1].body).date,'2026-10-24');assert.equal(f.saved().date,'2026-10-24');
});
test('range receipt distinguishes a remaining page from a finished search with unavailable details', async () => {
  const f = fixture(); f.ready(); await tick();
  f.ids.get('maintenanceDateTo').value = date;
  f.document.dispatchEvent(new Event('primetime-maintenance-search-started'));
  const base = { ok: true, source: 'hhaexchange', mode: 'live', scope: { officeId: '123', from: date, to: date },
    items: [], totalIds: 3, complete: false, unknownPayers: 0, truncated: false,
    fetchedAt: date + 'T16:00:00Z', checkedAt: date + 'T16:00:01Z' };
  const deliver = detail => f.document.dispatchEvent(new CustomEvent('primetime-maintenance-results', { detail }));
  deliver({ ...base, checkedThrough: 2, nextCursor: 'next',
    unavailable: [{ id: '16', error: 'visit_patient_office_mismatch' }, { id: '17', error: 'unknown_source_code' }] });
  const receipt = f.ids.get('maintenanceReceipt');
  assert.match(receipt.textContent, /More source reads remain/);
  const list = f.ids.get('maintenanceList');
  assert.match(f.text(list), /Continue source search/);
  deliver({ ...base, items: [{ ...row, serviceDate: date }], checkedThrough: 3, nextCursor: null, complete: true, unavailable: [] });
  assert.match(receipt.textContent, /3 of 3 returned IDs checked.*Search finished with gaps/);
  assert.match(receipt.textContent, /2 unavailable.*Patient office could not be verified.*Source detail could not be verified/);
  assert.doesNotMatch(receipt.textContent, /More source reads remain|unknown_source_code/);
  assert.equal(f.ids.get('maintenanceList').querySelectorAll('button').length, 1);
  assert.ok(f.calls.every(([path]) => !/maintenance\/(save|calls|reasons)/.test(path)));

  f.document.dispatchEvent(new Event('primetime-maintenance-search-started'));
  deliver({ ...base, checkedThrough: 2, nextCursor: 'next', unavailable: [], truncated: true });
  deliver({ ...base, checkedThrough: 3, nextCursor: null, unavailable: [], complete: true });
  assert.match(receipt.textContent, /Search finished with gaps.*HHA discovery truncated/);
  assert.match(f.text(list), /No readable matches.*coverage is incomplete/);
  assert.doesNotMatch(f.text(list), /Continue source search|match these filters/);

  f.document.dispatchEvent(new Event('primetime-maintenance-search-started'));
  deliver({ ...base, totalIds: 0, checkedThrough: 0, nextCursor: null, unavailable: [], complete: true });
  assert.match(receipt.textContent, /Source pages checked/);
  assert.match(f.text(list), /No readable visits match this source search/);
});
test('report and download retain accepted range coverage and lock on pending scope or office changes', async () => {
  const f = fixture();
  f.ready(); await tick();
  f.ids.get('maintenanceDateTo').value = date;
  f.event('maintenanceReportTab');
  const exportButton = f.ids.get('maintenanceExport'), report = f.ids.get('maintenanceReportRows');
  const scope = { officeId: '123', from: date, to: date };
  const fetchedAt = date + 'T16:00:00Z';
  const base = { ok: true, source: 'hhaexchange', mode: 'live', scope, fetchedAt, checkedAt: fetchedAt,
    items: [], totalIds: 2, unknownPayers: 0, truncated: false, filters: ['Patient ID 25', 'Payer contract ID 75'] };
  const start = () => f.document.dispatchEvent(new Event('primetime-maintenance-search-started'));
  const deliver = detail => f.document.dispatchEvent(new CustomEvent('primetime-maintenance-results', { detail }));
  start();
  deliver({ ...base, checkedThrough: 1, nextCursor: 'next', unavailable: [{ id: '16', error: 'vendor_backoff_active' }], complete: false });
  const receipt = f.ids.get('maintenanceReceipt');
  assert.match(receipt.textContent, /Applied filters: Patient ID 25, Payer contract ID 75.*1 of 2.*More source reads remain.*Vendor retry delay recorded/);
  assert.ok(f.text(report).includes(receipt.textContent));
  f.event('maintenanceExport');
  assert.ok((await f.exported().text()).includes(receipt.textContent));
  deliver({ ...base, checkedThrough: 2, nextCursor: null, unavailable: [], complete: true, items: [{ ...row, serviceDate: date }] });
  assert.match(receipt.textContent, /2 of 2.*1 readable match.*finished with gaps.*1 unavailable/);
  f.event('maintenanceExport');
  assert.ok((await f.exported().text()).includes(receipt.textContent));
  const lastExport = f.exported(), callsBefore = f.calls.length;
  f.ids.get('maintenanceDateTo').value = '2026-11-06';
  f.document.dispatchEvent(new Event('primetime-maintenance-scope-edited'));
  assert.match(f.text(report), /Previous result.*Patient ID 25, Payer contract ID 75/);
  assert.equal(exportButton.disabled, true);
  f.event('maintenanceExport');
  assert.equal(f.exported(), lastExport);
  assert.deepEqual(f.revoked, ['blob:synthetic', 'blob:synthetic']);
  assert.equal(f.calls.length, callsBefore);
  start();
  assert.equal(exportButton.disabled, true);
  deliver({ ...base, scope: { ...scope, to: '2026-11-06' }, filters: ['Caregiver ID 35'], totalIds: 0,
    checkedThrough: 0, nextCursor: null, unavailable: [], complete: true });
  assert.match(f.text(report), /Applied filters: Caregiver ID 35.*0 of 0.*Source pages checked/);
  assert.equal(exportButton.disabled, false);
  f.event('maintenanceExport');
  f.document.dispatchEvent(new CustomEvent('primetime-maintenance-capabilities', { detail: { officeId: '124' } }));
  assert.equal(exportButton.disabled, true);
  assert.equal(report.children.length, 0);
  assert.equal(f.revoked.length, 3);
  assert.equal(f.calls.length, callsBefore);
});
test('source reason/action choices are selectable, staged with the note, and never submitted to HHA',async()=>{
 const f=fixture();f.ready();await tick();f.ids.get('maintenanceList').querySelectorAll('button')[0].click();await tick();
 f.ids.get('maintenanceDetail').querySelectorAll('button').find(n=>n.textContent==='Load HHA reason / action codes').click();await tick();
 f.ids.get('maintenanceReason').value='55';f.event('maintenanceReason','change');f.ids.get('maintenanceReasonAction').value='65';f.ids.get('maintenanceNote').value='Synthetic staging note from source choices';f.event('maintenanceCaseForm','submit');await tick();
 const request=f.calls.filter(([path])=>path.endsWith('/maintenance/save')).at(-1);const body=JSON.parse(request[1].body);assert.equal(body.reasonId,'55');assert.equal(body.actionId,'65');
 const submit=f.ids.get('maintenanceDetail').querySelectorAll('button').find(n=>n.textContent.startsWith('Submit to HHA'));assert.equal(submit.disabled,true);assert.equal(f.saved().hhaSubmission,'not_submitted');
});
test('a successful empty reason catalog explicitly states that no source code can be staged',async()=>{
 const f=fixture();f.ready();await tick();f.ids.get('maintenanceList').querySelectorAll('button')[0].click();await tick();f.ids.get('maintenanceNote').value='Synthetic connectivity review';f.event('maintenanceCaseForm','submit');await tick();
 f.handler(async path=>{assert.ok(path.endsWith('/maintenance/reasons'));return{ok:true,item:{...f.saved(),revision:f.saved().revision+1,reasonCatalog:{fetchedAt:date+'T16:00:00Z',truncated:false,reasons:[]}},hhaWritesEnabled:false};});
 f.ids.get('maintenanceDetail').querySelectorAll('button').find(n=>n.textContent==='Load HHA reason / action codes').click();await tick();assert.match(f.ids.get('maintenanceStatus').textContent,/no reason\/action choices/);assert.match(f.text(f.ids.get('maintenanceDetail')),/applicable catalog and confirmation contract/);assert.equal(f.ids.get('maintenanceReason').children.length,1);
});
test('selected visit details stay compact and preserve the opened review after a source read using native-style NodeLists',async()=>{
 const f=fixture();const host=f.ids.get('maintenanceDetail'),query=host.querySelectorAll.bind(host);host.querySelectorAll=selector=>{const nodes=query(selector);return selector==='details'?{[Symbol.iterator]:()=>nodes.values()}:nodes;};f.ready();await tick();f.ids.get('maintenanceList').querySelectorAll('button')[0].click();await tick();
 let sections=[...host.querySelectorAll('details')];assert.equal(sections.filter(n=>n.open).length,0);sections.find(n=>n.dataset.section==='review').open=true;host.querySelectorAll('button').find(n=>n.textContent==='Load HHA reason / action codes').click();await tick();sections=[...host.querySelectorAll('details')];assert.equal(sections.find(n=>n.dataset.section==='review').open,true);assert.equal(sections.find(n=>n.dataset.section==='calls').open,false);
});

test('open-review metric counts only unresolved cases with loaded visits and opens that exact subset',async()=>{
 const rows=['15','16','17','18','19'].map(id=>({...row,id}));
 const review=(visitId,status)=>({visitId,officeId:'123',date,revision:1,status,queue:'administrator',hhaSubmission:'not_submitted',events:[],source:{...row,id:visitId}});
 const cases=[review('15','in_review'),review('16','needs_attention'),review('17','awaiting_hha_action'),review('18','office_review_complete'),review('99','needs_attention'),review('98','awaiting_hha_action')];
 const f=fixture({rows});f.handler(async path=>path.includes('/views/office-day')?{...day,items:rows}:{ok:true,scope:day.scope,items:cases,nextCursor:null,hhaWritesEnabled:false});
 f.ready();await tick();const requests=f.calls.length,metric=f.ids.get('maintenanceMetrics').children[2];
 assert.equal(metric.children[0].textContent,'3');metric.click();
 assert.equal(f.ids.get('maintenanceFilter').value,'open_cases');
 assert.equal(f.ids.get('maintenanceList').querySelectorAll('button').length,3);
 assert.doesNotMatch(f.text(f.ids.get('maintenanceList')),/Office review complete|Visit 18|Visit 99/);
 assert.equal(f.ids.get('maintenanceMetrics').children[2].attributes['aria-pressed'],'true');
 f.ids.get('maintenanceFilter').value='cases';f.event('maintenanceFilter','change');
 assert.equal(f.ids.get('maintenanceList').querySelectorAll('button').length,4);
 assert.match(f.text(f.ids.get('maintenanceList')),/Office review complete/);
 const awaiting=f.ids.get('maintenanceMetrics').children[3];assert.equal(awaiting.children[0].textContent,'1');awaiting.click();
 assert.equal(f.ids.get('maintenanceList').querySelectorAll('button').length,1);assert.match(f.text(f.ids.get('maintenanceList')),/Visit 17/);assert.equal(f.calls.length,requests);
});

test('metric shortcuts clear unrelated text filters and an empty open-review queue stays empty without reads',async()=>{
 const f=fixture({rows:Array.from({length:45},(_,i)=>({...row,id:String(i+1)}))});f.ready();await tick();const requests=f.calls.length;
 f.event('maintenanceMoreVisits');f.ids.get('maintenanceSearch').value='45';f.event('maintenanceSearch','input');
 f.ids.get('maintenanceMetrics').children[0].click();
 assert.equal(f.ids.get('maintenanceSearch').value,'');assert.match(f.text(f.ids.get('maintenanceList')),/45 matching visits.*showing 40/);
 f.ids.get('maintenanceMetrics').children[2].click();assert.equal(f.ids.get('maintenanceList').querySelectorAll('button').length,0);
 assert.equal(f.ids.get('maintenanceMetrics').children[2].children[0].textContent,'0');assert.equal(f.calls.length,requests);
});

test('reports retain saved history for cases without a matching readable visit', async () => {
  const rows = [
    { ...row, id: '16', state: 'unavailable' },
    { ...row, id: '17', patientId: '26' },
    { ...row, id: '18', serviceDate: '2026-11-04' },
  ];
  const saved = ['15', '16', '17', '18'].map(visitId => ({
    visitId, officeId: day.scope.officeId, date, revision: 2,
    status: 'needs_attention', queue: 'office_manager', hhaSubmission: 'not_submitted',
    source: { ...row, id: visitId },
    events: [
      { at: date + 'T16:00:00Z', actor: 'synthetic-office', action: 'office_review_updated', note: 'Earlier synthetic follow-up', status: 'in_review', queue: 'administrator' },
      { at: date + 'T17:00:00Z', actor: 'synthetic-office', action: 'office_review_updated', note: 'Latest synthetic follow-up', status: 'needs_attention', queue: 'office_manager' },
    ],
  }));
  const f = fixture({ rows });
  f.handler(async path => path.includes('/views/office-day') ? { ...day, items: rows } : { ok: true, scope: day.scope, items: saved, nextCursor: null, hhaWritesEnabled: false });
  f.ready(); await tick(); f.event('maintenanceReportTab');
  const report = f.ids.get('maintenanceReportRows'), requests = f.calls.length;
  assert.equal(report.querySelectorAll('button').length, 0);
  const histories = report.querySelectorAll('details');
  assert.equal(histories.length, 4);
  assert.match(f.text(report), /Read-only saved case for 2026-11-05/);
  assert.doesNotMatch(f.text(report), /Earlier synthetic follow-up/);
  histories[0].open = true; histories[0].dispatchEvent(new Event('toggle'));
  assert.match(f.text(histories[0]), /Earlier synthetic follow-up/);
  assert.equal(f.calls.length, requests);
  assert.equal(f.ids.get('maintenanceReport').hidden, false);
  assert.equal(f.ids.get('maintenanceCaseForm'), undefined);
  f.document.dispatchEvent(new Event('primetime-signed-out'));
  assert.equal(report.children.length, 0);
});

test('a matching report case opens the normal visit review and reads its current saved revision', async () => {
  const saved = { visitId: row.id, officeId: day.scope.officeId, date, revision: 1,
    status: 'in_review', queue: 'office_manager', hhaSubmission: 'not_submitted', source: row, events: [] };
  const f = fixture();
  f.handler(async path => {
    if (path.includes('/views/office-day')) return day;
    if (path.includes('/maintenance/cases')) return { ok: true, scope: day.scope, items: [saved], nextCursor: null, hhaWritesEnabled: false };
    assert.ok(path.endsWith('/maintenance/case'));
    return { ok: true, item: { ...saved, revision: 2 }, hhaWritesEnabled: false };
  });
  f.ready(); await tick(); f.event('maintenanceReportTab');
  const open = f.ids.get('maintenanceReportRows').querySelectorAll('button').find(node => node.textContent === 'Open office case');
  assert.ok(open); open.click(); await tick();
  assert.equal(f.ids.get('maintenanceReport').hidden, true);
  assert.ok(f.ids.get('maintenanceQueue').classList.contains('has-selection'));
  assert.match(f.text(f.ids.get('maintenanceDetail')), /Office case · revision 2/);
  const read = f.calls.filter(([path]) => path.endsWith('/maintenance/case'));
  assert.equal(read.length, 1);
  assert.deepEqual(JSON.parse(read[0][1].body), { date, visitId: row.id });
  assert.ok(f.calls.every(([path]) => !/maintenance\/(save|calls|reasons)/.test(path)));
});

test('a saved case for another patient stays in the report when opened from the queue', async () => {
  for (const listed of [true, false]) {
    const saved = { visitId: row.id, officeId: day.scope.officeId, date, revision: 1,
      status: listed ? 'office_review_complete' : 'awaiting_hha_action', queue: 'office_manager', hhaSubmission: 'not_submitted',
      source: { ...row, patientId: '26' }, events: [],
      calls: { visitLink: 'not_supplied_by_source', records: [{ CallDashboardID: '45', CallTime: date + ' 08:00' }] } };
    const f = fixture();
    f.handler(async path => {
      if (path.includes('/views/office-day')) return day;
      if (path.includes('/maintenance/cases')) return { ok: true, scope: day.scope, items: listed ? [saved] : [], nextCursor: null, hhaWritesEnabled: false };
      assert.ok(path.endsWith('/maintenance/case'));
      return { ok: true, item: saved, hhaWritesEnabled: false };
    });
    f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
    const detail = f.ids.get('maintenanceDetail'), queue = f.ids.get('maintenanceList');
    assert.match(f.text(detail), /Saved case and current visit differ.*Office report/);
    assert.equal(detail.querySelectorAll('form').length, 0);
    assert.doesNotMatch(f.text(detail), /Call 45|Read caregiver calls|Office case · revision/);
    assert.doesNotMatch(f.text(queue), /Office review complete|Awaiting HHA action/);
    assert.equal(f.ids.get('maintenanceMetrics').children[3].children[0].textContent, '0');
    f.event('maintenanceReportTab');
    assert.match(f.text(f.ids.get('maintenanceReportRows')), /Read-only saved case/);
    assert.equal(f.ids.get('maintenanceReportRows').querySelectorAll('button').length, 0);
    assert.ok(f.calls.every(([path]) => !/maintenance\/(save|calls|reasons)/.test(path)));
  }
});

test('maintenance distinguishes deferred, withheld and empty detail fields in the queue', async () => {
  const reasons = [
    ['not_attempted_batch_time_budget', /deferred by the batch time limit/],
    ['not_attempted_after_batch_gate', /deferred after a source or access limit/],
    ['read_budget_exhausted_retry_next_minute', /Shared read limit reached/],
    ['vendor_backoff_active', /Vendor retry delay recorded/],
    ['visit_patient_office_mismatch', /Patient office could not be verified/],
    ['visit_date_scope_mismatch', /Source visit date differs from the selected day/],
    ['visit_not_uniquely_returned', /Source did not return one matching visit/],
    ['constructor', /Source detail could not be verified/],
  ];
  const unavailable = reasons.map(([error], index) => ({ ...row, id: String(20 + index), state: 'unavailable', error }));
  const readable = { ...row, scheduledStart: null, scheduledEnd: null };
  const f = fixture({ rows: [...unavailable, readable] });
  f.ready(); await tick();
  const buttons = f.ids.get('maintenanceList').querySelectorAll('button');
  for (const [index, [error, expected]] of reasons.entries()) {
    const label = f.text(buttons[index]);
    assert.match(label, expected);
    assert.match(label, /Clock presence is unknown/);
    assert.doesNotMatch(label, /Not supplied by HHA|Source read failed|09:00|12:00|constructor/);
    assert.ok(!label.includes(error));
  }
  assert.match(f.text(buttons.at(-1)), /Not supplied by HHA/);
  assert.equal(f.ids.get('maintenanceMetrics').children[1].children[0].textContent, '1');
  buttons[2].click(); await tick();
  assert.match(f.text(f.ids.get('maintenanceEvidence')), /Shared read limit reached/);
});

test('an unavailable refresh cannot claim that a saved visit changed', async () => {
  const unavailable = { id: row.id, state: 'unavailable', error: 'vendor_backoff_active' };
  const saved = { visitId: row.id, officeId: day.scope.officeId, date, revision: 1,
    status: 'in_review', queue: 'office_manager', hhaSubmission: 'not_submitted', source: row, events: [] };
  const f = fixture({ rows: [unavailable] });
  f.handler(async path => {
    if (path.includes('/views/office-day')) return { ...day, items: [unavailable] };
    if (path.includes('/maintenance/cases')) return { ok: true, scope: day.scope, items: [saved], nextCursor: null, hhaWritesEnabled: false };
    return { ok: true, item: saved, hhaWritesEnabled: false };
  });
  f.ready(); await tick(); f.ids.get('maintenanceList').querySelectorAll('button')[0].click(); await tick();
  const detail = f.text(f.ids.get('maintenanceDetail'));
  assert.match(detail, /Vendor retry delay recorded/);
  assert.doesNotMatch(detail, /Source facts changed|08:57/);
  assert.equal(f.ids.get('maintenanceCaseForm'), undefined);
});
