import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const RECEIPT = 'docs/releases/hosting-release.json';
const SHA = /^[0-9a-f]{40}$/;
const MARKETING_FILES = new Set([
  'PTHHS_SENSITIVE_TERM_REGISTER.csv', 'public/articles.html',
  'public/home-care-blog.html', 'public/sitemap.xml',
  'scripts/site-polish.mjs', 'scripts/verify_pthhs_articles.py',
]);
const BOOTSTRAP_FILES = new Set([
  '.github/workflows/deploy-firebase.yml', 'scripts/release-scope.mjs',
  'scripts/release-scope.test.mjs', 'scripts/verify-hosting-only.test.mjs',
  'scripts/build-and-verify.sh', 'docs/releases/HOSTING_RELEASE.md',
]);
export function marketingPath(path) {
  return MARKETING_FILES.has(path) ||
    /^content\/articles\/(?:manifest\.json|[a-z0-9-]+\.md)$/.test(path) ||
    /^public\/articles\/[a-z0-9-]+\.html$/.test(path) ||
    /^public\/assets\/meta\/[a-z0-9-]+\.(?:png|ico|svg)$/.test(path);
}

// Git arguments are arrays, never shell text. Missing objects or invalid ancestry
// abort classification; a failed classifier cannot start any deployment job.
export function gitRepository(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore','pipe','pipe']}).trim();
  const commit = sha => { assert(SHA.test(sha), 'Expected exact commit SHA'); assert.equal(git('rev-parse', `${sha}^{commit}`), sha); };
  return {
    commit,
    ancestor(a,b) { commit(a); commit(b); git('merge-base','--is-ancestor',a,b); },
    files(a,b) { return execFileSync('git',['diff','--no-renames','--name-only','-z',a,b],{cwd,encoding:'utf8'}).split('\0').filter(Boolean); },
    parents(sha) { return git('show','-s','--format=%P',sha).split(' ').filter(Boolean); },
    read(sha,path) { return git('show',`${sha}:${path}`); },
    publicTree(sha) { return git('rev-parse',`${sha}:public`); },
    regular(sha, paths) {
      for (const path of paths) {
        const entry = git('ls-tree',sha,'--',path);
        assert(!entry || /^100644 blob /.test(entry), 'Only ordinary non-executable files may select Hosting-only');
      }
    },
  };
}

export function classifyPush(before, after, repo) {
  repo.commit(before); repo.commit(after); repo.ancestor(before,after);
  assert.notEqual(before,after, 'Empty comparison');
  const paths = repo.files(before,after);
  assert(paths.length, 'No changed paths');
  if (paths.includes(RECEIPT)) {
    assert.deepEqual(paths, [RECEIPT], 'Receipt must be the only changed file');
    assert.deepEqual(repo.parents(after), [before], 'Receipt must directly follow its tested target');
    repo.regular(after, paths);
    const receipt = JSON.parse(repo.read(after, RECEIPT));
    assert.deepEqual(Object.keys(receipt).sort(), ['base_sha','deployed_sha','public_tree_sha','source_sha','target_base_sha','target_sha','version']);
    assert.equal(receipt.version,2);
    for (const key of ['base_sha','deployed_sha','source_sha','target_base_sha','target_sha','public_tree_sha']) assert(SHA.test(receipt[key]), `Invalid ${key}`);
    assert.equal(receipt.target_sha,before, 'Receipt target must be push parent');
    repo.ancestor(receipt.base_sha,receipt.source_sha);
    repo.ancestor(receipt.deployed_sha,receipt.base_sha);
    repo.ancestor(receipt.source_sha,receipt.target_base_sha);
    repo.ancestor(receipt.target_base_sha,receipt.target_sha);
    const sourcePaths = repo.files(receipt.base_sha,receipt.source_sha);
    assert(sourcePaths.length && sourcePaths.every(marketingPath), 'Source includes non-marketing changes');
    repo.regular(receipt.base_sha,sourcePaths); repo.regular(receipt.source_sha,sourcePaths);
    const deployedPaths = repo.files(receipt.deployed_sha,receipt.source_sha);
    assert(deployedPaths.every(path=>marketingPath(path) || /^docs\/[A-Za-z0-9_./-]+\.(?:md|txt)$/.test(path)), 'Source differs from deployed baseline outside marketing/documentation');
    repo.regular(receipt.deployed_sha,deployedPaths); repo.regular(receipt.source_sha,deployedPaths);
    const bootstrapPaths = repo.files(receipt.target_base_sha,receipt.target_sha);
    assert(bootstrapPaths.every(path=>BOOTSTRAP_FILES.has(path)), 'Target includes changes outside reviewed trigger tooling');
    repo.regular(receipt.target_sha,bootstrapPaths);
    assert.equal(repo.publicTree(receipt.source_sha),receipt.public_tree_sha, 'Public tree differs from pinned tested source');
    return 'hosting';
  }
  if (paths.every(marketingPath)) {
    repo.regular(before,paths); repo.regular(after,paths);
    return 'hosting';
  }
  // Preserve existing full-push behavior for ordinary, non-marketing changes.
  return 'full';
}

export function classifyEvent(eventName, ref, event, sha, repo) {
  assert.equal(ref,'refs/heads/main', 'Only main may deploy');
  if (eventName === 'workflow_dispatch') {
    assert.equal(event.inputs?.deployment_target,'hosting');
    return 'hosting';
  }
  assert.equal(eventName,'push');
  assert.equal(event.after,sha, 'Push head differs from checked-out release');
  assert.equal(event.forced,false, 'Forced pushes are not releases');
  assert.equal(event.deleted,false, 'Deleted branches are not releases');
  return classifyPush(event.before,event.after,repo);
}

export function releaseSelection(eventName, ref, event, sha, repo) {
  const mode=classifyEvent(eventName,ref,event,sha,repo);
  const receipt=eventName==='push' && repo.files(event.before,sha).includes(RECEIPT);
  const releaseSha=receipt ? JSON.parse(repo.read(sha,RECEIPT)).source_sha : sha;
  assert(SHA.test(releaseSha));
  return {mode,releaseSha};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {mode,releaseSha} = releaseSelection(process.env.GITHUB_EVENT_NAME,process.env.GITHUB_REF,
    JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),process.env.GITHUB_SHA,gitRepository());
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\nrelease_sha=${releaseSha}\n`);
  console.log(`Verified release scope: ${mode}; source: ${releaseSha}`);
}
