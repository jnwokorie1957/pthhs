import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/primetime/primetime.js', import.meta.url), 'utf8');

function startApp(session, health = { ok: true, status: 200, json: async () => ({ ok: true }) }, options = {}) {
  const elements = new Map();
  const element = id => {
    if (id === 'capabilityRows') return null;
    if (!elements.has(id)) elements.set(id, {
      hidden: id === 'appShell', dataset: {}, value: '', handlers: {},
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, addEventListener(name, callback) { this.handlers[name] = callback; }, focus() {}, textContent: ''
    });
    return elements.get(id);
  };
  const calls = { persistence: [], sends: [], completions: [], signOuts: 0 };
  const auth = {
    currentUser: null,
    isSignInWithEmailLink(href) { return href.includes('mode=signIn'); },
    async setPersistence(value) { calls.persistence.push(value); },
    async sendSignInLinkToEmail(email, settings) {
      calls.sends.push({ email, settings });
      if (options.send) await options.send(email, settings);
    },
    async signInWithEmailLink(email, link) {
      calls.completions.push({ email, link });
      if (options.complete) return options.complete(email, link, auth);
      const user = { uid: 'link-user', email, getIdToken: async () => 'link-token' };
      this.currentUser = user;
      await this.callback(user);
      return { user };
    },
    onAuthStateChanged(callback) { this.callback = callback; },
    async signOut() { calls.signOuts += 1; this.currentUser = null; await this.callback(null); }
  };
  const firebase = { auth: Object.assign(() => auth, { Auth: { Persistence: { SESSION: 'session' } } }) };
  const requests = [];
  const storage = new Map(options.storedEmail ? [['primetime.emailForSignIn', options.storedEmail]] : []);
  const localStorage = {
    getItem(key) { if (options.storageBlocked) throw new Error('storage blocked'); return storage.get(key) || null; },
    setItem(key, value) { if (options.storageBlocked) throw new Error('storage blocked'); storage.set(key, value); },
    removeItem(key) { if (options.storageBlocked) throw new Error('storage blocked'); storage.delete(key); }
  };
  const location = { hash: '', href: options.href || 'https://pthhs.net/primetime' };
  const historyChanges = [];
  const events = [];
  const window = { firebase, innerWidth: 1200, localStorage, location };
  vm.runInNewContext(source, {
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {}, dispatchEvent(event) { events.push(event.type); } },
    window,
    location, history: { replaceState(_state, _title, url) { historyChanges.push(url); location.href = new URL(url, location.href).href; } }, Headers, Event,
    fetch: async (path, options) => {
      requests.push({ path, options });
      return path.endsWith('/session') ? session : path.endsWith('/hha/health') ? health : {
        ok: true, status: 200, json: async () => ({ ok: true })
      };
    }
  });
  return { auth, element, requests, window, calls, storage, historyChanges, events,
    submit: () => element('loginForm').handlers.submit({ preventDefault() {} }),
    requestNew: () => element('requestNewLink').handlers.click(),
    signOut: () => element('signOutButton').handlers.click()
  };
}

const approvedSession = { ok: true, status: 200, json: async () => ({ ok: true, roles: ['admin'] }) };
const emailLink = 'https://pthhs.net/primetime?mode=signIn&oobCode=one-time-fixture&apiKey=fixture';
const settle = () => new Promise(resolve => setImmediate(resolve));

for (const [status, payload, expected] of [
  [200, { ok: true, hhaConnection: 'reachable', operation: 'GetCollectionStatus' }, 'HHA reference API: reachable; imports not verified'],
  [200, { ok: true }, 'HHA reference check: unverified response'],
  [200, { ok: true, hhaConnection: 'reachable', operation: 'Other' }, 'HHA reference check: unverified response'],
  [403, { ok: false }, 'HHA check: administrator session rejected; sign in again'],
  [502, { ok: false, hhaConnection: 'auth_failure' }, 'HHA reference check: vendor authentication rejected'],
  [502, { ok: false, hhaConnection: 'operation_failure' }, 'HHA reference check: operation failed; access not confirmed'],
  [503, { ok: false, hhaConnection: 'unavailable_or_deferred', detail: 'PRIVATE-SOURCE' }, 'HHA reference check: unavailable or deferred; check backend, storage and throttle state']
]) {
  test(`reference health distinguishes ${status} ${JSON.stringify(payload)}`, async () => {
    const app = startApp({ ok: true, status: 200, json: async () => ({ ok: true, roles: ['admin'] }) },
      { ok: status === 200, status, json: async () => payload });
    app.auth.currentUser = { uid: 'approved', getIdToken: async () => 'fixture-token' };
    await app.auth.callback(app.auth.currentUser);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.element('hhaSyncStatus').textContent, expected);
    assert.equal(app.element('hhaConnectionStatus').textContent.includes('PRIVATE-SOURCE'), false);
    assert.equal(app.requests.filter(request => request.path.endsWith('/hha/health')).length, 1);
  });
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

