import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

for (const apiOnly of [true, false]) test(`Firebase discovery preserves API and ${apiOnly ? 'excludes' : 'retains'} scheduled monitor`, () => {
  const script = `const {loadStack}=require('./node_modules/firebase-functions/lib/runtime/loader.js'); loadStack(process.cwd()).then(stack=>console.log(JSON.stringify({endpoints:Object.keys(stack.endpoints),apis:stack.requiredAPIs.map(x=>x.api)})));`;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: new URL('..', import.meta.url), env: { ...process.env, PRIMETIME_API_ONLY_DEPLOY: String(apiOnly) }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(result.stdout.trim());
  assert.deepEqual(manifest.endpoints.sort(), apiOnly ? ['primetimeApi'] : ['primetimeApi', 'primetimeRevisionMonitor']);
  assert.equal(manifest.apis.includes('cloudscheduler.googleapis.com'), !apiOnly);
});

test('API-only workflow targets only the API and does not request deletion, Scheduler or force', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-firebase.yml', import.meta.url), 'utf8');
  const step = workflow.split('- name: Deploy Primetime Functions')[1].split('- name: Verify anonymous')[0];
  assert.match(step, /PRIMETIME_API_ONLY_DEPLOY: "true"/);
  assert.match(step, /--only functions:primetimeApi --project primetimehomehealthservices --non-interactive/);
  assert.doesNotMatch(step, /--force|functions:delete|services enable/);
});
