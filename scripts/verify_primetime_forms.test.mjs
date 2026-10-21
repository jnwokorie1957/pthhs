import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
const source = await readFile(new URL('../source/primetime/forms.js', import.meta.url), 'utf8');
const bytes = Buffer.from('%PDF-1.4\nSynthetic\n%%EOF\n'), hash = createHash('sha256').update(bytes).digest('hex');
const item = { id: hash + '.pdf', kind: 'templates', filename: 'Synthetic.pdf', size: bytes.length, sha256: hash, contentType: 'application/pdf', uploadedAt: '2026-10-21T12:00:00Z' };
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const tick = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const settled = async f => {
  for (let i = 0; i < 400; i++) {
    if (!f.ids.get('formsReload').disabled) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('form action did not settle');
};
function fixture() {
  let clicks = 0, creates = 0, revokes = 0, live = true;
  class Element extends EventTarget {
    children = []; value = ''; textContent = ''; disabled = false; files = [];
    constructor(tag = '') { super(); this.tag = tag; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
    setAttribute() {}
    click() { clicks++; this.dispatchEvent(new Event('click')); }
    remove() {}
  }
  const ids = new Map(['formsWorkspace', 'formsStatus', 'formFile', 'formUploadKind', 'formUploadSubmit', 'formLibraryKind', 'formsReload', 'formsNext', 'formsRows', 'formUpload'].map(id => [id, new Element()]));
  ids.get('formLibraryKind').value = ids.get('formUploadKind').value = 'templates';
  const document = new EventTarget(); document.getElementById = id => ids.get(id); document.createElement = tag => new Element(tag); document.body = new Element('body');
  const calls = []; let handler = async () => json({ ok: true, items: [item], nextCursor: null });
  vm.runInNewContext(source, { document, window: { primetimeDataMode: { isLive: () => live }, primetimeApiFetch: async (...args) => { calls.push(args); return handler(...args); } },
    URL: { createObjectURL() { creates++; return 'blob:synthetic'; }, revokeObjectURL() { revokes++; } }, Blob, crypto: webcrypto, Uint8Array, Date, Error, btoa });
  const event = (id, name = 'click') => ids.get(id).dispatchEvent(new Event(name, { cancelable: true }));
  return { ids, calls, document, event, handler(value) { handler = value; }, live(value) { live = value; document.dispatchEvent(new Event('primetime-data-mode-changed')); },
    ready() { document.dispatchEvent(new Event('primetime-ready')); }, counts: () => ({ clicks, creates, revokes }) };
}
test('forms stay disabled while signed out or in Demo; file selection and rows clear on context changes', async () => {
  const f = fixture(); assert.equal(f.ids.get('formUploadSubmit').disabled, true);
  f.ready(); assert.equal(f.ids.get('formUploadSubmit').disabled, false);
  f.event('formsReload'); await tick(); assert.equal(f.ids.get('formsRows').children.length, 1);
  f.live(false); assert.equal(f.ids.get('formsRows').children.length, 0); assert.equal(f.ids.get('formsReload').disabled, true);
  f.event('formsReload'); await tick(); assert.equal(f.calls.length, 1);
  f.live(true); f.document.dispatchEvent(new Event('primetime-signed-out')); assert.equal(f.ids.get('formFile').value, ''); assert.equal(f.ids.get('formUploadSubmit').disabled, true);
});
test('uploads exact file bytes then refreshes the selected folder and reports deduplicated success', async () => {
  const f = fixture(); f.ready(); f.ids.get('formFile').files = [{ name: item.filename, size: bytes.length, arrayBuffer: async () => bytes }];
  f.handler(async (_, options) => options?.method === 'POST' ? json({ ok: true, item, duplicate: true }) : json({ ok: true, items: [item], nextCursor: null }));
  f.event('formUpload', 'submit'); await settled(f);
  assert.equal(f.calls.length, 2); assert.equal(f.calls[0][0], '/primetime/api/forms');
  assert.deepEqual(JSON.parse(f.calls[0][1].body), { kind: 'templates', filename: item.filename, base64: bytes.toString('base64') });
  assert.match(f.ids.get('formsStatus').textContent, /identical content reused/); assert.equal(f.ids.get('formFile').value, '');
});
test('download verifies bytes and response hash before creating a local attachment; mode change revokes it', async () => {
  const f = fixture(); f.ready(); f.event('formsReload'); await tick();
  f.handler(async () => new Response(bytes, { headers: { 'X-Content-SHA256': hash } }));
  f.ids.get('formsRows').querySelectorAll('button')[0].click(); await settled(f);
  assert.match(f.ids.get('formsStatus').textContent, /Download verified/); assert.equal(f.counts().creates, 1);
  f.live(false); assert.equal(f.counts().revokes, 1);
});
test('tampered download is blocked and produces no downloadable object', async () => {
  const f = fixture(); f.ready(); f.event('formsReload'); await tick();
  f.handler(async () => new Response('tampered', { headers: { 'X-Content-SHA256': hash } }));
  f.ids.get('formsRows').querySelectorAll('button')[0].click(); await settled(f);
  assert.equal(f.counts().creates, 0); assert.match(f.ids.get('formsStatus').textContent, /Download was blocked/);
});
test('late list and upload results cannot repopulate a signed-out or Demo session', async () => {
  for (const operation of ['load', 'upload']) {
    const f = fixture(); f.ready(); let resolve;
    f.handler(() => new Promise(r => { resolve = r; }));
    if (operation === 'load') f.event('formsReload');
    else { f.ids.get('formFile').files = [{ name: item.filename, size: bytes.length, arrayBuffer: async () => bytes }]; f.event('formUpload', 'submit'); }
    await tick(); f.live(false); resolve(json({ ok: true, item, items: [item], duplicate: false, nextCursor: 'next' })); await tick();
    assert.equal(f.ids.get('formsRows').children.length, 0); assert.match(f.ids.get('formsStatus').textContent, /Sign in/); assert.equal(f.calls.length, 1);
  }
});
test('pagination uses the server cursor and folder changes discard the old page', async () => {
  const f = fixture(); f.ready(); f.handler(async () => json({ ok: true, items: [item], nextCursor: 'page+/=' }));
  f.event('formsReload'); await tick(); assert.equal(f.ids.get('formsNext').disabled, false);
  f.event('formsNext'); await tick(); assert.match(f.calls[1][0], /cursor=page%2B%2F%3D/);
  f.ids.get('formLibraryKind').value = 'submissions'; f.event('formLibraryKind', 'change');
  assert.equal(f.ids.get('formsRows').children.length, 0); assert.equal(f.ids.get('formsNext').disabled, true);
});
