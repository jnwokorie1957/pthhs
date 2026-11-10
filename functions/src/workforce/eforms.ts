import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, StandardFonts } from "pdf-lib";
import { WorkforceError, validId } from "./policy.js";
import { EMPLOYER_NAME, EMPLOYER_ADDRESS, chicagoDate } from "./dates.js";
export type FormKind = "i9" | "w4" | "new_hire" | "cch";
export const FORM_TITLES = {i9: "Form I-9", w4: "Form W-4", new_hire: "Texas New Hire Report", cch: "DPS CCH Verification Form"} satisfies Record<FormKind, string>;
type FormRect = NonNullable<FormField["rect"]>;
export interface FormField { id: string; type: string; label: string; maxLength: number; options?: string[]; sensitive?: boolean; required?: boolean; rect?:{x:number;y:number;width:number;height:number} }
export interface FormSchema { kind: FormKind; file: string; edition: string; sourceSha256: string; fields: FormField[]; signatureRect?:FormRect; signatureDateRect?:FormRect; employerFields?:{key:string;label:string;rect:{x:number;y:number;width:number;height:number}}[] }
export interface FormRecord {
 uid: string; kind: FormKind; office: string; revision: number; state: "draft" | "submitted"; fields: Record<string,string|boolean>; updatedAt: string;
 edition: string; sourceSha256: string;
 signature: null | { name: string; uid: string; signedAt: string; electronicConsent: true; formRead: true; fieldsSha256: string };
}
export async function formSchema(kind: FormKind): Promise<FormSchema> {
 const schemas = JSON.parse(await readFile(new URL("../../assets/workforce-forms/schema.json",import.meta.url),"utf8")); return schemas[kind];
}
export async function officialFormBytes(schema: FormSchema): Promise<Buffer> {
 const bytes = await readFile(new URL(`../../assets/workforce-forms/${schema.kind === "i9" ? "i9-2025.pdf" : schema.kind === "w4" ? "w4-2026.pdf" : schema.kind === "cch" ? "dps-cch.pdf" : "new-hire-texas.pdf"}`,import.meta.url));
 if(createHash("sha256").update(bytes).digest("hex") !== schema.sourceSha256) throw new WorkforceError(503,"official_form_unavailable"); return bytes;
}
const normalizedName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function requireSignedCch(form: FormRecord | null | undefined, uid: string, office: string, name: string) {
 if (form?.kind !== "cch" || form.state !== "submitted" || form.uid !== uid || form.office !== office
   || form.signature?.uid !== uid || normalizedName(form.signature.name) !== normalizedName(name)) {
  throw new WorkforceError(409, "cch_signature_required");
 }
}