test('sending a sign-in link uses a fixed HTTPS return and never opens the workspace', async () => {
  const app = startApp(approvedSession);
  await app.auth.callback(null);
  app.element('loginEmail').value = ' jeremynwokorie@gmail.com ';
  await app.submit();
  assert.equal(app.calls.persistence.join(), 'session');
  assert.equal(app.calls.sends.length, 1);
  assert.equal(app.calls.sends[0].email, 'jeremynwokorie@gmail.com');
  assert.equal(app.calls.sends[0].settings.url, 'https://pthhs.net/primetime');
  assert.equal(app.calls.sends[0].settings.handleCodeInApp, true);
  assert.equal(app.storage.get('primetime.emailForSignIn'), 'jeremynwokorie@gmail.com');
  assert.equal(app.element('appShell').hidden, true);
  assert.equal(app.requests.length, 0);
  assert.match(app.element('authMessage').textContent, /Check your email/);
});

test('an empty email and repeated submission cannot send unwanted duplicate links', async () => {
  let release;
  const app = startApp(approvedSession, undefined, { send: () => new Promise(resolve => { release = resolve; }) });
  await app.auth.callback(null);
  await app.submit();
  assert.equal(app.calls.sends.length, 0);
  app.element('loginEmail').value = 'approved@example.com';
  const first = app.submit();
  await settle();
  assert.equal(app.element('loginSubmit').disabled, true);
  await app.submit();
  assert.equal(app.calls.sends.length, 1);
  release();
  await first;
  assert.equal(app.element('loginSubmit').disabled, false);
});

test('same-device completion keeps the original link in memory and waits for server approval', async () => {
  let releaseSession;
  const app = startApp({ ok: true, status: 200, json: () => new Promise(resolve => { releaseSession = resolve; }) }, undefined, {
    href: emailLink, storedEmail: 'approved@example.com'
  });
  await app.auth.callback(null);
  assert.equal(app.element('loginEmail').value, 'approved@example.com');
  assert.equal(app.element('loginSubmit').textContent, 'Finish sign in');
  assert.equal(app.historyChanges[0], '/primetime');
  assert.equal(app.window.location.href, 'https://pthhs.net/primetime');
  assert.equal(app.calls.completions.length, 0);
  const finishing = app.submit();
  await settle();
  assert.equal(app.calls.completions[0].link, emailLink);
  assert.equal(app.calls.completions[0].email, 'approved@example.com');
  assert.equal(app.element('appShell').hidden, true);
  assert.equal(app.requests.filter(request => request.path.endsWith('/hha/health')).length, 0);
  releaseSession({ ok: true, roles: ['admin'] });
  await finishing;
  await settle();
  assert.equal(app.storage.has('primetime.emailForSignIn'), false);
  assert.equal(app.element('appShell').hidden, false);
  assert.equal(app.events.filter(event => event === 'primetime-ready').length, 1);
  await app.auth.callback(app.auth.currentUser);
  assert.equal(app.requests.filter(request => request.path.endsWith('/session')).length, 1);
});

test('cross-device completion asks for the mailbox and ignores email URL parameters', async () => {
  const app = startApp(approvedSession, undefined, { href: emailLink + '&email=attacker%40example.com' });
  await app.auth.callback(null);
  assert.equal(app.element('loginEmail').value, '');
  await app.submit();
  assert.equal(app.calls.completions.length, 0);
  app.element('loginEmail').value = 'approved@example.com';
  await app.submit();
  assert.equal(app.calls.completions[0].email, 'approved@example.com');
  assert.equal(app.element('appShell').hidden, false);
});

