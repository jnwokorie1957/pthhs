import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { formSchema,formRecord,renderOfficialForm } from "./eforms.js";
import { chicagoDate, EMPLOYER_NAME } from "./dates.js";
const now="2026-11-06T02:15:00.000Z";
test("dates use Houston calendar day rather than UTC and do not invent historical dates",()=>{
 assert.equal(chicagoDate(now),"2026-11-05");assert.equal(chicagoDate("2026-06-01T03:00:00Z"),"2026-05-31");
});
test("official form schema excludes employer, signatures, translator and reverification fields",async()=>{
 const i9=await formSchema("i9"),w4=await formSchema("w4");
 assert.equal(i9.fields.length,22);assert.ok(!i9.fields.some(f=>/Signature|Employers|Preparer|Rehire/.test(f.id)));
 assert.ok(!w4.fields.some(f=>/f1_1[234]\[/.test(f.id)));assert.ok(w4.fields.some(f=>f.label.includes("Exempt")));
});
test("form drafts allow incomplete progress but reject employee access to employer fields and stale edits",async()=>{
 const schema=await formSchema("i9"),draft=formRecord("synthetic-a","test-office",schema,null,{revision:0,fields:{}},"Synthetic Applicant",false,now);
 assert.equal(draft.state,"draft");assert.equal(draft.signature,null);
 const formatted=formRecord("synthetic-a","test-office",schema,null,{revision:0,fields:{"US Social Security Number":"000-00-1234"}},"Synthetic Applicant",false,now);
 assert.equal(formatted.fields["US Social Security Number"],"000001234");
 assert.throws(()=>formRecord("synthetic-a","test-office",schema,draft,{revision:0,fields:{}},"Synthetic Applicant",false,now),/form_revision_conflict/);
 assert.throws(()=>formRecord("synthetic-a","test-office",schema,null,{revision:0,fields:{"Employers Business or Org Name":"spoof"}},"Synthetic Applicant",false,now),/invalid_form_fields/);
 assert.throws(()=>formRecord("synthetic-b","test-office",schema,draft,{revision:1,fields:{}},"Synthetic Applicant",false,now),/workforce_forbidden/);
 assert.throws(()=>formRecord("synthetic-a","test-office",schema,null,{revision:0,fields:{},submit:true},"Synthetic Applicant",false,now),/i9_offer_required/);
});
test("W-4 signature binds own identity, exact source and values; PDF keeps fields and auto-fills company and local signing date",async()=>{
 const schema=await formSchema("w4"),fields:Record<string,string|boolean>={};
 schema.fields.slice(0,5).forEach((f,i)=>fields[f.id]=["Synthetic","Applicant","100 Test Road","Houston, TX 77000","000-00-0000"][i]!);fields[schema.fields[5]!.id]=true;
 schema.fields.slice(9,12).forEach(f=>fields[f.id]="0");
 const input={revision:0,fields,submit:true,signature:{name:"Synthetic Applicant",electronicConsent:true,formRead:true}};
 assert.throws(()=>formRecord("synthetic-a","test-office",schema,null,{...input,signature:{...input.signature,name:"Other person"}},"Synthetic Applicant",false,now),/signature_required/);
 const signed=formRecord("synthetic-a","test-office",schema,null,input,"Synthetic Applicant",false,now);
 assert.equal(signed.signature?.signedAt,now);assert.equal(signed.signature?.fieldsSha256.length,64);
 const bytes=await renderOfficialForm(signed),pdf=await PDFDocument.load(bytes),form=pdf.getForm();
 assert.equal(pdf.getPageCount(),5);assert.equal(form.getTextField(schema.fields[0]!.id).getText(),"Synthetic");
 assert.ok(form.getTextField("topmostSubform[0].Page1[0].f1_12[0]").getText()?.includes(EMPLOYER_NAME));
 for(const id of ["topmostSubform[0].Page1[0].f1_12[0]","topmostSubform[0].Page1[0].f1_13[0]","topmostSubform[0].Page1[0].f1_14[0]"])assert.equal(form.getField(id).isReadOnly(),true);
 assert.equal(form.getField(schema.fields[0]!.id).isReadOnly(),false);
 assert.throws(()=>formRecord("synthetic-a","test-office",schema,signed,{revision:1,fields},"Synthetic Applicant",false,now),/form_already_submitted/);
});

test("Texas new-hire employee information stays separate from employer hire/pay fields and produces the complete report",async()=>{
 const schema=await formSchema("new_hire"),fields={employeeSSN:"000-00-0000",firstName:"Synthetic",middleName:"N/A",lastName:"Applicant",address:"100 Test Road",city:"Houston",state:"TX",zip:"77000"};
 assert.throws(()=>formRecord("synthetic-a","test-office",schema,null,{revision:0,fields:{...fields,employer_ein:"spoof"}},"Synthetic Applicant",false,now),/invalid_form_fields/);
 const record=formRecord("synthetic-a","test-office",schema,null,{revision:0,fields,submit:true,signature:{name:"Synthetic Applicant",electronicConsent:true,formRead:true}},"Synthetic Applicant",false,now);
 const pdf=await PDFDocument.load(await renderOfficialForm(record,{ein:"00-0000000"}));
 assert.equal(pdf.getPageCount(),2);assert.equal(pdf.getForm().getTextField("firstName").getText(),"Synthetic");assert.equal(pdf.getForm().getTextField("employer_ein").getText(),"00-0000000");
 assert.ok(!pdf.getForm().getTextField("employer_firstDay").getText());
 for(const f of schema.employerFields||[])assert.equal(pdf.getForm().getField("employer_"+f.key).isReadOnly(),true);
});
test("I-9 employee signing requires accepted offer and one valid status; employer attestation stays blank",async()=>{
 const schema=await formSchema("i9");const fields={"Last Name (Family Name)":"Applicant","First Name Given Name":"Synthetic","Address Street Number and Name":"100 Test Road","City or Town":"Houston",State:"TX","ZIP Code":"77000","Date of Birth mmddyyyy":"01/01/2000",CB_1:true};
 const input={revision:0,fields,submit:true,signature:{name:"Synthetic Applicant",electronicConsent:true,formRead:true}};
 assert.throws(()=>formRecord("synthetic-a","test-office",schema,null,{...input,fields:{...fields,CB_2:true}},"Synthetic Applicant",true,now),/form_incomplete/);
 const signed=formRecord("synthetic-a","test-office",schema,null,input,"Synthetic Applicant",true,now),pdf=await PDFDocument.load(await renderOfficialForm(signed));
 assert.equal(pdf.getPageCount(),4);assert.equal(pdf.getForm().getTextField("Signature of Employee").getText(),"Synthetic Applicant");
 assert.equal(pdf.getForm().getTextField("Today's Date mmddyyy").getText(),"11/05/2026");assert.equal(pdf.getForm().getTextField("Employers Business or Org Name").getText(),EMPLOYER_NAME);
 assert.ok(!pdf.getForm().getTextField("Signature of Employer or AR").getText());
 for(const id of ["Employers Business or Org Name","Employers Business or Org Address"])assert.equal(pdf.getForm().getField(id).isReadOnly(),true);
});

test("DPS CCH captures the applicant name, signature and Houston date only", async () => {
 const schema = await formSchema("cch"), name = "Synthetic Applicant";
 const input = {revision: 0, fields: {"Applicant Name Print": name}, submit: true,
   signature: {name, electronicConsent: true, formRead: true}};
 const at = "2026-11-10T02:15:00.000Z";
 assert.throws(() => formRecord("test-user", "test-office", schema, null,
   {...input, fields: {...input.fields, Date: "01/01/2000"}}, name, false, at), /invalid_form_fields/);
 assert.throws(() => formRecord("test-user", "test-office", schema, null,
   {...input, fields: {"Applicant Name Print": "Someone Else"}}, name, false, at), /signature_required/);
 assert.throws(() => formRecord("test-user", "test-office", schema, null,
   {...input, signature: {...input.signature, name: ""}}, name, false, at), /signature_required/);
 const record = formRecord("test-user", "test-office", schema, null, input, name, false, at);
 const form = (await PDFDocument.load(await renderOfficialForm(record))).getForm();
 assert.deepEqual(form.getFields().map(f => f.getName()).sort(),
   ["Applicant Name Print", "Applicant Signature", "Date", "employer_name"]);
 assert.equal(form.getTextField("Applicant Name Print").getText(), name);
 assert.equal(form.getTextField("Applicant Signature").getText(), name);
 assert.equal(form.getTextField("Date").getText(), "11/09/2026");
 assert.equal(form.getTextField("employer_name").getText(), "PRIMETIME HOME HEALTH SERVICES, INC.");
 assert.ok(form.getFields().every(f => f.isReadOnly()));
});
