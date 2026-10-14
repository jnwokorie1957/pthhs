import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { expectedMonitorConfiguration, validateMonitorDeployment, verifyRevisionMonitorDeployment, runVerification,
  FUNCTION_NAME, JOB_NAME, FUNCTION_URL, JOB_URL } from './verify-revision-monitor-deployment.mjs';

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const expected = { schedule: '* * * * *', timeZone: 'America/Chicago', attemptDeadline: '300s', retryCount: 0 };
const uri = 'https://primetimerevisionmonitor-synthetic-uc.a.run.app';
const functionUrl = 'https://us-central1-primetimehomehealthservices.cloudfunctions.net/primetimeRevisionMonitor';
const serviceAccount = '123456789012-compute@developer.gserviceaccount.com';
const secret = 'synthetic-credential-never-log';
function deployment() {
  return {
    deployedFunction: { name: FUNCTION_NAME, state: 'ACTIVE', environment: 'GEN_2', url: functionUrl,
      serviceConfig: { uri, serviceAccountEmail: serviceAccount } },
    job: { name: JOB_NAME, state: 'ENABLED', schedule: expected.schedule, timeZone: expected.timeZone, attemptDeadline: expected.attemptDeadline,
      retryConfig: { retryCount: 0 }, httpTarget: { uri, httpMethod: 'POST', oidcToken: { serviceAccountEmail: serviceAccount } } },
  };
}
function requests(options = {}) {
  const values = deployment(), calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    assert.ok([JOB_URL, FUNCTION_URL].includes(url));
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Authorization, `Bearer ${secret}`); assert.equal(init.headers.Accept, 'application/json');
    assert.ok(init.signal instanceof AbortSignal);
    if (options.failureUrl === url) return new Response(options.failureBody ?? 'private metadata', { status: options.status ?? 404 });
    if (options.invalidUrl === url) return new Response(options.invalidBody ?? 'invalid JSON');
    return new Response(JSON.stringify(url === JOB_URL ? values.job : values.deployedFunction));
  };
  return { ...values, calls, fetcher };
}

test('the verifier derives the real schedule/timezone from source without executing the Function module', () => {
  assert.deepEqual(expectedMonitorConfiguration(source), expected);
  assert.deepEqual(expectedMonitorConfiguration(source.replace('timeZone: "America/Chicago"', 'timeZone: "America/New_York"')), { ...expected, timeZone: 'America/New_York' });
  for (const changed of [source.replace('schedule: "* * * * *"', 'schedule: "0 * * * *"'), source.replace('region: "us-central1", schedule:', 'region: "us-east1", schedule:'), 'unrecognized'])
    assert.throws(() => expectedMonitorConfiguration(changed), /monitor_source_configuration_unrecognized/);
  assert.throws(() => expectedMonitorConfiguration(source.replace('timeZone: "America/Chicago"', 'timeZone: "invalid/timezone"')), /monitor_source_timezone_invalid/);
});

test('read-only authenticated GETs must return a valid active Function and enabled correctly targeted job', async () => {
  const f = requests(), result = await verifyRevisionMonitorDeployment({ source, fetcher: f.fetcher, getAccessToken: async () => secret });
  assert.deepEqual(result, { ok: true, infrastructure: 'verified', automationAcceptance: 'separate' });
  assert.deepEqual(f.calls.map(call => call.url).sort(), [JOB_URL, FUNCTION_URL].sort());
  assert.equal(f.calls.length, 2); assert.ok(f.calls.every(call => call.init.body === undefined));
});

test('Firebase CLI create/update target URLs and default or exact audiences remain valid', () => {
  for (const target of [uri, functionUrl]) for (const explicit of [false, true]) {
    const f = deployment(); f.job.httpTarget.uri = target;
    if (explicit) f.job.httpTarget.oidcToken.audience = target;
    assert.equal(validateMonitorDeployment(f.job, f.deployedFunction, expected).ok, true);
  }
  const custom = deployment(), customAccount = 'reviewed-runtime@primetimehomehealthservices.iam.gserviceaccount.com';
  custom.job.httpTarget.oidcToken.serviceAccountEmail = customAccount; custom.deployedFunction.serviceConfig.serviceAccountEmail = customAccount;
  assert.equal(validateMonitorDeployment(custom.job, custom.deployedFunction, expected).ok, true);
});