test('blocked browser storage does not prevent sending or confirmed link completion', async () => {
  const sending = startApp(approvedSession, undefined, { storageBlocked: true });
  await sending.auth.callback(null);
  sending.element('loginEmail').value = 'approved@example.com';
  await sending.submit();
  assert.equal(sending.calls.sends.length, 1);
  assert.match(sending.element('authMessage').textContent, /Check your email/);
  const finishing = startApp(approvedSession, undefined, { href: emailLink, storageBlocked: true });
  await finishing.auth.callback(null);
  finishing.element('loginEmail').value = 'approved@example.com';
  await finishing.submit();
  assert.equal(finishing.element('appShell').hidden, false);
});

for (const code of ['auth/expired-action-code', 'auth/invalid-action-code']) {
  test(`${code} returns to requesting a new link with the workspace closed`, async () => {
    const app = startApp(approvedSession, undefined, {
      href: emailLink, storedEmail: 'approved@example.com',
      complete: async () => { throw Object.assign(new Error('PRIVATE VENDOR MESSAGE'), { code }); }
    });
    await app.auth.callback(null);
    await app.submit();
    assert.equal(app.requests.length, 0);
    assert.equal(app.element('appShell').hidden, true);
    assert.equal(app.element('loginSubmit').textContent, 'Send sign-in link');
    assert.match(app.element('authMessage').textContent, /invalid or expired/);
    assert.equal(app.element('authMessage').textContent.includes('PRIVATE'), false);
  });
}

test('mailbox mismatch stays closed and allows correction or requesting a new link', async () => {
  const app = startApp(approvedSession, undefined, {
    href: emailLink,
    complete: async () => { throw Object.assign(new Error('PRIVATE'), { code: 'auth/invalid-email' }); }
  });
  await app.auth.callback(null);
  app.element('loginEmail').value = 'wrong@example.com';
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.equal(app.element('appShell').hidden, true);
  assert.equal(app.element('loginSubmit').textContent, 'Finish sign in');
  assert.match(app.element('authMessage').textContent, /Confirm the email/);
  app.requestNew();
  assert.equal(app.element('loginSubmit').textContent, 'Send sign-in link');
  assert.equal(app.element('requestNewLink').hidden, true);
});

for (const session of [
  { ok: false, status: 403 },
  { ok: true, status: 200, json: async () => ({ ok: true, roles: ['visitor'] }) }
]) {
  test(`an email-link user rejected by the server (${session.status}) cannot reach HHA`, async () => {
    const app = startApp(session, undefined, { href: emailLink, storedEmail: 'visitor@example.com' });
    await app.auth.callback(null);
    await app.submit();
    assert.equal(app.element('appShell').hidden, true);
    assert.equal(app.auth.currentUser, null);
    assert.equal(app.requests.filter(request => request.path.endsWith('/session')).length, 1);
    assert.equal(app.requests.filter(request => request.path.endsWith('/hha/health')).length, 0);
  });
}

for (const transition of ['logout', 'account switch', 'same-user new session']) {
  test(`a delayed email-link completion cannot reopen the workspace after ${transition}`, async () => {
    let release;
    const returnedUser = { uid: 'link-user', email: 'approved@example.com', getIdToken: async () => 'old-token' };
    const app = startApp(approvedSession, undefined, {
      href: emailLink, storedEmail: 'approved@example.com',
      complete: async (_email, _link, auth) => {
        await new Promise(resolve => { release = resolve; });
        auth.currentUser = returnedUser;
        await auth.callback(returnedUser);
        return { user: returnedUser };
      }
    });
    await app.auth.callback(null);
    const pending = app.submit();
    await settle();
    await app.submit();
    assert.equal(app.calls.completions.length, 1);
    if (transition === 'logout') await app.signOut();
    else {
      app.auth.currentUser = { uid: transition === 'account switch' ? 'other' : returnedUser.uid, getIdToken: async () => 'new-token' };
      await app.auth.callback(app.auth.currentUser);
    }
    release();
    await pending;
    assert.equal(app.element('appShell').hidden, true);
    assert.equal(app.auth.currentUser, null);
    assert.equal(app.requests.length, 0);
    assert.equal(app.events.includes('primetime-ready'), false);
  });
}

test('a pre-existing signed-in account cannot bypass confirmation of a new email link', async () => {
  const app = startApp(approvedSession, undefined, { href: emailLink });
  app.auth.currentUser = { uid: 'previous-user', getIdToken: async () => 'previous-token' };
  await app.auth.callback(app.auth.currentUser);
  assert.equal(app.requests.length, 0);
  assert.equal(app.element('appShell').hidden, true);
  assert.match(app.element('authMessage').textContent, /Confirm the email/);
});
