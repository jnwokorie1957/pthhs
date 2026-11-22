import type {OperationsWorkspace} from '../operations/workspace.js';
import {HhaProfileSource} from './hhaSource.js';
import {WorkforceError} from './policy.js';
import {licenseDate} from './caregiverOffice.js';

type Workspace = Pick<OperationsWorkspace, 'settings' | 'query'>;
const requiredReads = ['GetCaregiverDemographics', 'SearchVisitsV2', 'GetScheduleInfo', 'GetPatientDemographics'];
const sourceId = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value);
const unavailable = () => new WorkforceError(503, 'scheduled_clients_unverified');

export async function scheduledClients(workspace: Workspace, actor: string, office: string, caregiverId: string, date: string, access: () => Promise<void>) {
  await access();
  if (!sourceId(caregiverId) || !licenseDate(date)) throw new WorkforceError(400, 'invalid_request');
  const settings = async () => {
    const current = await workspace.settings();
    if (!current.dataApproved || current.settings.officeId !== office || requiredReads.some(read => !current.settings.enabledReads.includes(read))) {
      throw new WorkforceError(423, 'scheduled_client_reads_unavailable');
    }
    return current.settings.revision;
  };
  const revision = await settings();
  const caregivers = new HhaProfileSource(workspace, actor, office);
  const checkCaregiver = async () => {
    if ((await caregivers.profile(caregiverId)).status !== 'Active') throw new WorkforceError(409, 'caregiver_inactive');
  };
  await checkCaregiver();
  const through = new Date(Date.parse(date) + 6 * 86400000).toISOString().slice(0, 10);
  const discovery = await workspace.query({operation:'SearchVisitsV2', officeId:office, caregiverId, fromDate:date, toDate:through}, actor, 'visit_discovery');
  if (discovery.source !== 'hhaexchange' || discovery.operation !== 'SearchVisitsV2' || discovery.truncated || discovery.records.length > 30) throw unavailable();
  const members = new Set<string>();
  for (const visit of new Set(discovery.records.map(row => row.VisitID))) {
    if (!sourceId(visit)) throw unavailable();
    const detail = await workspace.query({operation:'GetScheduleInfo', id:visit}, actor);
    const row = detail.records[0], patient = row?.['Patient/ID'], day = row?.VisitDate?.split('T')[0];
    if (detail.source !== 'hhaexchange' || detail.operation !== 'GetScheduleInfo' || detail.truncated || detail.records.length !== 1 ||
        row?.ID !== visit || row['Caregiver/ID'] !== caregiverId || !sourceId(patient) || !day || !licenseDate(day) || day < date || day > through) throw unavailable();
    members.add(patient);
  }
  const items = [];
  for (const id of members) {
    const result = await workspace.query({operation:'GetPatientDemographics', id}, actor);
    const row = result.records[0];
    if (result.source !== 'hhaexchange' || result.operation !== 'GetPatientDemographics' || result.truncated || result.records.length !== 1 ||
        row?.PatientID !== id || row.OfficeID !== office) throw unavailable();
    const name = [row.FirstName, row.LastName].filter(Boolean).join(' ').trim();
    if (!name) throw unavailable();
    items.push({id, name, memberId:row.AdmissionID || id});
  }
  await checkCaregiver();
  await access();
  if (await settings() !== revision) throw new WorkforceError(409, 'revision_conflict');
  return {items:items.sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), from:date, through, checkedAt:new Date().toISOString()};
}
