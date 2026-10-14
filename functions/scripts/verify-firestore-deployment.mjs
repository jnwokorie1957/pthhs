import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATABASE_NAME = 'projects/primetimehomehealthservices/databases/(default)';
export const DATABASE_URL = `https://firestore.googleapis.com/v1/${DATABASE_NAME}`;

class VerificationError extends Error {}
function fail(code) { throw new VerificationError(code); }

async function adcAccessToken() {
  const { applicationDefault } = await import('firebase-admin/app');
  return (await applicationDefault().getAccessToken()).access_token;
}

// Metadata only: never read operational records, create a database,
// mint a user session, or invoke HHA during deployment verification.
export async function verifyFirestoreDeployment({ fetcher = fetch, getAccessToken = adcAccessToken } = {}) {
  let token;
  try { token = await getAccessToken(); } catch { fail('firestore_verification_credentials_unavailable'); }
  if (typeof token !== 'string' || !token || token.length > 10000 || /[\r\n]/u.test(token)) fail('firestore_verification_credentials_unavailable');
  let response;
  try {
    response = await fetcher(DATABASE_URL, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  } catch { fail('firestore_metadata_unavailable'); }
  if (response.status === 404) fail('firestore_default_database_missing');
  if (response.status === 401 || response.status === 403) fail('firestore_metadata_permission_denied');
  if (!response.ok) fail('firestore_metadata_unavailable');
  let database;
  try {
    const text = await response.text();
    if (text.length > 64000) fail('firestore_metadata_invalid');
    database = JSON.parse(text);
  } catch { fail('firestore_metadata_invalid'); }
  if (!database || database.name !== DATABASE_NAME) fail('firestore_database_identity_mismatch');
  if (database.type !== 'FIRESTORE_NATIVE') fail('firestore_native_database_required');
  if (typeof database.locationId !== 'string' || !/^[a-z][a-z0-9-]{1,39}$/u.test(database.locationId)) fail('firestore_location_missing');
  return { ok: true, database: DATABASE_NAME, location: database.locationId };
}

export async function runVerification({ fetcher, getAccessToken, output = console, summaryPath } = {}) {
  try {
    const result = await verifyFirestoreDeployment({ fetcher, getAccessToken });
    const message = `Primetime storage: PASS (default Native Firestore database exists in ${result.location}). Runtime IAM and authenticated route acceptance require separate verification.`;
    output.log(message);
    if (summaryPath) appendFileSync(summaryPath, `\n${message}\n`);
    return { exitCode: 0, result };
  } catch (error) {
    const code = error instanceof VerificationError ? error.message : 'firestore_verification_unavailable';
    const action = code === 'firestore_default_database_missing'
      ? 'A project owner must provision the default Native database before deploying the backend.'
      : 'Verify database configuration and deployment metadata permissions before deploying the backend.';
    const message = `Primetime storage: FAIL (${code}). See docs/management-layer/FIRESTORE_SETUP.md. ${action}`;
    output.error(message);
    if (summaryPath) appendFileSync(summaryPath, `\n${message}\n`);
    return { exitCode: 1, error: code };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runVerification({ summaryPath: process.env.GITHUB_STEP_SUMMARY });
  process.exitCode = result.exitCode;
}
