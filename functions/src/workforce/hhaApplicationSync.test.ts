import test from "node:test";
import assert from "node:assert/strict";
import {HhaApplicationSync} from "./hhaApplicationSync.js";
import {syntheticHhaApplication} from "./hhaApplicantSample.js";
import {initialHhaTransfer,applicantInput,type HhaApplicationConfig,type HhaApplicationJob} from "./hhaApplicationPolicy.js";
import {EnvelopeDocumentCipher} from "./documentEncryption.js";
import {SoapApplicantGateway,type ApplicantGateway,type ApplicantProfile,type ApplicantDocument} from "./hhaApplicationGateway.js";
import {HhaNotSubmittedError} from "../integrations/hhaexchange/dispatch.js";
import {parseHhaSoapResponse} from "../integrations/hhaexchange/parser.js";

function fixture(mode=""){
  const now=Date.parse("2027-01-02T18:00:00.000Z"),uid="synthetic-a";
  const app=syntheticHhaApplication(uid,"503324",new Date(now).toISOString());
  const job:HhaApplicationJob={applicationUid:uid,applicationRevision:app.revision,office:app.office,submittedAt:app.submittedAt!,hha:initialHhaTransfer(uid,app.office)};
  const config:HhaApplicationConfig={enabled:true,office:"503324",discipline:"PCA",documentType:"55",documentLookupId:"88",notBefore:"2027-01-01T06:00:00.000Z"};
  const input=applicantInput(app,job),records=new Map<string,any>([
    ["workforceApplications/"+uid,app],[`workforceApplications/${uid}/versions/${app.revision}`,app],
    ["workforceAccounts/"+uid,{uid,office:app.office,employmentStatus:"applicant"}],["workforceOnboardingJobs/"+uid,job]]);
  let queue=Promise.resolve();
  const ref=(path:string):any=>({path,id:path.split("/").at(-1),get:async()=>({exists:records.has(path),data:()=>structuredClone(records.get(path))}),
    collection:(name:string)=>collection(path+"/"+name),set:async(v:any)=>{records.set(path,structuredClone(v));},
    update:async(v:any)=>{records.set(path,{...records.get(path),...structuredClone(v)});}});
  const collection=(path:string):any=>({doc:(id:string)=>ref(path+"/"+id),where:(field:string,_op:string,values:any)=>({limit:()=>({get:async()=>{
    const docs=[...records].filter(([p,v])=>p.startsWith(path+"/")&&p.split("/").length===2&&values.includes(v.hha?.state)).map(([p,v])=>({id:p.split("/")[1],data:()=>structuredClone(v)}));return {docs,size:docs.length};
  }})})});
  const db:any={collection,runTransaction:(fn:any)=>{
    const task=queue.then(async()=>{const writes:[string,any][]=[];const result=await fn({get:(r:any)=>r.get(),set:(r:any,v:any)=>writes.push([r.path,structuredClone(v)]),
      update:(r:any,v:any)=>writes.push([r.path,{...records.get(r.path),...structuredClone(v)}]),create:(r:any,v:any)=>{assert(!records.has(r.path));writes.push([r.path,structuredClone(v)]);}});
      for(const [p,v]of writes)records.set(p,v);return result;});queue=task.then(()=>{},()=>{});return task;
  }};
  const objects=new Map<string,{bytes:Buffer;metadata:any}>();
  const bucket:any={file:(path:string,_options?:unknown)=>({exists:async()=>[objects.has(path)],save:async(bytes:Buffer,options:any)=>{
    assert.equal(options.preconditionOpts.ifGenerationMatch,0);assert(!objects.has(path));objects.set(path,{bytes:Buffer.from(bytes),metadata:{...options.metadata,generation:"17"}});
  },getMetadata:async()=>[objects.get(path)!.metadata],download:async()=>[Buffer.from(objects.get(path)!.bytes)]})};
  let profile:ApplicantProfile|undefined,attached:ApplicantDocument|undefined,attachment:Buffer|undefined;
  let disabled=false,createCalls=0,attachCalls=0,duplicate=false,createFailure=mode.startsWith("create"),attachFailure=mode.startsWith("attach");
  const gateway:ApplicantGateway={
    validate:async()=>{},searchMarker:async()=>profile?[profile.id]:[],searchSsn:async()=>duplicate?["202"]:[],
    create:async(a,marker,c)=>{
      createCalls++;
      if(createFailure&&mode==="create_budget"){createFailure=false;throw new HhaNotSubmittedError(Error("budget"));}
      if(mode!=="create_missing")profile={id:"101",employeeId:marker,alternateCode:marker,employeeType:"Applicant",offices:[c.office],firstName:a.firstName,lastName:a.lastName,birthDate:a.birthDate,gender:a.gender,ethnicityId:a.ethnicityId,email:a.email};
      if(createFailure){createFailure=false;throw Error("lost_reply");}return "101";
    },
    profile:async()=>{
      const p=structuredClone(profile!);if(mode==="employee")p.employeeType="Employee";if(mode==="office")p.offices=["99"];if(mode==="email")p.email="other@example.invalid";
      if(mode==="disabled")disabled=true;return p;
    },
    documents:async()=>attached?[{...attached,...(mode==="document_owner"?{caregiverId:"202"}:{}),...(mode==="document_type"?{typeId:"56"}:{})}]:[],
    attach:async(id,type,filename,bytes)=>{attachCalls++;
      if(mode!=="attach_missing"){attached={id:"501",caregiverId:id,typeId:type,filename};attachment=Buffer.from(bytes);}
      if(attachFailure){attachFailure=false;throw Error("lost_reply");}return "501";
    },download:async()=>mode==="document_bytes"?Buffer.from("wrong"):Buffer.from(attachment!)
  };
  const cipher=new EnvelopeDocumentCipher("synthetic-key",{wrap:async key=>Buffer.from(key),unwrap:async key=>Buffer.from(key)});
  const auth:any={getUser:async()=>({uid,email:input.email,emailVerified:true,disabled})};
  const service=new HhaApplicationSync(gateway,()=>config,db,bucket,auth,cipher,()=>now);
  return {service,records,objects,config,gateway,job,app,uid,now,result:()=>records.get("workforceOnboardingJobs/"+uid).hha,
    counts:()=>({createCalls,attachCalls}),duplicate:()=>{duplicate=true;}};
}

