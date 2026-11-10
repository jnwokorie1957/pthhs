import {getFirestore} from "firebase-admin/firestore";
import {cachedHhaNames} from "./hhaCachedNames.js";
import { randomUUID } from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { workforceIdentity, recentWorkforceIdentity } from "./auth.js";
import { WorkforceStore, workEmail } from "./store.js";
import { StaffCredentials } from "./staffCredentials.js";
import { AccountSupport } from "./accountSupport.js";
import {HhaDirectory} from "./hhaDirectory.js";
import {HhaProfileSource} from "./hhaSource.js";
import {HhaEnrollment} from "./hhaEnrollment.js";
import {FirestoreWorkspaceRepository,OperationsWorkspace} from "../operations/workspace.js";
import {operationalRead} from "../operations/reads.js";
import {HhaSoapClient} from "../integrations/hhaexchange/client.js";
import {hhaCredentials,hhaBaseUrl,getHhaCredentials} from "../integrations/hhaexchange/config.js";
import { WorkforceError,requirePermission } from "./policy.js";
import type { Action } from "./opportunities.js";
import { IntakeStore } from "./intakeStore.js";
import { intakePacket, packetInventory } from "./packet.js";
import { MAX_DOCUMENT_BYTES } from "./documents.js";
import { GoogleAddressLookup } from "./addresses.js";
import { readFile } from "node:fs/promises";
import { readings, referencePages } from "./readings.js";
import { policyDocument } from "./policyDocuments.js";
import { renderOfficialForm, type FormKind } from "./eforms.js";
import { renderApplication, renderDocumentPrint, renderPersonnelPacket, type PacketPart } from "./applicationPdf.js";
// Default closed. These do not authorize applicant collection or vendor writes.
const staffEnabled = defineString("WORKFORCE_STAFF_APPROVED", { default: "false" });
const signInProviders = defineString("WORKFORCE_SIGN_IN_PROVIDERS", { default: "" });
const publicEnabled = defineString("WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED", { default: "false" });
const collectionApproved = defineString("WORKFORCE_APPLICANT_COLLECTION_APPROVED", { default: "false" });
const packetApproved = defineString("WORKFORCE_PACKET_REVIEW_APPROVED", { default: "false" });
const documentsApproved = defineString("WORKFORCE_ID_DOCUMENTS_APPROVED", { default: "false" });
const retentionApproved = defineString("WORKFORCE_ID_RETENTION_APPROVED", { default: "false" });
const intakeOffice = defineString("WORKFORCE_INTAKE_OFFICE", { default: "" });
const placesApproved = defineString("WORKFORCE_GOOGLE_PLACES_APPROVED", { default: "false" });
const employerEin = defineString("WORKFORCE_EMPLOYER_EIN", { default: "" });
const hhaDataApproved=defineString("PRIMETIME_OPERATIONAL_DATA_APPROVED",{default:"false"});
const hhaPortalApproved=defineString("WORKFORCE_HHA_PORTAL_APPROVED",{default:"false"});
const portalOrigin=defineString("WORKFORCE_PORTAL_ORIGIN",{default:"https://pthhs.net"});
function hhaWorkspace(lane:"interactive"|"background"="interactive"){
  const repository=new FirestoreWorkspaceRepository();let client:HhaSoapClient|undefined;
  return new OperationsWorkspace(repository,(input,scope)=>{client??=new HhaSoapClient(hhaBaseUrl.value(),getHhaCredentials(),{beforeRequest:()=>repository.reserveRead(lane),defer:seconds=>repository.deferReads(seconds)});return operationalRead(client,input,scope);},hhaDataApproved.value()==="true");
}
function hhaDirectory(actorId:string){return new HhaDirectory(hhaWorkspace(),()=>new WorkforceStore().actor(actorId));}
async function hhaEnrollment(lane:"interactive"|"background"="interactive"){
  const workspace=hhaWorkspace(lane),settings=await workspace.settings(),office=settings.settings.officeId;
  if(!office||!settings.dataApproved)throw new WorkforceError(503,"hha_profile_unavailable");
  const sendReset=async(email:string)=>{
    const origin=new URL(portalOrigin.value());if(origin.protocol!=="https:"||origin.pathname!=="/"||origin.search||origin.hash)throw new WorkforceError(503,"portal_origin_unconfigured");
    const configuration=await fetch("https://primetimehomehealthservices.firebaseapp.com/__/firebase/init.json",{signal:AbortSignal.timeout(10000)});if(!configuration.ok)throw new WorkforceError(503,"reset_delivery_unavailable");
    const config=await configuration.json() as {apiKey?:string;projectId?:string};if(!config.apiKey||config.projectId!=="primetimehomehealthservices")throw new WorkforceError(503,"reset_delivery_unavailable");
    const response=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key="+encodeURIComponent(config.apiKey),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestType:"PASSWORD_RESET",email,continueUrl:origin.origin+"/caregiver"}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new WorkforceError(503,"reset_delivery_unavailable");
  };
  return new HhaEnrollment((office,actor)=>new HhaProfileSource(workspace,actor,office),office,sendReset);
}
export const workforceApi = process.env.PRIMETIME_API_ONLY_DEPLOY === "true" ? undefined : onRequest({ region: "us-central1", maxInstances: 5, concurrency: 2, timeoutSeconds: 60, memory: "512MiB",secrets:[hhaCredentials] }, async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  const path = req.path.replace(/^\/(?:caregiver|primetime)\/workforce-api/, "");
  try {
    const applicationsEnabled = staffEnabled.value() === "true" && collectionApproved.value() === "true" && packetApproved.value() === "true" && !!intakeOffice.value();
    const uploadsEnabled = applicationsEnabled && documentsApproved.value() === "true" && retentionApproved.value() === "true";
    const existingAccessEnabled=staffEnabled.value()==="true"&&hhaPortalApproved.value()==="true"&&hhaDataApproved.value()==="true";
    if (path === "/configuration" && req.method === "GET") {
      let existingCaregiverEnrollmentReady=false;if(existingAccessEnabled){try{const settings=await hhaWorkspace().settings(),office=settings.settings.officeId;if(office){const ready=await getFirestore().collection("workforceHhaRosterReady").doc(office).get();existingCaregiverEnrollmentReady=ready.exists&&ready.data()?.office===office&&typeof ready.data()?.completedAt==="string";}}catch{/* Source preparation remains closed when readiness cannot be confirmed. */}}
      const enabledSignInProviders=signInProviders.value().split(",").map(p=>p.trim()).filter(p=>["google.com","apple.com","microsoft.com","yahoo.com"].includes(p));
      res.json({ staffEnabled: staffEnabled.value() === "true", accountsEnabled: applicationsEnabled||existingAccessEnabled, applicationsEnabled, documentsEnabled: uploadsEnabled, addressLookupEnabled: placesApproved.value() === "true", enabledSignInProviders,existingAccessEnabled,existingCaregiverEnrollmentReady }); return;
    }
    if(path==="/existing-caregiver/access"&&req.method==="POST"){
      if(!existingAccessEnabled)throw new WorkforceError(503,"existing_access_pending");
      if(!req.is("application/json")||req.rawBody.length>1000||!req.body||Array.isArray(req.body)||Object.keys(req.body).some(key=>key!=="email"))throw new WorkforceError(400,"invalid_request");
      res.json(await(await hhaEnrollment()).requestAccess(req.body.email,req.ip||"unknown"));return;
    }
    if (path === "/opportunities" && req.method === "GET") {
      await workforceIdentity(req);
      res.json(publicEnabled.value() === "true" && staffEnabled.value() === "true" ? await new WorkforceStore().publicList() : { items: [], release: "pending" }); return;
    }
    const interest = path.match(/^\/opportunities\/([a-zA-Z0-9_-]{1,128})\/interest$/);
    if (interest && req.method === "POST") {
      if (!applicationsEnabled || publicEnabled.value() !== "true") throw new WorkforceError(503,"application_collection_pending");
      const uid=await recentWorkforceIdentity(req);
      if (!req.is("application/json") || req.rawBody.length>100 || !req.body || Array.isArray(req.body) || Object.keys(req.body).length) throw new WorkforceError(400,"invalid_request");
      res.json(await new WorkforceStore().interest(uid,interest[1]!)); return;
    }
    // The schema has no completed records or original packet scans. Actual
    // collection requires separately reviewed server-side release parameters.
    if (path === "/application/packet" && req.method === "GET") { res.json({ packet: intakePacket, inventory: packetInventory }); return; }
    if (path === "/application/session" && req.method === "GET") {
      if (!applicationsEnabled&&!existingAccessEnabled) throw new WorkforceError(503, "application_collection_pending");
      const uid=await workforceIdentity(req),existing=existingAccessEnabled?await(await hhaEnrollment()).link(uid):null;await new AccountSupport().register(uid,existing?.office||intakeOffice.value());
      res.json({ uid, kind: "caregiver", applicationsEnabled, documentsEnabled: uploadsEnabled, addressLookupEnabled: placesApproved.value() === "true",existingCaregiver:!!existing }); return;
    }
    if(path==="/application/hha-profile"||/^\/application\/hha-files\/[1-9]\d{0,9}$/.test(path)){
      if(!existingAccessEnabled)throw new WorkforceError(503,"existing_access_pending");const uid=await recentWorkforceIdentity(req);
      if(path==="/application/hha-profile"&&req.method==="GET"){if(!existingAccessEnabled)throw new WorkforceError(503,"existing_access_pending");res.json(await(await hhaEnrollment()).profile(uid));return;}
      const hhaFile=path.match(/^\/application\/hha-files\/([1-9]\d{0,9})$/);
      if(hhaFile&&req.method==="GET"){if(!existingAccessEnabled)throw new WorkforceError(503,"existing_access_pending");const file=await(await hhaEnrollment()).file(uid,hhaFile[1]!);res.set("Content-Type",file.bytes.subarray(0,5).toString("ascii")==="%PDF-"?"application/pdf":"application/octet-stream");res.set("Content-Disposition","attachment; filename*=UTF-8''"+encodeURIComponent(file.filename));res.set("Content-Security-Policy","sandbox");res.send(file.bytes);return;}
      throw new WorkforceError(405,"method_not_allowed");
    }
    if (path === "/application" || path.startsWith("/application/")) {
      if (!applicationsEnabled) throw new WorkforceError(503, "application_collection_pending");
      const uid = await recentWorkforceIdentity(req), store = new IntakeStore();
      const officialForm = path.match(/^\/application\/forms\/(i9|w4|new_hire)(\/pdf)?$/);
      if (officialForm) {
        if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
        const kind = officialForm[1] as FormKind;
        if (req.method === "GET") {
          const record = await store.loadForm(uid, kind);
          const employer=await store.formContext(uid,employerEin.value());
          if (!officialForm[2]) { res.json({ form: record, employer }); return; }
          if (!record) throw new WorkforceError(404, "form_not_found");
          res.set("Content-Type", "application/pdf"); res.set("Content-Disposition", `attachment; filename="private-${kind}.pdf"`);
          res.send(await renderOfficialForm(record,employer)); return;
        }
        if (req.method !== "POST" || officialForm[2] || !req.is("application/json") || req.rawBody.length > 64000) throw new WorkforceError(400,"invalid_request");
        res.json({ form: await store.saveForm(uid,kind,req.body) }); return;
      }
      const document = path.match(/^\/application\/reading-documents\/(\d{1,2})$/);
      if (document && req.method === "GET") {
        const content = policyDocument(Number(document[1]));
        if (!content) throw new WorkforceError(404, "route_not_found");
        res.json(content); return;
      }
      const reading = path.match(/^\/application\/reading-pages\/(\d{1,2})(\/2)?$/);
      if (reading && req.method === "GET") {
        const page = Number(reading[1]);
        if (![...readings.map(r => r.page), ...referencePages].includes(page)) throw new WorkforceError(404, "route_not_found");
        if (reading[2] && !readings.find(r=>r.page===page)?.hasContinuation) throw new WorkforceError(404,"route_not_found");
        const bytes = await readFile(new URL(`../../assets/workforce-packet/page-${String(page).padStart(2, "0")}${reading[2]?"-cont":""}.webp`, import.meta.url));
        res.set("Content-Type", "image/webp"); res.send(bytes); return;
      }
      if (["/application/address/suggest", "/application/address/details"].includes(path)) {
        if (placesApproved.value() !== "true") throw new WorkforceError(503, "address_lookup_unavailable");
        if (req.method !== "POST" || !req.is("application/json") || req.rawBody.length > 1500) throw new WorkforceError(400, "invalid_address_request");
        await store.reserveAddressLookup(uid);
        res.json(await new GoogleAddressLookup().lookup(req.body, path.endsWith("/details"))); return;
      }
      if (path === "/application" && req.method === "GET") { res.json({ application: await store.load(uid) }); return; }
      if (path === "/application/documents" && req.method === "GET") {
        if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
        res.json(await store.listDocuments(uid)); return;
      }
      const download = path.match(/^\/application\/documents\/([a-zA-Z0-9_-]{1,128})$/);
      if (download && req.method === "GET") {
        if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
        const bytes = await store.download(uid, download[1]!, uid);
        const pdf = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
        res.set("Content-Type", pdf ? "application/pdf" : "image/jpeg"); res.set("Content-Disposition", `attachment; filename="private-document.${pdf ? "pdf" : "jpg"}"`); res.set("Content-Security-Policy", "sandbox");
        res.send(bytes); return;
      }
      if (req.method !== "POST") throw new WorkforceError(405, "method_not_allowed");
      const upload = path === "/application/documents";
      if (upload && !uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
      if (!req.is("application/json") || req.rawBody.length > (upload ? Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 2048 : 64000)
        || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new WorkforceError(400, "invalid_request");
      const allowed = upload ? ["kind", "base64"] : path === "/application/submit" ? ["revision", "signature"] : ["revision", "answers"];
      if (Object.keys(req.body).some(k => !allowed.includes(k))) throw new WorkforceError(400, "invalid_request");
      if (upload) { res.json({ document: await store.upload(uid, req.body.kind, req.body.base64) }); return; }
      if (!Number.isInteger(req.body.revision) || req.body.revision < 0) throw new WorkforceError(400, "invalid_request");
      if (path === "/application") { res.json({ application: await store.save(uid, req.body.revision, req.body.answers, intakeOffice.value()) }); return; }
      if (path === "/application/submit") { res.json({ application: await store.submit(uid, req.body.revision, req.body.signature) }); return; }
      throw new WorkforceError(404, "route_not_found");
    }
    if (staffEnabled.value() !== "true") throw new WorkforceError(503, "workforce_release_pending");
    if (path.startsWith("/staff-auth/") && req.method === "POST") {
      if (!req.is("application/json") || req.rawBody.length > 1000 || !req.body || Array.isArray(req.body)) {
        throw new WorkforceError(400, "invalid_request");
      }
      const credentials = new StaffCredentials(new WorkforceStore());
      if (path === "/staff-auth/password-setup") {
        res.json(await credentials.sendSetup(workEmail(req.body.email), req.ip || "unknown", portalOrigin.value())); return;
      }
      if (path === "/staff-auth/resolve-username") {
        res.json(await credentials.resolve(req.body.username, req.body.password, req.ip || "unknown")); return;
      }
      if (path === "/staff-auth/credentials") {
        res.json(await credentials.set(await recentWorkforceIdentity(req), req.body.password, req.body.username)); return;
      }
      throw new WorkforceError(404, "route_not_found");
    }
    const uid = await workforceIdentity(req);
    const store = new WorkforceStore();
    const credentials = new StaffCredentials(store);
    const staffSession = async (actor: Awaited<ReturnType<typeof store.actor>>) => ({
      ...actor, trainingRequired: await store.trainingRequired(actor),
      passwordSetupRequired: await credentials.setupRequired(actor.uid),
    });
    if (path === "/session" && req.method === "GET") {
      res.json(await staffSession(await store.actor(uid))); return;
    }
    if (path.startsWith("/staff/") && path !== "/staff/invitations/accept" && await credentials.setupRequired(uid)) {
      throw new WorkforceError(403, "staff_password_setup_required");
    }
    if (path === "/staff/training" && req.method === "POST") {
      if (!req.is("application/json") || req.rawBody.length > 100 || !req.body
        || Object.keys(req.body).length !== 1 || !["start", "complete"].includes(req.body.action)) {
        throw new WorkforceError(400, "invalid_request");
      }
      res.json(await store.recordTraining(uid, req.body.action)); return;
    }
    if (path.startsWith("/staff/") && path !== "/staff/invitations/accept") {
      if (await store.trainingRequired(await store.actor(uid))) {
        throw new WorkforceError(403, "staff_training_required");
      }
    }
    if (path === "/staff/roster" && req.method === "GET") {
      if (!existingAccessEnabled) throw new WorkforceError(503,"existing_access_pending");
      await recentWorkforceIdentity(req);
      res.json(await hhaDirectory(uid).browse(getFirestore(), req.query.after)); return;
    }
    if(path==="/staff/roster/sync"&&req.method==="POST"){
      if(!existingAccessEnabled)throw new WorkforceError(503,"existing_access_pending");await recentWorkforceIdentity(req);
      if(!req.is("application/json")||req.rawBody.length>300||!req.body||Object.keys(req.body).some(key=>key!=="jobId")||req.body.jobId!==undefined&&typeof req.body.jobId!=="string")throw new WorkforceError(400,"invalid_request");
      res.json(await(await hhaEnrollment("background")).sync(await store.actor(uid),req.body.jobId));return;
    }
    const rosterDetail=path.match(/^\/staff\/roster\/([1-9]\d{0,9})\/(detail|access|files\/([1-9]\d{0,9}))$/);
    if(rosterDetail){
      if(!existingAccessEnabled)throw new WorkforceError(503,"existing_access_pending");await recentWorkforceIdentity(req);
      const actor=await store.actor(uid),service=await hhaEnrollment(),profile=existingAccessEnabled?await service.stage(actor,rosterDetail[1]!):await service.inspect(actor,rosterDetail[1]!);
      if(rosterDetail[2]==="access"&&req.method==="POST"){if(!existingAccessEnabled)throw new WorkforceError(503,"existing_access_pending");if(!req.is("application/json")||req.rawBody.length>100||!req.body||Object.keys(req.body).length)throw new WorkforceError(400,"invalid_request");res.json(await service.requestAccess(profile.email,"staff:"+uid));return;}
      if(req.method!=="GET")throw new WorkforceError(405,"method_not_allowed");
      if(rosterDetail[3]){requirePermission(actor,"documents.review",profile.office);const file=await new HhaProfileSource(hhaWorkspace(),uid,profile.office).download(profile.id,rosterDetail[3]);requirePermission(await store.actor(uid),"documents.review",profile.office);res.set("Content-Type",file.bytes.subarray(0,5).toString("ascii")==="%PDF-"?"application/pdf":"application/octet-stream");res.set("Content-Disposition","attachment; filename*=UTF-8''"+encodeURIComponent(file.filename));res.set("Content-Security-Policy","sandbox");res.send(file.bytes);return;}
      let files=null;if(actor.grant.permissions.includes("documents.review")){try{files=await new HhaProfileSource(hhaWorkspace(),uid,profile.office).documents(profile.id);}catch{}}else delete profile.fields.BirthDate;
      const currentActor=await store.actor(uid);requirePermission(currentActor,"accounts.support",profile.office);const documentsAllowed=currentActor.grant.permissions.includes("documents.review");if(!documentsAllowed){files=null;delete profile.fields.BirthDate;}res.json({profile,files,filesUnavailable:!files,filesPermissionDenied:!documentsAllowed,accessEnabled:existingAccessEnabled});return;
    }
    const rosterProfile=path.match(/^\/staff\/roster\/([1-9]\d{0,9})\/profile$/);
    if(rosterProfile&&req.method==="GET"){if(!applicationsEnabled&&!existingAccessEnabled)throw new WorkforceError(503,"application_collection_pending");await recentWorkforceIdentity(req);res.json(await hhaDirectory(uid).profile(rosterProfile[1]!));return;}
    const accountProfile=path.match(/^\/staff\/accounts\/([a-zA-Z0-9_-]{1,128})\/profile$/);
    if(accountProfile&&req.method==="GET"){
      if(!applicationsEnabled&&!existingAccessEnabled)throw new WorkforceError(503,"application_collection_pending");await recentWorkforceIdentity(req);
      res.json(await new AccountSupport().profile(await store.actor(uid),accountProfile[1]!));return;
    }
    if(path==="/staff/accounts/lookup"||/^\/staff\/accounts\/[a-zA-Z0-9_-]{1,128}\/reset$/.test(path)){
      if(!applicationsEnabled&&!existingAccessEnabled)throw new WorkforceError(503,"application_collection_pending");await recentWorkforceIdentity(req);
      if(req.method!=="POST"||!req.is("application/json")||req.rawBody.length>1000||!req.body||Array.isArray(req.body))throw new WorkforceError(400,"invalid_request");
      const actor=await store.actor(uid),support=new AccountSupport();
      if(path.endsWith("/lookup")){
        if(Object.keys(req.body).some(k=>k!=="name"))throw new WorkforceError(400,"invalid_request");
        const portal=await support.search(actor,req.body.name);
        let roster:Awaited<ReturnType<HhaDirectory["search"]>>|null=null;
        let hhaCached=false;try{roster=await hhaDirectory(uid).search(req.body.name);}catch{if(existingAccessEnabled){try{const settings=await hhaWorkspace().settings(),office=settings.settings.officeId;if(office&&["SearchCaregivers","GetCaregiverDemographics"].every(operation=>settings.settings.enabledReads.includes(operation))){requirePermission(await store.actor(uid),"accounts.support",office);const snapshot=await getFirestore().collection("workforceHhaProfiles").where("office","==",office).select("id","office","firstName","lastName","status","code","fetchedAt").limit(5001).get();const cached=cachedHhaNames(await store.actor(uid),office,req.body.name,snapshot.docs.map(doc=>doc.data()));if((await hhaWorkspace().settings()).settings.revision!==settings.settings.revision)throw new WorkforceError(409,"revision_conflict");roster=cached;hhaCached=true;}}catch{/* No source names are fabricated. */}}}
        const current=await store.actor(uid);requirePermission(current,"accounts.support");
        const items=[...(roster?.items||[]),...portal.items.map(item=>({...item,source:"portal"}))].filter(item=>current.grant.offices.includes(item.office));
        res.json({items,hasMore:!!roster?.hasMore||portal.hasMore,hhaUnavailable:!roster||hhaCached,hhaCached});
      }
      else{if(Object.keys(req.body).length)throw new WorkforceError(400,"invalid_request");res.json(await support.reset(actor,path.split("/")[3]!));}return;
    }
    if (path.startsWith("/staff/applications") && req.method === "GET") {
      if (!applicationsEnabled) throw new WorkforceError(503, "application_collection_pending");
      await recentWorkforceIdentity(req);
      const personnel = new IntakeStore();
      if (path === "/staff/applications") { res.json(await personnel.queue(await store.actor(uid))); return; }
      const packetPrint=path.match(/^\/staff\/applications\/([a-zA-Z0-9_-]{1,128})\/packet\/pdf$/);
      if(packetPrint){
        if(!uploadsEnabled)throw new WorkforceError(503,"document_collection_pending");
        const target=packetPrint[1]!,application=await personnel.hrRead(uid,target,true),context=await personnel.formContext(target,employerEin.value());
        const parts:PacketPart[]=[{title:"Employment application",status:`${application.state} - revision ${application.revision}`,bytes:await renderApplication(application)}];
        for(const kind of ["i9","w4","new_hire"] as FormKind[]){
          const record=await personnel.loadForm(target,kind,uid),title={i9:"Form I-9",w4:"Form W-4",new_hire:"Texas New Hire Report"}[kind];
          parts.push(record?{title,status:`${record.state} - revision ${record.revision}`,bytes:await renderOfficialForm(record,context)}:{title,status:"Not started"});
        }
        const documents=await personnel.listDocuments(target,uid);
        if(documents.items.length>20||documents.items.reduce((sum,doc)=>sum+doc.size,0)>20_000_000)throw new WorkforceError(413,"print_packet_too_large");
        for(const [kind,title] of Object.entries({identity:"Photo ID",social_security:"Social Security card",employment_authorization:"Employment authorization document",i9:"Previously uploaded I-9 document",w4:"Previously uploaded W-4 document"})){
          const matches=documents.items.filter(doc=>doc.kind===kind);
          if(!matches.length&&["identity","social_security"].includes(kind))parts.push({title,status:"Not submitted"});
          for(const doc of matches){
            const part:PacketPart={title,status:doc.state==="pending_review"?"Uploaded - available for review":doc.state.replaceAll("_"," ")+" - not included"};
            if(doc.state==="pending_review")part.bytes=await renderDocumentPrint(await personnel.download(target,doc.id,uid));parts.push(part);
          }
        }
        const bytes=await renderPersonnelPacket(parts,[application.answers.firstName,application.answers.lastName].filter(Boolean).join(" ")),current=await personnel.hrRead(uid,target,true);
        if(current.revision!==application.revision)throw new WorkforceError(409,"revision_conflict");
        res.set("Content-Type","application/pdf");res.set("Content-Disposition",'attachment; filename="private-caregiver-packet.pdf"');res.send(bytes);return;
      }
      const applicationPrint=path.match(/^\/staff\/applications\/([a-zA-Z0-9_-]{1,128})\/pdf$/);
      if(applicationPrint){
        const application=await personnel.hrRead(uid,applicationPrint[1]!,true);
        res.set("Content-Type","application/pdf");res.set("Content-Disposition",'attachment; filename="private-employment-application.pdf"');
        res.send(await renderApplication(application));return;
      }
      const staffForm = path.match(/^\/staff\/applications\/([a-zA-Z0-9_-]{1,128})\/forms\/(i9|w4|new_hire)(\/pdf)?$/);
      if (staffForm) {
        if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
        const record = await personnel.loadForm(staffForm[1]!, staffForm[2] as FormKind, uid);
        if (!staffForm[3]) { res.json({form:record}); return; }
        if (!record) throw new WorkforceError(404,"form_not_found");
        res.set("Content-Type","application/pdf");res.set("Content-Disposition",`attachment; filename="private-${staffForm[2]}.pdf"`);res.send(await renderOfficialForm(record,await personnel.formContext(staffForm[1]!,employerEin.value())));return;
      }
      const detail = path.match(/^\/staff\/applications\/([a-zA-Z0-9_-]{1,128})(?:\/documents(?:\/([a-zA-Z0-9_-]{1,128})(\/print)?)?)?$/);
      if (!detail) throw new WorkforceError(404, "route_not_found");
      const target = detail[1]!, docs = path.includes("/documents");
      const application = await personnel.hrRead(uid, target, docs);
      if (!docs) { res.json({ application }); return; }
      if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
      if (!detail[2]) { res.json(await personnel.listDocuments(target, uid)); return; }
      const bytes = await personnel.download(target, detail[2], uid);
      if(detail[3]){res.set("Content-Type","application/pdf");res.set("Content-Disposition",'attachment; filename="private-personnel-document.pdf"');res.send(await renderDocumentPrint(bytes));return;}
      const pdf = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
      res.set("Content-Type", pdf ? "application/pdf" : "image/jpeg"); res.set("Content-Disposition", `attachment; filename="private-document.${pdf ? "pdf" : "jpg"}"`); res.set("Content-Security-Policy", "sandbox");
      res.send(bytes); return;
    }
    if (path === "/staff/team" && req.method === "GET") { res.json(await store.reviewTeam(uid)); return; }
    if (path === "/staff/opportunities" && req.method === "GET") { res.json(await store.list(uid)); return; }
    if (req.method !== "POST") throw new WorkforceError(405, "method_not_allowed");
    if (!req.is("application/json") || req.rawBody.length > 12000 || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new WorkforceError(400, "invalid_request");
    if (path === "/staff/invitations" || path === "/staff/invitations/accept") {
      const recentUid = await recentWorkforceIdentity(req);
      if (path === "/staff/invitations/accept") {
        const activation = req.body.activationCode;
        if (Object.keys(req.body).some(key => key !== "activationCode")
          || (activation !== undefined && (typeof activation !== "string" || !/^[a-f0-9-]{36}$/.test(activation)))) {
          throw new WorkforceError(400, "invalid_request");
        }
        res.json(await staffSession(await store.acceptStaffInvite(recentUid, Date.now(), activation)));
      } else {
        res.json(await store.inviteStaff(recentUid, req.body.email, req.body.grant));
      }
      return;
    }
    if (path === "/staff/grant") { res.json(await store.grant(uid, req.body.uid, req.body.grant)); return; }
    if (path === "/staff/opportunities") {
      const action: unknown = req.body.action;
      if (action !== undefined && !["submit", "approve", "publish", "close", "archive"].includes(action as string)) throw new WorkforceError(400, "invalid_action");
      res.json(await store.mutate(uid, req.body.id ?? randomUUID(), req.body.revision, req.body.data, action as Action | undefined, req.body.privacyConfirmed === true)); return;
    }
    throw new WorkforceError(404, "route_not_found");
  } catch (error) {
    // No request payloads, Firebase tokens, patient references or document data in logs.
    res.status(error instanceof WorkforceError ? error.status : 503).json({ error: error instanceof WorkforceError ? error.code : "workforce_unavailable" });
  }
});
