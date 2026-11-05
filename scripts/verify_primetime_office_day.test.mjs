import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const window = { primetimeSourceTime: { timestampInstant: s => Number.isFinite(Date.parse(s)) ? Date.parse(s) : null } };
vm.runInNewContext(await readFile(new URL('../source/primetime/dashboard.js', import.meta.url), 'utf8'), { window });
const { collectOfficeDay, sourceEvidence } = window.primetimeDashboardModel;
const expected = { mode: 'live', officeId: '123', date: '2026-11-04' };
function page(offset, total = 23, overrides = {}) {
  const items = Array.from({ length: Math.min(10, total - offset) }, (_, i) => ({
    id: String(offset + i + 1), state: 'source_unvalidated', patientId: '5', caregiverId: '6',
    scheduledStart: '2026-11-04T09:00:00', scheduledEnd: '2026-11-04T10:00:00',
    actualStart: '2026-11-04T09:01:00', actualEnd: i % 2 ? null : '2026-11-04T10:00:00',
    evvStart: null, evvEnd: null, detailFetchedAt: '2026-11-04T16:00:00Z', officeCheckedAt: '2026-11-04T16:00:01Z'
  }));
  const next = offset + items.length < total ? offset + items.length : null;
  return { ok: true, mode: 'live', source: 'hhaexchange', validation: 'source_unvalidated', state: next === null ? 'ready' : 'partial',
    scope: { officeId: '123', date: '2026-11-04', timezone: 'America/Chicago' }, fetchedAt: '2026-11-04T16:00:00Z',
    discovery: { fingerprint: 'a'.repeat(64), selectedCount: total, truncated: false },
    page: { offset, selectedCount: items.length, returnedCount: items.length, unavailableCount: 0, nextOffset: next },
    completeness: { truncated: false }, totals: null, retry: null, nextCursor: next === null ? null : 'cursor' + next, items, ...overrides };
}
test('office day collects every detail page and calculates charts across all 23 visits', async () => {
  const calls = [], progress = [];
  const view = await collectOfficeDay(page(0), expected, async cursor => { calls.push(cursor); return page(Number(cursor.slice(6))); },
    v => progress.push([v.items.length, v.officeDay.done]), () => true, async () => {});
  assert.equal(view.items.length, 23); assert.equal(new Set(view.items.map(v => v.id)).size, 23);
  assert.deepEqual(calls, ['cursor10', 'cursor20']); assert.equal(progress.at(-1)[1], true);
  assert.equal(sourceEvidence(view.items).actualPairs, 12); assert.equal(view.officeDay.complete, true);
});
test('empty office day needs no detail request and is distinct from a failed read', async () => {
  const view = await collectOfficeDay(page(0, 0), expected, async () => assert.fail(), () => {}, () => true, async () => {});
  assert.equal(view.items.length, 0); assert.equal(view.officeDay.complete, true);
  await assert.rejects(collectOfficeDay(page(0), expected, async () => { throw Error('source failed'); }, () => {}, () => true, async () => {}), /source failed/);
});
test('office day refuses changed discovery, scope, gaps, repeated IDs and broken cursors', async () => {
  for (const broken of [
    p => ({ ...p, discovery: { ...p.discovery, fingerprint: 'b'.repeat(64) } }),
    p => ({ ...p, scope: { ...p.scope, officeId: '999' } }),
    p => ({ ...p, page: { ...p.page, offset: 11 } }),
    p => ({ ...p, items: p.items.map((r, i) => i ? r : { ...r, id: '1' }) }),
    p => ({ ...p, nextCursor: null })
  ]) await assert.rejects(collectOfficeDay(page(0), expected, async () => broken(page(10)), () => {}, () => true, async () => {}));
});
test('retry replaces unavailable rows without double counting and observes vendor delay', async () => {
  const first = page(0, 12), delays = [], calls = [];
  first.items[4] = { id: '5', state: 'unavailable', error: 'vendor_backoff_active' };
  first.page.returnedCount--; first.page.unavailableCount++;
  first.retry = { cursor: 'retry4', offset: 4, afterSeconds: 7, reason: 'read_limit' };
  const view = await collectOfficeDay(first, expected, async cursor => { calls.push(cursor); return page(4, 12); }, () => {}, () => true, async s => delays.push(s));
  assert.deepEqual(calls, ['retry4']); assert.deepEqual(delays, [7]);
  assert.equal(view.items.length, 12); assert.equal(sourceEvidence(view.items).unavailable, 0);
});
test('failed details and source truncation cannot become complete charts', async () => {
  const first = page(0, 4); first.items[1] = { id: '2', state: 'unavailable' }; first.page.returnedCount--; first.page.unavailableCount++;
  const view = await collectOfficeDay(first, expected, async () => assert.fail(), () => {}, () => true, async () => {});
  assert.equal(view.officeDay.done, true); assert.equal(view.officeDay.complete, false); assert.equal(sourceEvidence(view.items).readable, 3);
  const truncated = page(0, 4); truncated.discovery.truncated = true;
  const limited = await collectOfficeDay(truncated, expected, async () => assert.fail(), () => {}, () => true, async () => {});
  assert.equal(limited.officeDay.complete, false);
});
test('cancelled context cannot publish a late page or start another source request', async () => {
  let active = true, updates = 0, reads = 0;
  await assert.rejects(collectOfficeDay(page(0), expected, async () => { reads++; active = false; return page(10); }, () => updates++, () => active, async () => {}), /cancelled/);
  assert.equal(reads, 1); assert.equal(updates, 1);
});
test('earlier truncation remains incomplete and retry loops are bounded', async () => {
  const first = page(0); first.discovery.truncated = true;
  const view = await collectOfficeDay(first, expected, async cursor => page(Number(cursor.slice(6))), () => {}, () => true, async () => {});
  assert.equal(view.officeDay.complete, false); assert.equal(view.discovery.truncated, true);
  const blocked = page(0, 1); blocked.items[0] = { id: '1', state: 'unavailable' };
  blocked.page.returnedCount = 0; blocked.page.unavailableCount = 1;
  blocked.retry = { cursor: 'retry', offset: 0, afterSeconds: 1, reason: 'read_limit' };
  let calls = 0;
  await assert.rejects(collectOfficeDay(blocked, expected, async () => { calls++; return blocked; }, () => {}, () => true, async () => {}), /source_delayed/);
  assert.equal(calls, 3);
});
