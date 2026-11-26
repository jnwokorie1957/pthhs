// Single reviewed incident, not a general operator override. No source is marked delivered here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const project='primetimehomehealthservices', full='4c1149a18a51f0170ae0e9134b87409b019222fc', baselineRun=45066249129;
// push run, scope job, commit, first parent, complete resulting tree, scope-step conclusion
const records=[
 [45066610993,137344313722,'3325d14745c23224f79063e044745fe1c27b5b59',full,'e4cf9a0ac6d35db74b1dcc98974fe4682b6ae7c4','skipped'],
 [45541364426,138960415717,'a28699759eaae1b3e218ccbd094fe01f13a86748','ef66bf6d1630d2c53bc4b0d7f03f34323042ad88','d9690062a3435e316439db1917b01e44905a59ad','failure'],
 [45642037469,139302993371,'3ca8601aac1b4293528df0517709171436984cd4','742af9d5931ee60d600bf1dc6472e4aa300855f6','4c16cea75da7d1c463cffb055d118d3a877a6f8a','failure'],
 [45642988257,139306340392,'438a1434a021f65736bdab174195fb61c3895a26','3ca8601aac1b4293528df0517709171436984cd4','ceafd12f89964fb208814cffe011283340d33663','success'],
];
const jobNames=['build_and_deploy','deploy_backend','deploy_website_analytics','release_scope'];
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const order=(a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0;
const site='https://firebasehosting.googleapis.com/v1beta1/sites/'+project;
const live='d9b13bf09c70ed12',previous='859d79ebd216f736';
export async function verifyLiveInventory(get, jobs) {
 const versions=[live,previous],result=await get(site+'/channels/live/releases?pageSize=2');
 assert.deepEqual(result.releases.map(x=>[x.type,x.version.name]),versions.map(v=>['DEPLOY','sites/'+project+'/versions/'+v]),'Live Hosting delivery changed');
 const inJob=(value,name)=>{const time=Date.parse(value),j=jobs.find(j=>j.name===name);assert(time>=Date.parse(j?.started_at)&&time<=Date.parse(j?.completed_at),'Update outside verified delivery job: '+name);};
 inJob(result.releases[1].releaseTime,'build_and_deploy');
 for(const [i,v] of versions.entries()){
  const url=site+'/versions/'+v, [meta,list]=await Promise.all([get(url),get(url+'/files?pageSize=1000')]);
  assert.equal(meta.name,'sites/'+project+'/versions/'+v);assert.equal(meta.status,'FINALIZED');assert.equal(Number(meta.fileCount),292);
  assert.equal(hash(meta.config),['ac62b00d34bbaac009603629a7ccc8f46029951a85a85d9c26470b0f1f3ba8fd','70b271669a8e5b41e43f9f5e9304f1facf238aea95d4642eff5ae6deaa174d2c'][i],'Hosting configuration changed');
  assert(!list.nextPageToken && list.files.length===292 && list.files.every(x=>x.status==='ACTIVE'),'Incomplete Hosting file manifest');
  assert.equal(hash(list.files.map(f=>[f.path,f.hash]).sort(order)),'5340cbabfaa55add4be4962e6a9b2822d5f874e1d3706fd6327028d7609f5a7d','Hosting files changed');
 }
 const f=await get('https://cloudfunctions.googleapis.com/v2/projects/'+project+'/locations/-/functions?fields=nextPageToken,unreachable,functions(name,environment,state,updateTime,labels,serviceConfig/revision,buildConfig/build)');
 assert(!f.nextPageToken&&!f.unreachable?.length&&f.functions.length===11,'Incomplete function inventory');
 const rows=f.functions.map(v=>[v.name,v.environment,v.state,v.updateTime,v.labels?.['firebase-functions-codebase']||'default',v.serviceConfig?.revision,v.buildConfig?.build]).sort(order);
 for(const [kind,job,digest] of [['default','deploy_backend','dc5bd36f4f0e7fda38d12da27a38923484888ee11a75bf4952094ec151b1d304'],['website-analytics','deploy_website_analytics','c15f658effcf4a7d109ed440e545c098638391fac50cba6e06cedbc22b3c354c']]){
  const group=rows.filter(v=>v[4]===kind);assert.equal(hash(group),digest,'Live revision or build changed: '+kind);for(const v of group)inJob(v[3],job);
 }
}
export function januaryReview(repository,repo,getLive){
 if(repository!=='jnwokorie1957/pthhs')return undefined;
 const seen=new Set(),pushProof=new Set();let verified=false;
 return {
  expected:id=>records.some(r=>r[0]===id),
  checkedPush(run,jobs){
   if(run.event==='push'&&run.conclusion==='success'&&jobs.length===4&&jobs.every(j=>j.status==='completed'&&j.run_id===run.id))pushProof.add(run.head_sha);
  },
  rolloutChecked:sha=>pushProof.has(sha),
  observe(run,jobs){
   const r=records.find(x=>x[0]===run.id);assert(r&&!seen.has(run.id));const [id,scope,sha,parent,tree,step]=r;
   const outcome=step==='failure'?'failure':'success';
   assert.deepEqual([run.event,run.head_branch,run.head_sha,run.run_attempt,run.status,run.conclusion],['push','main',sha,1,'completed',outcome]);
   assert.deepEqual(jobs.map(j=>j.name).sort(),jobNames);
   for(const j of jobs){assert.equal(j.run_id,id);assert.equal(j.run_attempt,1);assert.equal(j.status,'completed');assert.equal(j.conclusion,j.name==='release_scope'?outcome:'skipped');}
   const j=jobs.find(x=>x.name==='release_scope');assert.equal(j.id,scope);
   assert.deepEqual(j.steps.filter(s=>s.name==='Verify release scope').map(s=>s.conclusion),[step]);
   assert.deepEqual(j.steps.filter(s=>s.conclusion==='failure').map(s=>s.name),step==='failure'?['Verify release scope']:[]);
   assert.deepEqual(repo.parents(sha),[parent]);assert.equal(repo.tree(sha),tree);
   seen.add(id);
  },
  async finish(found,run,jobs){
   if(!seen.size)return;
   assert.equal(seen.size,records.length,'Incomplete January incident history');
   for(const k of ['hosting','backend','analytics'])assert.deepEqual(found[k],{sha:full,runId:String(baselineRun)});
   assert.equal(run.id,baselineRun);assert.equal(run.event,'push');assert.deepEqual(jobs.map(j=>j.name).sort(),jobNames);
   assert(jobs.every(j=>j.run_id===baselineRun&&j.status==='completed'&&j.conclusion==='success'));
   await verifyLiveInventory(getLive,jobs);verified=true;
  },
  mixed(before,after){return verified&&records.slice(0,3).some(r=>r[2]===after&&r[3]===before);},
  get verified(){return verified;}
 };
}
