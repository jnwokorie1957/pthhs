import type {Intake} from './intake.js';
import type {PrivateDocument} from './documents.js';
import type {FormRecord, FormKind} from './eforms.js';
export const PAYROLL_RECIPIENT = 'irab@pthhs.net';
export interface ApplicationMailJob {
 uid:string; revision:number; office:string; to:string; status:string; createdAt:string;
 documents:{id:string;generation:string;sha256:string;size:number;kind:string}[];
 forms:{kind:FormKind;revision:number;sourceSha256:string}[];
 lease?:string; leaseUntil?:number; retryAt?:number;
 eventKey?:string; nextPart?:number; batchManifest?:string;
}
export function applicationMailJob(app:Intake, documents:PrivateDocument[], forms:FormRecord[]):ApplicationMailJob {
 if(app.state!=='submitted'||!app.signature)throw Error('submitted_application_required');
 const latest=new Map<string,PrivateDocument>();
 for(const doc of documents){
  if(doc.uid!==app.uid)throw Error('mail_document_owner_mismatch');
  if(!['pending_review','pending_security_review'].includes(doc.state))continue;
  if(!doc.generation||!doc.sha256)throw Error('mail_document_unconfirmed');
  if(!latest.has(doc.kind)||latest.get(doc.kind)!.createdAt<doc.createdAt)latest.set(doc.kind,doc);
 }
 const submitted=forms.filter(f=>f.state==='submitted');
 if(submitted.some(f=>f.uid!==app.uid||f.office!==app.office||f.signature?.uid!==app.uid))throw Error('mail_form_owner_mismatch');
 return {uid:app.uid,revision:app.revision,office:app.office,to:PAYROLL_RECIPIENT,status:'queued',createdAt:app.updatedAt,
  documents:[...latest.values()].map(d=>({id:d.id,generation:d.generation!,sha256:d.sha256!,size:d.size,kind:d.kind})),
  forms:submitted.map(f=>({kind:f.kind,revision:f.revision,sourceSha256:f.sourceSha256}))};
}
