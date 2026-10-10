import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyAnonymousBoundary, SESSION_URLS } from './verify-anonymous-deployment.mjs';

const response = (status = 401, body = { error: 'unauthorized' }, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
});
test('anonymous verification uses only fixed session URLs and missing or deliberately invalid credentials', async () => {
  const calls = [];
  assert.equal(await verifyAnonymousBoundary(async (url, options) => { calls.push({url,options}); return response(); }), 6);
  assert.deepEqual(calls.map(x=>x.url), SESSION_URLS.flatMap(url=>[url,url]));
  for (let i=0;i<calls.length;i++) {
    assert.equal(calls[i].options.headers.Authorization, i%2 ? 'Bearer invalid-token' : undefined);
    assert.equal(calls[i].options.redirect, 'error');
    assert.equal(calls[i].options.body, undefined);
  }
});
test('redirect/network, successful pages, generic errors, cached responses and extra payload fields cannot pass', async () => {
  for (const factory of [()=>response(200),()=>response(403),()=>response(401,{error:'other'}),
    ()=>response(401,{error:'unauthorized',data:'unexpected'}),
    ()=>response(401,{error:'unauthorized'},{'cache-control':'public'}),
    ()=>response(401,{error:'unauthorized'},{'content-type':'text/html'})]) {
    await assert.rejects(verifyAnonymousBoundary(async()=>factory()), /verification failed/);
  }
  await assert.rejects(verifyAnonymousBoundary(async()=>{throw new Error('network failure')}), /network failure/);
});
test('workflow preserves deploy failure and runs separate credential-free verification only after a deployment attempt', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-firebase.yml',import.meta.url),'utf8');
  const section = workflow.split('      - name: Deploy Primetime Functions')[1];
  assert.ok(section.includes('id: deploy_functions'));
  assert.ok(section.includes("if: ${{ !cancelled() && (steps.deploy_functions.outcome == 'success' || steps.deploy_functions.outcome == 'failure') }}"));
  assert.ok(section.includes('run: node functions/scripts/verify-anonymous-deployment.mjs'));
  assert.ok(!section.includes('continue-on-error'));
  assert.ok(!section.includes('--force'));
  assert.ok(!section.includes('|| true'));
  const anonymous = section.split('      - name: Verify anonymous API boundary independently')[1].split('      - name: Report authenticated acceptance pending')[0];
  assert.ok(!anonymous.includes('GOOGLE_APPLICATION_CREDENTIALS'));
});

test('artifact retention is configured narrowly without forcing function deployment', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-firebase.yml', import.meta.url), 'utf8');
  const policy = workflow.split('      - name: Configure deployment artifact retention')[1].split('      - name: Deploy Primetime Functions')[0];
  assert.ok(policy.includes('firebase functions:artifacts:setpolicy --project primetimehomehealthservices --location us-central1 --days 7 --force --non-interactive'));
  const deployment = workflow.split('      - name: Deploy Primetime Functions')[1].split('      - name: Verify anonymous')[0];
  assert.doesNotMatch(deployment, /--force|continue-on-error|\|\| true/);
});