test("submission creates an Applicant, uploads the exact signed PDF and records the verified IDs without promoting an employee",async()=>{
  const f=fixture();await f.service.process(f.uid);
  assert.equal(f.result().state,"verified");assert.equal(f.result().target,"applicant");assert.equal(f.result().caregiverId,"101");assert.equal(f.result().documentId,"501");
  assert.deepEqual(f.counts(),{createCalls:1,attachCalls:1});
  assert(f.records.has("workforceHhaApplicantLinks/"+f.uid));assert(!f.records.has("workforceHhaLinks/"+f.uid));
  assert.equal(f.records.get("workforceAccounts/"+f.uid).employmentStatus,"applicant");
  assert(!JSON.stringify(f.result()).includes(f.app.answers.ssn!));
  assert.equal(f.objects.size,1);for(const file of f.objects.values()){assert.notEqual(file.bytes.subarray(0,5).toString(),"%PDF-");assert(file.metadata.metadata.envelope);}
  await f.service.process(f.uid);assert.deepEqual(f.counts(),{createCalls:1,attachCalls:1});
});
test("concurrent delivery is claimed once",async()=>{
  const f=fixture();await Promise.all([f.service.process(f.uid),f.service.process(f.uid)]);assert.equal(f.result().state,"verified");assert.deepEqual(f.counts(),{createCalls:1,attachCalls:1});
});
test("the January launch and prelaunch submission cutoff cannot forward practice applications",async()=>{
  const f=fixture();f.config.notBefore="2028-01-01T06:00:00.000Z";await f.service.process(f.uid);assert.equal(f.counts().createCalls,0);
  f.config.notBefore="2026-01-01T06:00:00.000Z";await f.service.process(f.uid);assert.equal(f.counts().createCalls,0);
  f.config.notBefore="2027-01-01T06:00:00.000Z";f.records.get("workforceOnboardingJobs/"+f.uid).submittedAt="2026-11-12T18:00:00.000Z";
  await f.service.process(f.uid);assert.equal(f.result().state,"preview_only");assert.equal(f.counts().createCalls,0);
});
test("an existing SSN, changed account or altered signed snapshot stops profile creation",async()=>{
  const duplicate=fixture();duplicate.duplicate();await duplicate.service.process(duplicate.uid);assert.equal(duplicate.result().state,"review_required");assert.equal(duplicate.counts().createCalls,0);
  const altered=fixture();altered.records.get(`workforceApplications/${altered.uid}/versions/${altered.app.revision}`).answers.firstName="Changed";
  await altered.service.process(altered.uid);assert.equal(altered.result().state,"review_required");assert.equal(altered.counts().createCalls,0);
});
test("lost creation replies reconcile by the stable marker without a second create",async()=>{
  const f=fixture("create_lost");await f.service.process(f.uid);assert.equal(f.result().state,"creating");
  await f.service.process(f.uid);assert.equal(f.result().state,"verified");assert.equal(f.counts().createCalls,1);
  const absent=fixture("create_missing");await absent.service.process(absent.uid);await absent.service.process(absent.uid);
  assert.equal(absent.result().state,"review_required");assert.equal(absent.counts().createCalls,1);assert.equal(absent.counts().attachCalls,0);
});
test("a denied source budget before dispatch can safely retry",async()=>{
  const f=fixture("create_budget");await f.service.process(f.uid);assert.equal(f.result().state,"queued");assert.equal(f.result().createAttempted,false);
  await f.service.process(f.uid);assert.equal(f.result().state,"verified");assert.equal(f.counts().attachCalls,1);
});
test("lost attachment replies are reconciled by exact record, category, filename and bytes",async()=>{
  const f=fixture("attach_lost");await f.service.process(f.uid);assert.equal(f.result().state,"attaching");
  await f.service.process(f.uid);assert.equal(f.result().state,"verified");assert.deepEqual(f.counts(),{createCalls:1,attachCalls:1});
  const absent=fixture("attach_missing");await absent.service.process(absent.uid);await absent.service.process(absent.uid);
  assert.equal(absent.result().state,"review_required");assert.deepEqual(absent.counts(),{createCalls:1,attachCalls:1});
});
for(const mismatch of ["employee","office","email","disabled"])test(`a ${mismatch} mismatch prevents attaching and never changes the HHA profile`,async()=>{
  const f=fixture(mismatch);await f.service.process(f.uid);assert.equal(f.result().state,"review_required");assert.equal(f.counts().attachCalls,0);
});
for(const mismatch of ["document_owner","document_type","document_bytes"])test(`a ${mismatch} mismatch cannot produce a verified receipt`,async()=>{
  const f=fixture(mismatch);await f.service.process(f.uid);assert.equal(f.result().state,"review_required");assert.equal(f.counts().attachCalls,1);
  await f.service.process(f.uid);assert.equal(f.counts().attachCalls,1);
});
test("tampering with the stored encrypted PDF stops recovery before any further HHA writes",async()=>{
  const f=fixture("create_lost");await f.service.process(f.uid);const file=[...f.objects.values()][0]!;file.bytes[0]=file.bytes[0]!^1;
  await f.service.process(f.uid);assert.equal(f.result().state,"review_required");assert.equal(f.counts().createCalls,1);assert.equal(f.counts().attachCalls,0);
});

