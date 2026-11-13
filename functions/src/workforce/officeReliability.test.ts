import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {StaffOperations} from './staffOperations.js';
import {CaregiverSync} from './caregiverSync.js';
import {chicagoDate} from './dates.js';

function memory(rows:Record<string,any>){
 const snapshot=(p:string)=>({id:p.split('/').at(-1)!,exists:p in rows,data:()=>rows[p]});
 const ref=(p:string)=>({path:p,get:async()=>snapshot(p),set:async(v:any)=>{rows[p]=v;},update:async(v:any)=>{rows[p]={...rows[p],...v};}});
 const query=(name:string,filters:any[]=[],count=Infinity,after=''):any=>({name,filters,count,after,
  doc:(id:string)=>ref(name+'/'+id),where:(k:string,_op:string,v:any)=>query(name,[...filters,[k,v]],count,after),select:()=>query(name,filters,count,after),orderBy:()=>query(name,filters,count,after),limit:(n:number)=>query(name,filters,n,after),startAfter:(id:string)=>query(name,filters,count,id),
  get:async()=>{const docs=Object.keys(rows).filter(p=>p.startsWith(name+'/')&&!p.slice(name.length+1).includes('/')&&p.slice(name.length+1)>after&&filters.every(([k,v])=>rows[p][k]===v)).sort().slice(0,count).map(snapshot);return {docs,size:docs.length};}
 });
 let tail=Promise.resolve();const db={collection:(n:string)=>query(n),runTransaction:(fn:any)=>{const task=tail.then(async()=>{const writes:Array<()=>void>=[],tx={get:async(r:any)=>r.path?snapshot(r.path):r.get(),set:(r:any,v:any)=>writes.push(()=>{rows[r.path]=v;}),create:(r:any,v:any)=>writes.push(()=>{assert.ok(!(r.path in rows));rows[r.path]=v;}),update:(r:any,v:any)=>writes.push(()=>{rows[r.path]={...rows[r.path],...v};})};const result=await fn(tx);writes.forEach(w=>w());return result;});tail=task.then(()=>{},()=>{});return task;}};
 return db as any;
}
const grant={active:true,role:'owner',offices:['100','200'],permissions:['authorizations.manage']};
test('complete expiration summaries include later pages and every assigned office, never foreign offices',async()=>{
 const today=chicagoDate(new Date()),rows:Record<string,any>={'workforceStaff/staff':grant};
 for(let i=0;i<1001;i++)rows['workforceAuthorizations/'+String(i).padStart(4,'0')]={office:'100',state:'ready',endDate:'2099-12-01',renewalStatus:'not_started'};
 rows['workforceAuthorizations/last-due']={office:'100',state:'ready',endDate:today,renewalStatus:'payer_followup'};
 rows['workforceAuthorizations/other-due']={office:'200',state:'ready',endDate:'2020-01-01',renewalStatus:'not_started'};
 rows['workforceAuthorizations/foreign-due']={office:'300',state:'ready',endDate:today};
 rows['workforceAuthorizations/closed']={office:'100',state:'ready',endDate:today,renewalStatus:'closed'};
 rows['workforceAuthorizations/failed']={office:'100',state:'upload_failed',endDate:today};
 const service=new StaffOperations(memory(rows),{} as any),office=await service.expirationSummary('staff','100'),all=await service.expirationSummary('staff');
 assert.deepEqual(office.counts,{expired:0,within15:1,within30:0,current:1001});assert.equal(office.total,1003);assert.equal(all.counts.expired,1);assert.equal(all.counts.within15,1);
 await assert.rejects(service.expirationSummary('staff','300'),/workforce_forbidden/);
 rows['workforceStaff/staff']={...grant,active:false};await assert.rejects(service.expirationSummary('staff'),/workforce_forbidden/);
});

test('failed upload retries use a fresh attempt, preserve duplicate protection and reject a live lease',async()=>{
 const rows:Record<string,any>={'workforceStaff/staff':grant},objects=new Map<string,Buffer>();let fail=true;
 const bucket={file:(path:string)=>({save:async(bytes:Buffer)=>{if(fail&&path.endsWith('/preview.enc'))throw Error('transient_storage_failure');assert.ok(!objects.has(path));objects.set(path,bytes);},getMetadata:async()=>[{generation:'1'}]})};
 const cipher={encrypt:async(bytes:Buffer)=>({bytes,envelope:{}}),decrypt:async(bytes:Buffer)=>bytes};
 const service=new StaffOperations(memory(rows),bucket as any,()=>cipher as any),image=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).jpeg().toBuffer();
 const input={details:{office:'100',clientName:'Test client',memberId:'TEST',payer:'Test payer',authorizationNumber:'TEST-AUTH',startDate:'2026-01-01',endDate:'2026-12-31',services:'Personal assistance',units:'10 hours',notes:'',reviewed:true},source:Buffer.from('synthetic-source').toString('base64'),pages:[image.toString('base64')]};
 await assert.rejects(service.upload('staff',input),/transient_storage_failure/);
 const key=Object.keys(rows).find(p=>p.startsWith('workforceAuthorizations/'))!;assert.equal(rows[key].state,'upload_failed');const first=rows[key].attempt;
 rows[key].state='uploading';rows[key].leaseUntil=Date.now()+60000;await assert.rejects(service.upload('staff',input),/authorization_upload_in_progress/);
 rows[key].leaseUntil=Date.now()-1;fail=false;await service.upload('staff',input);assert.equal(rows[key].state,'ready');assert.notEqual(rows[key].attempt,first);assert.equal(objects.size,3);
 await assert.rejects(service.upload('staff',input),/authorization_already_uploaded/);
});

test('office transfers in the change feed and missing roster members are refreshed and invalidated',async()=>{
 const rows:Record<string,any>={'workforceHhaProfiles/1':{id:'1',office:'100',status:'Active',email:'private',fields:{private:'value'}},'workforceHhaProfiles/3':{id:'3',office:'100',status:'Active',email:'private',fields:{private:'value'}}},seen:string[]=[];
 const now=new Date('2026-11-13T15:00:00Z');
 const workspace={settings:async()=>({dataApproved:true,settings:{officeId:'100',revision:1}}),query:async(input:any)=>{
  const common={operation:input.operation,source:'hhaexchange',truncated:false,fetchedAt:now.toISOString()};
  if(input.operation==='GetCaregiverChangesV2')return {...common,records:[{CaregiverID:'1',OfficeID:'200'},{CaregiverID:'999',OfficeID:'300'}]};
  if(input.operation==='SearchCaregivers')return {...common,records:[{CaregiverID:'2'}]};
  if(input.operation==='GetCaregiverDemographics'){seen.push(input.id);if(input.id==='3')return {...common,records:[]};return {...common,records:[{ID:input.id,OfficeIDs:JSON.stringify([input.id==='2'?'100':'200']),FirstName:'Test',LastName:'Caregiver','Status/Name':'Active'}]};}
  throw Error('unexpected_source_request');
 }};
 await new CaregiverSync(workspace as any,memory(rows),()=>now).run();
 assert.deepEqual(seen.sort(),['1','2','3']);for(const id of ['1','3']){assert.equal(rows['workforceHhaProfiles/'+id].status,id==='3'?'No current HHA profile':'Office assignment changed');assert.equal(rows['workforceHhaProfiles/'+id].email,'');assert.deepEqual(rows['workforceHhaProfiles/'+id].fields,{});}
 assert.equal(rows['workforceHhaProfiles/2'].status,'Active');assert.equal(rows['workforceCaregiverSync/100'].state,'complete');
});
