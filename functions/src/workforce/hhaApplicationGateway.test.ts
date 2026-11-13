import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {XMLParser} from "fast-xml-parser";
import {parseHhaSoapResponse} from "../integrations/hhaexchange/parser.js";
import {applicantRequest,SoapApplicantGateway,HhaApplicantReadUnavailable} from "./hhaApplicationGateway.js";
import {applicantInput,initialHhaTransfer,HHA_RELATIONSHIPS,HHA_ETHNICITIES,type HhaApplicationConfig} from "./hhaApplicationPolicy.js";
import {syntheticHhaApplication} from "./hhaApplicantSample.js";
import {intakePacket} from "./packet.js";
import {saveIntake,submitIntake} from "./intake.js";
const app=syntheticHhaApplication("synthetic","503324","2027-01-02T12:00:00.000Z");
const job={applicationUid:app.uid,applicationRevision:app.revision,office:app.office,submittedAt:app.submittedAt!,hha:initialHhaTransfer(app.uid,app.office)};
const input=applicantInput(app,job);
const config:HhaApplicationConfig={enabled:true,office:"503324",discipline:"PCA",documentType:"132116",documentLookupId:"36828448",notBefore:"2027-01-01T06:00:00.000Z"};
test("the production request follows the captured ENT WSDL and always explicitly creates an Applicant",()=>{
  const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@",removeNSPrefix:true,parseTagValue:false});
  const wsdl=parser.parse(readFileSync(new URL("../../../hharefs/hha-wdsl.xml",import.meta.url),"utf8"));
  const schemas=[wsdl.definitions.types.schema].flat(),types=schemas.flatMap(s=>[s.complexType].flat());
  const body=parser.parse(applicantRequest(input,job.hha.employeeId,config)).CaregiverInfo;
  function validate(record:any,type:string){
    const expected=[types.find(t=>t?.["@name"]===type).sequence.element].flat();
    const keys=Object.keys(record).filter(k=>!k.startsWith("@"));
    for(const field of expected.filter(f=>f["@minOccurs"]==="1"))assert(keys.includes(field["@name"]),`missing ${type}.${field["@name"]}`);
    let previous=-1;for(const key of keys){const index=expected.findIndex(f=>f["@name"]===key);assert(index>previous,`invalid order/field: ${type}.${key}`);previous=index;if(record[key]?.["@nil"]==="true")assert.equal(expected[index]["@nillable"],"true",`not nullable: ${type}.${key}`);}
  }
  validate(body,"CaregiverDetails");validate(body.Address,"CaregiverAddress");validate(body.NotificationPreferences,"CareteCaregiverNotificationPreferences");
  assert.equal(body.EmployeeType,"Applicant");assert.equal(body.StatusID,"1");assert.equal(body.EmploymentTypes.Discipline,"PCA");
  assert.equal(body.EmployeeID,job.hha.employeeId);assert.equal(body.AlternateCaregiverCode,job.hha.employeeId);
  assert.equal(body.EthnicityID,"7");assert.equal(body.EmergencyContacts.EmergencyContact.RelationshipID,HHA_RELATIONSHIPS.Friend);
  assert(!("HireDate"in body));assert(!("RehireDate"in body)||body.RehireDate["@nil"]==="true");
  const escaped=applicantRequest({...input,firstName:'A <EmployeeType>Employee</EmployeeType> & B'},job.hha.employeeId,config);
  assert.equal(parser.parse(escaped).CaregiverInfo.EmployeeType,"Applicant");
});
test("gender, ethnicity and emergency relationship are required exact HHA choices",()=>{
  for(const id of ["gender","ethnicity","emergencyRelationship"]){const field=intakePacket.fields.find(f=>f.id===id)!;assert(field.required);assert.equal(field.type,"choice");}
  assert.deepEqual(intakePacket.fields.find(f=>f.id==="ethnicity")!.options,Object.keys(HHA_ETHNICITIES));
  assert.deepEqual(intakePacket.fields.find(f=>f.id==="emergencyRelationship")!.options,Object.keys(HHA_RELATIONSHIPS));
  for(const id of ["gender","ethnicity"]){
    const draft=saveIntake(app.uid,null,0,{...app.answers,[id]:""},app.office,false,app.updatedAt);
    assert.throws(()=>submitIntake(app.uid,draft,draft.revision,{name:"Synthetic Applicant",electronicConsent:true,documentRead:true},app.updatedAt),/application_incomplete/);
  }
  assert.throws(()=>saveIntake(app.uid,null,0,{...app.answers,emergencyRelationship:"unmapped relationship"},app.office,false,app.updatedAt),/invalid_answers/);
});
test("only unsigned v7 drafts can upgrade to the new required fields",()=>{
  const draft=saveIntake(app.uid,null,0,app.answers,app.office,false,app.updatedAt);
  const previous={...draft,packetVersion:"pthhs-intake-2026-11-09-v7"};
  const upgraded=saveIntake(app.uid,previous,previous.revision,previous.answers,app.office,false,app.updatedAt);
  assert.equal(upgraded.packetVersion,intakePacket.version);assert.deepEqual(upgraded.answers,draft.answers);assert.equal(upgraded.signature,null);
  assert.throws(()=>saveIntake(app.uid,{...app,packetVersion:previous.packetVersion},app.revision,app.answers,app.office,false,app.updatedAt),/application_already_submitted/);
});
test("searches use the documented AlternateCaregiverCode and SSN filters, never an invented EmployeeID search",async()=>{
  const calls:any[]=[];
  const gateway=new SoapApplicantGateway({call:async(operation,body,attempts)=>{calls.push({operation,body,attempts});return {ok:true,resultXml:"<Caregivers><CaregiverID>101</CaregiverID></Caregivers>"} as any;}});
  assert.deepEqual(await gateway.searchMarker(job.hha.employeeId),["101"]);assert.deepEqual(await gateway.searchSsn(input.ssn),["101"]);
  assert(calls[0].body.includes("<AlternateCaregiverCode>"));assert(!calls[0].body.includes("<EmployeeID>"));
  assert(calls.every(c=>c.attempts===1));
});

