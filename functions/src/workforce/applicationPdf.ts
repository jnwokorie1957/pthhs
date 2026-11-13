import { PDFDocument, PDFName, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import type { Intake } from "./intake.js";
import { intakePacket } from "./packet.js";
import { EMPLOYER_NAME, EMPLOYER_ADDRESS } from "./dates.js";
import {WorkforceError} from "./policy.js";

// A clean, private print edition of the owner's application, with current portal
// fields. Never fabricate missing answers, signatures or employer attestations.
export async function renderApplication(application: Intake): Promise<Buffer> {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const recordedDate=new Date(application.submittedAt || application.updatedAt);
  pdf.setCreationDate(recordedDate);pdf.setModificationDate(recordedDate);
  const ink = rgb(.09,.2,.21), gray = rgb(.35,.39,.4), rule = rgb(.78,.82,.82), pale = rgb(.93,.96,.95);
  const safe = (value: string) => [...value.replace(/[\r\n\t]/g," ")].map(char => {try {font.encodeText(char);return char;} catch {return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`;}}).join("");
  let page: PDFPage, y = 0;
  function lines(value: string, width: number, size = 10) {
    const output: string[] = [];let line = "";
    for (const word of safe(value).split(/\s+/)) {
      if (line && font.widthOfTextAtSize(line+" "+word,size)>width){output.push(line);line="";}
      for(const char of word){if(font.widthOfTextAtSize(line+char,size)>width){output.push(line);line="";}line+=char;}
      line+=" ";
    }
    if(line.trim())output.push(line.trim());return output.length?output:[""];
  }
  function text(value: string, x: number, at: number, size = 10, strong = false) {page.drawText(safe(value),{x,y:at,size,font:strong?bold:font,color:ink});}
  function next(title: string) {
    page=pdf.addPage([612,792]);y=682;
    page.drawRectangle({x:36,y:718,width:540,height:38,color:ink});page.drawText(safe(EMPLOYER_NAME),{x:48,y:733,size:12,font:bold,color:rgb(1,1,1)});
    text(EMPLOYER_ADDRESS.replace(/\n/g,", "),36,704,9);text(title,36,y,16,true);y-=25;
  }
  function ensure(height: number) {if(y-height<58)next("Employment application - continued");}
  function paragraph(value: string) {for(const line of lines(value,540)){ensure(14);text(line,36,y);y-=14;}y-=8;}
  function section(title: string) {ensure(80);page.drawRectangle({x:36,y:y-7,width:540,height:24,color:pale});text(title.toUpperCase(),44,y,10,true);y-=30;}
  function row(entries: [string,string][]) {
    const width=540/entries.length, wrapped=entries.map(([,value])=>lines(value||"Not entered",width-16));
    const height=24+Math.max(...wrapped.map(value=>value.length))*13;ensure(height);
    entries.forEach(([label],i)=>{const x=36+i*width;text(label,x+6,y,8,true);wrapped[i]!.forEach((value,j)=>text(value,x+6,y-16-j*13,10));page.drawLine({start:{x,y:y-height+7},end:{x:x+width-5,y:y-height+7},thickness:.5,color:rule});});y-=height;
  }
  const a=application.answers, value=(id:string)=>a[id]||"", fullName=[a.firstName,a.lastName].filter(Boolean).join(" ");
  next("Employment Application");paragraph("Equal Opportunity Employer");paragraph(intakePacket.notice);
  section("Contact information");
  row([["First name",value("firstName")],["Last name",value("lastName")],["Application date",value("applicationDate")]]);
  row([["Social Security number (last four)",a.ssn?"***-**-"+a.ssn.replace(/\D/g,"").slice(-4):""],["Date of birth",value("birthDate")]]);
  row([["Gender",value("gender")],["Ethnicity",value("ethnicity")]]);
  row([["Street address",value("street")],["Apartment / unit / suite",value("unit")]]);
  row([["City",value("city")],["State",value("state")],["ZIP code",value("zip")]]);
  row([["Phone number",value("phone")],["Alternate phone",value("alternatePhone")]]);row([["Email address",value("email")]]);
  section("Emergency contact");row([["Name",value("emergencyName")],["Relationship",value("emergencyRelationship")],["Phone",value("emergencyPhone")]]);
  section("Availability and eligibility");row([["Preferred start date",value("availableDate")],["Full time / part time",value("workTime")],["Preferred weekly hours",value("weeklyHours")]]);
  row([["Eligible to work in the U.S.?",value("eligibleToWork")],["Visa type (if applicable)",value("visaType")]]);
  row([["Conviction response",value("conviction")]]);paragraph(intakePacket.convictionNotice);if(a.convictionDetails)row([["Details supplied by applicant",a.convictionDetails]]);
  next("Education and Work Experience");
  section("Education");
  row([["High school - name and location",value("highSchool_school")],["Date of completion",value("highSchool_completed")]]);
  row([["College - name and location",value("college_school")],["Major",value("college_major")]]);
  row([["Degree obtained",value("college_degree")],["Date of completion",value("college_completed")]]);
  row([["Technical training - name and location",value("technical_school")],["Date of completion",value("technical_completed")]]);
  section("Work experience");
  for(const keys of [["from","to"],["employer"],["position","department"],["supervisor","supervisorPhone"],["startingPay","endingPay"],["reason"],["duties"]])row(keys.map(key=>{const f=intakePacket.fields.find(f=>f.id==="job1_"+key)!;return[f.label,value(f.id)];}));
  next("Past Employment Reference and Release");section("Reference information");row([["Employee name",fullName],["Social Security number (last four)",a.ssn?"***-**-"+a.ssn.replace(/\D/g,"").slice(-4):""]]);
  for(const keys of [["referenceCompany","referenceSupervisor"],["referenceAddress"],["referenceCityStateZip"],["referencePhone","referenceDates"]])row(keys.map(id=>[intakePacket.fields.find(f=>f.id===id)!.label,value(id)]));
  section("Applicant release");paragraph(intakePacket.referenceRelease.text);
  row([["Electronic signature",application.signature?.name||"Not signed"],["Signed at",application.signature?.signedAt||"Not signed"]]);
  paragraph(application.signature?"Electronic consent and the signed answer revision are retained with the application record.":"Draft application. No applicant signature has been recorded.");
  section("Application record");row([["Status",application.state],["Revision",String(application.revision)],["Last updated",application.updatedAt]]);row([["Packet version",application.packetVersion]]);
  next("Policy and Role Acknowledgments");
  paragraph("This record lists the applicant's saved responses. The health insurance entry records the applicant coverage choice. Screening, training, and employer approvals are handled separately.");
  row([["PAS attendant job description",a.jobDescriptionRead==="Yes"?"Read and agreed":"Not acknowledged"],["Recorded at",application.roleAcknowledgment?.readAt||"Not submitted"]]);if(a.jobDescriptionQuestions)row([["Applicant questions",a.jobDescriptionQuestions]]);
  for(const reading of intakePacket.readings){section(reading.title);paragraph("Reading: "+(a[`read_page_${reading.page}`]||"Not acknowledged")+(reading.election?"   |   Coverage election: ":"   |   Agreement: ")+(a[`terms_page_${reading.page}`]||(reading.election?"Not selected":"Not applicable")));}
  pdf.getPages().forEach((p,index)=>{p.drawText(`CONFIDENTIAL PERSONNEL RECORD  |  ${application.state.toUpperCase()}  |  Page ${index+1} of ${pdf.getPageCount()}`,{x:36,y:30,size:8,font,color:gray});});
  pdf.setTitle("Private employment application");pdf.setAuthor(EMPLOYER_NAME);return Buffer.from(await pdf.save());
}

export async function renderDocumentPrint(bytes: Buffer): Promise<Buffer> {
  if(bytes.subarray(0,5).toString("ascii")==="%PDF-")return bytes;
  const pdf=await PDFDocument.create(),image=await pdf.embedJpg(bytes),page=pdf.addPage([612,792]);
  const scale=Math.min(540/image.width,700/image.height);
  page.drawImage(image,{x:(612-image.width*scale)/2,y:(792-image.height*scale)/2,width:image.width*scale,height:image.height*scale});
  pdf.setTitle("Private personnel document");return Buffer.from(await pdf.save());
}

export interface PacketPart {title:string;status:string;bytes?:Buffer}
export async function renderPersonnelPacket(parts:PacketPart[],applicant=""):Promise<Buffer>{
  if(parts.reduce((sum,part)=>sum+(part.bytes?.length||0),0)>20_000_000||parts.length>24)throw new WorkforceError(413,"print_packet_too_large");
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),ink=rgb(.09,.2,.21);
  let cover=pdf.addPage([612,792]),y=684;
  const heading=()=>{cover.drawText("PRIMETIME HOME HEALTH SERVICES, INC.",{x:36,y:748,size:12,font:bold,color:ink});cover.drawText("Caregiver Personnel Packet",{x:36,y:718,size:18,font:bold,color:ink});};heading();
  cover.drawText("Private print copy. Drafts and unavailable documents are identified below.",{x:36,y,size:10,font,color:ink});y-=32;
  if(applicant){
    let line="";for(const character of "Applicant: "+applicant){let safe=character;try{font.encodeText(safe);}catch{safe=`[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`;}
      if(font.widthOfTextAtSize(line+safe,10)>540){cover.drawText(line,{x:36,y,size:10,font,color:ink});y-=14;line="";}line+=safe;}
    if(line){cover.drawText(line,{x:36,y,size:10,font,color:ink});y-=26;}
  }
  const records:{part:PacketPart;source:PDFDocument|null}[]=[];
  for(const part of parts){
    const source=part.bytes?await PDFDocument.load(part.bytes):null;
    if(source){
      const form=source.getForm();
      if(form.getFields().length)form.flatten();
      // The print copy keeps the painted values without interactive annotations.
      for(const page of source.getPages())page.node.delete(PDFName.of("Annots"));
    }
    records.push({part,source});
  }
  const inventoryPages=Math.max(1,Math.ceil(parts.length/8));
  for(let i=1;i<inventoryPages;i++)pdf.addPage([612,792]);
  let nextPage=inventoryPages+1;
  for(let i=0;i<records.length;i++){
    const {part,source}=records[i]!;
    if(i&&i%8===0){cover=pdf.getPages()[Math.floor(i/8)]!;y=684;heading();}
    const count=source?.getPageCount()||0,range=count?(count===1?String(nextPage):`${nextPage}-${nextPage+count-1}`):"Not included";
    cover.drawText(part.title,{x:36,y,size:11,font:bold,color:ink});y-=17;
    cover.drawText(part.status.replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase()).slice(0,90),{x:36,y,size:9,font,color:ink});cover.drawText("Pages: "+range,{x:462,y:y+17,size:9,font,color:ink});y-=45;
    if(source){if(nextPage+count>120)throw new WorkforceError(413,"print_packet_too_large");const pages=await pdf.copyPages(source,source.getPageIndices());for(const page of pages)pdf.addPage(page);nextPage+=count;}
  }
  for(let i=0;i<inventoryPages;i++)pdf.getPages()[i]!.drawText("CONFIDENTIAL PERSONNEL RECORD - Keep printed copies secure",{x:36,y:30,size:8,font,color:ink});
  pdf.setTitle("Private caregiver personnel packet");pdf.setAuthor(EMPLOYER_NAME);return Buffer.from(await pdf.save());
}