test('missing Scheduler job fails even when the deployed Function is active', async () => {
  const f = requests({ failureUrl: JOB_URL, status: 404, failureBody: secret });
  await assert.rejects(verifyRevisionMonitorDeployment({ source, fetcher: f.fetcher, getAccessToken: async () => secret }), /monitor_scheduler_job_missing/);
  assert.equal(f.calls.length, 2);
});

test('paused jobs, mismatched minute schedule/timezone and wrong canonical resource names fail', () => {
  for (const patch of [{ state: 'PAUSED' }, { state: 'DISABLED' }, { name: JOB_NAME.replace('us-central1/jobs', 'us-east1/jobs') },
    { schedule: '0 * * * *' }, { timeZone: 'UTC' }, { name: JOB_NAME + '-other' }]) {
    const f = deployment(); Object.assign(f.job, patch);
    assert.throws(() => validateMonitorDeployment(f.job, f.deployedFunction, expected), /monitor_scheduler_(?:not_enabled|identity_mismatch|schedule_mismatch)/);
  }
});

test('attempt deadline follows the source timeout and retry omissions retain protobuf zero semantics', () => {
  for (const retryConfig of [undefined, {}, { retryCount: 0 }]) {
    const f = deployment(); f.job.retryConfig = retryConfig;
    assert.equal(validateMonitorDeployment(f.job, f.deployedFunction, expected).ok, true);
  }
  for (const retryConfig of [null, { retryCount: 1 }, { retryCount: '0' }]) {
    const f = deployment(); f.job.retryConfig = retryConfig;
    assert.throws(() => validateMonitorDeployment(f.job, f.deployedFunction, expected), /monitor_scheduler_retry_mismatch/);
  }
  for (const deadline of [undefined, '180s', '301s']) {
    const f = deployment(); f.job.attemptDeadline = deadline;
    assert.throws(() => validateMonitorDeployment(f.job, f.deployedFunction, expected), /monitor_scheduler_deadline_mismatch/);
  }
  assert.deepEqual(expectedMonitorConfiguration(source.replace('timeoutSeconds: 300,', 'timeoutSeconds: 120,')), { ...expected, attemptDeadline: '120s' });
});

test('foreign URLs, methods, OAuth tokens, missing OIDC and wrong identity or audience fail', () => {
  for (const patch of [{ uri: 'https://attacker.example/monitor' }, { uri: uri + '/' }, { uri: functionUrl.replace('primetimeRevisionMonitor', 'primetimeApi') },
    { httpMethod: 'GET' }, { oauthToken: { serviceAccountEmail: serviceAccount } }, { oidcToken: null },
    { oidcToken: { serviceAccountEmail: 'other@primetimehomehealthservices.iam.gserviceaccount.com' } },
    { oidcToken: { serviceAccountEmail: serviceAccount, audience: 'https://attacker.example/' } },
    { oidcToken: { serviceAccountEmail: serviceAccount, audience: null } }]) {
    const f = deployment(); Object.assign(f.job.httpTarget, patch);
    assert.throws(() => validateMonitorDeployment(f.job, f.deployedFunction, expected), /monitor_scheduler_(?:target_mismatch|http_target_invalid|oidc_identity_mismatch|oidc_audience_mismatch)/);
  }
  const pubsub = deployment(); pubsub.job.pubsubTarget = { topicName: 'other' };
  assert.throws(() => validateMonitorDeployment(pubsub.job, pubsub.deployedFunction, expected), /monitor_scheduler_http_target_invalid/);
});