export function formRecord(uid: string, office: string, schema: FormSchema, previous: FormRecord|null, input: unknown, fullName: string, offerAccepted: boolean, now: string): FormRecord {
 const body = input as {revision?:unknown;fields?:unknown;submit?:unknown;signature?:{name?:unknown;electronicConsent?:unknown;formRead?:unknown}};
 if(!validId(uid)||!validId(office)||!body||Object.keys(body).some(k=>!["revision","fields","submit","signature"].includes(k))||body.revision !== (previous?.revision??0)||!body.fields||typeof body.fields!=="object"||Array.isArray(body.fields)) throw new WorkforceError(409,"form_revision_conflict");
 if(previous?.uid && (previous.uid!==uid||previous.kind!==schema.kind||previous.office!==office)) throw new WorkforceError(403,"workforce_forbidden");
 if(previous?.state === "submitted") throw new WorkforceError(409,"form_already_submitted");
 if(previous && previous.sourceSha256!==schema.sourceSha256) throw new WorkforceError(409,"form_version_review_required");
 const fields:Record<string,string|boolean>={};
 for(const [key,raw] of Object.entries(body.fields)) {
  const field=schema.fields.find(f=>f.id===key);
  const value=field?.sensitive && typeof raw==="string"?raw.replace(/[ -]/g,""):raw;
  if(!field||(field.type==="checkbox"?typeof value!=="boolean":typeof value!=="string"||value.length>field.maxLength||/[^\x20-\x7e\xa0-\xff\u2013\u2014\u2018\u2019\u201c\u201d]/.test(value)||field.type==="select"&&value!==""&&!field.options?.includes(value))) throw new WorkforceError(400,"invalid_form_fields");
  fields[key]=typeof value==="string"?value.trim():value;
 }
 const next:FormRecord={uid,office,kind:schema.kind,revision:(previous?.revision??0)+1,state:"draft",fields,updatedAt:now,edition:schema.edition,sourceSha256:schema.sourceSha256,signature:null};
 if(body.submit===true){
  if(schema.kind==="i9"&&!offerAccepted) throw new WorkforceError(409,"i9_offer_required");
  const signature=body.signature;
  if(!fullName.trim()||typeof signature?.name!=="string"||signature.name.length>250||normalizedName(signature.name)!==normalizedName(fullName)||signature.electronicConsent!==true||signature.formRead!==true) throw new WorkforceError(400,"signature_required");
  const required=schema.kind==="i9"?["Last Name (Family Name)","First Name Given Name","Address Street Number and Name","City or Town","State","ZIP Code","Date of Birth mmddyyyy"]:(schema.kind==="new_hire"||schema.kind==="cch")?schema.fields.filter(f=>f.required).map(f=>f.id):schema.fields.slice(0,5).map(f=>f.id);
  if(required.some(id=>!String(fields[id]??"").trim()))throw new WorkforceError(400,"form_incomplete");
  if(schema.kind==="cch"&&normalizedName(String(fields["Applicant Name Print"]??""))!==normalizedName(fullName))throw new WorkforceError(400,"signature_required");
  const choices=schema.kind==="i9"?["CB_1","CB_2","CB_3","CB_4"]:schema.kind==="w4"?schema.fields.slice(5,8).map(f=>f.id):[];
  if(choices.length && !(schema.kind==="w4"&&fields[schema.fields[15]!.id]===true) && choices.filter(id=>fields[id]===true).length!==1)throw new WorkforceError(400,"form_incomplete");
  if(schema.kind==="w4"&&fields[schema.fields[15]!.id]!==true&&schema.fields.slice(9,12).some(f=>typeof fields[f.id]!=="string"||!/^\d{1,9}(?:\.\d{1,2})?$/.test(String(fields[f.id]))))throw new WorkforceError(400,"form_incomplete");
  const ssn=schema.kind==="i9"?"US Social Security Number":schema.kind==="new_hire"?"employeeSSN":schema.kind==="w4"?schema.fields[4]!.id:null;
  if(ssn&&fields[ssn]&&!/^\d{3}-?\d{2}-?\d{4}$/.test(String(fields[ssn])))throw new WorkforceError(400,"form_incomplete");
  if(schema.kind==="i9"){
   if(fields.CB_3===true&&!fields["3 A lawful permanent resident Enter USCIS or ANumber"])throw new WorkforceError(400,"form_incomplete");
   if(fields.CB_4===true&&(!fields["Exp Date mmddyyyy"]||["USCIS ANumber","Form I94 Admission Number","Foreign Passport Number and Country of IssuanceRow1"].filter(k=>fields[k]).length!==1))throw new WorkforceError(400,"form_incomplete");
  }
  next.state="submitted";next.signature={name:signature.name.trim(),uid,signedAt:now,electronicConsent:true,formRead:true,fieldsSha256:createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(fields).sort(([a],[b])=>a.localeCompare(b))))).digest("hex")};
 }
 return next;
}
export interface EmployerContext { name?:string; address?:string; companyAddress?:string; ein?:string; firstDay?:string; street?:string; city?:string; state?:string; zip?:string; phone?:string; fax?:string; signingDate?:string }
export async function renderOfficialForm(record:FormRecord,employer:EmployerContext={}):Promise<Buffer>{
 const schema=await formSchema(record.kind),doc=await PDFDocument.load(await officialFormBytes(schema)),form=doc.getForm();
 if(record.sourceSha256!==schema.sourceSha256)throw new WorkforceError(409,"form_version_review_required");
 if(record.kind==="i9") {form.getTextField("Employers Business or Org Name").setText(EMPLOYER_NAME);form.getTextField("Employers Business or Org Address").setText(EMPLOYER_ADDRESS);}
 else if(record.kind==="w4") {form.getTextField("topmostSubform[0].Page1[0].f1_12[0]").setText(EMPLOYER_NAME + "\n" + EMPLOYER_ADDRESS);if(/^\d{2}-?\d{7}$/.test(employer.ein||""))form.getTextField("topmostSubform[0].Page1[0].f1_14[0]").setText(employer.ein!);if(employer.firstDay)form.getTextField("topmostSubform[0].Page1[0].f1_13[0]").setText(employer.firstDay);}
 if(record.kind==="new_hire"||record.kind==="cch"){
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const signatureFields = record.kind === "cch" ? [
   {id:"Applicant Signature",rect:schema.signatureRect}, {id:"Date",rect:schema.signatureDateRect}
  ] : [];
  for(const f of [...schema.fields,...signatureFields,...(schema.employerFields||[]).map(f=>({id:"employer_"+f.key,label:f.label,rect:f.rect,type:"text",maxLength:100}))]){
   const rect=f.rect!;const field=form.createTextField(f.id);field.addToPage(doc.getPages()[0]!,{...rect,font,borderWidth:0});field.setFontSize(9);
  }
  const defaults:EmployerContext={name:EMPLOYER_NAME,address:EMPLOYER_ADDRESS,street:"11602 Burdine St # A",city:"Houston",state:"TX",zip:"77035",phone:"7139777721",fax:"7139777728",...employer};
  for(const f of schema.employerFields||[])form.getTextField("employer_"+f.key).setText(String(defaults[f.key as keyof EmployerContext]||"").toUpperCase());
 }
 for(const [id,value]of Object.entries(record.fields)){
  if(!schema.fields.some(f=>f.id===id))throw new WorkforceError(400,"invalid_form_fields");
  const field=form.getField(id);
  if(field instanceof PDFCheckBox){value===true?field.check():field.uncheck();}
  else if(field instanceof PDFDropdown){if(value)field.select(String(value));}
  else if(field instanceof PDFTextField)field.setText(String(value));
 }
 if(record.signature){
  const [year,month,day]=chicagoDate(record.signature.signedAt).split("-"),date=`${month}/${day}/${year}`;
  if(record.kind==="i9"){form.getTextField("Signature of Employee").setText(record.signature.name);form.getTextField("Today's Date mmddyyy").setText(date);}
  else if(record.kind==="w4"){const font=await doc.embedFont(StandardFonts.Helvetica);doc.getPages()[0]!.drawText(record.signature.name,{x:101,y:94,size:Math.min(10,330/(record.signature.name.length*.55)),font});doc.getPages()[0]!.drawText(date,{x:466,y:94,size:10,font});}
  else if(record.kind==="cch"){form.getTextField("Applicant Signature").setText(record.signature.name);form.getTextField("Date").setText(date);}
  else {const font=await doc.embedFont(StandardFonts.Helvetica);doc.getPages()[0]!.drawText(`Prepared for HR review ${date} - not filed with Texas`,{x:36,y:10,size:8,font});}
 }
 else { const font=await doc.embedFont(StandardFonts.Helvetica);doc.getPages()[0]!.drawText("DRAFT - NOT SIGNED",{x:36,y:10,size:8,font}); }
 const locked=record.kind==="i9"?["Employers Business or Org Name","Employers Business or Org Address"]:record.kind==="w4"?["topmostSubform[0].Page1[0].f1_12[0]","topmostSubform[0].Page1[0].f1_13[0]","topmostSubform[0].Page1[0].f1_14[0]"]:(schema.employerFields||[]).map(field=>"employer_"+field.key);
 if(record.kind==="cch")locked.push("Date",...(record.signature?["Applicant Name Print","Applicant Signature"]:[]));
 for(const id of locked)form.getField(id).enableReadOnly();
 doc.setModificationDate(new Date(record.updatedAt));return Buffer.from(await doc.save());
}
