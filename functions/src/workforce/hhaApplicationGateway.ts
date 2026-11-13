import {XMLParser} from "fast-xml-parser";
import {createHash} from "node:crypto";
import type {HhaSoapClient} from "../integrations/hhaexchange/client.js";
import type {ApplicantInput,HhaApplicationConfig} from "./hhaApplicationPolicy.js";
import {identifier} from "../operations/reads.js";

export interface ApplicantProfile {id:string; employeeId:string; alternateCode:string; employeeType:string; offices:string[]; firstName:string; lastName:string; birthDate:string; gender:string; ethnicityId:string; email:string}
export interface ApplicantDocument {id:string;caregiverId:string;typeId:string;filename:string}
export interface ApplicantGateway {
  validate(input:ApplicantInput,config:HhaApplicationConfig):Promise<void>;
  searchMarker(marker:string):Promise<string[]>;
  searchSsn(ssn:string):Promise<string[]>;
  create(input:ApplicantInput,marker:string,config:HhaApplicationConfig):Promise<string>;
  profile(id:string):Promise<ApplicantProfile>;
  documents(id:string):Promise<ApplicantDocument[]>;
  attach(id:string,typeId:string,filename:string,bytes:Buffer):Promise<string>;
  download(id:string,filename:string):Promise<Buffer>;
}
export class HhaApplicantReadUnavailable extends Error {constructor(){super("hha_applicant_source_unavailable");}}
const list=(value:any):any[]=>value===undefined?[]:Array.isArray(value)?value:[value];
const scalar=(value:unknown):string=>typeof value==="string"?value:typeof value==="number"?String(value):"";
export const xmlTag=(name:string,value:string)=>`<${name}>${value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;")}</${name}>`;
const nil=(name:string)=>`<${name} xsi:nil="true"/>`;
export function applicantRequest(a:ApplicantInput,marker:string,config:HhaApplicationConfig) {
  if(!/^PTA-[a-f0-9]{28}$/.test(marker)||config.discipline!=="PCA")throw Error("invalid_applicant_destination");
  const tag=xmlTag;
  // Captured ENT WSDL CaregiverDetails sequence, including required nullable
  // values. Never set employment/hire dates, payroll fields or worker credentials.
  return "<CaregiverInfo>"+tag("OfficeID",identifier(config.office))+tag("FirstName",a.firstName)+tag("LastName",a.lastName)
    +tag("Gender",a.gender)+tag("BirthDate",a.birthDate+"T00:00:00")+nil("CaregiverCode")+tag("AlternateCaregiverCode",marker)+nil("MobileID")
    +tag("SSN",a.ssn)+tag("EthnicityID",identifier(a.ethnicityId))+nil("RehireDate")+tag("StatusID","1")
    +"<EmploymentTypes>"+tag("Discipline","PCA")+"</EmploymentTypes>"+tag("EmployeeID",marker)+tag("ApplicationDate",a.applicationDate+"T00:00:00")
    +nil("TeamID")+nil("BranchID")+nil("LocationID")+nil("HHAPCARegistryCheckedDate")+nil("NYCRegistryCheckedDate")+nil("ReferralSourceID")
    +"<Address>"+tag("Street1",a.street)+tag("Street2",a.unit)+tag("City",a.city)+tag("State",a.state)+tag("Zip5",a.zip)+nil("Zip4")+tag("HomePhone",a.phone)+tag("Phone2",a.alternatePhone)+"</Address>"
    +"<EmergencyContacts><EmergencyContact>"+tag("Name",a.emergencyName)+tag("RelationshipID",identifier(a.emergencyRelationshipId))+tag("Phone1",a.emergencyPhone)+"</EmergencyContact></EmergencyContacts>"
    +"<NotificationPreferences>"+nil("MethodID")+tag("Email",a.email)+"</NotificationPreferences>"+nil("Language1")+nil("Language2")+nil("Language3")+nil("Language4")
    +tag("EmployeeType","Applicant")+nil("InactiveReason")+nil("SignedPayrollAgreementDate")+"</CaregiverInfo>";
}
export class SoapApplicantGateway implements ApplicantGateway {
  constructor(private client:Pick<HhaSoapClient,"call">){}
  private async call(operation:string,body:string){
    const r=await this.client.call(operation,body,1);
    if(!r.ok&&!['CreateCaregiver','AddCaregiverDocument'].includes(operation))throw new HhaApplicantReadUnavailable();
    if(!r.ok||!r.resultXml||/<!DOCTYPE|<!ENTITY/i.test(r.resultXml))throw Error("hha_source_request_unconfirmed");
    return new XMLParser({removeNSPrefix:true,ignoreAttributes:true,parseTagValue:false,trimValues:true}).parse("<Root>"+r.resultXml+"</Root>").Root;
  }
  async validate(a:ApplicantInput,c:HhaApplicationConfig){
    const d=await this.call("GetDisciplines","");
    if(list(d.Disciplines?.DisciplineInfo).filter(r=>r.DisciplineName===c.discipline&&r.DisciplineType==="Non Skilled").length!==1)throw Error("hha_discipline_changed");
    const g=await this.call("GetCaregiverGender","<Status>Active</Status>");
    if(list(g.CaregiverGender).filter(r=>r.GenderName===a.gender&&r.Status==="Active").length!==1)throw Error("hha_gender_changed");
    const e=await this.call("GetEthnicity","");
    if(list(e.Ethnicitys?.Ethnicity).filter(r=>r.EthnicityID===a.ethnicityId&&r.EthnicityName===a.ethnicity).length!==1)throw Error("hha_ethnicity_changed");
    const r=await this.call("GetEmergencyContactRelationships","");
    if(list(r.EmergencyContactRelationships?.EmergencyContactRelationship).filter(r=>r.EmergencyContactRelationshipID===a.emergencyRelationshipId&&r.EmergencyContactRelationshipName===a.emergencyRelationship).length!==1)throw Error("hha_relationship_changed");
    const t=await this.call("GetCaregiverDocumentType","<Status>Active</Status>"+xmlTag("CaregiverDocID",identifier(c.documentLookupId)));
    if(list(t.CaregiverDocumentTypes?.DocumentType).filter(r=>r.CaregiverDocumentTypeID===c.documentType&&r.Status==="Active"&&/\b(?:employment|caregiver)?\s*application\b/i.test(r.CaregiverDocumentType||"")).length!==1)throw Error("hha_application_document_type_unverified");
  }
  private async search(body:string){
    const result=await this.call("SearchCaregivers","<SearchFilters>"+body+"</SearchFilters>");
    const rows=list(result.Caregivers?.Caregiver);
    if(rows.length>10)throw Error("applicant_match_ambiguous");
    return rows.map(r=>identifier(r.CaregiverID||r.ID));
  }
  searchMarker(marker:string){return this.search(xmlTag("AlternateCaregiverCode",marker));}
  searchSsn(ssn:string){return this.search(xmlTag("SSN",ssn));}
  async create(a:ApplicantInput,marker:string,c:HhaApplicationConfig){
    const r=await this.call("CreateCaregiver",applicantRequest(a,marker,c));
    const rows=list(r.CaregiverInfo);if(rows.length!==1)throw Error("applicant_creation_unconfirmed");return identifier(rows[0].CaregiverID);
  }
  async profile(id:string):Promise<ApplicantProfile>{
    const r=await this.call("GetCaregiverDemographics","<CaregiverInfo>"+xmlTag("ID",identifier(id))+"</CaregiverInfo>");
    const rows=list(r.CaregiverInfo);if(rows.length!==1)throw Error("applicant_profile_unverified");const p=rows[0];
    return {id:identifier(p.ID),employeeId:scalar(p.EmployeeID),alternateCode:scalar(p.AlternateCaregiverCode),employeeType:scalar(p.EmployeeType),
      offices:list(p.CaregiverOffices?.Office).map(o=>identifier(o.OfficeID)),firstName:scalar(p.FirstName),lastName:scalar(p.LastName),
      birthDate:scalar(p.BirthDate).slice(0,10),gender:scalar(p.Gender),ethnicityId:scalar(p.Ethnicity?.ID),email:scalar(p.NotificationPreferences?.Email)};
  }
  async documents(id:string){
    const r=await this.call("SearchCaregiverDocument","<SearchFilters>"+xmlTag("CaregiverID",identifier(id))+nil("CaregiverDocumentTypeID")+nil("CaregiverDocumentID")+nil("FromDate")+nil("ToDate")+"</SearchFilters>");
    const rows=list(r.CaregiverDocuments?.CaregiverDocument);if(rows.length>1000)throw Error("application_document_inventory_incomplete");
    return rows.map(d=>({id:identifier(d.CaregiverDocID),caregiverId:identifier(d.CaregiverID),typeId:identifier(d.CaregiverDocumentTypeID),filename:scalar(d.FileName)}));
  }
  async attach(id:string,typeId:string,filename:string,bytes:Buffer){
    if(bytes.length>2_000_000||bytes.subarray(0,5).toString()!=="%PDF-")throw Error("application_pdf_invalid");
    const r=await this.call("AddCaregiverDocument","<CaregiverDocumentInfo>"+xmlTag("CaregiverID",identifier(id))+xmlTag("CaregiverDocumentTypeID",identifier(typeId))
      +xmlTag("Description","Signed employment application")+xmlTag("FileName",filename)+xmlTag("StreamData",bytes.toString("base64"))+"</CaregiverDocumentInfo>");
    if(scalar(r.CaregiverID)!==id)throw Error("application_attachment_unconfirmed");return identifier(r.CaregiverDocID);
  }
  async download(id:string,filename:string){
    const r=await this.call("DownloadCaregiverDocument",xmlTag("CaregiverDocID",identifier(id)));
    const rows=list(r.CaregiverDocument);if(rows.length!==1||scalar(rows[0].CaregiverDocID)!==id||scalar(rows[0].FileName)!==filename)throw Error("application_pdf_readback_mismatch");
    const base64=scalar(rows[0].StreamData);if(base64.length>2_800_000||!base64||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error("application_pdf_readback_mismatch");
    return Buffer.from(base64,"base64");
  }
}
export function verifyApplicant(profile:ApplicantProfile,id:string,a:ApplicantInput,marker:string,office:string){
  const same=(l:string,r:string)=>l.normalize("NFC").trim().toLowerCase()===r.normalize("NFC").trim().toLowerCase();
  if(profile.id!==id||profile.employeeId!==marker||profile.alternateCode!==marker||profile.employeeType.toLowerCase()!=="applicant"
    ||profile.offices.length!==1||profile.offices[0]!==office||!same(profile.firstName,a.firstName)||!same(profile.lastName,a.lastName)
    ||profile.birthDate!==a.birthDate||!same(profile.email,a.email)||!same(profile.gender,a.gender)||profile.ethnicityId!==a.ethnicityId)throw Error("applicant_identity_unverified");
}
export const pdfDigest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
