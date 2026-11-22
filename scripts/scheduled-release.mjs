import assert from 'node:assert/strict';

const SHA = /^[a-f0-9]{40}$/;
const JOBS = {hosting: 'build_and_deploy', backend: 'deploy_backend', analytics: 'deploy_website_analytics'};
// These reviewed release controls do not become a backend deployment merely
// because the controls themselves have changed. Unknown tooling cannot qualify
// as article-only.
const CONTROLS = new Set([
  '.github/workflows/deploy-firebase.yml', 'scripts/deployment-window.mjs',
  'scripts/deployment-window.test.mjs', 'scripts/release-scope.mjs',
  'scripts/release-scope.test.mjs', 'scripts/scheduled-release.mjs',
  'scripts/scheduled-release.test.mjs', 'scripts/verify-hosting-only.test.mjs',
  'scripts/build-and-verify.sh',
]);
const nonDeployment = path => CONTROLS.has(path) || /^docs\/[A-Za-z0-9_./-]+\.(?:md|txt)$/.test(path) || path === 'README.md';

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
export async function deliveryBaselines(repository, currentRun, request, resolveSource) {
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
      const response = await request(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`);
      assert(Array.isArray(response.jobs) && response.total_count === response.jobs.length && response.total_count <= 100, 'Incomplete job evidence');
      const jobs = {};
      for (const [component, name] of Object.entries(JOBS)) {
        const matches = response.jobs.filter(job => job.name === name);
        assert(matches.length === 1, `Missing or duplicate ${name} job`);
        jobs[component] = matches[0];
        assert(['success','skipped'].includes(matches[0].conclusion), `Uncertain ${component} delivery`);
      }
      if (Object.values(jobs).every(job => job.conclusion === 'skipped')) continue;
      assert(run.conclusion === 'success', 'Partial release requires reconciliation');
      const source = resolveSource(run);
      assert(SHA.test(source), 'Missing exact delivered source');
      for (const component of Object.keys(JOBS)) {
        if (!found[component] && jobs[component].conclusion === 'success') {
          found[component] = {sha: source, runId: String(run.id)};
        }
      }
      if (Object.keys(found).length === 3) return found;
    }
    if (result.workflow_runs.length < 100) break;
  }
  throw new Error('Missing verified Hosting/backend/analytics baseline');
}

export function scheduledPlan(target, baselines, repo, marketingPath) {
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
  // Preserve previously authorized non-article full-release selection and all
  // its existing gates. This classification is not approval to clear a hold.
  return {mode: article ? 'hosting' : other ? 'full' : 'none', releaseSha: target};
}
