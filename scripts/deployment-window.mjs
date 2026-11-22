import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync}from'node:child_process';import{pathToFileURL}from'node:url';
export const centralHour=date=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(date));
export function deploymentWindow(event,message,date=new Date()){
 if(event==='workflow_dispatch')return {allow:true,reason:'Explicit manual Hosting-only release'};
 if(event==='push'&&/\[compatible\]/i.test(message))return {allow:true,reason:'Reviewed backward-compatible release; no forced portal refresh'};
 if(!['push','schedule'].includes(event))return {allow:false,reason:'Unsupported deployment event'};
 return {allow:centralHour(date)===0,reason:centralHour(date)===0?'Midnight Central maintenance window':'Queued for midnight America/Chicago; active sessions continue'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.equal(process.env.GITHUB_REF,'refs/heads/main');const sha=process.env.GITHUB_SHA;assert(/^[a-f0-9]{40}$/.test(sha));const message=execFileSync('git',['show','-s','--format=%B',sha],{encoding:'utf8'}),result=deploymentWindow(process.env.GITHUB_EVENT_NAME,message);
 fs.appendFileSync(process.env.GITHUB_OUTPUT,`allow=${result.allow}\n`);console.log(result.reason);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### Production release window\n\n'+result.reason+'\n');
}
