import {randomUUID} from "node:crypto";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {getAuth} from "firebase-admin/auth";
import {FORM_BUCKET} from "../forms/library.js";
import {HhaNotSubmittedError} from "../integrations/hhaexchange/dispatch.js";
import {kmsDocumentCipher,type DocumentCipher,type DocumentEnvelope} from "./documentEncryption.js";
import {renderApplication} from "./applicationPdf.js";
import type {Intake} from "./intake.js";
import {applicantInput,validateTransferJob,transferAllowed,type HhaApplicationConfig,type HhaApplicationJob,type HhaTransfer} from "./hhaApplicationPolicy.js";
import {verifyApplicant,pdfDigest,HhaApplicantReadUnavailable,type ApplicantGateway} from "./hhaApplicationGateway.js";

const PHASES=["queued","preparing","creating","created","attaching","acknowledged"];
const REASONS=new Set(["transfer_job_not_eligible","signed_application_snapshot_invalid","hha_required_applicant_fields_missing","applicant_phone_review_required",
  "existing_caregiver_review_required","portal_identity_changed","application_pdf_invalid","application_artifact_changed","applicant_match_ambiguous",
  "applicant_identity_unverified","hha_discipline_changed","hha_gender_changed","hha_ethnicity_changed","hha_relationship_changed",
  "hha_application_document_type_unverified","applicant_creation_unconfirmed","application_attachment_unconfirmed","application_pdf_readback_mismatch",
  "application_document_target_unverified","applicant_creation_needs_reconciliation","application_attachment_needs_reconciliation"]);
