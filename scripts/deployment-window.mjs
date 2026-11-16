import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync}from'node:child_process';import{pathToFileURL}from'node:url';
export const centralHour=date=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(date));
export function deploymentWindow(event,message,date=new Date()){
 if(event==='workflow_dispatch')return {allow:true,reason:'Explicit manual Hosting-only release'};
 if(event==='push'&&/\[compatible\]/i.test(message))return {allow:true,reason:'Reviewed backward-compatible release; no forced portal refresh'};
 if(!['push','schedule'].includes(event))return {allow:false,reason:'Unsupported deployment event'};
 return {allow:centralHour(date)===0,reason:centralHour(date)===0?'Midnight Central maintenance window':'Queued for midnight America/Chicago; active sessions continue'};
}
export async function previousFullRelease(repo,runId,request){
 const runs=await request(`/repos/${repo}/actions/workflows/deploy-firebase.yml/runs?per_page=100&status=completed`);
 for(const run of runs.workflow_runs||[]){if(String(run.id)===String(runId)||run.conclusion!=='success')continue;const result=await request(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`),jobs=result.jobs||[];if(['build_and_deploy','deploy_backend','deploy_website_analytics'].every(name=>jobs.some(job=>job.name===name&&job.conclusion==='success')))return run.head_sha;}
 return null;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.equal(process.env.GITHUB_REF,'refs/heads/main');const sha=process.env.GITHUB_SHA;assert(/^[a-f0-9]{40}$/.test(sha));const message=execFileSync('git',['show','-s','--format=%B',sha],{encoding:'utf8'}),result=deploymentWindow(process.env.GITHUB_EVENT_NAME,message);
 if(result.allow&&process.env.GITHUB_EVENT_NAME==='schedule'){
  const repo=process.env.GITHUB_REPOSITORY;assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo));
  const request=async path=>{const response=await fetch('https://api.github.com'+path,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28'}});if(!response.ok)throw Error('Could not verify prior production releases: HTTP '+response.status);return response.json();};
  const prior=await previousFullRelease(repo,process.env.GITHUB_RUN_ID,request);
  if(prior&&/^[a-f0-9]{40}$/.test(prior)){const files=execFileSync('git',['diff','--name-only',prior,sha,'--','public','functions','analytics-functions','firebase.json','firebase.analytics.json','scripts','.github/workflows'],{encoding:'utf8'}).trim();if(!files){result.allow=false;result.reason='No pending website or backend changes since the last successful full release';}}
 }
 fs.appendFileSync(process.env.GITHUB_OUTPUT,`allow=${result.allow}\n`);console.log(result.reason);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### Production release window\n\n'+result.reason+'\n');
}
