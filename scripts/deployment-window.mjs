import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const PUBLICATION_START = Date.parse('2027-01-01T06:00:00Z');

export function deploymentWindow(event, date = new Date()) {
  if (!['push', 'schedule', 'workflow_dispatch'].includes(event)) {
    return {allow: false, reason: 'Unsupported deployment event'};
  }
  if (!Number.isFinite(date.getTime()) || date.getTime() < PUBLICATION_START) {
    return {allow: false, reason: 'Staged for January 1, 2027 Central time. Git pushes and checks continue.'};
  }
  return {allow: true, reason: 'Publication date reached. Continue with the existing release scope checks.'};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert(/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA));
  const result = deploymentWindow(process.env.GITHUB_EVENT_NAME);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `allow=${result.allow}\n`);
  console.log(result.reason);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Publication date\n\n' + result.reason + '\n');
  }
}