for(const httpStatus of [401,403])for(const stage of ["queued","creating","created","attaching","acknowledged"])test(`HTTP ${httpStatus} read denial holds ${stage} without repeating source access or losing uncertain-write evidence`,async()=>{
  const f=fixture(stage==="creating"?"create_lost":stage==="attaching"?"attach_lost":"");
  if(["creating","attaching"].includes(stage))await f.service.process(f.uid);
  let deniedReads=0,attemptEvidence:any;
  const source=new SoapApplicantGateway({call:async()=>{
    deniedReads++;
    const h=f.result();attemptEvidence={createAttempted:h.createAttempted,attachAttempted:h.attachAttempted,caregiverId:h.caregiverId,documentId:h.documentId};
    return {ok:false,httpStatus,retryable:false,error:{kind:"application",message:"synthetic private source detail"}} as any;
  }});
  if(stage==="created")f.gateway.profile=id=>source.profile(id);
  else if(stage==="acknowledged"){
    const documents=f.gateway.documents;let reads=0;
    f.gateway.documents=id=>++reads===1?documents(id):source.documents(id);
  }else f.gateway.validate=async()=>{await source.searchMarker(f.job.hha.employeeId);};
  await f.service.process(f.uid);
  assert.equal(deniedReads,1);assert.equal(f.result().state,"review_required");assert.equal(f.result().reason,"hha_source_access_denied");assert.equal(f.result().leaseUntil,0);
  const h=f.result();assert.deepEqual({createAttempted:h.createAttempted,attachAttempted:h.attachAttempted,caregiverId:h.caregiverId,documentId:h.documentId},attemptEvidence);
  const writes=f.counts();await f.service.run();await f.service.process(f.uid);
  assert.equal(deniedReads,1);assert.deepEqual(f.counts(),writes);assert(!f.records.has("workforceHhaApplicantLinks/"+f.uid));
  assert(!JSON.stringify([...f.records]).includes("synthetic private source detail"));
});

