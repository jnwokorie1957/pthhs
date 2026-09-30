"""Check compiled, allowlisted read serializers against the captured XSD contract.

Run after `npm --prefix functions run build`. No network or source records used.
"""
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {"s": "http://www.w3.org/2001/XMLSchema", "w": "http://schemas.xmlsoap.org/wsdl/"}
XSI = "{http://www.w3.org/2001/XMLSchema-instance}nil"
schema = ET.parse(ROOT / "hharefs/hha-wdsl.xml").getroot().find("w:types/s:schema", NS)
module = (ROOT / "functions/lib/operations/reads.js").as_uri()
write_module = (ROOT / "functions/lib/operations/writes.js").as_uri()
availability_module = (ROOT / "functions/lib/operations/availability.js").as_uri()
document_module = (ROOT / "functions/lib/operations/documentTypes.js").as_uri()
topic_module = (ROOT / "functions/lib/operations/topics.js").as_uri()
creation_module = (ROOT / "functions/lib/operations/rateCreations.js").as_uri()
contract_module = (ROOT / "functions/lib/operations/patientContracts.js").as_uri()
availability_creation_module = (ROOT / "functions/lib/operations/availabilityCreations.js").as_uri()
patient_note_module = (ROOT / "functions/lib/operations/patientNotes.js").as_uri()
document_metadata_module = (ROOT / "functions/lib/operations/documentMetadata.js").as_uri()
clinical_module = (ROOT / "functions/lib/operations/patientClinical.js").as_uri()
medical_module = (ROOT / "functions/lib/operations/medicalCreations.js").as_uri()
replacement_module = (ROOT / "functions/lib/operations/documentReplacements.js").as_uri()
document_creation_module = (ROOT / "functions/lib/operations/documentCreations.js").as_uri()
picture_module = (ROOT / "functions/lib/operations/caregiverPictures.js").as_uri()
contract_creation_module = (ROOT / "functions/lib/operations/contractCreations.js").as_uri()
referral_creation_module = (ROOT / "functions/lib/operations/referralCreations.js").as_uri()
collection_module = (ROOT / "functions/lib/operations/collectionNotes.js").as_uri()
linked_module = (ROOT / "functions/lib/operations/linkedScheduleCreations.js").as_uri()
source = "import {createLinkedScheduleRequest} from " + json.dumps(linked_module) + "; import {collectionNoteRequest} from " + json.dumps(collection_module) + "; import {createReferralRequest} from " + json.dumps(referral_creation_module) + "; import {createContractRequest} from " + json.dumps(contract_creation_module) + "; import {caregiverPictureRequest,pictureFile} from " + json.dumps(picture_module) + "; import {documentCreationRequest} from " + json.dumps(document_creation_module) + "; import {documentReplacementRequest,replacementFile} from " + json.dumps(replacement_module) + "; import {createMedicalRequest} from " + json.dumps(medical_module) + "; import {patientClinicalRequest} from " + json.dumps(clinical_module) + "; import {createHash} from 'node:crypto'; import {documentMetadataRequest} from " + json.dumps(document_metadata_module) + "; import {patientNoteRequest} from " + json.dumps(patient_note_module) + "; import {availabilityCreationRequest,AVAILABILITY_CREATIONS} from " + json.dumps(availability_creation_module) + "; import {patientContractRequest} from " + json.dumps(contract_module) + "; import {createRateRequest} from " + json.dumps(creation_module) + "; import {topicRequest} from " + json.dumps(topic_module) + "; import {documentTypeRequest} from " + json.dumps(document_module) + "; import {READ_OPERATIONS,readRequest} from " + json.dumps(module) + "; import {rateWriteRequest} from " + json.dumps(write_module) + "; import {AVAILABILITY_WRITES,availabilityRequest} from " + json.dumps(availability_module) + """;
const rows = READ_OPERATIONS.map(operation=>({operation,body:readRequest({operation,id:'77',patientId:'88',officeId:'123',referralStatusId:'1',referralSourceId:'2',salesStaffId:'3',date:'2026-09-30',term:'Synthetic',status:operation.includes('Compliance')||operation==='GetCaregiverMedicalDetails'?'Pending':'Active',caregiverId:'7',complianceType:'Medical',sequence:'0',appliesTo:'Patient',caregiverStatus:'1',contractId:'99',modifiedAfter:'2026-09-30T00:00:00',modifiedAfterUtc:'2026-09-30T00:00:00Z',lastId:'0',phone:'5555550123',page:'1'})}));
rows.push({operation:'UpdateCaregiverRate',body:rateWriteRequest({CaregiverRateID:'7',CaregiverID:'9',PatientID:null,FromDate:'2026-09-01',ToDate:'2026-12-31',DailyRate:'0',VisitRate:null,Status:'Active'},'16.25')});
rows.push({operation:'UpdateDocumentType',body:documentTypeRequest({UserRole:'Patient',DocumentTypeID:'7',DocumentType:'Synthetic',Description:'Preserved',Status:'Active'})});
rows.push({operation:'CreateInserviceTopics',body:topicRequest({Topic:'Synthetic',OfficeID:'123',Status:'Active',CountTowardsCompliance:'No'})});
rows.push({operation:'AddCaregiverRate',body:createRateRequest({CaregiverID:'9',Discipline:'3',PayCodeID:'4',PatientID:null,FromDate:'2026-10-01',ToDate:'2026-12-31',HourlyRate:'16.25',DailyRate:'0',VisitRate:null,Status:'Active'})});
rows.push({operation:'UpdatePatientContract',body:patientContractRequest({PatientID:'8',PlacementID:'9',AltPatientID:'Synthetic',IsPrimaryContract:'Y'})});
rows.push({operation:'CreateCaregiverMedical',body:createMedicalRequest({CaregiverID:'9',MedicalID:'7',DueDate:'2026-12-01',DateCompleted:null,Result:null,Notes:'',DocumentName:null})});
rows.push({operation:'UpdatePatientClinicalInfo',body:patientClinicalRequest({PatientID:'8',Comments:'Reviewed',Allergies:'Preserved',NursingVisitsDue:'30',MDOrderRequired:'Yes',MDOrderDue:'60',MDVisitDue:'90'})});
rows.push({operation:'CreatePatientNote',body:patientNoteRequest({PatientID:'8',ReasonID:'7',Note:'Synthetic operational note',Internal:'Y',EmergencyOfPriority:'N',NoteType:null,FromDate:null,ToDate:null})});
for (const role of ['Patient','Caregiver']) rows.push({operation:'Update'+role+'Document',body:documentMetadataRequest({UserRole:role,SubjectID:'8',DocumentID:'9',DocumentTypeID:'7',Description:'Synthetic',FileName:'synthetic.txt',FileBytes:'4',FileSHA256:createHash('sha256').update('test').digest('hex')},Buffer.from('test').toString('base64'))});
for (const role of ['Patient','Caregiver']) rows.push({operation:'Change'+role+'Document',body:documentReplacementRequest({UserRole:role,SubjectID:'8',DocumentID:'9',...replacementFile('replacement.txt','dGVzdA==')},'dGVzdA==')});
for (const role of ['Patient','Caregiver']) rows.push({operation:'Add'+role+'Document',body:documentCreationRequest({UserRole:role,SubjectID:'8',DocumentTypeID:'7',Description:'Reviewed',...replacementFile('new.txt','dGVzdA==')},'dGVzdA==')});
rows.push({operation:'AddPatientContract',body:createContractRequest({PatientID:'8',ContractID:'4',ServiceCodeID:'5',StartDate:'2026-10-01',AltPatientID:'Synthetic',IsPrimaryContract:'N'})});
rows.push({operation:'CreateReferralSource',body:createReferralRequest({Name:'Synthetic',ReferralSourceTypeID:'7',OfficeID:'123',OfficeName:'Synthetic office',Status:'Inactive'})});
rows.push({operation:'CreateLinkedSchedule',body:createLinkedScheduleRequest({OfficeID:'123',PatientID:'8',CaregiverID:'9',PayCodeID:'4',ServiceCodeID:'5',ScheduleType:'Non-Skilled',VisitDate:'2026-10-10',ScheduleStartTime:'0900',ScheduleEndTime:'1200'})});
rows.push({operation:'AddCollectionNote',body:collectionNoteRequest({VisitID:'77',PatientID:'8',ContractID:'4',OfficeID:'123',ARNotesReasonID:'1',CollectionRepID:'2',CollectionStatusID:'3',RefClaimStatusID:'4',RefReasonForNonPaymentID:'5',FollowUpRepID:'6',Notes:'Synthetic',FollowupDate:'2026-10-05'})});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
rows.push({operation:'UploadCaregiverPicture',body:caregiverPictureRequest({CaregiverID:'8',...pictureFile('reviewed.png',png)},png)});
const availability = {CaregiverID:'9',PermanentWeekID:'7',SpecialAvailabilityID:'8',FromDate:'2026-09-01',ToDate:'2026-09-30'};
for (const day of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) Object.assign(availability,{[day+'AvailabilityType']:'Preferred',[day+'LiveIn']:'No',[day+'From']:'0800',[day+'To']:'1700'});
for (const operation of AVAILABILITY_WRITES) rows.push({operation,body:availabilityRequest(operation,availability)});
for (const operation of AVAILABILITY_CREATIONS) rows.push({operation,body:availabilityCreationRequest({...availability,Operation:operation})});
console.log(JSON.stringify(rows));
"""
rows = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", source], text=True))


