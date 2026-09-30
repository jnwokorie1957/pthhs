import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/primetime/primetime.js', import.meta.url), 'utf8');

function startApp(session) {
  const elements = new Map();
  const element = id => {
    if (id === 'capabilityRows') return null;
    if (!elements.has(id)) elements.set(id, {
      hidden: id === 'appShell', dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, addEventListener() {}, focus() {}, textContent: ''
    });
    return elements.get(id);
  };
  const auth = {
    currentUser: null,
    onAuthStateChanged(callback) { this.callback = callback; },
    async signOut() { this.currentUser = null; await this.callback(null); }
  };
  const firebase = { auth: () => auth };
  const requests = [];
  const window = { firebase, innerWidth: 1200 };
  vm.runInNewContext(source, {
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    window,
    location: { hash: '' }, history: { replaceState() {} }, Headers,
    fetch: async (path, options) => {
      requests.push({ path, options });
      return path.endsWith('/session') ? session : {
        ok: true, status: 200, json: async () => ({ ok: true })
      };
    }
  });
  return { auth, element, requests, window };
}

test('server rejection never reveals the management workspace', async () => {
  const app = startApp({ ok: false, status: 403 });
  app.auth.currentUser = { uid: 'visitor', getIdToken: async () => 'token' };
  await app.auth.callback(app.auth.currentUser);
  assert.equal(app.element('appShell').hidden, true);
  assert.equal(app.element('authShell').hidden, false);
  assert.equal(app.auth.currentUser, null);
  assert.equal(app.requests.length, 1);
});

test('admin server confirmation opens workspace and sign-out closes it', async () => {
  const app = startApp({
    ok: true, status: 200,
    json: async () => ({ ok: true, roles: ['admin'], email: 'approved@example.com' })
  });
  app.auth.currentUser = { uid: 'approved', getIdToken: async () => 'token' };
  await app.auth.callback(app.auth.currentUser);
  assert.equal(app.element('appShell').hidden, false);
  assert.equal(app.element('signedInIdentity').textContent, 'approved@example.com');
  assert.equal(app.requests[0].options.headers.Authorization, 'Bearer token');
  await app.auth.signOut();
  assert.equal(app.element('appShell').hidden, true);
});

for (const transition of ['logout', 'account switch', 'same-user new session']) {
  test(`delayed token cannot submit after ${transition}`, async () => {
    const app = startApp({ ok: true, status: 200, json: async () => ({ ok: true, roles: ['admin'] }) });
    const user = { uid: 'approved', getIdToken: async () => 'token' };
    app.auth.currentUser = user;
    await app.auth.callback(user);
    await new Promise(resolve => setImmediate(resolve));
    let release;
    user.getIdToken = () => new Promise(resolve => { release = resolve; });
    const pending = app.window.primetimeApiFetch('/primetime/api/workspace/rate-proposals/execute', { method: 'POST' });
    const rejected = assert.rejects(pending, /session_changed/);
    if (transition === 'logout') await app.auth.signOut();
    else {
      const next = { uid: transition === 'account switch' ? 'other' : user.uid, getIdToken: async () => 'newtoken' };
      app.auth.currentUser = next;
      await app.auth.callback(next);
    }
    release('oldtoken');
    await rejected;
    assert.equal(app.requests.filter(item => item.path.endsWith('/execute')).length, 0);
  });
}
