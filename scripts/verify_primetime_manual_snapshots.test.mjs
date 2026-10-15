import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('switching patients while post-import history loads cannot repaint the prior patient', async () => {
  const elements = new Map(), events = new Map();
  const node = (id = '') => ({ id, children: [], handlers: new Map(), options: [], value: '', hidden: id === 'appShell', dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, addEventListener(event, handler) { this.handlers.set(event, handler); },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, querySelectorAll() { return []; },
    querySelector() { return null; }, closest() { return { hidden: false }; }, reset() {}, focus() {}, setAttribute() {} });
  const get = id => { if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); };
  const document = { getElementById: get, querySelectorAll: () => [], createElement: () => node(), createTextNode: text => ({ textContent: text }), addEventListener(event, handler) { events.set(event, handler); } };
  let releaseHistory, historyStarted = false;
  const snapshot = { patientId: '13', patientLabel: 'Synthetic prior patient', period: '2026-09', officeId: '12', capturedAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:01:00.000Z', authorizations: { columns: ['Payer'], rows: [] }, visits: [{ id: '14', date: '2026-09-01', text: 'Synthetic source' }] };
  const window = { primetimeDataMode: { isLive: () => true }, async primetimeApiFetch(path, options) {
    let result;
    if (path.endsWith('/settings')) result = { settings: { officeId: '12', enabledReads: [], policyReference: '' }, dataApproved: true, supportedReads: [] };
    else if (options?.method === 'POST' && path.endsWith('/manual-snapshots')) result = { snapshot, duplicate: false };
    else { historyStarted = true; result = await new Promise(resolve => { releaseHistory = resolve; }); }
    return { ok: true, json: async () => ({ ok: true, ...result }) };
  } };
  vm.runInNewContext(readFileSync(new URL('../public/primetime/workspace.js', import.meta.url), 'utf8'), { document, window, URLSearchParams, console });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  events.get('primetime-ready')(); await tick();
  get('manualSnapshotPayload').value = '{}';
  get('manualSnapshotForm').handlers.get('submit')({ preventDefault() {} }); await tick();
  assert.equal(historyStarted, true);
  get('manualPatientId').value = '21'; get('manualPatientId').handlers.get('input')();
  releaseHistory({ items: [], nextCursor: null }); await tick();
  assert.equal(get('manualPatientId').value, '21');
  assert.equal(get('manualSnapshotDetails').children.length, 0);
  assert.equal(get('manualSnapshotList').children.length, 0);
  assert.equal(get('manualSnapshotStatus').textContent, 'Enter a patient ID to load protected imports.');
});
