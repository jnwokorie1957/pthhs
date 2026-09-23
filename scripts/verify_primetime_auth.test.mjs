import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/primetime/primetime.js', import.meta.url), 'utf8');

function startApp(session) {
  const elements = new Map();
  const element = id => {
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
  vm.runInNewContext(source, {
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    window: { firebase, innerWidth: 1200 },
    location: { hash: '' }, history: { replaceState() {} }, Headers,
    fetch: async (path, options) => {
      requests.push({ path, options });
      return path.endsWith('/session') ? session : {
        ok: true, status: 200, json: async () => ({ ok: true })
      };
    }
  });
  return { auth, element, requests };
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