function searchSource(result:(body:string)=>string){
  return new SoapApplicantGateway({call:async(operation,body)=>{
    assert.equal(operation,"SearchCaregivers");
    const xml=`<Envelope><Body><SearchCaregiversResponse><SearchCaregiversResult>${result(body||"")}</SearchCaregiversResult></SearchCaregiversResponse></Body></Envelope>`;
    const parsed=parseHhaSoapResponse(operation,200,true,xml);assert.equal(parsed.ok,true);return parsed as any;
  }});
}
test("a contract-shaped existing SSN match stops all applicant creation and attachment",async()=>{
  const f=fixture(),source=searchSource(body=>body.includes("<SSN>")?"<Caregivers><CaregiverID>202</CaregiverID></Caregivers>":"<Caregivers/>");
  f.gateway.searchMarker=marker=>source.searchMarker(marker);f.gateway.searchSsn=ssn=>source.searchSsn(ssn);
  await f.service.process(f.uid);assert.equal(f.result().state,"review_required");assert.equal(f.result().reason,"existing_caregiver_review_required");
  assert.deepEqual(f.counts(),{createCalls:0,attachCalls:0});
});
test("a direct-ID marker read reconciles a lost create reply without a duplicate create",async()=>{
  const f=fixture("create_lost");await f.service.process(f.uid);assert.equal(f.result().state,"creating");
  const source=searchSource(()=>"<Caregivers><CaregiverID>101</CaregiverID></Caregivers>");f.gateway.searchMarker=marker=>source.searchMarker(marker);
  await f.service.process(f.uid);assert.equal(f.result().state,"verified");assert.deepEqual(f.counts(),{createCalls:1,attachCalls:1});
});
test("multiple direct-ID marker matches stop before any write",async()=>{
  const f=fixture(),source=searchSource(()=>"<Caregivers><CaregiverID>101</CaregiverID><CaregiverID>202</CaregiverID></Caregivers>");
  f.gateway.searchMarker=marker=>source.searchMarker(marker);await f.service.process(f.uid);
  assert.equal(f.result().state,"review_required");assert.equal(f.result().reason,"applicant_match_ambiguous");assert.deepEqual(f.counts(),{createCalls:0,attachCalls:0});
});
test("unknown nonempty marker inventory holds uncertain creation without losing its attempt marker",async()=>{
  const f=fixture("create_lost");await f.service.process(f.uid);let reads=0;
  const source=searchSource(()=>{reads++;return "<Caregivers><Unknown>101</Unknown></Caregivers>";});f.gateway.searchMarker=marker=>source.searchMarker(marker);
  await f.service.process(f.uid);assert.equal(f.result().state,"review_required");assert.equal(f.result().reason,"applicant_search_inventory_unverified");assert.equal(f.result().createAttempted,true);
  await f.service.run();await f.service.process(f.uid);assert.equal(reads,1);assert.deepEqual(f.counts(),{createCalls:1,attachCalls:0});
});
