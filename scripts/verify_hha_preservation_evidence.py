"""Verify the captured-contract facts used by the six-workflow assessment.

This checks schema evidence, not vendor business semantics or entitlement.
"""
from pathlib import Path
import hashlib
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
WSDL = ROOT / "hharefs/hha-wdsl.xml"
NS = {"s": "http://www.w3.org/2001/XMLSchema", "w": "http://schemas.xmlsoap.org/wsdl/"}
schema = ET.parse(WSDL).getroot().find("w:types/s:schema", NS)
types = {node.get("name"): node for node in schema.findall("s:complexType", NS)}

def owners(field):
    return sorted(name for name, node in types.items() if node.find("s:sequence/s:element[@name='" + field + "']", NS) is not None)

def declaration(type_name, field):
    return types[type_name].find("s:sequence/s:element[@name='" + field + "']", NS)

assert owners("ScheduleType") == ["CreateLinkedScheduleInfo", "CreateScheduleInfo"]
for field in ["EVVRequired", "FOBRequired", "BeaconRequired", "ExpandedTimeForAutoVerification", "AutomaticDownwardAdjustment"]:
    assert owners(field) == ["PatientDetails", "UpdatePatientDemographics"], (field, owners(field))
for field in ["ProgramCode", "BudgetAmount", "HoursPerAuthPeriod", "MaxHoursPeriod"]:
    assert owners(field) == ["CreateAuthorizationInfo", "UpdateAuthorizationInfo"], (field, owners(field))
for field in ["IsScheduleTemporary", "IsCaregiverTemporary", "BudgetNumber", "SuggestedStartTime", "SuggestedEndTime", "ScheduleDuration"]:
    assert declaration("GetVisitInfoDetailsV2", field) is not None, field
assert declaration("LinkedScheduleInfoResponse", "Comments") is None
assert declaration("LinkedScheduleInfoResponse", "ScheduleType") is None
assert owners("ScheduleBillInfoEditReasonsID") == ["UpdateLinkedScheduleInfo", "UpdateScheduleInfo"]
billed = declaration("UpdateScheduleInfo", "BilledAmount")
assert billed is not None and billed.get("minOccurs", "1") == "1" and billed.get("nillable") != "true"
selector = schema.find("s:element[@name='GetDisciplines']/s:complexType/s:sequence/s:element[@name='DisciplineType']", NS)
assert selector is not None and selector.get("type") == "s:string" and selector.get("minOccurs") == "0"
assert declaration("CaregiverDetails", "EmploymentTypes") is not None
assert declaration("PatientDetails", "AcceptedServices") is not None
print("HHA_PRESERVATION_EVIDENCE: PASS (schema facts; business semantics remain unresolved)")
print("Captured WSDL SHA256: " + hashlib.sha256(WSDL.read_bytes()).hexdigest())
