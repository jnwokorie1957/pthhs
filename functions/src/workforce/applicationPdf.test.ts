import test from "node:test";
import assert from "node:assert/strict";
import {PDFDocument} from "pdf-lib";
import sharp from "sharp";
import {renderApplication,renderDocumentPrint,renderPersonnelPacket} from "./applicationPdf.js";
import {saveIntake} from "./intake.js";

test("formal application renders the current answers, unfilled draft and policy record as a private letter-size PDF",async()=>{
 const draft=saveIntake("synthetic",null,0,{firstName:"Synthetic",lastName:"Applicant",ssn:"000-00-1234",birthDate:"2000-01-01"},"synthetic-office",false,"2026-11-06T16:00:00Z");
 const bytes=await renderApplication(draft),pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>=4);assert.equal(pdf.getTitle(),"Private employment application");
 for(const page of pdf.getPages()){assert.equal(page.getWidth(),612);assert.equal(page.getHeight(),792);}
});

test("long and non-WinAnsi answers paginate without losing the ability to generate a print record",async()=>{
 const draft=saveIntake("synthetic",null,0,{firstName:"Example 漢字",job1_duties:"Long synthetic duties. ".repeat(85),convictionDetails:"x".repeat(1900)},"synthetic-office",false,"2026-11-06T16:00:00Z");
 assert.ok((await PDFDocument.load(await renderApplication(draft))).getPageCount()>4);
});

test("private image print conversion preserves proportions and existing PDF pages",async()=>{
 const image=await sharp({create:{width:400,height:250,channels:3,background:"#aabbcc"}}).jpeg().toBuffer();const bytes=await renderDocumentPrint(image),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);assert.equal(pdf.getPages()[0]!.getWidth(),612);
 assert.deepEqual(await renderDocumentPrint(bytes),bytes);
});

test("one print packet includes application and both identity document PDFs with a contents page",async()=>{
 const source=await PDFDocument.create();source.addPage([612,792]);const form=source.getForm(),field=form.createTextField("synthetic");field.addToPage(source.getPages()[0]!);field.setText("Synthetic Applicant");
 const bytes=Buffer.from(await source.save()),packet=await PDFDocument.load(await renderPersonnelPacket([{title:"Application",status:"Draft",bytes},{title:"Form W-4",status:"Not started"},{title:"Photo ID",status:"Available",bytes},{title:"Social Security card",status:"Available",bytes}],"Synthetic Applicant"));
 assert.ok(packet.getPages().every(page=>!page.node.Annots()?.size()));
 assert.equal(packet.getPageCount(),4);assert.equal(packet.getForm().getFields().length,0);assert.equal(packet.getTitle(),"Private caregiver personnel packet");
 // Print flattening leaves the individual source form editable.
 assert.equal((await PDFDocument.load(bytes)).getForm().getFields().length,1);
 await assert.rejects(renderPersonnelPacket(Array.from({length:25},()=>({title:"Document",status:"Pending"}))),/print_packet_too_large/);
});
