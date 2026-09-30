"""Generate a complete contract inventory; availability is never entitlement."""
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {"w": "http://schemas.xmlsoap.org/wsdl/", "s": "http://www.w3.org/2001/XMLSchema"}
tree = ET.parse(ROOT / "hharefs/hha-wdsl.xml").getroot()
operations = sorted({node.attrib["name"] for node in tree.findall("w:portType/w:operation", NS)})
wrappers = {"GetCollectionStatus", "GetVisitChangesV5", "GetScheduleInfo", "GetCaregiverChangesV4", "GetPatientChangesV4", "GetPatientAuthorizationChanges", "GetPatientAuthorizationInfo", "GetCaregiverPermanentWeekAvailability", "GetCaregiverSpecialAvailability", "GetBillingServiceCodes"}
read_source = (ROOT / 'functions/src/operations/reads.ts').read_text(encoding='utf-8')
workspace_reads = set(re.findall(r'"([A-Za-z0-9]+)"', re.search(r'READ_OPERATIONS = \[(.*?)\]', read_source).group(1)))
wrappers |= workspace_reads
typed_writes = {"CreateLinkedSchedule", "UpdateCaregiverRate", "UpdateCaregiverPermanentWeekAvailability", "UpdateCaregiverSpecialAvailability", "UpdateDocumentType", "CreateInserviceTopics", "AddCaregiverRate", "UpdatePatientContract", "AddCaregiverPermanentWeekAvailability", "AddCaregiverSpecialAvailability", "CreatePatientNote", "UpdatePatientDocument", "UpdateCaregiverDocument", "UpdatePatientClinicalInfo", "CreateCaregiverMedical", "ChangePatientDocument", "ChangeCaregiverDocument", "AddPatientDocument", "AddCaregiverDocument", "UploadCaregiverPicture", "AddPatientContract", "CreateReferralSource", "AddCollectionNote"}
wrappers |= typed_writes

def area(name):
    for words, label in [(('Payroll', 'PayRate', 'CaregiverRate', 'DirectDeposit', 'PTO'), 'Payroll'), (('Collection', 'Billed', 'BillInfo', 'Billing'), 'Billing and collections'), (('Authorization',), 'Authorizations'), (('Schedule', 'Visit', 'CallInOut', 'CallDash'), 'Visits and EVV'), (('Availability', 'Preference', 'MasterWeek'), 'Staffing'), (('Caregiver', 'Compliance', 'InService', 'Inservice', 'I9'), 'Caregivers and compliance'), (('Patient', 'POC', 'Referral'), 'Patients and referrals')]:
        if any(word in name for word in words):
            return label
    return 'Reference data'