type Job=HhaApplicationJob;
export class HhaApplicationSync {
  constructor(private gateway:ApplicantGateway,private configuration:()=>HhaApplicationConfig,
    private db=getFirestore(),private bucket=getStorage().bucket(FORM_BUCKET),private auth=getAuth(),private cipher?:DocumentCipher,private now=()=>Date.now()){}
  private ref(id:string){return this.db.collection("workforceOnboardingJobs").doc(id);}
  private allowed(){if(!transferAllowed(this.configuration(),this.now()))throw Error("hha_transfer_not_released");}
  private async claim(id:string){
    const lease=randomUUID(),ref=this.ref(id),config=this.configuration();
    return this.db.runTransaction(async tx=>{
      const job=(await tx.get(ref)).data() as Job|undefined;
      if(!job||job.hha?.schema!==1||!PHASES.includes(job.hha.state)||Number(job.hha.leaseUntil||0)>this.now())return null;
      if(Date.parse(job.submittedAt)<Date.parse(config.notBefore)){tx.update(ref,{hha:{...job.hha,state:"preview_only",updatedAt:new Date(this.now()).toISOString()}});return null;}
      try{validateTransferJob(id,job,config);}catch{tx.update(ref,{hha:{...job.hha,state:"review_required",reason:"transfer_job_not_eligible",updatedAt:new Date(this.now()).toISOString()}});return null;}
      const hha={...job.hha,lease,leaseUntil:this.now()+600000};tx.update(ref,{hha});return {...job,hha};
    });
  }
  private async mark(job:Job,patch:Partial<HhaTransfer>){
    this.allowed();
    await this.db.runTransaction(async tx=>{
      const ref=this.ref(job.applicationUid),current=(await tx.get(ref)).data() as Job|undefined;
      if(!current||current.hha.lease!==job.hha.lease||current.hha.leaseUntil!<=this.now()||current.applicationRevision!==job.applicationRevision
        ||current.office!==job.office||current.hha.target!=="applicant")throw Error("transfer_lease_lost");
      const hha={...current.hha,...patch,updatedAt:new Date(this.now()).toISOString()};tx.update(ref,{hha});job.hha=hha;
      if(patch.state==="verified")tx.set(this.db.collection("workforceHhaApplicantLinks").doc(job.applicationUid),{
        uid:job.applicationUid,office:job.office,caregiverId:hha.caregiverId,applicationRevision:job.applicationRevision,
        documentId:hha.documentId,sha256:hha.sha256,verifiedAt:hha.verifiedAt});
      if(patch.state)tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()),{
        actor:"system:hha-applicant-transfer",action:"hha_applicant_transfer_"+patch.state,target:job.applicationUid,office:job.office,
        applicationRevision:job.applicationRevision,at:hha.updatedAt,...(patch.reason?{reason:patch.reason}:{})});
    });
  }
  private async application(job:Job){
    this.allowed();validateTransferJob(job.applicationUid,job,this.configuration());
    const [current,snapshot,account,link,claim]=await Promise.all([
      this.db.collection("workforceApplications").doc(job.applicationUid).get(),
      this.db.collection("workforceApplications").doc(job.applicationUid).collection("versions").doc(String(job.applicationRevision)).get(),
      this.db.collection("workforceAccounts").doc(job.applicationUid).get(),
      this.db.collection("workforceHhaLinks").doc(job.applicationUid).get(),this.ref(job.applicationUid).get()]);
    if(claim.data()?.hha?.lease!==job.hha.lease||claim.data()?.hha?.leaseUntil<=this.now())throw Error("transfer_lease_lost");
    if(link.exists||account.data()?.employmentStatus!=="applicant")throw Error("existing_caregiver_review_required");
    const application=snapshot.data() as Intake|undefined;
    if(!application||current.data()?.state!=="submitted"||current.data()?.revision!==job.applicationRevision
      ||current.data()?.signature?.answersSha256!==application.signature?.answersSha256)throw Error("signed_application_snapshot_invalid");
    applicantInput(application,job);
    const user=await this.auth.getUser(job.applicationUid);
    if(user.disabled||!user.emailVerified||user.email?.trim().toLowerCase()!==application.answers.email?.trim().toLowerCase())throw Error("portal_identity_changed");
    return application;
  }
  private async pdf(job:Job,application:Intake){
    const original=await renderApplication(application),sha=pdfDigest(original);
    if(original.length>2_000_000||original.subarray(0,5).toString()!=="%PDF-")throw Error("application_pdf_invalid");
    const path=`workforce-transfers/${job.applicationUid}/application-r${job.applicationRevision}.pdf.enc`,file=this.bucket.file(path);
    const cipher=this.cipher??=kmsDocumentCipher();
    const [exists]=await file.exists();
    if(!exists){
      const encrypted=await cipher.encrypt(original,path);await this.application(job);
      try{await file.save(encrypted.bytes,{resumable:false,validation:"crc32c",preconditionOpts:{ifGenerationMatch:0},metadata:{
        contentType:"application/octet-stream",cacheControl:"private, no-store",metadata:{envelope:JSON.stringify(encrypted.envelope),sha256:sha,storedSha256:pdfDigest(encrypted.bytes)}}});}
      catch(error){if(![409,412].includes(Number((error as {code?:unknown}).code)))throw error;}
    }
    const [metadata]=await file.getMetadata(),custom=metadata.metadata||{};
    if(!metadata.generation||custom.sha256!==sha||typeof custom.envelope!=="string"||custom.envelope.length>6000||typeof custom.storedSha256!=="string")throw Error("application_artifact_changed");
    const [encrypted]=await this.bucket.file(path,{generation:metadata.generation}).download();
    if(pdfDigest(encrypted)!==custom.storedSha256)throw Error("application_artifact_changed");
    await this.application(job);
    const bytes=await cipher.decrypt(encrypted,JSON.parse(custom.envelope) as DocumentEnvelope,path);
    if(pdfDigest(bytes)!==sha)throw Error("application_artifact_changed");
    const filename=`Employment-Application-${job.hha.employeeId}-r${job.applicationRevision}.pdf`;
    await this.mark(job,{sha256:sha,filename});return {bytes,filename,sha};
  }
  private async exactDocument(id:string,config:HhaApplicationConfig,filename:string,sha:string){
    const records=await this.gateway.documents(id);
    if(records.some(r=>r.caregiverId!==id))throw Error("application_document_target_unverified");
    const matching=records.filter(r=>r.filename.toLowerCase()===filename.toLowerCase());
    if(matching.length>1)throw Error("application_document_target_unverified");
    const doc=matching[0];
    if(doc&&(doc.typeId!==config.documentType||pdfDigest(await this.gateway.download(doc.id,filename))!==sha))throw Error("application_pdf_readback_mismatch");
    return doc;
  }
  async process(id:string){
    if(!transferAllowed(this.configuration(),this.now()))return;
    const job=await this.claim(id);if(!job)return;
    let prior=job.hha.state;
    try{
      const config=this.configuration(),app=await this.application(job),input=applicantInput(app,job);
      const artifact=await this.pdf(job,app);
      await this.gateway.validate(input,config);
      let caregiverId=job.hha.caregiverId;
      if(!caregiverId){
        const matches=await this.gateway.searchMarker(job.hha.employeeId);
        if(matches.length>1)throw Error("applicant_match_ambiguous");
        caregiverId=matches[0];
        if(!caregiverId){
          // An earlier dispatch may have succeeded. Never issue another create.
          if(prior==="creating"||job.hha.createAttempted)throw Error("applicant_creation_needs_reconciliation");
          if((await this.gateway.searchSsn(input.ssn)).length)throw Error("existing_caregiver_review_required");
          await this.application(job);await this.mark(job,{state:"creating",createAttempted:true});
          try{caregiverId=await this.gateway.create(input,job.hha.employeeId,config);}
          catch(error){if(error instanceof HhaNotSubmittedError){await this.mark(job,{state:"queued",createAttempted:false,leaseUntil:0});return;}throw error;}
        }
        await this.mark(job,{state:"created",caregiverId});
      }
      await this.application(job);
      verifyApplicant(await this.gateway.profile(caregiverId),caregiverId,input,job.hha.employeeId,job.office);
      let document=await this.exactDocument(caregiverId,config,artifact.filename,artifact.sha);
      if(!document){
        if(prior==="attaching"||prior==="acknowledged"||job.hha.attachAttempted)throw Error("application_attachment_needs_reconciliation");
        await this.application(job);await this.mark(job,{state:"attaching",attachAttempted:true});
        let documentId:string;
        try{documentId=await this.gateway.attach(caregiverId,config.documentType,artifact.filename,artifact.bytes);}
        catch(error){if(error instanceof HhaNotSubmittedError){await this.mark(job,{state:"created",attachAttempted:false,leaseUntil:0});return;}throw error;}
        await this.mark(job,{state:"acknowledged",documentId});
        document=await this.exactDocument(caregiverId,config,artifact.filename,artifact.sha);
        if(!document||document.id!==documentId)throw Error("application_document_target_unverified");
      }
      if(job.hha.documentId&&document.id!==job.hha.documentId)throw Error("application_document_target_unverified");
      await this.application(job);
      verifyApplicant(await this.gateway.profile(caregiverId),caregiverId,input,job.hha.employeeId,job.office);
      await this.application(job);
      await this.mark(job,{state:"verified",caregiverId,documentId:document.id,verifiedAt:new Date(this.now()).toISOString(),leaseUntil:0,reason:""});
      // Separate from existing-employee links: applicants keep their application
      // dashboard. Only office staff can change EmployeeType in HHA.
    }catch(error){
      if(["hha_transfer_not_released","transfer_lease_lost"].includes((error as Error).message))return;
      if(error instanceof HhaApplicantReadUnavailable){await this.mark(job,{reason:"hha_source_unavailable",leaseUntil:0});return;}
      if(error instanceof HhaNotSubmittedError&&!["creating","attaching"].includes(job.hha.state)){await this.mark(job,{leaseUntil:0});return;}
      // Ambiguous network writes retain their phase for read-only reconciliation.
      if(["creating","attaching"].includes(job.hha.state)&&!REASONS.has((error as Error).message)){await this.mark(job,{leaseUntil:0});return;}
      const reason=REASONS.has((error as Error).message)?(error as Error).message:"hha_transfer_review_required";
      await this.mark(job,{state:"review_required",reason,leaseUntil:0});
    }
  }
  async run(){
    if(!transferAllowed(this.configuration(),this.now()))return {processed:0};
    const jobs=await this.db.collection("workforceOnboardingJobs").where("hha.state","in",PHASES).limit(3).get();
    for(const job of jobs.docs)await this.process(job.id);return {processed:jobs.size};
  }
}