for(const httpStatus of [401,403])test(`HTTP ${httpStatus} applicant reads are sanitized terminal denials, not temporary unavailability`,async()=>{
  const calls:any[]=[];
  const gateway=new SoapApplicantGateway({call:async(operation,body,attempts)=>{
    calls.push({operation,body,attempts});
    return {ok:false,httpStatus,retryable:false,retryAfter:"60",error:{kind:"application",message:"synthetic private source detail"}} as any;
  }});
  const reads=[()=>gateway.validate(input,config),()=>gateway.searchMarker(job.hha.employeeId),()=>gateway.searchSsn(input.ssn),
    ()=>gateway.profile("101"),()=>gateway.documents("101"),()=>gateway.download("501","synthetic.pdf")];
  for(const read of reads)await assert.rejects(read,error=>{
    assert(error instanceof Error);assert(!(error instanceof HhaApplicantReadUnavailable));
    assert.equal(error.message,"hha_source_access_denied");assert(!String(error).includes("synthetic private"));return true;
  });
  assert.equal(calls.length,reads.length);assert(calls.every(c=>c.attempts===1));
});
test("temporary applicant read failures retain the existing unavailable path",async()=>{
  for(const httpStatus of [0,408,429,503]){
    const gateway=new SoapApplicantGateway({call:async()=>({ok:false,httpStatus,retryable:false} as any)});
    await assert.rejects(()=>gateway.searchMarker(job.hha.employeeId),HhaApplicantReadUnavailable);
  }
});
test("write failures are not reclassified as read denials or known-not-submitted",async()=>{
  for(const httpStatus of [401,403]){
    const gateway=new SoapApplicantGateway({call:async()=>({ok:false,httpStatus,retryable:false} as any)});
    await assert.rejects(()=>gateway.create(input,job.hha.employeeId,config),/^Error: hha_source_request_unconfirmed$/);
    await assert.rejects(()=>gateway.attach("101",config.documentType,"synthetic.pdf",Buffer.from("%PDF-synthetic")),/^Error: hha_source_request_unconfirmed$/);
  }
});