gate_source = (ROOT / 'functions/src/integrations/hhaexchange/contractGates.ts').read_text(encoding='utf-8')
guide_absent = set(re.findall(r'"([A-Za-z0-9]+)"', re.search(r'GUIDE_ABSENT = \[(.*?)\]', gate_source).group(1)))
guide_removed = set(re.findall(r'"([A-Za-z0-9]+)"', re.search(r'GUIDE_REMOVED = \[(.*?)\]', gate_source).group(1)))
final_six_blockers = {
    "CreateCaregiver": "Guide pp75-76 requires an employment discipline from GetDisciplines. Its optional DisciplineType selector has no documented accepted values or omission behavior. Obtain an authoritative catalog request and agency-required Employee/Applicant fields; do not substitute payroll codes or existing employees as current catalog validation.",
    "CreatePatient": "Guide p31 requires an accepted-service discipline from GetDisciplines, whose selector/default is undocumented. EVVRequired, FOBRequired, BeaconRequired and automatic-verification/downward-adjustment settings also lack current readback. Obtain approved agency values plus a supported persisted-settings verifier; no referral prerequisite is inferred.",
    "CreatePatientAuthorization": "Guide pp23-25 supplies HoursPerAuthPeriod, MaxHoursPeriod and weekday fields named Minutes but describes decimal hour fractions; readback exposes MaxUnits and period limits without a canonical units mapping. Obtain a worked request/readback pair for the intended period/service, nil-field behavior and LTC ProviderNumber applicability. ProgramCode/BudgetAmount also lack readback when supplied.",
    "CreateSchedule": "Required ScheduleType appears only in creation requests, not persisted visit/schedule readback. Obtain a supported persisted-type verifier. Also confirm agency variable-visit configuration and UPR EnableBudgetNumber applicability for any chosen scope; do not guess defaults. Temporary flags/budget/duration do have GetVisitInfoV2 readback.",
    "UpdateSchedule": "V2 exposes temporary flags, duration, budget and suggested times, so these are not missing. Remaining prerequisites: documented edit-reason/note applicability and omission/preservation behavior, persisted edit-event verification, and canonical BillType/dollar-service mapping. BilledAmount is non-nullable in WSDL although guide p136 makes it situational; GetVisitInfoV2 returns it only for dollar services. Do not insert a guessed zero or infer note preservation.",
    "UpdateLinkedSchedule": "GetLinkedScheduleInfo lacks persisted ScheduleType and Comments. Guide p139 applies Comments only to Skilled schedules but gives no omission-preserves rule. Obtain current type/comment readback or an authoritative preservation contract, plus edit-reason/note applicability and persisted-event verification; service-catalog membership is not proof of the visit type."
}
items = []
for name in operations:
    element = tree.find(f"w:types/s:schema/s:element[@name='{name}']", NS)
    params = [] if element is None else [{"name": n.get('name'), "type": n.get('type', 'complex'), "required": n.get('minOccurs', '1') != '0'} for n in element.findall('s:complexType/s:sequence/s:element', NS) if n.get('name') != 'Authentication']
    kind = 'Read candidate' if name.startswith(('Get', 'Search', 'Download')) else 'Consequential write'
    state = 'Partial workflow; independent evidence verifier missing' if name == 'CreateLinkedSchedule' else 'Protected workspace read' if name in workspace_reads else 'Health check wired' if name == 'GetCollectionStatus' else 'Gated write and reconciliation' if name in typed_writes else 'Adapter only' if name in wrappers else 'Not implemented'
    gate = 'Server activation blocked: persisted ScheduleType lacks an independent evidence verifier; reference strings and type assertions cannot resolve recovery' if name == 'CreateLinkedSchedule' else 'Deployment data approval plus reviewed owner enablement required; source fields remain unvalidated' if name in workspace_reads else 'Approved admin and deployed backend; returns reference count only' if name == 'GetCollectionStatus' else 'PHI platform approval, HHA entitlement, source validation and typed workflow required' if kind == 'Read candidate' else 'Reviewed proposal, authorized approval, immutable audit, idempotency and re-read reconciliation required'
    items.append({"name": name, "area": area(name), "kind": kind, "implementation": state, "parameters": params, "gate": gate, "executable": name == 'GetCollectionStatus', "workspaceRead": name in workspace_reads, "writePrepared": name in typed_writes, "writeExecutable": name in typed_writes and name != "CreateLinkedSchedule", "entitlement": "Unverified", "guideStatus": "Absent from v3.30; server blocked" if name in guide_absent else "Removed by v3.30 revision history; server blocked" if name in guide_removed else "Mentioned in v3.30; entitlement and semantics still require validation"})
