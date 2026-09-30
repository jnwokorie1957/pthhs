"""Validate every declared minimal DTO field against its operation's captured XSD.

Requires the Functions build; never fetches vendor data.
"""
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {"s": "http://www.w3.org/2001/XMLSchema", "w": "http://schemas.xmlsoap.org/wsdl/"}
schema = ET.parse(ROOT / "hharefs/hha-wdsl.xml").getroot().find("w:types/s:schema", NS)
module = (ROOT / "functions/lib/operations/reads.js").as_uri()
source = "import {READ_PROJECTIONS} from " + json.dumps(module) + "; console.log(JSON.stringify(READ_PROJECTIONS));"
projections = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", source], text=True))
types = {node.get("name"): node for node in schema.findall("s:complexType", NS)}


def fields(type_name):
    node = types.get(type_name.removeprefix("tns:"))
    return [] if node is None else node.findall(".//s:sequence/s:element", NS)


def record_types(type_name, tag, seen=()):
    if type_name in seen:
        return []
    result = []
    for child in fields(type_name):
        if child.get("name") == tag:
            result.append(child.get("type"))
        result += record_types(child.get("type", ""), tag, (*seen, type_name))
    return result


def has_path(type_name, path):
    head, *rest = path.split("/")
    return any(child.get("name") == head and (not rest or has_path(child.get("type", ""), "/".join(rest))) for child in fields(type_name))


errors = []
for operation, projection in projections.items():
    response = schema.find("s:element[@name='" + operation + "Response']", NS)
    result_type = response.find(".//s:sequence/s:element", NS).get("type")
    records = [result_type] if projection["record"] == "$result" else record_types(result_type, projection["record"])
    if not records:
        errors.append(f"{operation}: record {projection['record']} absent")
    for path in projection["fields"]:
        if records and not any(has_path(record, path) for record in records):
            errors.append(f"{operation}: field {path} absent")
assert not errors, "\n".join(errors)
print(f"HHA_RESPONSE_PROJECTIONS: PASS ({len(projections)} minimal DTOs)")
