import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const FUNCTION_NAME = 'projects/primetimehomehealthservices/locations/us-central1/functions/primetimeRevisionMonitor';
export const JOB_NAME = 'projects/primetimehomehealthservices/locations/us-central1/jobs/firebase-schedule-primetimeRevisionMonitor-us-central1';
export const FUNCTION_URL = `https://cloudfunctions.googleapis.com/v2/${FUNCTION_NAME}`;
export const JOB_URL = `https://cloudscheduler.googleapis.com/v1/${JOB_NAME}`;

class VerificationError extends Error {
  constructor(code) { super(code); this.name = 'RevisionMonitorVerificationError'; }
}
function fail(code) { throw new VerificationError(code); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

export function expectedMonitorConfiguration(source) {
  const match = typeof source === 'string' && source.match(/export const primetimeRevisionMonitor\s*=[^;]*?onSchedule\(\{\s*region:\s*"([^"]+)",\s*schedule:\s*"([^"]+)",\s*timeZone:\s*"([^"]+)"/u);
  if (!match || match[1] !== 'us-central1' || match[2] !== '* * * * *') fail('monitor_source_configuration_unrecognized');
  const options = source.slice(match.index, source.indexOf('}, async', match.index));
  const timeout = Number(options.match(/timeoutSeconds:\s*(\d+)/u)?.[1]), retries = Number(options.match(/retryCount:\s*(\d+)/u)?.[1]);
  if (!Number.isInteger(timeout) || timeout < 15 || timeout > 1800 || retries !== 0) fail('monitor_source_configuration_unrecognized');
  try { new Intl.DateTimeFormat('en', { timeZone: match[3] }); } catch { fail('monitor_source_timezone_invalid'); }
  return { schedule: match[2], timeZone: match[3], attemptDeadline: `${timeout}s`, retryCount: 0 };
}
function validHttpsUrl(value) {
  try {
    if (typeof value !== 'string') return false;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search && !url.port;
  } catch { return false; }
}

export function validateMonitorDeployment(job, deployedFunction, expected) {
  if (!object(expected) || expected.schedule !== '* * * * *' || typeof expected.timeZone !== 'string' || !/^\d+s$/u.test(expected.attemptDeadline) || expected.retryCount !== 0) fail('monitor_expected_configuration_invalid');
  if (!object(deployedFunction) || deployedFunction.name !== FUNCTION_NAME) fail('monitor_function_identity_mismatch');
  if (deployedFunction.state !== 'ACTIVE' || deployedFunction.environment !== 'GEN_2') fail('monitor_function_not_active');
  const service = deployedFunction.serviceConfig;
  if (!object(service) || !validHttpsUrl(service.uri)) fail('monitor_function_target_unavailable');
  const serviceAccount = service.serviceAccountEmail;
  if (typeof serviceAccount !== 'string' || !/^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+\.gserviceaccount\.com$/u.test(serviceAccount)) fail('monitor_function_service_account_unavailable');
  if (!object(job) || job.name !== JOB_NAME) fail('monitor_scheduler_identity_mismatch');
  if (job.state !== 'ENABLED') fail('monitor_scheduler_not_enabled');
  if (job.schedule !== expected.schedule || job.timeZone !== expected.timeZone) fail('monitor_scheduler_schedule_mismatch');
  if (job.attemptDeadline !== expected.attemptDeadline) fail('monitor_scheduler_deadline_mismatch');
  if (job.retryConfig !== undefined && !object(job.retryConfig) || job.retryConfig?.retryCount !== undefined && job.retryConfig.retryCount !== expected.retryCount) fail('monitor_scheduler_retry_mismatch');
  const target = job.httpTarget;
  if (!object(target) || job.pubsubTarget !== undefined || target.httpMethod !== 'POST' || target.oauthToken !== undefined) fail('monitor_scheduler_http_target_invalid');
  // CLI 15.30 uses serviceConfig.uri when updating and the same function's
  // top-level url when first creating its HTTP Scheduler job. Both values come
  // from this authenticated, fixed-name Functions GET, never from caller input.
  const targets = [service.uri];
  if (validHttpsUrl(deployedFunction.url)) targets.push(deployedFunction.url);
  if (!targets.includes(target.uri)) fail('monitor_scheduler_target_mismatch');
  const oidc = target.oidcToken;
  if (!object(oidc) || oidc.serviceAccountEmail !== serviceAccount) fail('monitor_scheduler_oidc_identity_mismatch');
  // The CLI omits audience; Scheduler then uses the exact target URI. An
  // explicit audience is valid only when it names that same deployed target.
  if (oidc.audience !== undefined && oidc.audience !== target.uri) fail('monitor_scheduler_oidc_audience_mismatch');
  return { ok: true, infrastructure: 'verified', automationAcceptance: 'separate' };
}

async function adcAccessToken() {
  try {
    const { applicationDefault } = await import('firebase-admin/app');
    const token = await applicationDefault().getAccessToken();
    return token.access_token;
  } catch { fail('monitor_verification_adc_unavailable'); }
}
async function metadata(url, kind, accessToken, fetcher) {
  let response;
  try {
    response = await fetcher(url, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  } catch { fail(`monitor_${kind}_metadata_unavailable`); }
  if (!response.ok) {
    if (response.status === 404) fail(kind === 'scheduler' ? 'monitor_scheduler_job_missing' : 'monitor_function_missing');
    const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 'invalid';
    fail(`monitor_${kind}_metadata_http_${status}`);
  }
  try {
    const text = await response.text();
    if (text.length > 128000) fail(`monitor_${kind}_metadata_invalid`);
    const value = JSON.parse(text);
    if (!object(value)) fail(`monitor_${kind}_metadata_invalid`);
    return value;
  } catch { fail(`monitor_${kind}_metadata_invalid`); }
}

export async function verifyRevisionMonitorDeployment({ source, fetcher = fetch, getAccessToken = adcAccessToken } = {}) {
  const expected = expectedMonitorConfiguration(source);
  let token;
  try { token = await getAccessToken(); } catch { fail('monitor_verification_adc_unavailable'); }
  if (typeof token !== 'string' || !token || token.length > 10000 || /[\r\n]/u.test(token)) fail('monitor_verification_adc_unavailable');
  const results = await Promise.allSettled([metadata(JOB_URL, 'scheduler', token, fetcher), metadata(FUNCTION_URL, 'function', token, fetcher)]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  return validateMonitorDeployment(results[0].value, results[1].value, expected);
}

export async function runVerification({ source, fetcher, getAccessToken, output = console, summaryPath } = {}) {
  try {
    const result = await verifyRevisionMonitorDeployment({ source, fetcher, getAccessToken });
    const message = 'Revision monitor infrastructure: PASS (enabled minute Scheduler job, deployed Function target and OIDC identity verified). Operational monitoring and SMS acceptance remain separate release gates.';
    output.log(message);
    if (summaryPath) appendFileSync(summaryPath, `\n${message}\n`);
    return { exitCode: 0, result };
  } catch (error) {
    const code = error instanceof VerificationError ? error.message : 'monitor_verification_unavailable';
    const message = `Revision monitor infrastructure: FAIL (${code}). No monitor invocation, operational source read, or message send was performed.`;
    output.error(message);
    if (summaryPath) appendFileSync(summaryPath, `\n${message}\n`);
    return { exitCode: 1, error: code };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const result = await runVerification({ source, summaryPath: process.env.GITHUB_STEP_SUMMARY });
  process.exitCode = result.exitCode;
}
