import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { verifyHostingOnly } from './verify-hosting-only.mjs';

const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const projects = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');

test('current configuration is Hosting-only compatible', () => verifyHostingOnly(config, projects));

for (const [name, mutate] of [
  ['Hosting predeploy hook', c => { c.hosting.predeploy = ['deploy backend']; }],
  ['Hosting postdeploy hook', c => { c.hosting.postdeploy = ['deploy backend']; }],
  ['other deployment hook', c => { c.functions.predeploy = ['deploy backend']; }],
  ['pinned function', c => { c.hosting.rewrites[0].function.pinTag = true; }],
  ['pinned Cloud Run service', c => { c.hosting.rewrites.push({run: {pinTag: true}}); }],
  ['framework source', c => { c.hosting.source = '.'; }],
  ['different public directory', c => { c.hosting.public = 'functions'; }],
  ['different site', c => { c.hosting.site = 'another-site'; }],
  ['different target', c => { c.hosting.target = 'another-target'; }],
  ['multiple sites', c => { c.hosting = [c.hosting]; }],
]) {
  test(`rejects ${name}`, () => {
    const changed = structuredClone(config);
    mutate(changed);
    assert.throws(() => verifyHostingOnly(changed, projects));
  });
}

test('rejects another project', () => {
  assert.throws(() => verifyHostingOnly(config, {projects: {default: 'another-project'}}));
});

test('workflow retains push behavior and excludes backend on every manual release', () => {
  const condition = job => {
    const match = workflow.match(new RegExp(`^  ${job}:\\r?\\n(?:    #.*\\r?\\n)*    if: (.+)$`, 'm'));
    assert(match, `Missing job condition: ${job}`);
    return match[1];
  };
  const evaluate = (job, event, ref, target) => vm.runInNewContext(condition(job), {
    github: {event_name: event, ref}, inputs: {deployment_target: target},
  });
  assert.equal(evaluate('build_and_deploy', 'push', 'refs/heads/main'), true);
  assert.equal(evaluate('deploy_backend', 'push', 'refs/heads/main'), true);
  for (const target of ['hosting', 'backend', 'all', undefined]) {
    for (const ref of ['refs/heads/main', 'refs/heads/other']) {
      assert.equal(evaluate('deploy_backend', 'workflow_dispatch', ref, target), false);
      assert.equal(evaluate('build_and_deploy', 'workflow_dispatch', ref, target), ref === 'refs/heads/main' && target === 'hosting');
    }
  }
  assert.match(workflow, /options:\s*\n\s*- hosting\s*\n/);
  const siteJob = workflow.split('  build_and_deploy:')[1].split('  deploy_backend:')[0];
  assert.match(siteJob, /node scripts\/verify-hosting-only\.mjs/);
  assert.match(siteJob, /FirebaseExtended\/action-hosting-deploy@v0/);
  assert.doesNotMatch(siteJob, /firebase deploy|functions:|--prefix functions/);
});
