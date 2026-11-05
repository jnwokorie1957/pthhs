import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import { classifyPush, classifyEvent, marketingPath, RECEIPT, gitRepository, releaseSelection } from './release-scope.mjs';

const base='1'.repeat(40), source='2'.repeat(40), target='3'.repeat(40), head='4'.repeat(40), tree='5'.repeat(40);
function fixture() {
  const receipt={version:2,base_sha:base,deployed_sha:base,source_sha:source,target_base_sha:source,target_sha:target,public_tree_sha:tree};
  const diffs=new Map([[`${target}:${head}`,[RECEIPT]],[`${base}:${source}`,['content/articles/example.md','public/articles/example.html']],[`${source}:${target}`,['scripts/release-scope.mjs','.github/workflows/deploy-firebase.yml']]]);
  const repo={commit(sha){assert([base,source,target,head].includes(sha));},ancestor(a,b){if(a===b)return;assert([`${base}:${source}`,`${source}:${target}`,`${target}:${head}`].includes(`${a}:${b}`));},files(a,b){return diffs.get(`${a}:${b}`);},parents(){return [target];},read(){return JSON.stringify(receipt);},publicTree(){return tree;},regular(){}};
  return {receipt,repo,diffs};
}
test('exact pinned receipt selects only Hosting',()=>{const {repo}=fixture();assert.equal(classifyPush(target,head,repo),'hosting');});
for(const path of ['public/primetime/index.html','functions/index.js','analytics-functions/report.js','firebase.json','.github/workflows/other.yml','public/articles/example.html ','public/articles/../primetime/index.html']) {
  test(`excluded path cannot be an article release: ${path}`,()=>{
    assert.equal(marketingPath(path),false);
    const {repo,diffs}=fixture();diffs.set(`${base}:${source}`,[path]);
    assert.throws(()=>classifyPush(target,head,repo));
  });
}
for(const [name,change] of [
  ['mixed receipt',f=>f.diffs.get(`${target}:${head}`).push('public/articles/example.html')],
  ['stale target',f=>f.receipt.target_sha=source],
  ['unknown field',f=>f.receipt.force=true],
  ['invalid version',f=>f.receipt.version=3],
  ['abbreviated source',f=>f.receipt.source_sha='abcd'],
  ['changed public tree',f=>f.repo.publicTree=()=> '6'.repeat(40)],
  ['excluded bootstrap change',f=>f.diffs.get(`${source}:${target}`).push('firebase.json')],
  ['missing base',f=>f.repo.ancestor=()=>{throw new Error('missing');}],
  ['merge receipt',f=>f.repo.parents=()=>[target,source]],
  ['symlink',f=>f.repo.regular=()=>{throw new Error('non-regular');}],
  ['empty source diff',f=>f.diffs.set(`${base}:${source}`,[])],
]) test(`receipt refuses ${name}`,()=>{const f=fixture();change(f);assert.throws(()=>classifyPush(target,head,f.repo));});
test('ordinary article push selects Hosting; other ordinary pushes retain full behavior',()=>{
  const {repo,diffs}=fixture();diffs.set(`${target}:${head}`,['public/articles/example.html']);
  assert.equal(classifyPush(target,head,repo),'hosting');
  diffs.set(`${target}:${head}`,['functions/index.js']);assert.equal(classifyPush(target,head,repo),'full');
  diffs.set(`${target}:${head}`,[]);assert.throws(()=>classifyPush(target,head,repo));
});
test('event gates reject forced/deleted/mismatched/non-main events',()=>{
  const {repo}=fixture();const event={before:target,after:head,forced:false,deleted:false};
  assert.equal(classifyEvent('push','refs/heads/main',event,head,repo),'hosting');
  for(const change of [{forced:true},{deleted:true},{after:source}]) assert.throws(()=>classifyEvent('push','refs/heads/main',{...event,...change},head,repo));
  assert.throws(()=>classifyEvent('push','refs/heads/other',event,head,repo));
  assert.throws(()=>classifyEvent('pull_request','refs/heads/main',event,head,repo));
});
test('manual behavior stays main plus Hosting only',()=>{
  assert.equal(classifyEvent('workflow_dispatch','refs/heads/main',{inputs:{deployment_target:'hosting'}},head,{}),'hosting');
  for(const deployment_target of ['all','backend',undefined]) assert.throws(()=>classifyEvent('workflow_dispatch','refs/heads/main',{inputs:{deployment_target}},head,{}));
});

test('receipt selection deploys pinned source, never newer main or receipt tree',()=>{
  const {repo}=fixture();
  const event={before:target,after:head,forced:false,deleted:false};
  assert.deepEqual(releaseSelection('push','refs/heads/main',event,head,repo),{mode:'hosting',releaseSha:source});
  assert.deepEqual(releaseSelection('workflow_dispatch','refs/heads/main',{inputs:{deployment_target:'hosting'}},head,repo),{mode:'hosting',releaseSha:head});
});

test('excluded changes between deployed baseline and source refuse release',()=>{
  const {repo,receipt,diffs}=fixture();const deployed='6'.repeat(40);receipt.deployed_sha=deployed;
  const ancestor=repo.ancestor;repo.ancestor=(a,b)=>a===deployed&&b===base?undefined:ancestor(a,b);
  diffs.set(`${deployed}:${source}`,['public/primetime/analytics.js']);
  assert.throws(()=>classifyPush(target,head,repo));
});

test('real Git history validates receipt and refuses later excluded target changes',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'pthhs-release-scope-'));
  const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const write=(name,value)=>{fs.mkdirSync(path.dirname(path.join(cwd,name)),{recursive:true});fs.writeFileSync(path.join(cwd,name),value);};
  const commit=()=>{git('add','.');git('-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','-m','synthetic');return git('rev-parse','HEAD');};
  try {
    git('init');write('public/index.html','synthetic');const a=commit();
    write('public/articles/example.html','synthetic article');const b=commit();
    write('scripts/release-scope.mjs','synthetic reviewed bootstrap');const c=commit();
    const repo=gitRepository(cwd);
    write(RECEIPT,JSON.stringify({version:2,base_sha:a,deployed_sha:a,source_sha:b,target_base_sha:b,target_sha:c,public_tree_sha:repo.publicTree(b)}));
    const d=commit();assert.equal(classifyPush(c,d,repo),'hosting');
    assert.equal(classifyPush(a,b,repo),'hosting');
    assert.throws(()=>classifyPush('0'.repeat(40),d,repo));
    write('functions/private.js','synthetic excluded change');const e=commit();
    write(RECEIPT,JSON.stringify({version:2,base_sha:a,deployed_sha:a,source_sha:b,target_base_sha:b,target_sha:e,public_tree_sha:repo.publicTree(b)}));
    const f=commit();assert.throws(()=>classifyPush(e,f,repo));
  } finally { fs.rmSync(cwd,{recursive:true,force:true}); }
});
