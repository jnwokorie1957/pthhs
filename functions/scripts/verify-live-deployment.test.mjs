import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(new URL('./verify-live-deployment.mjs', import.meta.url));
const reportScript = fileURLToPath(new URL('./report-acceptance-pending.mjs', import.meta.url));

test('unattended verification blocks without credentials or protected network calls', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pthhs-auth-gate-'));
  try {
    const guard = path.join(dir, 'guard.mjs');
    writeFileSync(guard, "globalThis.fetch = () => { throw new Error('NETWORK_ATTEMPT'); };\n");
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(guard).href, script], {
      encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '',
        GOOGLE_APPLICATION_CREDENTIALS: path.join(dir, 'must-not-read.json') },
    });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^BLOCKED: authenticated Primetime\/HHA acceptance/);
    assert.doesNotMatch(result.stderr, /NETWORK_ATTEMPT|ENOENT|must-not-read/);
    const source = readFileSync(script, 'utf8');
    assert.doesNotMatch(source, /firebase-admin|listUsers|createCustomToken|signInWithCustomToken|fetch\s*\(/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CI summary retains blocked acceptance instead of passing or exposing ambient values', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pthhs-auth-summary-'));
  try {
    const summary = path.join(dir, 'summary.md');
    writeFileSync(summary, 'Deployment outcome recorded separately.\n');
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: {
      ...process.env, GITHUB_STEP_SUMMARY: summary, PRIMETIME_ADMIN_UID: 'synthetic-private-uid',
      PRIMETIME_ID_TOKEN: 'synthetic-not-a-real-token',
    } });
    assert.equal(result.status, 2);
    const output = readFileSync(summary, 'utf8');
    assert.match(output, /^Deployment outcome recorded separately\./);
    assert.match(output, /Authenticated acceptance: BLOCKED/);
    assert.doesNotMatch(output + result.stderr, /synthetic-private-uid|synthetic-not-a-real-token/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('deployment reports pending acceptance after either outcome without claiming verification or suppressing failures', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-firebase.yml', import.meta.url), 'utf8');
  const section = workflow.split('      - name: Report authenticated acceptance pending')[1];
  assert.ok(section, 'deployment must keep manual acceptance visibly pending');
  assert.ok(section.includes("if: ${{ !cancelled() && (steps.deploy_functions.outcome == 'success' || steps.deploy_functions.outcome == 'failure') }}"));
  assert.ok(section.includes('run: node functions/scripts/report-acceptance-pending.mjs'));
  assert.doesNotMatch(section, /GOOGLE_APPLICATION_CREDENTIALS|continue-on-error|\|\| true/);
  assert.doesNotMatch(workflow, /run:\s*node functions\/scripts\/verify-live-deployment\.mjs/);
});

test('pending acceptance reporting succeeds without credentials or protected network calls', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pthhs-acceptance-report-'));
  try {
    const guard = path.join(dir, 'guard.mjs');
    writeFileSync(guard, "globalThis.fetch = () => { throw new Error('NETWORK_ATTEMPT'); };\n");
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(guard).href, reportScript], {
      encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '',
        GOOGLE_APPLICATION_CREDENTIALS: path.join(dir, 'must-not-read.json'),
        PRIMETIME_ADMIN_UID: 'synthetic-private-uid', PRIMETIME_ID_TOKEN: 'synthetic-private-token' },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^PENDING: authenticated Primetime\/HHA acceptance has not been performed/);
    assert.match(result.stdout, /normal email-link sign-in/);
    assert.match(result.stdout, /\/primetime\/api\/session.*\/primetime\/api\/hha\/health/);
    assert.doesNotMatch(result.stdout, /NETWORK_ATTEMPT|must-not-read|synthetic-private|acceptance: PASS/);
    const source = readFileSync(reportScript, 'utf8');
    assert.doesNotMatch(source, /firebase-admin|listUsers|createCustomToken|signInWithCustomToken|fetch\s*\(/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pending report preserves deployment evidence and states that green deployment is not acceptance', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pthhs-acceptance-summary-'));
  try {
    const summary = path.join(dir, 'summary.md');
    writeFileSync(summary, 'Deployment result: FAILURE at a specific step.\n');
    const result = spawnSync(process.execPath, [reportScript], { encoding: 'utf8', env: {
      ...process.env, GITHUB_STEP_SUMMARY: summary, PRIMETIME_ADMIN_UID: 'synthetic-private-uid',
      PRIMETIME_ID_TOKEN: 'synthetic-private-token',
    } });
    assert.equal(result.status, 0);
    const output = readFileSync(summary, 'utf8');
    assert.match(output, /^Deployment result: FAILURE at a specific step\./);
    assert.match(output, /Authenticated acceptance: PENDING/);
    assert.match(output, /does not change the deployment result/);
    assert.match(output, /successful deployment is not authenticated acceptance/);
    assert.doesNotMatch(output + result.stdout, /synthetic-private|Authenticated acceptance: PASS/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
