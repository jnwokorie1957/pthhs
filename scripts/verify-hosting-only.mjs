import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyHostingOnly(config, projects) {
  const hosting = config.hosting;
  assert(hosting && !Array.isArray(hosting), 'Expected one existing Hosting site');
  assert.equal(hosting.public, 'public', 'Only the reviewed public assets may deploy');
  assert(!hosting.source, 'Framework/backend source deployment is not permitted');
  assert(!hosting.target, 'Unexpected Hosting target');
  assert(!hosting.site || hosting.site === 'primetimehomehealthservices', 'Unexpected Hosting site');
  assert.equal(projects.projects?.default, 'primetimehomehealthservices', 'Unexpected Firebase project');

  function rejectHooks(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert(!['predeploy', 'postdeploy'].includes(key), 'Deployment hooks are not permitted in website-only releases');
      rejectHooks(child);
    }
  }
  rejectHooks(config);
  for (const rewrite of hosting.rewrites || []) {
    assert(!rewrite.function?.pinTag && !rewrite.run?.pinTag, 'Pinned backend revisions are not permitted');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyHostingOnly(
    JSON.parse(fs.readFileSync('firebase.json', 'utf8')),
    JSON.parse(fs.readFileSync('.firebaserc', 'utf8')),
  );
  console.log('HOSTING_ONLY_BOUNDARY: PASS (existing project, public assets, no hooks or pinned backend deployment)');
}
