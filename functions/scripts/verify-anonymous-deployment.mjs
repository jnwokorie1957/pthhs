import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SESSION_URLS = [
  'https://us-central1-primetimehomehealthservices.cloudfunctions.net/primetimeApi/session',
  'https://primetimehomehealthservices.web.app/primetime/api/session',
  'https://pthhs.net/primetime/api/session',
];

export async function verifyAnonymousBoundary(fetcher = fetch) {
  let checked = 0;
  for (const url of SESSION_URLS) {
    for (const authorization of [null, 'Bearer invalid-token']) {
      const response = await fetcher(url, {
        headers: authorization ? { Authorization: authorization } : {},
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => null);
      if (response.status !== 401 || !response.headers.get('content-type')?.includes('application/json') ||
          !response.headers.get('cache-control')?.split(',').map(value => value.trim()).includes('no-store') ||
          !payload || Object.keys(payload).length !== 1 || payload.error !== 'unauthorized') {
        throw new Error('Anonymous API boundary verification failed; expected uncached application JSON 401.');
      }
      checked++;
    }
  }
  return checked;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Anonymous reachability only: this does not prove the deployed revision, admin authorization, HHA connectivity, or deployment success.');
  const checked = await verifyAnonymousBoundary();
  const message = `Anonymous API boundary: PASS (${checked} missing/invalid-token checks across Function and Hosting URLs).`;
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `\n${message}\n\nDeployment retains its original result. A reachable prior revision can also pass this check. Authenticated/HHA acceptance remains separate. Deployment build images use the configured seven-day Artifact Registry retention policy.\n`);
}
