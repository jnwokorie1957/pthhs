import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DATABASE_NAME, DATABASE_URL, runVerification, verifyFirestoreDeployment } from './verify-firestore-deployment.mjs';

const token = 'synthetic-credential-never-log';
const database = { name: DATABASE_NAME, type: 'FIRESTORE_NATIVE', locationId: 'us-central1' };
const options = fetcher => ({ fetcher, getAccessToken: async () => token });

test('storage preflight reads only the exact default database metadata', async () => {
  let calls = 0;
  const result = await verifyFirestoreDeployment(options(async (url, init) => {
    calls++;
    assert.equal(url, DATABASE_URL);
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.body, undefined);
    return new Response(JSON.stringify(database));
  }));
  assert.deepEqual(result, { ok: true, database: DATABASE_NAME, location: 'us-central1' });
  assert.equal(calls, 1);
});

test('a missing database and insufficient metadata permissions block deployment distinctly', async () => {
  for (const [status, code] of [[404, 'firestore_default_database_missing'], [401, 'firestore_metadata_permission_denied'], [403, 'firestore_metadata_permission_denied'], [503, 'firestore_metadata_unavailable']]) {
    await assert.rejects(verifyFirestoreDeployment(options(async () => new Response(token, { status }))), { message: code });
  }
});

test('invalid credentials and network failures cannot produce a successful storage check', async () => {
  for (const value of [undefined, '', 'line\nbreak', 'a'.repeat(10001)]) {
    await assert.rejects(verifyFirestoreDeployment({ getAccessToken: async () => value, fetcher: async () => { assert.fail('must not fetch'); } }), /firestore_verification_credentials_unavailable/);
  }
  await assert.rejects(verifyFirestoreDeployment(options(async () => { throw new Error(token); })), /firestore_metadata_unavailable/);
  await assert.rejects(verifyFirestoreDeployment({ getAccessToken: async () => { throw new Error(token); } }), /firestore_verification_credentials_unavailable/);
});

test('wrong databases, Datastore mode, and malformed metadata are rejected', async () => {
  for (const [value, code] of [
    [{ ...database, name: DATABASE_NAME.replace('(default)', 'other') }, 'firestore_database_identity_mismatch'],
    [{ ...database, type: 'DATASTORE_MODE' }, 'firestore_native_database_required'],
    [{ ...database, locationId: undefined }, 'firestore_location_missing'],
    [null, 'firestore_database_identity_mismatch'],
  ]) await assert.rejects(verifyFirestoreDeployment(options(async () => new Response(JSON.stringify(value)))), { message: code });
  for (const body of ['invalid JSON', 'x'.repeat(64001)]) {
    await assert.rejects(verifyFirestoreDeployment(options(async () => new Response(body))), /firestore_metadata_invalid/);
  }
  // An existing Native database in another region must not be recreated or moved.
  assert.equal((await verifyFirestoreDeployment(options(async () => new Response(JSON.stringify({ ...database, locationId: 'nam5' }))))).location, 'nam5');
});

test('verification failure reports the setup guide without logging credentials or API bodies', async () => {
  const messages = [];
  const output = { log: value => messages.push(value), error: value => messages.push(value) };
  const result = await runVerification({ ...options(async () => new Response(token, { status: 404 })), output });
  assert.equal(result.exitCode, 1);
  assert.match(messages.join('\n'), /firestore_default_database_missing/);
  assert.match(messages.join('\n'), /FIRESTORE_SETUP.md/);
  assert.doesNotMatch(messages.join('\n'), new RegExp(token));
});

test('backend deployment verifies storage and publishes server-only rules before Functions', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-firebase.yml', import.meta.url), 'utf8');
  const backend = workflow.split('  deploy_backend:')[1];
  const verify = backend.indexOf('run: node functions/scripts/verify-firestore-deployment.mjs');
  const rules = backend.indexOf('run: firebase deploy --only firestore:rules');
  const functions = backend.indexOf('run: firebase deploy --only functions');
  assert.ok(verify > 0 && verify < rules && rules < functions);
  const config = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'));
  assert.equal(config.firestore.rules, 'firestore.rules');
});
