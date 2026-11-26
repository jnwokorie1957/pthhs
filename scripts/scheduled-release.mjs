import assert from 'node:assert/strict';

const SHA = /^[a-f0-9]{40}$/;
const JOBS = {hosting: 'build_and_deploy', backend: 'deploy_backend', analytics: 'deploy_website_analytics'};
// These reviewed release controls do not become a backend deployment merely
// because the controls themselves have changed. Unknown tooling cannot qualify
// as article-only.
const CONTROLS = new Set([
  'scripts/january-history.mjs',
  '.github/workflows/rehearse-january-release.yml',
  '.github/workflows/deploy-firebase.yml', 'scripts/deployment-window.mjs',
  'scripts/deployment-window.test.mjs', 'scripts/release-scope.mjs',
  'scripts/release-scope.test.mjs', 'scripts/scheduled-release.mjs',
  'scripts/scheduled-release.test.mjs', 'scripts/verify-hosting-only.test.mjs',
  'scripts/build-and-verify.sh', 'docs/releases/HOSTING_RELEASE.md',
  'docs/releases/STAFF_RELEASE_POLICY.md',
]);
export const releaseControlPath = path => CONTROLS.has(path);
const nonDeployment = path => releaseControlPath(path) || /^docs\/[A-Za-z0-9_./-]+\.(?:md|txt)$/.test(path) || path === 'README.md';

// Compare each delivered component only with its own inputs. Unknown/shared
// paths retain full-release treatment, never become an article-only release.
function componentInput(component, path, marketingPath) {
  if (nonDeployment(path)) return false;
  if (path.startsWith('functions/')) return component === 'backend';
  if (path.startsWith('analytics-functions/') || path === 'firebase.analytics.json') return component === 'analytics';
  if (marketingPath(path) || /^(?:public|source|source-assets|content|scripts)\//.test(path)) return component === 'hosting';
  return true;
}

// Evidence is deliberately bounded. Missing history, reruns, non-main sources,
// partial deliveries and duplicate jobs require operator reconciliation, never
// an assumption that the older successful deployment is still production.
export async function deliveryBaselines(repository, currentRun, request, resolveSource, verifiedNoDeploy = new Set(), review) {
  assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository));
  assert(/^\d+$/.test(String(currentRun)), 'Missing current workflow run');
  const found = {};
  let lastNumber = Infinity;
  for (let page = 1; page <= 5; page++) {
    const result = await request(`/repos/${repository}/actions/workflows/deploy-firebase.yml/runs?branch=main&per_page=100&page=${page}`);
    assert(Array.isArray(result.workflow_runs), 'Missing workflow history');
    for (const run of result.workflow_runs) {
      assert(Number.isSafeInteger(run.run_number) && run.run_number < lastNumber, 'Ambiguous workflow order');
      lastNumber = run.run_number;
    }
    for (const run of result.workflow_runs) {
      if (String(run.id) === String(currentRun)) continue;
      assert(run.run_attempt === 1, 'Rerun delivery requires reconciliation');
      assert(run.head_branch === 'main' && ['push','schedule','workflow_dispatch'].includes(run.event), 'Unexpected delivery origin');
      assert(run.status === 'completed', 'Another release is not complete');
      const incident = review?.expected(run.id);
      if (!incident) assert.equal(run.conclusion, 'success', 'Failed historical release workflow requires reconciliation');
      const response = await request(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`);
      assert(Array.isArray(response.jobs) && response.total_count === response.jobs.length && response.total_count <= 100, 'Incomplete job evidence');
      if (incident) review.observe(run,response.jobs);
      const jobs = {};
      for (const [component, name] of Object.entries(JOBS)) {
        const matches = response.jobs.filter(job => job.name === name);
        assert(matches.length === 1, `Missing or duplicate ${name} job`);
        jobs[component] = matches[0];
        assert(['success','skipped'].includes(matches[0].conclusion), `Uncertain ${component} delivery`);
      }
      if (Object.values(jobs).every(job => job.conclusion === 'skipped')) {
        // A green window-deferred run is not evidence that scope was checked.
        const scopes = response.jobs.filter(job => job.name === 'release_scope');
        const checks = scopes[0]?.steps?.filter(step => step.name === 'Verify release scope');
        if (scopes.length === 1 && scopes[0].conclusion === 'success' &&
          checks?.length === 1 && checks[0].conclusion === 'success' &&
          ['push','schedule'].includes(run.event)) {
          assert(SHA.test(run.head_sha), 'Missing checked no-deploy source');
          verifiedNoDeploy.add(run.head_sha);
          review?.checkedPush(run,response.jobs);
        }
        continue;
      }
      const source = resolveSource(run);
      assert(SHA.test(source), 'Missing exact delivered source');
      for (const component of Object.keys(JOBS)) {
        if (!found[component] && jobs[component].conclusion === 'success') {
          found[component] = {sha: source, runId: String(run.id)};
        }
      }
      if (Object.keys(found).length === 3) {
        await review?.finish(found,run,response.jobs);
        return found;
      }
    }
    if (result.workflow_runs.length < 100) break;
  }
  throw new Error('Missing verified Hosting/backend/analytics baseline');
}

function assertIsolatedReleaseControls(from, target, repo, verifiedNoDeploy, review) {
  let pendingControl = false;
  for (const [before,after] of repo.firstParentEdges(from,target)) {
    const paths = repo.files(before,after);
    if (review?.mixed(before,after)) {
      assert(!pendingControl,'Unproven earlier control change before reviewed incident');
      continue;
    }
    if (paths.some(releaseControlPath)) {
      assert(paths.every(releaseControlPath), 'Refusing mixed release-control history on main');
      if(review?.verified && paths.includes('scripts/january-history.mjs'))
        assert(review.rolloutChecked(after),'January policy requires its exact successful no-deploy push on main');
      repo.regular(before,paths); repo.regular(after,paths);
      for (const path of paths) repo.read(after,path);
      pendingControl = true;
    } else if (paths.some(path => !nonDeployment(path))) {
      assert(!pendingControl, 'Release controls need isolated no-deploy proof before later release changes');
    }
    if (verifiedNoDeploy.has(after)) pendingControl = false;
  }
  if (review?.verified) assert(!pendingControl,'January review needs an isolated main push with no deployment');
}

export function scheduledPlan(target, baselines, repo, marketingPath, verifiedNoDeploy = new Set(), review) {
  repo.commit(target);
  const delta = {};
  for (const component of Object.keys(JOBS)) {
    const baseline = baselines?.[component];
    assert(baseline && SHA.test(baseline.sha) && /^\d+$/.test(baseline.runId), `Missing ${component} baseline`);
    repo.commit(baseline.sha);
    repo.ancestor(baseline.sha, target);
    const paths = repo.files(baseline.sha, target);
    repo.regular(baseline.sha, paths); repo.regular(target, paths);
    delta[component] = paths.filter(path => componentInput(component, path, marketingPath));
  }
  const article = delta.hosting.some(marketingPath);
  const other = delta.hosting.some(path => !marketingPath(path)) || delta.backend.length || delta.analytics.length;
  assert(!(article && other), 'Mixed article and non-marketing changes require separate release review');
  assertIsolatedReleaseControls(baselines.hosting.sha,target,repo,verifiedNoDeploy,review);
  // Preserve previously authorized non-article full-release selection and all
  // its existing gates. This classification is not approval to clear a hold.
  return {mode: article ? 'hosting' : other ? 'full' : 'none', releaseSha: target};
}
