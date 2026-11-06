import test from "node:test";
import assert from "node:assert/strict";
import {operationalRead} from "../operations/reads.js";
import type {HhaSoapClient} from "../integrations/hhaexchange/client.js";
import {HhaProfileSource} from "./hhaSource.js";
const profile=(email="<Email>legacy@example.invalid</Email>")=>`<CaregiverInfo><ID>101</ID><FirstName>Hannah</FirstName><LastName>Hart</LastName><CaregiverCode>501</CaregiverCode><NotificationPreferences>${email}</NotificationPreferences><Address><Street1>100 Demo Street</Street1><HomePhone>7135550100</HomePhone></Address><CaregiverOffices><Office><OfficeID>12</OfficeID></Office></CaregiverOffices></CaregiverInfo>`;
const client=(xml:string)=>({call:async()=>({ok:true,resultXml:xml,status:"Success"})}) as unknown as Pick<HhaSoapClient,"call">;
test("contact email is exposed only in the protected profile projection and ambiguous email fields fail closed",async()=>{
 const standard=await operationalRead(client(profile()),{operation:"GetCaregiverDemographics",id:"101"});assert.equal(standard.records[0]!["NotificationPreferences/Email"],undefined);
 const scoped=await operationalRead(client(profile()),{operation:"GetCaregiverDemographics",id:"101"},"workforce_caregiver_profile");assert.equal(scoped.records[0]!["NotificationPreferences/Email"],"legacy@example.invalid");assert.equal(scoped.records[0]!["Address/Street1"],"100 Demo Street");
 for(const email of ["<Email>a@example.invalid</Email><Email>b@example.invalid</Email>","<Other><Email>a@example.invalid</Email></Other>"]){assert.equal((await operationalRead(client(profile(email)),{operation:"GetCaregiverDemographics",id:"101"},"workforce_caregiver_profile")).records[0]!["NotificationPreferences/Email"],null);}
});
test("caregiver-file metadata requires direct source ownership rather than a nested borrowed caregiver ID",async()=>{
 const xml=(identity:string)=>`<CaregiverDocuments><CaregiverDocument><CaregiverDocID>501</CaregiverDocID>${identity}<FileName>Demo.pdf</FileName><FileSize>4</FileSize></CaregiverDocument></CaregiverDocuments>`;
 const request={operation:"SearchCaregiverDocument" as const,caregiverId:"101"};assert.equal((await operationalRead(client(xml("<CaregiverID>101</CaregiverID>")),request,"workforce_caregiver_profile")).records.length,1);
 for(const identity of ["<CaregiverID>102</CaregiverID>","<Other><CaregiverID>101</CaregiverID></Other>","<CaregiverID>101</CaregiverID><CaregiverID>101</CaregiverID>"]){await assert.rejects(operationalRead(client(xml(identity)),request,"workforce_caregiver_profile"),/caregiver_document_owner_unverified/);}
});
test("source profile checks its fixed office and document downloads must remain in that caregiver's file list",async()=>{
 const workspace={settings:async()=>({dataApproved:true,settings:{officeId:"12",revision:1}}),query:async(input:{operation:string})=>input.operation==="GetCaregiverDemographics"?await operationalRead(client(profile()),{operation:"GetCaregiverDemographics",id:"101"},"workforce_caregiver_profile"):{operation:"SearchCaregiverDocument",source:"hhaexchange",fetchedAt:"2026-11-06",records:[],truncated:false}};
 const source=new HhaProfileSource(workspace as unknown as ConstructorParameters<typeof HhaProfileSource>[0],"verified-user","12");assert.equal((await source.profile("101")).email,"legacy@example.invalid");await assert.rejects(source.download("101","999"),/document_not_found/);
});