def fields(node):
    extension = node.find("s:complexContent/s:extension", NS)
    inherited = []
    if extension is not None and extension.get("base", "").startswith("tns:"):
        base = schema.find("s:complexType[@name='" + extension.get("base")[4:] + "']", NS)
        assert base is not None
        inherited = fields(base)
    return inherited + node.findall(".//s:sequence/s:element", NS)


def check(actual, expected, path):
    declarations = fields(expected)
    names = [item.get("name") for item in declarations if item.get("name") != "Authentication"]
    children = list(actual)
    assert all(child.tag in names for child in children), (path, "unknown element", [c.tag for c in children], names)
    positions = [names.index(child.tag) for child in children]
    assert positions == sorted(positions), (path, "wrong element order")
    for declaration in declarations:
        name = declaration.get("name")
        if name == "Authentication":
            continue
        matches = [child for child in children if child.tag == name]
        assert len(matches) >= int(declaration.get("minOccurs", "1")), (path, "missing required", name)
        maximum = declaration.get("maxOccurs", "1")
        assert maximum == "unbounded" or len(matches) <= int(maximum), (path, "duplicate", name)
        for child in matches:
            if child.get(XSI) == "true":
                assert declaration.get("nillable") == "true", (path, "not nillable", name)
                continue
            datatype = declaration.get("type", "")
            if datatype.startswith("tns:"):
                nested = schema.find("s:complexType[@name='" + datatype[4:] + "']", NS)
                assert nested is not None, datatype
                check(child, nested, path + "/" + name)


for row in rows:
    declaration = schema.find("s:element[@name='" + row["operation"] + "']", NS)
    assert declaration is not None, row["operation"]
    actual = ET.fromstring('<Request xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' + row["body"] + "</Request>")
    check(actual, declaration, row["operation"])
writes = sum(not row["operation"].startswith(("Get", "Search", "Download")) for row in rows)
print(f"HHA_REQUEST_CONTRACTS: PASS ({len(rows) - writes} reads, {writes} gated writes)")
