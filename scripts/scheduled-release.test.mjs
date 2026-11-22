import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {deliveryBaselines, scheduledPlan} from './scheduled-release.mjs';
import {marketingPath, classifyEvent, deliveredSource, RECEIPT, gitRepository} from './release-scope.mjs';

const a='a'.repeat(40), b='b'.repeat(40), c='c'.repeat(40);
const names=['build_and_deploy','deploy_backend','deploy_website_analytics'];
const run=(id,sha=a)=>({id,run_number:id,run_attempt:1,head_branch:'main',event:'push',head_sha:sha,status:'completed',conclusion:'success'});
const jobs=(values=['success','success','success'])=>({total_count:3,jobs:names.map((name,i)=>({name,conclusion:values[i]}))});
function history() {
  const runs=[run(3,b),run(2)], results=new Map([[3,jobs(['success','skipped','skipped'])],[2,jobs()]]);
  const request=async path=>path.includes('/workflows/')?{workflow_runs:runs}:results.get(Number(path.match(/\/runs\/(\d+)/)[1]));
  return {runs,results,request};
}
const resolve=r=>r.head_sha;
const baselines={hosting:{sha:b,runId:'3'},backend:{sha:a,runId:'2'},analytics:{sha:a,runId:'2'}};
function repository(deltas={}) {
  return {
    commit(sha){assert([a,b,c].includes(sha));},
    ancestor(from,to){assert([a,b,c].indexOf(from)<=[a,b,c].indexOf(to));},
    files(from,to){return from===to?[]:(deltas[from]||[]);},
    regular(){},
  };
}
test('Hosting success advances only Hosting; backend/analytics retain actual full-delivery sources',async()=>{
  const h=history();assert.deepEqual(await deliveryBaselines('test/repo',4,h.request,resolve),baselines);
});
test('current run and completed deferred runs do not advance any baseline',async()=>{
  const h=history();h.runs.unshift(run(5),run(4));h.results.set(4,jobs(['skipped','skipped','skipped']));
  assert.deepEqual(await deliveryBaselines('test/repo',5,h.request,resolve),baselines);
});
test('manual Hosting delivery counts independently',async()=>{
  const h=history();h.runs[0].event='workflow_dispatch';
  assert.deepEqual(await deliveryBaselines('test/repo',4,h.request,resolve),baselines);
});
for(const [label,change] of [
  ['failed Hosting',h=>h.results.set(3,jobs(['failure','skipped','skipped']))],
  ['partial full delivery',h=>h.results.set(3,jobs(['success','success','failure']))],
  ['cancelled delivery',h=>h.results.set(3,jobs(['cancelled','skipped','skipped']))],
  ['failed overall run',h=>h.runs[0].conclusion='failure'],
  ['in-progress run',h=>h.runs[0].status='in_progress'],
  ['rerun ambiguity',h=>h.runs[0].run_attempt=2],
  ['non-main run',h=>h.runs[0].head_branch='feature'],
  ['unexpected event',h=>h.runs[0].event='pull_request'],
  ['unordered history',h=>h.runs.reverse()],
  ['duplicate job',h=>{h.results.get(3).jobs.push(h.results.get(3).jobs[0]);h.results.get(3).total_count=4;}],
  ['incomplete job page',h=>h.results.get(3).total_count=101],
  ['missing backend job',h=>{h.results.get(3).jobs.pop();h.results.get(3).total_count=2;}],
  ['missing backend baseline',h=>h.runs.pop()],
]) test('refuses '+label,async()=>{
  const h=history();change(h);await assert.rejects(()=>deliveryBaselines('test/repo',4,h.request,resolve));
});
test('API failure cannot use an older assumed baseline',async()=>{
  await assert.rejects(()=>deliveryBaselines('test/repo',4,async()=>{throw Error('HTTP 403');},resolve));
});
test('bounded pagination finds older component delivery',async()=>{
  const h=history();const skipped=Array.from({length:100},(_,i)=>run(200-i));
  const request=async path=>path.includes('/workflows/')?{workflow_runs:path.endsWith('page=1')?skipped:h.runs}:Number(path.match(/\/runs\/(\d+)/)[1])>=101?jobs(['skipped','skipped','skipped']):h.request(path);
  assert.deepEqual(await deliveryBaselines('test/repo',999,request,resolve),baselines);
});
test('article-only schedule selects Hosting, including sitemap evidence dates',()=>{
  const repo=repository({[a]:['public/articles/new.html'],[b]:['content/articles/new.md','public/articles/new.html','docs/seo/sitemap-content-dates.json']});
  assert.deepEqual(scheduledPlan(c,baselines,repo,marketingPath),{mode:'hosting',releaseSha:c});
});
test('already delivered article does not redeploy or advance backend baseline',()=>{
  const original=structuredClone(baselines);
  const repo=repository({[a]:['public/articles/new.html'],[b]:['docs/releases/receipt.md']});
  assert.equal(scheduledPlan(c,baselines,repo,marketingPath).mode,'none');
  assert.deepEqual(baselines,original);
});
test('a newer backend delivery is not made pending by an older Hosting baseline',()=>{
  const split={hosting:{sha:a,runId:'2'},backend:{sha:b,runId:'3'},analytics:{sha:b,runId:'3'}};
  assert.equal(scheduledPlan(c,split,repository({[a]:['functions/index.js','analytics-functions/index.js']}),marketingPath).mode,'none');
});
test('a newer Hosting delivery is not made pending by older backend baselines',()=>{
  assert.equal(scheduledPlan(c,baselines,repository({[a]:['public/primetime/app.js']}),marketingPath).mode,'none');
});
test('no change and reviewed release-control/docs-only changes require no deployment',()=>{
  assert.equal(scheduledPlan(c,baselines,repository(),marketingPath).mode,'none');
  assert.equal(scheduledPlan(c,baselines,repository({[a]:['scripts/scheduled-release.mjs'],[b]:['docs/releases/STAFF_RELEASE_POLICY.md']}),marketingPath).mode,'none');
});
for(const path of ['functions/src/index.ts','analytics-functions/index.js','public/primetime/app.js','public/workforce/app.js','firebase.json','.github/workflows/other.yml','scripts/unknown-builder.py','package-lock.json']) {
  test('non-article change retains existing full-release selection: '+path,()=>{
    assert.equal(scheduledPlan(c,baselines,repository({[a]:[path],[b]:[path]}),marketingPath).mode,'full');
  });
  test('mixed article and excluded change is held: '+path,()=>{
    assert.throws(()=>scheduledPlan(c,baselines,repository({[a]:[path],[b]:[path,'public/articles/new.html']}),marketingPath),/Mixed/);
  });
}
test('missing baseline, missing Git objects, non-ancestor and non-regular changes fail closed',()=>{
  assert.throws(()=>scheduledPlan(c,{hosting:baselines.hosting},repository(),marketingPath));
  const bad=structuredClone(baselines);bad.analytics.sha='d'.repeat(40);
  assert.throws(()=>scheduledPlan(c,bad,repository(),marketingPath));
  assert.throws(()=>scheduledPlan(a,baselines,repository(),marketingPath));
  const repo=repository({[b]:['public/articles/new.html']});repo.regular=()=>{throw Error('symlink');};
  assert.throws(()=>scheduledPlan(c,baselines,repo,marketingPath));
});
test('rollback is a reviewed forward article revert, not an older checkout or mixed release',()=>{
  assert.equal(scheduledPlan(c,baselines,repository({[a]:['public/articles/new.html'],[b]:['public/articles/new.html']}),marketingPath).mode,'hosting');
  assert.throws(()=>scheduledPlan(a,baselines,repository(),marketingPath));
  assert.throws(()=>scheduledPlan(c,baselines,repository({[a]:['functions/src/index.ts'],[b]:['public/articles/new.html']}),marketingPath),/Mixed/);
});
test('old schedule classifier cannot silently return full without component evidence',()=>{
  assert.throws(()=>classifyEvent('schedule','refs/heads/main',{},c,repository()),/component baselines/);
});
test('real Git and job history: article, delivered no-op, forward rollback and held backend',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'pthhs-schedule-'));
  const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const write=(name,value)=>{fs.mkdirSync(path.dirname(path.join(cwd,name)),{recursive:true});fs.writeFileSync(path.join(cwd,name),value);};
  const commit=()=>{git('add','.');git('-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','-m','synthetic');return git('rev-parse','HEAD');};
  try {
    git('init');write('README.md','synthetic initial history');commit();
    write('public/articles/example.html','old article');write('functions/index.js','unchanged backend');
    const first=commit();write('public/articles/example.html','new article');const article=commit();
    const repo=gitRepository(cwd), h=history();h.runs=[run(2,first)];h.results=new Map([[2,jobs()]]);
    // Use the original map captured by the fixture's request.
    const request=async p=>p.includes('/workflows/')?{workflow_runs:h.runs}:p.includes('/3/')?jobs(['success','skipped','skipped']):jobs();
    const baseline=await deliveryBaselines('test/repo',99,request,r=>deliveredSource(r,repo));
    assert.equal(scheduledPlan(article,baseline,repo,marketingPath).mode,'hosting');
    h.runs.unshift(run(3,article));
    const delivered=await deliveryBaselines('test/repo',99,request,r=>deliveredSource(r,repo));
    assert.equal(delivered.backend.sha,first);assert.equal(delivered.analytics.sha,first);
    assert.equal(scheduledPlan(article,delivered,repo,marketingPath).mode,'none');
    write('public/articles/example.html','old article');const rollback=commit();
    assert.equal(scheduledPlan(rollback,delivered,repo,marketingPath).mode,'hosting');
    assert.throws(()=>scheduledPlan(first,delivered,repo,marketingPath));
    write('functions/index.js','held backend change');const mixed=commit();
    assert.throws(()=>scheduledPlan(mixed,delivered,repo,marketingPath),/Mixed/);
  } finally { fs.rmSync(cwd,{recursive:true,force:true}); }
});
test('receipt delivery resolves pinned source rather than newer receipt head',()=>{
  // Existing full receipt validation is exercised in release-scope.test.mjs.
  const receipt={version:2,base_sha:a,deployed_sha:a,source_sha:b,target_base_sha:b,target_sha:c,public_tree_sha:a};
  const head='d'.repeat(40);
  const repo={commit(){},ancestor(){},regular(){},parents(){return[c];},read(){return JSON.stringify(receipt);},publicTree(){return a;},files(from,to){return to===head?[RECEIPT]:from===a?['public/articles/new.html']:['scripts/release-scope.mjs'];}};
  assert.equal(deliveredSource(run(4,head),repo),b);
  receipt.public_tree_sha=b;assert.throws(()=>deliveredSource(run(4,head),repo));
});
test('actual workflow job conditions cannot run backend for scheduled Hosting/none',()=>{
  const workflow=fs.readFileSync('.github/workflows/deploy-firebase.yml','utf8');
  for(const mode of ['hosting','none']) for(const job of ['deploy_backend','deploy_website_analytics']) {
    const condition=workflow.match(new RegExp('^  '+job+':\\r?\\n(?:    #.*\\r?\\n)*    if: (.+)$','m'))[1];
    assert.equal(vm.runInNewContext(condition,{github:{event_name:'schedule'},needs:{release_scope:{outputs:{mode}}}}),false);
  }
  assert.match(workflow,/cron: '0 5,6 \* \* \*'/);
  assert.match(workflow,/if: steps.window.outputs.allow == 'true'/);
  assert.match(workflow,/cancel-in-progress: false/);
});