function inventoryGateway(resultXml:string){
  return new SoapApplicantGateway({call:async(operation,_body,attempts)=>{
    assert.equal(attempts,1);
    const xml=`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operation}Response><${operation}Result>${resultXml}</${operation}Result></${operation}Response></soap:Body></soap:Envelope>`;
    const parsed=parseHhaSoapResponse(operation,200,true,xml);assert.equal(parsed.ok,true);return parsed as any;
  }});
}
test("captured search contract declares optional containers with repeated direct CaregiverID rows",()=>{
  const wsdl=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@",removeNSPrefix:true,parseTagValue:false}).parse(readFileSync(new URL("../../../hharefs/hha-wdsl.xml",import.meta.url),"utf8"));
  const types=[wsdl.definitions.types.schema].flat().flatMap(s=>[s.complexType].flat());
  const response=types.filter(t=>t?.["@name"]==="SearchCaregiversResponse");assert.equal(response.length,1);
  const collection=response[0].complexContent.extension.sequence.element;
  assert.equal(collection["@name"],"Caregivers");assert.equal(collection["@minOccurs"],"0");assert.equal(collection["@maxOccurs"],"1");
  const rows=types.filter(t=>t?.["@name"]===collection["@type"].split(":").at(-1));assert.equal(rows.length,1);
  const row=rows[0].sequence.element;assert.equal(row["@name"],"CaregiverID");assert.equal(row["@type"],"s:int");assert.equal(row["@minOccurs"],"0");assert.equal(row["@maxOccurs"],"unbounded");
});
test("SOAP-normalized singleton and multiple direct caregiver IDs are never mistaken for empty search",async()=>{
  for(const ids of [["101"],["101","202"]]){
    const gateway=inventoryGateway("<Result Status='Success'/><Caregivers>"+ids.map(id=>`<CaregiverID>${id}</CaregiverID>`).join("")+"</Caregivers>");
    assert.deepEqual(await gateway.searchMarker(job.hha.employeeId),ids);assert.deepEqual(await gateway.searchSsn(input.ssn),ids);
  }
});
test("schema-optional omitted and empty caregiver/document inventories remain valid empty results",async()=>{
  for(const empty of ["<Result Status='Success'/>","<Caregivers/>","<Caregivers></Caregivers>"]){
    assert.deepEqual(await inventoryGateway(empty).searchMarker(job.hha.employeeId),[]);
  }
  for(const empty of ["<Result Status='Success'/>","<CaregiverDocuments/>"]){
    assert.deepEqual(await inventoryGateway(empty).documents("101"),[]);
  }
});
test("nonempty unknown caregiver inventories and invalid IDs require review rather than imply no match",async()=>{
  for(const xml of ["<Caregivers><Caregiver><CaregiverID>101</CaregiverID></Caregiver></Caregivers>","<Caregivers>unexpected</Caregivers>",
    "<Caregivers/><Caregivers/>","<UnexpectedCaregivers><CaregiverID>101</CaregiverID></UnexpectedCaregivers>",
    "<Caregivers><CaregiverID>101</CaregiverID><Unknown>202</Unknown></Caregivers>",
    ...["0","-1","abc","2147483648",""] .map(id=>`<Caregivers><CaregiverID>${id}</CaregiverID></Caregivers>`)]){
    await assert.rejects(()=>inventoryGateway(xml).searchMarker(job.hha.employeeId),/^Error: applicant_search_inventory_unverified$/);
  }
});
test("the existing caregiver-match bound applies to direct-ID inventories",async()=>{
  const xml="<Caregivers>"+Array.from({length:11},(_,i)=>`<CaregiverID>${i+1}</CaregiverID>`).join("")+"</Caregivers>";
  await assert.rejects(()=>inventoryGateway(xml).searchMarker(job.hha.employeeId),/^Error: applicant_match_ambiguous$/);
});