test('invalid Function metadata cannot stand in for deployed monitor infrastructure', () => {
  for (const patch of [{ name: FUNCTION_NAME.replace('primetimeRevisionMonitor', 'primetimeApi') }, { state: 'DEPLOYING' }, { environment: 'GEN_1' },
    { serviceConfig: null }, { serviceConfig: { uri: 'http://untrusted.example', serviceAccountEmail: serviceAccount } },
    { serviceConfig: { uri } }]) {
    const f = deployment(); Object.assign(f.deployedFunction, patch);
    assert.throws(() => validateMonitorDeployment(f.job, f.deployedFunction, expected), /monitor_function_(?:identity_mismatch|not_active|target_unavailable|service_account_unavailable)/);
  }
});

test('ADC failures, transport errors and API error bodies never leak credentials in CLI output', async () => {
  for (const options of [
    { fetcher: async () => { throw new Error(secret); }, getAccessToken: async () => secret },
    { fetcher: requests({ failureUrl: JOB_URL, status: 403, failureBody: secret }).fetcher, getAccessToken: async () => secret },
    { fetcher: requests({ invalidUrl: FUNCTION_URL, invalidBody: JSON.stringify({ sensitive: secret }).slice(0, -1) }).fetcher, getAccessToken: async () => secret },
    { fetcher: async () => { throw new Error('must not request'); }, getAccessToken: async () => { throw new Error(secret); } },
  ]) {
    const logged = [], result = await runVerification({ source, ...options, output: { log: value => logged.push(value), error: value => logged.push(value) } });
    assert.equal(result.exitCode, 1); assert.equal(logged.length, 1);
    assert.match(logged[0], /Revision monitor infrastructure: FAIL \(monitor_/); assert.doesNotMatch(JSON.stringify({ result, logged }), new RegExp(secret));
  }
});

test('absent credentials or invalid metadata fail without any handler or operational request', async () => {
  for (const token of [null, '', 'bad\nheader']) {
    let calls = 0;
    await assert.rejects(verifyRevisionMonitorDeployment({ source, getAccessToken: async () => token, fetcher: async () => { calls++; throw new Error(); } }), /monitor_verification_adc_unavailable/);
    assert.equal(calls, 0);
  }
  for (const body of ['null', '[]', '"not a resource"', 'x'.repeat(128001)]) {
    const f = requests({ invalidUrl: JOB_URL, invalidBody: body });
    await assert.rejects(verifyRevisionMonitorDeployment({ source, fetcher: f.fetcher, getAccessToken: async () => secret }), /monitor_scheduler_metadata_invalid/);
  }
});

test('a successful check reports infrastructure only and never claims live monitoring or SMS acceptance', async () => {
  const f = requests(), logged = [], result = await runVerification({ source, fetcher: f.fetcher, getAccessToken: async () => secret,
    output: { log: value => logged.push(value), error: value => logged.push(value) } });
  assert.equal(result.exitCode, 0); assert.equal(logged.length, 1);
  assert.match(logged[0], /infrastructure: PASS/); assert.match(logged[0], /remain separate release gates/);
  assert.doesNotMatch(logged[0], new RegExp(secret)); assert.doesNotMatch(logged[0], /automation active|monitoring active|SMS enabled/);
});

test('the normal workflow verifies Scheduler only after successful Functions deployment using existing ADC', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-firebase.yml', import.meta.url), 'utf8');
  const step = workflow.split('- name: Verify deployed revision monitor infrastructure')[1]?.split('- name: Verify anonymous')[0];
  assert.ok(step); assert.match(step, /if: \$\{\{ success\(\) && steps\.deploy_functions\.outcome == 'success' \}\}/);
  assert.match(step, /GOOGLE_APPLICATION_CREDENTIALS: \$\{\{ runner\.temp \}\}\/firebase-service-account\.json/);
  assert.match(step, /node functions\/scripts\/verify-revision-monitor-deployment\.mjs/); assert.doesNotMatch(step, /continue-on-error|--force|jobs run|POST/);
  assert.ok(workflow.indexOf('- name: Deploy Primetime Functions') < workflow.indexOf('- name: Verify deployed revision monitor infrastructure'));
  assert.match(workflow, /deploy_backend:[\s\S]*?if: github\.event_name == 'push'/);
  assert.match(readFileSync(new URL('./run-tests.mjs', import.meta.url), 'utf8'), /scripts\/verify-revision-monitor-deployment\.test\.mjs/);
});