gates = {x['implementation'] if x['executable'] or x['workspaceRead'] else x['kind']: x['gate'] for x in items}
guide_statuses = list(dict.fromkeys(x['guideStatus'] for x in items))
implementation_states = list(dict.fromkeys(x['implementation'] for x in items))
areas = list(dict.fromkeys(x['area'] for x in items))
compact_items = [{**{k: v for k, v in x.items() if k not in ('gate', 'entitlement', 'guideStatus', 'implementation', 'area', 'parameters') and v is not False}, 'guideStatus': guide_statuses.index(x['guideStatus']), 'implementation': implementation_states.index(x['implementation']), 'area': areas.index(x['area']), 'parameters': [[p['name'],p['type'],p['required']] for p in x['parameters']]} for x in items]
payload = {"prerequisites": final_six_blockers, "contract": "Captured ENT v1.8 WSDL", "count": len(items), "gates": gates, "entitlement": "Unverified", "guideStatuses": guide_statuses, "implementationStates": implementation_states, "areas": areas, "items": compact_items}
(ROOT / 'public/primetime/hha-capabilities.json').write_text(json.dumps(payload, separators=(',', ':')) + '\n', encoding='utf-8')
lines = ['# HHA API dashboard coverage', '', 'Generated by `python3 scripts/hha_capabilities.py` from the captured WSDL. This is a contract inventory, not a claim of licensed access or working integrations. Read/write classification and workflow grouping are conservative name-based triage; each operation needs contract and entitlement validation before execution.', '', f'{len(items)} operations; {len(wrappers)} typed wrappers (including {len(typed_writes)} default-disabled mutations), including {len(workspace_reads)} protected operational reads connected to owner controls and the dashboard. `GetCollectionStatus` has a reference-count health control. Three typed reference reads are guide-absent and server-blocked. Twenty-two mutation workflows have default-false release gates and independent approval. CreateLinkedSchedule is an additional partial workflow whose production dispatch and applied recovery are server-blocked pending an independent evidence verifier. Operational reads require the deployment data gate and per-operation owner enablement. All operations are searchable in the dashboard capability browser. No arbitrary SOAP execution route exists.', '', 'Exact approved owner values were not found in the Windows checkout or local memory_summary.md search. Owner completion attestation is preserved; parent is retrieving shared project context. Do not replace missing detailed decisions with assumptions.', '', '| Operation | Dashboard area | Access triage | Implementation | Vendor guide | Release gate |', '|---|---|---|---|---|---|']
lines += [f"| `{x['name']}` | {x['area']} | {x['kind']} | {x['implementation']} | {x['guideStatus']} | {x['gate']} |" for x in items]
(ROOT / 'docs/management-layer/HHA_CAPABILITY_MATRIX.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
remaining = [x for x in items if x['implementation'] == 'Not implemented']
remaining_lines = ['# HHA remaining implementation work', '', 'This list identifies code still missing; it is not all blocked by infrastructure. Each read needs an explicit validated request, minimal DTO, controls and fixtures. Each mutation needs field-level authority, before/proposed review, submit-once and unknown-outcome reconciliation. Contract-only/legacy conflicts also require vendor-guide reconciliation; do not activate them based on this list.', '', '| Operation | Kind | Code still required |', '|---|---|---|']
missing_semantics = {
    "UpdatePatientDemographics": "EVVRequired, FOBRequired, BeaconRequired, ExpandedTimeForAutoVerification and AutomaticDownwardAdjustment occur only in create/update contracts, not current readback. Obtain their current-state endpoint or explicit operation-specific omission-preserves semantics before lossless edits; caregiver blank-preserves rules do not apply",
    "UpdateCaregiverDemographics": "Non-star NYCRegistryCheckedDate lacks direct GetCaregiverDemographics readback (only changes feed); p79 preservation applies only to starred fields. Establish complete fresh changes projection or documented omission-preserves behavior, while preserving immutable OfficeID/CaregiverCode",
    "UpdatePatientAuthorization": "ProgramCode and BudgetAmount occur only in create/update requests, absent from current authorization readback. Obtain current values or explicit omission-preserves semantics before edits; verify hours-versus-MaxUnits mapping independently",
    "CreatePatientPOC": "Guide v3.30 pp17-21 and WSDL lack persisted POC Shift/configured task Minutes readback. Ask which supported operation/export returns these by POCHeaderID/POCTaskID; performed visit-task minutes are not a substitute. If none, require independent post-write reconciliation",
    "UpdatePatientPOC": "Confirm persisted Shift/task Minutes readback; if unavailable define omitted/empty Shift, nil Minutes, omitted/empty POCTasks and omitted-task behavior, plus independent reconciliation. Caregiver-demographics preservation rules do not apply. Payer-synchronized UPR POCs reject updates under guide p19",
    "CreateCaregiverOtherCompliance": "The creation response returns CaregiverOtherComplianceID, but captured read contracts expose no completed compliance record with that ID, score, performed date and result. The due-item feed uses CaregiverMedicalID and lacks these fields; obtain a verified ID mapping and current-record reconciliation before execution",
    'GetDisciplines': 'Guide references the method but does not define DisciplineType selection semantics; obtain vendor request examples before enabling',
    'GetPayrollCostCenters': 'Guide references the method but does not define CostCenterNo selection/sentinel semantics; obtain vendor request examples',
    'GetCaregiverCityTaxes': 'Guide references the method without defining its Status request semantics; obtain vendor clarification',
    'GetReferralProfile': 'Official ENT1.8 example resolves SearchFilters AllSearchFilter and ReferralSearch/ReferralSearchInfo response. No-filter sentinel remains unverified; implement only if a documented bounded filter can be established',
    'SearchVisits': 'Current guide documents SearchVisitsV2; verify legacy SearchVisits compatibility and filters (V2 is already implemented)',
    'CreateWeeklyVariable': 'No current weekly-variable record or balance readback in the captured WSDL; obtain a reconciliation endpoint and exact result identity before execution',
    'UpdateWeeklyVariable': 'WeeklyVariableID occurs only in write contracts; obtain current record lookup and reconciliation semantics before execution',
    'UpdatePatientPreference': 'Current preference Type/Value strings are not mapped to scheduled/not-scheduled request lists; obtain lossless preservation and clear-field semantics',
    'RemoveCaregiverPicture': 'Download response does not define an explicit absent/deleted state; obtain absence-versus-failure semantics before deletion reconciliation',
    'UpdatePatientReferralInfo': 'GetPatientReferralInfo returns ReferralCommissionStatusID/Status; ComissionStatus write maps 1 Paid and 0 Not Paid. Lost-reason current mapping and omission/clearing remain unresolved; changes-feed ReferralLostReasonNote conflicts (int XSD versus String guide p233)',
    'UpdateCaregiverAccrualPTO': 'Guide p117 documents caregiver/type upsert; current accrued minutes and returned CaregiverAccrualID lack ledger readback. Obtain current balance/history reconciliation before executing',
    'CreateDocumentType': 'New-type readback needs an unfiltered type catalog. The guide calls document ID optional but WSDL requires a non-null integer; obtain the supported no-filter sentinel instead of guessing zero',
    'AddCaregiverTrainingSchool': 'GetComplianceTrainingSchools TrainingSchoolID is a caregiver-training association candidate (guide p102), but equality to returned CaregiverTrainingID is not explicit; obtain verified cross-method identity mapping',
    'AddCaregiverInService': 'Required IsScheduled distinguishes Scheduled/Completed but is absent from GetCaregiverInServices readback; obtain status reconciliation before execution',
    'UpdateCaregiverInService': 'Required IsScheduled has no current-value mapping in GetCaregiverInServices; obtain lossless status preservation and reconciliation',
    'UpdateCaregiverI9Requirements': 'GetCaregiverChangesV2Info exposes all I9 fields; read Y/N maps to write YES/NO. Establish complete feed bootstrap, ties, freshness and required/nillable encoding; only HireDate omission-preserves is explicit (p117). Qualified evidence review remains required',
    'UpdateCaregiverTrainingSchool': 'GetComplianceTrainingSchools TrainingSchoolID is an association-ID candidate (p102), but equality to update CaregiverTrainingID is not explicit. Obtain verified current-record identity mapping before substitution',
    'CreateCaregiverNote': 'Vendor notification and payer-note string controls lack verified suppression semantics; obtain explicit no-notification values before any executable note workflow',
    'UpdateCaregiverAvailabilityMaxVisits': 'Documented current availability responses do not expose MaxVisit before-values; obtain supported readback mapping before enabling a mutation',
}
missing_semantics.update(final_six_blockers)
handoff_only = {
    'DeletePatientDocument': 'Destructive patient-record removal: requires approved retention/archive policy, verified preserved copy and per-record authorization; execution stays with an authorized HHA operator',
    'DeleteCaregiverDocument': 'Destructive personnel/compliance-record removal: requires approved retention/archive policy, verified preserved copy and per-record authorization; execution stays with an authorized HHA operator',
    'DeleteVisit': 'Requires per-visit maintenance authority, reason, already-billed review and preservation of actual EVV/payroll evidence; no automatic deletion policy was recovered',
}

def remaining_requirement(item):
    name = item['name']
    if name in guide_absent or name in guide_removed:
        return item['guideStatus'] + '; vendor clarification required before implementation or activation'
    if name in missing_semantics:
        return missing_semantics[name]
    if name in handoff_only:
        return handoff_only[name]
    return 'Operation-specific preparation, fields, independent review, submit-once execution, target serialization and reconciliation still require implementation; not an infrastructure-only blocker'
remaining_lines += [f"| `{x['name']}` | {x['kind']} | {remaining_requirement(x)} |" for x in remaining]
(ROOT / 'docs/management-layer/HHA_REMAINING_IMPLEMENTATION.md').write_text('\n'.join(remaining_lines) + '\n', encoding='utf-8')
print(f'HHA_CAPABILITY_MATRIX: {len(items)} operations')

categories = {'A': [], 'B': [], 'C': [], 'D': []}
for item in remaining:
    name = item['name']
    category = 'A' if name in guide_absent | guide_removed else 'B' if name in missing_semantics else 'C' if name in handoff_only else 'D'
    categories[category].append(item)
report = ['# Remaining HHA work by prerequisite', '', 'This categorizes the currently not-implemented operations listed below. Counts are generated per category. Other server-blocked operations already have wrappers and are outside these counts. Category D is code work still in progress, not an approval blocker. Category C concerns execution; read-only handoff preparation may still be added.', '']
labels = {'A': 'Vendor-undocumented or removed', 'B': 'Missing documented semantics or current-state mapping', 'C': 'Sensitive deletion handoff / missing owner policy', 'D': 'Further contract-grounded implementation work'}
for category, group in categories.items():
    report += [f'## {category}. {labels[category]} ({len(group)})', '', ', '.join('`'+item['name']+'`' for item in group), '']
    if category in ('B', 'C'):
        report += ['| Operation | Specific prerequisite |', '|---|---|'] + [f"| `{item['name']}` | {remaining_requirement(item)} |" for item in group] + ['']
(ROOT / 'docs/management-layer/HHA_REMAINING_CATEGORIES.md').write_text('\n'.join(report).rstrip() + '\n', encoding='utf-8')
